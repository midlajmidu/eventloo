import fitz
from io import BytesIO
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase
from events.models import Event, Program, ProgramAssignment, Team, ProgramResult, ChestNumber
from accounts.models import School, SchoolSettings

User = get_user_model()


class ExportSectionDeepAuditTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.school = School.objects.create(name="Audit Central Academy", code="ACA01", email="aca@example.com")
        cls.school_settings = SchoolSettings.objects.create(school=cls.school)

        cls.admin = User.objects.create_user(
            username="audit_admin_user",
            email="audit_admin@example.com",
            password="AdminPass123!@#",
            role="admin",
            school=cls.school,
            first_name="Audit",
            last_name="Admin"
        )

        cls.event = Event.objects.create(
            title="Kalotsav Grand Audit Meet",
            school=cls.school,
            created_by=cls.admin,
            num_judges=3,
            max_mark_per_judge=100,
            converted_total_mark=50,
            is_schedule_published=True,
            start_date="2026-11-20",
            end_date="2026-11-22"
        )

        cls.team_red = Team.objects.create(name="Red House", school=cls.school)
        cls.team_blue = Team.objects.create(name="Blue House", school=cls.school)

        cls.participants = []
        for i in range(1, 7):
            u = User.objects.create_user(
                username=f"kalo_stu_{i}",
                email=f"kalo_stu_{i}@example.com",
                password="StuPass123!@#",
                role="student",
                school=cls.school,
                first_name=f"Participant{i}",
                last_name="Test",
                gender="male" if i % 2 != 0 else "female",
                grade="9"
            )
            cls.participants.append(u)
            ChestNumber.objects.create(
                event=cls.event,
                student=u,
                chest_number=200 + i,
                team=cls.team_red if i <= 3 else cls.team_blue
            )

        # 1. LP Individual Program with 3 participants
        cls.p_lp_ind = Program.objects.create(
            event=cls.event,
            name="LP Classical Music",
            category="lp",
            is_team_based=False,
            num_judges=3,
            duration_minutes_per_entry=10
        )
        for p in cls.participants[:3]:
            ProgramAssignment.objects.create(program=cls.p_lp_ind, student=p, team=cls.team_red, chest_number=200 + cls.participants.index(p) + 1)

        # 2. UP Group Program with 2 teams (Team Red subteam 1, Team Blue subteam 1)
        cls.p_up_grp = Program.objects.create(
            event=cls.event,
            name="UP Folk Dance Group",
            category="up",
            is_team_based=True,
            team_size=2,
            num_judges=3,
            duration_minutes_per_entry=15
        )
        ProgramAssignment.objects.create(program=cls.p_up_grp, student=cls.participants[0], team=cls.team_red, chest_number=201, is_leader=True, sub_team_number=1)
        ProgramAssignment.objects.create(program=cls.p_up_grp, student=cls.participants[1], team=cls.team_red, chest_number=202, is_leader=False, sub_team_number=1)
        ProgramAssignment.objects.create(program=cls.p_up_grp, student=cls.participants[3], team=cls.team_blue, chest_number=204, is_leader=True, sub_team_number=1)
        ProgramAssignment.objects.create(program=cls.p_up_grp, student=cls.participants[4], team=cls.team_blue, chest_number=205, is_leader=False, sub_team_number=1)

        # 3. HS Individual Program with 0 participants
        cls.p_hs_empty = Program.objects.create(
            event=cls.event,
            name="HS Mono Act Empty",
            category="hs",
            is_team_based=False,
            num_judges=3
        )

        # 4. Published Program for Results Report
        cls.p_pub = Program.objects.create(
            event=cls.event,
            name="LP Recitation English",
            category="lp",
            is_team_based=False,
            is_published=True,
            num_judges=3
        )
        p_res = cls.participants[0]
        ProgramAssignment.objects.create(program=cls.p_pub, student=p_res, team=cls.team_red, chest_number=201)
        ProgramResult.objects.create(
            program=cls.p_pub,
            participant=p_res,
            team=cls.team_red,
            position=1,
            judge1_marks=48,
            judge2_marks=47,
            judge3_marks=49,
            total_marks=98,
            average_marks=48,
            points_earned=5,
            grade="A+",
            entry_status="submitted",
            code_letter="A"
        )

    def setUp(self):
        self.client.force_authenticate(user=self.admin)

    def extract_pdf_text(self, content):
        doc = fitz.open(stream=content, filetype="pdf")
        return {
            "page_count": len(doc),
            "text": "\n".join([page.get_text() for page in doc])
        }

    def test_valuation_sheet_filters_and_participant_rows(self):
        # All categories, only_with_participants=True
        res = self.client.get(f'/api/events/{self.event.id}/valuation-sheet/?category=all&program_id=all&only_with_participants=true&copies=1')
        self.assertEqual(res.status_code, 200)
        pdf = self.extract_pdf_text(res.content)
        self.assertEqual(pdf['page_count'], 3)  # 3 programs with participants (LP Music, UP Dance, LP Recitation)
        self.assertIn("LP CLASSICAL MUSIC", pdf['text'].upper())
        self.assertIn("UP FOLK DANCE GROUP", pdf['text'].upper())
        self.assertNotIn("HS MONO ACT EMPTY", pdf['text'].upper())

        # Check Code Letters A, B, C appear
        self.assertIn("A", pdf['text'])
        self.assertIn("B", pdf['text'])

        # Specific Category filter: category='lp'
        res_lp = self.client.get(f'/api/events/{self.event.id}/valuation-sheet/?category=lp&program_id=all&copies=1')
        self.assertEqual(res_lp.status_code, 200)
        pdf_lp = self.extract_pdf_text(res_lp.content)
        self.assertIn("LP CLASSICAL MUSIC", pdf_lp['text'].upper())
        self.assertNotIn("UP FOLK DANCE GROUP", pdf_lp['text'].upper())

        # Specific Program filter: program_id
        res_single = self.client.get(f'/api/events/{self.event.id}/valuation-sheet/?program_id={self.p_up_grp.id}&copies=1')
        self.assertEqual(res_single.status_code, 200)
        pdf_single = self.extract_pdf_text(res_single.content)
        self.assertEqual(pdf_single['page_count'], 1)
        self.assertIn("UP FOLK DANCE GROUP", pdf_single['text'].upper())
        self.assertNotIn("LP CLASSICAL MUSIC", pdf_single['text'].upper())

        # Copies test
        res_copies = self.client.get(f'/api/events/{self.event.id}/valuation-sheet/?program_id={self.p_up_grp.id}&copies=3')
        self.assertEqual(res_copies.status_code, 200)
        pdf_copies = self.extract_pdf_text(res_copies.content)
        self.assertEqual(pdf_copies['page_count'], 3)

    def test_call_list_competition_and_team_modes(self):
        # Competition Mode
        res_comp = self.client.get(f'/api/events/{self.event.id}/call-list/?mode=competition&category=all&program_id=all')
        self.assertEqual(res_comp.status_code, 200)
        pdf_comp = self.extract_pdf_text(res_comp.content)
        self.assertIn("Competitions Call List", pdf_comp['text'])
        self.assertIn("Red House", pdf_comp['text'])
        self.assertIn("201", pdf_comp['text'])
        self.assertIn("Participant1", pdf_comp['text'])
        self.assertIn("Total participants:", pdf_comp['text'])

        # Team Mode
        res_team = self.client.get(f'/api/events/{self.event.id}/call-list/?mode=team&category=all&program_id=all&team_id={self.team_red.id}')
        self.assertEqual(res_team.status_code, 200)
        pdf_team = self.extract_pdf_text(res_team.content)
        self.assertIn("Red House", pdf_team['text'])
        self.assertNotIn("Blue House", pdf_team['text'])

    def test_green_room_sign_sheet(self):
        res = self.client.get(f'/api/events/{self.event.id}/green-room-sign/?category=all&program_id=all')
        self.assertEqual(res.status_code, 200)
        pdf = self.extract_pdf_text(res.content)
        self.assertIn("Green Room Sign Sheet", pdf['text'])
        self.assertIn("Chest No", pdf['text'])
        self.assertIn("Participant", pdf['text'])
        self.assertIn("Code Letter", pdf['text'])

    def test_winners_and_program_details_reports(self):
        # Winners report: only published program
        res_win = self.client.get(f'/api/events/{self.event.id}/reports/complete-results/')
        self.assertEqual(res_win.status_code, 200)
        pdf_win = self.extract_pdf_text(res_win.content)
        self.assertIn("LP Recitation English", pdf_win['text'])
        self.assertNotIn("LP Classical Music", pdf_win['text'])  # Unpublished

        # Program details report
        res_det = self.client.get(f'/api/events/{self.event.id}/reports/program-details/')
        self.assertEqual(res_det.status_code, 200)
        pdf_det = self.extract_pdf_text(res_det.content)
        self.assertIn("LP Classical Music", pdf_det['text'])

    def test_team_list_pdf_all_categories(self):
        res = self.client.get(f'/api/events/{self.event.id}/teams/{self.team_red.id}/program-list-pdf/')
        self.assertEqual(res.status_code, 200)
        pdf = self.extract_pdf_text(res.content)
        self.assertIn("Team: Red House", pdf['text'])
        self.assertIn("LP Classical Music", pdf['text'])
