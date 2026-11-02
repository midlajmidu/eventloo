from django.contrib.auth.models import AbstractUser
from django.db import models
from django.core.exceptions import ValidationError
from pathlib import Path
import secrets


def school_logo_upload_to(instance, filename):
    """Store future uploads under an unguessable tenant-specific object key."""
    school = instance if instance.__class__.__name__ == 'School' else instance.school
    tenant = school.pk or school.code
    extension = Path(filename).suffix.lower()[:10]
    return f'schools/{tenant}/logos/{secrets.token_hex(16)}{extension}'


class School(models.Model):
    STATUS_CHOICES = [('active', 'Active'), ('suspended', 'Suspended'), ('archived', 'Archived')]

    name = models.CharField(max_length=200)
    code = models.SlugField(max_length=50, unique=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=30, blank=True)
    address = models.TextField(blank=True)
    logo = models.ImageField(upload_to=school_logo_upload_to, blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    max_events = models.PositiveIntegerField(
        null=True, blank=True,
        help_text='Maximum events this organization may create. Blank means unlimited.',
    )
    max_users = models.PositiveIntegerField(
        null=True, blank=True,
        help_text='Maximum non-student dashboard users. Blank means unlimited.',
    )
    max_students = models.PositiveIntegerField(
        null=True, blank=True,
        help_text='Maximum student records this organization may create. Blank means unlimited.',
    )
    created_by = models.ForeignKey(
        'User', on_delete=models.SET_NULL, null=True, blank=True, related_name='created_schools'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f'{self.name} ({self.code})'

class User(AbstractUser):
    ROLE_CHOICES = [
        ('admin', 'Admin'),
        ('event_manager', 'Event Manager'),
        ('team_manager', 'Team Manager'),
        ('student', 'Student'),
        ('super_admin', 'Super Admin'),
    ]
    GENDER_CHOICES = [
        ('male', 'Male'),
        ('female', 'Female'),
        ('other', 'Other'),
    ]
    
    email = models.EmailField(unique=True, null=True, blank=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='student')
    mfa_secret = models.CharField(max_length=64, blank=True, default='')
    mfa_enabled = models.BooleanField(default=False)
    mfa_last_used_step = models.BigIntegerField(null=True, blank=True)
    session_version = models.PositiveIntegerField(default=1)
    school = models.ForeignKey(
        School, on_delete=models.PROTECT, null=True, blank=True, related_name='users'
    )
    
    # Name field (replaces first_name and last_name)
    
    name = models.CharField(max_length=100, null=True, blank=True)
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES, blank=True, default='')
    
    # Student specific fields
    student_id = models.CharField(max_length=20, null=True, blank=True)
    category = models.CharField(max_length=20, null=True, blank=True)
    grade = models.CharField(max_length=20, null=True, blank=True)
    section = models.CharField(max_length=50, null=True, blank=True)
    phone_number = models.CharField(max_length=15, null=True, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    address = models.TextField(null=True, blank=True)
    guardian_name = models.CharField(max_length=100, null=True, blank=True)
    guardian_phone = models.CharField(max_length=15, null=True, blank=True)
    
    # Chest code for events
    chest_code = models.CharField(max_length=20, null=True, blank=True)
    
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
        """Chest numbers are event-specific and generated only when assigned to a program."""
        return None

    
    class Meta:
        db_table = 'auth_user'
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(role='super_admin', school__isnull=True)
                    | (~models.Q(role='super_admin') & models.Q(school__isnull=False))
                ),
                name='user_role_requires_correct_school_scope',
            ),
            models.UniqueConstraint(
                fields=['school', 'student_id', 'category'],
                condition=models.Q(role='student') & models.Q(student_id__isnull=False),
                name='unique_school_student_id_per_category'
            ),
            models.UniqueConstraint(
                fields=['school', 'chest_code'],
                condition=models.Q(chest_code__isnull=False),
                name='unique_school_chest_code',
            ),
        ]


class SchoolSettings(models.Model):
    """School-wide configuration settings"""
    school = models.OneToOneField(
        School, on_delete=models.CASCADE, related_name='settings'
    )
    school_name = models.CharField(max_length=200, default='School Name')
    school_logo = models.ImageField(upload_to=school_logo_upload_to, blank=True, null=True)
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

    # Standard Category Individual
    std_ind_first = models.PositiveIntegerField(default=5)
    std_ind_second = models.PositiveIntegerField(default=3)
    std_ind_third = models.PositiveIntegerField(default=1)

    # Standard Category Group/Team-based
    std_group_first = models.PositiveIntegerField(default=10)
    std_group_second = models.PositiveIntegerField(default=6)
    std_group_third = models.PositiveIntegerField(default=3)

    # Mixed Category Individual
    mix_ind_first = models.PositiveIntegerField(default=10)
    mix_ind_second = models.PositiveIntegerField(default=6)
    mix_ind_third = models.PositiveIntegerField(default=3)

    # Mixed Category Group/Team-based
    mix_group_first = models.PositiveIntegerField(default=10)
    mix_group_second = models.PositiveIntegerField(default=6)
    mix_group_third = models.PositiveIntegerField(default=3)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'School Settings'
        verbose_name_plural = 'School Settings'
    
    def __str__(self):
        return self.school_name
    
    @classmethod
    def get_settings(cls, school=None):
        """Get or create settings for exactly one explicitly selected tenant."""
        if school is None:
            raise ValidationError('School scope is required.')
        settings, created = cls.objects.get_or_create(
            school=school,
            defaults={
                'school_name': school.name,
                'school_address': 'School Address',
                'school_phone': school.phone,
                'school_email': school.email,
            }
        )
        return settings


class StudentCategory(models.Model):
    school = models.ForeignKey(
        School, on_delete=models.CASCADE, related_name='student_categories'
    )
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=20)
    is_mixing = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    mixed_categories = models.ManyToManyField(
        'self',
        symmetrical=False,
        blank=True,
        related_name='parent_mixing_categories'
    )

    class Meta:
        verbose_name = 'Student Category'
        verbose_name_plural = 'Student Categories'
        constraints = [models.UniqueConstraint(fields=['school', 'code'], name='unique_school_category_code')]

    def __str__(self):
        return self.name


class StudentClass(models.Model):
    school = models.ForeignKey(
        School, on_delete=models.CASCADE, related_name='student_classes'
    )
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=20)
    category = models.ForeignKey(StudentCategory, on_delete=models.SET_NULL, null=True, blank=True, related_name='classes')
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'Student Class'
        verbose_name_plural = 'Student Classes'
        constraints = [models.UniqueConstraint(fields=['school', 'code'], name='unique_school_class_code')]

    def __str__(self):
        return f"{self.name} ({self.category.name if self.category else 'No Category'})"
 
