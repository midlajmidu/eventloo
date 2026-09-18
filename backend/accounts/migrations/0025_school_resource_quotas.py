from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('accounts', '0024_user_gender'),
    ]

    operations = [
        migrations.AddField(
            model_name='school',
            name='max_events',
            field=models.PositiveIntegerField(
                blank=True,
                help_text='Maximum events this organization may create. Blank means unlimited.',
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='school',
            name='max_students',
            field=models.PositiveIntegerField(
                blank=True,
                help_text='Maximum student records this organization may create. Blank means unlimited.',
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='school',
            name='max_users',
            field=models.PositiveIntegerField(
                blank=True,
                help_text='Maximum non-student dashboard users. Blank means unlimited.',
                null=True,
            ),
        ),
    ]
