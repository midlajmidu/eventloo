import os
import secrets

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from accounts.models import User


class Command(BaseCommand):
    help = 'Reset one platform administrator password into a protected one-time file.'

    def add_arguments(self, parser):
        parser.add_argument('--email', required=True)
        parser.add_argument('--confirm-email', required=True)
        parser.add_argument('--output', required=True)

    def handle(self, *args, **options):
        email = options['email'].strip().lower()
        if options['confirm_email'].strip().lower() != email:
            raise CommandError('--confirm-email must exactly match --email.')

        output_path = os.path.abspath(options['output'])
        try:
            descriptor = os.open(output_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        except FileExistsError as exc:
            raise CommandError('The output file already exists; refusing to overwrite it.') from exc

        password = secrets.token_urlsafe(24)
        try:
            with transaction.atomic():
                user = User.objects.select_for_update().filter(
                    email__iexact=email,
                    role='super_admin',
                    school__isnull=True,
                    is_active=True,
                ).first()
                if not user:
                    raise CommandError('Active platform administrator not found.')
                try:
                    validate_password(password, user)
                except ValidationError as exc:
                    raise CommandError('; '.join(exc.messages)) from exc
                user.set_password(password)
                user.session_version += 1
                user.save(update_fields=['password', 'session_version'])

                with os.fdopen(descriptor, 'w', encoding='utf-8') as output:
                    output.write(f'Email: {email}\n')
                    output.write(f'One-time password: {password}\n')
                descriptor = None
        except Exception:
            if descriptor is not None:
                os.close(descriptor)
            if os.path.exists(output_path):
                os.unlink(output_path)
            raise

        self.stdout.write(self.style.SUCCESS(
            'Password reset completed. The protected output file must be deleted after use.'
        ))
