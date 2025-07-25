# Generated manually to fix remaining NOT NULL constraints

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0011_fix_event_time_fields'),
    ]

    operations = [
        migrations.AlterField(
            model_name='event',
            name='description',
            field=models.TextField(blank=True),
        ),
        migrations.AlterField(
            model_name='event',
            name='venue',
            field=models.CharField(max_length=200, blank=True),
        ),
        migrations.AlterField(
            model_name='event',
            name='max_participants',
            field=models.IntegerField(null=True, blank=True),
        ),
    ] 