from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from accounts.models import StudentCategory, User
from .models import Event, PointsRecord, Program, ProgramAssignment, ProgramResult, Team


GENERAL_CATEGORY_ALIASES = {'general', 'gen', 'gn', 'open', 'open category'}


def program_is_general_or_mixed(program):
    """Return whether a program uses a tenant-defined mixed/general category."""
    code = (program.category or '').strip().lower()
    if code in GENERAL_CATEGORY_ALIASES:
        return True
    return StudentCategory.objects.filter(
        school_id=program.event.school_id,
        code__iexact=program.category,
        is_mixing=True,
    ).exists()


def program_points_count_for_student(program):
    """Apply the event policy for personal scoring without changing team points."""
    if program.is_team_based or not program_is_general_or_mixed(program):
        return True
    return bool(program.event.count_general_individual_points_for_students)


def calculate_global_points_for_school(school):
    """Return the single canonical percentage leaderboard for one school.

    Each published event contributes the recipient's share of that event's
    official points. Draft/unpublished rows never affect either numerator or
    denominator, and event primary keys (rather than titles) define boundaries.
    """
    events = Event.objects.filter(
        school=school,
        programs__results__entry_status='submitted',
        programs__is_published=True,
    ).distinct()
    team_totals = {}
    student_totals = {}

    for event in events:
        results = list(ProgramResult.objects.filter(
            program__event=event,
            program__is_published=True,
            entry_status='submitted',
            points_earned__gt=0,
        ).select_related('participant', 'team', 'program'))
        total_event_points = sum(result.points_earned for result in results)
        if total_event_points <= 0:
            continue

        teams_for_event = {}
        students_for_event = {}
        for result in results:
            if result.team_id:
                teams_for_event[result.team_id] = (
                    teams_for_event.get(result.team_id, 0) + result.points_earned
                )
            if (
                not result.program.is_team_based
                and result.participant_id
                and program_points_count_for_student(result.program)
            ):
                students_for_event[result.participant_id] = (
                    students_for_event.get(result.participant_id, 0) + result.points_earned
                )

        for team_id, points in teams_for_event.items():
            percentage = points / total_event_points * 100
            entry = team_totals.setdefault(team_id, {
                'global_points': 0,
                'events_participated': 0,
                'event_breakdown': [],
            })
            entry['global_points'] += percentage
            entry['events_participated'] += 1
            entry['event_breakdown'].append({
                'event_id': event.id,
                'event_name': event.title,
                'event_points': points,
                'total_event_points': total_event_points,
                'percentage': round(percentage, 2),
            })

        for student_id, points in students_for_event.items():
            percentage = points / total_event_points * 100
            entry = student_totals.setdefault(student_id, {
                'global_points': 0,
                'events_participated': 0,
                'event_breakdown': [],
            })
            entry['global_points'] += percentage
            entry['events_participated'] += 1
            entry['event_breakdown'].append({
                'event_id': event.id,
                'event_name': event.title,
                'event_points': points,
                'total_event_points': total_event_points,
                'percentage': round(percentage, 2),
            })

    teams = {team.id: team for team in Team.objects.filter(
        school=school, id__in=team_totals,
    )}
    students = {student.id: student for student in User.objects.filter(
        school=school, role='student', id__in=student_totals,
    )}
    return {
        'teams': [{
            'id': team_id,
            'name': teams[team_id].name,
            'global_points': round(data['global_points'], 2),
            'members': teams[team_id].member_count,
            'events_participated': data['events_participated'],
            'event_breakdown': data['event_breakdown'],
        } for team_id, data in team_totals.items() if team_id in teams],
        'students': [{
            'id': student_id,
            'name': students[student_id].display_name,
            'student_id': students[student_id].student_id,
            'global_points': round(data['global_points'], 2),
            'category': str(students[student_id].category or '').upper() or 'N/A',
            'events_participated': data['events_participated'],
            'event_breakdown': data['event_breakdown'],
        } for student_id, data in student_totals.items() if student_id in students],
    }


def is_registration_admin(user):
    return bool(
        user
        and getattr(user, 'is_authenticated', False)
        and (
            getattr(user, 'is_superuser', False)
            or getattr(user, 'role', None) in ('admin', 'event_manager')
        )
    )


def ensure_registration_modifiable(user, event):
    if not is_registration_admin(user) and event.status not in ('published', 'ongoing'):
        raise ValidationError(
            'Registration is available only while the event is published or ongoing.'
        )
    if (
        event.registration_deadline
        and timezone.now() > event.registration_deadline
        and not is_registration_admin(user)
    ):
        deadline = timezone.localtime(event.registration_deadline).strftime('%d-%m-%Y %I:%M %p')
        raise ValidationError(
            f'The registration deadline has passed ({deadline}). '
            'This event is now read-only for team managers.'
        )


def category_is_compatible(student, program):
    code = (program.category or '').lower()
    if code in ('general', 'gen', 'gn', 'open'):
        return True
    try:
        category = StudentCategory.objects.get(code=program.category, school=program.event.school)
    except StudentCategory.DoesNotExist:
        return (student.category or '').lower() == code
    if category.is_mixing:
        allowed = set(category.mixed_categories.values_list('code', flat=True))
        return not allowed or student.category in allowed
    return student.category == category.code


def _check_student_limits(student, program):
    # General and combined/mixing category programs are unlimited for all students
    if program_is_general_or_mixed(program):
        return

    event = program.event
    existing = ProgramAssignment.objects.filter(
        student=student,
        program__event=event,
    ).select_related('program')

    # Exclude general and mixed programs from standard category participation limits
    standard_existing = [
        assignment for assignment in existing
        if not program_is_general_or_mixed(assignment.program)
    ]

    if program.is_team_based:
        limit = event.max_group_programs_per_student
        count = len({a.program_id for a in standard_existing if a.program.is_team_based})
        label = 'group/team'
    else:
        limit = event.max_single_programs_per_student
        count = len({a.program_id for a in standard_existing if not a.program.is_team_based})
        label = 'single/individual'
    if limit and count >= limit:
        raise ValidationError(
            f'{student.display_name} has reached the limit of {limit} {label} programs for their category.'
        )


@transaction.atomic
def assign_students(
    *, user, team, program, student_ids, sub_team_number=1, leader_id=None,
    allow_partial_group=False,
):
    """The single authoritative assignment path for admin and team-manager flows."""
    ensure_registration_modifiable(user, program.event)
    school_id = program.event.school_id
    principal_school_id = getattr(user, 'school_id', None)
    if principal_school_id != school_id:
        raise ValidationError('This program does not belong to your school.')
    if team and team.school_id != school_id:
        raise ValidationError('The selected team does not belong to this school.')
    if team and getattr(user, 'role', None) == 'team_manager':
        token_team_id = getattr(user, 'team_id', None)
        manages_team = (
            token_team_id == team.id
            if token_team_id is not None
            else bool(getattr(user, 'pk', None) and team.team_manager_id == user.pk)
        )
        if not manages_team:
            raise ValidationError('You can manage only your assigned team.')

    unique_ids = list(dict.fromkeys(int(value) for value in student_ids))
    if not unique_ids:
        raise ValidationError('Select at least one participant.')

    students = list(User.objects.filter(id__in=unique_ids, role='student', school_id=school_id))
    if len(students) != len(unique_ids):
        raise ValidationError('One or more selected participants do not exist.')
    students_by_id = {student.id: student for student in students}
    students = [students_by_id[student_id] for student_id in unique_ids]

    if team:
        member_ids = set(team.members.filter(id__in=unique_ids).values_list('id', flat=True))
        missing = [student.display_name for student in students if student.id not in member_ids]
        if missing:
            raise ValidationError(f"These participants do not belong to {team.name}: {', '.join(missing)}")

    for student in students:
        if not category_is_compatible(student, program):
            raise ValidationError(
                f'{student.display_name} is not eligible for the {program.category} category.'
            )
        if ProgramAssignment.objects.filter(program=program, student=student).exists():
            raise ValidationError(f'{student.display_name} is already assigned to this program.')
        _check_student_limits(student, program)

    try:
        sub_team_number = int(sub_team_number or 1)
    except (TypeError, ValueError) as exc:
        raise ValidationError('Sub-team number must be a positive integer.') from exc
    if sub_team_number < 1:
        raise ValidationError('Sub-team number must be at least 1.')

    if program.is_team_based:
        if not team:
            raise ValidationError('A team is required for a group program.')
        required_size = program.team_size or 0
        if required_size < 1:
            raise ValidationError('Configure the exact team size before assigning this program.')
        max_subteams = program.max_teams_per_school or 1
        if sub_team_number > max_subteams:
            raise ValidationError(
                f'Sub-team {sub_team_number} exceeds the configured maximum of {max_subteams}.'
            )
        existing_subteam = ProgramAssignment.objects.select_for_update().filter(
            program=program,
            team=team,
            sub_team_number=sub_team_number,
        )
        existing_count = existing_subteam.count()
        if allow_partial_group:
            if existing_count + len(students) > required_size:
                raise ValidationError(
                    f'Sub-team {sub_team_number} is full. {program.name} allows exactly '
                    f'{required_size} members.'
                )
        elif len(students) != required_size:
            raise ValidationError(
                f'{program.name} requires exactly {required_size} members; {len(students)} were selected.'
            )
        elif existing_count:
            raise ValidationError(
                f'Sub-team {sub_team_number} already exists for {team.name}. Remove it before replacing it.'
            )
        if program.max_participants_per_team:
            assigned_count = ProgramAssignment.objects.select_for_update().filter(
                program=program,
                team=team,
            ).count()
            if assigned_count + len(students) > program.max_participants_per_team:
                raise ValidationError(
                    f'{team.name} cannot exceed {program.max_participants_per_team} participants '
                    f'for this program.'
                )
        existing_student_ids = set(existing_subteam.values_list('student_id', flat=True))
        if leader_id is not None and int(leader_id) not in set(unique_ids) | existing_student_ids:
            raise ValidationError('The selected leader must be a member of this sub-team.')
        has_existing_leader = existing_subteam.filter(is_leader=True).exists()
        if leader_id is not None:
            leader_id = int(leader_id)
            existing_subteam.update(is_leader=False)
        elif has_existing_leader:
            leader_id = None
        else:
            leader_id = unique_ids[0]
    else:
        if len(students) != 1:
            raise ValidationError('An individual program accepts one participant per assignment.')
        sub_team_number = 1
        leader_id = None
        if team and program.max_participants:
            assigned_count = ProgramAssignment.objects.select_for_update().filter(
                program=program,
                team=team,
            ).count()
            if assigned_count + 1 > program.max_participants:
                raise ValidationError(
                    f'{team.name} has reached the limit of {program.max_participants} participants for this program.'
                )

    assigned_by = user if getattr(user, 'pk', None) else None
    assignments = []
    for student in students:
        assignments.append(ProgramAssignment.objects.create(
            program=program,
            student=student,
            team=team,
            sub_team_number=sub_team_number,
            is_leader=program.is_team_based and student.id == leader_id,
            assigned_by=assigned_by,
        ))
    if program.is_team_based:
        if leader_id is not None:
            ProgramAssignment.objects.filter(
                program=program, team=team, sub_team_number=sub_team_number,
            ).update(is_leader=False)
            ProgramAssignment.objects.filter(
                program=program, team=team, sub_team_number=sub_team_number,
                student_id=leader_id,
            ).update(is_leader=True)
        complete_subteam = ProgramAssignment.objects.filter(
            program=program, team=team, sub_team_number=sub_team_number,
        ).select_related('student')
        if complete_subteam.count() == required_size:
            representative = complete_subteam.filter(is_leader=True).first()
            representative = representative or complete_subteam.first()
            ProgramResult.objects.update_or_create(
                program=program,
                team=team,
                sub_team_number=sub_team_number,
                is_team_result=True,
                defaults={
                    'participant': representative.student,
                    'entry_status': 'draft',
                },
            )
        else:
            ProgramResult.objects.filter(
                program=program,
                team=team,
                sub_team_number=sub_team_number,
                is_team_result=True,
            ).delete()
    else:
        assignment = assignments[0]
        ProgramResult.objects.get_or_create(
            program=program,
            participant=assignment.student,
            is_team_result=False,
            defaults={'team': team, 'entry_status': 'draft'},
        )
    program.refresh_schedule_end()
    return assignments


@transaction.atomic
def remove_assignment_group(*, user, assignment):
    ensure_registration_modifiable(user, assignment.program.event)
    if getattr(user, 'school_id', None) != assignment.program.event.school_id:
        raise ValidationError('This assignment does not belong to your school.')
    if getattr(user, 'role', None) == 'team_manager':
        token_team_id = getattr(user, 'team_id', None)
        manages_team = (
            token_team_id == assignment.team_id
            if token_team_id is not None
            else bool(
                getattr(user, 'pk', None)
                and assignment.team_id
                and assignment.team.team_manager_id == user.pk
            )
        )
        if not manages_team:
            raise ValidationError('You can manage only your assigned team.')
    if assignment.program.is_team_based:
        ProgramResult.objects.filter(
            program=assignment.program,
            team=assignment.team,
            sub_team_number=assignment.sub_team_number or 1,
            is_team_result=True,
        ).delete()
        queryset = ProgramAssignment.objects.filter(
            program=assignment.program,
            team=assignment.team,
            sub_team_number=assignment.sub_team_number or 1,
        )
    else:
        ProgramResult.objects.filter(
            program=assignment.program,
            participant=assignment.student,
            is_team_result=False,
        ).delete()
        queryset = ProgramAssignment.objects.filter(pk=assignment.pk)
    deleted, _ = queryset.delete()
    assignment.program.refresh_schedule_end()
    recalculate_program_results(assignment.program)
    return deleted


@transaction.atomic
def set_subteam_leader(*, user, team, program, student_id, sub_team_number=1):
    ensure_registration_modifiable(user, program.event)
    if getattr(user, 'school_id', None) != program.event.school_id:
        raise ValidationError('This program does not belong to your school.')
    if team.school_id != program.event.school_id:
        raise ValidationError('The selected team does not belong to this school.')
    token_team_id = getattr(user, 'team_id', None)
    if getattr(user, 'role', None) == 'team_manager' and token_team_id != team.id:
        raise ValidationError('You can manage only your assigned team.')
    assignments = ProgramAssignment.objects.select_for_update().filter(
        team=team,
        program=program,
        sub_team_number=sub_team_number or 1,
    )
    if not assignments.filter(student_id=student_id).exists():
        raise ValidationError('The selected participant is not assigned to this sub-team.')
    assignments.update(is_leader=False)
    assignments.filter(student_id=student_id).update(is_leader=True)
    ProgramResult.objects.filter(
        program=program,
        team=team,
        sub_team_number=sub_team_number or 1,
        is_team_result=True,
    ).update(participant_id=student_id)


def _position_points(program, position):
    event = getattr(program, 'event', None)

    if position not in (1, 2, 3):
        return int(getattr(event, 'participation_points', 0) or 0)

    try:
        category = StudentCategory.objects.get(code=program.category, school=program.event.school)
        is_mixing = category.is_mixing
    except StudentCategory.DoesNotExist:
        is_mixing = (program.category or '').lower() in ('general', 'gen', 'gn', 'open')

    prefix = 'mix' if is_mixing else 'std'
    mode = 'group' if program.is_team_based else 'ind'
    suffix = {1: 'first', 2: 'second', 3: 'third'}.get(position)
    field_name = f'{prefix}_{mode}_{suffix}'

    return int(getattr(event, field_name, 0) or 0)


def _grade_for_result(result):
    event = result.program.event
    if not event.enable_grading_system:
        return '', None
    converted_total = float(event.converted_total_mark or 100)
    if converted_total <= 0:
        return '', None
    score_percentage = (float(result.total_marks or 0) / converted_total) * 100
    rules = sorted(
        event.get_effective_grading_rules(),
        key=lambda rule: float(rule.get('max_mark', 0)),
        reverse=True,
    )
    for rule in rules:
        minimum = float(rule.get('min_mark', 0))
        maximum = float(rule.get('max_mark', 100))
        if minimum <= score_percentage <= maximum:
            grade = str(rule.get('name', '')).strip()
            configured = (result.program.grading_points or {}).get(grade)
            return grade, int(configured) if configured is not None else None
    return '', None


def _refresh_recipient_totals(team_ids=None, student_ids=None):
    team_ids = set(team_ids or [])
    student_ids = set(student_ids or [])
    for team in Team.objects.filter(id__in=team_ids):
        total = PointsRecord.objects.filter(team=team).aggregate(total=Sum('points'))['total'] or 0
        Team.objects.filter(pk=team.pk).update(points_earned=max(0, total))
    for student in User.objects.filter(id__in=student_ids):
        total = PointsRecord.objects.filter(student=student).aggregate(total=Sum('points'))['total'] or 0
        User.objects.filter(pk=student.pk).update(total_points=total)


@transaction.atomic
def rebuild_program_points(program):
    """Replace automatic records for a program; manual awards are never touched."""
    existing = PointsRecord.objects.filter(
        is_automatic=True,
        source_result__program=program,
    )
    affected_team_ids = set(existing.exclude(team__isnull=True).values_list('team_id', flat=True))
    affected_student_ids = set(existing.exclude(student__isnull=True).values_list('student_id', flat=True))
    existing.delete()

    if program.is_published:
        results = ProgramResult.objects.filter(
            program=program,
            entry_status='submitted',
            position__isnull=False,
        ).select_related('participant', 'team', 'program__event')
        for result in results:
            position_text = {
                1: 'Winner',
                2: 'Runner-up',
                3: '3rd place',
            }.get(result.position, f'{result.position}th place')
            point_type = {
                1: 'event_winner',
                2: 'event_runner_up',
            }.get(result.position, 'event_participation')
            common = {
                'event': program.event,
                'source_result': result,
                'is_automatic': True,
                'points': result.points_earned,
                'point_type': point_type,
                'reason': f'{program.name} - {position_text}',
                'awarded_by': program.event.created_by,
            }
            if result.team_id:
                PointsRecord.objects.create(
                    team=result.team,
                    description=f'Official team points for {program.name}.',
                    **common,
                )
                affected_team_ids.add(result.team_id)
            if program.is_team_based:
                member_ids = ProgramAssignment.objects.filter(
                    program=program,
                    team_id=result.team_id,
                    sub_team_number=result.sub_team_number or 1,
                ).values_list('student_id', flat=True).distinct()
                for student_id in member_ids:
                    PointsRecord.objects.create(
                        student_id=student_id,
                        description=f'Official group-member points for {program.name}.',
                        **common,
                    )
                    affected_student_ids.add(student_id)
            elif result.participant_id and program_points_count_for_student(program):
                PointsRecord.objects.create(
                    student=result.participant,
                    description=f'Official individual points for {program.name}.',
                    **common,
                )
                affected_student_ids.add(result.participant_id)

    _refresh_recipient_totals(affected_team_ids, affected_student_ids)


@transaction.atomic
def recalculate_program_results(program):
    """Calculate deterministic competition rankings and then rebuild official points."""
    ProgramResult.objects.filter(program=program, entry_status='draft').update(
        position=None,
        points_earned=0,
        grade='',
        grade_extra_points=0,
    )
    results = list(ProgramResult.objects.select_for_update().filter(
        program=program,
        entry_status='submitted',
        total_marks__isnull=False,
    ).order_by('-total_marks', '-raw_total_marks', 'id'))

    previous_score = None
    previous_position = None
    for index, result in enumerate(results, 1):
        score = result.total_marks
        position = previous_position if previous_score == score else index
        grade, grade_points = _grade_for_result(result)
        placement_points = _position_points(program, position)
        points = grade_points if grade_points is not None else placement_points
        ProgramResult.objects.filter(pk=result.pk).update(
            position=position,
            points_earned=points,
            grade=grade,
            grade_extra_points=grade_points or 0,
        )
        previous_score = score
        previous_position = position

    rebuild_program_points(program)
    return results


@transaction.atomic
def reconcile_all_official_points(school=None):
    """Remove legacy automatic result awards and rebuild published programs exactly once."""
    legacy = PointsRecord.objects.filter(
        is_automatic=False,
        point_type__in=('event_winner', 'event_runner_up', 'event_participation'),
    )
    if school is not None:
        legacy = legacy.filter(school=school)
    affected_team_ids = set(legacy.exclude(team__isnull=True).values_list('team_id', flat=True))
    affected_student_ids = set(legacy.exclude(student__isnull=True).values_list('student_id', flat=True))
    legacy.delete()
    program_ids = ProgramResult.objects.all()
    if school is not None:
        program_ids = program_ids.filter(program__event__school=school)
    for program in program_ids.values_list('program', flat=True).distinct():
        result = ProgramResult.objects.filter(program_id=program).select_related('program').first()
        if result:
            recalculate_program_results(result.program)
    _refresh_recipient_totals(affected_team_ids, affected_student_ids)


@transaction.atomic
def reconcile_event_official_points(event):
    """Recalculate only programs belonging to one changed event."""
    for program in Program.objects.filter(event=event).iterator():
        recalculate_program_results(program)


def program_results_complete(program):
    assignments = ProgramAssignment.objects.filter(program=program)
    if not assignments.exists():
        return False
    if program.is_team_based:
        expected = assignments.values('team_id', 'sub_team_number').distinct().count()
    else:
        expected = assignments.values('student_id').distinct().count()
    if expected == 0:
        return False
    submitted = ProgramResult.objects.filter(
        program=program,
        entry_status='submitted',
        average_marks__isnull=False,
    ).count()
    return submitted > 0
