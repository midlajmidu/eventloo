from django.db import migrations, models


def remove_legacy_event_bonus_points(apps, schema_editor):
    Event = apps.get_model('events', 'Event')
    for event in Event.objects.exclude(grading_rules=[]).iterator():
        rules = event.grading_rules
        if not isinstance(rules, list):
            continue
        cleaned = []
        for rule in rules:
            if not isinstance(rule, dict):
                continue
            cleaned.append({
                'name': rule.get('name', ''),
                'min_mark': rule.get('min_mark'),
                'max_mark': rule.get('max_mark'),
            })
        Event.objects.filter(pk=event.pk).update(grading_rules=cleaned)


class Migration(migrations.Migration):
    dependencies = [
        ('events', '0043_event_general_individual_student_points'),
    ]

    operations = [
        migrations.AddField(
            model_name='program',
            name='grading_points',
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text=(
                    "Optional absolute points by event grade name, for example "
                    "{'A+': 10, 'A': 8}. Missing grades use placement points."
                ),
            ),
        ),
        migrations.AlterField(
            model_name='event',
            name='grading_rules',
            field=models.JSONField(
                blank=True,
                default=list,
                help_text="Grade percentage bands e.g. [{name:'A+', min_mark:90, max_mark:100}]",
            ),
        ),
        migrations.AlterField(
            model_name='programresult',
            name='grade_extra_points',
            field=models.IntegerField(
                default=0,
                help_text=(
                    'Absolute grade points awarded; retained under the legacy '
                    'field name for API compatibility'
                ),
            ),
        ),
        migrations.RunPython(remove_legacy_event_bonus_points, migrations.RunPython.noop),
    ]
