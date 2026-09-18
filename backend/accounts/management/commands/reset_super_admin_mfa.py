from django.core.management.base import BaseCommand, CommandError

from accounts.models import User


class Command(BaseCommand):
    help = 'Disable MFA for one platform administrator so it can be enrolled again.'

    def add_arguments(self, parser):
        parser.add_argument('--email', required=True)
        parser.add_argument('--confirm-email', required=True)

    def handle(self, *args, **options):
        email = options['email'].strip().lower()
        if options['confirm_email'].strip().lower() != email:
            raise CommandError('--confirm-email must exactly match --email.')
        user = User.objects.filter(
            email__iexact=email, role='super_admin', school__isnull=True
        ).first()
        if not user:
            raise CommandError('Platform administrator not found.')
        user.mfa_secret = ''
        user.mfa_enabled = False
        user.mfa_last_used_step = None
        user.session_version += 1
        user.save(update_fields=[
            'mfa_secret', 'mfa_enabled', 'mfa_last_used_step', 'session_version'
        ])
        self.stdout.write(self.style.SUCCESS('MFA was reset; enroll it again before use.'))
