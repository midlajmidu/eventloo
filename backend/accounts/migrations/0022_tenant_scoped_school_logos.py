import accounts.models
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('accounts', '0021_user_role_school_scope')]

    operations = [
        migrations.AlterField(
            model_name='school', name='logo',
            field=models.ImageField(blank=True, null=True, upload_to=accounts.models.school_logo_upload_to),
        ),
        migrations.AlterField(
            model_name='schoolsettings', name='school_logo',
            field=models.ImageField(blank=True, null=True, upload_to=accounts.models.school_logo_upload_to),
        ),
    ]
