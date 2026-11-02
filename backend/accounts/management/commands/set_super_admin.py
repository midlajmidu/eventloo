from django.core.management.base import BaseCommand
from django.db.models import Q
from accounts.models import User


class Command(BaseCommand):
    help = 'Create or update the platform super administrator credentials and reset MFA.'

    def add_arguments(self, parser):
        parser.add_argument('--email', default='superadmin@eventloo.in')
        parser.add_argument('--password', default='eventlooadmin#321')
        parser.add_argument('--name', default='Platform Super Admin')

    def handle(self, *args, **options):
        email = options['email'].strip().lower()
        password = options['password']
        name = options['name']

        existing = list(User.objects.filter(
            Q(email__iexact=email) |
            Q(username__iexact=email) |
            Q(role='super_admin')
        ))

        if existing:
            user = existing[0]
            for other in existing[1:]:
                other.delete()
        else:
            user = User()

        user.username = email
        user.email = email
        user.name = name
        user.role = 'super_admin'
        user.school = None
        user.is_active = True
        user.is_staff = True
        user.is_superuser = True
        user.mfa_enabled = False
        user.mfa_secret = ''
        user.mfa_last_used_step = None
        user.session_version = (user.session_version or 0) + 1
        user.set_password(password)
        user.save()
        self.stdout.write(self.style.SUCCESS(f'Successfully configured Super Admin: {email}'))
