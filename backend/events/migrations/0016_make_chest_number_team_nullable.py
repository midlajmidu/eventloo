# Generated by Django 4.2.7 on 2025-07-05 15:24

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0015_make_team_event_optional'),
    ]

    operations = [
        migrations.AlterField(
            model_name='chestnumber',
            name='team',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='chest_numbers', to='events.team'),
        ),
    ]
