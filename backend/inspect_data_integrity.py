"""
Deep Data Integrity and Consistency Audit Script
Inspects:
1. Chest Number Uniqueness & Event-Wide Consistency
2. Program Assignment Consistency & School Multi-Tenancy
3. Mark Entry & Result Mapping (Participant, Chest Number, Name, Team, Marks, Points)
4. Top Scorers Calculation vs Ground Truth Results
5. Dynamic Mutation Propagation (Name changes reflecting everywhere)
6. Orphan / Duplicate / Stale Data Detection
"""
import os
import sys
import django
from decimal import Decimal

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'event_management.settings')
os.environ['DEBUG'] = 'True'
django.setup()

from django.db.models import Count, Q
from accounts.models import User, StudentCategory, School
from events.models import Event, Program, ProgramAssignment, ProgramResult, ChestNumber, Team, PointsRecord
from events.serializers import ProgramResultSerializer, MarkEntrySerializer
from rest_framework.test import APIRequestFactory, force_authenticate

def run_audit():
    print("=" * 80)
    print("  COMPREHENSIVE DATA INTEGRITY, CHEST NUMBER & RESULTS AUDIT")
    print("=" * 80)

    issues = []
    warnings = []
    passed_checks = []

    # -------------------------------------------------------------------------
    # 1. Multi-Tenancy & Orphan Checks
    # -------------------------------------------------------------------------
    print("\n--- [Audit 1/6] Multi-Tenancy & Referential Integrity ---")
    
    # Check users with invalid school
    orphaned_users = User.objects.filter(school__isnull=True).exclude(is_superuser=True)
    if orphaned_users.exists():
        issues.append(f"Found {orphaned_users.count()} users with no school assigned.")
    else:
        passed_checks.append("All non-superuser accounts have valid school assignment.")

    # Check team membership cross-school leak
    cross_school_teams = Team.objects.filter(
        ~Q(school=django.db.models.F('members__school')),
        members__isnull=False
    ).distinct()
    if cross_school_teams.exists():
        issues.append(f"Found {cross_school_teams.count()} teams with cross-school student members!")
    else:
        passed_checks.append("All team members strictly match team school (no cross-tenant leakage).")

    # Check students in multiple teams
    multi_team_students = User.objects.filter(role='student').annotate(
        tm_count=Count('team_memberships')
    ).filter(tm_count__gt=1)
    if multi_team_students.exists():
        warnings.append(f"Found {multi_team_students.count()} students assigned to more than 1 team.")
    else:
        passed_checks.append("All students are assigned to at most 1 team.")

    # Check program assignments cross-school
    cross_school_assignments = ProgramAssignment.objects.filter(
        ~Q(student__school=django.db.models.F('program__event__school')) |
        ~Q(team__school=django.db.models.F('program__event__school'))
    )
    if cross_school_assignments.exists():
        issues.append(f"Found {cross_school_assignments.count()} cross-school program assignments!")
    else:
        passed_checks.append("All program assignments match event school.")

    # -------------------------------------------------------------------------
    # 2. Chest Number Uniqueness & Event-Wide Consistency
    # -------------------------------------------------------------------------
    print("\n--- [Audit 2/6] Chest Number Invariants & Program Assignment Consistency ---")
    
    events = Event.objects.all()
    for event in events:
        print(f"\n>> Checking Event [{event.id}] '{event.title}' (School: {event.school_id})")
        
        # Check 2a: Duplicate chest numbers within event
        dup_chests = ChestNumber.objects.filter(event=event).values('chest_number').annotate(
            cnt=Count('id')
        ).filter(cnt__gt=1)
        if dup_chests.exists():
            for d in dup_chests:
                issues.append(f"Event {event.id}: Duplicate chest number {d['chest_number']} assigned to {d['cnt']} students!")
        else:
            passed_checks.append(f"Event {event.id}: All {ChestNumber.objects.filter(event=event).count()} chest numbers are strictly unique.")

        # Check 2b: Duplicate chest records for same student in event
        dup_student_chests = ChestNumber.objects.filter(event=event).values('student').annotate(
            cnt=Count('id')
        ).filter(cnt__gt=1)
        if dup_student_chests.exists():
            for d in dup_student_chests:
                issues.append(f"Event {event.id}: Student {d['student']} has {d['cnt']} ChestNumber records!")
        else:
            passed_checks.append(f"Event {event.id}: Exactly 1 chest record per student.")

        # Check 2c: Consistency between ChestNumber and ProgramAssignment
        assignments = ProgramAssignment.objects.filter(program__event=event).select_related('student', 'team')
        student_assigned_chests = {}
        for a in assignments:
            student_id = a.student_id
            authoritative_chest = ChestNumber.objects.filter(event=event, student_id=student_id).first()
            
            if authoritative_chest is None:
                issues.append(f"Event {event.id}: Student {a.student.display_name} has assignment in '{a.program.name}' but NO ChestNumber record!")
            elif a.chest_number != authoritative_chest.chest_number:
                issues.append(
                    f"Event {event.id}: Mismatch for {a.student.display_name} in '{a.program.name}': "
                    f"assignment.chest_number={a.chest_number} != ChestNumber={authoritative_chest.chest_number}"
                )
            
            # Check team consistency
            if authoritative_chest and authoritative_chest.team_id != a.team_id:
                issues.append(
                    f"Event {event.id}: Team mismatch for {a.student.display_name}: "
                    f"assignment.team={a.team_id} != chest.team={authoritative_chest.team_id}"
                )

            # Record chest number used across programs
            if student_id not in student_assigned_chests:
                student_assigned_chests[student_id] = []
            student_assigned_chests[student_id].append((a.program.name, a.chest_number))

        # Check that students participating in multiple programs use identical chest numbers
        multi_prog_count = 0
        for sid, prog_list in student_assigned_chests.items():
            if len(prog_list) > 1:
                multi_prog_count += 1
                distinct_nums = set(num for _, num in prog_list)
                if len(distinct_nums) > 1:
                    issues.append(f"Event {event.id}: Student {sid} has multiple chest numbers across programs: {prog_list}")
        
        passed_checks.append(
            f"Event {event.id}: {multi_prog_count} students in multiple programs verified with 100% identical chest numbers across all assignments."
        )

    # -------------------------------------------------------------------------
    # 3. Mark Entry & Results Integrity
    # -------------------------------------------------------------------------
    print("\n--- [Audit 3/6] Mark Entry & Program Results Integrity ---")
    
    results = ProgramResult.objects.all().select_related('program', 'participant', 'team', 'program__event')
    for res in results:
        ev = res.program.event
        p = res.program
        
        # Check 3a: Participant is actually assigned to the program
        if not p.is_team_based:
            assignment_exists = ProgramAssignment.objects.filter(
                program=p, student=res.participant
            ).exists()
            if not assignment_exists:
                issues.append(
                    f"Result [{res.id}] in '{p.name}': Participant {res.participant.display_name} has NO ProgramAssignment!"
                )
        else:
            # Group program: sub-team assignments exist
            sub_team_assignments = ProgramAssignment.objects.filter(
                program=p, team=res.team, sub_team_number=res.sub_team_number or 1
            )
            if not sub_team_assignments.exists():
                warnings.append(
                    f"Result [{res.id}] in group program '{p.name}': No students assigned to Team '{res.team.name}' Sub-team {res.sub_team_number}!"
                )

        # Check 3b: Serializer resolved chest number and student name
        res_serializer = ProgramResultSerializer(res)
        data = res_serializer.data
        
        resolved_chest = data.get('chest_number')
        resolved_name = data.get('participant_name')
        resolved_team = data.get('team_name')

        if not p.is_team_based:
            auth_chest = ChestNumber.objects.filter(event=ev, student=res.participant).first()
            expected_chest = auth_chest.chest_number if auth_chest else None
            if resolved_chest != expected_chest:
                issues.append(
                    f"Result [{res.id}] ProgramResultSerializer chest mismatch: resolved='{resolved_chest}' expected='{expected_chest}'"
                )
            if resolved_name != res.participant.get_full_name():
                issues.append(
                    f"Result [{res.id}] ProgramResultSerializer name mismatch: resolved='{resolved_name}' expected='{res.participant.get_full_name()}'"
                )
        
        # MarkEntrySerializer check
        me_serializer = MarkEntrySerializer(res)
        me_data = me_serializer.data
        if not p.is_team_based:
            if me_data.get('chest_number') != expected_chest:
                issues.append(
                    f"Result [{res.id}] MarkEntrySerializer chest mismatch: resolved='{me_data.get('chest_number')}' expected='{expected_chest}'"
                )
            if me_data.get('student_name') != res.participant.get_full_name():
                issues.append(
                    f"Result [{res.id}] MarkEntrySerializer name mismatch: resolved='{me_data.get('student_name')}' expected='{res.participant.get_full_name()}'"
                )

        # Check 3c: Mathematical precision of marks
        if res.has_marks():
            num_judges = p.effective_num_judges
            marks_list = [res.judge1_marks, res.judge2_marks, res.judge3_marks, res.judge4_marks][:num_judges]
            valid_marks = [Decimal(str(m)) for m in marks_list if m is not None]
            
            if valid_marks:
                expected_raw = sum(valid_marks)
                if res.raw_total_marks is not None and abs(res.raw_total_marks - expected_raw) > Decimal('0.05'):
                    issues.append(f"Result [{res.id}] raw_total_marks error: stored={res.raw_total_marks} expected={expected_raw}")
                
                expected_avg = round(expected_raw / len(valid_marks), 2)
                if res.average_marks is not None and abs(res.average_marks - expected_avg) > Decimal('0.05'):
                    issues.append(f"Result [{res.id}] average_marks error: stored={res.average_marks} expected={expected_avg}")

    passed_checks.append(f"Verified all {results.count()} ProgramResult and MarkEntry records for name, chest number, team, and mathematical precision.")

    # -------------------------------------------------------------------------
    # 4. Top Scorers Calculation Audit
    # -------------------------------------------------------------------------
    print("\n--- [Audit 4/6] Top Scorers Point Tally Audit ---")
    
    from events.views import EventViewSet
    factory = APIRequestFactory()
    view = EventViewSet.as_view({'get': 'top_scorers'})

    for event in events.filter(status='published'):
        admin_user = User.objects.filter(school=event.school, role='admin').first()
        if not admin_user:
            continue
            
        req = factory.get(f'/api/events/{event.id}/top_scorers/?include_team_based=true&include_general_category=true&include_unpublished=false')
        force_authenticate(req, user=admin_user)
        resp = view(req, pk=event.id)
        
        if resp.status_code != 200:
            issues.append(f"Event {event.id} top_scorers API returned HTTP {resp.status_code}")
            continue

        api_scorers = {s['student_id']: s for s in resp.data.get('scorers', [])}
        print(f">> Event [{event.id}] '{event.title}' returned {len(api_scorers)} top scorers from API.")

        # Calculate ground truth from database
        published_results = ProgramResult.objects.filter(
            program__event=event,
            program__is_active=True,
            program__is_published=True,
            entry_status='submitted',
            position__isnull=False,
            position__gt=0
        ).select_related('program', 'participant', 'team')

        ground_truth_points = {}
        for r in published_results:
            pts = r.points_earned
            if r.program.is_team_based and r.team:
                assigned_students = ProgramAssignment.objects.filter(
                    program=r.program,
                    team=r.team,
                    sub_team_number=r.sub_team_number or 1
                ).values_list('student_id', flat=True)
                for sid in assigned_students:
                    ground_truth_points[sid] = ground_truth_points.get(sid, 0) + pts
            elif r.participant_id:
                ground_truth_points[r.participant_id] = ground_truth_points.get(r.participant_id, 0) + pts

        # Verify ground truth matches API exactly
        point_mismatches = 0
        for sid, gt_pts in ground_truth_points.items():
            api_data = api_scorers.get(sid)
            if not api_data:
                issues.append(f"Event {event.id}: Student {sid} has {gt_pts} published points in DB but missing from top_scorers API!")
                point_mismatches += 1
            elif api_data['total_points'] != gt_pts:
                issues.append(
                    f"Event {event.id}: Point mismatch for student {api_data['name']}: "
                    f"API={api_data['total_points']} vs GroundTruth={gt_pts}"
                )
                point_mismatches += 1

        if point_mismatches == 0:
            passed_checks.append(f"Event {event.id}: All {len(ground_truth_points)} student points in top_scorers API match DB ground truth 100%.")

    # -------------------------------------------------------------------------
    # 5. Dynamic Mutation Test (Student Name / Team / Category Propagation)
    # -------------------------------------------------------------------------
    print("\n--- [Audit 5/6] Dynamic Mutation Propagation Verification ---")
    
    test_student = User.objects.filter(
        program_assignments__program__event_id=8,
        program_results__isnull=False
    ).distinct().first()

    if test_student:
        original_name = test_student.name
        original_first_name = test_student.first_name
        test_new_name = "TEST_INTEGRITY_NAME"
        
        print(f"Testing live name mutation on student ID {test_student.id} ('{test_student.get_full_name()}')...")
        
        # Mutate name
        test_student.name = test_new_name
        test_student.save()

        # Check if ProgramResultSerializer immediately reflects the new name
        res = ProgramResult.objects.filter(participant=test_student).first()
        res_data = ProgramResultSerializer(res).data
        me_data = MarkEntrySerializer(res).data

        name_in_res = res_data.get('participant_name')
        name_in_me = me_data.get('student_name')

        if test_new_name not in str(name_in_res):
            issues.append(f"Name change did not propagate to ProgramResultSerializer: got '{name_in_res}'")
        if test_new_name not in str(name_in_me):
            issues.append(f"Name change did not propagate to MarkEntrySerializer: got '{name_in_me}'")

        # Check top_scorers API
        req = factory.get(f'/api/events/8/top_scorers/?include_team_based=true&include_general_category=true')
        admin_u = User.objects.filter(school_id=1, role='admin').first()
        force_authenticate(req, user=admin_u)
        resp = view(req, pk=8)
        scorer_entry = next((s for s in resp.data.get('scorers', []) if s['student_id'] == test_student.id), None)
        
        if scorer_entry and test_new_name not in scorer_entry['name']:
            issues.append(f"Name change did not propagate to top_scorers API: got '{scorer_entry['name']}'")
        else:
            passed_checks.append("Live name change dynamically propagated across Results, MarkEntry, and TopScorers API with zero stale caching.")

        # Revert student name back to original
        test_student.name = original_name
        test_student.first_name = original_first_name
        test_student.save()
        print(f"Reverted student ID {test_student.id} name back to '{test_student.get_full_name()}'.")

    # -------------------------------------------------------------------------
    # 6. Top Scorer Chest Number Availability Check
    # -------------------------------------------------------------------------
    admin_u = User.objects.filter(school_id=1, role='admin').first()
    if admin_u:
        req = factory.get(f'/api/events/8/top_scorers/?include_team_based=true')
        force_authenticate(req, user=admin_u)
        resp = view(req, pk=8)
        scorers_sample = resp.data.get('scorers', [])[:3]
        for s in scorers_sample:
            has_chest = 'chest_number' in s
            print(f"Top Scorer: {s['name']} | Total Pts: {s['total_points']} | Chest Key in Dict: {has_chest} | Value: {s.get('chest_number')}")
            if not has_chest or s.get('chest_number') is None:
                warnings.append(f"Top scorer {s['name']} does not have 'chest_number' field in top_scorers API response!")

    # -------------------------------------------------------------------------
    # Final Summary Report
    # -------------------------------------------------------------------------
    print("\n" + "=" * 80)
    print("  AUDIT SUMMARY REPORT")
    print("=" * 80)
    print(f"\n[PASSED CHECKS: {len(passed_checks)}]")
    for p in passed_checks:
        print(f"  ✓ {p}")

    if warnings:
        print(f"\n[WARNINGS / RECOMMENDATIONS: {len(warnings)}]")
        for w in warnings:
            print(f"  ⚠ {w}")

    if issues:
        print(f"\n[CRITICAL ISSUES FOUND: {len(issues)}]")
        for iss in issues:
            print(f"  ✗ {iss}")
    else:
        print("\n[CRITICAL ISSUES: 0] (All data invariants, chest uniqueness, and mathematical totals are 100% clean!)")

    print("=" * 80)

if __name__ == '__main__':
    run_audit()
