from datetime import datetime, time, timedelta
from decimal import Decimal
from io import BytesIO
import json

from django.core.exceptions import ValidationError
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.urls import Resolver404, resolve
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import School, SchoolSettings, StudentCategory, StudentClass, User
from accounts.upload_security import validate_excel_upload
from events.models import CertificateTemplate, ChestNumber, Event, EventStage, PointsRecord, Program, ProgramAssignment, ProgramResult, Team
from events.certificate_config import default_certificate_fields
from events.services import assign_students, program_results_complete, recalculate_program_results
from events.views import get_grouped_assignments_for_report


class EventBusinessLogicTests(TestCase):
    def setUp(self):
        self.school = School.objects.create(name='Test School', code='test-school')
        self.admin = User.objects.create_user(
            username='admin', email='admin@example.com', password='test-pass', role='admin',
            school=self.school,
        )
        self.category = StudentCategory.objects.create(name='Junior', code='junior', school=self.school)
        today = timezone.localdate()
        self.event = Event.objects.create(
            title='Integrity Test', start_date=today, end_date=today + timedelta(days=1),
            registration_deadline=timezone.now() + timedelta(days=1), status='published',
            created_by=self.admin, num_judges=2, max_mark_per_judge=50,
            converted_total_mark=100, enable_grading_system=False,
            max_programs_per_student=2, max_single_programs_per_student=1,
            max_group_programs_per_student=1,
        )
        self.team = Team.objects.create(name='Blue', school=self.school)
        self.team_password = self.team._plain_team_password
        self.other_team = Team.objects.create(name='Red', school=self.school)
        self.students = [
            User.objects.create_user(
                username=f's{i}', email=f's{i}@example.com', password='x', role='student',
                name=f'Student {i}', student_id=f'S{i}', category='junior', school=self.school,
            ) for i in range(1, 5)
        ]
        self.team.members.add(*self.students)

    def certificate_background(self, name='certificate.png', size=(1200, 900)):
        from PIL import Image

        image = Image.new('RGB', size, '#EEF2FF')
        content = BytesIO()
        image.save(content, format='PNG')
        return SimpleUploadedFile(name, content.getvalue(), content_type='image/png')

    def configure_certificate_template(self, certificate_type):
        fields = default_certificate_fields()
        fields['rank']['enabled'] = True
        return CertificateTemplate.objects.create(
            event=self.event,
            certificate_type=certificate_type,
            background_image=self.certificate_background(f'{certificate_type}.png'),
            natural_width=1200,
            natural_height=900,
            aspect_ratio=4 / 3,
            fields=fields,
            updated_by=self.admin,
        )

    def submit_result(self, result, judge1, judge2):
        result.judge1_marks = Decimal(str(judge1))
        result.judge2_marks = Decimal(str(judge2))
        result.code_letter = f'C{result.pk}'
        result.entry_status = 'submitted'
        result.save()

    def test_student_template_uses_school_setup_and_bulk_upload_maps_all_fields(self):
        from openpyxl import load_workbook

        student_class = StudentClass.objects.create(
            school=self.school, category=self.category, name='Grade 8', code='8'
        )
        StudentCategory.objects.create(
            school=self.school, name='General', code='general', is_mixing=True
        )
        other_school = School.objects.create(name='Other School', code='other-school')
        other_category = StudentCategory.objects.create(
            school=other_school, name='Foreign', code='foreign'
        )
        StudentClass.objects.create(
            school=other_school, category=other_category, name='Foreign Class', code='FC'
        )
        Team.objects.create(name='Foreign Team', school=other_school)

        client = APIClient()
        client.force_authenticate(self.admin)
        template_response = client.get('/api/students/download_template/')
        self.assertEqual(template_response.status_code, 200)

        workbook = load_workbook(BytesIO(template_response.content))
        self.assertEqual(workbook.sheetnames, ['Students', 'Example', 'Setup', 'Instructions'])
        students_sheet = workbook['Students']
        setup_sheet = workbook['Setup']
        self.assertEqual(
            [cell.value for cell in students_sheet[1]],
            ['name', 'class', 'section', 'gender', 'team_name'],
        )
        self.assertEqual(len(students_sheet.data_validations.dataValidation), 3)
        setup_values = {
            value for row in setup_sheet.iter_rows(values_only=True)
            for value in row if value is not None
        }
        self.assertIn(student_class.name, setup_values)
        self.assertIn(self.team.name, setup_values)
        self.assertIn(self.other_team.name, setup_values)
        self.assertNotIn('general', setup_values)
        self.assertNotIn('Foreign Team', setup_values)
        self.assertEqual(workbook['Example']['B2'].value, student_class.name)
        self.assertEqual(workbook['Example']['C2'].value, 'A')
        self.assertEqual(workbook['Example']['D2'].value, 'Male')
        self.assertEqual(workbook['Example']['E2'].value, self.team.name)

        students_sheet.append([
            'Imported Student', 'Gradee 8', 'A', 'Female', 'Blu',
        ])
        students_sheet.append([
            'Defaulted Student', 'Grade 8', 'B', '', '',
        ])
        upload_bytes = BytesIO()
        workbook.save(upload_bytes)
        upload = SimpleUploadedFile(
            'students.xlsx', upload_bytes.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        upload_response = client.post(
            '/api/students/bulk_upload/', {'file': upload}, format='multipart'
        )
        self.assertEqual(upload_response.status_code, 200, upload_response.data)
        imported = User.objects.get(name='Imported Student', school=self.school)
        self.assertEqual(imported.category, self.category.code)
        self.assertEqual(imported.grade, student_class.code)
        self.assertEqual(imported.gender, 'female')
        self.assertEqual(imported.section, 'A')
        self.assertIsNone(imported.chest_code)
        self.assertTrue(self.team.members.filter(pk=imported.pk).exists())
        self.assertEqual(upload_response.data['team_assignments'][0]['team'], self.team.name)
        self.assertGreaterEqual(len(upload_response.data['corrections']), 2)

        defaulted = User.objects.get(name='Defaulted Student', school=self.school)
        self.assertEqual(defaulted.category, self.category.code)
        self.assertEqual(defaulted.grade, student_class.code)
        self.assertEqual(defaulted.gender, 'other')
        self.assertEqual(defaulted.section, 'B')
        self.assertFalse(self.team.members.filter(pk=defaulted.pk).exists())

    def test_student_bulk_upload_supports_csv_format(self):
        student_class = StudentClass.objects.create(
            school=self.school, category=self.category, name='Grade 10', code='10'
        )
        csv_content = (
            "name,class,section,gender,team_name\n"
            f"CSV Student,Grade 10,C,Female,{self.team.name}\n"
        ).encode('utf-8')
        upload = SimpleUploadedFile(
            'students.csv', csv_content, content_type='text/csv'
        )
        client = APIClient()
        client.force_authenticate(self.admin)
        response = client.post('/api/students/bulk_upload/', {'file': upload}, format='multipart')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['summary']['successful_creations'], 1)
        imported = User.objects.get(name='CSV Student', school=self.school)
        self.assertEqual(imported.gender, 'female')
        self.assertEqual(imported.grade, student_class.code)
        self.assertEqual(imported.category, self.category.code)
        self.assertEqual(imported.section, 'C')
        self.assertTrue(self.team.members.filter(pk=imported.pk).exists())

    def test_student_bulk_upload_rejects_unknown_team_without_partial_creation(self):
        from openpyxl import Workbook

        StudentClass.objects.create(
            school=self.school, category=self.category, name='Grade 9', code='9'
        )
        workbook = Workbook()
        sheet = workbook.active
        sheet.title = 'Students'
        sheet.append(['name', 'gender', 'category', 'class', 'team_name'])
        sheet.append(['Should Not Exist', 'Male', 'junior', 'Grade 9', 'Misspelled Team'])
        upload_bytes = BytesIO()
        workbook.save(upload_bytes)
        upload = SimpleUploadedFile(
            'students.xlsx', upload_bytes.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        client = APIClient()
        client.force_authenticate(self.admin)
        response = client.post('/api/students/bulk_upload/', {'file': upload}, format='multipart')
        self.assertEqual(response.status_code, 400)
        self.assertFalse(User.objects.filter(name='Should Not Exist', school=self.school).exists())
        self.assertFalse(Team.objects.filter(name='Misspelled Team', school=self.school).exists())

    def test_student_gender_is_required_and_propagates_to_event_participants(self):
        StudentClass.objects.create(
            school=self.school, category=self.category, name='Grade 7', code='7'
        )
        client = APIClient()
        client.force_authenticate(self.admin)
        payload = {
            'name': 'Gender Test Student', 'category': self.category.code, 'grade': '7',
        }
        missing = client.post('/api/students/', payload, format='json')
        self.assertEqual(missing.status_code, 400)
        self.assertIn('gender', missing.data)

        created = client.post('/api/students/', {**payload, 'gender': 'female'}, format='json')
        self.assertEqual(created.status_code, 201, created.data)
        student = User.objects.get(pk=created.data['id'])
        self.assertEqual(student.gender, 'female')

        program = Program.objects.create(
            event=self.event, name='Gender Propagation', category=self.category.code,
            max_participants=2, program_type='stage',
        )
        self.team.members.add(student)
        assign_students(user=self.admin, team=self.team, program=program, student_ids=[student.id])

        event_participants = client.get(f'/api/events/{self.event.id}/chest_numbers/')
        self.assertEqual(event_participants.status_code, 200)
        row = next(item for item in event_participants.data if item['student'] == student.id)
        self.assertEqual(row['gender'], 'female')

        calling_participants = client.get(f'/api/programs/{program.id}/participants/')
        self.assertEqual(calling_participants.status_code, 200)
        self.assertEqual(calling_participants.data['results'][0]['gender'], 'female')

        from pypdf import PdfReader
        for url in (
            f'/api/programs/{program.id}/calling-sheet/',
            f'/api/events/{self.event.id}/green-room-sign/',
            f'/api/events/{self.event.id}/call-list/',
            f'/api/events/{self.event.id}/reports/participants-team/',
        ):
            document = client.get(url)
            self.assertEqual(document.status_code, 200, url)
            self.assertEqual(document['Content-Type'], 'application/pdf')
            text = '\n'.join(page.extract_text() or '' for page in PdfReader(BytesIO(document.content)).pages)
            self.assertIn('Female', text, url)

    def test_certificate_templates_persist_and_validate_uploaded_images(self):
        client = APIClient()
        client.force_authenticate(self.admin)
        fields = default_certificate_fields()
        fields['participantName']['x'] = 51
        response = client.put(
            f'/api/events/{self.event.id}/certificate-templates/participation/',
            {
                'fields': json.dumps(fields),
                'background_image': self.certificate_background(),
            },
            format='multipart',
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['status'], 'Custom')
        self.assertEqual(response.data['fields']['participantName']['x'], 51.0)
        self.assertEqual(response.data['naturalWidth'], 1200)

        listed = client.get(f'/api/events/{self.event.id}/certificate-templates/')
        self.assertEqual(listed.status_code, 200)
        stored = next(item for item in listed.data['results'] if item['certificateType'] == 'participation')
        self.assertEqual(stored['status'], 'Custom')
        self.assertEqual(stored['fields']['participantName']['x'], 51.0)

        invalid = SimpleUploadedFile('certificate.svg', b'<svg></svg>', content_type='image/svg+xml')
        rejected = client.put(
            f'/api/events/{self.event.id}/certificate-templates/first_place/',
            {'fields': json.dumps(fields), 'background_image': invalid},
            format='multipart',
        )
        self.assertEqual(rejected.status_code, 400)
        self.assertFalse(CertificateTemplate.objects.filter(
            event=self.event, certificate_type='first_place'
        ).exists())

    def test_individual_placement_certificate_uses_only_published_result_position(self):
        from pypdf import PdfReader

        program = Program.objects.create(
            event=self.event, name='Certificate Solo', category='general',
            max_participants=3, is_published=True,
        )
        for student in self.students[:3]:
            assign_students(user=self.admin, team=self.team, program=program, student_ids=[student.id])
        results = list(ProgramResult.objects.filter(program=program).order_by('participant_id'))
        self.submit_result(results[0], 48, 48)
        self.submit_result(results[1], 40, 40)
        self.submit_result(results[2], 30, 30)
        recalculate_program_results(program)
        winner = ProgramResult.objects.get(program=program, position=1).participant
        non_winners = [result.participant for result in ProgramResult.objects.filter(program=program).exclude(position=1)]
        self.configure_certificate_template('first_place')

        client = APIClient()
        client.force_authenticate(self.admin)
        response = client.get(
            f'/api/events/{self.event.id}/certificates/',
            {'program_id': program.id, 'cert_types': 'first_place', 'quality': 'screen'},
        )
        self.assertEqual(response.status_code, 200, getattr(response, 'data', None))
        self.assertEqual(response['X-Certificate-Count'], '1')
        reader = PdfReader(BytesIO(response.content))
        self.assertEqual(len(reader.pages), 1)
        text = reader.pages[0].extract_text() or ''
        self.assertIn(winner.get_full_name(), text)
        self.assertIn('1st Place', text)
        self.assertIn('Junior', text)
        self.assertNotIn('General\n', text)
        for student in non_winners:
            self.assertNotIn(student.get_full_name(), text)

    def test_group_placement_certificate_expands_only_winning_subteam(self):
        from pypdf import PdfReader

        program = Program.objects.create(
            event=self.event, name='Certificate Group', category='junior',
            is_team_based=True, team_size=2, max_teams_per_school=2,
            max_participants_per_team=4, is_published=True,
        )
        assign_students(
            user=self.admin, team=self.team, program=program,
            student_ids=[self.students[0].id, self.students[1].id], sub_team_number=1,
        )
        assign_students(
            user=self.admin, team=self.team, program=program,
            student_ids=[self.students[2].id, self.students[3].id], sub_team_number=2,
        )
        results = list(ProgramResult.objects.filter(program=program).order_by('sub_team_number'))
        self.submit_result(results[0], 48, 48)
        self.submit_result(results[1], 35, 35)
        recalculate_program_results(program)
        winning_result = ProgramResult.objects.get(program=program, position=1)
        winning_ids = set(ProgramAssignment.objects.filter(
            program=program, team=winning_result.team,
            sub_team_number=winning_result.sub_team_number,
        ).values_list('student_id', flat=True))
        losing_ids = {student.id for student in self.students} - winning_ids
        self.configure_certificate_template('first_place')

        client = APIClient()
        client.force_authenticate(self.admin)
        response = client.get(
            f'/api/events/{self.event.id}/certificates/',
            {'program_id': program.id, 'cert_types': 'first_place', 'quality': 'screen'},
        )
        self.assertEqual(response.status_code, 200, getattr(response, 'data', None))
        self.assertEqual(int(response['X-Certificate-Count']), len(winning_ids))
        reader = PdfReader(BytesIO(response.content))
        self.assertEqual(len(reader.pages), len(winning_ids))
        self.assertAlmostEqual(float(reader.pages[0].mediabox.width), 841.89, delta=1.0)
        self.assertAlmostEqual(float(reader.pages[0].mediabox.height), 595.28, delta=1.0)
        text = '\n'.join(page.extract_text() or '' for page in reader.pages)
        for student in self.students:
            if student.id in winning_ids:
                self.assertIn(student.get_full_name(), text)
            if student.id in losing_ids:
                self.assertNotIn(student.get_full_name(), text)

    def test_certificate_export_rejects_unpublished_placement_and_missing_template(self):
        program = Program.objects.create(
            event=self.event, name='Unpublished Certificate', category='junior',
            max_participants=2, is_published=False,
        )
        assign_students(user=self.admin, team=self.team, program=program, student_ids=[self.students[0].id])
        result = ProgramResult.objects.get(program=program)
        self.submit_result(result, 45, 45)
        recalculate_program_results(program)

        client = APIClient()
        client.force_authenticate(self.admin)
        missing = client.get(
            f'/api/events/{self.event.id}/certificates/',
            {'program_id': program.id, 'cert_types': 'first_place'},
        )
        self.assertEqual(missing.status_code, 400)
        self.assertIn('first_place', missing.data['missing_templates'])

        self.configure_certificate_template('first_place')
        unpublished = client.get(
            f'/api/events/{self.event.id}/certificates/',
            {'program_id': program.id, 'cert_types': 'first_place'},
        )
        self.assertEqual(unpublished.status_code, 400)
        self.assertIn('No eligible recipients', unpublished.data['error'])

    def test_badge_template_configuration_preview_and_generation(self):
        program_a = Program.objects.create(
            event=self.event, name='Badge Solo Item', category='junior',
            max_participants=2, program_type='stage',
        )
        program_b = Program.objects.create(
            event=self.event, name='Badge General Item', category='general',
            max_participants=2, program_type='stage',
        )
        assign_students(user=self.admin, team=self.team, program=program_a, student_ids=[self.students[0].id])
        assign_students(user=self.admin, team=self.team, program=program_a, student_ids=[self.students[1].id])
        assign_students(user=self.admin, team=self.team, program=program_b, student_ids=[self.students[0].id])

        client = APIClient()
        client.force_authenticate(self.admin)

        portrait_badge_image = self.certificate_background('badge.png', size=(300, 450))
        fields = default_certificate_fields()
        upload_res = client.put(
            f'/api/events/{self.event.id}/certificate-templates/badge/',
            {
                'background_image': portrait_badge_image,
                'fields': json.dumps(fields),
            },
            format='multipart',
        )
        self.assertEqual(upload_res.status_code, 200)
        self.assertEqual(upload_res.data['certificateType'], 'badge')
        self.assertEqual(upload_res.data['status'], 'Custom')

        # Preview data
        preview_res = client.get(
            f'/api/events/{self.event.id}/certificate-preview-data/',
            {'certificate_type': 'badge'},
        )
        self.assertEqual(preview_res.status_code, 200)
        self.assertIsNotNone(preview_res.data['recipient'])
        self.assertEqual(preview_res.data['recipient']['rank'], 'Participant')
        self.assertEqual(preview_res.data['recipient']['participantName'], self.students[0].get_full_name())
        self.assertIn('Chest No:', preview_res.data['recipient']['chestNo'])
        self.assertEqual(preview_res.data['recipient']['eventName'], self.event.title)
        self.assertEqual(preview_res.data['recipient']['totalPrograms'], 'Total Programs: 2')
        self.assertIn('Badge Solo Item', preview_res.data['recipient']['assignedPrograms'])
        self.assertIn('Badge General Item', preview_res.data['recipient']['assignedPrograms'])

        # Export badges across programs (student 0 in 2 programs, student 1 in 1 program -> 2 distinct badges)
        export_res = client.get(
            f'/api/events/{self.event.id}/certificates/',
            {'cert_types': 'badge', 'quality': 'standard'},
        )
        self.assertEqual(export_res.status_code, 200)
        self.assertEqual(export_res['Content-Type'], 'application/pdf')
        self.assertIn('Badges_', export_res['Content-Disposition'])
        self.assertEqual(export_res['X-Certificate-Count'], '2')

        # Verify A4 portrait dimensions using pypdf
        import io
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(export_res.content))
        self.assertEqual(len(reader.pages), 1)  # 2 badges fit on 1 A4 page (up to 9 badges per page)
        page = reader.pages[0]
        self.assertAlmostEqual(float(page.mediabox.width), 595.28, delta=1.0)
        self.assertAlmostEqual(float(page.mediabox.height), 841.89, delta=1.0)

        # Team filter export: self.team has 2 students
        team_export_res = client.get(
            f'/api/events/{self.event.id}/certificates/',
            {'cert_types': 'badge', 'quality': 'standard', 'team_id': self.team.id},
        )
        self.assertEqual(team_export_res.status_code, 200)
        self.assertEqual(team_export_res['X-Certificate-Count'], '2')

        # Empty/unmatched team filter returns 400
        empty_team_res = client.get(
            f'/api/events/{self.event.id}/certificates/',
            {'cert_types': 'badge', 'quality': 'standard', 'team_id': 99999},
        )
        self.assertEqual(empty_team_res.status_code, 400)

        # Test 9-per-sheet pagination: assign 8 more students (total 10 students across event)
        large_gen_program = Program.objects.create(
            event=self.event, name='Grand General Quiz', category='general',
            max_participants=20, program_type='stage',
        )
        more_students = [
            User.objects.create_user(
                username=f'extra_s{i}', email=f'extra_s{i}@example.com', password='x', role='student',
                name=f'Extra Student {i}', student_id=f'EX{i}', category='junior', school=self.school,
            ) for i in range(1, 9)
        ]
        self.team.members.add(*more_students)
        for extra in more_students:
            assign_students(user=self.admin, team=self.team, program=large_gen_program, student_ids=[extra.id])

        multi_page_res = client.get(
            f'/api/events/{self.event.id}/certificates/',
            {'cert_types': 'badge', 'quality': 'standard'},
        )
        self.assertEqual(multi_page_res.status_code, 200)
        self.assertEqual(multi_page_res['X-Certificate-Count'], '10')
        reader_10 = PdfReader(io.BytesIO(multi_page_res.content))
        # 10 badges / 9 per page = exactly 2 A4 pages
        self.assertEqual(len(reader_10.pages), 2)
        for pg in reader_10.pages:
            self.assertAlmostEqual(float(pg.mediabox.width), 595.28, delta=1.0)
            self.assertAlmostEqual(float(pg.mediabox.height), 841.89, delta=1.0)

    def test_schedule_uses_real_entry_count_warns_on_conflicts_and_exports(self):
        stage = EventStage.objects.create(event=self.event, number=1, name='Main Hall')
        program = Program.objects.create(
            event=self.event, name='Scheduled Solo', category='junior',
            max_participants=3, program_type='stage', duration_minutes_per_entry=7,
        )
        assign_students(user=self.admin, team=self.team, program=program, student_ids=[self.students[0].id])
        assign_students(user=self.admin, team=self.team, program=program, student_ids=[self.students[1].id])
        start = timezone.make_aware(datetime.combine(self.event.start_date, time(10, 0)))

        client = APIClient()
        client.force_authenticate(self.admin)
        response = client.patch(
            f'/api/events/{self.event.id}/programs/{program.id}/schedule/',
            {
                'stage_id': stage.id,
                'start_time': start.isoformat(),
                'end_time': (start + timedelta(minutes=30)).isoformat(),
                'duration_minutes_per_entry': 7,
            },
            format='json',
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['program']['schedule_entry_count'], 2)
        self.assertEqual(response.data['program']['scheduled_duration_minutes'], 14)
        program.refresh_from_db()
        self.assertEqual(program.end_time, start + timedelta(minutes=30))
        self.assertTrue(program.schedule_end_is_manual)

        overlap = Program.objects.create(
            event=self.event, name='Overlap', category='junior', max_participants=1,
            program_type='stage', stage=stage, start_time=start + timedelta(minutes=20),
            end_time=start + timedelta(minutes=25), duration_minutes_per_entry=5,
        )
        conflict = client.patch(
            f'/api/events/{self.event.id}/programs/{overlap.id}/schedule/',
            {
                'stage_id': stage.id,
                'start_time': (start + timedelta(minutes=20)).isoformat(),
                'end_time': (start + timedelta(minutes=25)).isoformat(),
                'duration_minutes_per_entry': 5,
            }, format='json',
        )
        self.assertEqual(conflict.status_code, 200, conflict.data)
        self.assertEqual([item['id'] for item in conflict.data['conflicts']], [program.id])

        csv_response = client.get(f'/api/events/{self.event.id}/schedule-export/?export_format=csv')
        self.assertEqual(csv_response.status_code, 200, csv_response.content)
        self.assertIn('Scheduled Solo', csv_response.content.decode('utf-8-sig'))
        pdf_response = client.get(f'/api/events/{self.event.id}/schedule-export/?export_format=pdf')
        self.assertEqual(pdf_response.status_code, 200)
        self.assertTrue(pdf_response.content.startswith(b'%PDF'))

    def test_schedule_rejects_dates_outside_event_and_cross_tenant_access(self):
        stage = EventStage.objects.create(event=self.event, number=1, name='Hall')
        program = Program.objects.create(
            event=self.event, name='Bounded Program', category='junior',
            max_participants=1, program_type='stage',
        )
        client = APIClient()
        client.force_authenticate(self.admin)
        outside = timezone.make_aware(
            datetime.combine(self.event.end_date + timedelta(days=1), time(9, 0))
        )
        response = client.patch(
            f'/api/events/{self.event.id}/programs/{program.id}/schedule/',
            {'stage_id': stage.id, 'start_time': outside.isoformat(), 'duration_minutes_per_entry': 5},
            format='json',
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('start_time', response.data)

        other_school = School.objects.create(name='Other Tenant', code='other-tenant')
        other_admin = User.objects.create_user(
            username='other-admin', email='other-admin@example.com', password='x',
            role='admin', school=other_school,
        )
        client.force_authenticate(other_admin)
        self.assertEqual(
            client.get(f'/api/events/{self.event.id}/schedule-export/?export_format=csv').status_code,
            404,
        )

    def test_group_assignment_is_atomic_exact_and_has_one_leader(self):
        program = Program.objects.create(
            event=self.event, name='Group', category='junior', is_team_based=True,
            team_size=2, max_teams_per_school=2, max_participants_per_team=4,
        )
        with self.assertRaises(ValidationError):
            assign_students(
                user=self.admin, team=self.team, program=program,
                student_ids=[self.students[0].id], sub_team_number=1,
            )
        self.assertFalse(ProgramAssignment.objects.filter(program=program).exists())

        assignments = assign_students(
            user=self.admin, team=self.team, program=program,
            student_ids=[self.students[0].id, self.students[1].id],
            sub_team_number=1, leader_id=self.students[1].id,
        )
        self.assertEqual(len(assignments), 2)
        self.assertEqual(sum(item.is_leader for item in assignments), 1)
        result = ProgramResult.objects.get(program=program)
        self.assertTrue(result.is_team_result)
        self.assertEqual(result.participant, self.students[1])
        self.assertEqual(result.entry_status, 'draft')

    def test_admin_portal_can_build_group_subteam_one_member_at_a_time(self):
        program = Program.objects.create(
            event=self.event, name='Nasheeda', category='junior',
            is_team_based=True, team_size=4, max_teams_per_school=1,
            max_participants_per_team=4,
        )
        client = APIClient()
        client.force_authenticate(self.admin)
        endpoint = (
            f'/api/team-manager/{self.team.id}/events/{self.event.id}/'
            f'programs/{program.id}/assign/'
        )

        for index, student in enumerate(self.students):
            response = client.post(endpoint, {
                'student_ids': [student.id], 'sub_team_number': 1,
            }, format='json')
            self.assertEqual(response.status_code, 201, response.data)
            self.assertEqual(
                ProgramAssignment.objects.filter(program=program, team=self.team).count(),
                index + 1,
            )
            self.assertEqual(
                ProgramResult.objects.filter(program=program, team=self.team).exists(),
                index == 3,
            )

        assignments = ProgramAssignment.objects.filter(program=program, team=self.team)
        self.assertEqual(assignments.filter(is_leader=True).count(), 1)
        self.assertEqual(
            len(set(assignments.values_list('chest_number', flat=True))), 4,
        )

    def test_deadline_category_and_participation_limits_are_enforced(self):
        first = Program.objects.create(event=self.event, name='First', category='junior')
        second = Program.objects.create(event=self.event, name='Second', category='junior')
        assign_students(
            user=self.admin, team=self.team, program=first, student_ids=[self.students[0].id]
        )
        scoped_user = type('TeamPrincipal', (), {
            'is_authenticated': True, 'role': 'team_manager', 'pk': None,
        })()
        with self.assertRaises(ValidationError):
            assign_students(
                user=scoped_user, team=self.team, program=second,
                student_ids=[self.students[0].id],
            )
        self.event.registration_deadline = timezone.now() - timedelta(minutes=1)
        self.event.save(update_fields=['registration_deadline'])
        with self.assertRaises(ValidationError):
            assign_students(
                user=scoped_user, team=self.team, program=second,
                student_ids=[self.students[1].id],
            )

    def test_legacy_total_program_limit_is_not_enforced(self):
        self.event.max_programs_per_student = 1
        self.event.max_single_programs_per_student = 2
        self.event.save(update_fields=[
            'max_programs_per_student', 'max_single_programs_per_student',
        ])
        first = Program.objects.create(
            event=self.event, name='Individual One', category='junior', max_participants=2,
        )
        second = Program.objects.create(
            event=self.event, name='Individual Two', category='junior', max_participants=2,
        )
        assign_students(
            user=self.admin, team=self.team, program=first,
            student_ids=[self.students[0].id],
        )
        assign_students(
            user=self.admin, team=self.team, program=second,
            student_ids=[self.students[0].id],
        )
        self.assertEqual(
            ProgramAssignment.objects.filter(
                program__event=self.event, student=self.students[0]
            ).count(),
            2,
        )

    def test_general_and_mixed_programs_are_unlimited_and_do_not_count_towards_limits(self):
        self.event.max_single_programs_per_student = 1
        self.event.max_group_programs_per_student = 1
        self.event.save(update_fields=[
            'max_single_programs_per_student', 'max_group_programs_per_student'
        ])

        # 1. Multiple General individual programs - unlimited!
        gen_single_1 = Program.objects.create(
            event=self.event, name='General Drawing', category='general', max_participants=2,
            is_team_based=False,
        )
        gen_single_2 = Program.objects.create(
            event=self.event, name='General Essay', category='open', max_participants=2,
            is_team_based=False,
        )
        assign_students(
            user=self.admin, team=self.team, program=gen_single_1,
            student_ids=[self.students[0].id],
        )
        assign_students(
            user=self.admin, team=self.team, program=gen_single_2,
            student_ids=[self.students[0].id],
        )

        # 2. General group program - unlimited!
        gen_group = Program.objects.create(
            event=self.event, name='General Skit', category='general', max_participants=5,
            is_team_based=True, team_size=1,
        )
        assign_students(
            user=self.admin, team=self.team, program=gen_group,
            student_ids=[self.students[0].id],
        )

        # 3. Standard category individual program (Limit = 1)
        # Should succeed for the 1st standard program because general ones don't consume the quota
        std_single_1 = Program.objects.create(
            event=self.event, name='Junior Elocution', category='junior', max_participants=2,
            is_team_based=False,
        )
        assign_students(
            user=self.admin, team=self.team, program=std_single_1,
            student_ids=[self.students[0].id],
        )

        # 2nd standard single program must fail due to category limit
        std_single_2 = Program.objects.create(
            event=self.event, name='Junior Recitation', category='junior', max_participants=2,
            is_team_based=False,
        )
        with self.assertRaises(ValidationError):
            assign_students(
                user=self.admin, team=self.team, program=std_single_2,
                student_ids=[self.students[0].id],
            )

        # 4. Standard category group program (Limit = 1)
        # 1st standard group program succeeds
        std_group_1 = Program.objects.create(
            event=self.event, name='Junior Group Song', category='junior', max_participants=5,
            is_team_based=True, team_size=1,
        )
        assign_students(
            user=self.admin, team=self.team, program=std_group_1,
            student_ids=[self.students[0].id],
        )

        # 2nd standard group program must fail due to category limit
        std_group_2 = Program.objects.create(
            event=self.event, name='Junior Mime', category='junior', max_participants=5,
            is_team_based=True, team_size=1,
        )
        with self.assertRaises(ValidationError):
            assign_students(
                user=self.admin, team=self.team, program=std_group_2,
                student_ids=[self.students[0].id],
            )

    def test_marks_require_all_judges_and_respect_maximum(self):
        program = Program.objects.create(event=self.event, name='Marks', category='junior')
        assign_students(
            user=self.admin, team=self.team, program=program, student_ids=[self.students[0].id]
        )
        result = ProgramResult.objects.get(program=program)
        result.entry_status = 'submitted'
        result.judge1_marks = Decimal('51')
        result.judge2_marks = Decimal('40')
        with self.assertRaises(ValidationError):
            result.save()
        result.judge1_marks = Decimal('40')
        result.judge2_marks = None
        with self.assertRaises(ValidationError):
            result.save()

    def test_points_are_publish_gated_idempotent_and_ties_use_competition_rank(self):
        settings = SchoolSettings.get_settings(self.school)
        settings.std_ind_first = 5
        settings.std_ind_second = 3
        settings.std_ind_third = 1
        settings.save()
        program = Program.objects.create(event=self.event, name='Rank', category='junior')
        scores = [(40, 40), (40, 40), (30, 30)]
        for student, marks in zip(self.students[:3], scores):
            assign_students(user=self.admin, team=self.team, program=program, student_ids=[student.id])
            result = ProgramResult.objects.get(program=program, participant=student)
            result.judge1_marks, result.judge2_marks = marks
            result.entry_status = 'submitted'
            result.save()

        recalculate_program_results(program)
        self.assertEqual(
            list(ProgramResult.objects.filter(program=program).order_by('id').values_list('position', flat=True)),
            [1, 1, 3],
        )
        self.assertFalse(PointsRecord.objects.filter(source_result__program=program).exists())

        program.is_published = True
        program.save(update_fields=['is_published'])
        recalculate_program_results(program)
        first_count = PointsRecord.objects.filter(source_result__program=program).count()
        recalculate_program_results(program)
        self.assertEqual(PointsRecord.objects.filter(source_result__program=program).count(), first_count)
        self.assertEqual(first_count, 6)  # one team and one student record for each result

    def test_team_token_is_scoped_and_anonymous_access_is_rejected(self):
        client = APIClient()
        own_url = f'/api/team-manager/profile/{self.team.id}/'
        wrong_url = f'/api/team-manager/profile/{self.other_team.id}/'
        self.assertEqual(client.get(own_url).status_code, 401)
        login = client.post('/api/team-manager/login/', {
            'team_username': self.team.team_username,
            'team_password': self.team_password,
            'school_code': self.school.code,
        }, format='json')
        self.assertEqual(login.status_code, 200)
        self.assertNotIn('access', login.data)
        self.assertIn('eventloo_access', login.cookies)
        self.assertEqual(client.get(own_url).status_code, 200)
        self.assertEqual(client.get(wrong_url).status_code, 403)
        self.assertEqual(APIClient().post('/api/create-admin-user/').status_code, 404)

    def test_participant_history_never_exposes_unpublished_results(self):
        program = Program.objects.create(event=self.event, name='Private Result', category='junior')
        assign_students(
            user=self.admin, team=self.team, program=program, student_ids=[self.students[0].id]
        )
        result = ProgramResult.objects.get(program=program)
        result.judge1_marks = Decimal('40')
        result.judge2_marks = Decimal('40')
        result.entry_status = 'submitted'
        result.save()
        recalculate_program_results(program)

        client = APIClient()
        client.force_authenticate(self.admin)
        url = f'/api/students/{self.students[0].id}/program_results/'
        self.assertEqual(client.get(url).data, [])
        program.is_published = True
        program.save(update_fields=['is_published'])
        recalculate_program_results(program)
        response = client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['points_earned'], 5)

    def test_team_manager_program_payload_supports_two_subteams(self):
        program = Program.objects.create(
            event=self.event, name='Two Groups', category='junior', is_team_based=True,
            team_size=2, max_teams_per_school=2,
        )
        assign_students(
            user=self.admin, team=self.team, program=program,
            student_ids=[self.students[0].id, self.students[1].id], sub_team_number=1,
        )
        assign_students(
            user=self.admin, team=self.team, program=program,
            student_ids=[self.students[2].id, self.students[3].id], sub_team_number=2,
        )
        client = APIClient()
        login = client.post('/api/team-manager/login/', {
            'team_username': self.team.team_username,
            'team_password': self.team_password,
            'school_code': self.school.code,
        }, format='json')
        self.assertEqual(login.status_code, 200)
        response = client.get(
            f'/api/team-manager/{self.team.id}/events/{self.event.id}/programs/'
        )
        self.assertEqual(response.status_code, 200)
        payload = next(item for item in response.data['programs'] if item['id'] == program.id)
        self.assertEqual(payload['team_size'], 2)
        self.assertEqual(payload['max_teams_per_school'], 2)
        self.assertEqual(
            {item['sub_team_number'] for item in payload['assigned_students']}, {1, 2}
        )
        self.assertEqual(sum(item['is_leader'] for item in payload['assigned_students']), 2)
        entries = get_grouped_assignments_for_report(
            program, program.assignments.all(), self.event
        )
        self.assertEqual(len(entries), 2)
        self.assertTrue(all(len(entry['assignments']) == 2 for entry in entries))
        self.assertTrue(all(
            all(str(assignment.chest_number) in entry['participant_names'] for assignment in entry['assignments'])
            for entry in entries
        ))

    def test_chest_number_is_stable_across_programs_and_removed_after_last_assignment(self):
        self.event.max_single_programs_per_student = 3
        self.event.max_programs_per_student = 3
        self.event.save(update_fields=['max_single_programs_per_student', 'max_programs_per_student'])
        first = Program.objects.create(
            event=self.event, name='Chest First', category='junior', max_participants=2,
        )
        second = Program.objects.create(
            event=self.event, name='Chest Second', category='junior', max_participants=2,
        )
        first_assignment = assign_students(
            user=self.admin, team=self.team, program=first,
            student_ids=[self.students[0].id],
        )[0]
        second_assignment = assign_students(
            user=self.admin, team=self.team, program=second,
            student_ids=[self.students[0].id],
        )[0]
        chest = ChestNumber.objects.get(event=self.event, student=self.students[0])
        self.assertEqual(first_assignment.chest_number, second_assignment.chest_number)
        self.assertEqual(first_assignment.chest_number, chest.chest_number)

        first_assignment.delete()
        self.assertTrue(ChestNumber.objects.filter(
            event=self.event, student=self.students[0]
        ).exists())
        second_assignment.delete()
        self.assertFalse(ChestNumber.objects.filter(
            event=self.event, student=self.students[0]
        ).exists())

    def test_general_participant_chest_search_supports_no_team(self):
        self.team.members.remove(self.students[0])
        program = Program.objects.create(
            event=self.event, name='Open Individual', category='general', max_participants=2,
        )
        assignment = assign_students(
            user=self.admin, team=None, program=program,
            student_ids=[self.students[0].id],
        )[0]
        client = APIClient()
        client.force_authenticate(self.admin)
        response = client.get(
            f'/api/events/{self.event.id}/search_by_chest_number/',
            {'chest_number': assignment.chest_number},
        )
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data['team']['id'])
        self.assertEqual(response.data['team']['name'], 'Individual')

    def test_team_manager_can_view_draft_event_but_cannot_assign(self):
        self.event.status = 'draft'
        self.event.save(update_fields=['status'])
        client = APIClient()
        login = client.post('/api/team-manager/login/', {
            'team_username': self.team.team_username,
            'team_password': self.team_password,
            'school_code': self.school.code,
        }, format='json')
        self.assertEqual(login.status_code, 200)
        events_response = client.get(f'/api/team-manager/{self.team.id}/events/')
        self.assertEqual(events_response.status_code, 200)
        self.assertIn(self.event.id, [item['id'] for item in events_response.data['events']])
        details_response = client.get(
            f'/api/team-manager/{self.team.id}/events/{self.event.id}/programs/'
        )
        self.assertEqual(details_response.status_code, 200)
        self.assertFalse(details_response.data['event']['registration_open'])

    def test_team_manager_can_assign_individual_participant_without_user_audit_identity(self):
        program = Program.objects.create(
            event=self.event,
            name='Team Manager Individual',
            category='junior',
            max_participants=2,
        )
        client = APIClient()
        login = client.post('/api/team-manager/login/', {
            'team_username': self.team.team_username,
            'team_password': self.team_password,
            'school_code': self.school.code,
        }, format='json')
        self.assertEqual(login.status_code, 200)

        response = client.post(
            f'/api/team-manager/{self.team.id}/events/{self.event.id}/programs/{program.id}/assign/',
            {'student_id': self.students[0].id},
            format='json',
            HTTP_X_REQUESTED_WITH='XMLHttpRequest',
        )

        self.assertEqual(response.status_code, 201)
        assignment = ProgramAssignment.objects.get(
            program=program,
            student=self.students[0],
        )
        self.assertIsNone(assignment.assigned_by)
        self.assertIsNotNone(assignment.chest_number)
        self.assertEqual(
            assignment.chest_number,
            ChestNumber.objects.get(event=self.event, student=self.students[0]).chest_number,
        )

    def test_participant_cannot_belong_to_two_teams(self):
        with self.assertRaises(ValidationError):
            self.other_team.members.add(self.students[0])

    def test_team_number_reset_is_blocked_after_chests_are_issued(self):
        program = Program.objects.create(
            event=self.event, name='Chest Lock', category='junior', max_participants=2,
        )
        assign_students(
            user=self.admin, team=self.team, program=program,
            student_ids=[self.students[0].id],
        )
        with self.assertRaises(ValidationError):
            Team.reset_team_numbering(self.school)

    def test_team_manager_cannot_modify_draft_event(self):
        program = Program.objects.create(
            event=self.event, name='Draft Program', category='junior', max_participants=1,
        )
        self.event.status = 'draft'
        self.event.save(update_fields=['status'])
        principal = type('TeamPrincipal', (), {
            'is_authenticated': True, 'role': 'team_manager', 'pk': None,
            'school_id': self.school.id,
        })()
        with self.assertRaises(ValidationError):
            assign_students(
                user=principal, team=self.team, program=program,
                student_ids=[self.students[0].id],
            )

    def test_draft_marks_do_not_allow_publication(self):
        program = Program.objects.create(
            event=self.event, name='Draft Marks', category='junior', max_participants=1,
        )
        assign_students(
            user=self.admin, team=self.team, program=program,
            student_ids=[self.students[0].id],
        )
        result = ProgramResult.objects.get(program=program)
        result.judge1_marks = Decimal('40')
        result.judge2_marks = Decimal('40')
        result.entry_status = 'draft'
        result.save()
        self.assertFalse(program_results_complete(program))

    def test_configured_participation_points_apply_below_third_place(self):
        settings = SchoolSettings.get_settings(self.school)
        settings.participation_points = 99
        settings.save(update_fields=['participation_points'])
        self.event.participation_points = 2
        self.event.max_single_programs_per_student = 4
        self.event.max_programs_per_student = 4
        self.event.save(update_fields=[
            'participation_points', 'max_single_programs_per_student',
            'max_programs_per_student',
        ])
        program = Program.objects.create(
            event=self.event, name='Participation Points', category='junior',
            max_participants=4,
        )
        for index, student in enumerate(self.students):
            assign_students(user=self.admin, team=self.team, program=program, student_ids=[student.id])
            result = ProgramResult.objects.get(program=program, participant=student)
            result.judge1_marks = Decimal(str(40 - index))
            result.judge2_marks = Decimal(str(40 - index))
            result.entry_status = 'submitted'
            result.save()
        recalculate_program_results(program)
        fourth = ProgramResult.objects.get(program=program, position=4)
        self.assertEqual(fourth.points_earned, 2)

    def test_program_grade_points_replace_instead_of_add_to_placement_points(self):
        self.event.enable_grading_system = True
        self.event.grading_rules = [
            {'name': 'A+', 'min_mark': 90, 'max_mark': 100},
            {'name': 'A', 'min_mark': 80, 'max_mark': 89.99},
        ]
        self.event.max_single_programs_per_student = 4
        self.event.save(update_fields=[
            'enable_grading_system', 'grading_rules',
            'max_single_programs_per_student',
        ])
        program = Program.objects.create(
            event=self.event,
            name='Absolute Grade Points',
            category='junior',
            max_participants=2,
            grading_points={'A+': 10},
        )
        for student, mark in zip(self.students[:2], (Decimal('95'), Decimal('85'))):
            assign_students(
                user=self.admin, team=self.team, program=program,
                student_ids=[student.id],
            )
            result = ProgramResult.objects.get(program=program, participant=student)
            result.judge1_marks = mark / 2
            result.judge2_marks = mark / 2
            result.entry_status = 'submitted'
            result.save()

        recalculate_program_results(program)
        winner = ProgramResult.objects.get(program=program, position=1)
        runner_up = ProgramResult.objects.get(program=program, position=2)

        self.assertEqual(winner.grade, 'A+')
        self.assertEqual(winner.points_earned, 10)
        self.assertEqual(winner.grade_extra_points, 10)
        self.assertEqual(runner_up.grade, 'A')
        self.assertEqual(runner_up.points_earned, self.event.std_ind_second)
        self.assertEqual(runner_up.grade_extra_points, 0)

    def test_program_api_accepts_grade_points_on_direct_create_route(self):
        self.event.enable_grading_system = True
        self.event.grading_rules = [
            {'name': 'A+', 'min_mark': 90, 'max_mark': 100},
        ]
        self.event.save(update_fields=['enable_grading_system', 'grading_rules'])
        client = APIClient()
        client.force_authenticate(self.admin)

        response = client.post('/api/programs/', {
            'event': self.event.id,
            'name': 'API Grade Program',
            'category': 'junior',
            'is_team_based': False,
            'max_participants': 2,
            'program_type': 'stage',
            'grading_points': {'A+': 10},
        }, format='json')

        self.assertEqual(response.status_code, 201, response.data)
        program = Program.objects.get(name='API Grade Program')
        self.assertEqual(program.grading_points, {'A+': 10})

    def test_program_custom_placement_points_override_and_recalculate(self):
        self.event.std_ind_first = 5
        self.event.std_ind_second = 3
        self.event.std_ind_third = 1
        self.event.participation_points = 0
        self.event.max_single_programs_per_student = 10
        self.event.max_programs_per_student = 10
        self.event.save()

        program = Program.objects.create(
            event=self.event,
            name='Custom Points Program',
            category='junior',
            max_participants=4,
            has_custom_points=True,
            first_place_points=15,
            second_place_points=10,
            third_place_points=5,
            participation_points=2,
        )

        for index, student in enumerate(self.students):
            assign_students(user=self.admin, team=self.team, program=program, student_ids=[student.id])
            result = ProgramResult.objects.get(program=program, participant=student)
            result.judge1_marks = Decimal(str(40 - index))
            result.judge2_marks = Decimal(str(40 - index))
            result.entry_status = 'submitted'
            result.save()

        recalculate_program_results(program)

        r1 = ProgramResult.objects.get(program=program, position=1)
        r2 = ProgramResult.objects.get(program=program, position=2)
        r3 = ProgramResult.objects.get(program=program, position=3)
        r4 = ProgramResult.objects.get(program=program, position=4)

        self.assertEqual(r1.points_earned, 15)
        self.assertEqual(r2.points_earned, 10)
        self.assertEqual(r3.points_earned, 5)
        self.assertEqual(r4.points_earned, 2)

        # Update program custom points to different values and verify auto-recalculation
        client = APIClient()
        client.force_authenticate(self.admin)
        patch_response = client.patch(f'/api/programs/{program.id}/', {
            'first_place_points': 20,
            'second_place_points': 12,
            'third_place_points': 6,
            'participation_points': 3,
        }, format='json')
        self.assertEqual(patch_response.status_code, 200, patch_response.data)

        r1.refresh_from_db()
        r2.refresh_from_db()
        r3.refresh_from_db()
        r4.refresh_from_db()
        self.assertEqual(r1.points_earned, 20)
        self.assertEqual(r2.points_earned, 12)
        self.assertEqual(r3.points_earned, 6)
        self.assertEqual(r4.points_earned, 3)

        # Disable custom points and verify it falls back to event points
        patch_response = client.patch(f'/api/programs/{program.id}/', {
            'has_custom_points': False,
        }, format='json')
        self.assertEqual(patch_response.status_code, 200, patch_response.data)

        r1.refresh_from_db()
        r2.refresh_from_db()
        r3.refresh_from_db()
        r4.refresh_from_db()
        self.assertEqual(r1.points_earned, 5)
        self.assertEqual(r2.points_earned, 3)
        self.assertEqual(r3.points_earned, 1)
        self.assertEqual(r4.points_earned, 0)

    def test_published_group_points_reach_every_subteam_member_and_top_scorers(self):
        group = Program.objects.create(
            event=self.event, name='Group Points', category='junior',
            is_team_based=True, team_size=2, max_teams_per_school=1,
            max_participants_per_team=2,
        )
        assign_students(
            user=self.admin, team=self.team, program=group,
            student_ids=[self.students[0].id, self.students[1].id],
            sub_team_number=1,
        )
        group_result = ProgramResult.objects.get(program=group, team=self.team)
        group_result.code_letter = 'G1'
        group_result.judge1_marks = Decimal('40')
        group_result.judge2_marks = Decimal('40')
        group_result.entry_status = 'submitted'
        group_result.save()
        recalculate_program_results(group)
        group.is_published = True
        group.save(update_fields=['is_published'])
        recalculate_program_results(group)
        group_result.refresh_from_db()

        member_records = PointsRecord.objects.filter(
            source_result=group_result, student__in=self.students[:2]
        )
        self.assertEqual(member_records.count(), 2)
        self.assertEqual(
            set(member_records.values_list('points', flat=True)),
            {group_result.points_earned},
        )

        client = APIClient()
        client.force_authenticate(self.admin)
        response = client.get(
            f'/api/events/{self.event.id}/top_scorers/',
            {'include_team_based': 'true'},
        )
        self.assertEqual(response.status_code, 200)
        scorer_ids = {row['student_id'] for row in response.data['scorers']}
        self.assertTrue({self.students[0].id, self.students[1].id}.issubset(scorer_ids))

    def test_general_checkbox_includes_published_general_team_program(self):
        general = StudentCategory.objects.create(
            name='General', code='gn-1', school=self.school, is_mixing=True,
        )
        program = Program.objects.create(
            event=self.event, name='General Group', category=general.code,
            is_team_based=True, team_size=2, max_teams_per_school=1,
            max_participants_per_team=2,
        )
        assign_students(
            user=self.admin, team=self.team, program=program,
            student_ids=[self.students[0].id, self.students[1].id],
        )
        result = ProgramResult.objects.get(program=program, team=self.team)
        result.code_letter = 'GG'
        result.judge1_marks = Decimal('40')
        result.judge2_marks = Decimal('40')
        result.entry_status = 'submitted'
        result.save()
        recalculate_program_results(program)
        program.is_published = True
        program.save(update_fields=['is_published'])
        recalculate_program_results(program)

        client = APIClient()
        client.force_authenticate(self.admin)
        response = client.get(
            f'/api/events/{self.event.id}/top_scorers/',
            {'include_general_category': 'true'},
        )
        self.assertEqual(response.status_code, 200)
        scorer_ids = {row['student_id'] for row in response.data['scorers']}
        self.assertTrue({self.students[0].id, self.students[1].id}.issubset(scorer_ids))

    def test_general_individual_personal_points_follow_event_setting(self):
        general = StudentCategory.objects.create(
            name='General Individual', code='general-ind', school=self.school,
            is_mixing=True,
        )
        general.mixed_categories.add(self.category)
        program = Program.objects.create(
            event=self.event, name='General Solo', category=general.code,
            is_team_based=False, max_participants=1,
        )
        student = self.students[0]
        assign_students(
            user=self.admin, team=self.team, program=program,
            student_ids=[student.id],
        )
        result = ProgramResult.objects.get(program=program, participant=student)
        result.judge1_marks = Decimal('45')
        result.judge2_marks = Decimal('45')
        result.entry_status = 'submitted'
        result.save()
        recalculate_program_results(program)
        program.is_published = True
        program.save(update_fields=['is_published'])
        recalculate_program_results(program)
        result.refresh_from_db()

        self.assertGreater(result.points_earned, 0)
        self.assertTrue(PointsRecord.objects.filter(source_result=result, team=self.team).exists())
        self.assertFalse(PointsRecord.objects.filter(source_result=result, student=student).exists())
        student.refresh_from_db()
        self.assertEqual(student.total_points, 0)

        client = APIClient()
        client.force_authenticate(self.admin)
        hidden = client.get(
            f'/api/events/{self.event.id}/top_scorers/',
            {'include_general_category': 'true'},
        )
        self.assertEqual(hidden.status_code, 200)
        self.assertNotIn(student.id, {row['student_id'] for row in hidden.data['scorers']})
        event_students = client.get(f'/api/events/{self.event.id}/points_students/')
        self.assertNotIn(student.id, {row['student_id'] for row in event_students.data['results']})

        profile_results = client.get(f'/api/students/{student.id}/program_results/')
        self.assertEqual(profile_results.status_code, 200)
        profile_result = next(row for row in profile_results.data if row['program']['id'] == program.id)
        self.assertEqual(profile_result['points_earned'], 0)

        history = client.get(f'/api/students/{student.id}/participation_history/')
        self.assertEqual(history.status_code, 200)
        history_program = next(
            row for event_row in history.data for row in event_row['programs']
            if row['id'] == program.id
        )
        self.assertEqual(history_program['result']['points_earned'], 0)

        chest = ChestNumber.objects.get(event=self.event, student=student)
        chest_lookup = client.get(
            f'/api/events/{self.event.id}/search_by_chest_number/',
            {'chest_number': chest.chest_number},
        )
        self.assertEqual(chest_lookup.status_code, 200)
        chest_result = next(row for row in chest_lookup.data['results'] if row['program_id'] == program.id)
        self.assertEqual(chest_result['points_earned'], 0)

        enabled = client.patch(
            f'/api/events/{self.event.id}/',
            {'count_general_individual_points_for_students': True},
            format='json',
        )
        self.assertEqual(enabled.status_code, 200, enabled.data)
        self.event.refresh_from_db()
        self.assertTrue(self.event.count_general_individual_points_for_students)

        personal_record = PointsRecord.objects.get(source_result=result, student=student)
        self.assertEqual(personal_record.points, result.points_earned)
        student.refresh_from_db()
        self.assertEqual(student.total_points, result.points_earned)

        visible = client.get(
            f'/api/events/{self.event.id}/top_scorers/',
            {'include_general_category': 'true'},
        )
        scorer = next(row for row in visible.data['scorers'] if row['student_id'] == student.id)
        self.assertEqual(scorer['total_points'], result.points_earned)
        event_students = client.get(f'/api/events/{self.event.id}/points_students/')
        event_student = next(row for row in event_students.data['results'] if row['student_id'] == student.id)
        self.assertEqual(event_student['total_points'], result.points_earned)

        profile_results = client.get(f'/api/students/{student.id}/program_results/')
        profile_result = next(row for row in profile_results.data if row['program']['id'] == program.id)
        self.assertEqual(profile_result['points_earned'], result.points_earned)

        history = client.get(f'/api/students/{student.id}/participation_history/')
        history_program = next(
            row for event_row in history.data for row in event_row['programs']
            if row['id'] == program.id
        )
        self.assertEqual(history_program['result']['points_earned'], result.points_earned)

        chest_lookup = client.get(
            f'/api/events/{self.event.id}/search_by_chest_number/',
            {'chest_number': chest.chest_number},
        )
        chest_result = next(row for row in chest_lookup.data['results'] if row['program_id'] == program.id)
        self.assertEqual(chest_result['points_earned'], result.points_earned)

        leaderboard = client.get('/api/points/leaderboard/')
        self.assertIn(student.id, {row['id'] for row in leaderboard.data['students']})

    def test_published_mark_edit_requires_explicit_confirmation(self):
        program = Program.objects.create(
            event=self.event, name='Published Marks', category='junior',
            max_participants=1, is_published=True,
        )
        assign_students(
            user=self.admin, team=self.team, program=program,
            student_ids=[self.students[0].id],
        )
        result = ProgramResult.objects.get(program=program)
        client = APIClient()
        client.force_authenticate(self.admin)
        endpoint = f'/api/events/{self.event.id}/programs/{program.id}/results/bulk_mark_entry/'
        marks = [{
            'id': result.id, 'code_letter': 'A',
            'judge1_marks': 40, 'judge2_marks': 40,
        }]

        blocked = client.post(endpoint, {'marks': marks, 'entry_status': 'submitted'}, format='json')
        self.assertEqual(blocked.status_code, 409)
        self.assertTrue(blocked.data['requires_confirmation'])

        allowed = client.post(endpoint, {
            'marks': marks, 'entry_status': 'submitted',
            'confirm_published_edit': True,
        }, format='json')
        self.assertEqual(allowed.status_code, 200)

    def test_bulk_mark_entry_with_absent_participants_succeeds(self):
        opponent = User.objects.create_user(
            username='absent_opp', email='absent_opp@example.com', password='x',
            role='student', name='Absent Student', student_id='ABS1',
            category='junior', school=self.school,
        )
        self.other_team.members.add(opponent)

        program = Program.objects.create(
            event=self.event, name='Partial Attendance Song',
            category='junior', max_participants=3,
        )
        assign_students(
            user=self.admin, team=self.team, program=program,
            student_ids=[self.students[0].id],
        )
        assign_students(
            user=self.admin, team=self.other_team, program=program,
            student_ids=[opponent.id],
        )
        res1 = ProgramResult.objects.get(program=program, participant=self.students[0])
        res2 = ProgramResult.objects.get(program=program, participant=opponent)
        client = APIClient()
        client.force_authenticate(self.admin)
        endpoint = f'/api/events/{self.event.id}/programs/{program.id}/results/bulk_mark_entry/'

        # Student 0 attended (entered marks). Student 1 was absent (no marks, empty code).
        marks = [
            {'id': res1.id, 'code_letter': 'A', 'judge1_marks': 45, 'judge2_marks': 42},
            {'id': res2.id, 'code_letter': '', 'judge1_marks': None, 'judge2_marks': None},
        ]
        response = client.post(endpoint, {'marks': marks, 'entry_status': 'submitted'}, format='json')
        self.assertEqual(response.status_code, 200)

        res1.refresh_from_db()
        res2.refresh_from_db()
        self.assertEqual(res1.entry_status, 'submitted')
        self.assertEqual(res1.position, 1)
        self.assertEqual(res2.entry_status, 'draft')
        self.assertIsNone(res2.position)
        self.assertEqual(res2.points_earned, 0)

        # Check results complete & publishing succeeds despite absent student
        self.assertTrue(program_results_complete(program))
        pub_response = client.post(f'/api/events/{self.event.id}/toggle_program_publish/', {
            'program_id': program.id,
            'is_published': True,
        }, format='json')
        self.assertEqual(pub_response.status_code, 200)
        program.refresh_from_db()
        self.assertTrue(program.is_published)

    def test_global_points_sum_each_published_event_percentage(self):
        opponent = User.objects.create_user(
            username='opponent', email='opponent@example.com', password='x',
            role='student', name='Opponent', student_id='OP1',
            category='junior', school=self.school,
        )
        self.other_team.members.add(opponent)

        second_event = Event.objects.create(
            title='Second Integrity Test',
            start_date=self.event.start_date,
            end_date=self.event.end_date,
            registration_deadline=self.event.registration_deadline,
            status='published', created_by=self.admin,
            num_judges=2, max_mark_per_judge=50,
            converted_total_mark=100, enable_grading_system=False,
        )

        def publish_scores(event, name, blue_marks, red_marks):
            program = Program.objects.create(
                event=event, name=name, category='junior', max_participants=2,
            )
            assign_students(
                user=self.admin, team=self.team, program=program,
                student_ids=[self.students[0].id],
            )
            assign_students(
                user=self.admin, team=self.other_team, program=program,
                student_ids=[opponent.id],
            )
            for student, marks in (
                (self.students[0], blue_marks), (opponent, red_marks),
            ):
                result = ProgramResult.objects.get(program=program, participant=student)
                result.judge1_marks = Decimal(str(marks))
                result.judge2_marks = Decimal(str(marks))
                result.entry_status = 'submitted'
                result.save()
            recalculate_program_results(program)
            program.is_published = True
            program.save(update_fields=['is_published'])
            recalculate_program_results(program)

        # Blue earns 5/8 = 62.5% in event one and 3/8 = 37.5% in event two.
        publish_scores(self.event, 'First Percentage', 45, 30)
        publish_scores(second_event, 'Second Percentage', 30, 45)

        # A scored but unpublished program must not change the denominator or score.
        private = Program.objects.create(
            event=self.event, name='Private Percentage', category='junior',
            max_participants=1,
        )
        assign_students(
            user=self.admin, team=self.team, program=private,
            student_ids=[self.students[1].id],
        )
        ProgramResult.objects.filter(program=private).update(
            entry_status='submitted', points_earned=100,
        )

        client = APIClient()
        client.force_authenticate(self.admin)
        response = client.get('/api/points/leaderboard/')
        self.assertEqual(response.status_code, 200)

        blue = next(row for row in response.data['teams'] if row['id'] == self.team.id)
        student = next(
            row for row in response.data['students']
            if row['id'] == self.students[0].id
        )
        self.assertAlmostEqual(blue['points'], 100.0)
        self.assertAlmostEqual(student['points'], 100.0)
        self.assertEqual(blue['events_participated'], 2)
        self.assertEqual(
            sorted(item['percentage'] for item in blue['event_breakdown']),
            [37.5, 62.5],
        )

        details = client.get(f'/api/points/{self.students[0].id}/student_details/')
        self.assertEqual(details.status_code, 200)
        self.assertAlmostEqual(details.data['global_percentage'], 100.0)
        self.assertEqual(details.data['raw_points'], 8)

    def test_manual_points_writes_are_not_available(self):
        client = APIClient()
        client.force_authenticate(self.admin)
        self.assertEqual(client.post('/api/points/', {}, format='json').status_code, 405)
        self.assertEqual(
            client.post('/api/points/award_manual_points/', {}, format='json').status_code,
            405,
        )

    def test_create_student_with_team_id(self):
        StudentClass.objects.create(
            school=self.school, category=self.category, name='Junior 1', code='J1'
        )
        client = APIClient()
        client.force_authenticate(self.admin)
        data = {
            'name': 'New Test Student',
            'gender': 'male',
            'category': 'junior',
            'grade': 'J1',
            'section': 'A',
            'team_id': self.team.id
        }
        response = client.post('/api/students/', data, format='json')
        self.assertEqual(response.status_code, 201)
        student_id = response.data['id']
        self.assertTrue(Team.objects.filter(id=self.team.id, members__id=student_id).exists())

    def test_create_student_with_all_optional_fields(self):
        StudentClass.objects.create(
            school=self.school, category=self.category, name='Junior 2', code='J2'
        )
        client = APIClient()
        client.force_authenticate(self.admin)
        data = {
            'name': 'Aarav Sharma',
            'gender': 'male',
            'category': 'junior',
            'grade': 'J2',
            'section': 'B',
            'team_id': self.team.id,
            'email': 'aarav.sharma@school.edu',
            'phone_number': '+919876543210',
            'date_of_birth': '2010-05-15',
            'address': '123 MG Road, Calicut',
            'guardian_name': 'Suresh Sharma',
            'guardian_phone': '+919876543211',
        }
        response = client.post('/api/students/', data, format='json')
        self.assertEqual(response.status_code, 201)
        created = response.data
        self.assertEqual(created['name'], 'Aarav Sharma')
        self.assertEqual(created['email'], 'aarav.sharma@school.edu')
        self.assertEqual(created['phone_number'], '+919876543210')
        self.assertEqual(str(created['date_of_birth']), '2010-05-15')
        self.assertEqual(created['address'], '123 MG Road, Calicut')
        self.assertEqual(created['guardian_name'], 'Suresh Sharma')
        self.assertEqual(created['guardian_phone'], '+919876543211')
        self.assertNotIn('username', created)

        # Also test with empty strings for optional fields (safe sanitization)
        empty_data = {
            'name': 'Diya Nair',
            'gender': 'female',
            'category': 'junior',
            'grade': 'J2',
            'section': '',
            'team_id': None,
            'email': '',
            'phone_number': '',
            'date_of_birth': '',
            'address': '',
            'guardian_name': '',
            'guardian_phone': '',
        }
        empty_res = client.post('/api/students/', empty_data, format='json')
        self.assertEqual(empty_res.status_code, 201)
        self.assertIsNone(empty_res.data['email'])
        self.assertIsNone(empty_res.data['date_of_birth'])
        self.assertNotIn('username', empty_res.data)

    def test_program_level_num_judges_and_mark_evaluation(self):
        # 1. Fallback to event.num_judges (event has num_judges=2)
        default_prog = Program.objects.create(
            event=self.event, name='Default Judges Prog', category='junior', max_participants=2
        )
        self.assertIsNone(default_prog.num_judges)
        self.assertEqual(default_prog.effective_num_judges, 2)

        # 2. Program with custom 1 judge
        single_judge_prog = Program.objects.create(
            event=self.event, name='Single Judge Prog', category='junior',
            max_participants=2, num_judges=1
        )
        self.assertEqual(single_judge_prog.num_judges, 1)
        self.assertEqual(single_judge_prog.effective_num_judges, 1)

        # Result for single judge program submits successfully with only judge1_marks
        res_single = ProgramResult.objects.create(
            program=single_judge_prog,
            participant=self.students[0],
            judge1_marks=Decimal('45.00'),
            entry_status='submitted'
        )
        # Scaled mark = (45 / (1 * 50)) * 100 = 90.00
        self.assertEqual(res_single.total_marks, Decimal('90.00'))
        self.assertEqual(res_single.average_marks, Decimal('45.00'))

        # 3. Program with custom 3 judges
        trio_judge_prog = Program.objects.create(
            event=self.event, name='Trio Judge Prog', category='junior',
            max_participants=2, num_judges=3
        )
        self.assertEqual(trio_judge_prog.effective_num_judges, 3)

        # Attempt to submit with only 2 judges fails validation
        with self.assertRaises(ValidationError):
            res_trio = ProgramResult(
                program=trio_judge_prog,
                participant=self.students[1],
                judge1_marks=Decimal('30.00'),
                judge2_marks=Decimal('35.00'),
                entry_status='submitted'
            )
            res_trio.clean()

        # Completing all 3 judges passes validation and calculates scaled score
        res_trio_valid = ProgramResult.objects.create(
            program=trio_judge_prog,
            participant=self.students[1],
            judge1_marks=Decimal('30.00'),
            judge2_marks=Decimal('35.00'),
            judge3_marks=Decimal('40.00'),
            entry_status='submitted'
        )
        # Raw total = 105. Max raw = 3 * 50 = 150. Converted = (105 / 150) * 100 = 70.00
        self.assertEqual(res_trio_valid.raw_total_marks, Decimal('105.00'))
        self.assertEqual(res_trio_valid.total_marks, Decimal('70.00'))
        self.assertEqual(res_trio_valid.average_marks, Decimal('35.00'))

        # 4. Check ProgramSerializer output
        from events.serializers import ProgramSerializer
        s_data = ProgramSerializer(trio_judge_prog).data
        self.assertEqual(s_data['num_judges'], 3)
        self.assertEqual(s_data['effective_num_judges'], 3)

        def_data = ProgramSerializer(default_prog).data
        self.assertIsNone(def_data['num_judges'])
        self.assertEqual(def_data['effective_num_judges'], 2)

    def test_schedule_auto_calculated_ending_time_without_mandatory_end_time(self):
        stage = EventStage.objects.create(
            event=self.event, number=1, name='Main Stage'
        )
        prog = Program.objects.create(
            event=self.event, name='Recitation 3 participants',
            category='junior', max_participants=3, duration_minutes_per_entry=5,
            stage=stage,
        )
        # Entry count should be 3 from max_participants, 3 * 5 = 15 minutes
        self.assertEqual(prog.schedule_entry_count, 3)
        self.assertEqual(prog.scheduled_duration_minutes, 15)

        start_time = timezone.make_aware(datetime.combine(self.event.start_date, time(10, 0)))
        client = APIClient()
        client.force_authenticate(self.admin)

        # Update schedule with empty end_time (non-mandatory)
        res = client.patch(f'/api/events/{self.event.id}/programs/{prog.id}/schedule/', {
            'stage_id': stage.id,
            'start_time': start_time.isoformat(),
            'duration_minutes_per_entry': 5,
            'end_time': '',  # Left blank/optional
        }, format='json')

        self.assertEqual(res.status_code, 200)
        prog.refresh_from_db()
        expected_end = start_time + timedelta(minutes=15)
        self.assertIsNotNone(prog.end_time)
        self.assertEqual(prog.end_time, expected_end)
        self.assertFalse(prog.schedule_end_is_manual)


class MultiSchoolIsolationTests(TestCase):
    def setUp(self):
        cache.clear()
        self.school_a = School.objects.create(name='School A', code='school-a')
        self.school_b = School.objects.create(name='School B', code='school-b')
        self.admin_a = User.objects.create_user(
            username='admin-a', email='a@example.com', password='SchoolA#Pass123',
            role='admin', school=self.school_a, is_staff=True,
        )
        self.admin_b = User.objects.create_user(
            username='admin-b', email='b@example.com', password='SchoolB#Pass123',
            role='admin', school=self.school_b, is_staff=True,
        )
        today = timezone.localdate()
        self.event_a = Event.objects.create(
            school=self.school_a, title='A Event', start_date=today, end_date=today,
            created_by=self.admin_a,
        )
        self.event_b = Event.objects.create(
            school=self.school_b, title='B Event', start_date=today, end_date=today,
            created_by=self.admin_b,
        )

    def test_school_admin_querysets_are_isolated(self):
        client = APIClient()
        client.force_authenticate(self.admin_a)
        response = client.get('/api/events/')
        ids = {item['id'] for item in response.data['results']}
        self.assertEqual(ids, {self.event_a.id})
        self.assertEqual(client.get(f'/api/events/{self.event_b.id}/').status_code, 404)

    def test_document_exports_cannot_cross_school_boundaries(self):
        client = APIClient()
        client.force_authenticate(self.admin_a)
        protected_exports = (
            f'/api/events/{self.event_b.id}/green-room-sign/',
            f'/api/events/{self.event_b.id}/valuation-sheet/',
            f'/api/events/{self.event_b.id}/call-list/',
            f'/api/events/{self.event_b.id}/reports/complete-results/',
            f'/api/events/{self.event_b.id}/reports/all-results/',
            f'/api/events/{self.event_b.id}/reports/first-place/',
            f'/api/events/{self.event_b.id}/reports/second-place/',
            f'/api/events/{self.event_b.id}/reports/third-place/',
            f'/api/events/{self.event_b.id}/reports/participants-team/',
            f'/api/events/{self.event_b.id}/reports/backup/',
            f'/api/events/{self.event_b.id}/certificate-templates/',
            f'/api/events/{self.event_b.id}/certificate-templates/participation/',
            f'/api/events/{self.event_b.id}/certificate-preview-data/',
            f'/api/events/{self.event_b.id}/certificates/',
        )
        for url in protected_exports:
            with self.subTest(url=url):
                self.assertIn(client.get(url).status_code, (403, 404))

    def test_school_admin_can_manage_only_own_school_users(self):
        other_user = User.objects.create_user(
            username='other-manager', email='other-manager@example.com',
            password='OtherManager#Pass123', role='event_manager', school=self.school_b,
        )
        client = APIClient()
        client.force_authenticate(self.admin_a)
        created = client.post('/api/users/', {
            'name': 'Event Manager', 'email': 'manager-a@example.com',
            'password': 'ManagerA#Pass123', 'role': 'event_manager',
        }, format='json')
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.data['role'], 'event_manager')
        self.assertEqual(User.objects.get(pk=created.data['id']).school, self.school_a)

        listed = client.get('/api/users/')
        listed_ids = {item['id'] for item in listed.data['results']}
        self.assertIn(created.data['id'], listed_ids)
        self.assertNotIn(other_user.id, listed_ids)
        self.assertEqual(client.patch(
            f'/api/users/{other_user.id}/', {'name': 'Wrong tenant'}, format='json'
        ).status_code, 404)

    def test_event_manager_cannot_manage_users_and_admin_cannot_remove_self(self):
        manager = User.objects.create_user(
            username='restricted-manager', email='restricted-manager@example.com',
            password='Restricted#Pass123', role='event_manager', school=self.school_a,
        )
        client = APIClient()
        client.force_authenticate(manager)
        self.assertEqual(client.get('/api/users/').status_code, 403)
        self.assertEqual(client.post('/api/users/', {
            'name': 'Unauthorized', 'email': 'unauthorized@example.com',
            'password': 'Unauthorized#Pass123', 'role': 'admin',
        }, format='json').status_code, 403)

        client.force_authenticate(self.admin_a)
        self.assertEqual(client.patch(
            f'/api/users/{self.admin_a.id}/', {'is_active': False}, format='json'
        ).status_code, 400)
        self.assertEqual(client.delete(f'/api/users/{self.admin_a.id}/').status_code, 400)

    def test_login_without_school_code_and_data_protection(self):
        client = APIClient()
        # Login without school_code succeeds and correctly binds to school_a
        payload = {'email': self.admin_a.email, 'password': 'SchoolA#Pass123'}
        response = client.post('/api/token/', payload, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['user']['school']['id'], self.school_a.id)

        self.assertNotIn('access', response.data)
        self.assertIn('eventloo_access', response.cookies)

        # Providing mismatched school_code fails
        payload_mismatched = {'email': self.admin_a.email, 'password': 'SchoolA#Pass123', 'school_code': self.school_b.code}
        self.assertEqual(APIClient().post('/api/token/', payload_mismatched, format='json').status_code, 400)

        # Providing matching school_code also succeeds
        payload_matched = {'email': self.admin_a.email, 'password': 'SchoolA#Pass123', 'school_code': self.school_a.code}
        self.assertEqual(APIClient().post('/api/token/', payload_matched, format='json').status_code, 200)

        # Team manager login without school_code succeeds
        team = Team.objects.create(name='Lions', school=self.school_a, team_username='lions_lead', team_password='LionsPassword123')
        team_res = APIClient().post('/api/team-manager/login/', {
            'team_username': 'lions_lead',
            'team_password': 'LionsPassword123',
        }, format='json', HTTP_X_REQUESTED_WITH='XMLHttpRequest')
        self.assertEqual(team_res.status_code, 200)
        self.assertEqual(team_res.data['school']['id'], self.school_a.id)

        # Suspended school blocks access
        self.school_a.status = 'suspended'
        self.school_a.save(update_fields=['status'])
        self.assertEqual(client.get('/api/events/').status_code, 401)

    def test_names_and_team_numbers_are_independent_per_school(self):
        first = Team.objects.create(name='Blue', school=self.school_a)
        second = Team.objects.create(name='Blue', school=self.school_b)
        self.assertEqual(first.team_number, 1)
        self.assertEqual(second.team_number, 1)

    def test_super_admin_can_create_school_but_school_admin_cannot(self):
        super_admin = User.objects.create_user(
            username='root@example.com', email='root@example.com', password='Root#Pass12345',
            role='super_admin', school=None, is_staff=False, is_superuser=False,
        )
        endpoint = '/api/super-admin/schools/'
        client = APIClient()
        client.force_authenticate(self.admin_a)
        self.assertEqual(client.post(endpoint, {}, format='json').status_code, 403)
        client.force_authenticate(super_admin)
        response = client.post(endpoint, {
            'name': 'School C', 'code': 'school-c', 'admin_name': 'Admin C',
            'admin_email': 'c@example.com', 'admin_password': 'SchoolC#Pass123',
        }, format='json')
        self.assertEqual(response.status_code, 201)
        school_c = School.objects.get(code='school-c')
        self.assertTrue(SchoolSettings.objects.filter(school=school_c).exists())
        created_admin = User.objects.get(school=school_c, email='c@example.com', role='admin')
        self.assertFalse(created_admin.is_staff)
        self.assertFalse(created_admin.is_superuser)

    def test_platform_login_does_not_require_django_superuser_privileges(self):
        platform_admin = User.objects.create_user(
            username='platform@example.com', email='platform@example.com',
            password='Platform#Pass12345', role='super_admin', school=None,
            is_staff=False, is_superuser=False,
        )
        client = APIClient()
        response = client.post('/api/super-admin/login/', {
            'email': platform_admin.email, 'password': 'Platform#Pass12345',
        }, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertIn('access', response.data)
        self.assertIn('eventloo_access', response.cookies)
        self.assertIn('eventloo_refresh', response.cookies)
        profile = client.get('/api/profile/')
        self.assertEqual(profile.status_code, 200)
        self.assertEqual(profile.data['role'], 'super_admin')

    def test_student_cannot_use_staff_profile_endpoint(self):
        student = User.objects.create_user(
            username='profile-student', email='profile-student@example.com',
            password='Unused#12345', role='student', school=self.school_a,
            student_id='PROFILE-1',
        )
        client = APIClient()
        client.force_authenticate(student)
        self.assertEqual(client.get('/api/profile/').status_code, 403)

    def test_excel_upload_signature_validation_rejects_renamed_text(self):
        upload = SimpleUploadedFile('students.xlsx', b'not an excel workbook')
        with self.assertRaisesMessage(ValueError, 'not a valid XLSX'):
            validate_excel_upload(upload)

    def test_school_creation_returns_json_validation_error_for_common_password(self):
        super_admin = User.objects.create_superuser(
            username='root-weak@example.com', email='root-weak@example.com',
            password='Root#Pass12345', role='super_admin', school=None,
        )
        client = APIClient()
        client.force_authenticate(super_admin)
        response = client.post('/api/super-admin/schools/', {
            'name': 'Rejected School', 'code': 'rejected-school',
            'admin_name': 'Rejected Admin', 'admin_email': 'rejected@example.com',
            'admin_password': 'password123',
        }, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertIn('admin_password', response.data)
        self.assertIn('too common', str(response.data['admin_password']).lower())
        self.assertFalse(School.objects.filter(code='rejected-school').exists())

    def test_super_admin_can_edit_and_confirm_delete_school(self):
        super_admin = User.objects.create_superuser(
            username='root-manage@example.com', email='root-manage@example.com',
            password='Root#Pass12345', role='super_admin', school=None,
        )
        SchoolSettings.objects.create(school=self.school_b, school_name=self.school_b.name)
        client = APIClient()
        client.force_authenticate(super_admin)
        endpoint = f'/api/super-admin/schools/{self.school_b.id}/'

        response = client.patch(endpoint, {
            'name': 'School B Updated', 'email': 'office@school-b.example',
        }, format='json')
        self.assertEqual(response.status_code, 200)
        self.school_b.refresh_from_db()
        self.assertEqual(self.school_b.name, 'School B Updated')
        self.assertEqual(self.school_b.settings.school_name, 'School B Updated')

        self.assertEqual(
            client.delete(endpoint, {'confirm_name': 'Wrong name'}, format='json').status_code,
            400,
        )
        self.assertTrue(School.objects.filter(pk=self.school_b.id).exists())
        self.assertEqual(
            client.delete(endpoint, {'confirm_name': 'School B Updated'}, format='json').status_code,
            204,
        )
        self.assertFalse(School.objects.filter(pk=self.school_b.id).exists())
        self.assertFalse(User.objects.filter(pk=self.admin_b.id).exists())
        self.assertFalse(Event.objects.filter(pk=self.event_b.id).exists())

    def test_super_admin_school_list_is_paginated_and_searchable(self):
        super_admin = User.objects.create_superuser(
            username='root-list@example.com', email='root-list@example.com',
            password='Root#Pass12345', role='super_admin', school=None,
        )
        School.objects.bulk_create([
            School(name=f'Campus {index}', code=f'campus-{index}') for index in range(11)
        ])
        expected_count = School.objects.count()
        client = APIClient()
        client.force_authenticate(super_admin)

        first_page = client.get('/api/super-admin/schools/', {'page': 1, 'page_size': 10})
        self.assertEqual(first_page.status_code, 200)
        self.assertEqual(first_page.data['count'], expected_count)
        self.assertEqual(len(first_page.data['results']), 10)
        self.assertIsNotNone(first_page.data['next'])

        search = client.get('/api/super-admin/schools/', {'search': 'campus-10'})
        self.assertEqual(search.status_code, 200)
        self.assertEqual(search.data['count'], 1)
        self.assertEqual(search.data['results'][0]['code'], 'campus-10')

    def test_super_admin_manages_organization_quotas_and_usage(self):
        super_admin = User.objects.create_superuser(
            username='root-quota@example.com', email='root-quota@example.com',
            password='Root#Pass12345', role='super_admin', school=None,
        )
        client = APIClient()
        client.force_authenticate(super_admin)
        endpoint = f'/api/super-admin/schools/{self.school_a.id}/'

        response = client.patch(endpoint, {
            'max_events': 3,
            'max_users': 4,
            'max_students': 25,
        }, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['max_events'], 3)
        self.assertEqual(response.data['max_users'], 4)
        self.assertEqual(response.data['max_students'], 25)
        self.assertEqual(response.data['event_count'], 1)
        self.assertEqual(response.data['user_count'], 1)

        rejected = client.patch(endpoint, {'max_events': 0}, format='json')
        self.assertEqual(rejected.status_code, 400)
        self.assertIn('max_events', rejected.data)

    def test_school_creation_accepts_organization_quotas(self):
        super_admin = User.objects.create_superuser(
            username='root-new-quota@example.com', email='root-new-quota@example.com',
            password='Root#Pass12345', role='super_admin', school=None,
        )
        client = APIClient()
        client.force_authenticate(super_admin)
        response = client.post('/api/super-admin/schools/', {
            'name': 'Quota School', 'code': 'quota-school',
            'admin_name': 'Quota Admin', 'admin_email': 'quota-admin@example.com',
            'admin_password': 'QuotaSchool#Pass123',
            'max_events': 2, 'max_users': 1, 'max_students': 10,
        }, format='json')
        self.assertEqual(response.status_code, 201)
        school = School.objects.get(code='quota-school')
        self.assertEqual((school.max_events, school.max_users, school.max_students), (2, 1, 10))

        rejected = client.post('/api/super-admin/schools/', {
            'name': 'No Admin Slot', 'code': 'no-admin-slot',
            'admin_name': 'Admin', 'admin_email': 'no-slot@example.com',
            'admin_password': 'NoSlotSchool#Pass123', 'max_users': 0,
        }, format='json')
        self.assertEqual(rejected.status_code, 400)
        self.assertIn('max_users', rejected.data)

    def test_event_user_and_student_create_endpoints_enforce_quotas(self):
        self.school_a.max_events = 1
        self.school_a.max_users = 1
        self.school_a.max_students = 0
        self.school_a.save(update_fields=['max_events', 'max_users', 'max_students'])
        category = StudentCategory.objects.create(
            name='Lower Primary', code='lp', school=self.school_a
        )
        StudentClass.objects.create(
            name='Grade 1', code='1', category=category, school=self.school_a
        )
        client = APIClient()
        client.force_authenticate(self.admin_a)

        event_response = client.post('/api/events/', {
            'title': 'Over Limit', 'event_type': 'competition', 'status': 'draft',
            'start_date': timezone.localdate(), 'end_date': timezone.localdate(),
        }, format='json')
        self.assertEqual(event_response.status_code, 400)
        self.assertEqual(event_response.data['resource'], 'events')

        user_response = client.post('/api/users/', {
            'name': 'Second Admin', 'email': 'second-admin@example.com',
            'role': 'admin', 'password': 'SecondAdmin#Pass123',
        }, format='json')
        self.assertEqual(user_response.status_code, 400)
        self.assertEqual(user_response.data['resource'], 'users')

        student_response = client.post('/api/students/', {
            'name': 'Student One', 'gender': 'female', 'category': 'lp', 'grade': '1',
        }, format='json')
        self.assertEqual(student_response.status_code, 400)
        self.assertEqual(student_response.data['resource'], 'students')

    def test_bulk_student_upload_rejects_the_whole_file_above_quota(self):
        from openpyxl import Workbook

        self.school_a.max_students = 1
        self.school_a.save(update_fields=['max_students'])
        category = StudentCategory.objects.create(
            name='Lower Primary', code='lp', school=self.school_a
        )
        StudentClass.objects.create(
            name='Grade 1', code='1', category=category, school=self.school_a
        )
        workbook = Workbook()
        sheet = workbook.active
        sheet.append(['name', 'gender', 'category', 'class'])
        sheet.append(['Student One', 'Female', 'lp', 'Grade 1'])
        sheet.append(['Student Two', 'Male', 'lp', 'Grade 1'])
        content = BytesIO()
        workbook.save(content)
        upload = SimpleUploadedFile(
            'students.xlsx', content.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        client = APIClient()
        client.force_authenticate(self.admin_a)
        response = client.post('/api/students/bulk_upload/', {'file': upload}, format='multipart')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['resource'], 'students')
        self.assertFalse(User.objects.filter(school=self.school_a, role='student').exists())

    def test_custom_read_actions_do_not_accept_foreign_school_ids(self):
        category_a = StudentCategory.objects.create(
            name='Junior A', code='junior', school=self.school_a
        )
        StudentCategory.objects.create(name='Junior B', code='junior', school=self.school_b)
        program_a = Program.objects.create(
            event=self.event_a, name='Program A', category=category_a.code,
            max_participants=1, program_type='stage',
        )
        program_b = Program.objects.create(
            event=self.event_b, name='Program B', category='junior',
            max_participants=1, program_type='stage',
        )
        student_b = User.objects.create_user(
            username='student-b', email='student-b@example.com', password='Unused#123',
            role='student', school=self.school_b, student_id='B-1', category='junior',
        )
        client = APIClient()
        client.force_authenticate(self.admin_a)

        grouped = client.get('/api/programs/by_category/')
        self.assertEqual(grouped.status_code, 200)
        serialized = [item['id'] for group in grouped.data.values() for item in group['programs']]
        self.assertIn(program_a.id, serialized)
        self.assertNotIn(program_b.id, serialized)
        self.assertEqual(client.get(f'/api/events/{self.event_b.id}/top_scorers/').status_code, 404)
        self.assertEqual(
            client.get(f'/api/points/{student_b.id}/student_details/').status_code,
            404,
        )
        self.assertEqual(
            client.get(
                f'/api/events/{self.event_b.id}/programs/{program_b.id}/results/results_summary/'
            ).status_code,
            403,
        )

    def test_event_stages_are_tenant_scoped_and_assignable_to_programs(self):
        category = StudentCategory.objects.create(
            name='Junior A', code='junior', school=self.school_a
        )
        foreign_stage = EventStage.objects.create(
            event=self.event_b, number=1, name='Foreign Hall'
        )
        client = APIClient()
        client.force_authenticate(self.admin_a)
        stages_url = f'/api/events/{self.event_a.id}/stages/'

        created = client.post(stages_url, {
            'number': 1, 'name': 'Main Hall', 'capacity': 300,
            'map_link': 'https://maps.example.com/main-hall',
        }, format='json')
        self.assertEqual(created.status_code, 201)
        stage_id = created.data['id']
        self.assertEqual(created.data['display_name'], 'Main Hall')
        self.assertEqual(created.data['program_count'], 0)

        duplicate = client.post(stages_url, {'number': 1}, format='json')
        self.assertEqual(duplicate.status_code, 400)
        self.assertIn('number', duplicate.data)
        self.assertEqual(client.get(f'{stages_url}{foreign_stage.id}/').status_code, 404)

        program = client.post('/api/programs/', {
            'event': self.event_a.id,
            'name': 'Stage Program',
            'category': category.code,
            'program_type': 'stage',
            'is_team_based': False,
            'max_participants': 2,
            'stage_id': stage_id,
        }, format='json')
        self.assertEqual(program.status_code, 201)
        self.assertEqual(program.data['stage']['id'], stage_id)
        self.assertEqual(program.data['venue'], 'Main Hall')

        foreign_program = client.post('/api/programs/', {
            'event': self.event_a.id,
            'name': 'Invalid Stage Program',
            'category': category.code,
            'program_type': 'stage',
            'is_team_based': False,
            'max_participants': 2,
            'stage_id': foreign_stage.id,
        }, format='json')
        self.assertEqual(foreign_program.status_code, 400)
        self.assertIn('stage_id', foreign_program.data)

        updated = client.patch(
            f'{stages_url}{stage_id}/', {'name': 'Grand Hall'}, format='json'
        )
        self.assertEqual(updated.status_code, 200)
        saved_program = Program.objects.get(pk=program.data['id'])
        self.assertEqual(saved_program.venue, 'Grand Hall')

        deleted = client.delete(f'{stages_url}{stage_id}/')
        self.assertEqual(deleted.status_code, 204)
        saved_program.refresh_from_db()
        self.assertIsNone(saved_program.stage_id)
        self.assertEqual(saved_program.venue, 'Grand Hall')

    def test_custom_write_actions_require_admin_and_same_school_relations(self):
        category = StudentCategory.objects.create(
            name='Junior', code='junior', school=self.school_a
        )
        program = Program.objects.create(
            event=self.event_a, name='Scoped Program', category=category.code,
            max_participants=1, program_type='stage',
        )
        student_a = User.objects.create_user(
            username='student-a', email='student-a@example.com', password='Unused#123',
            role='student', school=self.school_a, student_id='A-1', category='junior',
        )
        student_b = User.objects.create_user(
            username='student-b-write', email='student-b-write@example.com', password='Unused#123',
            role='student', school=self.school_b, student_id='B-1', category='junior',
        )
        team_a = Team.objects.create(name='Scoped Team', school=self.school_a)
        client = APIClient()
        client.force_authenticate(student_a)
        base = f'/api/events/{self.event_a.id}/programs/{program.id}/assignments'
        self.assertEqual(client.post(f'{base}/assign_all_category/', {'category': 'junior'}).status_code, 403)
        self.assertEqual(client.post('/api/students/bulk_upload/', {}).status_code, 403)

        client.force_authenticate(self.admin_a)
        response = client.patch(
            f'/api/teams/{team_a.id}/',
            {'member_emails': [student_b.email]},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(team_a.members.filter(pk=student_b.pk).exists())
        with self.assertRaises(ValidationError):
            team_a.members.add(student_b)

    def test_team_login_only_lists_its_school_programs(self):
        StudentCategory.objects.create(name='Junior A', code='junior', school=self.school_a)
        StudentCategory.objects.create(name='Junior B', code='junior', school=self.school_b)
        self.event_a.status = 'published'
        self.event_a.save(update_fields=['status'])
        self.event_b.status = 'published'
        self.event_b.save(update_fields=['status'])
        program_a = Program.objects.create(
            event=self.event_a, name='Visible Program', category='junior',
            max_participants=1, is_active=True, program_type='stage',
        )
        program_b = Program.objects.create(
            event=self.event_b, name='Foreign Program', category='junior',
            max_participants=1, is_active=True, program_type='stage',
        )
        team = Team.objects.create(name='Login Team', school=self.school_a)
        password = team._plain_team_password
        client = APIClient()
        login = client.post('/api/team-manager/login/', {
            'team_username': team.team_username,
            'team_password': password,
            'school_code': self.school_a.code,
        }, format='json')
        self.assertEqual(login.status_code, 200)
        self.assertNotIn('access', login.data)
        self.assertNotIn('refresh', login.data)
        self.assertIn('eventloo_access', login.cookies)
        self.assertIn('eventloo_refresh', login.cookies)
        response = client.get('/api/team-manager/available_programs/')
        self.assertEqual(response.status_code, 200)
        ids = {item['id'] for item in response.data['results']}
        self.assertIn(program_a.id, ids)
        self.assertNotIn(program_b.id, ids)

    def test_password_change_revokes_existing_access_token(self):
        client = APIClient()
        login = client.post('/api/token/', {
            'email': self.admin_a.email,
            'password': 'SchoolA#Pass123',
            'school_code': self.school_a.code,
        }, format='json')
        self.assertEqual(login.status_code, 200)
        self.assertNotIn('access', login.data)
        self.assertNotIn('refresh', login.data)
        self.assertIn('eventloo_access', login.cookies)
        self.assertIn('eventloo_refresh', login.cookies)
        self.admin_a.set_password('Replacement#Pass123')
        self.admin_a.save(update_fields=['password'])
        self.assertEqual(client.get('/api/profile/').status_code, 401)

        refresh = client.post(
            '/api/token/refresh/', {}, format='json',
            HTTP_X_REQUESTED_WITH='XMLHttpRequest',
        )
        self.assertEqual(refresh.status_code, 401)

    def test_suspended_school_cannot_rotate_refresh_token(self):
        client = APIClient()
        login = client.post('/api/token/', {
            'email': self.admin_a.email,
            'password': 'SchoolA#Pass123',
            'school_code': self.school_a.code,
        }, format='json')
        self.assertEqual(login.status_code, 200)
        self.school_a.status = 'suspended'
        self.school_a.save(update_fields=['status'])

        refresh = client.post(
            '/api/token/refresh/', {}, format='json',
            HTTP_X_REQUESTED_WITH='XMLHttpRequest',
        )
        self.assertEqual(refresh.status_code, 401)

    def test_active_school_and_team_sessions_rotate_refresh_tokens_once(self):
        school_client = APIClient()
        login = school_client.post('/api/token/', {
            'email': self.admin_a.email,
            'password': 'SchoolA#Pass123',
            'school_code': self.school_a.code,
        }, format='json')
        self.assertEqual(login.status_code, 200)
        first_refresh = login.cookies['eventloo_refresh'].value
        rotated = school_client.post(
            '/api/token/refresh/', {}, format='json',
            HTTP_X_REQUESTED_WITH='XMLHttpRequest',
        )
        self.assertEqual(rotated.status_code, 200)
        replay = APIClient().post(
            '/api/token/refresh/', {'refresh': first_refresh}, format='json'
        )
        self.assertEqual(replay.status_code, 401)

        team = Team.objects.create(name='Rotating Team', school=self.school_a)
        team_client = APIClient()
        team_login = team_client.post('/api/team-manager/login/', {
            'team_username': team.team_username,
            'team_password': team._plain_team_password,
            'school_code': self.school_a.code,
        }, format='json')
        self.assertEqual(team_login.status_code, 200)
        team_refresh = team_client.post(
            '/api/token/refresh/', {}, format='json',
            HTTP_X_REQUESTED_WITH='XMLHttpRequest',
        )
        self.assertEqual(team_refresh.status_code, 200)

    def test_regenerated_team_credentials_revoke_refresh_token(self):
        team = Team.objects.create(name='Refresh Team', school=self.school_a)
        password = team._plain_team_password
        client = APIClient()
        login = client.post('/api/team-manager/login/', {
            'team_username': team.team_username,
            'team_password': password,
            'school_code': self.school_a.code,
        }, format='json')
        self.assertEqual(login.status_code, 200)
        team.generate_team_credentials()
        team.save()

        refresh = client.post(
            '/api/token/refresh/', {}, format='json',
            HTTP_X_REQUESTED_WITH='XMLHttpRequest',
        )
        self.assertEqual(refresh.status_code, 401)

    def test_low_privilege_user_cannot_read_assignments_or_raw_results(self):
        category = StudentCategory.objects.create(
            name='Private Results', code='private-results', school=self.school_a
        )
        program = Program.objects.create(
            event=self.event_a, name='Private Program', category=category.code,
            max_participants=2, program_type='stage',
        )
        student = User.objects.create_user(
            username='limited-student', email='limited@example.com',
            password='Limited#Pass123', role='student', school=self.school_a,
            student_id='LIMITED-1', category=category.code,
        )
        ProgramAssignment.objects.create(
            program=program, student=student, assigned_by=self.admin_a,
        )
        ProgramResult.objects.create(
            program=program, participant=student, entered_by=self.admin_a,
            judge1_marks=Decimal('75'), comments='Confidential judge note',
        )
        client = APIClient()
        client.force_authenticate(student)
        base = f'/api/events/{self.event_a.id}/programs/{program.id}'

        self.assertEqual(client.get(f'{base}/assignments/').status_code, 403)
        self.assertEqual(client.get(f'{base}/results/').status_code, 403)

    def test_password_change_revocation_applies_to_team_manager_compatible_routes(self):
        from accounts.serializers import CustomTokenObtainPairSerializer

        token = str(CustomTokenObtainPairSerializer.get_token(self.admin_a).access_token)
        self.admin_a.set_password('Replacement#Pass456')
        self.admin_a.save(update_fields=['password'])
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

        self.assertEqual(client.get('/api/team-manager/dashboard/').status_code, 401)

    def test_event_manager_cannot_manage_school_students_settings_or_team_credentials(self):
        event_manager = User.objects.create_user(
            username='event-manager', email='manager@example.com',
            password='Manager#Pass123', role='event_manager', school=self.school_a,
        )
        team = Team.objects.create(name='Admin Controlled', school=self.school_a)
        client = APIClient()
        client.force_authenticate(event_manager)

        self.assertEqual(client.post('/api/students/', {}, format='json').status_code, 403)
        self.assertEqual(client.patch('/api/schoolsettings/1/', {}, format='json').status_code, 403)
        self.assertEqual(
            client.post(f'/api/teams/{team.id}/regenerate_credentials/', {}, format='json').status_code,
            403,
        )

    @override_settings(REQUIRE_SUPER_ADMIN_MFA=True)
    def test_super_admin_mfa_enrollment_and_login(self):
        from accounts.mfa import totp_code

        platform_admin = User.objects.create_user(
            username='mfa-root@example.com', email='mfa-root@example.com',
            password='MfaRoot#Pass12345', role='super_admin', school=None,
        )
        client = APIClient()
        credentials = {
            'email': platform_admin.email,
            'password': 'MfaRoot#Pass12345',
        }
        required = client.post('/api/super-admin/login/', credentials, format='json')
        self.assertEqual(required.status_code, 403)
        self.assertEqual(required.data['code'], 'mfa_setup_required')

        setup = client.post('/api/super-admin/mfa/setup/', credentials, format='json')
        self.assertEqual(setup.status_code, 200)
        self.assertNotIn('password', setup.data)
        otp = totp_code(setup.data['secret'])
        confirmed = client.post(
            '/api/super-admin/mfa/confirm/', {**credentials, 'otp': otp}, format='json'
        )
        self.assertEqual(confirmed.status_code, 200)
        denied = client.post('/api/super-admin/login/', credentials, format='json')
        self.assertEqual(denied.status_code, 401)
        accepted = client.post(
            '/api/super-admin/login/', {**credentials, 'otp': otp}, format='json'
        )
        self.assertEqual(accepted.status_code, 200)
        self.assertIn('eventloo_access', accepted.cookies)

        replay = client.post(
            '/api/super-admin/login/', {**credentials, 'otp': otp}, format='json',
            HTTP_X_REQUESTED_WITH='XMLHttpRequest',
        )
        self.assertEqual(replay.status_code, 401)

    @override_settings(REQUIRE_SCHOOL_STAFF_MFA=True)
    def test_school_staff_mfa_enrollment_login_and_replay_protection(self):
        from accounts.mfa import totp_code

        client = APIClient()
        credentials = {
            'email': self.admin_a.email,
            'password': 'SchoolA#Pass123',
            'school_code': self.school_a.code,
        }
        required = client.post('/api/token/', credentials, format='json')
        self.assertEqual(required.status_code, 403)
        self.assertEqual(required.data['code'], 'mfa_setup_required')

        setup = client.post('/api/mfa/setup/', credentials, format='json')
        self.assertEqual(setup.status_code, 200)
        self.assertNotIn('password', setup.data)
        otp = totp_code(setup.data['secret'])
        confirmed = client.post('/api/mfa/confirm/', {
            **credentials, 'otp': otp,
        }, format='json')
        self.assertEqual(confirmed.status_code, 200)

        accepted = client.post('/api/token/', {**credentials, 'otp': otp}, format='json')
        self.assertEqual(accepted.status_code, 200)
        self.assertIn('eventloo_access', accepted.cookies)
        replay = APIClient().post('/api/token/', {**credentials, 'otp': otp}, format='json')
        self.assertEqual(replay.status_code, 401)

    def test_students_cannot_use_school_staff_login(self):
        student = User.objects.create_user(
            username='student-login', email='student-login@example.com',
            password='Student#Pass123', role='student', school=self.school_a,
            student_id='LOGIN-1',
        )
        response = APIClient().post('/api/token/', {
            'email': student.email,
            'password': 'Student#Pass123',
            'school_code': self.school_a.code,
        }, format='json')
        self.assertEqual(response.status_code, 400)

    def test_school_staff_mfa_setup_rejects_wrong_tenant(self):
        response = APIClient().post('/api/mfa/setup/', {
            'email': self.admin_a.email,
            'password': 'SchoolA#Pass123',
            'school_code': self.school_b.code,
        }, format='json')
        self.assertEqual(response.status_code, 401)

    def test_only_super_admin_can_reset_school_staff_mfa_with_confirmation(self):
        from accounts.serializers import CustomTokenObtainPairSerializer

        self.admin_a.mfa_secret = 'JBSWY3DPEHPK3PXP'
        self.admin_a.mfa_enabled = True
        self.admin_a.mfa_last_used_step = 123
        self.admin_a.save(update_fields=['mfa_secret', 'mfa_enabled', 'mfa_last_used_step'])
        old_access = str(CustomTokenObtainPairSerializer.get_token(self.admin_a).access_token)
        endpoint = f'/api/super-admin/schools/{self.school_a.id}/reset-staff-mfa/'
        client = APIClient()
        client.force_authenticate(self.admin_b)
        self.assertEqual(client.post(endpoint, {}, format='json').status_code, 403)

        super_admin = User.objects.create_user(
            username='mfa-recovery@example.com', email='mfa-recovery@example.com',
            password='Recovery#Pass12345', role='super_admin', school=None,
        )
        client.force_authenticate(super_admin)
        wrong = client.post(endpoint, {
            'staff_id': self.admin_a.id, 'confirm_email': 'wrong@example.com',
        }, format='json')
        self.assertEqual(wrong.status_code, 400)
        accepted = client.post(endpoint, {
            'staff_id': self.admin_a.id, 'confirm_email': self.admin_a.email,
        }, format='json')
        self.assertEqual(accepted.status_code, 200)
        self.admin_a.refresh_from_db()
        self.assertFalse(self.admin_a.mfa_enabled)
        self.assertEqual(self.admin_a.mfa_secret, '')
        self.assertIsNone(self.admin_a.mfa_last_used_step)
        stale_client = APIClient()
        stale_client.credentials(HTTP_AUTHORIZATION=f'Bearer {old_access}')
        self.assertEqual(stale_client.get('/api/profile/').status_code, 401)

    @override_settings(DEBUG=False)
    def test_production_does_not_expose_media_route(self):
        with self.assertRaises(Resolver404):
            resolve('/media/../db.sqlite3')

    def test_custom_team_credentials_creation_and_jwt_login(self):
        from django.contrib.auth.hashers import check_password

        client = APIClient()
        client.force_authenticate(self.admin_a)

        # Admin creates team with custom username and password
        payload = {
            'name': 'Red Warriors',
            'description': 'Senior Warriors Team',
            'team_username': 'warriors_lead',
            'team_password': 'SecretPassword123',
        }
        res = client.post('/api/teams/', payload, format='json')
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data['team_username'], 'warriors_lead')
        team_id = res.data['id']

        team = Team.objects.get(id=team_id)
        self.assertEqual(team.team_username, 'warriors_lead')
        self.assertTrue(check_password('SecretPassword123', team.team_password))

        # Anonymous team manager login attempts
        anon_client = APIClient()

        # Wrong password fails
        bad_login = anon_client.post('/api/team-manager/login/', {
            'team_username': 'warriors_lead',
            'team_password': 'WrongPassword999',
            'school_code': self.school_a.code,
        }, format='json', HTTP_X_REQUESTED_WITH='XMLHttpRequest')
        self.assertIn(bad_login.status_code, [400, 401])

        # Correct credentials login succeeds
        good_login = anon_client.post('/api/team-manager/login/', {
            'team_username': 'warriors_lead',
            'team_password': 'SecretPassword123',
            'school_code': self.school_a.code,
        }, format='json', HTTP_X_REQUESTED_WITH='XMLHttpRequest')
        self.assertEqual(good_login.status_code, 200)
        self.assertEqual(good_login.data['access_type'], 'team_manager')
        self.assertEqual(good_login.data['team']['id'], team_id)

        # Cookies contain access_token
        from django.conf import settings
        access_cookie = good_login.cookies.get(settings.ACCESS_COOKIE_NAME)
        self.assertIsNotNone(access_cookie)

        # Team leader accesses team-manager dashboard
        dash_res = anon_client.get('/api/team-manager/dashboard/')
        self.assertEqual(dash_res.status_code, 200)
        self.assertIn('totalTeams', dash_res.data)
        self.assertIn('teams', dash_res.data)

        # Team leader accesses my_teams
        teams_res = anon_client.get('/api/team-manager/my_teams/')
        self.assertEqual(teams_res.status_code, 200)

        # Team leader accesses leaderboard
        board_res = anon_client.get('/api/team-manager/leaderboard/')
        self.assertEqual(board_res.status_code, 200)
        self.assertIn('teams', board_res.data)

        # Re-login with existing cookie does not fail on pre-auth
        relogin = anon_client.post('/api/team-manager/login/', {
            'team_username': 'warriors_lead',
            'team_password': 'SecretPassword123',
            'school_code': self.school_a.code,
        }, format='json', HTTP_X_REQUESTED_WITH='XMLHttpRequest')
        self.assertEqual(relogin.status_code, 200)

        # Default authenticated endpoint (e.g. categories) accepts team manager token via SchoolJWTAuthentication
        cat_res = anon_client.get('/api/categories/')
        self.assertEqual(cat_res.status_code, 200)

    def test_admin_can_update_team_leader_credentials_and_invalidates_old_session(self):
        client = APIClient()
        client.force_authenticate(self.admin_a)

        team = Team.objects.create(
            name='Blue Sharks',
            school=self.school_a,
            team_username='sharks_lead',
            team_password='InitialPass123',
        )

        # Team leader logs in with initial password
        leader_client = APIClient()
        login_res = leader_client.post('/api/team-manager/login/', {
            'team_username': 'sharks_lead',
            'team_password': 'InitialPass123',
            'school_code': self.school_a.code,
        }, format='json', HTTP_X_REQUESTED_WITH='XMLHttpRequest')
        self.assertEqual(login_res.status_code, 200)

        # Leader can view dashboard
        self.assertEqual(leader_client.get('/api/team-manager/dashboard/').status_code, 200)

        # Admin updates leader username & password via credentials endpoint
        update_res = client.post(f'/api/teams/{team.id}/credentials/', {
            'username': 'alpha_sharks',
            'password': 'UpdatedLeaderPass999',
        }, format='json')
        self.assertEqual(update_res.status_code, 200)
        self.assertEqual(update_res.data['username'], 'alpha_sharks')

        # Old leader session should now be rejected (token credential hash mismatch)
        self.assertEqual(leader_client.get('/api/team-manager/dashboard/').status_code, 401)

        # Login with old password fails
        old_attempt = APIClient().post('/api/team-manager/login/', {
            'team_username': 'alpha_sharks',
            'team_password': 'InitialPass123',
            'school_code': self.school_a.code,
        }, format='json', HTTP_X_REQUESTED_WITH='XMLHttpRequest')
        self.assertIn(old_attempt.status_code, [400, 401])

        # Login with new username and password succeeds
        new_client = APIClient()
        new_attempt = new_client.post('/api/team-manager/login/', {
            'team_username': 'alpha_sharks',
            'team_password': 'UpdatedLeaderPass999',
            'school_code': self.school_a.code,
        }, format='json', HTTP_X_REQUESTED_WITH='XMLHttpRequest')
        self.assertEqual(new_attempt.status_code, 200)
        self.assertEqual(new_client.get('/api/team-manager/dashboard/').status_code, 200)

    def test_student_duplicate_enrollment_prevention(self):
        client = APIClient()
        client.force_authenticate(self.admin_a)

        # Setup categories and classes for school_a
        cat_lp = StudentCategory.objects.create(name='Lower Primary', code='lp', school=self.school_a)
        cat_up = StudentCategory.objects.create(name='Upper Primary', code='up', school=self.school_a)
        StudentClass.objects.create(name='Class 1', code='01', category=cat_lp, school=self.school_a)
        StudentClass.objects.create(name='Class 5', code='05', category=cat_up, school=self.school_a)

        # First student enrollment succeeds
        res1 = client.post('/api/students/', {
            'name': 'Amina Farooq',
            'category': 'lp',
            'grade': '01',
            'section': 'A',
            'gender': 'female',
        }, format='json')
        self.assertEqual(res1.status_code, 201)

        # Duplicate enrollment in same class & section fails
        dup_res = client.post('/api/students/', {
            'name': 'amina farooq',
            'category': 'lp',
            'grade': '01',
            'section': 'A',
            'gender': 'female',
        }, format='json')
        self.assertEqual(dup_res.status_code, 400)
        self.assertIn('name', dup_res.data)
        self.assertIn('already enrolled', str(dup_res.data['name']))

        # Same name in a different class succeeds
        diff_class_res = client.post('/api/students/', {
            'name': 'Amina Farooq',
            'category': 'up',
            'grade': '05',
            'section': 'A',
            'gender': 'female',
        }, format='json')
        self.assertEqual(diff_class_res.status_code, 201)

        # Same name in same class but different section succeeds
        diff_sec_res = client.post('/api/students/', {
            'name': 'Amina Farooq',
            'category': 'lp',
            'grade': '01',
            'section': 'B',
            'gender': 'female',
        }, format='json')
        self.assertEqual(diff_sec_res.status_code, 201)

    def test_get_program_participants_unifies_subteams_for_group_programs(self):
        from events.services import assign_students

        group_prog = Program.objects.create(
            event=self.event_a,
            name='Group Patriotic Song',
            category='general',
            is_team_based=True,
            team_size=3,
            max_teams_per_school=2,
        )

        team = Team.objects.create(name='Warriors', school=self.school_a)
        st1 = User.objects.create(username='p1', name='P1', role='student', school=self.school_a, category='lp', gender='male')
        st2 = User.objects.create(username='p2', name='P2', role='student', school=self.school_a, category='lp', gender='female')
        st3 = User.objects.create(username='p3', name='P3', role='student', school=self.school_a, category='up', gender='male')
        team.members.add(st1, st2, st3)

        assign_students(
            user=self.admin_a,
            team=team,
            program=group_prog,
            student_ids=[st1.id, st2.id, st3.id],
            sub_team_number=1,
            leader_id=st1.id,
        )

        client = APIClient()
        client.force_authenticate(self.admin_a)

        res = client.get(f'/api/programs/{group_prog.id}/participants/')
        self.assertEqual(res.status_code, 200)
        results = res.data['results']

        # Unified into 1 row for the sub-team instead of 3 separate rows!
        self.assertEqual(len(results), 1)
        entry = results[0]
        self.assertTrue(entry['is_group'])
        self.assertEqual(entry['team_member_count'], 3)
        self.assertEqual(entry['sub_team_number'], 1)
        self.assertIn('P1', entry['name'])
        self.assertIn('P2', entry['name'])
        self.assertIn('P3', entry['name'])
        self.assertIsNotNone(entry['chest_number'])
        self.assertEqual(len(entry['members']), 3)

