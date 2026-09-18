from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('accounts', '0020_user_mfa')]

    operations = [
        migrations.AddConstraint(
            model_name='user',
            constraint=models.CheckConstraint(
                condition=(
                    models.Q(role='super_admin', school__isnull=True)
                    | (~models.Q(role='super_admin') & models.Q(school__isnull=False))
                ),
                name='user_role_requires_correct_school_scope',
            ),
        ),
    ]
