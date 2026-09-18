from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('accounts', '0022_tenant_scoped_school_logos')]

    operations = [
        migrations.AddField(
            model_name='user',
            name='session_version',
            field=models.PositiveIntegerField(default=1),
        ),
    ]
