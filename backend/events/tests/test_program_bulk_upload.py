"""
Automated Test Suite for Program Bulk Upload and Reference Template Generation
Validates:
1. Multi-sheet Excel template generator (Programs, Setup, Example, Instructions)
2. Successful batch import of solo and group programs
3. Structured error responses with row-by-row pinpointing:
   - Missing required columns
   - Invalid category
   - Invalid program type
   - Invalid competition mode
   - Group program missing team_size
   - Individual program missing max_participants
   - Intra-file duplicate program titles
   - Database duplicate program titles
   - Invalid duration minutes
   - Invalid judges count
"""

import io
import openpyxl
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework import status

from accounts.models import School, SchoolSettings, StudentCategory
from events.models import Event, EventProgramType, Program

User = get_user_model()


class ProgramBulkUploadTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        # 1. School setup
        cls.school = School.objects.create(
            name="Greenwood High", code="GWD01", email="info@greenwood.edu"
        )
        cls.school_settings = SchoolSettings.objects.create(school=cls.school)

        # 2. Categories
        cls.cat_junior = StudentCategory.objects.create(
            school=cls.school, name="Junior", code="JR"
        )
        cls.cat_senior = StudentCategory.objects.create(
            school=cls.school, name="Senior", code="SR"
        )
        cls.cat_general = StudentCategory.objects.create(
            school=cls.school, name="General", code="general", is_mixing=True
        )

        # 3. Admin user
        cls.admin = User.objects.create_user(
            username="admin_greenwood",
            email="admin@greenwood.edu",
            password="AdminPassword123!",
            role="admin",
            school=cls.school,
        )

        # 4. Event
        cls.event = Event.objects.create(
            title="Greenwood Cultural Fest 2026",
            school=cls.school,
            created_by=cls.admin,
            start_date="2026-11-20",
            end_date="2026-11-23",
            num_judges=3,
            status="published",
        )

        # 5. Program Types
        cls.pt_stage = EventProgramType.objects.create(
            event=cls.event, name="Stage Event", code="stage", is_stage_based=True
        )
        cls.pt_offstage = EventProgramType.objects.create(
            event=cls.event, name="Off-Stage Event", code="off_stage", is_stage_based=False
        )

    def setUp(self):
        self.client.force_authenticate(user=self.admin)

    def _create_program_excel_file(self, rows, headers=None):
        """Helper to create an in-memory .xlsx file from rows"""
        if headers is None:
            headers = [
                "Name", "Category", "Type", "Mode", "Max Participants",
                "Team Size", "Max Sub-Teams", "Team Capacity", "Duration Minutes",
                "Judges (Optional)"
            ]
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Programs"
        ws.append(headers)
        for r in rows:
            ws.append(r)
        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)
        return SimpleUploadedFile(
            "programs_test.xlsx",
            buf.read(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )

    def test_01_download_program_template_structure(self):
        """Template generation endpoint returns 4-sheet workbook with dropdowns, examples, and instructions."""
        res = self.client.get(f"/api/events/{self.event.id}/download_program_template/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("application/vnd.openxmlformats-officedocument", res["Content-Type"])

        wb = openpyxl.load_workbook(io.BytesIO(res.content))
        sheet_names = wb.sheetnames
        self.assertIn("Programs", sheet_names)
        self.assertIn("Setup", sheet_names)
        self.assertIn("Example", sheet_names)
        self.assertIn("Instructions", sheet_names)

        # Verify Programs headers
        ws_prog = wb["Programs"]
        headers = [c.value for c in ws_prog[1]]
        self.assertIn("Name", headers)
        self.assertIn("Category", headers)
        self.assertIn("Type", headers)
        self.assertIn("Mode", headers)
        self.assertIn("Duration Minutes", headers)

        # Verify Setup contents
        ws_setup = wb["Setup"]
        setup_cats = [ws_setup.cell(row=i, column=1).value for i in range(2, ws_setup.max_row + 1) if ws_setup.cell(row=i, column=1).value]
        self.assertIn("General", setup_cats)
        self.assertIn("Junior", setup_cats)
        self.assertIn("Senior", setup_cats)

        # Verify Examples
        ws_example = wb["Example"]
        self.assertGreaterEqual(ws_example.max_row, 3)

        # Verify Instructions
        ws_inst = wb["Instructions"]
        self.assertGreaterEqual(ws_inst.max_row, 5)

    def test_02_bulk_upload_successful_solo_and_group(self):
        """Successfully import valid individual and team programs in a single atomic batch."""
        rows = [
            ["Elocution English Solo", "Junior", "Stage Event", "Individual", 20, "", "", "", 5, 3],
            ["Folk Dance Group Fest", "Senior", "Stage Event", "Group", "", 6, 1, 6, 10, 3],
            ["Pencil Sketching", "Junior", "Off-Stage Event", "Individual", 30, "", "", "", 60, 2],
            ["Quiz Challenge", "General", "Off-Stage Event", "Group", "", 4, 2, 8, 45, 2],
        ]
        upload_file = self._create_program_excel_file(rows)
        res = self.client.post(
            f"/api/events/{self.event.id}/bulk_upload_programs/",
            {"file": upload_file},
            format="multipart",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data["success"])
        self.assertEqual(res.data["summary"]["successful_creations"], 4)

        # Verify database objects
        solo = Program.objects.get(event=self.event, name="Elocution English Solo")
        self.assertFalse(solo.is_team_based)
        self.assertEqual(solo.category, "JR")
        self.assertEqual(solo.max_participants, 20)
        self.assertEqual(solo.duration_minutes_per_entry, 5)
        self.assertEqual(solo.num_judges, 3)

        group = Program.objects.get(event=self.event, name="Folk Dance Group Fest")
        self.assertTrue(group.is_team_based)
        self.assertEqual(group.category, "SR")
        self.assertEqual(group.team_size, 6)
        self.assertEqual(group.duration_minutes_per_entry, 10)

        gen_group = Program.objects.get(event=self.event, name="Quiz Challenge")
        self.assertEqual(gen_group.category, "general")
        self.assertTrue(gen_group.is_team_based)
        self.assertEqual(gen_group.team_size, 4)

    def test_03_bulk_upload_missing_required_columns(self):
        """Missing required headers returns structured row 1 error with suggestions."""
        incomplete_headers = ["Name", "Category", "Mode"]  # Missing Type and Duration
        rows = [["Solo Song", "Junior", "Individual"]]
        upload_file = self._create_program_excel_file(rows, headers=incomplete_headers)

        res = self.client.post(
            f"/api/events/{self.event.id}/bulk_upload_programs/",
            {"file": upload_file},
            format="multipart",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("structured_errors", res.data)
        struct = res.data["structured_errors"]
        self.assertTrue(any(e["field"] == "header" for e in struct))
        self.assertIn("suggestions", res.data)

    def test_04_bulk_upload_invalid_category_error(self):
        """Unrecognized category returns row-level structured error with valid options."""
        rows = [
            ["Solo Violin", "NON_EXISTENT_CAT", "Stage Event", "Individual", 15, "", "", "", 5, 2]
        ]
        upload_file = self._create_program_excel_file(rows)
        res = self.client.post(
            f"/api/events/{self.event.id}/bulk_upload_programs/",
            {"file": upload_file},
            format="multipart",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        struct = res.data["structured_errors"]
        self.assertEqual(len(struct), 1)
        self.assertEqual(struct[0]["row"], 2)
        self.assertEqual(struct[0]["field"], "category")
        self.assertIn("Junior", struct[0]["suggestion"])

    def test_05_bulk_upload_invalid_type_error(self):
        """Unrecognized program type returns structured error."""
        rows = [
            ["Skydiving", "Junior", "Space Mission", "Individual", 15, "", "", "", 5, 2]
        ]
        upload_file = self._create_program_excel_file(rows)
        res = self.client.post(
            f"/api/events/{self.event.id}/bulk_upload_programs/",
            {"file": upload_file},
            format="multipart",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        struct = res.data["structured_errors"]
        self.assertEqual(struct[0]["field"], "type")
        self.assertIn("Stage Event", struct[0]["suggestion"])

    def test_06_bulk_upload_invalid_mode_error(self):
        """Invalid mode string returns structured error instructing Individual or Group."""
        rows = [
            ["Solo Flute", "Junior", "Stage Event", "HYBRID_UNKNOWN", 15, "", "", "", 5, 2]
        ]
        upload_file = self._create_program_excel_file(rows)
        res = self.client.post(
            f"/api/events/{self.event.id}/bulk_upload_programs/",
            {"file": upload_file},
            format="multipart",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        struct = res.data["structured_errors"]
        self.assertEqual(struct[0]["field"], "mode")

    def test_07_bulk_upload_group_missing_team_size(self):
        """Group program without Team Size returns validation error."""
        rows = [
            ["Folk Orchestra", "Senior", "Stage Event", "Group", "", "", 1, "", 15, 3]  # Team Size is empty
        ]
        upload_file = self._create_program_excel_file(rows)
        res = self.client.post(
            f"/api/events/{self.event.id}/bulk_upload_programs/",
            {"file": upload_file},
            format="multipart",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        struct = res.data["structured_errors"]
        self.assertEqual(struct[0]["field"], "team_size")

    def test_08_bulk_upload_individual_missing_max_participants(self):
        """Individual program without Max Participants returns validation error."""
        rows = [
            ["Classical Solo", "Junior", "Stage Event", "Individual", "", "", "", "", 5, 3]  # Max Participants empty
        ]
        upload_file = self._create_program_excel_file(rows)
        res = self.client.post(
            f"/api/events/{self.event.id}/bulk_upload_programs/",
            {"file": upload_file},
            format="multipart",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        struct = res.data["structured_errors"]
        self.assertEqual(struct[0]["field"], "max_participants")

    def test_09_bulk_upload_intra_file_duplicate(self):
        """Duplicate program title with the SAME category within the uploaded spreadsheet is detected and flagged."""
        rows = [
            ["Clay Modeling", "Junior", "Off-Stage Event", "Individual", 25, "", "", "", 60, 2],
            ["Clay Modeling", "Junior", "Off-Stage Event", "Individual", 25, "", "", "", 60, 2],  # Duplicate on row 3 (same category)
        ]
        upload_file = self._create_program_excel_file(rows)
        res = self.client.post(
            f"/api/events/{self.event.id}/bulk_upload_programs/",
            {"file": upload_file},
            format="multipart",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        struct = res.data["structured_errors"]
        self.assertTrue(any(e["field"] == "duplicate" for e in struct))
        dup_err = [e for e in struct if e["field"] == "duplicate"][0]
        self.assertEqual(dup_err["row"], 3)
        self.assertIn("previously on row 2", dup_err["reason"])

    def test_09b_bulk_upload_same_name_different_category_allowed(self):
        """Same program title across DIFFERENT categories is allowed and creates both programs."""
        rows = [
            ["Elocution English", "Junior", "Stage Event", "Individual", 20, "", "", "", 5, 3],
            ["Elocution English", "Senior", "Stage Event", "Individual", 20, "", "", "", 5, 3],
        ]
        upload_file = self._create_program_excel_file(rows)
        res = self.client.post(
            f"/api/events/{self.event.id}/bulk_upload_programs/",
            {"file": upload_file},
            format="multipart",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data["success"])
        self.assertEqual(res.data["summary"]["successful_creations"], 2)

        jr_prog = Program.objects.get(event=self.event, name="Elocution English", category="JR")
        sr_prog = Program.objects.get(event=self.event, name="Elocution English", category="SR")
        self.assertIsNotNone(jr_prog)
        self.assertIsNotNone(sr_prog)
        self.assertNotEqual(jr_prog.id, sr_prog.id)

    def test_10_bulk_upload_database_duplicate_program(self):
        """Program title that already exists in the same category is detected, but different category succeeds."""
        Program.objects.create(
            event=self.event,
            name="Kathakali Solo Existing",
            category="JR",
            program_type="stage",
        )
        # 1. Same name in same category (Junior / JR) -> should fail
        rows_dup = [
            ["Kathakali Solo Existing", "Junior", "Stage Event", "Individual", 15, "", "", "", 10, 3]
        ]
        upload_file = self._create_program_excel_file(rows_dup)
        res = self.client.post(
            f"/api/events/{self.event.id}/bulk_upload_programs/",
            {"file": upload_file},
            format="multipart",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        struct = res.data["structured_errors"]
        self.assertTrue(any(e["field"] == "duplicate" for e in struct))
        self.assertIn("already exists", struct[0]["reason"])

        # 2. Same name in different category (Senior / SR) -> should succeed
        rows_diff_cat = [
            ["Kathakali Solo Existing", "Senior", "Stage Event", "Individual", 15, "", "", "", 10, 3]
        ]
        upload_file_sr = self._create_program_excel_file(rows_diff_cat)
        res_sr = self.client.post(
            f"/api/events/{self.event.id}/bulk_upload_programs/",
            {"file": upload_file_sr},
            format="multipart",
        )
        self.assertEqual(res_sr.status_code, status.HTTP_200_OK)
        self.assertTrue(res_sr.data["success"])
        self.assertTrue(Program.objects.filter(event=self.event, name="Kathakali Solo Existing", category="SR").exists())

    def test_11_bulk_upload_invalid_judges_count(self):
        """Judge count exceeding 4 or less than 1 returns validation issue."""
        rows = [
            ["Light Music Solo", "Junior", "Stage Event", "Individual", 15, "", "", "", 5, 9]  # 9 judges is invalid
        ]
        upload_file = self._create_program_excel_file(rows)
        res = self.client.post(
            f"/api/events/{self.event.id}/bulk_upload_programs/",
            {"file": upload_file},
            format="multipart",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        struct = res.data["structured_errors"]
        self.assertEqual(struct[0]["field"], "judges")

    def test_12_category_not_in_school_settings_rejected(self):
        """Uploading a category not configured in School Settings returns an error."""
        rows = [
            ["Unconfigured Program", "Alpha Cadre", "Stage Event", "Individual", 15, "", "", "", 5, 3]
        ]
        upload_file = self._create_program_excel_file(rows)
        res = self.client.post(
            f"/api/events/{self.event.id}/bulk_upload_programs/",
            {"file": upload_file},
            format="multipart",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        struct = res.data["structured_errors"]
        self.assertEqual(struct[0]["field"], "category")
        self.assertIn("not configured for your school", struct[0]["reason"])
