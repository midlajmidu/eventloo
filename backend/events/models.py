from django.db import models
from django.contrib.auth import get_user_model
from django.core.validators import MinValueValidator, MaxValueValidator
import secrets
import string
from django.utils import timezone
from django.core.exceptions import ValidationError
from decimal import Decimal, InvalidOperation

User = get_user_model()

class Event(models.Model):
    EVENT_TYPES = [
        ('competition', 'Competition'),
        ('cultural', 'Cultural'),
        ('sports', 'Sports'),
        ('academic', 'Academic'),
        ('workshop', 'Workshop'),
        ('seminar', 'Seminar'),
        ('other', 'Other'),
    ]
    
    EVENT_STATUS = [
        ('draft', 'Draft'),
        ('published', 'Published'),
        ('ongoing', 'Ongoing'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]
    
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    event_type = models.CharField(max_length=20, choices=EVENT_TYPES, default='other')
    status = models.CharField(max_length=20, choices=EVENT_STATUS, default='draft')
    
    # Date and time
    start_date = models.DateField()
    end_date = models.DateField()
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    registration_deadline = models.DateTimeField(null=True, blank=True)
    
    # Location and logistics
    venue = models.CharField(max_length=200, blank=True)
    max_participants = models.IntegerField(null=True, blank=True)
    max_teams = models.PositiveIntegerField(null=True, blank=True)
    is_team_based = models.BooleanField(default=True)
    team_size_min = models.PositiveIntegerField(null=True, blank=True)
    team_size_max = models.PositiveIntegerField(null=True, blank=True)
    
    # Points and rewards
    winner_points = models.PositiveIntegerField(default=100, validators=[MinValueValidator(0)])
    runner_up_points = models.PositiveIntegerField(default=75, validators=[MinValueValidator(0)])
    participation_points = models.PositiveIntegerField(default=25, validators=[MinValueValidator(0)])
    
    # Administrative
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_events')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Event image (optional)
    image = models.TextField(null=True, blank=True)  # URL to image
    
    class Meta:
        ordering = ['-created_at']
        
    def __str__(self):
        return self.title
    
    @property
    def current_participants(self):
        if self.is_team_based:
            return sum(team.members.count() for team in self.teams.all())
        else:
            return self.individual_participants.count()
    
    @property
    def current_teams(self):
        if self.is_team_based:
            return self.teams.count()
        return 0
    
    @property
    def is_registration_open(self):
        return (
            self.status in ['published'] and 
            timezone.now() < self.registration_deadline
        )

    @property
    def time_status(self):
        today = timezone.now().date()
        if self.start_date > today:
            return 'upcoming'
        elif self.start_date <= today <= self.end_date:
            return 'ongoing'
        else:
            return 'completed'

    def delete(self, *args, **kwargs):
        """Override delete method to automatically clean up all related data"""
        # Note: Teams are no longer linked to events, so we don't delete teams here
        # Teams can participate in multiple events, so deleting an event shouldn't delete teams
        
        # Delete all individual participations for this event
        self.individual_participants.all().delete()
        
        # Delete all programs for this event (this will cascade to clean up program-related data)
        self.programs.all().delete()
        
        # Delete all announcements for this event
        self.announcements.all().delete()
        
        # Delete all chest numbers for this event
        from .models import ChestNumber
        ChestNumber.objects.filter(event=self).delete()
        
        # Delete all points records for this event
        from .models import PointsRecord
        PointsRecord.objects.filter(event=self).delete()
        
        # Call the parent delete method
        super().delete(*args, **kwargs)

class Team(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    members = models.ManyToManyField(User, related_name='team_memberships', blank=True)
    team_manager = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='managed_teams', limit_choices_to={'role': 'team_manager'})
    
    # Team performance
    points_earned = models.PositiveIntegerField(default=0)
    position = models.PositiveIntegerField(null=True, blank=True)  # Final ranking
    
    # Team number (auto-assigned sequential number)
    team_number = models.PositiveIntegerField(null=True, blank=True, unique=True)
    
    # Team Manager Login Credentials (Auto-generated)
    team_username = models.CharField(max_length=100, unique=True, blank=True)
    team_password = models.CharField(max_length=50, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['name']
        
    def __str__(self):
        return self.name
    
    def save(self, *args, **kwargs):
        is_new = self.pk is None

        # Auto-generate team credentials if not set
        if not self.team_username or not self.team_password:
            self.generate_team_credentials()

        super().save(*args, **kwargs)
        
        # For new teams, assign the next available team number
        if is_new and not self.team_number:
            self.team_number = self.get_next_team_number()
            super().save(update_fields=['team_number'])

    @classmethod
    def reset_team_numbering(cls):
        """Reset team numbering to be sequential (1, 2, 3, etc.) based on creation order"""
        # Get all teams ordered by creation date
        teams = cls.objects.all().order_by('created_at')
        
        # Renumber teams sequentially starting from 1
        for index, team in enumerate(teams, start=1):
            if team.team_number != index:
                team.team_number = index
                team.save(update_fields=['team_number'])
    
    @classmethod
    def get_next_team_number(cls):
        """Get the next available team number, restarting from 1 if no teams exist"""
        # Get the highest team number currently in use
        max_number = cls.objects.aggregate(
            max_number=models.Max('team_number')
        )['max_number']
        return (max_number or 0) + 1
    
    @property
    def member_count(self):
        # Count all team members
        return self.members.count()
    
    @property
    def team_number_display(self):
        """Get the team number for display purposes"""
        return self.team_number or self._calculate_team_number()
    
    def _calculate_team_number(self):
        """Calculate team number based on creation order (fallback method)"""
        # Return the team_number if set, otherwise calculate based on creation order
        if self.team_number:
            return self.team_number
        
        # Fallback: find position in creation order
        teams = Team.objects.filter(created_at__lte=self.created_at).order_by('created_at')
        for index, team in enumerate(teams, start=1):
            if team.id == self.id:
                return index
        return None
    
    def generate_team_credentials(self):
        """Generate or regenerate team manager credentials"""
        # Generate team username for internal tracking
        base_username = self.name.lower().replace(' ', '_').replace('-', '_')
        team_username = f"{base_username}_team"
        
        # Ensure team_username uniqueness
        counter = 1
        original_team_username = team_username
        while Team.objects.filter(team_username=team_username).exclude(id=self.id).exists():
            team_username = f"{original_team_username}_{counter}"
            counter += 1
        
        # Generate secure password
        password = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(8))
        
        # Store credentials in team model (don't call save() here to avoid infinite loop)
        self.team_username = team_username
        self.team_password = password
        
        return team_username, password
    
    @property
    def team_credentials(self):
        """Get existing team credentials if available"""
        if self.team_username and self.team_password:
            return {
                'username': self.team_username,
                'password': self.team_password
            }
        return None
    
    def delete(self, *args, **kwargs):
        """Override delete method to automatically clean up related data"""
        # Store the team number before deletion for potential renumbering
        team_number = self.team_number
        
        # Get all students who were in this team
        team_members = list(self.members.all())
        
        # Delete all program assignments for this team
        from .models import ProgramAssignment
        ProgramAssignment.objects.filter(team=self).delete()
        
        # Delete all program results for this team
        from .models import ProgramResult
        ProgramResult.objects.filter(team=self).delete()
        
        # Delete all chest numbers for this team
        from .models import ChestNumber
        ChestNumber.objects.filter(team=self).delete()
        
        # Delete all points records for this team
        from .models import PointsRecord
        PointsRecord.objects.filter(team=self).delete()
        
        # Delete team profile if exists
        if hasattr(self, 'profile'):
            self.profile.delete()
        
        # Call the parent delete method
        super().delete(*args, **kwargs)
        
        # After deletion, reset team numbering to ensure sequential numbering
        Team.reset_team_numbering()
        
        # Clean up any orphaned program assignments for students who were in this team
        # This ensures students get new chest numbers when assigned to new teams
        for student in team_members:
            # Remove team reference from any remaining program assignments
            orphaned_assignments = ProgramAssignment.objects.filter(
                student=student,
                team__isnull=False
            ).exclude(
                team__in=Team.objects.all()
            )
            
            for assignment in orphaned_assignments:
                assignment.team = None
                assignment.chest_number = None  # Remove chest number so it gets regenerated
                assignment.save()
            
            # Remove team reference from any remaining chest numbers
            orphaned_chest_numbers = ChestNumber.objects.filter(
                student=student,
                team__isnull=False
            ).exclude(
                team__in=Team.objects.all()
            )
            
            for chest_number in orphaned_chest_numbers:
                chest_number.team = None
                chest_number.chest_number = None  # Remove chest number so it gets regenerated
                chest_number.save()
    
    def has_assignments(self):
        """Check if this team has any program assignments"""
        from .models import ProgramAssignment
        return ProgramAssignment.objects.filter(team=self).exists()
    
    def get_assignment_count(self):
        """Get the number of program assignments for this team"""
        from .models import ProgramAssignment
        return ProgramAssignment.objects.filter(team=self).count()
    
    def get_related_data_summary(self):
        """Get a summary of all related data for this team"""
        from .models import ProgramAssignment, ProgramResult, ChestNumber, PointsRecord
        
        return {
            'assignments': ProgramAssignment.objects.filter(team=self).count(),
            'results': ProgramResult.objects.filter(team=self).count(),
            'chest_numbers': ChestNumber.objects.filter(team=self).count(),
            'points_records': PointsRecord.objects.filter(team=self).count(),
        }

class IndividualParticipation(models.Model):
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='individual_participants')
    participant = models.ForeignKey(User, on_delete=models.CASCADE, related_name='individual_participations')
    
    # Performance
    points_earned = models.PositiveIntegerField(default=0)
    position = models.PositiveIntegerField(null=True, blank=True)
    
    registered_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['event', 'participant']
        ordering = ['-points_earned']
        
    def __str__(self):
        return f"{self.participant.get_full_name()} - {self.event.title}"

class EventAnnouncement(models.Model):
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='announcements')
    title = models.CharField(max_length=200)
    message = models.TextField()
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    is_important = models.BooleanField(default=False)
    
    class Meta:
        ordering = ['-created_at']
        
    def __str__(self):
        return f"{self.title} - {self.event.title}"

class PointsRecord(models.Model):
    """Track points awarded to teams or individuals"""
    POINT_TYPES = [
        ('event_winner', 'Event Winner'),
        ('event_runner_up', 'Event Runner Up'),
        ('event_participation', 'Event Participation'),
        ('manual_bonus', 'Manual Bonus'),
        ('manual_penalty', 'Manual Penalty'),
        ('achievement', 'Special Achievement'),
    ]
    
    # Either team or student gets points
    team = models.ForeignKey('Team', on_delete=models.CASCADE, null=True, blank=True, related_name='points_records')
    student = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True, related_name='points_records')
    
    event = models.ForeignKey('Event', on_delete=models.CASCADE, null=True, blank=True, related_name='points_records')
    
    points = models.IntegerField()  # Can be negative for penalties
    point_type = models.CharField(max_length=20, choices=POINT_TYPES)
    reason = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    
    # Admin tracking
    awarded_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='awarded_points')
    awarded_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-awarded_at']
    
    def __str__(self):
        recipient = self.team.name if self.team else self.student.display_name
        return f"{recipient}: {self.points} pts ({self.reason})"
    
    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Update total points when record is saved
        self.update_total_points()
    
    def update_total_points(self):
        """Update total points for team or student"""
        if self.team:
            total = PointsRecord.objects.filter(team=self.team).aggregate(
                total=models.Sum('points')
            )['total'] or 0
            self.team.points_earned = total
            self.team.save()
        elif self.student:
            total = PointsRecord.objects.filter(student=self.student).aggregate(
                total=models.Sum('points')
            )['total'] or 0
            self.student.total_points = total
            self.student.save()

class TeamProfile(models.Model):
    """Extended team profile with additional details"""
    team = models.OneToOneField('Team', on_delete=models.CASCADE, related_name='profile')
    
    # Team details
    motto = models.CharField(max_length=200, blank=True)
    color_code = models.CharField(max_length=7, default='#3B82F6')  # Hex color
    logo_url = models.URLField(blank=True)
    
    # Performance tracking
    events_participated = models.PositiveIntegerField(default=0)
    events_won = models.PositiveIntegerField(default=0)
    current_rank = models.PositiveIntegerField(null=True, blank=True)
    
    # Administrative
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.team.name} Profile"
    
    @property
    def win_rate(self):
        if self.events_participated == 0:
            return 0
        return (self.events_won / self.events_participated) * 100

class Program(models.Model):
    CATEGORY_CHOICES = [
        ('hs', 'High School'),
        ('hss', 'Higher Secondary School'),
        ('general', 'General'),
    ]

    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='programs')
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=10, choices=CATEGORY_CHOICES, default='general')
    
    # Program settings
    is_team_based = models.BooleanField(default=False)
    max_participants = models.PositiveIntegerField(null=True, blank=True)  # Overall limit (for individual programs)
    max_participants_per_team = models.PositiveIntegerField(null=True, blank=True)  # Per-team limit (for team-based programs)
    team_size = models.PositiveIntegerField(null=True, blank=True)  # Fixed team size for team-based programs
    
    # Scheduling
    venue = models.CharField(max_length=200, blank=True)
    start_time = models.DateTimeField(null=True, blank=True)
    end_time = models.DateTimeField(null=True, blank=True)
    
    # Status
    is_active = models.BooleanField(default=True)
    is_finished = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    PROGRAM_TYPE_CHOICES = [
        ('stage', 'Stage'),
        ('off_stage', 'Off Stage'),
    ]
    program_type = models.CharField(max_length=20, choices=PROGRAM_TYPE_CHOICES, default='stage')

    class Meta:
        ordering = ['start_time', 'name']
        unique_together = ['event', 'name']
    
    def __str__(self):
        return f"{self.name} - {self.event.title}"
    
    @property
    def status(self):
        """Get program status based on timing and is_finished flag"""
        from django.utils import timezone
        now = timezone.now()
        
        if self.is_finished:
            return 'finished'
        elif not self.start_time:
            return 'scheduled'
        elif now < self.start_time:
            return 'upcoming'
        elif self.end_time and now > self.end_time:
            return 'finished'
        elif now >= self.start_time:
            return 'ongoing'
        else:
            return 'scheduled'
    
    @property
    def duration_minutes(self):
        """Calculate duration in minutes if both start and end times are set"""
        if self.start_time and self.end_time:
            delta = self.end_time - self.start_time
            return int(delta.total_seconds() / 60)
        return None

    def clean(self):
        if self.start_time and self.end_time and self.start_time >= self.end_time:
            raise ValidationError("End time must be after start time")
        
        # HS and HSS programs must always be individual (not team-based)
        if self.category in ['hs', 'hss'] and self.is_team_based:
            raise ValidationError("High School and Higher Secondary School programs must be individual (not team-based)")
        
        # Team-based programs must have a team_size
        if self.is_team_based and not self.team_size:
            raise ValidationError("Team-based programs must have a team size specified")
    
    def save(self, *args, **kwargs):
        # Auto-enforce that HS and HSS programs are individual
        if self.category in ['hs', 'hss']:
            self.is_team_based = False
            self.team_size = None
        
        # Clear team_size for individual programs
        if not self.is_team_based:
            self.team_size = None
        
        super().save(*args, **kwargs)
    
    def delete(self, *args, **kwargs):
        """Override delete method to automatically clean up all related data"""
        # Delete all program assignments for this program
        self.assignments.all().delete()
        
        # Delete all program results for this program
        self.results.all().delete()
        
        # Call the parent delete method
        super().delete(*args, **kwargs)

class ProgramAssignment(models.Model):
    program = models.ForeignKey(Program, on_delete=models.CASCADE, related_name='assignments')
    student = models.ForeignKey('accounts.User', on_delete=models.CASCADE, related_name='program_assignments')
    team = models.ForeignKey(Team, on_delete=models.CASCADE, null=True, blank=True, related_name='program_assignments')
    assigned_at = models.DateTimeField(auto_now_add=True)
    assigned_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, related_name='assigned_programs')
    chest_number = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        unique_together = ['program', 'student']

    def __str__(self):
        return f"{self.student.display_name} - {self.program.name}"

    def save(self, *args, **kwargs):
        # Auto-sync team assignment from global team membership if not set
        if not self.team and self.student.team_memberships.exists():
            self.team = self.student.team_memberships.first()
        
        # Check if team assignment has changed (for existing assignments)
        if self.pk:  # This is an existing assignment
            try:
                old_assignment = ProgramAssignment.objects.get(pk=self.pk)
                team_changed = old_assignment.team != self.team
            except ProgramAssignment.DoesNotExist:
                team_changed = False
        else:
            team_changed = False
        
        # Check if student already has a chest number for this event
        existing_chest_number = None
        try:
            existing_chest = ChestNumber.objects.get(
                event=self.program.event,
                student=self.student
            )
            existing_chest_number = existing_chest.chest_number
        except ChestNumber.DoesNotExist:
            pass
        
        # If student already has a chest number for this event, use it
        if existing_chest_number:
            self.chest_number = existing_chest_number
        # Auto-generate chest number if not provided OR if team has changed
        elif not self.chest_number or team_changed:
            # If team has changed, clear any existing chest number for this student in this event
            if team_changed:
                # Remove chest number from other assignments for this student in this event
                ProgramAssignment.objects.filter(
                    program__event=self.program.event,
                    student=self.student
                ).exclude(id=self.pk).update(chest_number=None)
                
                # Also remove from ChestNumber records
                ChestNumber.objects.filter(
                    event=self.program.event,
                    student=self.student
                ).delete()
            
            # Auto-generate chest number if not provided
            if not self.chest_number:
                if self.team:
                    # For team-based programs, use team-based numbering
                    team_base = self.team.team_number * 100  # Team 1: 100-199, Team 2: 200-299, etc.
                    
                    # Find the next available chest number in this team's range for this event
                    # Check both ProgramAssignment and ChestNumber models
                    max_chest_assignment = ProgramAssignment.objects.filter(
                        program__event=self.program.event,
                        team=self.team,
                        chest_number__gte=team_base,
                        chest_number__lt=team_base + 100
                    ).aggregate(max_chest=models.Max('chest_number'))['max_chest']
                    
                    max_chest_chest = ChestNumber.objects.filter(
                        event=self.program.event,
                        team=self.team,
                        chest_number__gte=team_base,
                        chest_number__lt=team_base + 100
                    ).aggregate(max_chest=models.Max('chest_number'))['max_chest']
                    
                    max_chest = max(max_chest_assignment or 0, max_chest_chest or 0)
                    
                    if max_chest >= team_base:
                        self.chest_number = max_chest + 1
                    else:
                        self.chest_number = team_base  # Start from team_base (e.g., 100, 200, 300)
                else:
                    # For general category (open) programs without teams, use dynamic starting number
                    # based on total number of teams in the event
                    total_teams = Team.objects.count()
                    
                    # Calculate starting number for general category
                    # 2 teams = start from 300, 3 teams = start from 400, etc.
                    general_start = (total_teams + 1) * 100
                    
                    # Find the next available chest number in general range for this event
                    max_chest_assignment = ProgramAssignment.objects.filter(
                        program__event=self.program.event,
                        team__isnull=True,
                        chest_number__gte=general_start
                    ).aggregate(max_chest=models.Max('chest_number'))['max_chest']
                    
                    max_chest_chest = ChestNumber.objects.filter(
                        event=self.program.event,
                        team__isnull=True,
                        chest_number__gte=general_start
                    ).aggregate(max_chest=models.Max('chest_number'))['max_chest']
                    
                    max_chest = max(max_chest_assignment or 0, max_chest_chest or 0)
                    
                    if max_chest >= general_start:
                        self.chest_number = max_chest + 1
                    else:
                        self.chest_number = general_start  # Start from calculated general start
        
        # Generate chest code for the student if not already generated
        if not self.student.chest_code:
            self.student.generate_chest_code()
        
        super().save(*args, **kwargs)
        
        # Also create or update ChestNumber record for backward compatibility
        ChestNumber.objects.update_or_create(
            event=self.program.event,
            student=self.student,
            defaults={
                'team': self.team,
                'chest_number': self.chest_number,
                'assigned_by': self.assigned_by
            }
        )

class ProgramResult(models.Model):
    program = models.ForeignKey(Program, on_delete=models.CASCADE, related_name='results')
    # assignment = models.ForeignKey(ProgramAssignment, on_delete=models.CASCADE, related_name='results')  # Temporarily commented out
    participant = models.ForeignKey(User, on_delete=models.CASCADE, related_name='program_results', db_column='participant_id')
    team = models.ForeignKey(Team, on_delete=models.CASCADE, null=True, blank=True)
    
    # Result numbering - sequential number based on when marks were entered
    result_number = models.IntegerField(null=True, blank=True, help_text="Sequential result number (Result No. 1, 2, 3, etc.)")
    
    # Legacy marks field (still exists in database)
    marks = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    
    # Judge marks (out of 100)
    judge1_marks = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    judge2_marks = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    judge3_marks = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    
    # Calculated fields
    total_marks = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    average_marks = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    position = models.IntegerField(null=True, blank=True)  # 1st, 2nd, 3rd, etc.
    points_earned = models.IntegerField(default=0)  # Use original field name
    
    # Additional fields - use existing database column names
    comments = models.TextField(blank=True)  # Keep original field name
    entered_at = models.DateTimeField(auto_now_add=True)  # Keep original field name
    updated_at = models.DateTimeField(auto_now=True)
    
    # Legacy field that still exists in database
    entered_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='entered_results', db_column='entered_by_id')
    
    class Meta:
        unique_together = ['program', 'participant']  # Use original field name
        ordering = ['-average_marks', '-total_marks']
    
    def save(self, *args, **kwargs):
        from decimal import Decimal, InvalidOperation
        
        # Auto-sync team assignment from global team membership if not set
        if not self.team and self.participant.team_memberships.exists():
            self.team = self.participant.team_memberships.first()
        
        # Assign result number if this is the first time marks are being entered
        if not self.result_number and self.has_marks():
            self.assign_result_number()
        
        # Calculate total and average marks with proper type conversion
        marks = []
        if self.judge1_marks is not None:
            try:
                marks.append(Decimal(str(self.judge1_marks)))
            except (InvalidOperation, TypeError):
                pass
        if self.judge2_marks is not None:
            try:
                marks.append(Decimal(str(self.judge2_marks)))
            except (InvalidOperation, TypeError):
                pass
        if self.judge3_marks is not None:
            try:
                marks.append(Decimal(str(self.judge3_marks)))
            except (InvalidOperation, TypeError):
                pass
        
        if marks:
            self.total_marks = sum(marks)
            self.average_marks = self.total_marks / len(marks)
        else:
            self.total_marks = None
            self.average_marks = None
        
        super().save(*args, **kwargs)
        
        # Update positions and points for all results in this program
        self.update_program_rankings()
        
        # Distribute points to team and individual members
        self.distribute_points_to_team_and_members()
    
    def has_marks(self):
        """Check if this result has any marks entered"""
        return (self.judge1_marks is not None and self.judge1_marks > 0) or \
               (self.judge2_marks is not None and self.judge2_marks > 0) or \
               (self.judge3_marks is not None and self.judge3_marks > 0)
    
    def assign_result_number(self):
        """Assign result number to the program when it gets its first result"""
        # Check if this program already has a result number assigned
        existing_result = ProgramResult.objects.filter(
            program=self.program,
            result_number__isnull=False
        ).first()
        
        if existing_result:
            # Program already has a result number, use the same one
            self.result_number = existing_result.result_number
        else:
            # This is the first result for this program, assign a new result number
            # Get the highest result number across all programs in this event
            max_result_number = ProgramResult.objects.filter(
                program__event=self.program.event,
                result_number__isnull=False
            ).aggregate(
                max_number=models.Max('result_number')
            )['max_number'] or 0
            
            self.result_number = max_result_number + 1
    
    def distribute_points_to_team_and_members(self):
        """Distribute points earned to team and individual student"""
        if self.points_earned > 0:
            from django.db import transaction
            
            with transaction.atomic():
                # Create or update PointsRecord for the team
                point_type = 'event_winner' if self.position == 1 else 'event_runner_up' if self.position == 2 else 'event_participation'
                position_text = 'Winner' if self.position == 1 else 'Runner-up' if self.position == 2 else f'{self.position}rd place' if self.position == 3 else f'{self.position}th place'
                
                # Award points to team if it exists
                if self.team:
                    PointsRecord.objects.update_or_create(
                        team=self.team,
                        event=self.program.event,
                        point_type=point_type,
                        reason=f'{self.program.name} - {position_text}',
                        defaults={
                            'points': self.points_earned,
                            'description': f'Points earned by {self.participant.get_full_name()} in {self.program.name}',
                            'awarded_by': self.program.event.created_by or self.entered_by
                        }
                    )
                
                # Award points to individual student as well
                PointsRecord.objects.update_or_create(
                    student=self.participant,
                    event=self.program.event,
                    point_type=point_type,
                    reason=f'{self.program.name} - {position_text}',
                    defaults={
                        'points': self.points_earned,
                        'description': f'Individual points for {position_text} in {self.program.name}',
                        'awarded_by': self.program.event.created_by or self.entered_by
                    }
                )
    
    def update_program_rankings(self):
        """Update positions and points for all results in this program"""
        from django.db import transaction
        
        with transaction.atomic():
            # Get all results for this program, ordered by average marks
            results = ProgramResult.objects.filter(
                program=self.program
            ).exclude(
                average_marks__isnull=True
            ).order_by('-average_marks', '-total_marks', 'participant__first_name')
            
            # Update positions and points
            for index, result in enumerate(results, 1):
                position = index
                
                # Assign points based on position, program category, and team-based status
                if self.program.category in ['hs', 'hss']:
                    # HS and HSS programs are always individual: 5, 3, 1 points
                    if position == 1:
                        points = 5
                    elif position == 2:
                        points = 3
                    elif position == 3:
                        points = 1
                    else:
                        points = 0
                elif self.program.category == 'general':
                    # General category programs: 10, 6, 3 points (both individual and team-based)
                    if position == 1:
                        points = 10
                    elif position == 2:
                        points = 6
                    elif position == 3:
                        points = 3
                    else:
                        points = 0
                else:
                    # Fallback for any other category
                    if position == 1:
                        points = 5
                    elif position == 2:
                        points = 3
                    elif position == 3:
                        points = 1
                    else:
                        points = 0
                
                # Update without triggering save recursion
                ProgramResult.objects.filter(id=result.id).update(
                    position=position,
                    points_earned=points
                )
                
                # Distribute points for this result
                if result.id != self.id:  # Don't distribute for self to avoid recursion
                    updated_result = ProgramResult.objects.get(id=result.id)
                    updated_result.distribute_points_to_team_and_members()
    
    def __str__(self):
        return f"{self.participant.get_full_name()} - {self.program.name} - Position: {self.position or 'Unranked'}"

class ChestNumber(models.Model):
    """Track chest numbers for students participating in events"""
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='chest_numbers')
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='chest_numbers')
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name='chest_numbers', null=True, blank=True)
    chest_number = models.PositiveIntegerField()
    
    # Metadata
    assigned_at = models.DateTimeField(auto_now_add=True)
    assigned_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='assigned_chest_numbers')
    
    class Meta:
        unique_together = [
            ['event', 'student'],  # One chest number per student per event
            ['event', 'chest_number'],  # Unique chest numbers per event
        ]
        ordering = ['chest_number']
    
    def __str__(self):
        return f"Chest #{self.chest_number} - {self.student.display_name} ({self.event.name})"
    
    def save(self, *args, **kwargs):
        # Auto-generate chest number if not provided
        if not self.chest_number:
            if self.team and self.team.team_number:
                # Get team-based chest number range using team_number
                # Team 1: 100-199, Team 2: 200-299, Team 3: 300-399, etc.
                team_base = self.team.team_number * 100
                
                # Find the next available chest number in this team's range
                max_chest = ChestNumber.objects.filter(
                    event=self.event,
                    team=self.team,
                    chest_number__gte=team_base,
                    chest_number__lt=team_base + 100
                ).aggregate(max_chest=models.Max('chest_number'))['max_chest']
                
                if max_chest:
                    self.chest_number = max_chest + 1
                else:
                    self.chest_number = team_base  # Start from team_base (e.g., 100, 200, 300)
            else:
                # For individual assignments without teams, use general range starting from 1
                # This avoids conflicts with team-based chest numbers (100+)
                max_chest = ChestNumber.objects.filter(
                    event=self.event,
                    team__isnull=True,
                    chest_number__lt=100  # Keep individual assignments below 100
                ).aggregate(max_chest=models.Max('chest_number'))['max_chest']
                
                self.chest_number = max(1, (max_chest or 0) + 1)
        
        super().save(*args, **kwargs)

class TeamManager(models.Model):
    """Model to track team manager relationships"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='team_manager_profile')
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name='team_managers')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['user', 'team']
        
    def __str__(self):
        return f"{self.user.get_full_name()} - {self.team.name} Team Manager"

# Django signals for automatic cleanup
from django.db.models.signals import pre_delete, post_delete
from django.dispatch import receiver

@receiver(pre_delete, sender=Team)
def cleanup_team_data(sender, instance, **kwargs):
    """Clean up all related data when a team is deleted"""
    # Delete all program assignments for this team
    from .models import ProgramAssignment
    ProgramAssignment.objects.filter(team=instance).delete()
    
    # Delete all program results for this team
    from .models import ProgramResult
    ProgramResult.objects.filter(team=instance).delete()
    
    # Delete all chest numbers for this team
    from .models import ChestNumber
    ChestNumber.objects.filter(team=instance).delete()
    
    # Delete all points records for this team
    from .models import PointsRecord
    PointsRecord.objects.filter(team=instance).delete()

@receiver(post_delete, sender=Team)
def cleanup_orphaned_assignments(sender, instance, **kwargs):
    """Clean up any orphaned program assignments after team deletion"""
    from .models import ProgramAssignment
    # Find assignments that reference non-existent teams
    orphaned_assignments = ProgramAssignment.objects.filter(
        team__isnull=False
    ).exclude(
        team__in=Team.objects.all()
    )
    
    if orphaned_assignments.exists():
        orphaned_assignments.delete()
