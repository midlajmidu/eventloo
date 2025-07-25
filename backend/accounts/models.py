from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    ROLE_CHOICES = [
        ('admin', 'Admin'),
        ('event_manager', 'Event Manager'),
        ('team_manager', 'Team Manager'),
        ('student', 'Student'),
    ]
    
    CATEGORY_CHOICES = [
        ('hs', 'High School (HS)'),
        ('hss', 'Higher Secondary School (HSS)'),
    ]
    
    email = models.EmailField(unique=True, null=True, blank=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='student')
    
    # Name field (replaces first_name and last_name)
    
    name = models.CharField(max_length=100, null=True, blank=True)
    
    # Student specific fields
    student_id = models.CharField(max_length=20, null=True, blank=True)
    category = models.CharField(max_length=10, choices=CATEGORY_CHOICES, null=True, blank=True)
    grade = models.CharField(max_length=20, null=True, blank=True)
    section = models.CharField(max_length=50, null=True, blank=True)
    phone_number = models.CharField(max_length=15, null=True, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    address = models.TextField(null=True, blank=True)
    guardian_name = models.CharField(max_length=100, null=True, blank=True)
    guardian_phone = models.CharField(max_length=15, null=True, blank=True)
    
    # Chest code for events
    chest_code = models.CharField(max_length=20, null=True, blank=True, unique=True)
    
    # Points tracking
    total_points = models.PositiveIntegerField(default=0)
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']
    
    def __str__(self):
        if self.role == 'student' and self.student_id:
            return f"{self.name} ({self.student_id})"
        return f"{self.email} ({self.role})"
    
    @property
    def display_name(self):
        return self.name or self.email or self.username
    
    def get_full_name(self):
        """Get the full name of the user"""
        if self.name:
            return self.name
        elif self.first_name and self.last_name:
            return f"{self.first_name} {self.last_name}".strip()
        elif self.first_name:
            return self.first_name
        elif self.last_name:
            return self.last_name
        elif self.email:
            return self.email
        else:
            return f"Student {self.student_id}" if self.student_id else "Unknown Student"
    
    def generate_chest_code(self):
        """Generate a unique chest code for the student"""
        if self.chest_code:
            return self.chest_code
        
        # Try to get chest number from program assignments
        from events.models import ProgramAssignment
        
        # Get the latest program assignment for this student
        latest_assignment = ProgramAssignment.objects.filter(
            student=self
        ).select_related('team').order_by('-assigned_at').first()
        
        if latest_assignment and latest_assignment.chest_number:
            # Use the chest number from the assignment
            self.chest_code = f"CHEST{latest_assignment.chest_number:04d}"
        else:
            # Generate chest code based on category and grade (fallback)
            category_prefix = self.category.upper() if self.category else 'GEN'
            grade_suffix = self.grade if self.grade else '00'
            
            # Find the next available number
            existing_codes = User.objects.filter(
                chest_code__startswith=f"{category_prefix}{grade_suffix}"
            ).values_list('chest_code', flat=True)
            
            # Extract numbers from existing codes
            existing_numbers = []
            for code in existing_codes:
                try:
                    number_part = code[len(f"{category_prefix}{grade_suffix}"):]
                    if number_part.isdigit():
                        existing_numbers.append(int(number_part))
                except (ValueError, IndexError):
                    continue
            
            # Find the next available number
            next_number = 1
            while next_number in existing_numbers:
                next_number += 1
            
            self.chest_code = f"{category_prefix}{grade_suffix}{next_number:03d}"
        
        # Save the chest code
        self.save(update_fields=['chest_code'])
        return self.chest_code
    
    class Meta:
        db_table = 'auth_user'
        constraints = [
            models.UniqueConstraint(
                fields=['student_id', 'category'],
                condition=models.Q(role='student') & models.Q(student_id__isnull=False),
                name='unique_student_id_per_category'
            )
        ]


class SchoolSettings(models.Model):
    """School-wide configuration settings"""
    school_name = models.CharField(max_length=200, default='School Name')
    school_logo = models.ImageField(upload_to='school_logos/', blank=True, null=True)
    school_address = models.TextField(blank=True)
    school_phone = models.CharField(max_length=20, blank=True)
    school_email = models.EmailField(blank=True)
    
    # System settings
    allow_self_registration = models.BooleanField(default=False)
    default_event_duration = models.PositiveIntegerField(default=7, help_text='Default event duration in days')
    
    # Branding
    primary_color = models.CharField(max_length=7, default='#3B82F6', help_text="Primary brand color (hex)")
    secondary_color = models.CharField(max_length=7, default='#10B981', help_text="Secondary brand color (hex)")
    
    # Event settings
    max_team_size = models.PositiveIntegerField(default=5)
    min_team_size = models.PositiveIntegerField(default=2)
    
    # Points settings
    first_place_points = models.PositiveIntegerField(default=10)
    second_place_points = models.PositiveIntegerField(default=6)
    third_place_points = models.PositiveIntegerField(default=3)
    participation_points = models.PositiveIntegerField(default=1)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'School Settings'
        verbose_name_plural = 'School Settings'
    
    def __str__(self):
        return self.school_name
    
    @classmethod
    def get_settings(cls):
        """Get or create school settings"""
        settings, created = cls.objects.get_or_create(
            pk=1,
            defaults={
                'school_name': 'School Name',
                'school_address': 'School Address',
                'school_phone': '+1234567890',
                'school_email': 'school@example.com'
            }
        )
        return settings 