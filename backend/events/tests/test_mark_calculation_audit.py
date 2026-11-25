from decimal import Decimal
from django.test import TestCase
from accounts.models import School, User
from events.models import Event, Program, ProgramAssignment, ProgramResult, Team, EventJudge, ProgramJudgeAssignment
from events.services import recalculate_program_results


class MarkCalculationAuditTestCase(TestCase):
    def setUp(self):
        self.school = School.objects.create(
            name="Audit Test School",
            code="AUDIT01",
            email="audit@example.com",
            status="active",
        )
        self.admin = User.objects.create_user(
            username="audit_admin",
            email="audit_admin@example.com",
            password="testpassword123",
            role="admin",
            school=self.school,
        )
        self.team1 = Team.objects.create(name="Team Emerald", school=self.school)
        self.team2 = Team.objects.create(name="Team Ruby", school=self.school)

        self.student1 = User.objects.create_user(
            username="stud1", email="stud1@example.com", role="student", school=self.school,
            first_name="Alice", last_name="Walker"
        )
        self.student2 = User.objects.create_user(
            username="stud2", email="stud2@example.com", role="student", school=self.school,
            first_name="Bob", last_name="Smith"
        )
        self.student3 = User.objects.create_user(
            username="stud3", email="stud3@example.com", role="student", school=self.school,
            first_name="Charlie", last_name="Brown"
        )
        self.team1.members.add(self.student1)
        self.team2.members.add(self.student2)
        self.team1.members.add(self.student3)

        self.event = Event.objects.create(
            title="Annual Fest 2026",
            school=self.school,
            created_by=self.admin,
            start_date="2026-11-20",
            end_date="2026-11-22",
            status="published",
            num_judges=2,
            max_mark_per_judge=Decimal("100.00"),
            converted_total_mark=Decimal("100.00"),
        )

    def test_offline_mark_calculation_and_point_allocation(self):
        """Audit that offline programs calculate marks, ranks, and team points correctly."""
        prog = Program.objects.create(
            event=self.event,
            name="Offline Classical Solo",
            category="general",
            judging_mode="offline",
            num_judges=2,
            has_custom_points=True,
            first_place_points=10,
            second_place_points=5,
            third_place_points=3,
        )
        r1 = ProgramResult.objects.create(
            program=prog, participant=self.student1, team=self.team1,
            code_letter="A", judge1_marks=Decimal("90.00"), judge2_marks=Decimal("94.00"),
            entry_status="submitted",
        )
        r2 = ProgramResult.objects.create(
            program=prog, participant=self.student2, team=self.team2,
            code_letter="B", judge1_marks=Decimal("80.00"), judge2_marks=Decimal("82.00"),
            entry_status="submitted",
        )

        # Audit score aggregation on save
        self.assertEqual(r1.raw_total_marks, Decimal("184.00"))
        self.assertEqual(r1.average_marks, Decimal("92.00"))
        self.assertEqual(r1.total_marks, Decimal("92.00"))

        self.assertEqual(r2.raw_total_marks, Decimal("162.00"))
        self.assertEqual(r2.average_marks, Decimal("81.00"))
        self.assertEqual(r2.total_marks, Decimal("81.00"))

        # Recalculate results
        recalculate_program_results(prog)
        r1.refresh_from_db()
        r2.refresh_from_db()

        # Alice should be 1st, Bob should be 2nd
        self.assertEqual(r1.position, 1)
        self.assertGreater(r1.points_earned, 0)
        self.assertEqual(r2.position, 2)
        self.assertGreater(r2.points_earned, 0)
        self.assertGreater(r1.points_earned, r2.points_earned)

    def test_online_judging_multi_judge_aggregation_and_override(self):
        """Audit online judging flow: drafts do not affect leaderboard, locks recalculate, admin can override."""
        prog = Program.objects.create(
            event=self.event,
            name="Online Western Solo",
            category="general",
            judging_mode="online",
            num_judges=2,
            has_custom_points=True,
            first_place_points=10,
            second_place_points=5,
            third_place_points=3,
        )
        pa1 = ProgramAssignment.objects.create(program=prog, student=self.student1, team=self.team1)
        pa2 = ProgramAssignment.objects.create(program=prog, student=self.student2, team=self.team2)

        j1 = EventJudge.objects.create(event=self.event, school=self.school, name="Judge One", email="j1@test.com", default_judge_number=1)
        j2 = EventJudge.objects.create(event=self.event, school=self.school, name="Judge Two", email="j2@test.com", default_judge_number=2)

        assign1 = ProgramJudgeAssignment.objects.create(judge=j1, program=prog, judge_number=1)
        assign2 = ProgramJudgeAssignment.objects.create(judge=j2, program=prog, judge_number=2)

        res1 = ProgramResult.objects.create(program=prog, participant=self.student1, team=self.team1, entry_status="draft")
        res2 = ProgramResult.objects.create(program=prog, participant=self.student2, team=self.team2, entry_status="draft")

        # Judge 1 saves draft scores via judge_save_marks endpoint
        from django.test import RequestFactory
        from events.views import judge_save_marks
        factory = RequestFactory()

        req1 = factory.post(
            f"/api/events/judges/portal/{j1.access_token}/programs/{prog.id}/save-marks/",
            data={
                "marks": [
                    {"result_id": res1.id, "mark": 85.0, "comments": "Nice tempo"},
                    {"result_id": res2.id, "mark": 95.0, "comments": "Strong vocals"},
                ],
                "is_final_lock": False,
            },
            content_type="application/json",
        )
        resp1 = judge_save_marks(req1, j1.access_token, prog.id)
        self.assertEqual(resp1.status_code, 200)

        # Audit: draft entries must NOT affect leaderboard
        res1.refresh_from_db()
        res2.refresh_from_db()
        self.assertEqual(res1.entry_status, "draft")
        self.assertIsNone(res1.position)
        self.assertEqual(res1.points_earned, 0)

        # Judge 1 locks evaluation
        req1_lock = factory.post(
            f"/api/events/judges/portal/{j1.access_token}/programs/{prog.id}/save-marks/",
            data={
                "marks": [
                    {"result_id": res1.id, "mark": 85.0},
                    {"result_id": res2.id, "mark": 95.0},
                ],
                "is_final_lock": True,
            },
            content_type="application/json",
        )
        resp1_lock = judge_save_marks(req1_lock, j1.access_token, prog.id)
        self.assertEqual(resp1_lock.status_code, 200)

        # Still draft because Judge 2 hasn't submitted yet
        res1.refresh_from_db()
        self.assertEqual(res1.entry_status, "draft")

        # Now Judge 2 locks evaluation
        req2_lock = factory.post(
            f"/api/events/judges/portal/{j2.access_token}/programs/{prog.id}/save-marks/",
            data={
                "marks": [
                    {"result_id": res1.id, "mark": 87.0},
                    {"result_id": res2.id, "mark": 91.0},
                ],
                "is_final_lock": True,
            },
            content_type="application/json",
        )
        resp2_lock = judge_save_marks(req2_lock, j2.access_token, prog.id)
        self.assertEqual(resp2_lock.status_code, 200)

        # Both judges locked! ProgramResults should now be submitted and ranked!
        res1.refresh_from_db()
        res2.refresh_from_db()
        self.assertEqual(res1.entry_status, "submitted")
        self.assertEqual(res2.entry_status, "submitted")

        # Res 2: 95 + 91 = 186 / 200 * 100 = 93.00
        # Res 1: 85 + 87 = 172 / 200 * 100 = 86.00
        self.assertEqual(res2.total_marks, Decimal("93.00"))
        self.assertEqual(res1.total_marks, Decimal("86.00"))
        self.assertEqual(res2.position, 1)
        self.assertEqual(res1.position, 2)
        self.assertGreater(res2.points_earned, res1.points_earned)

        # Now audit Admin Override: coordinator overrides marks to give res1 98 marks in judge2
        from events.views import ProgramResultViewSet
        view = ProgramResultViewSet.as_view({'post': 'bulk_mark_entry'})
        override_req = factory.post(
            f"/api/events/{self.event.id}/programs/{prog.id}/results/bulk_mark_entry/",
            data={
                "marks": [
                    {
                        "id": res1.id,
                        "code_letter": res1.code_letter,
                        "judge1_marks": 96.0,
                        "judge2_marks": 98.0,
                    },
                    {
                        "id": res2.id,
                        "code_letter": res2.code_letter,
                        "judge1_marks": 95.0,
                        "judge2_marks": 91.0,
                    },
                ],
                "entry_status": "submitted",
            },
            content_type="application/json",
        )
        from rest_framework.test import force_authenticate
        force_authenticate(override_req, user=self.admin)
        override_resp = view(override_req, event_pk=self.event.id, program_pk=prog.id)
        self.assertEqual(override_resp.status_code, 200)

        # Res 1 is now 1st position after override!
        res1.refresh_from_db()
        res2.refresh_from_db()
        self.assertEqual(res1.total_marks, Decimal("97.00"))
        self.assertEqual(res2.total_marks, Decimal("93.00"))
        self.assertEqual(res1.position, 1)
        self.assertEqual(res2.position, 2)
