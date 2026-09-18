import django.db.models.deletion
import events.certificate_config
import events.models
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0047_program_schedule_end_is_manual'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='CertificateTemplate',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('certificate_type', models.CharField(choices=[('first_place', '1st Place Certificate'), ('second_place', '2nd Place Certificate'), ('third_place', '3rd Place Certificate'), ('participation', 'Participation Certificate')], max_length=24)),
                ('background_image', models.ImageField(blank=True, upload_to=events.models.certificate_template_upload_to)),
                ('aspect_ratio', models.FloatField(default=1.3333333333333333)),
                ('natural_width', models.PositiveIntegerField(blank=True, null=True)),
                ('natural_height', models.PositiveIntegerField(blank=True, null=True)),
                ('fields', models.JSONField(default=events.certificate_config.default_certificate_fields)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('event', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='certificate_templates', to='events.event')),
                ('updated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='updated_certificate_templates', to=settings.AUTH_USER_MODEL)),
            ],
            options={'ordering': ['certificate_type']},
        ),
        migrations.AddConstraint(
            model_name='certificatetemplate',
            constraint=models.UniqueConstraint(fields=('event', 'certificate_type'), name='unique_event_certificate_template'),
        ),
    ]
