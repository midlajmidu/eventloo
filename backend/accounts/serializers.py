from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework.exceptions import AuthenticationFailed
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.conf import settings
from django.db import transaction
from django.db.models import Q
from .models import User, School, SchoolSettings, StudentCategory, StudentClass
from events.models import Team
from rest_framework_simplejwt.utils import get_md5_hash_password
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from secrets import compare_digest
import hashlib

User = get_user_model()


class HardenedTokenRefreshSerializer(TokenRefreshSerializer):
    """Re-check current tenant and credential state before rotating a session."""

    def validate(self, attrs):
        try:
            refresh = RefreshToken(attrs['refresh'])
        except TokenError as exc:
            raise InvalidToken('The refresh token is invalid or has already been used.') from exc
        with transaction.atomic():
            outstanding = OutstandingToken.objects.select_for_update().filter(
                jti=refresh['jti']
            ).first()
            if not outstanding or BlacklistedToken.objects.filter(token=outstanding).exists():
                raise AuthenticationFailed('This refresh token has already been used.')
            return self._validate_locked(attrs, refresh)

    def _validate_locked(self, attrs, refresh):
        access_type = refresh.get('access_type')

        if access_type == 'team_manager':
            team = Team.objects.select_related('school').filter(
                pk=refresh.get('team_id'), school__status='active'
            ).first()
            expected_scope = str(team.school_id) if team else ''
            expected_credential = (
                hashlib.sha256(team.team_password.encode()).hexdigest() if team else ''
            )
            if (
                not team
                or str(refresh.get('school_id', '')) != expected_scope
                or not compare_digest(
                    str(refresh.get('credential_hash', '')), expected_credential
                )
            ):
                raise AuthenticationFailed('This team session has been revoked.')
        elif access_type in ('school_user', 'super_admin'):
            user = User.objects.select_related('school').filter(
                **{api_settings.USER_ID_FIELD: refresh.get(api_settings.USER_ID_CLAIM)}
            ).first()
            if not user or not user.is_active or not compare_digest(
                str(refresh.get('pwd', '')), get_md5_hash_password(user.password)
            ) or refresh.get('session_version') != user.session_version:
                raise AuthenticationFailed('This session has been revoked.')
            if access_type == 'super_admin':
                if (
                    user.role != 'super_admin'
                    or user.school_id is not None
                    or (settings.REQUIRE_SUPER_ADMIN_MFA and not user.mfa_enabled)
                ):
                    raise AuthenticationFailed('The session scope is invalid.')
            elif (
                user.role not in ('admin', 'event_manager')
                or not user.school_id
                or user.school.status != 'active'
                or str(refresh.get('school_id', '')) != str(user.school_id)
                or (settings.REQUIRE_SCHOOL_STAFF_MFA and not user.mfa_enabled)
            ):
                raise AuthenticationFailed('The school session is no longer active.')
        else:
            raise AuthenticationFailed('The session type is invalid.')

        return super().validate(attrs)

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    school_code = serializers.SlugField(write_only=True, required=False, allow_blank=True, default='')

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['role'] = user.role
        token['access_type'] = 'school_user'
        token['school_id'] = user.school_id
        token['pwd'] = get_md5_hash_password(user.password)
        token['session_version'] = user.session_version
        return token

    def validate(self, attrs):
        school_code = attrs.pop('school_code', '').strip().lower()
        data = super().validate(attrs)
        if self.user.is_superuser or self.user.role == 'super_admin':
            raise serializers.ValidationError('Use the super-admin login page for this account.')
        if self.user.role not in ('admin', 'event_manager'):
            raise serializers.ValidationError('Invalid credentials.')
        if not self.user.school_id:
            raise serializers.ValidationError('User is not associated with an active school.')
        if self.user.school.status != 'active':
            raise serializers.ValidationError('This school is not active.')
        if school_code and self.user.school.code != school_code:
            raise serializers.ValidationError('Invalid school code or credentials.')
        
        # Add custom user data to the response
        data['user'] = {
            'id': self.user.id,
            'email': self.user.email,
            'role': self.user.role,
            'username': self.user.username,
            'school': {
                'id': self.user.school_id,
                'name': self.user.school.name,
                'code': self.user.school.code,
            },
        }
        
        return data

class TeamManagerLoginSerializer(serializers.Serializer):
    """Serializer for team manager login using team credentials"""
    team_username = serializers.CharField(max_length=100)
    team_password = serializers.CharField(max_length=128)
    school_code = serializers.SlugField(required=False, allow_blank=True, default='')
    
    def validate(self, attrs):
        team_username = attrs.get('team_username', '').strip()
        team_password = attrs.get('team_password', '').strip()
        school_code = attrs.get('school_code', '').strip().lower()
        
        if not team_username or not team_password:
            raise serializers.ValidationError("Both team username and password are required")
        
        teams = Team.objects.select_related('school').filter(
            school__status='active',
            team_username=team_username,
        )
        if school_code:
            teams = teams.filter(school__code=school_code)
        
        from django.contrib.auth.hashers import check_password
        matched_team = None
        for team in teams:
            if check_password(team_password, team.team_password):
                matched_team = team
                break
        
        if not matched_team:
            raise serializers.ValidationError("Invalid team credentials")
        
        # Store team in validated data for use in view
        attrs['team'] = matched_team
        return attrs

class TeamManagerResponseSerializer(serializers.ModelSerializer):
    """Serializer for team manager response data"""
    team_name = serializers.CharField(source='name', read_only=True)
    team_id = serializers.IntegerField(source='team_number', read_only=True)
    id = serializers.IntegerField(read_only=True)  # Add the actual database ID
    member_count = serializers.IntegerField(read_only=True)
    points_earned = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = Team
        fields = ['id', 'team_id', 'team_name', 'member_count', 'points_earned']

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'name', 'role', 'school', 'category', 'grade', 'section', 'address', 'date_of_birth', 'student_id', 'display_name', 'total_points', 'chest_code']
        read_only_fields = ['id', 'username', 'role', 'school', 'student_id', 'display_name', 'total_points', 'chest_code']


class SchoolUserSerializer(serializers.ModelSerializer):
    """Safe tenant-admin serializer for dashboard user accounts."""

    password = serializers.CharField(write_only=True, required=False, allow_blank=False)
    display_name = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'name', 'display_name', 'email', 'role', 'is_active',
            'date_joined', 'last_login', 'mfa_enabled', 'password',
        ]
        read_only_fields = ['id', 'display_name', 'date_joined', 'last_login', 'mfa_enabled']
        extra_kwargs = {
            'name': {'required': True, 'allow_blank': False},
            'email': {'required': True},
            'role': {'required': True},
        }

    def validate_name(self, value):
        name = str(value or '').strip()
        if not name:
            raise serializers.ValidationError('Full name is required.')
        return name

    def validate_email(self, value):
        email = str(value or '').strip().lower()
        if not email:
            raise serializers.ValidationError('Email address is required.')
        queryset = User.objects.filter(Q(email__iexact=email) | Q(username__iexact=email))
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError('An account with this email already exists.')
        return email

    def validate_role(self, value):
        if value not in ('admin', 'event_manager'):
            raise serializers.ValidationError('Choose Admin or Event Manager.')
        return value

    def validate(self, attrs):
        if not self.instance and not attrs.get('password'):
            raise serializers.ValidationError({'password': 'Password is required.'})
        password = attrs.get('password')
        if password:
            try:
                validate_password(password, self.instance)
            except DjangoValidationError as exc:
                raise serializers.ValidationError({'password': exc.messages}) from exc
        return attrs

    def create(self, validated_data):
        password = validated_data.pop('password')
        email = validated_data['email']
        return User.objects.create_user(
            username=email,
            password=password,
            school=self.context['request'].user.school,
            **validated_data,
        )

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        security_changed = any(
            field in validated_data and validated_data[field] != getattr(instance, field)
            for field in ('email', 'role', 'is_active')
        )
        for field, value in validated_data.items():
            setattr(instance, field, value)
        if 'email' in validated_data:
            instance.username = validated_data['email']
        if password:
            instance.set_password(password)
            security_changed = True
        if security_changed:
            instance.session_version += 1
        instance.save()
        return instance

class StudentSerializer(serializers.ModelSerializer):
    display_name = serializers.CharField(read_only=True)
    team = serializers.SerializerMethodField()
    team_id = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = [
            'id', 'email', 'name', 'role', 'gender', 'category', 'grade', 'section',
            'phone_number', 'date_of_birth', 'address', 'guardian_name', 'guardian_phone',
            'student_id', 'display_name', 'total_points', 'chest_code', 'team', 'team_id'
        ]
        read_only_fields = ['id', 'student_id', 'display_name', 'total_points', 'chest_code', 'team', 'team_id']

    def get_team(self, obj):
        """Get the team information for this student"""
        try:
            # Check if student is a team member
            member_team = Team.objects.filter(members=obj, school=obj.school).first()
            if member_team:
                return {
                    'id': member_team.id,
                    'name': member_team.name,
                    'is_captain': False
                }
            
            return None
        except Exception:
            return None
    
    def get_team_id(self, obj):
        """Get the team ID for this student"""
        try:
            # Check if student is a team member
            member_team = Team.objects.filter(members=obj, school=obj.school).first()
            if member_team:
                return member_team.id
            
            return None
        except Exception:
            return None

class StudentCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating students with all DB model fields"""
    student_id = serializers.CharField(required=False, allow_blank=True)
    team_id = serializers.IntegerField(required=False, allow_null=True)
    email = serializers.EmailField(required=False, allow_blank=True, allow_null=True)
    phone_number = serializers.CharField(required=False, allow_blank=True, max_length=15)
    guardian_phone = serializers.CharField(required=False, allow_blank=True, max_length=15)
    date_of_birth = serializers.DateField(required=False, allow_null=True)
    
    class Meta:
        model = User
        fields = [
            'id', 'name', 'gender', 'category', 'grade', 'section',
            'email', 'phone_number', 'date_of_birth', 'address',
            'guardian_name', 'guardian_phone', 'student_id', 'team_id'
        ]
        read_only_fields = ['id']
    
    def to_internal_value(self, data):
        # Normalize empty strings to None for optional fields before deserialization
        if hasattr(data, '_mutable'):
            data = data.copy()
        elif isinstance(data, dict):
            data = data.copy()

        if 'date_of_birth' in data and not data['date_of_birth']:
            data['date_of_birth'] = None
        if 'email' in data and not data['email']:
            data['email'] = None
        if 'team_id' in data and (data['team_id'] == '' or data['team_id'] is None):
            data['team_id'] = None

        return super().to_internal_value(data)

    def validate(self, data):
        # Ensure name is provided
        if not data.get('name'):
            raise serializers.ValidationError("Name is required")

        # Clean and validate optional email
        if 'email' in data:
            raw_email = data.get('email')
            if raw_email:
                clean_email = str(raw_email).strip().lower()
                if not clean_email or clean_email in ('none', 'null', 'nan'):
                    data['email'] = None
                else:
                    existing_email = User.objects.filter(email=clean_email).exclude(id=self.instance.id if self.instance else None)
                    if existing_email.exists():
                        raise serializers.ValidationError({'email': f'A user with email "{clean_email}" already exists.'})
                    data['email'] = clean_email
            else:
                data['email'] = None

        if 'date_of_birth' in data and not data.get('date_of_birth'):
            data['date_of_birth'] = None

        gender = data.get('gender', getattr(self.instance, 'gender', '') if self.instance else '')
        if not gender:
            raise serializers.ValidationError({'gender': 'Gender is required.'})
        
        # Validate student_id uniqueness per category if provided
        student_id = data.get('student_id')
        category = data.get('category')
        grade = data.get('grade')
        
        # Dynamic Category validation
        if category:
            try:
                cat_obj = StudentCategory.objects.get(
                    code=category, is_active=True, school=self.context['request'].user.school
                )
                if cat_obj.is_mixing:
                    raise serializers.ValidationError({"category": f"Mixing/general category '{category}' cannot be assigned directly to a student. Students must belong to standard categories only."})
            except StudentCategory.DoesNotExist:
                raise serializers.ValidationError({"category": f"Invalid or inactive category '{category}'"})
        
        # Dynamic Class validation
        if grade:
            cls_query = StudentClass.objects.filter(
                code=grade, is_active=True, school=self.context['request'].user.school
            )
            if not cls_query.exists():
                raise serializers.ValidationError({"grade": f"Invalid or inactive class code '{grade}'"})
            if category:
                if not cls_query.filter(category__code=category).exists():
                    raise serializers.ValidationError({"grade": f"Class '{grade}' is not assigned to category '{category}'"})
        
        if student_id and category:
            # Check if this student_id already exists in the same category
            existing_student = User.objects.filter(
                student_id=student_id, 
                category=category,
                role='student',
                school=self.context['request'].user.school,
            ).exclude(id=self.instance.id if self.instance else None)
            
            if existing_student.exists():
                raise serializers.ValidationError({
                    'student_id': f'Student ID "{student_id}" already exists in category "{category.upper()}". Student IDs must be unique within each category.'
                })
        
        # Validate student name duplication within the same class and section for this school
        name = data.get('name', getattr(self.instance, 'name', '') if self.instance else '')
        if name and grade:
            clean_name = name.strip()
            section = data.get('section', getattr(self.instance, 'section', '') if self.instance else '')
            clean_sec = (section or '').strip()

            dup_query = User.objects.filter(
                role='student',
                school=self.context['request'].user.school,
                name__iexact=clean_name,
                grade=grade,
            )
            if clean_sec:
                dup_query = dup_query.filter(section__iexact=clean_sec)
            if self.instance:
                dup_query = dup_query.exclude(pk=self.instance.pk)

            if dup_query.exists():
                existing = dup_query.first()
                sec_info = f" in Section '{existing.section}'" if existing.section else ""
                raise serializers.ValidationError({
                    'name': f"A student named '{existing.name}' is already enrolled in Class '{existing.grade}'{sec_info} (ID: {existing.student_id}). Duplicate student enrollment is not permitted."
                })

        return data

class SchoolSettingsSerializer(serializers.ModelSerializer):
    school_code = serializers.CharField(source='school.code', read_only=True)
    school_id = serializers.IntegerField(source='school.id', read_only=True)

    class Meta:
        model = SchoolSettings
        fields = [
            'id', 'school', 'school_code', 'school_id', 'school_name', 'school_logo', 'school_address',
            'school_phone', 'school_email', 'allow_self_registration',
            'default_event_duration', 'primary_color', 'secondary_color',
            'max_team_size', 'min_team_size', 'created_at', 'updated_at',
            'first_place_points', 'second_place_points', 'third_place_points', 'participation_points',
            'std_ind_first', 'std_ind_second', 'std_ind_third',
            'std_group_first', 'std_group_second', 'std_group_third',
            'mix_ind_first', 'mix_ind_second', 'mix_ind_third',
            'mix_group_first', 'mix_group_second', 'mix_group_third',
        ]
        read_only_fields = ['school', 'school_code', 'school_id']


class SchoolSerializer(serializers.ModelSerializer):
    admin_count = serializers.IntegerField(read_only=True)
    user_count = serializers.IntegerField(read_only=True)
    student_count = serializers.IntegerField(read_only=True)
    event_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = School
        fields = [
            'id', 'name', 'code', 'email', 'phone', 'address', 'logo', 'status',
            'max_events', 'max_users', 'max_students',
            'created_at', 'updated_at', 'admin_count', 'user_count',
            'student_count', 'event_count',
        ]
        read_only_fields = ['created_at', 'updated_at']

    def validate_code(self, value):
        return value.lower()

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if not self.instance:
            return attrs

        usage = {
            'max_events': self.instance.events.count(),
            'max_users': self.instance.users.exclude(role='student').count(),
            'max_students': self.instance.users.filter(role='student').count(),
        }
        labels = {
            'max_events': 'event',
            'max_users': 'dashboard user',
            'max_students': 'student',
        }
        errors = {}
        for field, used in usage.items():
            value = attrs.get(field, getattr(self.instance, field))
            if value is not None and value < used:
                errors[field] = (
                    f'Cannot set this below current usage ({used} {labels[field]}'
                    f'{"" if used == 1 else "s"}).'
                )
        if errors:
            raise serializers.ValidationError(errors)
        return attrs


class SchoolCreateSerializer(serializers.ModelSerializer):
    admin_name = serializers.CharField(write_only=True)
    admin_email = serializers.EmailField(write_only=True)
    admin_password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = School
        fields = [
            'name', 'code', 'email', 'phone', 'address', 'status',
            'max_events', 'max_users', 'max_students',
            'admin_name', 'admin_email', 'admin_password',
        ]

    def validate_max_users(self, value):
        if value is not None and value < 1:
            raise serializers.ValidationError(
                'The user limit must be at least 1 because every school requires an administrator.'
            )
        return value

    def validate_admin_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('An account with this email already exists.')
        return value.lower()

    def validate_admin_password(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages)
        return value

    def create(self, validated_data):
        from django.db import transaction

        admin_name = validated_data.pop('admin_name')
        admin_email = validated_data.pop('admin_email')
        admin_password = validated_data.pop('admin_password')
        with transaction.atomic():
            school = School.objects.create(
                created_by=self.context['request'].user,
                code=validated_data.pop('code').lower(),
                **validated_data,
            )
            SchoolSettings.objects.create(
                school=school,
                school_name=school.name,
                school_email=school.email,
                school_phone=school.phone,
                school_address=school.address,
            )
            User.objects.create_user(
                username=admin_email,
                email=admin_email,
                password=admin_password,
                name=admin_name,
                role='admin',
                school=school,
                is_staff=False,
                is_superuser=False,
            )
        return school

# Note: PointsRecord and TeamProfile serializers are in events/serializers.py
# to avoid circular imports 


class StudentCategorySerializer(serializers.ModelSerializer):
    class_ids = serializers.SerializerMethodField(read_only=True)
    mixed_category_ids = serializers.SerializerMethodField(read_only=True)
    mixed_category_codes = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = StudentCategory
        fields = ['id', 'name', 'code', 'is_mixing', 'is_active', 'class_ids', 'mixed_category_ids', 'mixed_category_codes']

    def get_class_ids(self, obj):
        return list(obj.classes.values_list('id', flat=True))

    def get_mixed_category_ids(self, obj):
        return list(obj.mixed_categories.values_list('id', flat=True))

    def get_mixed_category_codes(self, obj):
        return list(obj.mixed_categories.values_list('code', flat=True))


class StudentClassSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    category_code = serializers.CharField(source='category.code', read_only=True)

    class Meta:
        model = StudentClass
        fields = ['id', 'name', 'code', 'category', 'category_name', 'category_code', 'is_active']

    def validate_category(self, value):
        request = self.context.get('request')
        if value and value.school_id != getattr(request.user, 'school_id', None):
            raise serializers.ValidationError('This category does not belong to your school.')
        return value
