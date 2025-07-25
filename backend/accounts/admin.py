from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, SchoolSettings

@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ['email', 'username', 'role', 'is_active', 'date_joined']
    list_filter = ['role', 'is_active', 'date_joined', 'category']
    search_fields = ['email', 'username', 'first_name', 'last_name', 'student_id']
    
    fieldsets = UserAdmin.fieldsets + (
        ('Role Information', {'fields': ('role',)}),
        ('Student Information', {
            'fields': ('student_id', 'category', 'grade', 'section', 'phone_number', 'date_of_birth', 'address', 'guardian_name', 'guardian_phone', 'total_points'),
            'classes': ('collapse',)
        }),
    )
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        # Show different users based on admin role
        if request.user.is_superuser:
            return qs
        elif request.user.role == 'admin':
            return qs.filter(role__in=['team_manager', 'student'])
        return qs.none()


@admin.register(SchoolSettings)
class SchoolSettingsAdmin(admin.ModelAdmin):
    list_display = ['school_name', 'school_email', 'updated_at']
    
    fieldsets = (
        ('School Information', {
            'fields': ('school_name', 'school_logo', 'school_address', 'school_phone', 'school_email')
        }),
        ('System Settings', {
            'fields': ('allow_self_registration', 'default_event_duration')
        }),
        ('Branding', {
            'fields': ('primary_color', 'secondary_color')
        }),
    )
    
    def has_add_permission(self, request):
        # Only allow one settings instance
        return not SchoolSettings.objects.exists()
    
    def has_delete_permission(self, request, obj=None):
        # Don't allow deletion of settings
        return False 