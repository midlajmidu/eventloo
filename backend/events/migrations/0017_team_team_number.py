# Generated by Django 4.2.7 on 2025-07-10 06:33

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0016_make_chest_number_team_nullable'),
    ]

    operations = [
        migrations.AddField(
            model_name='team',
            name='team_number',
            field=models.PositiveIntegerField(blank=True, null=True, unique=True),
        ),
    ]
