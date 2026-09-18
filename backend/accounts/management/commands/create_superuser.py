import os

from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import transaction

User = get_user_model()

class Command(BaseCommand):
    help = 'Create a superuser account for the application'

    def add_arguments(self, parser):
        parser.add_argument(
            '--email',
            type=str,
            required=True,
            help='Email for the superuser'
        )
        parser.add_argument(
            '--username',
            type=str,
            default='admin',
            help='Username for the superuser'
        )
        parser.add_argument(
            '--name',
            type=str,
            default='Admin User',
            help='Full name for the superuser'
        )

    def handle(self, *args, **options):
        email = options['email']
        password = os.environ.get('SUPER_ADMIN_PASSWORD')
        if not password:
            raise CommandError('Set SUPER_ADMIN_PASSWORD in the command environment.')
        username = options['username']
        name = options['name']

        try:
            validate_password(password)
        except ValidationError as exc:
            raise CommandError('; '.join(exc.messages)) from exc

        try:
            with transaction.atomic():
                # Check if user already exists
                if User.objects.filter(email=email).exists():
                    self.stdout.write(
                        self.style.WARNING(f'User with email {email} already exists')
                    )
                    return

                # Create the application platform administrator. This role is
                # intentionally separate from Django's unrestricted admin flags.
                user = User.objects.create_user(
                    email=email,
                    username=username,
                    password=password,
                    name=name,
                    role='super_admin',
                    school=None,
                    is_staff=False,
                    is_superuser=False
                )

                self.stdout.write(
                    self.style.SUCCESS(
                        f'Successfully created superuser:\n'
                        f'Email: {email}\n'
                        f'Username: {username}\n'
                        f'Name: {name}\n'
                        f'Role: Super Admin'
                    )
                )

        except CommandError:
            raise
        except Exception as exc:
            raise CommandError(f'Unable to create platform administrator: {exc}') from exc
