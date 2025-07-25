# Generated by Django 4.2.7 on 2025-07-23 04:07

from django.db import migrations, models


def update_open_to_general(apps, schema_editor):
    """Update existing 'open' category values to 'general'"""
    Program = apps.get_model('events', 'Program')
    Program.objects.filter(category='open').update(category='general')


def reverse_update_open_to_general(apps, schema_editor):
    """Reverse: update 'general' category values back to 'open'"""
    Program = apps.get_model('events', 'Program')
    Program.objects.filter(category='general').update(category='open')


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0022_program_program_type'),
    ]

    operations = [
        # Data migration to update existing 'open' values to 'general'
        migrations.RunPython(update_open_to_general, reverse_update_open_to_general),
        
        # Schema migration to update the field choices
        migrations.AlterField(
            model_name='program',
            name='category',
            field=models.CharField(choices=[('hs', 'High School'), ('hss', 'Higher Secondary School'), ('general', 'General')], default='general', max_length=10),
        ),
    ]
