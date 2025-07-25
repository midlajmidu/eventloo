# Generated manually to remove captain field from Team model

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0017_team_team_number'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='team',
            name='captain',
        ),
    ] 