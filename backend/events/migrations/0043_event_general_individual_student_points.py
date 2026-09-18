from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0042_make_assignment_audit_user_optional'),
    ]

    operations = [
        migrations.AddField(
            model_name='event',
            name='count_general_individual_points_for_students',
            field=models.BooleanField(
                default=False,
                help_text=(
                    "When enabled, Mixed/General individual program points contribute to "
                    "the participant's personal and top-scorer totals. Team points are always retained."
                ),
            ),
        ),
    ]
