from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from accounts.models import School
from events.models import Event, Program, ProgramAssignment, ProgramResult, Team, EventJudge, ProgramJudgeAssignment

User = get_user_model()


class OnlineJudgingTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Create school
        self.school = School.objects.create(name="St. Mary Academy", code="stmary", email="info@stmary.edu", status="active")
        self.school_other = School.objects.create(name="Greenwood High", code="greenwood", email="info@greenwood.edu", status="active")

        # Create admin user
        self.admin = User.objects.create_user(
            username="admin@stmary.edu",
            email="admin@stmary.edu",
            password="adminpassword123",
            role="admin",
            school=self.school,
        )

        # Create event
        self.event = Event.objects.create(
            title="Annual Arts Fest 2026",
            school=self.school,
            created_by=self.admin,
            start_date="2026-11-20",
            end_date="2026-11-22",
            num_judges=2,
            max_mark_per_judge=100.00,
            converted_total_mark=100.00,
        )

        # Create teams
        self.team_red = Team.objects.create(name="Red House", school=self.school)
        self.team_blue = Team.objects.create(name="Blue House", school=self.school)

        # Create students
        self.student1 = User.objects.create_user(
            username="stud1@stmary.edu",
            email="stud1@stmary.edu",
            password="pass",
            role="student",
            school=self.school,
            first_name="Alice",
            last_name="Wonder",
        )
        self.student2 = User.objects.create_user(
            username="stud2@stmary.edu",
            email="stud2@stmary.edu",
            password="pass",
            role="student",
            school=self.school,
            first_name="Bob",
            last_name="Builder",
        )

        # Create programs (one offline, one online)
        self.prog_offline = Program.objects.create(
            event=self.event,
            name="Classical Dance",
            category="general",
            judging_mode="offline",
            num_judges=2,
        )
        self.prog_online = Program.objects.create(
            event=self.event,
            name="Light Music Solo",
            category="general",
            judging_mode="online",
            num_judges=2,
        )

        # Assign students
        self.assg1 = ProgramAssignment.objects.create(
            program=self.prog_online,
            student=self.student1,
            team=self.team_red,
            chest_number=101,
        )
        self.assg2 = ProgramAssignment.objects.create(
            program=self.prog_online,
            student=self.student2,
            team=self.team_blue,
            chest_number=102,
        )

        # Ensure results exist
        self.res1, _ = ProgramResult.objects.get_or_create(
            program=self.prog_online,
            participant=self.student1,
            defaults={'team': self.team_red, 'code_letter': 'A'}
        )
        self.res2, _ = ProgramResult.objects.get_or_create(
            program=self.prog_online,
            participant=self.student2,
            defaults={'team': self.team_blue, 'code_letter': 'B'}
        )

    def test_program_judging_mode_default_and_online(self):
        self.assertEqual(self.prog_offline.judging_mode, 'offline')
        self.assertEqual(self.prog_online.judging_mode, 'online')

    def test_create_event_judge_and_auto_tokens(self):
        judge = EventJudge.objects.create(
            event=self.event,
            name="Dr. S. Rahman",
            email="rahman@music.org",
            designation="Chief Vocal Evaluator",
            default_judge_number=1,
        )
        self.assertEqual(judge.school, self.school)
        self.assertTrue(len(judge.access_token) >= 32)
        self.assertTrue(len(judge.access_pin) == 4)
        self.assertEqual(judge.default_judge_number, 1)

    def test_assign_programs_to_judge(self):
        judge = EventJudge.objects.create(
            event=self.event,
            name="Prof. Sarah Lee",
            default_judge_number=1,
        )
        self.client.force_authenticate(user=self.admin)
        url = f"/api/events/{self.event.id}/judges/{judge.id}/assign_programs/"
        response = self.client.post(url, {
            'assignments': [
                {'program_id': self.prog_online.id, 'judge_number': 1}
            ]
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(judge.program_assignments.count(), 1)
        assg = judge.program_assignments.first()
        self.assertEqual(assg.program, self.prog_online)
        self.assertEqual(assg.judge_number, 1)
        self.assertEqual(assg.status, 'pending')

    def test_public_judge_portal_info(self):
        judge = EventJudge.objects.create(
            event=self.event,
            name="Mr. David",
            default_judge_number=1,
        )
        ProgramJudgeAssignment.objects.create(
            judge=judge,
            program=self.prog_online,
            judge_number=1,
        )
        portal_url = f"/api/judge/portal/{judge.access_token}/"
        res = self.client.get(portal_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['judge']['name'], "Mr. David")
        self.assertEqual(res.data['event']['title'], "Annual Arts Fest 2026")
        self.assertEqual(len(res.data['programs']), 1)
        self.assertEqual(res.data['programs'][0]['name'], "Light Music Solo")

    def test_public_judge_portal_pin_verification(self):
        judge = EventJudge.objects.create(
            event=self.event,
            name="Mr. David",
            access_pin="1234",
        )
        url = f"/api/judge/portal/{judge.access_token}/verify-pin/"
        res_fail = self.client.post(url, {'pin': '9999'}, format='json')
        self.assertEqual(res_fail.status_code, status.HTTP_400_BAD_REQUEST)

        res_ok = self.client.post(url, {'pin': '1234'}, format='json')
        self.assertEqual(res_ok.status_code, status.HTTP_200_OK)
        self.assertTrue(res_ok.data['verified'])

    def test_public_judge_score_sheet_anonymity(self):
        judge = EventJudge.objects.create(
            event=self.event,
            name="Judge Anonymous",
            default_judge_number=1,
        )
        ProgramJudgeAssignment.objects.create(
            judge=judge,
            program=self.prog_online,
            judge_number=1,
        )
        sheet_url = f"/api/judge/portal/{judge.access_token}/programs/{self.prog_online.id}/score-sheet/"
        res = self.client.get(sheet_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        candidates = res.data['candidates']
        self.assertEqual(len(candidates), 2)

        # Strict Anonymity Verification: Check candidate payload
        for cand in candidates:
            self.assertIn('code_letter', cand)
            self.assertIn('chest_number', cand)
            self.assertIn('current_mark', cand)
            # Crucial: names and emails must not be present in candidate object
            self.assertNotIn('student_name', cand)
            self.assertNotIn('participant_name', cand)
            self.assertNotIn('team_name', cand)
            self.assertNotIn('student', cand)
            self.assertNotIn('email', cand)

    def test_judge_save_marks_draft_and_final_lock(self):
        judge1 = EventJudge.objects.create(
            event=self.event,
            name="Judge 1",
            default_judge_number=1,
        )
        assg1 = ProgramJudgeAssignment.objects.create(
            judge=judge1,
            program=self.prog_online,
            judge_number=1,
        )

        save_url = f"/api/judge/portal/{judge1.access_token}/programs/{self.prog_online.id}/save-marks/"
        
        # 1. Draft save
        draft_payload = {
            'marks': [
                {'result_id': self.res1.id, 'mark': 92.5, 'comments': 'Vocal clarity is superb'},
                {'result_id': self.res2.id, 'mark': 85.0, 'comments': 'Good rhythm'},
            ],
            'is_final_lock': False,
        }
        res_draft = self.client.post(save_url, draft_payload, format='json')
        self.assertEqual(res_draft.status_code, status.HTTP_200_OK)
        self.assertFalse(res_draft.data['is_locked'])

        # Verify marks updated on ProgramResult
        self.res1.refresh_from_db()
        self.res2.refresh_from_db()
        self.assertEqual(self.res1.judge1_marks, Decimal('92.50'))
        self.assertEqual(self.res2.judge1_marks, Decimal('85.00'))
        self.assertEqual(self.res1.comments, 'Vocal clarity is superb')

        assg1.refresh_from_db()
        self.assertEqual(assg1.status, 'in_progress')
        self.assertFalse(assg1.is_locked)

        # 2. Final Lock
        lock_payload = {
            'marks': [
                {'result_id': self.res1.id, 'mark': 95.0, 'comments': 'Masterpiece'},
                {'result_id': self.res2.id, 'mark': 88.0, 'comments': 'Great effort'},
            ],
            'is_final_lock': True,
        }
        res_lock = self.client.post(save_url, lock_payload, format='json')
        self.assertEqual(res_lock.status_code, status.HTTP_200_OK)
        self.assertTrue(res_lock.data['is_locked'])

        assg1.refresh_from_db()
        self.assertEqual(assg1.status, 'completed')
        self.assertTrue(assg1.is_locked)
        self.assertIsNotNone(assg1.locked_at)

        # 3. Locked assessment rejects further modifications
        res_blocked = self.client.post(save_url, draft_payload, format='json')
        self.assertEqual(res_blocked.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('locked', res_blocked.data['error'].lower())
