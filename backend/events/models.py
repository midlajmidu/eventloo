from django.db import models, transaction
from django.contrib.auth import get_user_model
from django.core.validators import MinValueValidator, MaxValueValidator
import secrets
import string
from django.utils import timezone
from django.core.exceptions import ValidationError
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from pathlib import Path
from uuid import uuid4

from .certificate_config import (
    CERTIFICATE_TYPE_CHOICES,
    default_certificate_fields,
    normalize_certificate_fields,
)

User = get_user_model()

class Event(models.Model):
    school = models.ForeignKey(
        'accounts.School', on_delete=models.CASCADE, related_name='events'
    )
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
    
    # Judging and Marking Configuration
    num_judges = models.PositiveIntegerField(
        default=3,
        validators=[MinValueValidator(1), MaxValueValidator(4)],
        help_text="Number of judges evaluating each program (1 to 4)"
    )
    max_mark_per_judge = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=100.00,
        validators=[MinValueValidator(1)],
        help_text="Maximum mark each judge can assign (e.g. 100 or 50)"
    )
    converted_total_mark = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=100.00,
        validators=[MinValueValidator(1)],
        help_text="Target converted mark scale (e.g. convert total score to out of 100)"
    )

    # Student Participation Limits (per event)
    max_programs_per_student = models.PositiveIntegerField(
        default=4,
        validators=[MinValueValidator(0)],
        help_text="Maximum total programs a single student can participate in"
    )
    max_single_programs_per_student = models.PositiveIntegerField(
        default=3,
        validators=[MinValueValidator(0)],
        help_text="Maximum individual/single programs a single student can participate in"
    )
    max_group_programs_per_student = models.PositiveIntegerField(
        default=2,
        validators=[MinValueValidator(0)],
        help_text="Maximum group/team programs a single student can participate in"
    )

    # Grading system. Event rules define score-percentage bands only; the
    # absolute points for each grade are configured on each Program.
    enable_grading_system = models.BooleanField(default=True)
    grading_rules = models.JSONField(
        default=list,
        blank=True,
        help_text="Grade percentage bands e.g. [{name:'A+', min_mark:90, max_mark:100}]"
    )

    # Event-Specific Points Configuration
    std_ind_first = models.PositiveIntegerField(default=5, help_text="1st place points for Standard Category Individual")
    std_ind_second = models.PositiveIntegerField(default=3, help_text="2nd place points for Standard Category Individual")
    std_ind_third = models.PositiveIntegerField(default=1, help_text="3rd place points for Standard Category Individual")

    std_group_first = models.PositiveIntegerField(default=10, help_text="1st place points for Standard Category Group")
    std_group_second = models.PositiveIntegerField(default=6, help_text="2nd place points for Standard Category Group")
    std_group_third = models.PositiveIntegerField(default=3, help_text="3rd place points for Standard Category Group")

    mix_ind_first = models.PositiveIntegerField(default=10, help_text="1st place points for Mixed/General Category Individual")
    mix_ind_second = models.PositiveIntegerField(default=6, help_text="2nd place points for Mixed/General Category Individual")
    mix_ind_third = models.PositiveIntegerField(default=3, help_text="3rd place points for Mixed/General Category Individual")

    mix_group_first = models.PositiveIntegerField(default=10, help_text="1st place points for Mixed/General Category Group")
    mix_group_second = models.PositiveIntegerField(default=6, help_text="2nd place points for Mixed/General Category Group")
    mix_group_third = models.PositiveIntegerField(default=3, help_text="3rd place points for Mixed/General Category Group")
    count_general_individual_points_for_students = models.BooleanField(
        default=False,
        help_text=(
            "When enabled, Mixed/General individual program points contribute to "
            "the participant's personal and top-scorer totals. Team points are always retained."
        ),
    )

    def get_effective_grading_rules(self):
        if self.grading_rules and isinstance(self.grading_rules, list) and len(self.grading_rules) > 0:
            return self.grading_rules
        return [
            {"name": "A+", "min_mark": 90, "max_mark": 100},
            {"name": "A",  "min_mark": 80, "max_mark": 89.99},
            {"name": "B+", "min_mark": 70, "max_mark": 79.99},
            {"name": "B",  "min_mark": 60, "max_mark": 69.99},
        ]

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

    def save(self, *args, **kwargs):
        if not self.school_id and self.created_by_id:
            self.school_id = self.created_by.school_id
        self.full_clean()
        super().save(*args, **kwargs)
    
    @property
    def current_participants(self):
        """Get current number of participants for this event"""
        try:
            assigned_ids = set(self.programs.filter(
                assignments__student__isnull=False
            ).values_list('assignments__student_id', flat=True))
            registered_ids = set(self.individual_participants.values_list('participant_id', flat=True))
            return len(assigned_ids | registered_ids)
        except Exception:
            return 0
    
    @property
    def current_teams(self):
        """Get current number of teams for this event"""
        try:
            return self.programs.filter(
                assignments__team__isnull=False
            ).values('assignments__team').distinct().count()
        except Exception:
            return 0
    
    @property
    def is_registration_open(self):
        """Check if registration is open for this event"""
        try:
            if not self.registration_deadline:
                return self.status in ['published']
            return (
                self.status in ['published'] and 
                timezone.now() < self.registration_deadline
            )
        except Exception:
            return False

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
    school = models.ForeignKey(
        'accounts.School', on_delete=models.CASCADE, related_name='teams'
    )
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    members = models.ManyToManyField(User, related_name='team_memberships', blank=True)
    team_manager = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='managed_teams', limit_choices_to={'role': 'team_manager'})
    
    # Team performance
    points_earned = models.PositiveIntegerField(default=0)
    position = models.PositiveIntegerField(null=True, blank=True)  # Final ranking
    
    # Team number (auto-assigned sequential number)
    team_number = models.PositiveIntegerField(null=True, blank=True)
    
    # Team Manager Login Credentials (Auto-generated)
    team_username = models.CharField(max_length=100, blank=True)
    team_password = models.CharField(max_length=128, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['name']
        constraints = [
            models.UniqueConstraint(fields=['school', 'name'], name='unique_school_team_name'),
            models.UniqueConstraint(fields=['school', 'team_number'], name='unique_school_team_number'),
            models.UniqueConstraint(fields=['school', 'team_username'], name='unique_school_team_username'),
        ]
        
    def __str__(self):
        return self.name

    def clean(self):
        super().clean()
        if self.team_manager_id:
            if self.team_manager.role != 'team_manager':
                raise ValidationError('The selected user is not a team manager.')
            if self.team_manager.school_id != self.school_id:
                raise ValidationError('The team manager must belong to the same school.')
    
    def save(self, *args, **kwargs):
        is_new = self.pk is None

        if not self.school_id and self.team_manager_id:
            self.school_id = self.team_manager.school_id

        if self.team_password and not self.team_password.startswith(('pbkdf2_sha256$', 'bcrypt$', 'argon2$')):
            from django.contrib.auth.hashers import make_password
            self._plain_team_password = self.team_password
            self.team_password = make_password(self.team_password)

        if is_new and self.school_id:
            # Serialize number/username allocation per school so concurrent team
            # creation cannot produce duplicates from the same MAX()+1 value.
            with transaction.atomic():
                School = self._meta.get_field('school').remote_field.model
                School.objects.select_for_update().only('pk').get(pk=self.school_id)
                if not self.team_number:
                    self.team_number = self.get_next_team_number()
                if not self.team_username or not self.team_password:
                    self.generate_team_credentials(username=self.team_username, password=getattr(self, '_plain_team_password', None))
                self.full_clean()
                return super().save(*args, **kwargs)

        if not self.team_username or not self.team_password:
            self.generate_team_credentials(username=self.team_username, password=getattr(self, '_plain_team_password', None))
        self.full_clean()
        return super().save(*args, **kwargs)

    @classmethod
    def reset_team_numbering(cls, school=None):
        """Reset team numbering to be sequential (1, 2, 3, etc.) based on creation order"""
        if school is None:
            return
        if ChestNumber.objects.filter(event__school=school).exists():
            raise ValidationError(
                'Team numbering cannot be reset after event chest numbers have been issued.'
            )
        with transaction.atomic():
            teams = list(cls.objects.select_for_update().filter(
                school=school
            ).order_by('created_at', 'id'))
            temporary_base = max(
                [team.team_number or 0 for team in teams] + [0]
            ) + len(teams) + 1
            for offset, team in enumerate(teams):
                cls.objects.filter(pk=team.pk).update(team_number=temporary_base + offset)
            for index, team in enumerate(teams, start=1):
                cls.objects.filter(pk=team.pk).update(team_number=index)
    
    def get_next_team_number(self):
        """Get the next available team number, restarting from 1 if no teams exist"""
        max_number = Team.objects.filter(school_id=self.school_id).aggregate(
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
        teams = Team.objects.filter(
            school_id=self.school_id, created_at__lte=self.created_at
        ).order_by('created_at')
        for index, team in enumerate(teams, start=1):
            if team.id == self.id:
                return index
        return None
    
    def generate_team_credentials(self, username=None, password=None):
        """Generate or use provided team manager credentials"""
        if username and str(username).strip():
            team_username = str(username).strip()
        elif not self.team_username:
            # Generate team username for internal tracking
            base_username = self.name.lower().replace(' ', '_').replace('-', '_')
            team_username = f"{base_username}_team"
            
            # Ensure team_username uniqueness
            counter = 1
            original_team_username = team_username
            while Team.objects.filter(
                school_id=self.school_id, team_username=team_username
            ).exclude(id=self.id).exists():
                team_username = f"{original_team_username}_{counter}"
                counter += 1
        else:
            team_username = self.team_username
        
        # Use provided or generate secure password
        chosen_password = str(password).strip() if (password and str(password).strip()) else secrets.token_urlsafe(18)
        
        # Store credentials in team model (don't call save() here to avoid infinite loop)
        self.team_username = team_username
        from django.contrib.auth.hashers import make_password
        self.team_password = make_password(chosen_password)
        self._plain_team_password = chosen_password
        
        return team_username, chosen_password

    def set_team_credentials(self, username=None, password=None):
        """Set explicit custom team leader username and/or password"""
        from django.contrib.auth.hashers import make_password
        if username and str(username).strip():
            self.team_username = str(username).strip()
        if password and str(password).strip():
            self.team_password = make_password(str(password).strip())
            self._plain_team_password = str(password).strip()
    
    @property
    def team_credentials(self):
        """Get existing team credentials if available"""
        if self.team_username and self.team_password:
            return {
                'username': self.team_username,
                'password': None
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

    def clean(self):
        super().clean()
        if self.event_id and self.participant_id:
            if self.participant.role != 'student':
                raise ValidationError('Only students can participate in an event.')
            if self.participant.school_id != self.event.school_id:
                raise ValidationError('The participant and event must belong to the same school.')

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

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

    def clean(self):
        super().clean()
        if self.event_id and self.created_by_id:
            if self.created_by.school_id != self.event.school_id:
                raise ValidationError('The announcement author and event must belong to the same school.')
            if self.created_by.role not in ('admin', 'event_manager'):
                raise ValidationError('Only school staff can author event announcements.')

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

class PointsRecord(models.Model):
    """Track points awarded to teams or individuals"""
    school = models.ForeignKey(
        'accounts.School', on_delete=models.CASCADE, related_name='points_records'
    )
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
    source_result = models.ForeignKey(
        'ProgramResult',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='generated_point_records',
    )
    is_automatic = models.BooleanField(default=False)
    
    points = models.IntegerField()  # Can be negative for penalties
    point_type = models.CharField(max_length=20, choices=POINT_TYPES)
    reason = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    
    # Admin tracking
    awarded_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='awarded_points')
    awarded_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-awarded_at']
        constraints = [
            models.UniqueConstraint(
                fields=['source_result', 'team'],
                condition=models.Q(is_automatic=True, team__isnull=False),
                name='unique_automatic_result_team_points',
            ),
            models.UniqueConstraint(
                fields=['source_result', 'student'],
                condition=models.Q(is_automatic=True, student__isnull=False),
                name='unique_automatic_result_student_points',
            ),
        ]
    
    def __str__(self):
        recipient = self.team.name if self.team else self.student.display_name
        return f"{recipient}: {self.points} pts ({self.reason})"
    
    def save(self, *args, **kwargs):
        if not self.school_id:
            if self.event_id:
                self.school_id = self.event.school_id
            elif self.team_id:
                self.school_id = self.team.school_id
            elif self.student_id:
                self.school_id = self.student.school_id
        self.full_clean()
        super().save(*args, **kwargs)
        # Update total points when record is saved
        self.update_total_points()

    def clean(self):
        super().clean()
        school_ids = {
            value for value in (
                self.school_id,
                self.event.school_id if self.event_id else None,
                self.team.school_id if self.team_id else None,
                self.student.school_id if self.student_id else None,
                self.source_result.program.event.school_id if self.source_result_id else None,
                self.awarded_by.school_id if self.awarded_by_id else None,
            ) if value is not None
        }
        if len(school_ids) > 1:
            raise ValidationError('Points records cannot reference objects from different schools.')
    
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

class EventStage(models.Model):
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='stages')
    number = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    name = models.CharField(max_length=200, blank=True)
    capacity = models.PositiveIntegerField(
        null=True, blank=True, validators=[MinValueValidator(1)]
    )
    map_link = models.URLField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['number', 'name']
        constraints = [
            models.UniqueConstraint(
                fields=['event', 'number'], name='unique_stage_number_per_event'
            ),
        ]

    @property
    def display_name(self):
        return self.name.strip() if self.name else f'Stage {self.number}'

    def __str__(self):
        return f'{self.event.title} - {self.display_name}'


class Program(models.Model):
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='programs')
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=20, default='general')
    
    # Program settings
    is_team_based = models.BooleanField(default=False)
    num_judges = models.PositiveIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(4)],
        help_text="Number of judges evaluating this program (1 to 4). If null, defaults to event.num_judges.",
    )
    max_participants = models.PositiveIntegerField(null=True, blank=True)  # Overall limit (for individual programs)
    max_participants_per_team = models.PositiveIntegerField(null=True, blank=True)  # Per-team limit (for team-based programs)
    team_size = models.PositiveIntegerField(null=True, blank=True)  # Fixed team size for team-based programs
    max_teams_per_school = models.PositiveIntegerField(default=1, null=True, blank=True)  # Number of sub-teams per school/team
    grading_points = models.JSONField(
        default=dict,
        blank=True,
        help_text=(
            "Optional absolute points by event grade name, for example "
            "{'A+': 10, 'A': 8}. Missing grades use placement points."
        ),
    )
    
    # Program-specific placement points override
    has_custom_points = models.BooleanField(
        default=False,
        help_text="Override event placement points for this specific program",
    )
    first_place_points = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Custom 1st place points for this program",
    )
    second_place_points = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Custom 2nd place points for this program",
    )
    third_place_points = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Custom 3rd place points for this program",
    )
    participation_points = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Custom participation points for positions after 3rd place for this program",
    )
    
    # Scheduling
    stage = models.ForeignKey(
        EventStage, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='programs',
    )
    venue = models.CharField(max_length=200, blank=True)
    start_time = models.DateTimeField(null=True, blank=True)
    end_time = models.DateTimeField(null=True, blank=True)
    duration_minutes_per_entry = models.PositiveIntegerField(
        default=5,
        validators=[MinValueValidator(1)],
        help_text='Minutes required for one participant or one group.',
    )
    schedule_end_is_manual = models.BooleanField(
        default=False,
        help_text='Preserve an administrator-confirmed ending time when assignments change.',
    )
    
    # Status
    is_active = models.BooleanField(default=True)
    is_finished = models.BooleanField(default=False)
    is_published = models.BooleanField(default=False)
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

    @property
    def schedule_entry_count(self):
        """Number of independently scheduled entries in this program."""
        assignments = self.assignments.all()
        if self.is_team_based:
            count = assignments.values('team_id', 'sub_team_number').distinct().count()
        else:
            count = assignments.values('student_id').distinct().count()
        if count > 0:
            return count
        if not self.is_team_based and self.max_participants:
            return self.max_participants
        if self.is_team_based and self.max_teams_per_school:
            return self.max_teams_per_school
        return 0

    @property
    def scheduled_duration_minutes(self):
        """Total run time based on current entries (one slot before assignment)."""
        return max(1, self.schedule_entry_count) * self.duration_minutes_per_entry

    @property
    def effective_num_judges(self):
        """Effective number of judges evaluating this program (falls back to event.num_judges or 3)."""
        if self.num_judges:
            return self.num_judges
        if self.event_id and getattr(self.event, 'num_judges', None):
            return self.event.num_judges
        return 3

    def refresh_schedule_end(self):
        """Keep the stored end time aligned when assignments change."""
        if not self.start_time or self.schedule_end_is_manual:
            return None
        from datetime import timedelta
        calculated = self.start_time + timedelta(minutes=self.scheduled_duration_minutes)
        Program.objects.filter(pk=self.pk).update(end_time=calculated)
        self.end_time = calculated
        return calculated

    def clean(self):
        if self.start_time and self.end_time and self.start_time >= self.end_time:
            raise ValidationError("End time must be after start time")
        
        # Team-based programs must have a team_size
        if self.is_team_based and not self.team_size:
            raise ValidationError("Team-based programs must have a team size specified")

        if self.stage_id and self.event_id and self.stage.event_id != self.event_id:
            raise ValidationError({'stage': 'The selected stage belongs to a different event.'})
    
    def save(self, *args, **kwargs):
        # Clear team_size for individual programs
        if not self.is_team_based:
            self.team_size = None
        if self.stage_id:
            self.venue = self.stage.display_name
        self.full_clean()
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
    assigned_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_programs',
    )
    chest_number = models.PositiveIntegerField(null=True, blank=True)
    sub_team_number = models.PositiveIntegerField(default=1, null=True, blank=True)
    is_leader = models.BooleanField(default=False, help_text="Designates if student is group leader for their sub-team")

    class Meta:
        unique_together = ['program', 'student']
        constraints = [
            models.UniqueConstraint(
                fields=['program', 'team', 'sub_team_number'],
                condition=models.Q(is_leader=True),
                name='unique_group_subteam_leader',
            ),
        ]

    def __str__(self):
        return f"{self.student.display_name} - {self.program.name}"

    def save(self, *args, **kwargs):
        # Auto-sync team assignment from global team membership if not set
        if not self.team and self.student.team_memberships.exists():
            self.team = self.student.team_memberships.first()

        # The ChestNumber row is the authoritative event-level identity. Lock the
        # event while allocating so two simultaneous assignments cannot choose the
        # same MAX()+1 value. The assignment and chest creation also roll back
        # together if either save fails.
        with transaction.atomic():
            Event.objects.select_for_update().only('pk').get(pk=self.program.event_id)
            self.full_clean()

            chest = ChestNumber.objects.select_for_update().filter(
                event_id=self.program.event_id,
                student_id=self.student_id,
            ).first()
            if chest is None:
                chest = ChestNumber.objects.create(
                    event_id=self.program.event_id,
                    student_id=self.student_id,
                    team_id=self.team_id,
                    assigned_by_id=self.assigned_by_id,
                )
            elif chest.team_id != self.team_id:
                other_assignments = ProgramAssignment.objects.filter(
                    program__event_id=self.program.event_id,
                    student_id=self.student_id,
                ).exclude(pk=self.pk)
                if other_assignments.exists():
                    raise ValidationError(
                        'A participant cannot use different teams within the same event.'
                    )
                # Preserve the event chest number if a previously unassigned record
                # is repaired or the participant is moved before their first save.
                ChestNumber.objects.filter(pk=chest.pk).update(team_id=self.team_id)
                chest.team_id = self.team_id

            # Ignore caller-supplied or stale values: every assignment in the event
            # must copy the immutable authoritative number.
            self.chest_number = chest.chest_number
            super().save(*args, **kwargs)

    def clean(self):
        super().clean()
        if not self.program_id or not self.student_id:
            return
        school_id = self.program.event.school_id
        if self.student.school_id != school_id:
            raise ValidationError('The participant and program must belong to the same school.')
        if self.team_id and self.team.school_id != school_id:
            raise ValidationError('The team and program must belong to the same school.')
        if self.assigned_by_id and self.assigned_by.school_id != school_id:
            raise ValidationError('The assigning user must belong to the same school.')

class ProgramResult(models.Model):
    ENTRY_STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('submitted', 'Submitted'),
    ]
    program = models.ForeignKey(Program, on_delete=models.CASCADE, related_name='results')
    # assignment = models.ForeignKey(ProgramAssignment, on_delete=models.CASCADE, related_name='results')  # Temporarily commented out
    participant = models.ForeignKey(User, on_delete=models.CASCADE, related_name='program_results', db_column='participant_id')
    team = models.ForeignKey(Team, on_delete=models.CASCADE, null=True, blank=True)
    sub_team_number = models.PositiveIntegerField(default=1, null=True, blank=True)
    is_team_result = models.BooleanField(default=False)
    entry_status = models.CharField(max_length=20, choices=ENTRY_STATUS_CHOICES, default='draft')
    
    # Result numbering - sequential number based on when marks were entered
    result_number = models.IntegerField(null=True, blank=True, help_text="Sequential result number (Result No. 1, 2, 3, etc.)")
    
    # Legacy marks field (still exists in database)
    marks = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    
    # Judge marks
    judge1_marks = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    judge2_marks = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    judge3_marks = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    judge4_marks = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    
    # Calculated fields
    code_letter = models.CharField(max_length=10, blank=True, default='', help_text="Secret code letter for anonymous grading (A, B, C...)")
    raw_total_marks = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    total_marks = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    average_marks = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    position = models.IntegerField(null=True, blank=True)  # 1st, 2nd, 3rd, etc.
    points_earned = models.IntegerField(default=0)  # Use original field name
    grade = models.CharField(max_length=10, blank=True, default='', help_text="Grade assigned (A+, A, B+, B...)")
    grade_extra_points = models.IntegerField(
        default=0,
        help_text="Absolute grade points awarded; retained under the legacy field name for API compatibility",
    )
    
    # Additional fields - use existing database column names
    comments = models.TextField(blank=True)  # Keep original field name
    entered_at = models.DateTimeField(auto_now_add=True)  # Keep original field name
    updated_at = models.DateTimeField(auto_now=True)
    
    # Legacy field that still exists in database
    entered_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='entered_results', db_column='entered_by_id')
    
    class Meta:
        ordering = ['-total_marks', '-average_marks']
        constraints = [
            models.UniqueConstraint(
                fields=['program', 'participant'],
                condition=models.Q(is_team_result=False),
                name='unique_individual_program_result',
            ),
            models.UniqueConstraint(
                fields=['program', 'team', 'sub_team_number'],
                condition=models.Q(is_team_result=True),
                name='unique_group_subteam_result',
            ),
        ]

    def clean(self):
        super().clean()
        if not self.program_id:
            return
        event = self.program.event
        effective_num_judges = self.program.effective_num_judges
        if self.participant_id and self.participant.school_id != event.school_id:
            raise ValidationError('The participant and program must belong to the same school.')
        if self.team_id and self.team.school_id != event.school_id:
            raise ValidationError('The team and program must belong to the same school.')
        if self.entered_by_id and self.entered_by.school_id != event.school_id:
            raise ValidationError('The result author must belong to the same school.')
        active_fields = [
            self.judge1_marks,
            self.judge2_marks,
            self.judge3_marks,
            self.judge4_marks,
        ][:effective_num_judges]
        maximum = Decimal(str(event.max_mark_per_judge))
        for index, mark in enumerate(active_fields, 1):
            if mark is not None and (Decimal(str(mark)) < 0 or Decimal(str(mark)) > maximum):
                raise ValidationError({
                    f'judge{index}_marks': f'Mark must be between 0 and {maximum}.'
                })
        if self.entry_status == 'submitted' and any(mark is None for mark in active_fields):
            raise ValidationError('All configured judge marks are required before submission.')
    
    def save(self, *args, **kwargs):
        from decimal import Decimal, InvalidOperation
        
        self.is_team_result = bool(self.program_id and self.program.is_team_based)

        # Auto-sync team assignment from global team membership if not set
        if not self.team and self.participant.team_memberships.exists():
            self.team = self.participant.team_memberships.first()
        
        # Assign result number if this is the first time marks are being entered
        if not self.result_number and self.has_marks():
            self.assign_result_number()
        
        # Get event and program settings for judge count and score scaling
        program_num_judges = 3
        event_max_per_judge = Decimal('100.00')
        event_converted_target = Decimal('100.00')
        
        if self.program:
            program_num_judges = self.program.effective_num_judges
            if self.program.event:
                event = self.program.event
                event_max_per_judge = Decimal(str(getattr(event, 'max_mark_per_judge', 100) or 100))
                event_converted_target = Decimal(str(getattr(event, 'converted_total_mark', 100) or 100))

        # Collect active judge marks
        all_judge_values = [self.judge1_marks, self.judge2_marks, self.judge3_marks, self.judge4_marks]
        active_judge_values = all_judge_values[:program_num_judges]
        
        marks = []
        for val in active_judge_values:
            if val is not None:
                try:
                    marks.append(Decimal(str(val)))
                except (InvalidOperation, TypeError):
                    pass
        
        if marks:
            precision = Decimal('0.01')
            self.raw_total_marks = sum(marks).quantize(precision, rounding=ROUND_HALF_UP)
            max_possible_raw = Decimal(str(program_num_judges)) * event_max_per_judge
            
            if max_possible_raw > 0:
                # Scaled total mark = (raw_total / max_possible_raw) * converted_total_mark
                self.total_marks = (
                    (self.raw_total_marks / max_possible_raw) * event_converted_target
                ).quantize(precision, rounding=ROUND_HALF_UP)
            else:
                self.total_marks = self.raw_total_marks

            self.average_marks = (
                self.raw_total_marks / len(marks)
            ).quantize(precision, rounding=ROUND_HALF_UP)
        else:
            self.raw_total_marks = None
            self.total_marks = None
            self.average_marks = None
        
        self.full_clean()
        super().save(*args, **kwargs)
    
    def has_marks(self):
        """Check if this result has any marks entered"""
        judge_fields = ('judge1_marks', 'judge2_marks', 'judge3_marks', 'judge4_marks')
        effective_num_judges = self.program.effective_num_judges if self.program_id else 3
        judge_count = max(1, min(int(effective_num_judges or 1), len(judge_fields)))
        return any(getattr(self, field) is not None for field in judge_fields[:judge_count])
    
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
        from .services import rebuild_program_points
        return rebuild_program_points(self.program)

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
        from .services import recalculate_program_results
        return recalculate_program_results(self.program)
    
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
    assigned_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_chest_numbers',
    )
    
    class Meta:
        unique_together = [
            ['event', 'student'],  # One chest number per student per event
            ['event', 'chest_number'],  # Unique chest numbers per event
        ]
        ordering = ['chest_number']
    
    def __str__(self):
        return f"Chest #{self.chest_number} - {self.student.display_name} ({self.event.title})"

    def clean(self):
        super().clean()
        if not self.event_id or not self.student_id:
            return
        if self.student.school_id != self.event.school_id:
            raise ValidationError('The participant and event must belong to the same school.')
        if self.team_id and self.team.school_id != self.event.school_id:
            raise ValidationError('The team and event must belong to the same school.')
        if self.assigned_by_id and self.assigned_by.school_id != self.event.school_id:
            raise ValidationError('The assigning user must belong to the same school.')
    
    def save(self, *args, **kwargs):
        with transaction.atomic():
            Event.objects.select_for_update().only('pk').get(pk=self.event_id)
            if self.pk:
                original = ChestNumber.objects.only('chest_number').get(pk=self.pk)
                if self.chest_number != original.chest_number:
                    raise ValidationError('A chest number cannot change after it is assigned.')
            elif not self.chest_number:
                if self.team_id:
                    if not self.team.team_number:
                        raise ValidationError('The selected team does not have a team number.')
                    range_start = self.team.team_number * 1000
                    range_end = range_start + 1000
                    max_chest = ChestNumber.objects.filter(
                        event_id=self.event_id,
                        team_id=self.team_id,
                        chest_number__gte=range_start,
                        chest_number__lt=range_end,
                    ).aggregate(max_chest=models.Max('chest_number'))['max_chest']
                    self.chest_number = (max_chest + 1) if max_chest is not None else range_start
                    if self.chest_number >= range_end:
                        raise ValidationError(
                            f'Chest-number range for {self.team.name} is exhausted.'
                        )
                else:
                    max_chest = ChestNumber.objects.filter(
                        event_id=self.event_id,
                        team__isnull=True,
                        chest_number__lt=1000,
                    ).aggregate(max_chest=models.Max('chest_number'))['max_chest']
                    self.chest_number = max(1, (max_chest or 0) + 1)
                    if self.chest_number >= 1000:
                        raise ValidationError('The individual chest-number range is exhausted.')
            self.full_clean()
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

    def clean(self):
        super().clean()
        if self.user_id and self.team_id:
            if self.user.role != 'team_manager':
                raise ValidationError('The selected user is not a team manager.')
            if self.user.school_id != self.team.school_id:
                raise ValidationError('The team manager and team must belong to the same school.')

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


def certificate_template_upload_to(instance, filename):
    extension = Path(filename).suffix.lower()
    return (
        f'certificate_templates/school_{instance.event.school_id}/'
        f'event_{instance.event_id}/{instance.certificate_type}_{uuid4().hex}{extension}'
    )


class CertificateTemplate(models.Model):
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='certificate_templates')
    certificate_type = models.CharField(max_length=24, choices=CERTIFICATE_TYPE_CHOICES)
    background_image = models.ImageField(upload_to=certificate_template_upload_to, blank=True)
    aspect_ratio = models.FloatField(default=4 / 3)
    natural_width = models.PositiveIntegerField(null=True, blank=True)
    natural_height = models.PositiveIntegerField(null=True, blank=True)
    fields = models.JSONField(default=default_certificate_fields)
    updated_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='updated_certificate_templates',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['event', 'certificate_type'],
                name='unique_event_certificate_template',
            ),
        ]
        ordering = ['certificate_type']

    def clean(self):
        super().clean()
        self.fields = normalize_certificate_fields(self.fields)
        if self.updated_by_id and self.updated_by.school_id != self.event.school_id:
            raise ValidationError('The template editor and event must belong to the same school.')

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.event.title} - {self.get_certificate_type_display()}'

# Django signals for automatic cleanup
from django.db.models.signals import m2m_changed, pre_delete, post_delete
from django.dispatch import receiver


@receiver(m2m_changed, sender=Team.members.through)
def prevent_cross_school_team_members(sender, instance, action, pk_set, **kwargs):
    if action != 'pre_add' or not pk_set:
        return
    invalid = User.objects.filter(pk__in=pk_set).exclude(
        school_id=instance.school_id, role='student'
    )
    if invalid.exists():
        raise ValidationError('All team members must be students from the same school.')
    already_assigned = User.objects.filter(
        pk__in=pk_set,
        team_memberships__school_id=instance.school_id,
    ).exclude(team_memberships=instance).distinct()
    if already_assigned.exists():
        names = ', '.join(already_assigned.values_list('name', flat=True))
        raise ValidationError(
            f'Each participant can belong to only one team. Already assigned: {names}'
        )


@receiver(post_delete, sender=ProgramAssignment)
def remove_unused_event_chest_number(sender, instance, **kwargs):
    """Remove the event chest after the participant's final assignment is removed."""
    try:
        event_id = instance.program.event_id
    except (Program.DoesNotExist, AttributeError):
        return
    if not ProgramAssignment.objects.filter(
        program__event_id=event_id,
        student_id=instance.student_id,
    ).exists():
        ChestNumber.objects.filter(
            event_id=event_id,
            student_id=instance.student_id,
        ).delete()

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


@receiver(post_delete, sender=CertificateTemplate)
def delete_certificate_template_background(sender, instance, **kwargs):
    if instance.background_image:
        instance.background_image.delete(save=False)
