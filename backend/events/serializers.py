from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from .models import Event, EventStage, Team, IndividualParticipation, EventAnnouncement, PointsRecord, TeamProfile, Program, ProgramAssignment, ProgramResult, ChestNumber

User = get_user_model()

class UserBasicSerializer(serializers.ModelSerializer):
    """Basic user serializer for nested representations"""
    name = serializers.CharField(source='get_full_name', read_only=True)
    
    class Meta:
        model = User
        fields = ['id', 'name', 'email', 'student_id', 'gender']
        read_only_fields = ['id']

class EventListSerializer(serializers.ModelSerializer):
    """Serializer for event list view"""
    current_participants = serializers.ReadOnlyField()
    current_teams = serializers.ReadOnlyField()
    is_registration_open = serializers.ReadOnlyField()
    created_by = UserBasicSerializer(read_only=True)
    
    class Meta:
        model = Event
        fields = [
            'id', 'title', 'description', 'event_type', 'status',
            'start_date', 'end_date', 'start_time', 'end_time',
            'venue', 'max_participants', 'is_team_based',
            'current_participants', 'current_teams',
            'is_registration_open', 'created_by', 'created_at',
            'image', 'registration_deadline'
        ]
    
    def to_representation(self, instance):
        """Override to handle potential serialization errors"""
        try:
            return super().to_representation(instance)
        except Exception as e:
            # Return a safe representation with error info
            return {
                'id': instance.id,
                'title': instance.title,
                'description': instance.description or '',
                'event_type': instance.event_type,
                'status': instance.status,
                'start_date': instance.start_date.isoformat() if instance.start_date else None,
                'end_date': instance.end_date.isoformat() if instance.end_date else None,
                'start_time': instance.start_time.isoformat() if instance.start_time else None,
                'end_time': instance.end_time.isoformat() if instance.end_time else None,
                'venue': instance.venue or '',
                'max_participants': instance.max_participants,
                'is_team_based': instance.is_team_based,
                'current_participants': getattr(instance, 'current_participants', 0),
                'current_teams': getattr(instance, 'current_teams', 0),
                'is_registration_open': getattr(instance, 'is_registration_open', False),
                'created_by': {
                    'id': instance.created_by.id if instance.created_by else None,
                    'name': instance.created_by.get_full_name() if instance.created_by else '',
                    'email': instance.created_by.email if instance.created_by else '',
                    'student_id': getattr(instance.created_by, 'student_id', '') if instance.created_by else ''
                },
                'created_at': instance.created_at.isoformat() if instance.created_at else None,
                'image': instance.image or '',
                'registration_deadline': instance.registration_deadline.isoformat() if instance.registration_deadline else None,
                'serialization_error': 'Some optional event fields could not be rendered.'
            }

class EventDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer for event detail view"""
    current_participants = serializers.ReadOnlyField()
    current_teams = serializers.ReadOnlyField()
    is_registration_open = serializers.ReadOnlyField()
    created_by = UserBasicSerializer(read_only=True)
    
    class Meta:
        model = Event
        fields = [
            'id', 'title', 'description', 'event_type', 'status',
            'start_date', 'end_date', 'start_time', 'end_time',
            'registration_deadline', 'venue', 'max_participants',
            'max_teams', 'is_team_based', 'team_size_min', 'team_size_max',
            'winner_points', 'runner_up_points', 'participation_points',
            'num_judges', 'max_mark_per_judge', 'converted_total_mark',
            'max_single_programs_per_student', 'max_group_programs_per_student',
            'enable_grading_system', 'grading_rules',
            'std_ind_first', 'std_ind_second', 'std_ind_third',
            'std_group_first', 'std_group_second', 'std_group_third',
            'mix_ind_first', 'mix_ind_second', 'mix_ind_third',
            'mix_group_first', 'mix_group_second', 'mix_group_third',
            'count_general_individual_points_for_students',
            'current_participants', 'current_teams', 'is_registration_open',
            'created_by', 'created_at', 'updated_at', 'image'
        ]

class EventCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating and updating events"""
    
    class Meta:
        model = Event
        fields = [
            'title', 'description', 'event_type', 'status',
            'start_date', 'end_date', 'start_time', 'end_time',
            'registration_deadline', 'venue', 'max_participants',
            'max_teams', 'is_team_based', 'team_size_min', 'team_size_max',
            'winner_points', 'runner_up_points', 'participation_points',
            'num_judges', 'max_mark_per_judge', 'converted_total_mark',
            'max_single_programs_per_student', 'max_group_programs_per_student',
            'enable_grading_system', 'grading_rules',
            'std_ind_first', 'std_ind_second', 'std_ind_third',
            'std_group_first', 'std_group_second', 'std_group_third',
            'mix_ind_first', 'mix_ind_second', 'mix_ind_third',
            'mix_group_first', 'mix_group_second', 'mix_group_third',
            'count_general_individual_points_for_students',
            'image'
        ]
    
    def validate(self, data):
        """Custom validation for event data"""
        # Validate dates
        if data.get('start_date') and data.get('end_date'):
            if data['start_date'] > data['end_date']:
                raise serializers.ValidationError("Start date cannot be after end date")
        
        # Validate times for same day events
        if (data.get('start_date') == data.get('end_date') and 
            data.get('start_time') and data.get('end_time')):
            if data['start_time'] >= data['end_time']:
                raise serializers.ValidationError("Start time must be before end time for same day events")

        start_date = data.get('start_date', getattr(self.instance, 'start_date', None))
        start_time = data.get('start_time', getattr(self.instance, 'start_time', None))
        deadline = data.get(
            'registration_deadline', getattr(self.instance, 'registration_deadline', None)
        )
        deadline_fields_changed = any(
            field in data for field in ('registration_deadline', 'start_date', 'start_time')
        )
        if deadline and start_date and deadline_fields_changed:
            local_deadline = timezone.localtime(deadline) if timezone.is_aware(deadline) else deadline
            if local_deadline.date() > start_date:
                raise serializers.ValidationError({
                    'registration_deadline': 'Registration must close on or before the event starts.'
                })
            if local_deadline.date() == start_date and start_time and local_deadline.time() > start_time:
                raise serializers.ValidationError({
                    'registration_deadline': 'Registration must close before the event start time.'
                })
        
        # Set default values for team-based events
        if data.get('is_team_based'):
            # Set default values if not provided
            if not data.get('max_teams'):
                data['max_teams'] = 100  # Default high value
            if not data.get('team_size_min'):
                data['team_size_min'] = 1
            if not data.get('team_size_max'):
                data['team_size_max'] = 50  # Default high value

        rules = data.get('grading_rules', getattr(self.instance, 'grading_rules', [])) or []
        normalized_ranges = []
        names = set()
        for index, rule in enumerate(rules, 1):
            if not isinstance(rule, dict):
                raise serializers.ValidationError({'grading_rules': f'Rule {index} must be an object.'})
            name = str(rule.get('name', '')).strip()
            if not name or name.lower() in names:
                raise serializers.ValidationError({'grading_rules': 'Grade names must be present and unique.'})
            names.add(name.lower())
            try:
                minimum = float(rule.get('min_mark'))
                maximum = float(rule.get('max_mark'))
            except (TypeError, ValueError):
                raise serializers.ValidationError({'grading_rules': f'Rule {index} contains invalid numbers.'})
            if minimum < 0 or maximum > 100 or minimum > maximum:
                raise serializers.ValidationError({
                    'grading_rules': f'Grade {name} must stay between 0 and 100%, with minimum not above maximum.'
                })
            for existing_min, existing_max, existing_name in normalized_ranges:
                if minimum <= existing_max and maximum >= existing_min:
                    raise serializers.ValidationError({
                        'grading_rules': f'Grade ranges {existing_name} and {name} overlap.'
                    })
            normalized_ranges.append((minimum, maximum, name))

        # Persist only the three supported event-level fields. This also
        # removes legacy extra_points keys without treating them as awards.
        if 'grading_rules' in data:
            data['grading_rules'] = [
                {
                    'name': str(rule['name']).strip(),
                    'min_mark': float(rule['min_mark']),
                    'max_mark': float(rule['max_mark']),
                }
                for rule in rules
            ]

        for field in (
            'max_single_programs_per_student',
            'max_group_programs_per_student',
        ):
            value = data.get(field, getattr(self.instance, field, 0) if self.instance else 0)
            if value is not None and int(value) < 0:
                raise serializers.ValidationError({field: 'Use 0 for unlimited or a positive limit.'})
        
        return data

class TeamSerializer(serializers.ModelSerializer):
    member_count = serializers.ReadOnlyField()
    members_details = serializers.SerializerMethodField()
    team_credentials = serializers.SerializerMethodField()
    
    class Meta:
        model = Team
        fields = [
            'id', 'name', 'description', 
            'members', 'member_count', 'points_earned', 'position', 'team_number',
            'created_at', 'updated_at', 'members_details', 'team_credentials'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'member_count', 'team_number']
    
    def get_members_details(self, obj):
        """Get detailed information about team members"""
        members_list = []
        member_ids = set()
        
        # Add all members
        for member in obj.members.all():
            members_list.append({
                'id': member.id,
                'first_name': member.first_name,
                'last_name': member.last_name,
                'name': member.get_full_name(),
                'email': member.email,
                'student_id': getattr(member, 'student_id', ''),
                'category': getattr(member, 'category', ''),
                'grade': getattr(member, 'grade', ''),
                'section': getattr(member, 'section', ''),
            })
        
        return members_list
    
    def get_team_credentials(self, obj):
        """Passwords are write-only and only shown once when regenerated."""
        request = self.context.get('request')
        if request and request.user and request.user.role == 'admin':
            # Generate credentials if not exist
            if not obj.team_username or not obj.team_password:
                obj.generate_team_credentials()
                obj.save()
            
            return {
                'username': obj.team_username,
                'password': getattr(obj, '_plain_team_password', None)
            }
        return None

class TeamCreateSerializer(serializers.ModelSerializer):
    """Simple serializer for creating teams without automatic member addition"""
    
    class Meta:
        model = Team
        fields = [
            'name', 'description'
        ]

class TeamCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating teams"""
    member_emails = serializers.ListField(
        child=serializers.EmailField(),
        write_only=True,
        required=False,
        help_text="List of member email addresses"
    )
    
    class Meta:
        model = Team
        fields = [
            'name', 'description', 'member_emails'
        ]
    
    def create(self, validated_data):
        member_emails = validated_data.pop('member_emails', [])
        team = super().create(validated_data)
        
        # Add members by email
        if member_emails:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            members = User.objects.filter(
                email__in=member_emails, role='student', school=team.school
            )
            team.members.set(members)
        
        return team
    
    def update(self, instance, validated_data):
        member_emails = validated_data.pop('member_emails', None)
        team = super().update(instance, validated_data)
        
        # Update members if provided
        if member_emails is not None:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            members = User.objects.filter(
                email__in=member_emails, role='student', school=team.school
            )
            team.members.set(members)
        
        return team

class IndividualParticipationSerializer(serializers.ModelSerializer):
    """Serializer for individual participation"""
    participant = UserBasicSerializer(read_only=True)
    event_title = serializers.CharField(source='event.title', read_only=True)
    
    class Meta:
        model = IndividualParticipation
        fields = [
            'id', 'participant', 'event_title', 'points_earned',
            'position', 'registered_at'
        ]

class EventAnnouncementSerializer(serializers.ModelSerializer):
    """Serializer for event announcements"""
    created_by = UserBasicSerializer(read_only=True)
    event_title = serializers.CharField(source='event.title', read_only=True)
    
    class Meta:
        model = EventAnnouncement
        fields = [
            'id', 'title', 'message', 'is_important',
            'created_by', 'event_title', 'created_at'
        ]

class EventAnnouncementCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating announcements"""
    
    class Meta:
        model = EventAnnouncement
        fields = ['title', 'message', 'is_important']

class PointsRecordSerializer(serializers.ModelSerializer):
    """Serializer for Points records"""
    team_name = serializers.CharField(source='team.name', read_only=True)
    student_name = serializers.CharField(source='student.display_name', read_only=True)
    student_id = serializers.CharField(source='student.student_id', read_only=True)
    event_title = serializers.CharField(source='event.title', read_only=True)
    awarded_by_name = serializers.CharField(source='awarded_by.display_name', read_only=True)
    point_type_display = serializers.CharField(source='get_point_type_display', read_only=True)
    
    class Meta:
        model = PointsRecord
        fields = [
            'id', 'team', 'team_name', 'student', 'student_name', 'student_id',
            'event', 'event_title', 'points', 'point_type', 'point_type_display',
            'reason', 'description', 'awarded_by', 'awarded_by_name', 'awarded_at'
        ]
        read_only_fields = ['id', 'awarded_by', 'awarded_at']

class PointsRecordCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating points records"""
    
    class Meta:
        model = PointsRecord
        fields = [
            'team', 'student', 'event', 'points', 'point_type', 'reason', 'description'
        ]
    
    def validate(self, data):
        # Ensure either team or student is provided, but not both
        if not data.get('team') and not data.get('student'):
            raise serializers.ValidationError("Either team or student must be provided")
        if data.get('team') and data.get('student'):
            raise serializers.ValidationError("Cannot assign points to both team and student")
        request = self.context.get('request')
        school_id = getattr(getattr(request, 'user', None), 'school_id', None)
        for field in ('team', 'student', 'event'):
            value = data.get(field)
            if value and getattr(value, 'school_id', None) != school_id:
                raise serializers.ValidationError({field: 'This object does not belong to your school.'})
        return data

class TeamProfileSerializer(serializers.ModelSerializer):
    """Serializer for Team Profile"""
    team_name = serializers.CharField(source='team.name', read_only=True)
    team_points = serializers.IntegerField(source='team.points_earned', read_only=True)
    
    class Meta:
        model = TeamProfile
        fields = [
            'id', 'team', 'team_name', 'team_points', 'motto', 'color_code',
            'logo_url', 'events_participated', 'events_won', 'current_rank',
            'win_rate', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'win_rate', 'created_at', 'updated_at']

class EventStageSerializer(serializers.ModelSerializer):
    display_name = serializers.CharField(read_only=True)
    program_count = serializers.IntegerField(source='programs.count', read_only=True)

    class Meta:
        model = EventStage
        fields = [
            'id', 'number', 'name', 'display_name', 'capacity', 'map_link',
            'program_count', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'display_name', 'program_count', 'created_at', 'updated_at']

    def validate(self, attrs):
        attrs = super().validate(attrs)
        request = self.context.get('request')
        view = self.context.get('view')
        event_id = view.kwargs.get('event_pk') if view else None
        if not event_id and self.instance:
            event_id = self.instance.event_id
        if not request or not Event.objects.filter(
            pk=event_id, school_id=request.user.school_id
        ).exists():
            raise serializers.ValidationError({'event': 'Event not found.'})

        number = attrs.get('number', getattr(self.instance, 'number', None))
        duplicate = EventStage.objects.filter(event_id=event_id, number=number)
        if self.instance:
            duplicate = duplicate.exclude(pk=self.instance.pk)
        if duplicate.exists():
            raise serializers.ValidationError({
                'number': 'This stage number already exists in the event.'
            })
        return attrs


class ProgramSerializer(serializers.ModelSerializer):
    participants_count = serializers.SerializerMethodField()
    assigned_students = serializers.SerializerMethodField()
    assignments_per_team = serializers.SerializerMethodField()
    category_display = serializers.SerializerMethodField()
    event = serializers.SerializerMethodField()
    program_type = serializers.CharField(required=True)
    total_max_participants = serializers.SerializerMethodField()
    limit_description = serializers.SerializerMethodField()
    total_teams = serializers.SerializerMethodField()
    result_status = serializers.SerializerMethodField()
    stage = EventStageSerializer(read_only=True)
    stage_id = serializers.PrimaryKeyRelatedField(
        source='stage', queryset=EventStage.objects.all(),
        required=False, allow_null=True, write_only=True,
    )
    schedule_entry_count = serializers.IntegerField(read_only=True)
    scheduled_duration_minutes = serializers.IntegerField(read_only=True)
    schedule_entry_type = serializers.SerializerMethodField()
    
    class Meta:
        model = Program
        fields = [
            'id', 'event', 'name', 'description', 'category', 'category_display',
            'is_team_based', 'max_participants', 'max_participants_per_team', 'team_size', 'max_teams_per_school',
            'stage', 'stage_id', 'venue', 'start_time', 'end_time', 'duration_minutes_per_entry',
            'schedule_end_is_manual',
            'schedule_entry_count', 'schedule_entry_type', 'scheduled_duration_minutes',
            'is_active', 'is_finished', 'is_published', 'status', 'result_status',
            'participants_count', 'assigned_students', 'assignments_per_team', 'created_at', 'updated_at',
            'program_type', 'grading_points', 'total_max_participants', 'limit_description', 'total_teams'
        ]
        read_only_fields = [
            'id', 'created_at', 'updated_at', 'status', 'is_published',
            'result_status', 'schedule_end_is_manual',
        ]

    def get_schedule_entry_type(self, obj):
        return 'groups' if obj.is_team_based else 'participants'

    def get_result_status(self, obj):
        if getattr(obj, 'is_published', False):
            return 'published'
        submitted_results = obj.results.filter(
            entry_status='submitted', average_marks__isnull=False
        )
        if submitted_results.exists():
            if obj.is_team_based:
                total_assignments = obj.assignments.values(
                    'team_id', 'sub_team_number'
                ).distinct().count()
            else:
                total_assignments = obj.assignments.values('student_id').distinct().count()
            results_count = submitted_results.count()
            if total_assignments > 0 and results_count < total_assignments:
                return 'in_progress'
            return 'submitted'
        if obj.results.filter(average_marks__isnull=False).exists():
            return 'in_progress'
        return 'pending'

    def get_category_display(self, obj):
        return str(obj.category or 'general').upper()

    def get_total_teams(self, obj):
        """Get total active teams count"""
        from events.models import Team
        return Team.objects.filter(school=obj.event.school).count()

    def get_total_max_participants(self, obj):
        """Calculate overall total participant capacity across all teams"""
        total_teams = self.get_total_teams(obj) or 1
        if obj.is_team_based:
            teams_per_school = obj.max_teams_per_school or 1
            team_sz = obj.team_size or 1
            return teams_per_school * team_sz * total_teams
        else:
            if obj.max_participants:
                return obj.max_participants * total_teams
            return None

    def get_limit_description(self, obj):
        """Get human-readable limit description with total team capacity breakdown"""
        total_teams = self.get_total_teams(obj) or 1
        if obj.is_team_based:
            teams_per_school = obj.max_teams_per_school or 1
            team_sz = obj.team_size or 1
            per_school_total = teams_per_school * team_sz
            total_cap = per_school_total * total_teams
            if teams_per_school > 1:
                return f"{teams_per_school} sub-teams of {team_sz} members ({per_school_total} per school, Total: {total_cap} across {total_teams} schools)"
            return f"1 team of {team_sz} members ({per_school_total} per school, Total: {total_cap} across {total_teams} schools)"
        else:
            if obj.max_participants:
                total_cap = obj.max_participants * total_teams
                return f"{obj.max_participants} per team (Total: {total_cap} — {obj.max_participants} × {total_teams} teams)"
            return "Individual"
    
    def get_event(self, obj):
        """Get event details"""
        return {
            'id': obj.event.id,
            'title': obj.event.title,
            'event_type': obj.event.event_type,
            'status': obj.event.status
        }
    
    def get_participants_count(self, obj):
        """Get total number of participants in this program"""
        return obj.assignments.count()
    
    def get_assigned_students(self, obj):
        """Get list of assigned students with their details"""
        assignments = obj.assignments.select_related('student', 'team')
        return [
            {
                'id': assignment.student.id,
                'name': assignment.student.get_full_name(),
                'student_id': assignment.student.student_id,
                'team_id': assignment.team.id if assignment.team else None,
                'team_name': assignment.team.name if assignment.team else None,
                'chest_number': assignment.chest_number,
                'sub_team_number': assignment.sub_team_number or 1,
                'is_leader': assignment.is_leader,
                'assignment_id': assignment.id,
                'grade': assignment.student.grade,
                'category': assignment.student.category
            }
            for assignment in assignments
        ]
    
    def get_assignments_per_team(self, obj):
        """Get assignments grouped by team"""
        from django.db.models import Count
        team_assignments = obj.assignments.values('team__name').annotate(
            count=Count('id')
        ).order_by('team__name')
        
        return [
            {
                'team_name': assignment['team__name'] or 'No Team',
                'count': assignment['count']
            }
            for assignment in team_assignments
        ]
    
    def validate(self, data):
        """Validate program data"""
        is_team_based = data.get(
            'is_team_based', getattr(self.instance, 'is_team_based', False)
        )
        max_participants = data.get(
            'max_participants', getattr(self.instance, 'max_participants', None)
        )
        team_size = data.get('team_size', getattr(self.instance, 'team_size', None))
        category_code = data.get('category', getattr(self.instance, 'category', 'general'))
        grading_points_supplied = 'grading_points' in data
        grading_points = data.get('grading_points', {})
        request = self.context.get('request')
        stage = data.get('stage', getattr(self.instance, 'stage', None))
        if stage and request:
            view = self.context.get('view')
            event_id = getattr(self.instance, 'event_id', None) or (
                view.kwargs.get('event_pk') if view else None
            ) or request.data.get('event')
            if stage.event_id != int(event_id or 0) or stage.event.school_id != request.user.school_id:
                raise serializers.ValidationError({
                    'stage_id': 'Select a stage from this event.'
                })
        if category_code not in ('general', 'gen', 'gn', 'open') and request:
            from accounts.models import StudentCategory
            if not StudentCategory.objects.filter(
                school_id=request.user.school_id, code=category_code, is_active=True
            ).exists():
                raise serializers.ValidationError({'category': 'Select a category from your school.'})

        if grading_points_supplied and not isinstance(grading_points, dict):
            raise serializers.ValidationError({
                'grading_points': 'Grade points must be an object keyed by grade name.'
            })
        normalized_grading_points = {}
        for raw_name, raw_points in (
            grading_points.items() if grading_points_supplied else ()
        ):
            name = str(raw_name).strip()
            if not name:
                raise serializers.ValidationError({'grading_points': 'Grade names cannot be blank.'})
            try:
                points = int(raw_points)
            except (TypeError, ValueError):
                raise serializers.ValidationError({
                    'grading_points': f'Points for grade {name} must be a whole number.'
                })
            if points < 0:
                raise serializers.ValidationError({
                    'grading_points': f'Points for grade {name} cannot be negative.'
                })
            normalized_grading_points[name] = points
        if grading_points_supplied:
            event = getattr(self.instance, 'event', None)
            if event is None and request:
                view = self.context.get('view')
                event_id = (
                    view.kwargs.get('event_pk') if view else None
                ) or request.data.get('event')
                event = Event.objects.filter(
                    pk=event_id, school_id=request.user.school_id
                ).first()
            if event is None:
                raise serializers.ValidationError({
                    'grading_points': 'A valid event is required before grade points can be saved.'
                })
            allowed_grades = {
                str(rule.get('name', '')).strip()
                for rule in event.get_effective_grading_rules()
            } if event else set()
            unknown_grades = sorted(set(normalized_grading_points) - allowed_grades)
            if unknown_grades:
                raise serializers.ValidationError({
                    'grading_points': (
                        'Unknown grade name(s): ' + ', '.join(unknown_grades) +
                        '. Save the event grading rules first.'
                    )
                })
            data['grading_points'] = normalized_grading_points
        
        # Validate team-based program settings
        if is_team_based:
            # For team-based programs, require team_size
            if team_size is None or team_size <= 0:
                raise serializers.ValidationError(
                    "Team-based programs must have a positive team_size value"
                )
            # Individual capacity is not used for group programs. Keep the
            # optional per-team cap because assignment validation enforces it.
            data['max_participants'] = None
        else:
            # For individual programs, max_participants is now REQUIRED
            if max_participants is None or max_participants <= 0:
                raise serializers.ValidationError(
                    "Individual programs must have a positive max_participants value (Total Participants in Each Team)"
                )
            # Clear team-related fields for individual programs
            data['max_participants_per_team'] = None
            data['team_size'] = None

        start_time = data.get('start_time', getattr(self.instance, 'start_time', None))
        explicit_end_time = data.get('end_time') if 'end_time' in data else None
        duration = data.get(
            'duration_minutes_per_entry',
            getattr(self.instance, 'duration_minutes_per_entry', 5),
        )
        event = getattr(self.instance, 'event', None)
        if event is None and request:
            view = self.context.get('view')
            event_id = (
                view.kwargs.get('event_pk') if view else None
            ) or request.data.get('event')
            event = Event.objects.filter(pk=event_id, school_id=request.user.school_id).first()
        if start_time:
            if not stage:
                raise serializers.ValidationError({
                    'stage_id': 'Select a stage before scheduling this program.'
                })
            if event and not (event.start_date <= start_time.date() <= event.end_date):
                raise serializers.ValidationError({
                    'start_time': (
                        f'Schedule date must be between {event.start_date} and {event.end_date}.'
                    )
                })
            entry_count = self.instance.schedule_entry_count if self.instance else 0
            calculated_end = start_time + timedelta(minutes=max(1, entry_count) * duration)
            end_time = explicit_end_time or calculated_end
            if end_time <= start_time:
                raise serializers.ValidationError({
                    'end_time': 'Ending time must be after the starting time.'
                })
            if event and not (event.start_date <= end_time.date() <= event.end_date):
                raise serializers.ValidationError({
                    'end_time': 'Ending time must be within the event dates.'
                })
            data['end_time'] = end_time
            data['schedule_end_is_manual'] = explicit_end_time is not None
        else:
            data['end_time'] = None
            data['schedule_end_is_manual'] = False
        
        # Validate program_type
        program_type = data.get(
            'program_type', getattr(self.instance, 'program_type', None)
        )
        if not program_type or program_type not in ['stage', 'off_stage']:
            raise serializers.ValidationError('Program type is required and must be either "stage" or "off_stage".')
        
        return data

class ChestNumberSerializer(serializers.ModelSerializer):
    """Serializer for chest numbers"""
    student_name = serializers.CharField(source='student.get_full_name', read_only=True)
    student_id = serializers.CharField(source='student.student_id', read_only=True)
    gender = serializers.CharField(source='student.gender', read_only=True)
    team_name = serializers.CharField(source='team.name', read_only=True)
    event_title = serializers.CharField(source='event.title', read_only=True)
    category = serializers.SerializerMethodField()
    programs_count = serializers.SerializerMethodField()
    program_names = serializers.SerializerMethodField()
    assigned_programs = serializers.SerializerMethodField()
    
    class Meta:
        model = ChestNumber
        fields = [
            'id', 'event', 'event_title', 'student', 'student_name', 'student_id', 'gender',
            'team', 'team_name', 'chest_number', 'category', 'programs_count', 'program_names',
            'assigned_programs', 'assigned_at'
        ]
        read_only_fields = ['id', 'assigned_at']

    def get_category(self, obj):
        if obj.student and obj.student.category:
            return obj.student.category.upper()
        # Fallback to program assignment category
        from events.models import ProgramAssignment
        pa = ProgramAssignment.objects.filter(program__event=obj.event, student=obj.student).select_related('program').first()
        if pa and pa.program and pa.program.category:
            return pa.program.category.upper()
        return "GENERAL"

    def get_programs_count(self, obj):
        from events.models import ProgramAssignment
        return ProgramAssignment.objects.filter(program__event=obj.event, student=obj.student).values('program').distinct().count()

    def get_program_names(self, obj):
        from events.models import ProgramAssignment
        progs = ProgramAssignment.objects.filter(program__event=obj.event, student=obj.student).select_related('program').values_list('program__name', flat=True).distinct()
        return list(progs)

    def get_assigned_programs(self, obj):
        from events.models import ProgramAssignment, ProgramResult
        pas = ProgramAssignment.objects.filter(program__event=obj.event, student=obj.student).select_related('program')
        results = []
        for pa in pas:
            prog = pa.program
            if not prog:
                continue
            
            # Find result for this participant or participant's team for group program
            res = ProgramResult.objects.filter(program=prog, participant=obj.student).first()
            if not res and prog.is_team_based and obj.team:
                res = ProgramResult.objects.filter(program=prog, team=obj.team, sub_team_number=pa.sub_team_number or 1).first()
            
            if not res or res.entry_status == 'draft':
                status_str = 'Pending'
                grade_str = '-'
                points_val = 0
                team_points_val = 0
            elif not prog.is_published:
                status_str = 'Awaiting Publication'
                grade_str = '-'
                points_val = 0
                team_points_val = 0
            else:
                has_marks_entered = False
                if res:
                    if hasattr(res, 'has_marks') and res.has_marks():
                        has_marks_entered = True
                    elif res.total_marks is not None or res.marks is not None or res.position is not None or res.grade:
                        has_marks_entered = True
                
                if has_marks_entered and res.entry_status == 'submitted':
                    status_str = 'Participated'
                    grade_str = res.grade or '-'
                    awarded = getattr(res, 'points_earned', 0) or 0
                    from .services import program_points_count_for_student
                    points_val = (
                        awarded
                        if not prog.is_team_based and program_points_count_for_student(prog)
                        else 0
                    )
                    team_points_val = awarded if prog.is_team_based else 0
                else:
                    status_str = 'Not Participated'
                    grade_str = '-'
                    points_val = 0
                    team_points_val = 0
                    
            prog_type_str = 'Stage' if getattr(prog, 'program_type', 'off_stage') == 'stage' else 'Offstage'
            prog_mode_str = 'Group' if prog.is_team_based else 'Individual'
            
            results.append({
                'id': prog.id,
                'name': prog.name,
                'type': prog_type_str,
                'mode': prog_mode_str,
                'status': status_str,
                'grade': grade_str,
                'points': points_val,
                'team_points': team_points_val,
                'is_stage': getattr(prog, 'program_type', 'off_stage') == 'stage'
            })
        return results

class ProgramAssignmentSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.get_full_name', read_only=True)
    student_id_number = serializers.CharField(source='student.student_id', read_only=True)
    student_gender = serializers.CharField(source='student.gender', read_only=True)
    team_name = serializers.CharField(source='team.name', read_only=True)
    program_name = serializers.CharField(source='program.name', read_only=True)
    
    class Meta:
        model = ProgramAssignment
        fields = [
            'id', 'program', 'program_name', 'student', 'student_name', 'student_id_number', 'student_gender',
            'team', 'team_name', 'chest_number', 'sub_team_number', 'is_leader', 'assigned_at'
        ]
        read_only_fields = ['id', 'assigned_at', 'chest_number']

class ProgramResultSerializer(serializers.ModelSerializer):
    participant_name = serializers.CharField(source='participant.get_full_name', read_only=True)
    participant_id = serializers.IntegerField(source='participant.id', read_only=True)
    team_name = serializers.CharField(source='team.name', read_only=True)
    team_id = serializers.IntegerField(source='team.id', read_only=True)
    chest_number = serializers.SerializerMethodField()
    program_name = serializers.CharField(source='program.name', read_only=True)
    
    class Meta:
        model = ProgramResult
        fields = [
            'id', 'program', 'participant', 'participant_name', 'participant_id',
            'team', 'team_name', 'team_id', 'chest_number', 'code_letter', 'program_name',
            'result_number', 'judge1_marks', 'judge2_marks', 'judge3_marks', 'judge4_marks', 
            'raw_total_marks', 'total_marks', 'average_marks',
            'position', 'points_earned', 'grade', 'grade_extra_points', 'entry_status',
            'is_team_result', 'sub_team_number', 'comments', 'entered_at', 'updated_at'
        ]
        read_only_fields = ['raw_total_marks', 'total_marks', 'average_marks', 'position', 'points_earned', 'result_number']
    
    def get_chest_number(self, obj):
        """Get chest number for the participant in this event"""
        if obj.program.is_team_based and obj.team_id:
            numbers = ProgramAssignment.objects.filter(
                program=obj.program,
                team_id=obj.team_id,
                sub_team_number=obj.sub_team_number or 1,
            ).order_by('-is_leader', 'chest_number').values_list('chest_number', flat=True)
            return ', '.join(str(number) for number in numbers if number is not None) or None
        try:
            chest_num = ChestNumber.objects.get(
                event=obj.program.event,
                student=obj.participant
            )
            return chest_num.chest_number
        except ChestNumber.DoesNotExist:
            return None

class MarkEntrySerializer(serializers.ModelSerializer):
    """Serializer for mark entry - includes participant details"""
    student_name = serializers.SerializerMethodField()
    student_code = serializers.CharField(source='participant.student_id', read_only=True)
    student_chest_code = serializers.CharField(source='participant.chest_code', read_only=True)
    team_name = serializers.SerializerMethodField()
    chest_number = serializers.SerializerMethodField()
    is_team_based = serializers.SerializerMethodField()
    team_member_count = serializers.SerializerMethodField()
    
    def get_student_name(self, obj):
        """Get student name with team-based formatting"""
        try:
            if obj.participant:
                base_name = obj.participant.get_full_name()
                
                # Check if this is a team-based program result
                if hasattr(obj, 'is_team_based') and obj.is_team_based:
                    return f"{base_name} and team"
                elif obj.team and obj.program.is_team_based:
                    return f"{base_name} and team"
                else:
                    return base_name
            else:
                return "Unknown Student (No Participant)"
        except Exception as e:
            return f"Unknown Student (Error: {str(e)})"

    def get_team_name(self, obj):
        return getattr(obj, 'team_name_override', None) or (obj.team.name if obj.team else '')
    
    def get_is_team_based(self, obj):
        """Check if this is a team-based program"""
        return obj.program.is_team_based if hasattr(obj, 'program') else False
    
    def get_team_member_count(self, obj):
        """Get the number of team members for team-based programs"""
        if hasattr(obj, 'team_member_count'):
            return obj.team_member_count
        elif obj.team and obj.program.is_team_based:
            # Count team members assigned to this program
            from events.models import ProgramAssignment
            return ProgramAssignment.objects.filter(
                program=obj.program,
                team=obj.team
            ).count()
        return 1
    
    class Meta:
        model = ProgramResult
        fields = [
            'id', 'participant', 'student_name', 'student_code', 'student_chest_code', 'team', 'team_name',
            'sub_team_number', 'entry_status',
            'chest_number', 'code_letter', 'result_number', 'judge1_marks', 'judge2_marks', 'judge3_marks', 'judge4_marks',
            'raw_total_marks', 'total_marks', 
            'average_marks', 'position', 'points_earned', 'grade', 'grade_extra_points', 'comments', 'entered_at', 'updated_at',
            'is_team_based', 'team_member_count'
        ]
        read_only_fields = ['raw_total_marks', 'total_marks', 'average_marks', 'position', 'points_earned', 'entered_at', 'updated_at']
    
    def get_chest_number(self, obj):
        """Get chest number for the participant in this event"""
        if obj.program.is_team_based and obj.team_id:
            numbers = ProgramAssignment.objects.filter(
                program=obj.program,
                team_id=obj.team_id,
                sub_team_number=obj.sub_team_number or 1,
            ).order_by('-is_leader', 'chest_number').values_list('chest_number', flat=True)
            return ', '.join(str(number) for number in numbers if number is not None) or None
            
        try:
            # First try to get from ProgramAssignment
            assignment = ProgramAssignment.objects.filter(
                program=obj.program,
                student=obj.participant
            ).first()
            
            if assignment and assignment.chest_number:
                return assignment.chest_number
            
            # Fallback to ChestNumber model
            chest_number = ChestNumber.objects.filter(
                event=obj.program.event,
                student=obj.participant
            ).first()
            
            return chest_number.chest_number if chest_number else None
        except:
            return None

class ProgramResultSummarySerializer(serializers.ModelSerializer):
    """Serializer for displaying program results summary"""
    participant_name = serializers.CharField(source='participant.get_full_name', read_only=True)
    participant_code = serializers.CharField(source='participant.student_id', read_only=True)
    team_name = serializers.CharField(source='team.name', read_only=True)
    chest_number = serializers.SerializerMethodField()
    position_display = serializers.SerializerMethodField()
    participant_members = serializers.SerializerMethodField()
    
    class Meta:
        model = ProgramResult
        fields = [
            'id', 'result_number', 'participant_name', 'participant_code', 'team_name', 'chest_number',
            'judge1_marks', 'judge2_marks', 'judge3_marks', 'total_marks', 'average_marks',
            'position', 'position_display', 'points_earned', 'grade', 'grade_extra_points',
            'sub_team_number', 'entry_status', 'participant_members'
        ]

    def get_participant_members(self, obj):
        if not obj.program.is_team_based:
            return [obj.participant.get_full_name()]
        assignments = ProgramAssignment.objects.filter(
            program=obj.program,
            team=obj.team,
            sub_team_number=obj.sub_team_number or 1,
        ).select_related('student').order_by('-is_leader', 'student__first_name', 'student__last_name')
        return [
            {
                'id': assignment.student_id,
                'name': assignment.student.get_full_name(),
                'is_leader': assignment.is_leader,
                'chest_number': assignment.chest_number,
            }
            for assignment in assignments
        ]
    
    def get_chest_number(self, obj):
        if obj.program.is_team_based and obj.team_id:
            numbers = ProgramAssignment.objects.filter(
                program=obj.program,
                team_id=obj.team_id,
                sub_team_number=obj.sub_team_number or 1,
            ).order_by('-is_leader', 'chest_number').values_list('chest_number', flat=True)
            return ', '.join(str(number) for number in numbers if number is not None) or None
        try:
            # First try to get from ProgramAssignment
            assignment = ProgramAssignment.objects.get(
                program=obj.program,
                student=obj.participant
            )
            if assignment.chest_number:
                return assignment.chest_number
        except ProgramAssignment.DoesNotExist:
            pass
        
        # Fallback to ChestNumber model
        try:
            chest_num = ChestNumber.objects.get(
                event=obj.program.event,
                student=obj.participant
            )
            return chest_num.chest_number
        except ChestNumber.DoesNotExist:
            return None
    
    def get_position_display(self, obj):
        if obj.position == 1:
            return "1st"
        elif obj.position == 2:
            return "2nd"
        elif obj.position == 3:
            return "3rd"
        elif obj.position:
            return f"{obj.position}th"
        return "Unranked"

# Enhanced Event Serializer with programs
class EventWithProgramsSerializer(EventDetailSerializer):
    programs = ProgramSerializer(many=True, read_only=True)
    programs_count = serializers.SerializerMethodField()
    
    class Meta(EventDetailSerializer.Meta):
        fields = EventDetailSerializer.Meta.fields + ['programs', 'programs_count']
        
    def get_programs_count(self, obj):
        return obj.programs.count() 
