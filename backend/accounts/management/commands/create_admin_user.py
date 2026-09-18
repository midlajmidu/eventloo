import os

from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model
from django.db import transaction
from accounts.models import School
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError

User = get_user_model()

class Command(BaseCommand):
    help = 'Create an admin user for the application'

    def add_arguments(self, parser):
        parser.add_argument('--email', type=str, required=True, help='Admin email')
        parser.add_argument('--name', type=str, default='Admin User', help='Admin name')
        parser.add_argument('--school-code', type=str, required=True, help='School code')

    def handle(self, *args, **options):
        email = options['email']
        password = os.environ.get('ADMIN_PASSWORD')
        if not password:
            raise CommandError('Set ADMIN_PASSWORD in the command environment.')
        name = options['name']
        school_code = options['school_code'].strip().lower()

        try:
            validate_password(password)
        except ValidationError as exc:
            raise CommandError('; '.join(exc.messages)) from exc

        try:
            with transaction.atomic():
                school = School.objects.filter(code=school_code, status='active').first()
                if not school:
                    raise CommandError('An active school with that code was not found.')
                # Check if user already exists
                if User.objects.filter(email=email).exists():
                    self.stdout.write(
                        self.style.WARNING(f'User with email {email} already exists!')
                    )
                    return

                # Create admin user
                user = User.objects.create_user(
                    email=email,
                    username=email,
                    password=password,
                    name=name,
                    role='admin',
                    school=school,
                    is_staff=False,
                    is_superuser=False
                )

                self.stdout.write(
                    self.style.SUCCESS(f'✅ Admin user created successfully!')
                )
                self.stdout.write(f'📧 Email: {email}')
                self.stdout.write(f'👤 Name: {name}')
                self.stdout.write(f'🎭 Role: {user.role}')

        except CommandError:
            raise
        except Exception as exc:
            raise CommandError(f'Unable to create administrator: {exc}') from exc
