from django.core.management.base import BaseCommand
from events.models import Team

class Command(BaseCommand):
    help = 'Regenerate team credentials for all teams'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be done without making changes',
        )

    def handle(self, *args, **options):
        teams = Team.objects.all()
        dry_run = options['dry_run']
        
        self.stdout.write(f"Found {teams.count()} teams")
        
        for team in teams:
            if dry_run:
                self.stdout.write(f"Would regenerate credentials for team: {team.name}")
                self.stdout.write(f"  Current username: {team.team_username}")
                self.stdout.write(f"  Current password: {team.team_password}")
            else:
                # Generate new credentials
                username, password = team.generate_team_credentials()
                team.save()
                self.stdout.write(f"Regenerated credentials for team: {team.name}")
                self.stdout.write(f"  New username: {username}")
                self.stdout.write(f"  New password: {password}")
        
        if not dry_run:
            self.stdout.write(self.style.SUCCESS(f"Successfully regenerated credentials for {teams.count()} teams"))
        else:
            self.stdout.write("Dry run completed. No changes made.") 