from django.db import migrations, models
from django.db.models import Count


def normalize_subteam_leaders(apps, schema_editor):
    Assignment = apps.get_model('events', 'ProgramAssignment')
    Result = apps.get_model('events', 'ProgramResult')
    groups = Assignment.objects.filter(
        program__is_team_based=True,
        team__isnull=False,
    ).values('program_id', 'team_id', 'sub_team_number').annotate(total=Count('id'))

    for group in groups.iterator():
        assignments = Assignment.objects.filter(
            program_id=group['program_id'],
            team_id=group['team_id'],
            sub_team_number=group['sub_team_number'],
        ).order_by('-is_leader', 'id')
        leader = assignments.first()
        if leader is None:
            continue
        assignments.exclude(pk=leader.pk).update(is_leader=False)
        if not leader.is_leader:
            Assignment.objects.filter(pk=leader.pk).update(is_leader=True)
        Result.objects.filter(
            program_id=group['program_id'],
            team_id=group['team_id'],
            sub_team_number=group['sub_team_number'],
            is_team_result=True,
        ).update(participant_id=leader.student_id)


class Migration(migrations.Migration):
    dependencies = [('events', '0039_alter_event_school_alter_pointsrecord_school_and_more')]

    operations = [
        migrations.RunPython(normalize_subteam_leaders, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name='programassignment',
            constraint=models.UniqueConstraint(
                fields=('program', 'team', 'sub_team_number'),
                condition=models.Q(is_leader=True),
                name='unique_group_subteam_leader',
            ),
        ),
    ]
