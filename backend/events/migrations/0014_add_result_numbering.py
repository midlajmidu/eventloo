# Generated manually to add result numbering system

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0013_add_judge3_marks'),
    ]

    operations = [
        migrations.AddField(
            model_name='programresult',
            name='result_number',
            field=models.IntegerField(blank=True, help_text='Sequential result number (Result No. 1, 2, 3, etc.)', null=True),
        ),
    ] 