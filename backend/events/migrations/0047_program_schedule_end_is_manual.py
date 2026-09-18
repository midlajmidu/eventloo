from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('events', '0046_program_duration_minutes_per_entry'),
    ]

    operations = [
        migrations.AddField(
            model_name='program',
            name='schedule_end_is_manual',
            field=models.BooleanField(
                default=False,
                help_text='Preserve an administrator-confirmed ending time when assignments change.',
            ),
        ),
    ]
