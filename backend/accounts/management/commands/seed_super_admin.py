import os
from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError

from accounts.models import User


class Command(BaseCommand):
    help = 'Create the platform super administrator without attaching it to a school.'

    def add_arguments(self, parser):
        parser.add_argument('--email', default=os.environ.get('SUPER_ADMIN_EMAIL', 'superadmin@eventloo.com'))
        parser.add_argument('--name', default=os.environ.get('SUPER_ADMIN_NAME', 'Eventloo Super Admin'))

    def handle(self, *args, **options):
        email = options['email'].strip().lower()
        password = os.environ.get('SUPER_ADMIN_PASSWORD')
        if not password:
            raise CommandError('Set SUPER_ADMIN_PASSWORD in the environment.')
        try:
            validate_password(password)
        except ValidationError as exc:
            raise CommandError('; '.join(exc.messages)) from exc

        user = User.objects.filter(email__iexact=email).first()
        if user:
            if user.school_id:
                raise CommandError('That email belongs to a school account and cannot become super admin.')
            user.is_active = True
            user.is_staff = False
            user.is_superuser = False
            user.role = 'super_admin'
            user.save(update_fields=['is_active', 'is_staff', 'is_superuser', 'role'])
            self.stdout.write(self.style.SUCCESS(f'Super admin is ready: {email}'))
            self.stdout.write('Existing password was not changed.')
            return

        user = User.objects.create_user(
            username=email,
            email=email,
            password=password,
            name=options['name'],
            role='super_admin',
            school=None,
            is_staff=False,
            is_superuser=False,
        )
        self.stdout.write(self.style.SUCCESS(f'Super admin created: {email}'))
