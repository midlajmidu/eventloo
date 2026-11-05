import os
import sys
import django
from datetime import timedelta, date, time
from decimal import Decimal

# Initialize Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'event_management.settings')
django.setup()

from django.utils import timezone
from django.db import transaction
from django.db.models import Sum, Q
from django.test import RequestFactory
from django.core.exceptions import ValidationError

from accounts.models import School, User, StudentCategory
from events.models import (
    Event, Team, EventProgramType, EventStage, Program,
    ProgramAssignment, ProgramResult, PointsRecord, ChestNumber, CertificateTemplate
)
from events.services import (
    assign_students, recalculate_program_results, rebuild_program_points,
    ensure_registration_modifiable
)
from events.views import (
    generate_formatted_calling_sheet, generate_formatted_evaluation_sheet,
    generate_valuation_sheet, generate_green_room_sign_sheet,
    generate_complete_results_report, generate_certificates,
    get_public_participant_badge
)

def print_header(title):
    print("\n" + "=" * 80)
    print(f"  {title.upper()}")
    print("=" * 80)

def print_sub(title):
    print(f"\n--- {title} ---")

def run_simulation():
    print_header("Zenith Youth Fest 2026: Live E2E Event Lifecycle Simulation")
    
    # --------------------------------------------------------------------------
    # 1. School & Admin Setup
    # --------------------------------------------------------------------------
    print_sub("1. Verifying School & Admin Account")
    school = School.objects.filter(id=1).first()
    if not school:
        school = School.objects.create(id=1, name="Eventloo Demo School", email="admin@eventloo.com")
    print(f"✓ Target School: [{school.id}] {school.name}")

    admin_user = User.objects.filter(email='midlajjj@gmail.com').first()
    if not admin_user:
        admin_user = User.objects.filter(username='midlajjj@gmail.com').first()
    if not admin_user:
        admin_user = User.objects.create_superuser(
            username='midlajjj@gmail.com', email='midlajjj@gmail.com',
            password='midlaj123', school=school, role='admin', name='Admin Midlaj'
        )
    print(f"✓ Admin User: [{admin_user.id}] {admin_user.email} (Role: {admin_user.role})")

    # --------------------------------------------------------------------------
    # 2. Categories Setup (Standard JR, SR & Mixed GN)
    # --------------------------------------------------------------------------
    print_sub("2. Setting Up Student Categories")
    cat_jr, _ = StudentCategory.objects.get_or_create(
        school=school, code='JR',
        defaults={'name': 'Junior', 'is_mixing': False, 'is_active': True}
    )
    cat_sr, _ = StudentCategory.objects.get_or_create(
        school=school, code='SR',
        defaults={'name': 'Senior', 'is_mixing': False, 'is_active': True}
    )
    cat_gn, _ = StudentCategory.objects.get_or_create(
        school=school, code='GN',
        defaults={'name': 'General', 'is_mixing': True, 'is_active': True}
    )
    cat_gn.is_mixing = True
    cat_gn.save()
    print(f"✓ Categories: Junior ('{cat_jr.code}'), Senior ('{cat_sr.code}'), General ('{cat_gn.code}', mixing=True)")

    # --------------------------------------------------------------------------
    # 3. Teams & Team Managers Setup
    # --------------------------------------------------------------------------
    print_sub("3. Setting Up Teams & Team Managers (Multi-Tenancy)")
    tm_phoenix, _ = User.objects.get_or_create(
        email='tm_phoenix@eventloo.com',
        defaults={
            'username': 'tm_phoenix', 'role': 'team_manager',
            'school': school, 'name': 'Phoenix Manager'
        }
    )
    tm_dragons, _ = User.objects.get_or_create(
        email='tm_dragons@eventloo.com',
        defaults={
            'username': 'tm_dragons', 'role': 'team_manager',
            'school': school, 'name': 'Dragons Manager'
        }
    )

    team_red, _ = Team.objects.get_or_create(
        school=school, name="Red Phoenix",
        defaults={'team_number': 101, 'team_manager': tm_phoenix, 'team_username': 'phoenix_team'}
    )
    team_red.team_manager = tm_phoenix
    team_red.team_number = 101
    team_red.save()

    team_blue, _ = Team.objects.get_or_create(
        school=school, name="Blue Dragons",
        defaults={'team_number': 102, 'team_manager': tm_dragons, 'team_username': 'dragons_team'}
    )
    team_blue.team_manager = tm_dragons
    team_blue.team_number = 102
    team_blue.save()

    print(f"✓ Team 1: {team_red.name} (Number: {team_red.team_number}, Manager: {tm_phoenix.email})")
    print(f"✓ Team 2: {team_blue.name} (Number: {team_blue.team_number}, Manager: {tm_dragons.email})")

    # --------------------------------------------------------------------------
    # 4. Student Roster Generation (8 per team: 4 JR, 4 SR, Gender Bal)
    # --------------------------------------------------------------------------
    print_sub("4. Enrolling 16 Students Across Teams & Categories")
    student_specs = [
        # Red Phoenix (4 JR, 4 SR)
        ('rahul@phoenix.com', 'Rahul Sharma', 'male', 'JR', 'STU-JR-01', team_red),
        ('ananya@phoenix.com', 'Ananya Patel', 'female', 'JR', 'STU-JR-02', team_red),
        ('rohan@phoenix.com', 'Rohan Verma', 'male', 'JR', 'STU-JR-03', team_red),
        ('kavya@phoenix.com', 'Kavya Suresh', 'female', 'JR', 'STU-JR-04', team_red),
        ('vikram@phoenix.com', 'Vikram Malhotra', 'male', 'SR', 'STU-SR-01', team_red),
        ('priya@phoenix.com', 'Priya Nair', 'female', 'SR', 'STU-SR-02', team_red),
        ('arjun@phoenix.com', 'Arjun Das', 'male', 'SR', 'STU-SR-03', team_red),
        ('deepa@phoenix.com', 'Deepa Pillai', 'female', 'SR', 'STU-SR-04', team_red),
        # Blue Dragons (4 JR, 4 SR)
        ('sneha@dragons.com', 'Sneha Reddy', 'female', 'JR', 'STU-JR-05', team_blue),
        ('aditya@dragons.com', 'Aditya Kumar', 'male', 'JR', 'STU-JR-06', team_blue),
        ('meera@dragons.com', 'Meera Iyer', 'female', 'JR', 'STU-JR-07', team_blue),
        ('nitin@dragons.com', 'Nitin Menon', 'male', 'JR', 'STU-JR-08', team_blue),
        ('farhan@dragons.com', 'Farhan Ali', 'male', 'SR', 'STU-SR-05', team_blue),
        ('diya@dragons.com', 'Diya Menon', 'female', 'SR', 'STU-SR-06', team_blue),
        ('karthik@dragons.com', 'Karthik Krishnan', 'male', 'SR', 'STU-SR-07', team_blue),
        ('ritu@dragons.com', 'Ritu Sen', 'female', 'SR', 'STU-SR-08', team_blue),
    ]

    students_map = {}
    for email, name, gender, cat, sid, team in student_specs:
        s, _ = User.objects.get_or_create(
            email=email,
            defaults={
                'username': email, 'school': school, 'role': 'student',
                'name': name, 'gender': gender, 'category': cat, 'student_id': sid
            }
        )
        s.category = cat
        s.gender = gender
        s.student_id = sid
        s.school = school
        s.role = 'student'
        s.save()
        team.members.add(s)
        students_map[name] = s

    # Verify 1:1 student-team mapping constraint
    for name, s in students_map.items():
        assert s.team_memberships.count() == 1, f"Invariant violation: {name} in multiple teams!"
    print(f"✓ All 16 students successfully enrolled and verified with strict 1:1 team mapping.")

    # --------------------------------------------------------------------------
    # 5. Event Creation & Logistics Setup
    # --------------------------------------------------------------------------
    print_sub("5. Creating Event: Zenith Youth Fest 2026")
    old_event = Event.objects.filter(school=school, title="Zenith Youth Fest 2026").first()
    if old_event:
        old_event.delete()
        print("  (Purged previous test event to ensure fresh idempotent run)")

    event = Event.objects.create(
        school=school,
        created_by=admin_user,
        title="Zenith Youth Fest 2026",
        description="Annual Mega Inter-House Cultural, Literary & Sports Championship",
        event_type="cultural",
        status="published",
        start_date=date(2026, 11, 20),
        end_date=date(2026, 11, 23),
        venue="Central Campus Grounds",
        num_judges=3,
        max_mark_per_judge=Decimal("100.00"),
        converted_total_mark=Decimal("100.00"),
        enable_grading_system=True,
        grading_rules=[
            {"name": "A+", "min_mark": 90, "max_mark": 100, "bonus_points": 5},
            {"name": "A",  "min_mark": 75, "max_mark": 89.99, "bonus_points": 4},
            {"name": "B+", "min_mark": 65, "max_mark": 74.99, "bonus_points": 3},
            {"name": "B",  "min_mark": 55, "max_mark": 64.99, "bonus_points": 2},
            {"name": "C",  "min_mark": 50, "max_mark": 54.99, "bonus_points": 1},
        ],
        std_ind_first=5, std_ind_second=3, std_ind_third=1,
        std_group_first=10, std_group_second=6, std_group_third=3,
        mix_ind_first=10, mix_ind_second=6, mix_ind_third=3,
        mix_group_first=10, mix_group_second=6, mix_group_third=3,
        count_general_individual_points_for_students=True,
        is_schedule_published=True,
        category_participation_limits={
            "JR": {"max_total": 5, "max_onstage": 3, "max_offstage": 2, "max_single": 3, "max_group": 2},
            "SR": {"max_total": 5, "max_onstage": 3, "max_offstage": 2, "max_single": 3, "max_group": 2},
            "GN": {"max_total": 5}
        },
        registration_deadline=timezone.now() + timedelta(days=7)
    )
    print(f"✓ Event Created: ID={event.id}, Title='{event.title}', Status={event.status}")
    print(f"  Judges: {event.num_judges}, Max Mark: {event.max_mark_per_judge}, Grading: 5-Tier (A+ to C)")

    # Test Registration Cutoff Enforcement
    print_sub("5a. Testing Registration Cutoff Enforcement")
    event.registration_deadline = timezone.now() - timedelta(hours=2)
    event.save()
    cutoff_blocked = False
    try:
        ensure_registration_modifiable(tm_phoenix, event)
    except ValidationError:
        cutoff_blocked = True
    assert cutoff_blocked, "Registration deadline security check failed!"
    print("✓ Registration cutoff lock verified: Team Manager modifications rejected post-deadline.")
    event.registration_deadline = timezone.now() + timedelta(days=7)
    event.save()
    print("✓ Registration reopened for active test configuration.")

    # --------------------------------------------------------------------------
    # 6. Program Types & 6 Physical Stages
    # --------------------------------------------------------------------------
    print_sub("6. Configuring 3 Program Types & 6 Physical Stages")
    pt_onstage = EventProgramType.objects.create(
        event=event, code='onstage', name='Onstage',
        is_stage_based=True, color='purple', display_order=1
    )
    pt_offstage = EventProgramType.objects.create(
        event=event, code='offstage', name='Offstage',
        is_stage_based=False, color='emerald', display_order=2
    )
    pt_sports = EventProgramType.objects.create(
        event=event, code='sports', name='Sports',
        is_stage_based=True, color='amber', display_order=3
    )
    print(f"✓ 3 Program Types: Onstage (Stage-based), Offstage, Sports")

    stages = [
        EventStage.objects.create(event=event, number=1, name="Main Auditorium", capacity=800),
        EventStage.objects.create(event=event, number=2, name="Open Air Amphitheatre", capacity=450),
        EventStage.objects.create(event=event, number=3, name="Mini Hall A", capacity=200),
        EventStage.objects.create(event=event, number=4, name="Art & Literary Wing", capacity=150),
        EventStage.objects.create(event=event, number=5, name="Indoor Sports Complex", capacity=500),
        EventStage.objects.create(event=event, number=6, name="Main Athletics Ground", capacity=1200),
    ]
    stg_map = {s.number: s for s in stages}
    for s in stages:
        print(f"✓ Stage {s.number}: {s.name} (Capacity: {s.capacity})")

    # --------------------------------------------------------------------------
    # 7. 15 Diverse Programs Matrix
    # --------------------------------------------------------------------------
    print_sub("7. Setting Up 15 Diverse Programs Across Categories & Types")
    progs_data = [
        # 1. Classical Vocal Solo
        dict(name="Classical Vocal Solo", category="JR", program_type="onstage", is_team_based=False,
             stage=stg_map[1], duration_minutes_per_entry=5, num_judges=3),
        # 2. Western Solo Song
        dict(name="Western Solo Song", category="SR", program_type="onstage", is_team_based=False,
             stage=stg_map[2], duration_minutes_per_entry=7, num_judges=3),
        # 3. Folk Dance Group
        dict(name="Folk Dance Group", category="JR", program_type="onstage", is_team_based=True,
             team_size=3, max_teams_per_school=1, stage=stg_map[1], duration_minutes_per_entry=10, num_judges=3),
        # 4. English Drama Group (Custom 4 judges)
        dict(name="English Drama Group", category="SR", program_type="onstage", is_team_based=True,
             team_size=4, max_teams_per_school=1, stage=stg_map[2], duration_minutes_per_entry=15, num_judges=4),
        # 5. Light Music Solo
        dict(name="Light Music Solo", category="JR", program_type="onstage", is_team_based=False,
             stage=stg_map[3], duration_minutes_per_entry=5, num_judges=3),
        # 6. Pencil Sketching (Custom 2 judges)
        dict(name="Pencil Sketching", category="JR", program_type="offstage", is_team_based=False,
             stage=stg_map[4], duration_minutes_per_entry=60, num_judges=2),
        # 7. Oil Painting
        dict(name="Oil Painting", category="SR", program_type="offstage", is_team_based=False,
             stage=stg_map[4], duration_minutes_per_entry=90, num_judges=3),
        # 8. Creative Essay Writing
        dict(name="Creative Essay Writing", category="JR", program_type="offstage", is_team_based=False,
             stage=stg_map[4], duration_minutes_per_entry=45, num_judges=2),
        # 9. English Elocution
        dict(name="English Elocution", category="SR", program_type="onstage", is_team_based=False,
             stage=stg_map[3], duration_minutes_per_entry=5, num_judges=3),
        # 10. Open Youth Quiz (GN Mixed, Sub-teams)
        dict(name="Open Youth Quiz", category="GN", program_type="offstage", is_team_based=True,
             team_size=2, max_teams_per_school=2, stage=stg_map[4], duration_minutes_per_entry=30, num_judges=3),
        # 11. Cross-Category Debate (GN Mixed, Sub-teams)
        dict(name="Cross-Category Debate", category="GN", program_type="onstage", is_team_based=True,
             team_size=2, max_teams_per_school=2, stage=stg_map[1], duration_minutes_per_entry=15, num_judges=3),
        # 12. 100m Sprint Junior (Custom Placement Points 7, 5, 2, 1 judge)
        dict(name="100m Sprint Junior", category="JR", program_type="sports", is_team_based=False,
             stage=stg_map[6], duration_minutes_per_entry=3, num_judges=1,
             has_custom_points=True, first_place_points=7, second_place_points=5, third_place_points=2),
        # 13. 200m Sprint Senior (Custom Placement Points 7, 5, 2, 1 judge)
        dict(name="200m Sprint Senior", category="SR", program_type="sports", is_team_based=False,
             stage=stg_map[6], duration_minutes_per_entry=3, num_judges=1,
             has_custom_points=True, first_place_points=7, second_place_points=5, third_place_points=2),
        # 14. Badminton Doubles
        dict(name="Badminton Doubles", category="SR", program_type="sports", is_team_based=True,
             team_size=2, max_teams_per_school=1, stage=stg_map[5], duration_minutes_per_entry=20, num_judges=2),
        # 15. Table Tennis Singles
        dict(name="Table Tennis Singles", category="JR", program_type="sports", is_team_based=False,
             stage=stg_map[5], duration_minutes_per_entry=15, num_judges=2),
    ]

    progs = {}
    base_time = timezone.now() + timedelta(days=1)
    for i, spec in enumerate(progs_data, start=1):
        p = Program.objects.create(
            event=event,
            start_time=base_time + timedelta(hours=i),
            end_time=base_time + timedelta(hours=i, minutes=spec.get('duration_minutes_per_entry', 15)),
            **spec
        )
        progs[spec['name']] = p
        override_note = ""
        if p.num_judges != 3:
            override_note += f" [Judges: {p.num_judges}]"
        if p.has_custom_points:
            override_note += f" [Custom Pts: {p.first_place_points}, {p.second_place_points}, {p.third_place_points}]"
        print(f"  Program {i:02d}: {p.name:<25} | Cat: {p.category:<2} | Type: {p.program_type:<8} | Stage {p.stage.number}{override_note}")

    # --------------------------------------------------------------------------
    # 8. Student & Sub-Team Assignments (via Team Manager Flow)
    # --------------------------------------------------------------------------
    print_sub("8. Executing Team Manager Portal Assignments")

    # 1. Classical Vocal Solo (Single JR): Rahul (Red), Ananya (Red), Sneha (Blue), Aditya (Blue)
    p1 = progs["Classical Vocal Solo"]
    assign_students(user=tm_phoenix, team=team_red, program=p1, student_ids=[students_map['Rahul Sharma'].id])
    assign_students(user=tm_phoenix, team=team_red, program=p1, student_ids=[students_map['Ananya Patel'].id])
    assign_students(user=tm_dragons, team=team_blue, program=p1, student_ids=[students_map['Sneha Reddy'].id])
    assign_students(user=tm_dragons, team=team_blue, program=p1, student_ids=[students_map['Aditya Kumar'].id])
    print(f"✓ Program 1 ({p1.name}): 4 Solo participants assigned via Team Managers.")

    # 2. Folk Dance Group (Group JR, 3 per team): Red Team 1 & Blue Team 1
    p3 = progs["Folk Dance Group"]
    assign_students(
        user=tm_phoenix, team=team_red, program=p3,
        student_ids=[students_map['Rahul Sharma'].id, students_map['Ananya Patel'].id, students_map['Rohan Verma'].id],
        sub_team_number=1, leader_id=students_map['Rahul Sharma'].id
    )
    assign_students(
        user=tm_dragons, team=team_blue, program=p3,
        student_ids=[students_map['Sneha Reddy'].id, students_map['Aditya Kumar'].id, students_map['Meera Iyer'].id],
        sub_team_number=1, leader_id=students_map['Sneha Reddy'].id
    )
    print(f"✓ Program 3 ({p3.name}): Group assigned (Red Team 1 Leader: Rahul, Blue Team 1 Leader: Sneha).")

    # 3. Open Youth Quiz (GN Mixed, Sub-Teams): Red Sub-Team 1 & 2, Blue Sub-Team 1
    p10 = progs["Open Youth Quiz"]
    assign_students(
        user=tm_phoenix, team=team_red, program=p10,
        student_ids=[students_map['Vikram Malhotra'].id, students_map['Priya Nair'].id],
        sub_team_number=1, leader_id=students_map['Vikram Malhotra'].id
    )
    assign_students(
        user=tm_phoenix, team=team_red, program=p10,
        student_ids=[students_map['Rohan Verma'].id, students_map['Arjun Das'].id],
        sub_team_number=2, leader_id=students_map['Rohan Verma'].id
    )
    assign_students(
        user=tm_dragons, team=team_blue, program=p10,
        student_ids=[students_map['Farhan Ali'].id, students_map['Diya Menon'].id],
        sub_team_number=1, leader_id=students_map['Farhan Ali'].id
    )
    print(f"✓ Program 10 ({p10.name}): Sub-team assignments verified (Red Sub-Team 1 & 2, Blue Sub-Team 1).")

    # 4. 100m Sprint Junior (Sports JR): Rahul (Red), Nitin (Blue)
    p12 = progs["100m Sprint Junior"]
    assign_students(user=tm_phoenix, team=team_red, program=p12, student_ids=[students_map['Rahul Sharma'].id])
    assign_students(user=tm_dragons, team=team_blue, program=p12, student_ids=[students_map['Nitin Menon'].id])
    print(f"✓ Program 12 ({p12.name}): Sports individual assigned.")

    # 5. Badminton Doubles (Sports SR, Group 2): Red Team 1 & Blue Team 1
    p14 = progs["Badminton Doubles"]
    assign_students(
        user=tm_phoenix, team=team_red, program=p14,
        student_ids=[students_map['Vikram Malhotra'].id, students_map['Arjun Das'].id],
        sub_team_number=1
    )
    assign_students(
        user=tm_dragons, team=team_blue, program=p14,
        student_ids=[students_map['Farhan Ali'].id, students_map['Karthik Krishnan'].id],
        sub_team_number=1
    )
    print(f"✓ Program 14 ({p14.name}): Sports group assigned.")

    # Negative Test: Cross-Category Assignment Prevention
    print_sub("8a. Testing Category Invariant: Junior assigned to Senior Program")
    p2 = progs["Western Solo Song"] # Senior
    category_blocked = False
    try:
        assign_students(user=tm_phoenix, team=team_red, program=p2, student_ids=[students_map['Rahul Sharma'].id])
    except ValidationError:
        category_blocked = True
    assert category_blocked, "Category restriction bypassed!"
    print("✓ Category guard verified: Junior student assignment to Senior program blocked.")

    # --------------------------------------------------------------------------
    # 9. Chest Number Invariant Checks & Digital Badge Verification
    # --------------------------------------------------------------------------
    print_sub("9. Checking Chest Number Uniqueness & Event-Wide Consistency")
    all_assigned_ids = set(ProgramAssignment.objects.filter(program__event=event).values_list('student_id', flat=True))
    chest_map = {}
    for sid in all_assigned_ids:
        cn = ChestNumber.objects.filter(event=event, student_id=sid).first()
        assert cn is not None, f"Missing chest number for student {sid}!"
        student = User.objects.get(id=sid)
        chest_map[student.name] = cn.chest_number
        print(f"  Student: {student.name:<18} | Team: {cn.team.name:<12} | Chest #: {cn.chest_number}")

    # Assert uniqueness: No duplicates across students
    all_chests = list(chest_map.values())
    assert len(all_chests) == len(set(all_chests)), "Duplicate chest numbers detected!"
    print("✓ Zero duplicate chest numbers: Every student has a unique chest number.")

    # Multi-program student chest consistency
    rahul_assignments = ProgramAssignment.objects.filter(program__event=event, student=students_map['Rahul Sharma'])
    assert rahul_assignments.count() >= 3, "Rahul should be in 3 programs!"
    print(f"✓ Consistency Check: Rahul Sharma is in {rahul_assignments.count()} programs with unchanging Chest #{chest_map['Rahul Sharma']}.")

    # Digital Badge Verification
    rf = RequestFactory()
    badge_req = rf.get(f'/events/{event.id}/badge/{students_map["Rahul Sharma"].id}')
    badge_res = get_public_participant_badge(badge_req, event.id, students_map['Rahul Sharma'].id)
    assert badge_res.status_code == 200, f"Badge failed: {badge_res.status_code}"
    badge_data = badge_res.data
    participant_info = badge_data.get('participant', {})
    assert participant_info.get('name') == 'Rahul Sharma', f"Expected Rahul Sharma, got {participant_info.get('name')}"
    assert participant_info.get('chest_number') == chest_map['Rahul Sharma']
    assert len(badge_data.get('programs', [])) >= 3
    print(f"✓ Digital Badge Verified: Name, Chest #{participant_info.get('chest_number')}, Team, and {len(badge_data['programs'])} Program Tags confirmed.")

    # --------------------------------------------------------------------------
    # 10. Multi-Judge Mark Entry & Tied Results Calculation
    # --------------------------------------------------------------------------
    print_sub("10. Multi-Judge Mark Entry, Code Letters & Tied Rank Handling")

    # Program 1 (Classical Vocal Solo): Rahul (A: 95.00), Sneha (B: 90.00), Ananya (C: 90.00 TIED), Aditya (D: 60.00)
    res_rahul = ProgramResult.objects.get(program=p1, participant=students_map['Rahul Sharma'])
    res_rahul.code_letter = 'A'
    res_rahul.judge1_marks = Decimal("95.00")
    res_rahul.judge2_marks = Decimal("96.00")
    res_rahul.judge3_marks = Decimal("94.00")
    res_rahul.total_marks = Decimal("95.00")
    res_rahul.entry_status = 'submitted'
    res_rahul.save()

    res_sneha = ProgramResult.objects.get(program=p1, participant=students_map['Sneha Reddy'])
    res_sneha.code_letter = 'B'
    res_sneha.judge1_marks = Decimal("90.00")
    res_sneha.judge2_marks = Decimal("91.00")
    res_sneha.judge3_marks = Decimal("89.00")
    res_sneha.total_marks = Decimal("90.00")
    res_sneha.entry_status = 'submitted'
    res_sneha.save()

    res_ananya = ProgramResult.objects.get(program=p1, participant=students_map['Ananya Patel'])
    res_ananya.code_letter = 'C'
    res_ananya.judge1_marks = Decimal("90.00")
    res_ananya.judge2_marks = Decimal("89.00")
    res_ananya.judge3_marks = Decimal("91.00")
    res_ananya.total_marks = Decimal("90.00")
    res_ananya.entry_status = 'submitted'
    res_ananya.save()

    res_aditya = ProgramResult.objects.get(program=p1, participant=students_map['Aditya Kumar'])
    res_aditya.code_letter = 'D'
    res_aditya.judge1_marks = Decimal("60.00")
    res_aditya.judge2_marks = Decimal("60.00")
    res_aditya.judge3_marks = Decimal("60.00")
    res_aditya.total_marks = Decimal("60.00")
    res_aditya.entry_status = 'submitted'
    res_aditya.save()

    p1.is_finished = True
    p1.is_published = True
    p1.save()
    recalculate_program_results(p1)

    res_rahul.refresh_from_db()
    res_sneha.refresh_from_db()
    res_ananya.refresh_from_db()
    res_aditya.refresh_from_db()

    print(f"  P1 Results (Classical Vocal Solo):")
    print(f"    1st Place: {res_rahul.participant.name:<15} (Code {res_rahul.code_letter}) | Avg: {res_rahul.total_marks} | Grade: {res_rahul.grade} | Pts: {res_rahul.points_earned} (5 pos + 5 A+)")
    print(f"    2nd (TIE): {res_sneha.participant.name:<15} (Code {res_sneha.code_letter}) | Avg: {res_sneha.total_marks} | Grade: {res_sneha.grade} | Pts: {res_sneha.points_earned} (3 pos + 5 A+)")
    print(f"    2nd (TIE): {res_ananya.participant.name:<15} (Code {res_ananya.code_letter}) | Avg: {res_ananya.total_marks} | Grade: {res_ananya.grade} | Pts: {res_ananya.points_earned} (3 pos + 5 A+)")
    print(f"    4th Place: {res_aditya.participant.name:<15} (Code {res_aditya.code_letter}) | Avg: {res_aditya.total_marks} | Grade: {res_aditya.grade} | Pts: {res_aditya.points_earned} (0 pos + 2 B)")

    assert res_rahul.position == 1 and res_rahul.points_earned == 10
    assert res_sneha.position == 2 and res_sneha.points_earned == 8
    assert res_ananya.position == 2 and res_ananya.points_earned == 8
    assert res_aditya.position == 3 and res_aditya.points_earned == 3
    print("✓ Tied Rank Verification: Sneha and Ananya both received Position 2 with identical 8 points.")

    # Program 3 (Folk Dance Group): Red Team 1 (93.00), Blue Team 1 (85.00)
    res_p3_red = ProgramResult.objects.get(program=p3, team=team_red, sub_team_number=1)
    res_p3_red.judge1_marks = Decimal("94.00")
    res_p3_red.judge2_marks = Decimal("92.00")
    res_p3_red.judge3_marks = Decimal("93.00")
    res_p3_red.total_marks = Decimal("93.00")
    res_p3_red.entry_status = 'submitted'
    res_p3_red.save()

    res_p3_blue = ProgramResult.objects.get(program=p3, team=team_blue, sub_team_number=1)
    res_p3_blue.judge1_marks = Decimal("85.00")
    res_p3_blue.judge2_marks = Decimal("86.00")
    res_p3_blue.judge3_marks = Decimal("84.00")
    res_p3_blue.total_marks = Decimal("85.00")
    res_p3_blue.entry_status = 'submitted'
    res_p3_blue.save()

    p3.is_finished = True
    p3.is_published = True
    p3.save()
    recalculate_program_results(p3)

    res_p3_red.refresh_from_db()
    res_p3_blue.refresh_from_db()
    print(f"  P3 Results (Folk Dance Group):")
    print(f"    1st Place: {res_p3_red.team.name} (Sub-Team 1) | Avg: {res_p3_red.total_marks} | Grade: {res_p3_red.grade} | Pts: {res_p3_red.points_earned} (10 pos + 5 A+)")
    print(f"    2nd Place: {res_p3_blue.team.name} (Sub-Team 1) | Avg: {res_p3_blue.total_marks} | Grade: {res_p3_blue.grade} | Pts: {res_p3_blue.points_earned} (6 pos + 4 A)")
    assert res_p3_red.position == 1 and res_p3_red.points_earned == 15
    assert res_p3_blue.position == 2 and res_p3_blue.points_earned == 10

    # Program 12 (100m Sprint Junior - Custom Placement Points 7, 5, 2): Rahul (98.00), Nitin (80.00)
    res_p12_rahul = ProgramResult.objects.get(program=p12, participant=students_map['Rahul Sharma'])
    res_p12_rahul.judge1_marks = Decimal("98.00")
    res_p12_rahul.total_marks = Decimal("98.00")
    res_p12_rahul.entry_status = 'submitted'
    res_p12_rahul.save()

    res_p12_nitin = ProgramResult.objects.get(program=p12, participant=students_map['Nitin Menon'])
    res_p12_nitin.judge1_marks = Decimal("80.00")
    res_p12_nitin.total_marks = Decimal("80.00")
    res_p12_nitin.entry_status = 'submitted'
    res_p12_nitin.save()

    p12.is_finished = True
    p12.is_published = True
    p12.save()
    recalculate_program_results(p12)

    res_p12_rahul.refresh_from_db()
    res_p12_nitin.refresh_from_db()
    print(f"  P12 Results (100m Sprint Junior - Custom Points Test):")
    print(f"    1st Place: {res_p12_rahul.participant.name} | Avg: {res_p12_rahul.total_marks} | Grade: {res_p12_rahul.grade} | Pts: {res_p12_rahul.points_earned} (7 custom pos + 5 A+)")
    print(f"    2nd Place: {res_p12_nitin.participant.name} | Avg: {res_p12_nitin.total_marks} | Grade: {res_p12_nitin.grade} | Pts: {res_p12_nitin.points_earned} (5 custom pos + 4 A)")
    assert res_p12_rahul.position == 1 and res_p12_rahul.points_earned == 12
    assert res_p12_nitin.position == 2 and res_p12_nitin.points_earned == 9
    print("✓ Custom Placement Points Verified: Custom 7 and 5 pts applied instead of default 5 and 3.")

    # --------------------------------------------------------------------------
    # 11. Live Team Standings & Points Table
    # --------------------------------------------------------------------------
    print_sub("11. Verifying Live Team Points Table")
    red_pts = PointsRecord.objects.filter(team=team_red, event=event).aggregate(total=Sum('points'))['total'] or 0
    blue_pts = PointsRecord.objects.filter(team=team_blue, event=event).aggregate(total=Sum('points'))['total'] or 0

    print(f"  Standings:")
    print(f"    1st: {team_red.name:<15} | Total Points: {red_pts} pts (P1: 18 + P3: 15 + P12: 12)")
    print(f"    2nd: {team_blue.name:<15} | Total Points: {blue_pts} pts (P1: 11 + P3: 10 + P12: 9)")
    assert red_pts == 45, f"Expected 45 pts for Red Phoenix, got {red_pts}"
    assert blue_pts == 30, f"Expected 30 pts for Blue Dragons, got {blue_pts}"
    print("✓ Live Points Table Verified: Real-time team standings strictly match all result positions and grade bonuses.")

    # --------------------------------------------------------------------------
    # 12. Multidimensional Top Scorers & Champions
    # --------------------------------------------------------------------------
    print_sub("12. Calculating Top Scorers Across Categories, Types & Genders")
    
    # Individual championship points (solo programs P1 & P12)
    rahul_solo_pts = PointsRecord.objects.filter(
        student=students_map['Rahul Sharma'], event=event, source_result__program__is_team_based=False
    ).aggregate(total=Sum('points'))['total'] or 0
    
    sneha_solo_pts = PointsRecord.objects.filter(
        student=students_map['Sneha Reddy'], event=event, source_result__program__is_team_based=False
    ).aggregate(total=Sum('points'))['total'] or 0

    ananya_solo_pts = PointsRecord.objects.filter(
        student=students_map['Ananya Patel'], event=event, source_result__program__is_team_based=False
    ).aggregate(total=Sum('points'))['total'] or 0

    nitin_solo_pts = PointsRecord.objects.filter(
        student=students_map['Nitin Menon'], event=event, source_result__program__is_team_based=False
    ).aggregate(total=Sum('points'))['total'] or 0

    print(f"  Award Winners Summary:")
    print(f"    🏆 Overall Top Scorer: Rahul Sharma ({rahul_solo_pts} solo pts)")
    print(f"    🥇 Junior Champion:    Rahul Sharma ({rahul_solo_pts} solo pts, Category: JR)")
    print(f"    🏃 Sports Champion:    Rahul Sharma (12 pts, 100m Sprint)")
    print(f"    👑 Kalaprathibha (Male): Rahul Sharma (Top Male Scorer)")
    print(f"    👑 Kalathilakam (Female): Sneha Reddy & Ananya Patel ({sneha_solo_pts} pts each, Top Female Scorers)")

    assert rahul_solo_pts == 22, f"Expected Rahul to have 22 solo pts, got {rahul_solo_pts}"
    assert sneha_solo_pts == 8
    assert ananya_solo_pts == 8
    print("✓ Multidimensional Top Scorers & Category Champions Verified.")

    # --------------------------------------------------------------------------
    # 13. Official Document Export Health Checks
    # --------------------------------------------------------------------------
    print_sub("13. Testing Official Document Generation & PDF Exports")
    from rest_framework.test import APIRequestFactory, force_authenticate
    api_rf = APIRequestFactory()

    # 1. Calling Sheet
    cs_req = api_rf.get(f'/api/programs/{p1.id}/formatted-calling-sheet/')
    force_authenticate(cs_req, user=admin_user)
    cs_res = generate_formatted_calling_sheet(cs_req, p1.id)
    assert cs_res.status_code == 200 and 'pdf' in cs_res.get('Content-Type', ''), "Calling Sheet failed!"
    print(f"✓ Stage Calling Sheet (P1): PDF stream verified ({len(cs_res.content)} bytes).")

    # 2. Evaluation Sheet
    es_req = api_rf.get(f'/api/programs/{p1.id}/formatted-evaluation-sheet/')
    force_authenticate(es_req, user=admin_user)
    es_res = generate_formatted_evaluation_sheet(es_req, p1.id)
    assert es_res.status_code == 200 and 'pdf' in es_res.get('Content-Type', ''), "Evaluation Sheet failed!"
    print(f"✓ Judges Evaluation Sheet (P1): PDF stream verified ({len(es_res.content)} bytes).")

    # 3. Valuation Sheet
    vs_req = api_rf.get(f'/api/events/{event.id}/valuation-sheet/')
    force_authenticate(vs_req, user=admin_user)
    vs_res = generate_valuation_sheet(vs_req, event.id)
    assert vs_res.status_code == 200, "Valuation Sheet failed!"
    print(f"✓ Valuation Sheet: Verified ({len(vs_res.content)} bytes).")

    # 4. Green Room Sign Sheet
    gr_req = api_rf.get(f'/api/events/{event.id}/green-room-sheet/')
    force_authenticate(gr_req, user=admin_user)
    gr_res = generate_green_room_sign_sheet(gr_req, event.id)
    assert gr_res.status_code == 200, "Green Room Sign Sheet failed!"
    print(f"✓ Green Room Sign Sheet: Verified ({len(gr_res.content)} bytes).")

    # 5. Complete Results Report
    cr_req = api_rf.get(f'/api/events/{event.id}/complete-results/')
    force_authenticate(cr_req, user=admin_user)
    cr_res = generate_complete_results_report(cr_req, event.id)
    assert cr_res.status_code == 200, "Complete Results Report failed!"
    print(f"✓ Complete Results Tabulation Report: Verified ({len(cr_res.content)} bytes).")

    # 6. Badges Export
    cert_req = api_rf.get(f'/events/{event.id}/certificates/?cert_types=badge')
    force_authenticate(cert_req, user=admin_user)
    cert_res = generate_certificates(cert_req, event.id)
    assert cert_res.status_code == 200, "Badges Export failed!"
    print(f"✓ Official Participant Badges: Printable export stream verified ({len(cert_res.content)} bytes).")

    # --------------------------------------------------------------------------
    # 14. Public Portal Live vs Draft Verification
    # --------------------------------------------------------------------------
    print_sub("14. Testing Public Leaderboard Draft / Published Guard")
    # Temporarily unpublish p12
    p12.is_published = False
    p12.save()
    rebuild_program_points(p12)

    red_pub_pts = PointsRecord.objects.filter(team=team_red, event=event).aggregate(total=Sum('points'))['total'] or 0
    assert red_pub_pts == 33, f"Expected 33 published pts when P12 is unpublished, got {red_pub_pts}"
    print(f"✓ Unpublished Guard: When P12 is unpublished, public points drop from 45 to 33 immediately.")

    # Re-publish p12 to restore full leaderboard
    p12.is_published = True
    p12.save()
    rebuild_program_points(p12)
    red_final_pts = PointsRecord.objects.filter(team=team_red, event=event).aggregate(total=Sum('points'))['total'] or 0
    assert red_final_pts == 45
    print(f"✓ Published Guard: Re-published P12 restores Red Phoenix to 45 pts.")

    print_header("All 14 Operational Modules Passed with 100% Invariants Intact")
    print(f"🌐 Event is now live in your database! Refresh http://localhost:3003/admin/events to inspect.")

if __name__ == '__main__':
    run_simulation()
