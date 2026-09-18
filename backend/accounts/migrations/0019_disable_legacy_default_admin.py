from django.contrib.auth.hashers import check_password, make_password
from django.db import migrations


LEGACY_EMAIL = 'admin@eventloo.com'
LEGACY_PASSWORD = 'admin123'


def disable_legacy_default_admin(apps, schema_editor):
    User = apps.get_model('accounts', 'User')
    for user in User.objects.filter(email__iexact=LEGACY_EMAIL):
        if check_password(LEGACY_PASSWORD, user.password):
            user.password = make_password(None)
            user.is_active = False
            user.save(update_fields=['password', 'is_active'])


class Migration(migrations.Migration):
    dependencies = [('accounts', '0018_remove_application_django_admin_flags')]

    operations = [migrations.RunPython(disable_legacy_default_admin, migrations.RunPython.noop)]
