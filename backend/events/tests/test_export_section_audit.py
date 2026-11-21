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

        # Check Code Letter and Judge header columns appear
        self.assertIn("Code Letter", pdf['text'])
        self.assertIn("Judge 1", pdf['text'])
        self.assertIn("Powered by eventloo.in", pdf['text'])

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
        self.assertIn("Powered by eventloo.in", pdf_comp['text'])

        # Team Mode (PDF)
        res_team = self.client.get(f'/api/events/{self.event.id}/call-list/?mode=team&category=all&program_id=all&team_id={self.team_red.id}')
        self.assertEqual(res_team.status_code, 200)
        pdf_team = self.extract_pdf_text(res_team.content)
        self.assertIn("Red House", pdf_team['text'])
        self.assertNotIn("Blue House", pdf_team['text'])
        self.assertIn("Competitions", pdf_team['text'])
        self.assertIn("Category", pdf_team['text'])
        self.assertNotIn("(Code:", pdf_team['text'])
        self.assertIn("201", pdf_team['text'])
        self.assertIn("Participant1", pdf_team['text'])
        self.assertIn("Powered by eventloo.in", pdf_team['text'])

        # Team Mode (JSON Format)
        res_team_json = self.client.get(f'/api/events/{self.event.id}/call-list/?mode=team&category=all&program_id=all&team_id={self.team_red.id}&format=json')
        self.assertEqual(res_team_json.status_code, 200)
        json_data = res_team_json.json()
        self.assertIn('items', json_data)
        self.assertTrue(len(json_data['items']) > 0)
        first_item = json_data['items'][0]
        self.assertIn('chest_no', first_item)
        self.assertIn('participant_names', first_item)
        self.assertIn('category', first_item)
        self.assertIn('competitions', first_item)
        self.assertTrue(len(first_item['competitions']) > 0)

        # Participant List Mode (PDF)
        res_part = self.client.get(f'/api/events/{self.event.id}/call-list/?mode=participant&category=all&team_id=all')
        self.assertEqual(res_part.status_code, 200)
        pdf_part = self.extract_pdf_text(res_part.content)
        self.assertIn("Participant List", pdf_part['text'])
        self.assertIn("CHEST NO", pdf_part['text'])
        self.assertIn("STUDENT NAME", pdf_part['text'])
        self.assertIn("GENDER", pdf_part['text'])
        self.assertIn("CLASS", pdf_part['text'])
        self.assertIn("CATEGORY", pdf_part['text'])
        self.assertIn("TEAM", pdf_part['text'])
        self.assertIn("201", pdf_part['text'])
        self.assertIn("Participant1", pdf_part['text'])
        self.assertIn("Powered by eventloo.in", pdf_part['text'])

        # Participant List Mode (JSON Format)
        res_part_json = self.client.get(f'/api/events/{self.event.id}/call-list/?mode=participant&category=all&team_id={self.team_red.id}&format=json')
        self.assertEqual(res_part_json.status_code, 200)
        part_json_data = res_part_json.json()
        self.assertIn('items', part_json_data)
        self.assertTrue(len(part_json_data['items']) > 0)
        first_part = part_json_data['items'][0]
        self.assertIn('chest_no', first_part)
        self.assertIn('student_name', first_part)
        self.assertIn('gender', first_part)
        self.assertIn('class', first_part)
        self.assertIn('category', first_part)
        self.assertIn('team', first_part)

    def test_green_room_sign_sheet(self):
        res = self.client.get(f'/api/events/{self.event.id}/green-room-sign/?category=all&program_id=all')
        self.assertEqual(res.status_code, 200)
        pdf = self.extract_pdf_text(res.content)
        self.assertIn("Green Room Sign Sheet", pdf['text'])
        self.assertIn("Chest No", pdf['text'])
        self.assertIn("Participant", pdf['text'])
        self.assertIn("Code Letter", pdf['text'])
        self.assertIn("Powered by eventloo.in", pdf['text'])

    def test_winners_and_program_details_reports(self):
        # Winners report: only published program
        res_win = self.client.get(f'/api/events/{self.event.id}/reports/complete-results/')
        self.assertEqual(res_win.status_code, 200)
        pdf_win = self.extract_pdf_text(res_win.content)
        self.assertIn("LP Recitation English", pdf_win['text'])
        self.assertNotIn("LP Classical Music", pdf_win['text'])  # Unpublished
        self.assertIn("Powered by eventloo.in", pdf_win['text'])

        # Program details report
        res_det = self.client.get(f'/api/events/{self.event.id}/reports/program-details/')
        self.assertEqual(res_det.status_code, 200)
        pdf_det = self.extract_pdf_text(res_det.content)
        self.assertIn("LP Classical Music", pdf_det['text'])
        self.assertIn("Powered by eventloo.in", pdf_det['text'])

    def test_team_list_pdf_all_categories(self):
        res = self.client.get(f'/api/events/{self.event.id}/teams/{self.team_red.id}/program-list-pdf/')
        self.assertEqual(res.status_code, 200)
        pdf = self.extract_pdf_text(res.content)
        self.assertIn("Team: Red House", pdf['text'])
        self.assertIn("LP Classical Music", pdf['text'])
        self.assertIn("Powered by eventloo.in", pdf['text'])

    def test_green_room_and_valuation_sheet_display_shuffled_code_letters(self):
        from events.services import shuffle_program_code_letters
        shuffle_program_code_letters(self.p_lp_ind)

        # 1. Green Room Sheet
        res_gr = self.client.get(f'/api/events/{self.event.id}/green-room-sign/?program_id={self.p_lp_ind.id}')
        self.assertEqual(res_gr.status_code, 200)
        pdf_gr = self.extract_pdf_text(res_gr.content)
        self.assertIn("Green Room Sign Sheet", pdf_gr['text'])
        self.assertTrue("A" in pdf_gr['text'] or "B" in pdf_gr['text'])

        # 2. Valuation Sheet
        res_val = self.client.get(f'/api/events/{self.event.id}/valuation-sheet/?program_id={self.p_lp_ind.id}&copies=1')
        self.assertEqual(res_val.status_code, 200)
        pdf_val = self.extract_pdf_text(res_val.content)
        self.assertIn("VALUATION SHEET", pdf_val['text'])
        self.assertTrue("A" in pdf_val['text'] or "B" in pdf_val['text'])

        # 3. Calling Sheet: Code Letter column is NOT included in Call List
        res_call = self.client.get(f'/api/programs/{self.p_lp_ind.id}/formatted-calling-sheet/')
        self.assertEqual(res_call.status_code, 200)
        pdf_call = self.extract_pdf_text(res_call.content)
        self.assertNotIn("Code Letter", pdf_call['text'])

    def test_valuation_sheet_dynamic_judge_count(self):
        # 1. Test 4 judges: set program.num_judges = 4
        self.p_lp_ind.num_judges = 4
        self.p_lp_ind.save()

        res_4 = self.client.get(f'/api/events/{self.event.id}/valuation-sheet/?program_id={self.p_lp_ind.id}&copies=1')
        self.assertEqual(res_4.status_code, 200)
        pdf_4 = self.extract_pdf_text(res_4.content)
        self.assertIn("Judge 1", pdf_4['text'])
        self.assertIn("Judge 2", pdf_4['text'])
        self.assertIn("Judge 3", pdf_4['text'])
        self.assertIn("Judge 4", pdf_4['text'])
        self.assertIn("Judge 4 Name & Signature", pdf_4['text'])

        # 2. Test 2 judges: set program.num_judges = 2
        self.p_lp_ind.num_judges = 2
        self.p_lp_ind.save()

        res_2 = self.client.get(f'/api/events/{self.event.id}/valuation-sheet/?program_id={self.p_lp_ind.id}&copies=1')
        self.assertEqual(res_2.status_code, 200)
        pdf_2 = self.extract_pdf_text(res_2.content)
        self.assertIn("Judge 1", pdf_2['text'])
        self.assertIn("Judge 2", pdf_2['text'])
        self.assertNotIn("Judge 3", pdf_2['text'])
        self.assertNotIn("Judge 4", pdf_2['text'])

    def test_badge_export_layout_and_branding(self):
        res = self.client.get(f'/api/events/{self.event.id}/certificates/?cert_types=badge&quality=standard')
        self.assertEqual(res.status_code, 200)
        pdf = self.extract_pdf_text(res.content)
        self.assertIn("Powered by", pdf['text'])
        self.assertIn("Eventloo", pdf['text'])
        self.assertIn("Participant", pdf['text'])
        self.assertIn("SCAN TO VERIFY", pdf['text'])
        # Verify Programs section is removed from badge
        self.assertNotIn("PROGRAMS", pdf['text'])
