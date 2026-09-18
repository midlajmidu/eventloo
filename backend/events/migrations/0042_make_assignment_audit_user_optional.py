from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0018_remove_application_django_admin_flags'),
        ('events', '0041_cleanup_event_chest_numbers'),
    ]

    operations = [
        migrations.AlterField(
            model_name='programassignment',
            name='assigned_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='assigned_programs',
                to='accounts.user',
            ),
        ),
        migrations.AlterField(
            model_name='chestnumber',
            name='assigned_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='assigned_chest_numbers',
                to='accounts.user',
            ),
        ),
    ]
