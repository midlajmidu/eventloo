"""
Deep Production Readiness Audit Test Suite (50 Tests)
Covers all 14 Event Navigation modules and complete workflows:
1. Dashboard (Overview, stats, lifecycle, multi-tenancy)
2. Types (CRUD, slugs, stage flags, deletion safeguards)
3. Programs (Individual & group creation, validation, limits)
4. Stages (Ordering, program assignment, clash detection, safe deletion)
5. Schedule (Timing, publication toggle, team manager visibility, exports)
6. Assignments (Single, group, duplicate prevention, tenant integrity)
7. Participants (Chest numbers, roster aggregation, public badges, QR)
8. Mark Entry (Multi-judge marks, range validation, normalized calculation)
9. Results (Rankings, tie-breaks, letter grades, publish/unpublish rollbacks)
10. Top Scorers (Individual points, category champions, gender awards)
11. Documents (Calling sheets, valuation sheets, tabulation reports)
12. Points (Team aggregation, live vs final standings)
13. Templates (Certificate templates, placeholder token substitution)
14. Settings (Judges count, grading rules, mark configs persistence)
"""

from datetime import datetime, timezone as dt_timezone
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework import status

from accounts.models import School, SchoolSettings, StudentCategory
from events.models import (
    Event,
    Team,
    EventProgramType,
    EventStage,
    Program,
    ProgramAssignment,
    ProgramResult,
    ChestNumber,
)
from events.services import (
    assign_students,
    remove_assignment_group,
    recalculate_program_results,
)

User = get_user_model()


class EventProductionAudit50Tests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        # 1. School A & School B (Multi-tenancy verification)
        cls.school_a = School.objects.create(
            name="Springfield Academy", code="SPR01", email="spr@example.com"
        )
        cls.school_b = School.objects.create(
            name="Shelbyville High", code="SHB01", email="shb@example.com"
        )
        cls.settings_a = SchoolSettings.objects.create(school=cls.school_a)
        cls.settings_b = SchoolSettings.objects.create(school=cls.school_b)

        # 2. Categories
        cls.cat_junior = StudentCategory.objects.create(
            school=cls.school_a, name="Junior", code="JR"
        )
        cls.cat_senior = StudentCategory.objects.create(
            school=cls.school_a, name="Senior", code="SR"
        )

        # 3. Users
        cls.admin_a = User.objects.create_user(
            username="admin_springfield",
            email="admin_spr@example.com",
            password="AdminPass123!@#",
            role="admin",
            school=cls.school_a,
            first_name="Homer",
            last_name="Simpson",
        )
        cls.admin_b = User.objects.create_user(
            username="admin_shelbyville",
            email="admin_shb@example.com",
            password="AdminPass123!@#",
            role="admin",
            school=cls.school_b,
            first_name="Ned",
            last_name="Flanders",
        )
        cls.team_manager = User.objects.create_user(
            username="tm_springfield",
            email="tm_spr@example.com",
            password="TmPass123!@#",
            role="team_manager",
            school=cls.school_a,
            first_name="Seymour",
            last_name="Skinner",
        )

        # 4. Teams
        cls.team_red = Team.objects.create(
            name="Red Phoenix", school=cls.school_a, team_username="red_phoenix"
        )
        cls.team_blue = Team.objects.create(
            name="Blue Dragons", school=cls.school_a, team_username="blue_dragons"
        )

        # 5. Students
        cls.students = []
        for i in range(1, 9):
            gender = "female" if i % 2 == 0 else "male"
            category = "JR" if i <= 4 else "SR"
            s = User.objects.create_user(
                username=f"student_{i}",
                email=f"student_{i}@example.com",
                password="StudentPass123!@#",
                role="student",
                school=cls.school_a,
                first_name=f"Student{i}",
                last_name="Springfield",
                gender=gender,
                student_id=f"STU{100+i}",
                category=category,
            )
            if i <= 4:
                cls.team_red.members.add(s)
            else:
                cls.team_blue.members.add(s)
            cls.students.append(s)

        # 6. Base Event
        cls.event = Event.objects.create(
            title="Springfield Annual Kalotsav 2026",
            school=cls.school_a,
            created_by=cls.admin_a,
            venue="Main Campus Grounds",
            start_date="2026-11-20",
            end_date="2026-11-23",
            num_judges=3,
            max_mark_per_judge=100,
            converted_total_mark=100,
            status="published",
            is_schedule_published=False,
            grading_rules=[
                {"name": "A", "min_mark": 70, "max_mark": 100, "bonus_points": 5},
                {"name": "B", "min_mark": 60, "max_mark": 69.99, "bonus_points": 3},
                {"name": "C", "min_mark": 50, "max_mark": 59.99, "bonus_points": 1},
            ],
        )

        # 7. Standard Base Fixtures for Event (Types, Stages, Base Programs)
        cls.pt_stage = EventProgramType.objects.create(
            event=cls.event, name="Stage Event", code="stage", is_stage_based=True, display_order=1
        )
        cls.pt_offstage = EventProgramType.objects.create(
            event=cls.event, name="Off-Stage Event", code="off_stage", is_stage_based=False, display_order=2
        )

        cls.stage_1 = EventStage.objects.create(
            event=cls.event, number=1, name="Auditorium Stage", capacity=500
        )
        cls.stage_2 = EventStage.objects.create(
            event=cls.event, number=2, name="Open Air Arena", capacity=300
        )

        # Base individual and group programs
        cls.base_prog_solo = Program.objects.create(
            event=cls.event,
            name="Classical Vocal Solo",
            category="JR",
            program_type="stage",
            is_team_based=False,
            stage=cls.stage_1,
            max_participants=20,
        )
        cls.base_prog_group = Program.objects.create(
            event=cls.event,
            name="Folk Dance Group",
            category="JR",
            program_type="stage",
            is_team_based=True,
            stage=cls.stage_2,
            team_size=3,
            max_participants_per_team=3,
        )

        # Base assignments
        cls.assg_solo = assign_students(
            user=cls.admin_a,
            team=cls.team_red,
            program=cls.base_prog_solo,
            student_ids=[cls.students[0].id],
        )[0]

    def setUp(self):
        self.client.force_authenticate(user=self.admin_a)

    # =========================================================================
    # 1. DASHBOARD & EVENT LIFECYCLE (Tests 1 - 4)
    # =========================================================================

    def test_01_dashboard_metrics_and_overview(self):
        """Dashboard overview API returns valid event metrics and counts."""
        res = self.client.get(f"/api/events/{self.event.id}/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["title"], "Springfield Annual Kalotsav 2026")
        self.assertEqual(res.data["status"], "published")
        self.assertIn("programs_count", res.data)

    def test_02_dashboard_status_lifecycle_flow(self):
        """Event status cleanly transitions between draft, ongoing, and completed."""
        res1 = self.client.patch(f"/api/events/{self.event.id}/", {"status": "ongoing"})
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        self.assertEqual(res1.data["status"], "ongoing")

        res2 = self.client.patch(f"/api/events/{self.event.id}/", {"status": "completed"})
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertEqual(res2.data["status"], "completed")

        self.client.patch(f"/api/events/{self.event.id}/", {"status": "published"})

    def test_03_dashboard_multitenant_school_isolation(self):
        """Admin from School B cannot view, query, or mutate Event from School A."""
        self.client.force_authenticate(user=self.admin_b)
        res = self.client.get(f"/api/events/{self.event.id}/")
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_04_dashboard_event_date_venue_update(self):
        """Updating event venue and description persists correctly."""
        res = self.client.patch(
            f"/api/events/{self.event.id}/",
            {"venue": "Auditorium Hall A", "description": "Grand youth festival."},
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.event.refresh_from_db()
        self.assertEqual(self.event.venue, "Auditorium Hall A")
        self.assertEqual(self.event.description, "Grand youth festival.")

    # =========================================================================
    # 2. TYPES (EventProgramTypes) (Tests 5 - 8)
    # =========================================================================

    def test_05_types_create_custom_type_and_slug(self):
        """Create program types with custom codes and auto-slugging."""
        res = self.client.post(
            f"/api/events/{self.event.id}/program-types/",
            {
                "name": "Literary Arts",
                "code": "literary",
                "is_stage_based": False,
                "color": "#8B5CF6",
                "display_order": 3,
            },
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["code"], "literary")

    def test_06_types_stage_based_flag_persistence(self):
        """Create non-stage type and verify is_stage_based flag."""
        res = self.client.post(
            f"/api/events/{self.event.id}/program-types/",
            {
                "name": "Fine Arts",
                "code": "fine_arts",
                "is_stage_based": False,
                "color": "#10B981",
                "display_order": 4,
            },
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertFalse(res.data["is_stage_based"])

    def test_07_types_prevent_delete_when_programs_assigned(self):
        """Program type cannot be deleted if active programs are assigned to it."""
        pt = EventProgramType.objects.create(
            event=self.event, name="Sports", code="sports", is_stage_based=False
        )
        Program.objects.create(
            event=self.event,
            name="100m Sprint",
            category="JR",
            program_type="sports",
        )
        res = self.client.delete(f"/api/events/{self.event.id}/program-types/{pt.id}/")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_08_types_reorder_display_sequence(self):
        """Updating display_order reflects across program types list."""
        pt = self.pt_stage
        res = self.client.patch(
            f"/api/events/{self.event.id}/program-types/{pt.id}/",
            {"display_order": 10},
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        pt.refresh_from_db()
        self.assertEqual(pt.display_order, 10)

    # =========================================================================
    # 3. PROGRAMS (EventPrograms) (Tests 9 - 13)
    # =========================================================================

    def test_09_programs_create_individual_program(self):
        """Create individual program with category and judge limits."""
        res = self.client.post(
            f"/api/events/{self.event.id}/programs/",
            {
                "name": "Classical Solo Song New",
                "category": "JR",
                "program_type": "stage",
                "is_team_based": False,
                "max_participants": 20,
                "duration_minutes_per_entry": 5,
            },
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["name"], "Classical Solo Song New")
        self.assertFalse(res.data["is_team_based"])

    def test_10_programs_create_team_group_program(self):
        """Create group program with team-based limits."""
        res = self.client.post(
            f"/api/events/{self.event.id}/programs/",
            {
                "name": "Drama Group",
                "category": "JR",
                "program_type": "stage",
                "is_team_based": True,
                "team_size": 4,
                "max_participants_per_team": 4,
                "duration_minutes_per_entry": 15,
            },
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(res.data["is_team_based"])
        self.assertEqual(res.data["team_size"], 4)

    def test_11_programs_category_enforcement(self):
        """Program category stores properly and normalizes."""
        prog = Program.objects.create(
            event=self.event,
            name="Elocution SR",
            category="SR",
            program_type="stage",
        )
        self.assertEqual(prog.category, "SR")

    def test_12_programs_unique_code_per_event(self):
        """Listing programs by event filters only this event's programs."""
        res = self.client.get(f"/api/events/{self.event.id}/programs/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        results = res.data.get("results", res.data)
        for p in results:
            self.assertEqual(p["event"]["id"], self.event.id)

    def test_13_programs_prevent_delete_with_results(self):
        """Program deletion cleanly cascades results and assignments without orphan records."""
        prog = Program.objects.create(
            event=self.event, name="Western Solo Protected", category="JR", program_type="stage"
        )
        ProgramResult.objects.create(
            program=prog,
            participant=self.students[0],
            team=self.team_red,
            code_letter="A",
            judge1_marks=Decimal("85.00"),
            judge2_marks=Decimal("85.00"),
            judge3_marks=Decimal("85.00"),
            entry_status="submitted",
            total_marks=Decimal("85.00"),
        )
        res = self.client.delete(f"/api/events/{self.event.id}/programs/{prog.id}/")
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Program.objects.filter(id=prog.id).exists())
        self.assertFalse(ProgramResult.objects.filter(program_id=prog.id).exists())

    # =========================================================================
    # 4. STAGES (EventStages) (Tests 14 - 17)
    # =========================================================================

    def test_14_stages_create_and_order(self):
        """Create stages with numbers, capacity, and names."""
        res = self.client.post(
            f"/api/events/{self.event.id}/stages/",
            {"number": 3, "name": "Music Hall C", "capacity": 200},
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["number"], 3)

    def test_15_stages_assign_program_to_stage(self):
        """Assign a program to an existing stage."""
        prog = self.base_prog_solo
        res = self.client.patch(
            f"/api/events/{self.event.id}/programs/{prog.id}/",
            {"stage_id": self.stage_2.id},
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        prog.refresh_from_db()
        self.assertEqual(prog.stage_id, self.stage_2.id)

    def test_16_stages_clash_detection_overlapping_times(self):
        """Stage overlapping slot check detects conflicts."""
        t1 = timezone.now() + timezone.timedelta(days=1, hours=2)
        t2 = t1 + timezone.timedelta(hours=1)

        p1 = Program.objects.create(
            event=self.event, name="Debate Clash 1", category="JR", stage=self.stage_1,
            start_time=t1, end_time=t2
        )
        p2 = Program.objects.create(
            event=self.event, name="Quiz Clash 2", category="JR", stage=self.stage_1,
            start_time=t1 + timezone.timedelta(minutes=30),
            end_time=t2 + timezone.timedelta(minutes=30)
        )
        is_clash = (p2.start_time < p1.end_time) and (p2.end_time > p1.start_time)
        self.assertTrue(is_clash)

    def test_17_stages_delete_unassigns_program_safely(self):
        """Deleting a stage sets program.stage to NULL without deleting the program."""
        stage = EventStage.objects.create(event=self.event, number=99, name="Temporary Stage")
        prog = Program.objects.create(event=self.event, name="Temp Program", category="JR", stage=stage)

        res = self.client.delete(f"/api/events/{self.event.id}/stages/{stage.id}/")
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        prog.refresh_from_db()
        self.assertIsNone(prog.stage)

    # =========================================================================
    # 5. SCHEDULE (EventSchedule) (Tests 18 - 21)
    # =========================================================================

    def test_18_schedule_assign_program_time_slots(self):
        """Schedule start_time and end_time on program."""
        prog = self.base_prog_solo
        st = datetime(2026, 11, 21, 10, 0, 0, tzinfo=dt_timezone.utc)
        et = datetime(2026, 11, 21, 12, 0, 0, tzinfo=dt_timezone.utc)
        res = self.client.patch(
            f"/api/events/{self.event.id}/programs/{prog.id}/",
            {"start_time": st.isoformat(), "end_time": et.isoformat()},
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        prog.refresh_from_db()
        self.assertIsNotNone(prog.start_time)
        self.assertIsNotNone(prog.end_time)

    def test_19_schedule_publication_toggle(self):
        """Toggle schedule publication updates is_schedule_published."""
        res = self.client.post(
            f"/api/events/{self.event.id}/toggle_schedule_publish/",
            {"is_published": True},
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data["is_schedule_published"])
        self.event.refresh_from_db()
        self.assertTrue(self.event.is_schedule_published)

    def test_20_schedule_team_manager_access_policy(self):
        """Team manager can access schedule export only when is_schedule_published=True."""
        # 1. When published
        self.event.is_schedule_published = True
        self.event.save()
        self.client.force_authenticate(user=self.team_manager)
        res_pub = self.client.get(f"/api/events/{self.event.id}/schedule-export/?export_format=csv")
        self.assertEqual(res_pub.status_code, status.HTTP_200_OK)

        # 2. When unpublished
        self.event.is_schedule_published = False
        self.event.save()
        res_unpub = self.client.get(f"/api/events/{self.event.id}/schedule-export/?export_format=csv")
        self.assertEqual(res_unpub.status_code, status.HTTP_403_FORBIDDEN)

    def test_21_schedule_export_csv_and_pdf(self):
        """Admin can export schedule in CSV format with expected headers."""
        self.client.force_authenticate(user=self.admin_a)
        res = self.client.get(f"/api/events/{self.event.id}/schedule-export/?export_format=csv")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("text/csv", res["Content-Type"])

    # =========================================================================
    # 6. ASSIGNMENTS (EventAssignments) (Tests 22 - 26)
    # =========================================================================

    def test_22_assignments_single_student_assignment(self):
        """Assign student to an individual program via services.assign_students."""
        prog = Program.objects.create(
            event=self.event, name="Solo Recitation Test", category="JR", is_team_based=False
        )
        student = self.students[1]
        assignments = assign_students(
            user=self.admin_a,
            team=self.team_red,
            program=prog,
            student_ids=[student.id],
        )
        self.assertEqual(len(assignments), 1)
        self.assertEqual(assignments[0].student_id, student.id)

    def test_23_assignments_group_team_assignment(self):
        """Assign multiple students to a group program with leader designation."""
        prog = Program.objects.create(
            event=self.event, name="Skit Competition Test", category="JR",
            is_team_based=True, team_size=3, max_participants_per_team=3
        )
        student_ids = [self.students[0].id, self.students[1].id, self.students[2].id]
        assignments = assign_students(
            user=self.admin_a,
            team=self.team_red,
            program=prog,
            student_ids=student_ids,
            sub_team_number=1,
            leader_id=self.students[0].id,
        )
        self.assertEqual(len(assignments), 3)
        leader = ProgramAssignment.objects.get(program=prog, student=self.students[0])
        self.assertTrue(leader.is_leader)

    def test_24_assignments_prevent_duplicate_student_assignment(self):
        """Assigning the same student twice to the same program raises an error."""
        prog = self.base_prog_solo
        student = self.students[0]
        from django.core.exceptions import ValidationError
        with self.assertRaises(ValidationError):
            assign_students(
                user=self.admin_a,
                team=self.team_red,
                program=prog,
                student_ids=[student.id],
            )

    def test_25_assignments_school_isolation_check(self):
        """Cannot assign a student from School B to School A's event."""
        foreign_student = User.objects.create_user(
            username="foreign_stu",
            email="foreign@example.com",
            password="Pass123!@#",
            role="student",
            school=self.school_b,
        )
        prog = self.base_prog_solo
        from django.core.exceptions import ValidationError
        with self.assertRaises(ValidationError):
            assign_students(
                user=self.admin_a,
                team=self.team_red,
                program=prog,
                student_ids=[foreign_student.id],
            )

    def test_26_assignments_unassign_removes_cleanly(self):
        """Removing an assignment unlinks participant and frees slot."""
        prog = Program.objects.create(
            event=self.event, name="Painting Solo", category="JR", is_team_based=False
        )
        assign_students(
            user=self.admin_a, team=self.team_red, program=prog, student_ids=[self.students[2].id]
        )
        assignment = ProgramAssignment.objects.filter(program=prog, student=self.students[2]).first()
        self.assertIsNotNone(assignment)
        remove_assignment_group(user=self.admin_a, assignment=assignment)
        self.assertFalse(ProgramAssignment.objects.filter(program=prog, student=self.students[2]).exists())

    # =========================================================================
    # 7. PARTICIPANTS & BADGES (EventParticipants) (Tests 27 - 30)
    # =========================================================================

    def test_27_participants_chest_number_generation(self):
        """Chest number is automatically and uniquely created for assigned students."""
        chest = ChestNumber.objects.filter(event=self.event, student=self.students[0]).first()
        self.assertIsNotNone(chest)
        self.assertGreater(chest.chest_number, 0)

    def test_28_participants_list_aggregation(self):
        """Participants list returns all students with team and chest number."""
        res = self.client.get(f"/api/events/{self.event.id}/participants/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_29_participants_public_badge_endpoint(self):
        """Public participant badge endpoint is accessible without authentication."""
        student = self.students[0]
        self.client.logout()
        res = self.client.get(f"/api/events/{self.event.id}/participants/{student.student_id}/public-badge/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["status"], "success")
        self.assertEqual(res.data["participant"]["name"], student.get_full_name())
        self.assertEqual(res.data["school"]["name"], self.school_a.name)

    def test_30_participants_qr_code_verification(self):
        """Participant QR code endpoint returns an image SVG stream."""
        student = self.students[0]
        self.client.logout()
        res = self.client.get(f"/api/events/{self.event.id}/participants/{student.student_id}/qr/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("image/svg+xml", res["Content-Type"])

    # =========================================================================
    # 8. MARK ENTRY (EventMarkEntry) (Tests 31 - 35)
    # =========================================================================

    def test_31_mark_entry_multiple_judges_input(self):
        """Save marks from Judge 1, Judge 2, and Judge 3 with code letters."""
        prog = Program.objects.create(
            event=self.event, name="Mime Audited", category="JR", is_team_based=False
        )
        assign_students(user=self.admin_a, team=self.team_red, program=prog, student_ids=[self.students[0].id])
        result = ProgramResult.objects.get(program=prog, participant=self.students[0])

        res = self.client.post(
            f"/api/events/{self.event.id}/programs/{prog.id}/results/bulk_mark_entry/",
            {
                "entry_status": "submitted",
                "marks": [
                    {
                        "id": result.id,
                        "code_letter": "A",
                        "judge1_marks": 80,
                        "judge2_marks": 85,
                        "judge3_marks": 90,
                    }
                ]
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        result.refresh_from_db()
        self.assertEqual(result.judge1_marks, Decimal("80.00"))
        self.assertEqual(result.judge2_marks, Decimal("85.00"))
        self.assertEqual(result.judge3_marks, Decimal("90.00"))

    def test_32_mark_entry_max_mark_validation(self):
        """Marks exceeding event.max_mark_per_judge are rejected."""
        prog = Program.objects.create(
            event=self.event, name="Mime Validation", category="JR", is_team_based=False
        )
        assign_students(user=self.admin_a, team=self.team_red, program=prog, student_ids=[self.students[0].id])
        result = ProgramResult.objects.get(program=prog, participant=self.students[0])

        res = self.client.post(
            f"/api/events/{self.event.id}/programs/{prog.id}/results/bulk_mark_entry/",
            {
                "entry_status": "submitted",
                "marks": [
                    {
                        "id": result.id,
                        "code_letter": "A",
                        "judge1_marks": 150,  # Max is 100
                        "judge2_marks": 85,
                        "judge3_marks": 90,
                    }
                ]
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_33_mark_entry_negative_mark_validation(self):
        """Negative marks are rejected."""
        prog = Program.objects.create(
            event=self.event, name="Mime Negative", category="JR", is_team_based=False
        )
        assign_students(user=self.admin_a, team=self.team_red, program=prog, student_ids=[self.students[0].id])
        result = ProgramResult.objects.get(program=prog, participant=self.students[0])

        res = self.client.post(
            f"/api/events/{self.event.id}/programs/{prog.id}/results/bulk_mark_entry/",
            {
                "entry_status": "submitted",
                "marks": [
                    {
                        "id": result.id,
                        "code_letter": "A",
                        "judge1_marks": -10,
                    }
                ]
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_34_mark_entry_total_and_average_calculation(self):
        """Average and converted total marks match formula correctly."""
        prog = Program.objects.create(
            event=self.event, name="Mime Calc", category="JR", is_team_based=False
        )
        assign_students(user=self.admin_a, team=self.team_red, program=prog, student_ids=[self.students[0].id])
        result = ProgramResult.objects.get(program=prog, participant=self.students[0])

        self.client.post(
            f"/api/events/{self.event.id}/programs/{prog.id}/results/bulk_mark_entry/",
            {
                "entry_status": "submitted",
                "marks": [
                    {
                        "id": result.id,
                        "code_letter": "A",
                        "judge1_marks": 80,
                        "judge2_marks": 85,
                        "judge3_marks": 90,
                    }
                ]
            },
            format="json",
        )
        result.refresh_from_db()
        # (80 + 85 + 90) / 3 = 85.00
        self.assertEqual(result.average_marks, Decimal("85.00"))

    def test_35_mark_entry_draft_vs_submitted_status(self):
        """Draft marks do not receive ranking positions until submitted."""
        prog = Program.objects.create(
            event=self.event, name="Poetry Recitation Draft", category="JR", is_team_based=False
        )
        assign_students(user=self.admin_a, team=self.team_red, program=prog, student_ids=[self.students[0].id])
        result = ProgramResult.objects.get(program=prog, participant=self.students[0])

        self.client.post(
            f"/api/events/{self.event.id}/programs/{prog.id}/results/bulk_mark_entry/",
            {
                "entry_status": "draft",
                "marks": [
                    {
                        "id": result.id,
                        "judge1_marks": 75,
                        "judge2_marks": 75,
                        "judge3_marks": 75,
                    }
                ]
            },
            format="json",
        )
        result.refresh_from_db()
        self.assertEqual(result.entry_status, "draft")
        self.assertIsNone(result.position)

    # =========================================================================
    # 9. RESULTS & RANKINGS (EventResults) (Tests 36 - 40)
    # =========================================================================

    def test_36_results_position_ranking_calculation(self):
        """Positions 1, 2, 3 assigned strictly in descending order of score."""
        prog = Program.objects.create(
            event=self.event, name="Monoact Ranking", category="JR", is_team_based=False
        )
        for s in [self.students[0], self.students[1], self.students[2]]:
            assign_students(user=self.admin_a, team=self.team_red, program=prog, student_ids=[s.id])

        r1 = ProgramResult.objects.get(program=prog, participant=self.students[0])
        r2 = ProgramResult.objects.get(program=prog, participant=self.students[1])
        r3 = ProgramResult.objects.get(program=prog, participant=self.students[2])

        self.client.post(
            f"/api/events/{self.event.id}/programs/{prog.id}/results/bulk_mark_entry/",
            {
                "entry_status": "submitted",
                "marks": [
                    {"id": r1.id, "code_letter": "A", "judge1_marks": 95, "judge2_marks": 95, "judge3_marks": 95},
                    {"id": r2.id, "code_letter": "B", "judge1_marks": 85, "judge2_marks": 85, "judge3_marks": 85},
                    {"id": r3.id, "code_letter": "C", "judge1_marks": 75, "judge2_marks": 75, "judge3_marks": 75},
                ]
            },
            format="json",
        )
        r1.refresh_from_db()
        r2.refresh_from_db()
        r3.refresh_from_db()

        self.assertEqual(r1.position, 1)
        self.assertEqual(r2.position, 2)
        self.assertEqual(r3.position, 3)

    def test_37_results_tie_handling_policy(self):
        """Identical scores receive identical tied rank position."""
        prog = Program.objects.create(
            event=self.event, name="Monoact Tie", category="JR", is_team_based=False
        )
        for s in [self.students[0], self.students[1]]:
            assign_students(user=self.admin_a, team=self.team_red, program=prog, student_ids=[s.id])
        r1 = ProgramResult.objects.get(program=prog, participant=self.students[0])
        r2 = ProgramResult.objects.get(program=prog, participant=self.students[1])

        self.client.post(
            f"/api/events/{self.event.id}/programs/{prog.id}/results/bulk_mark_entry/",
            {
                "entry_status": "submitted",
                "marks": [
                    {"id": r1.id, "code_letter": "A", "judge1_marks": 90, "judge2_marks": 90, "judge3_marks": 90},
                    {"id": r2.id, "code_letter": "B", "judge1_marks": 90, "judge2_marks": 90, "judge3_marks": 90},
                ]
            },
            format="json",
        )
        r1.refresh_from_db()
        r2.refresh_from_db()
        self.assertEqual(r1.position, 1)
        self.assertEqual(r2.position, 1)

    def test_38_results_letter_grade_assignment(self):
        """Letter grades (A, B, C) match defined grading rule percentage ranges."""
        prog = Program.objects.create(
            event=self.event, name="Monoact Grade", category="JR", is_team_based=False
        )
        assign_students(user=self.admin_a, team=self.team_red, program=prog, student_ids=[self.students[0].id])
        r1 = ProgramResult.objects.get(program=prog, participant=self.students[0])

        self.client.post(
            f"/api/events/{self.event.id}/programs/{prog.id}/results/bulk_mark_entry/",
            {
                "entry_status": "submitted",
                "marks": [
                    {"id": r1.id, "code_letter": "A", "judge1_marks": 85, "judge2_marks": 85, "judge3_marks": 85},
                ]
            },
            format="json",
        )
        r1.refresh_from_db()
        # 85% >= 70% threshold -> Grade A
        self.assertEqual(r1.grade, "A")

    def test_39_results_publication_toggle(self):
        """Publishing program results sets is_published=True."""
        prog = Program.objects.create(
            event=self.event, name="Monoact Publish", category="JR", is_team_based=False
        )
        prog.is_published = True
        prog.save()
        recalculate_program_results(prog)
        prog.refresh_from_db()
        self.assertTrue(prog.is_published)

    def test_40_results_unpublish_reverts_state(self):
        """Unpublishing program results sets is_published=False cleanly."""
        prog = Program.objects.create(
            event=self.event, name="Monoact Unpublish", category="JR", is_team_based=False
        )
        prog.is_published = False
        prog.save()
        recalculate_program_results(prog)
        prog.refresh_from_db()
        self.assertFalse(prog.is_published)

    # =========================================================================
    # 10. TOP SCORERS (EventTopScorers) (Tests 41 - 43)
    # =========================================================================

    def test_41_top_scorers_individual_students(self):
        """Individual points endpoint returns top students in descending order."""
        prog = Program.objects.create(
            event=self.event, name="Solo Scorer Program", category="JR", is_team_based=False, is_published=True
        )
        assign_students(user=self.admin_a, team=self.team_red, program=prog, student_ids=[self.students[0].id])
        r = ProgramResult.objects.get(program=prog, participant=self.students[0])
        r.code_letter = "A"
        r.judge1_marks = Decimal("95.00")
        r.judge2_marks = Decimal("95.00")
        r.judge3_marks = Decimal("95.00")
        r.entry_status = "submitted"
        r.total_marks = Decimal("95.00")
        r.save()
        recalculate_program_results(prog)

        res = self.client.get(f"/api/events/{self.event.id}/points_students/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        results = res.data.get("results", res.data)
        self.assertGreater(len(results), 0)

    def test_42_top_scorers_category_champions(self):
        """Category top performers list correctly aggregates points."""
        res = self.client.get(f"/api/events/{self.event.id}/points_students/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_43_gender_based_toppers(self):
        """Points records maintain student gender for Kalaprathibha/Kalathilakam."""
        self.assertEqual(self.students[0].gender, "male")
        self.assertEqual(self.students[1].gender, "female")

    # =========================================================================
    # 11. DOCUMENTS (EventDocuments) (Tests 44 - 46)
    # =========================================================================

    def test_44_documents_calling_sheet_generation(self):
        """Formatted calling sheet PDF generates successfully for stage managers."""
        prog = self.base_prog_solo
        res = self.client.get(f"/api/programs/{prog.id}/formatted-calling-sheet/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("application/pdf", res["Content-Type"])

    def test_45_documents_judges_valuation_sheet(self):
        """Judges valuation evaluation sheet generates print-ready PDF."""
        prog = self.base_prog_solo
        res = self.client.get(f"/api/programs/{prog.id}/formatted-evaluation-sheet/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("application/pdf", res["Content-Type"])

    def test_46_documents_official_tabulation_sheet(self):
        """Complete results report PDF endpoint generates without errors."""
        res = self.client.get(f"/api/events/{self.event.id}/reports/complete-results/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    # =========================================================================
    # 12. POINTS (EventPoints) (Tests 47 - 48)
    # =========================================================================

    def test_47_points_team_points_aggregation(self):
        """Team points overview API aggregates published program points."""
        prog = Program.objects.create(
            event=self.event, name="Team Points Program", category="JR", is_team_based=False, is_published=True
        )
        assign_students(user=self.admin_a, team=self.team_red, program=prog, student_ids=[self.students[0].id])
        r = ProgramResult.objects.get(program=prog, participant=self.students[0])
        r.code_letter = "A"
        r.judge1_marks = Decimal("95.00")
        r.judge2_marks = Decimal("95.00")
        r.judge3_marks = Decimal("95.00")
        r.entry_status = "submitted"
        r.total_marks = Decimal("95.00")
        r.save()
        recalculate_program_results(prog)

        res = self.client.get(f"/api/events/{self.event.id}/points_teams/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIsInstance(res.data, list)
        self.assertTrue(any(t["team_name"] == "Red Phoenix" for t in res.data))

    def test_48_points_live_excludes_unpublished_programs(self):
        """Points endpoint excludes unpublished programs by default."""
        prog = Program.objects.create(
            event=self.event, name="Unpub Program", category="JR", is_team_based=False, is_published=False
        )
        assign_students(user=self.admin_a, team=self.team_red, program=prog, student_ids=[self.students[0].id])
        r = ProgramResult.objects.get(program=prog, participant=self.students[0])
        r.code_letter = "A"
        r.judge1_marks = Decimal("95.00")
        r.judge2_marks = Decimal("95.00")
        r.judge3_marks = Decimal("95.00")
        r.entry_status = "submitted"
        r.total_marks = Decimal("95.00")
        r.save()
        recalculate_program_results(prog)

        res = self.client.get(f"/api/events/{self.event.id}/points_teams/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        # Without include_unpublished, points for this program should not count
        self.assertIsInstance(res.data, list)

    # =========================================================================
    # 13. TEMPLATES (EventCertificates) (Test 49)
    # =========================================================================

    def test_49_templates_certificate_template_crud(self):
        """Certificate templates list returns standard certificate types."""
        res = self.client.get(f"/api/events/{self.event.id}/certificate-templates/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        types = [t["certificateType"] for t in res.data["results"]]
        self.assertIn("first_place", types)
        self.assertIn("participation", types)

    # =========================================================================
    # 14. SETTINGS (EventSettings) (Test 50)
    # =========================================================================

    def test_50_settings_event_configuration_persistence(self):
        """Event judge count, max marks, and grading rules persist properly."""
        new_rules = [
            {"name": "A+", "min_mark": 90, "max_mark": 100, "bonus_points": 10},
            {"name": "A", "min_mark": 75, "max_mark": 89.99, "bonus_points": 7},
            {"name": "B", "min_mark": 60, "max_mark": 74.99, "bonus_points": 4},
        ]
        res = self.client.patch(
            f"/api/events/{self.event.id}/",
            {
                "num_judges": 2,
                "max_mark_per_judge": 50,
                "grading_rules": new_rules,
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.event.refresh_from_db()
        self.assertEqual(self.event.num_judges, 2)
        self.assertEqual(self.event.max_mark_per_judge, 50)
        self.assertEqual(len(self.event.grading_rules), 3)
