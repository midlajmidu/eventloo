from django.db import migrations


def sync_program_judges(apps, schema_editor):
    Event = apps.get_model('events', 'Event')
    ProgramResult = apps.get_model('events', 'ProgramResult')

    for event in Event.objects.all():
        if getattr(event, 'num_judges', None):
            for prog in event.programs.all():
                has_submitted_marks = ProgramResult.objects.filter(
                    program=prog,
                    average_marks__isnull=False
                ).exists()
                if not has_submitted_marks:
                    prog.num_judges = event.num_judges
                    prog.save(update_fields=['num_judges'])


def reverse_sync(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0057_event_enable_public_portal_event_public_about_text_and_more'),
    ]

    operations = [
        migrations.RunPython(sync_program_judges, reverse_sync),
    ]
