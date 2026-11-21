from django.db import migrations


def reconcile_program_results(apps, schema_editor):
    Program = apps.get_model('events', 'Program')
    ProgramResult = apps.get_model('events', 'ProgramResult')
    ProgramAssignment = apps.get_model('events', 'ProgramAssignment')

    for program in Program.objects.all():
        if program.is_team_based:
            # 1. Clean legacy individual draft results with no entered marks
            ProgramResult.objects.filter(
                program=program,
                is_team_result=False,
                total_marks__isnull=True,
                raw_total_marks__isnull=True,
                average_marks__isnull=True,
            ).delete()

            # 2. Gather active sub-teams
            assignments = ProgramAssignment.objects.filter(program=program)
            active_subteams = set()
            for a in assignments:
                if a.team_id:
                    active_subteams.add((a.team_id, getattr(a, 'sub_team_number', 1) or 1))

            # 3. Clean orphan draft results without assignments and without marks
            for res in list(ProgramResult.objects.filter(program=program, is_team_result=True)):
                key = (res.team_id, res.sub_team_number or 1)
                has_marks = bool(
                    res.judge1_marks is not None or
                    res.judge2_marks is not None or
                    res.judge3_marks is not None or
                    res.judge4_marks is not None or
                    res.total_marks is not None
                )
                if key not in active_subteams and not has_marks:
                    res.delete()

            # 4. Deduplicate multiple draft results for the same sub-team
            for team_id, sub_num in active_subteams:
                matching = list(ProgramResult.objects.filter(
                    program=program,
                    team_id=team_id,
                    sub_team_number=sub_num,
                    is_team_result=True,
                ).order_by('id'))

                if len(matching) > 1:
                    primary = matching[0]
                    for extra in matching[1:]:
                        has_marks = bool(
                            extra.judge1_marks is not None or
                            extra.judge2_marks is not None or
                            extra.judge3_marks is not None or
                            extra.judge4_marks is not None or
                            extra.total_marks is not None
                        )
                        if not has_marks:
                            extra.delete()
        else:
            # 1. Clean legacy group draft results with no entered marks
            ProgramResult.objects.filter(
                program=program,
                is_team_result=True,
                total_marks__isnull=True,
                raw_total_marks__isnull=True,
                average_marks__isnull=True,
            ).delete()


def reverse_noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0059_program_judging_mode'),
    ]

    operations = [
        migrations.RunPython(reconcile_program_results, reverse_noop),
    ]

