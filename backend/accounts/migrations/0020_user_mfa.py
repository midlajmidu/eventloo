from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('accounts', '0019_disable_legacy_default_admin')]

    operations = [
        migrations.AddField(
            model_name='user', name='mfa_secret',
            field=models.CharField(blank=True, default='', max_length=64),
        ),
        migrations.AddField(
            model_name='user', name='mfa_enabled',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='user', name='mfa_last_used_step',
            field=models.BigIntegerField(blank=True, null=True),
        ),
    ]
