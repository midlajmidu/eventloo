from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()

class Command(BaseCommand):
    help = 'Migrate existing users first_name and last_name to the new name field'

    def handle(self, *args, **options):
        users = User.objects.all()
        migrated_count = 0
        
        for user in users:
            if not user.name:  # Only update if name is empty
                first_name = user.first_name or ''
                last_name = user.last_name or ''
                
                # Combine first_name and last_name
                if first_name and last_name:
                    user.name = f"{first_name} {last_name}"
                elif first_name:
                    user.name = first_name
                elif last_name:
                    user.name = last_name
                else:
                    # Fallback to username or email
                    user.name = user.username or user.email or 'Unknown'
                
                user.save()
                migrated_count += 1
                self.stdout.write(f"Migrated user: {user.name}")
        
        self.stdout.write(
            self.style.SUCCESS(f'Successfully migrated {migrated_count} users')
        ) 