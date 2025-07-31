from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import transaction

User = get_user_model()

class Command(BaseCommand):
    help = 'Create an admin user for the application'

    def add_arguments(self, parser):
        parser.add_argument('--email', type=str, default='admin@eventloo.com', help='Admin email')
        parser.add_argument('--password', type=str, default='admin123', help='Admin password')
        parser.add_argument('--name', type=str, default='Admin User', help='Admin name')

    def handle(self, *args, **options):
        email = options['email']
        password = options['password']
        name = options['name']

        try:
            with transaction.atomic():
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
                    is_staff=True,
                    is_superuser=True
                )

                self.stdout.write(
                    self.style.SUCCESS(f'✅ Admin user created successfully!')
                )
                self.stdout.write(f'📧 Email: {email}')
                self.stdout.write(f'🔑 Password: {password}')
                self.stdout.write(f'👤 Name: {name}')
                self.stdout.write(f'🎭 Role: {user.role}')

        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'❌ Error creating user: {str(e)}')
            ) 