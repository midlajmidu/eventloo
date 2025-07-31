from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import transaction

User = get_user_model()

class Command(BaseCommand):
    help = 'Create a superuser account for the application'

    def add_arguments(self, parser):
        parser.add_argument(
            '--email',
            type=str,
            default='admin@eventloo.com',
            help='Email for the superuser'
        )
        parser.add_argument(
            '--password',
            type=str,
            default='admin123',
            help='Password for the superuser'
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
        password = options['password']
        username = options['username']
        name = options['name']

        try:
            with transaction.atomic():
                # Check if user already exists
                if User.objects.filter(email=email).exists():
                    self.stdout.write(
                        self.style.WARNING(f'User with email {email} already exists')
                    )
                    return

                # Create superuser
                user = User.objects.create_user(
                    email=email,
                    username=username,
                    password=password,
                    name=name,
                    role='admin',
                    is_staff=True,
                    is_superuser=True
                )

                self.stdout.write(
                    self.style.SUCCESS(
                        f'Successfully created superuser:\n'
                        f'Email: {email}\n'
                        f'Username: {username}\n'
                        f'Name: {name}\n'
                        f'Role: Admin'
                    )
                )

        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Error creating superuser: {str(e)}')
            ) 