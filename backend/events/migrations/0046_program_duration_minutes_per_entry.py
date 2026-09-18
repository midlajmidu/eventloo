from django.db import migrations, models
import django.core.validators


class Migration(migrations.Migration):
    dependencies = [
        ('events', '0045_event_stages'),
    ]

    operations = [
        migrations.AddField(
            model_name='program',
            name='duration_minutes_per_entry',
            field=models.PositiveIntegerField(
                default=5,
                help_text='Minutes required for one participant or one group.',
                validators=[django.core.validators.MinValueValidator(1)],
            ),
        ),
    ]
