import csv
import os

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from events.models import Team

class Command(BaseCommand):
    help = 'Regenerate team credentials for all teams'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be done without making changes',
        )
        parser.add_argument('--school-code', required=True, help='Exact tenant school code')
        parser.add_argument(
            '--output',
            help='New path for a mode-0600 CSV containing the one-time credentials',
        )

    def handle(self, *args, **options):
        teams = Team.objects.filter(school__code=options['school_code'])
        dry_run = options['dry_run']
        output_path = options.get('output')
        if not teams.exists():
            raise CommandError('No teams were found for that school code.')
        if not dry_run and not output_path:
            raise CommandError('--output is required unless --dry-run is used.')

        descriptor = None
        if not dry_run:
            try:
                descriptor = os.open(output_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            except FileExistsError as exc:
                raise CommandError('The output path already exists; refusing to overwrite it.') from exc
        
        self.stdout.write(f"Found {teams.count()} teams")
        
        credentials = []
        try:
            with transaction.atomic():
                for team in teams.select_for_update():
                    if dry_run:
                        self.stdout.write(f"Would regenerate credentials for team: {team.name}")
                        self.stdout.write(f"  Current username: {team.team_username}")
                    else:
                        username, password = team.generate_team_credentials()
                        team.save()
                        credentials.append((team.id, team.name, username, password))
                        self.stdout.write(f"Regenerated credentials for team: {team.name}")

            if credentials:
                with os.fdopen(descriptor, 'w', newline='', encoding='utf-8') as output:
                    writer = csv.writer(output)
                    writer.writerow(['team_id', 'team_name', 'username', 'one_time_password'])
                    writer.writerows(credentials)
                descriptor = None
        except Exception:
            if descriptor is not None:
                os.close(descriptor)
            if output_path and os.path.exists(output_path):
                os.unlink(output_path)
            raise
        
        if not dry_run:
            self.stdout.write(self.style.SUCCESS(
                f"Regenerated {teams.count()} credentials into the protected output file. "
                "Distribute them securely, then delete the file."
            ))
        else:
            self.stdout.write("Dry run completed. No changes made.") 
