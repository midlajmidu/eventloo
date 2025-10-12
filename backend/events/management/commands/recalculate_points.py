from django.core.management.base import BaseCommand
from events.models import ProgramResult


class Command(BaseCommand):
    help = 'Recalculate points for all program results based on updated logic'

    def add_arguments(self, parser):
        parser.add_argument(
            '--program-id',
            type=int,
            help='Recalculate points for a specific program only',
        )
        parser.add_argument(
            '--event-id',
            type=int,
            help='Recalculate points for all programs in a specific event',
        )

    def handle(self, *args, **options):
        program_id = options.get('program_id')
        event_id = options.get('event_id')

        # Filter results based on options
        if program_id:
            results = ProgramResult.objects.filter(program_id=program_id)
            self.stdout.write(f'Recalculating points for program {program_id}...')
        elif event_id:
            results = ProgramResult.objects.filter(program__event_id=event_id)
            self.stdout.write(f'Recalculating points for all programs in event {event_id}...')
        else:
            results = ProgramResult.objects.all()
            self.stdout.write('Recalculating points for ALL program results...')

        # Get unique programs from the results
        programs = set(result.program for result in results)
        
        total_updated = 0
        for program in programs:
            # Get one result from this program to trigger recalculation
            program_results = results.filter(program=program)
            if program_results.exists():
                # Trigger recalculation by calling update_program_rankings on any result
                first_result = program_results.first()
                first_result.update_program_rankings()
                
                count = program_results.count()
                total_updated += count
                
                self.stdout.write(
                    self.style.SUCCESS(
                        f'✓ Updated {count} results for program: {program.name} '
                        f'({"Team-based" if program.is_team_based else "Individual"}, '
                        f'{program.category.upper()})'
                    )
                )

        self.stdout.write(
            self.style.SUCCESS(
                f'\n✓ Successfully recalculated points for {total_updated} results across {len(programs)} programs!'
            )
        )
