# Generated by Django 4.2.7 on 2025-07-06 07:58

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0006_schoolsettings_first_place_points_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='user',
            name='student_id',
            field=models.CharField(blank=True, max_length=20, null=True),
        ),
        migrations.AddConstraint(
            model_name='user',
            constraint=models.UniqueConstraint(condition=models.Q(('role', 'student'), ('student_id__isnull', False)), fields=('student_id', 'category'), name='unique_student_id_per_category'),
        ),
    ]
