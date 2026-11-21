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

    # If the student is already assigned to this program, don't double count
    assigned_prog_ids = {a.program_id for a in standard_existing}
    if program.id in assigned_prog_ids:
        return

    cat_code = (student.category or '').strip()
    category_limits = event.category_participation_limits or {}

    # Look up category-specific limits if configured
    cat_limits = None
    if isinstance(category_limits, dict):
        cat_limits = category_limits.get(cat_code)
        if not cat_limits and cat_code:
            for k, v in category_limits.items():
                if str(k).strip().lower() == cat_code.lower():
                    cat_limits = v
                    break

    cat_label = f"category '{cat_code}'" if cat_code else "their category"

    # Distinct unique programs currently assigned
    unique_programs_map = {a.program_id: a.program for a in standard_existing}
    unique_programs = list(unique_programs_map.values())

    # 1. Check Total Programs Limit ("totally only this much")
    max_total = None
    if cat_limits and isinstance(cat_limits, dict) and 'max_total' in cat_limits:
        max_total = int(cat_limits.get('max_total') or 0)

    if max_total and max_total > 0 and len(unique_programs) >= max_total:
        raise ValidationError(
            f"{student.display_name} has reached the limit of {max_total} total programs for {cat_label}."
        )

    # 2. Check Program Type Limits (dynamically supports ANY type, including stage, off_stage, sports, etc.)
    p_type = getattr(program, 'program_type', None) or 'stage'
    p_type_norm = str(p_type).lower().replace(' ', '_').replace('-', '_')

    if cat_limits and isinstance(cat_limits, dict):
        raw_type_limits = cat_limits.get('type_limits')
        type_limits = raw_type_limits if isinstance(raw_type_limits, dict) else {}

        # Resolve limit for this specific type (checking type_limits or legacy max_onstage/max_offstage)
        max_type_limit = type_limits.get(p_type_norm)
        if max_type_limit is None:
            max_type_limit = type_limits.get(p_type)

        if max_type_limit is None:
            if p_type_norm in ('stage', 'onstage', 'on_stage'):
                max_type_limit = cat_limits.get('max_onstage')
            elif p_type_norm in ('off_stage', 'offstage'):
                max_type_limit = cat_limits.get('max_offstage')

        if max_type_limit is not None and int(max_type_limit or 0) > 0:
            allowed_max = int(max_type_limit)
            type_count = len([
                p for p in unique_programs
                if (getattr(p, 'program_type', None) or 'stage').lower().replace(' ', '_').replace('-', '_') == p_type_norm
            ])
            if type_count >= allowed_max:
                type_label = getattr(program, 'program_type_display', None) or p_type.replace('_', ' ').title()
                raise ValidationError(
                    f"{student.display_name} has reached the limit of {allowed_max} {type_label} programs for {cat_label}."
                )

    # 3. Check Single vs Group Limits
    if program.is_team_based:
        max_group = None
        if cat_limits and isinstance(cat_limits, dict) and 'max_group' in cat_limits:
            max_group = int(cat_limits.get('max_group') or 0)
        else:
            max_group = int(event.max_group_programs_per_student or 0)

        group_count = len([p for p in unique_programs if p.is_team_based])
        if max_group and max_group > 0 and group_count >= max_group:
            raise ValidationError(
                f"{student.display_name} has reached the limit of {max_group} group/team programs for {cat_label}."
            )
    else:
        max_single = None
        if cat_limits and isinstance(cat_limits, dict) and 'max_single' in cat_limits:
            max_single = int(cat_limits.get('max_single') or 0)
        else:
            max_single = int(event.max_single_programs_per_student or 0)

        single_count = len([p for p in unique_programs if not p.is_team_based])
        if max_single and max_single > 0 and single_count >= max_single:
            raise ValidationError(
                f"{student.display_name} has reached the limit of {max_single} single/individual programs for {cat_label}."
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
        max_size = program.team_size or 0
        if max_size < 1:
            raise ValidationError('Configure the team size limit before assigning this program.')
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
        if existing_count + len(students) > max_size:
            raise ValidationError(
                f'Sub-team {sub_team_number} can have at most {max_size} members for {program.name}. '
                f'Currently has {existing_count}; adding {len(students)} exceeds the maximum capacity.'
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
        sub_team_number = 1
        leader_id = None
        if team and program.max_participants:
            assigned_count = ProgramAssignment.objects.select_for_update().filter(
                program=program,
                team=team,
            ).count()
            if assigned_count + len(students) > program.max_participants:
                max_p = program.max_participants
                remaining = max(0, max_p - assigned_count)
                raise ValidationError(
                    f'{team.name} can only add {remaining} more participant(s) for {program.name} (Max: {max_p}).'
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
        if complete_subteam.exists():
            representative = complete_subteam.filter(is_leader=True).first()
            representative = representative or complete_subteam.first()
            # Remove any legacy un-scored individual draft results for this team/program
            ProgramResult.objects.filter(
                program=program,
                team=team,
                is_team_result=False,
                total_marks__isnull=True,
                raw_total_marks__isnull=True,
                average_marks__isnull=True,
            ).delete()
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
        # Remove any legacy un-scored group draft results for this program without marks
        ProgramResult.objects.filter(
            program=program,
            is_team_result=True,
            total_marks__isnull=True,
            raw_total_marks__isnull=True,
            average_marks__isnull=True,
        ).delete()
        for assignment in assignments:
            ProgramResult.objects.get_or_create(
                program=program,
                participant=assignment.student,
                is_team_result=False,
                defaults={'team': team, 'entry_status': 'draft'},
            )
    ensure_program_code_letters(program)
    program.refresh_schedule_end()
    return assignments


@transaction.atomic
def remove_assignment_group(*, user, assignment, remove_whole_subteam=False):
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

    program = assignment.program
    team = assignment.team
    sub_team_number = assignment.sub_team_number or 1

    if program.is_team_based and remove_whole_subteam:
        ProgramResult.objects.filter(
            program=program,
            team=team,
            sub_team_number=sub_team_number,
            is_team_result=True,
        ).delete()
        queryset = ProgramAssignment.objects.filter(
            program=program,
            team=team,
            sub_team_number=sub_team_number,
        )
    elif program.is_team_based:
        remaining_subteam = ProgramAssignment.objects.filter(
            program=program,
            team=team,
            sub_team_number=sub_team_number,
        ).exclude(pk=assignment.pk)

        was_leader = assignment.is_leader
        queryset = ProgramAssignment.objects.filter(pk=assignment.pk)
        deleted, _ = queryset.delete()

        if remaining_subteam.exists():
            if was_leader:
                new_leader = remaining_subteam.first()
                remaining_subteam.filter(pk=new_leader.pk).update(is_leader=True)
                rep = new_leader.student
            else:
                leader = remaining_subteam.filter(is_leader=True).first()
                rep = leader.student if leader else remaining_subteam.first().student
            ProgramResult.objects.filter(
                program=program,
                team=team,
                sub_team_number=sub_team_number,
                is_team_result=True,
            ).update(participant=rep)
        else:
            ProgramResult.objects.filter(
                program=program,
                team=team,
                sub_team_number=sub_team_number,
                is_team_result=True,
            ).delete()

        program.refresh_schedule_end()
        recalculate_program_results(program)
        return deleted
    else:
        ProgramResult.objects.filter(
            program=program,
            participant=assignment.student,
            is_team_result=False,
        ).delete()
        queryset = ProgramAssignment.objects.filter(pk=assignment.pk)

    deleted, _ = queryset.delete()
    program.refresh_schedule_end()
    recalculate_program_results(program)
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

    # 1. Custom program placement points override
    if getattr(program, 'has_custom_points', False):
        if position == 1 and getattr(program, 'first_place_points', None) is not None:
            return int(program.first_place_points)
        elif position == 2 and getattr(program, 'second_place_points', None) is not None:
            return int(program.second_place_points)
        elif position == 3 and getattr(program, 'third_place_points', None) is not None:
            return int(program.third_place_points)
        elif position not in (1, 2, 3):
            if getattr(program, 'participation_points', None) is not None:
                return int(program.participation_points)
            return int(getattr(event, 'participation_points', 0) or 0)

    # 2. Standard event placement points matrix
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
        return '', 0
    converted_total = float(event.converted_total_mark or 100)
    if converted_total <= 0:
        return '', 0
    total_marks = float(result.total_marks or 0)
    score_percentage = (total_marks / converted_total) * 100 if converted_total > 0 else 0
    rules = sorted(
        event.get_effective_grading_rules(),
        key=lambda rule: float(rule.get('max_mark', 0)),
        reverse=True,
    )
    for rule in rules:
        minimum = float(rule.get('min_mark', 0))
        maximum = float(rule.get('max_mark', 100))
        # Match either by direct converted marks (e.g. 45 to 50 out of 50)
        # or by percentage (e.g. 90% to 100%)
        is_match = (minimum <= total_marks <= maximum) or (minimum <= score_percentage <= maximum)
        if is_match:
            grade = str(rule.get('name', '')).strip()
            # If program specifically configured a bonus override for this grade, use it;
            # otherwise fall back to event rule's bonus_points (or legacy points)
            configured = (result.program.grading_points or {}).get(grade)
            if configured is not None:
                bonus = int(configured or 0)
            else:
                bonus = int(rule.get('bonus_points', rule.get('points', 0)) or 0)
            return grade, max(0, bonus)
    return '', 0


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

    current_position = 0
    previous_score = None
    for result in results:
        score = result.total_marks
        if previous_score is None or score != previous_score:
            current_position += 1
        position = current_position
        grade, grade_bonus = _grade_for_result(result)
        placement_points = _position_points(program, position)
        bonus_points = grade_bonus or 0
        total_points = placement_points + bonus_points
        ProgramResult.objects.filter(pk=result.pk).update(
            position=position,
            points_earned=total_points,
            grade=grade,
            grade_extra_points=bonus_points,
        )
        previous_score = score

    rebuild_program_points(program)
    try:
        from django.core.cache import cache
        if getattr(program, 'event_id', None):
            cache.delete(f"public_portal_v2_{program.event_id}")
    except Exception:
        pass
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


def generate_code_sequence(count: int) -> list[str]:
    """
    Generates an alphabetical sequence for anonymous judging:
    1..26 -> 'A'..'Z'
    27..52 -> 'AA'..'AZ'
    53..78 -> 'BA'..'BZ', etc.
    """
    import string
    alphabet = string.ascii_uppercase
    codes = []
    for i in range(count):
        if i < 26:
            codes.append(alphabet[i])
        else:
            first = alphabet[(i // 26) - 1]
            second = alphabet[i % 26]
            codes.append(f"{first}{second}")
    return codes


@transaction.atomic
def reconcile_program_result_placeholders(program):
    """
    Safely reconciles ProgramResult placeholder rows so they strictly match the program's
    is_team_based configuration and active assignments without violating unique constraints.

    1. If program.is_team_based is True:
       - Removes legacy individual draft results (is_team_result=False) that have NO entered marks.
       - Gathers active (team_id, sub_team_number) pairs from ProgramAssignment.
       - Removes orphan group draft results (sub-teams that have NO assignments and NO entered marks).
       - For each active sub-team, ensures exactly ONE ProgramResult row (with is_team_result=True) exists.
       - If redundant duplicate draft rows exist for the same (program, team_id, sub_team_number),
         cleans up the un-scored duplicates.
    2. If program.is_team_based is False:
       - Removes legacy group draft results (is_team_result=True) that have NO entered marks.
       - Gathers active student_ids from ProgramAssignment.
       - Removes orphan individual draft results for students who are no longer assigned and have no marks.
       - For each active student, ensures exactly ONE ProgramResult row (with is_team_result=False) exists.
    """
    if not program:
        return

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
        assignments = ProgramAssignment.objects.filter(program=program).select_related('student', 'team')
        active_subteams = set()
        for a in assignments:
            if a.team_id:
                active_subteams.add((a.team_id, getattr(a, 'sub_team_number', 1) or 1))

        # 3. Clean orphan draft results without assignments and without marks
        existing_results = list(ProgramResult.objects.filter(program=program, is_team_result=True))
        for res in existing_results:
            key = (res.team_id, res.sub_team_number or 1)
            if key not in active_subteams and not res.has_marks():
                res.delete()

        # 4. Ensure exactly one group result exists per active sub-team
        for team_id, sub_team_num in active_subteams:
            rep = ProgramAssignment.objects.filter(
                program=program, team_id=team_id, sub_team_number=sub_team_num, is_leader=True
            ).first()
            if not rep:
                rep = ProgramAssignment.objects.filter(
                    program=program, team_id=team_id, sub_team_number=sub_team_num
                ).first()
            if not rep or not rep.student_id:
                continue

            matching = list(ProgramResult.objects.filter(
                program=program,
                team_id=team_id,
                sub_team_number=sub_team_num,
                is_team_result=True,
            ).order_by('id'))

            if not matching:
                ProgramResult.objects.create(
                    program=program,
                    team_id=team_id,
                    sub_team_number=sub_team_num,
                    is_team_result=True,
                    participant=rep.student,
                    entry_status='draft',
                )
            else:
                primary = matching[0]
                if len(matching) > 1:
                    for extra in matching[1:]:
                        if not extra.has_marks():
                            extra.delete()
                        elif not primary.has_marks():
                            primary.delete()
                            primary = extra
                if primary.participant_id != rep.student_id and not primary.has_marks():
                    primary.participant = rep.student
                    primary.save(update_fields=['participant'])
    else:
        # 1. Clean legacy group draft results with no entered marks
        ProgramResult.objects.filter(
            program=program,
            is_team_result=True,
            total_marks__isnull=True,
            raw_total_marks__isnull=True,
            average_marks__isnull=True,
        ).delete()

        # 2. Gather active students
        assignments = ProgramAssignment.objects.filter(program=program).select_related('student', 'team')
        active_student_ids = set(a.student_id for a in assignments if a.student_id)

        # 3. Clean orphan draft results without assignments and without marks
        existing_results = list(ProgramResult.objects.filter(program=program, is_team_result=False))
        for res in existing_results:
            if res.participant_id not in active_student_ids and not res.has_marks():
                res.delete()

        # 4. Ensure exactly one individual result exists per assigned student
        for a in assignments:
            if not a.student_id:
                continue
            matching = list(ProgramResult.objects.filter(
                program=program,
                participant_id=a.student_id,
                is_team_result=False,
            ).order_by('id'))

            if not matching:
                ProgramResult.objects.create(
                    program=program,
                    participant=a.student,
                    team=a.team,
                    is_team_result=False,
                    entry_status='draft',
                )
            elif len(matching) > 1:
                primary = matching[0]
                for extra in matching[1:]:
                    if not extra.has_marks():
                        extra.delete()
                    elif not primary.has_marks():
                        primary.delete()
                        primary = extra


@transaction.atomic
def shuffle_program_code_letters(program, force=False):
    """
    Generates and shuffles secret code letters (A, B, C...) for all competing
    participants or sub-teams in a program and saves them to ProgramResult.
    Raises ValidationError if marks have already been submitted and force is False.
    """
    from django.core.exceptions import ValidationError
    import random

    if not program:
        return []

    # Check if marks have already been submitted
    has_submitted_marks = program.results.filter(
        entry_status='submitted',
        average_marks__isnull=False,
    ).exists()

    if has_submitted_marks and not force:
        raise ValidationError(
            f"Cannot re-shuffle code letters for '{program.name}' because marks have already been submitted. "
            "Clear marks first if you wish to re-evaluate."
        )

    # Reconcile placeholders to prevent individual vs group collisions
    reconcile_program_result_placeholders(program)

    if not program.is_team_based:
        results = list(ProgramResult.objects.select_for_update().filter(program=program, is_team_result=False).order_by('id'))
    else:
        results = list(ProgramResult.objects.select_for_update().filter(program=program, is_team_result=True).order_by('id'))

    if not results:
        return []

    # Generate sequence and shuffle cryptographically
    codes = generate_code_sequence(len(results))
    rng = random.SystemRandom()
    rng.shuffle(codes)

    sequential_seq = generate_code_sequence(len(results))
    attempts = 0
    while len(codes) > 1 and attempts < 100:
        if len(codes) == 2:
            if codes == ['A', 'B']:
                codes = ['B', 'A']
            break
        orderly_check = (codes == sequential_seq) or (codes[0] == 'A' and codes[1] == 'B') or (codes == sorted(codes))
        if not orderly_check:
            break
        rng.shuffle(codes)
        attempts += 1

    if len(codes) == 2 and codes == ['A', 'B']:
        codes = ['B', 'A']

    for result, code in zip(results, codes):
        result.code_letter = code
        result.save(update_fields=['code_letter'])

    return results


@transaction.atomic
def ensure_program_code_letters(program, force=False):
    """
    Ensures that every assigned participant or group sub-team in a program
    has a pre-assigned, uniquely shuffled secret code letter (A, B, C...).
    Guarantees that code letters are NEVER orderly (e.g. participant 1 getting A, participant 2 getting B, etc.).
    If there are N participants (e.g. 6), letters A, B, C, D, E, F are shuffled by system and distributed randomly.
    If marks have already been submitted, existing code letters are strictly preserved unless force=True.
    """
    import random

    if not program:
        return []

    # Check if marks are already submitted or published
    has_submitted_marks = program.results.filter(
        entry_status='submitted',
        average_marks__isnull=False,
    ).exists() or program.is_published

    # 1. Reconcile placeholders to strictly match program mode and assignments
    reconcile_program_result_placeholders(program)

    if not program.is_team_based:
        results = list(ProgramResult.objects.select_for_update().filter(program=program, is_team_result=False).order_by('id'))
    else:
        results = list(ProgramResult.objects.select_for_update().filter(program=program, is_team_result=True).order_by('id'))

    if not results:
        return []

    # If marks have already been submitted and not forced, preserve existing codes
    if has_submitted_marks and not force:
        missing_results = [r for r in results if not (r.code_letter or '').strip()]
        if not missing_results:
            return results
        existing_codes = set((r.code_letter or '').strip().upper() for r in results if (r.code_letter or '').strip())
        candidate_codes = generate_code_sequence(len(results) + len(existing_codes) + 5)
        available_codes = [c for c in candidate_codes if c not in existing_codes]
        rng = random.SystemRandom()
        rng.shuffle(available_codes)
        for result, code in zip(missing_results, available_codes[:len(missing_results)]):
            result.code_letter = code
            result.save(update_fields=['code_letter'])
        return results

    # If marks have NOT been submitted (or force=True):
    # Check whether existing codes are complete, valid AND NOT orderly
    current_codes = [(r.code_letter or '').strip().upper() for r in results]
    sequential_seq = generate_code_sequence(len(results))

    any_empty = any(not c for c in current_codes)
    has_duplicates = len(set(current_codes)) != len(current_codes)
    # Check if codes match the exact alphabetical sequence [A, B, C...] or are sorted ascending
    is_orderly = (
        len(results) > 1 and (
            current_codes == sequential_seq or
            current_codes == sorted(current_codes) or
            (len(results) > 2 and current_codes[0] == 'A' and current_codes[1] == 'B')
        )
    )

    # If all participants have unique codes and they are already properly shuffled (not orderly), keep them stable
    if not any_empty and not has_duplicates and not is_orderly and not force:
        return results

    # Otherwise, generate full sequence (A, B, C...) and cryptographically shuffle it!
    codes = generate_code_sequence(len(results))
    rng = random.SystemRandom()
    rng.shuffle(codes)

    # Strictly guarantee that for len(results) > 1, the shuffled sequence is NEVER orderly:
    # 1. Not in exact alphabetical order (A, B, C, D...)
    # 2. Not starting with ['A', 'B']
    attempts = 0
    while len(codes) > 1 and attempts < 100:
        if len(codes) == 2:
            if codes == ['A', 'B']:
                codes = ['B', 'A']
            break
        orderly_check = (codes == sequential_seq) or (codes[0] == 'A' and codes[1] == 'B') or (codes == sorted(codes))
        if not orderly_check:
            break
        rng.shuffle(codes)
        attempts += 1

    if len(codes) == 2 and codes == ['A', 'B']:
        codes = ['B', 'A']

    for result, code in zip(results, codes):
        result.code_letter = code
        result.save(update_fields=['code_letter'])

    return results

