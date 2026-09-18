from django.db import migrations, models
import django.core.validators
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ('events', '0044_program_grading_points'),
    ]

    operations = [
        migrations.CreateModel(
            name='EventStage',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('number', models.PositiveIntegerField(validators=[django.core.validators.MinValueValidator(1)])),
                ('name', models.CharField(blank=True, max_length=200)),
                ('capacity', models.PositiveIntegerField(blank=True, null=True, validators=[django.core.validators.MinValueValidator(1)])),
                ('map_link', models.URLField(blank=True, max_length=500)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('event', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='stages', to='events.event')),
            ],
            options={'ordering': ['number', 'name']},
        ),
        migrations.AddField(
            model_name='program',
            name='stage',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='programs', to='events.eventstage'),
        ),
        migrations.AddConstraint(
            model_name='eventstage',
            constraint=models.UniqueConstraint(fields=('event', 'number'), name='unique_stage_number_per_event'),
        ),
    ]
