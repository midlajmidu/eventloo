from django.db import migrations


def reconcile_event_chest_numbers(apps, schema_editor):
    ChestNumber = apps.get_model('events', 'ChestNumber')
    ProgramAssignment = apps.get_model('events', 'ProgramAssignment')

    assigned_pairs = set(
        ProgramAssignment.objects.values_list('program__event_id', 'student_id')
    )
    for chest in ChestNumber.objects.all().iterator():
        if (chest.event_id, chest.student_id) not in assigned_pairs:
            chest.delete()
            continue
        ProgramAssignment.objects.filter(
            program__event_id=chest.event_id,
            student_id=chest.student_id,
        ).update(chest_number=chest.chest_number)


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0040_enforce_subteam_leader'),
    ]

    operations = [
        migrations.RunPython(reconcile_event_chest_numbers, migrations.RunPython.noop),
    ]
