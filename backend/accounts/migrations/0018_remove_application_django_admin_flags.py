from django.db import migrations


def remove_application_admin_flags(apps, schema_editor):
    User = apps.get_model('accounts', 'User')
    User.objects.filter(
        role__in=['admin', 'event_manager', 'team_manager', 'student', 'super_admin']
    ).update(is_staff=False, is_superuser=False)


class Migration(migrations.Migration):
    dependencies = [('accounts', '0017_alter_user_chest_code_user_unique_school_chest_code')]

    operations = [migrations.RunPython(remove_application_admin_flags, migrations.RunPython.noop)]
