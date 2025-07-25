from django.contrib import admin
from django.utils.html import format_html
from .models import Event, Team, IndividualParticipation, EventAnnouncement, Program, ProgramAssignment, ProgramResult

@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ['title', 'event_type', 'start_date', 'end_date', 'status', 'is_team_based', 'created_by']
    list_filter = ['event_type', 'status', 'is_team_based', 'start_date', 'created_by']
    search_fields = ['title', 'description', 'venue']
    readonly_fields = ['created_at', 'updated_at']
    
    actions = ['preview_deletion']
    
    def preview_deletion(self, request, queryset):
        """Preview what will be deleted when events are removed"""
        if queryset.count() != 1:
            self.message_user(request, 'Please select exactly one event to preview deletion.', level='ERROR')
            return
        
        event = queryset.first()
        
        # Count related data
        teams_count = 0  # Teams are no longer linked to events
        programs_count = event.programs.count()
        announcements_count = event.announcements.count()
        individual_participants_count = event.individual_participants.count()
        
        # Count program assignments and results
        total_assignments = sum(program.assignments.count() for program in event.programs.all())
        total_results = sum(program.results.count() for program in event.programs.all())
        
        # Count chest numbers and points records
        from events.models import ChestNumber, PointsRecord
        chest_numbers_count = ChestNumber.objects.filter(event=event).count()
        points_records_count = PointsRecord.objects.filter(event=event).count()
        
        total_records = (teams_count + programs_count + announcements_count + 
                        individual_participants_count + total_assignments + 
                        total_results + chest_numbers_count + points_records_count)
        
        message = f"""
        Event: {event.title}
        
        This will delete:
        - {teams_count} teams
        - {programs_count} programs  
        - {announcements_count} announcements
        - {individual_participants_count} individual participants
        - {total_assignments} program assignments
        - {total_results} program results
        - {chest_numbers_count} chest numbers
        - {points_records_count} points records
        
        Total: {total_records} records will be permanently deleted.
        """
        
        self.message_user(request, message, level='WARNING')
    
    preview_deletion.short_description = "Preview deletion impact"

@admin.register(Team)
class TeamAdmin(admin.ModelAdmin):
    list_display = ['name', 'member_count', 'team_credentials', 'created_at']
    list_filter = ['created_at']
    search_fields = ['name', 'description', 'team_username']
    readonly_fields = ['created_at', 'updated_at', 'team_username', 'team_password', 'team_number']
    
    actions = ['reset_team_numbering', 'preview_deletion']
    
    def reset_team_numbering(self, request, queryset):
        """Reset team numbering to start from 1"""
        from events.models import Team
        Team.reset_team_numbering()
        self.message_user(request, f'Successfully reset team numbering for {queryset.count()} teams.')
    reset_team_numbering.short_description = "Reset team numbering to start from 1"
    
    def preview_deletion(self, request, queryset):
        """Preview what will be deleted when teams are removed"""
        if queryset.count() != 1:
            self.message_user(request, 'Please select exactly one team to preview deletion.', level='ERROR')
            return
        
        team = queryset.first()
        related_data = team.get_related_data_summary()
        total_records = sum(related_data.values())
        
        message = f"""
        Team: {team.name}
        
        This will delete:
        - {related_data['assignments']} program assignments
        - {related_data['results']} program results
        - {related_data['chest_numbers']} chest numbers
        - {related_data['points_records']} points records
        
        Total: {total_records} records will be permanently deleted.
        """
        
        self.message_user(request, message, level='WARNING')
    
    preview_deletion.short_description = "Preview deletion impact"
    
    fieldsets = (
        ('Team Information', {
            'fields': ('name', 'description', 'members', 'team_manager')
        }),
        ('Team Performance', {
            'fields': ('points_earned', 'position')
        }),
        ('Team Number', {
            'fields': ('team_number',),
            'description': 'Team number automatically matches the team ID'
        }),
        ('Team Manager Login Credentials', {
            'fields': ('team_username', 'team_password'),
            'description': 'Auto-generated login credentials for team manager access'
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def team_credentials(self, obj):
        """Display team login credentials in a formatted way"""
        if obj.team_username and obj.team_password:
            return format_html(
                '<strong>Username:</strong> {}<br><strong>Password:</strong> {}',
                obj.team_username,
                obj.team_password
            )
        return "Not generated"
    team_credentials.short_description = "Login Credentials"
    
    def save_model(self, request, obj, form, change):
        """Override save to ensure credentials are generated"""
        super().save_model(request, obj, form, change)
        # Force regeneration if credentials are missing
        if not obj.team_username or not obj.team_password:
            obj.generate_team_credentials()
            obj.save()

@admin.register(IndividualParticipation)
class IndividualParticipationAdmin(admin.ModelAdmin):
    list_display = ['participant', 'event', 'registered_at']
    list_filter = ['event', 'registered_at']
    search_fields = ['participant__email', 'event__title']

@admin.register(EventAnnouncement)
class EventAnnouncementAdmin(admin.ModelAdmin):
    list_display = ['title', 'event', 'is_important', 'created_by', 'created_at']
    list_filter = ['event', 'is_important', 'created_at']
    search_fields = ['title', 'content', 'event__title']

@admin.register(Program)
class ProgramAdmin(admin.ModelAdmin):
    list_display = ['name', 'event', 'category', 'is_team_based', 'start_time', 'end_time', 'is_finished', 'is_active']
    list_filter = ['event', 'category', 'is_team_based', 'is_finished', 'is_active']
    search_fields = ['name', 'description', 'venue']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('Program Information', {
            'fields': ('name', 'description', 'event', 'category', 'venue')
        }),
        ('Program Settings', {
            'fields': ('is_team_based', 'max_participants', 'team_size_min', 'team_size_max'),
            'description': 'max_participants: Maximum participants per team (not total)'
        }),
        ('Scheduling', {
            'fields': ('start_time', 'end_time')
        }),
        ('Status', {
            'fields': ('is_active', 'is_finished')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

@admin.register(ProgramAssignment)
class ProgramAssignmentAdmin(admin.ModelAdmin):
    list_display = ['student', 'program', 'team', 'assigned_at', 'assigned_by']
    list_filter = ['program__event', 'program', 'assigned_at']
    search_fields = ['student__email', 'program__name', 'team__name']

@admin.register(ProgramResult)
class ProgramResultAdmin(admin.ModelAdmin):
    list_display = ['participant', 'program', 'team', 'judge1_marks', 'judge2_marks', 'average_marks', 'position', 'points_earned', 'entered_at']
    list_filter = ['program', 'team', 'position', 'entered_at']
    search_fields = ['participant__first_name', 'participant__last_name', 'program__name', 'team__name']
    readonly_fields = ['total_marks', 'average_marks', 'position', 'points_earned', 'entered_at', 'updated_at']
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('program', 'participant', 'team')
        }),
        ('Marks', {
            'fields': ('judge1_marks', 'judge2_marks', 'judge3_marks', 'total_marks', 'average_marks')
        }),
        ('Results', {
            'fields': ('position', 'points_earned', 'comments')
        }),
        ('Timestamps', {
            'fields': ('entered_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )


