from datetime import timedelta
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import School, StudentCategory
from events.models import (
    Event,
    Program,
    ProgramAssignment,
    ProgramResult,
    ChestNumber,
    Team,
)
from events.services import (
    assign_students,
    remove_assignment_group,
)

User = get_user_model()


class DeepAssignmentAuditTests(TestCase):
    def setUp(self):
        self.school = School.objects.create(name='Audit Academy', code='AA')
        self.admin = User.objects.create_user(
            username='admin_audit',
            email='admin_audit@example.com',
            password='password123',
            role='admin',
            school=self.school,
            name='Audit Administrator',
        )
        self.team_manager_user = User.objects.create_user(
            username='manager_audit',
            email='manager_audit@example.com',
            password='password123',
            role='team_manager',
            school=self.school,
            name='Audit Team Manager',
        )
        self.team = Team.objects.create(
            name='Falcons',
            school=self.school,
            team_number=1,
            team_manager=self.team_manager_user,
        )
        self.team_manager_user.team = self.team
        self.team_manager_user.save()

        # Categories
        self.cat_junior = StudentCategory.objects.create(
            school=self.school, name='Junior', code='junior',
        )
        self.cat_senior = StudentCategory.objects.create(
            school=self.school, name='Senior', code='senior',
        )
        self.cat_general = StudentCategory.objects.create(
            school=self.school, name='General', code='general', is_mixing=True,
        )

        # Event
        self.event = Event.objects.create(
            school=self.school,
            title='Annual Youth Festival 2026',
            status='published',
            created_by=self.admin,
            start_date=timezone.now().date(),
            end_date=timezone.now().date() + timedelta(days=7),
            max_single_programs_per_student=2,
            max_group_programs_per_student=2,
            max_programs_per_student=4,
            registration_deadline=timezone.now() + timedelta(days=5),
            category_participation_limits={
                'junior': {
                    'max_single': 2,
                    'max_group': 2,
                    'max_total': 3,
                    'max_onstage': 2,
                    'max_offstage': 2,
                    'type_limits': {
                        'stage': 2,
                        'off_stage': 2,
                    },
                }
            },
        )

        # Students
        self.students = []
        for i in range(1, 10):
            st = User.objects.create_user(
                username=f'student_{i}',
                email=f'student_{i}@example.com',
                password='password123',
                role='student',
                school=self.school,
                name=f'Student {i}',
                student_id=f'STU{100 + i}',
                category='junior',
                grade='8',
                section='A',
            )
            self.team.members.add(st)
            self.students.append(st)

        self.client = APIClient()

    # =========================================================================
    # 1. DATA INTEGRITY & PROFILE PRESERVATION
    # =========================================================================

    def test_assigning_student_does_not_mutate_student_profile_fields(self):
        """Assigning a student must not modify name, category, grade, section, etc."""
        student = self.students[0]
        original_name = student.name
        original_category = student.category
        original_grade = student.grade
        original_section = student.section
        original_student_id = student.student_id

        program = Program.objects.create(
            event=self.event,
            name='Elocution English',
            category='junior',
            is_team_based=False,
            program_type='stage',
        )

        assignments = assign_students(
            user=self.admin,
            team=self.team,
            program=program,
            student_ids=[student.id],
        )
        self.assertEqual(len(assignments), 1)

        student.refresh_from_db()
        self.assertEqual(student.name, original_name)
        self.assertEqual(student.category, original_category)
        self.assertEqual(student.grade, original_grade)
        self.assertEqual(student.section, original_section)
        self.assertEqual(student.student_id, original_student_id)

    # =========================================================================
    # 2. CHEST NUMBER STABILITY, UNIQUENESS & ANTI-DUPLICATION
    # =========================================================================

    def test_chest_number_is_unique_per_event_and_stable_across_programs(self):
        """A student receives ONE authoritative chest number that remains unchanged."""
        prog1 = Program.objects.create(
            event=self.event, name='Solo Song', category='junior', is_team_based=False,
        )
        prog2 = Program.objects.create(
            event=self.event, name='Pencil Drawing', category='junior', is_team_based=False,
            program_type='off_stage',
        )

        a1 = assign_students(
            user=self.admin, team=self.team, program=prog1, student_ids=[self.students[0].id],
        )[0]
        a2 = assign_students(
            user=self.admin, team=self.team, program=prog2, student_ids=[self.students[0].id],
        )[0]

        self.assertIsNotNone(a1.chest_number)
        self.assertEqual(a1.chest_number, a2.chest_number)

        chest_obj = ChestNumber.objects.get(event=self.event, student=self.students[0])
        self.assertEqual(chest_obj.chest_number, a1.chest_number)
        self.assertEqual(ChestNumber.objects.filter(event=self.event, student=self.students[0]).count(), 1)

        # Different student gets a different unique chest number
        a3 = assign_students(
            user=self.admin, team=self.team, program=prog1, student_ids=[self.students[1].id],
        )[0]
        self.assertNotEqual(a1.chest_number, a3.chest_number)

    def test_chest_number_cannot_be_mutated_directly(self):
        """ChestNumber model rejects in-place changes to allocated numbers."""
        prog = Program.objects.create(
            event=self.event, name='Speech', category='junior', is_team_based=False,
        )
        assign_students(
            user=self.admin, team=self.team, program=prog, student_ids=[self.students[0].id],
        )
        chest = ChestNumber.objects.get(event=self.event, student=self.students[0])
        chest.chest_number = chest.chest_number + 50
        with self.assertRaises(ValidationError):
            chest.save()

    # =========================================================================
    # 3. STUDENT LIMITS ENFORCEMENT
    # =========================================================================

    def test_single_program_limit_enforced(self):
        """Student cannot exceed max_single limit."""
        prog1 = Program.objects.create(event=self.event, name='Solo Stage 1', category='junior', is_team_based=False, program_type='stage')
        prog2 = Program.objects.create(event=self.event, name='Solo OffStage 1', category='junior', is_team_based=False, program_type='off_stage')
        prog3 = Program.objects.create(event=self.event, name='Solo OffStage 2', category='junior', is_team_based=False, program_type='off_stage')

        assign_students(user=self.admin, team=self.team, program=prog1, student_ids=[self.students[0].id])
        assign_students(user=self.admin, team=self.team, program=prog2, student_ids=[self.students[0].id])

        with self.assertRaises(ValidationError) as ctx:
            assign_students(user=self.admin, team=self.team, program=prog3, student_ids=[self.students[0].id])
        self.assertIn('single/individual', str(ctx.exception).lower())

    def test_category_stage_offstage_type_limit_enforced(self):
        """Student cannot exceed type limits (e.g. max_offstage)."""
        prog1 = Program.objects.create(event=self.event, name='Essay', category='junior', is_team_based=False, program_type='off_stage')
        prog2 = Program.objects.create(event=self.event, name='Painting', category='junior', is_team_based=False, program_type='off_stage')
        prog3 = Program.objects.create(event=self.event, name='Poem', category='junior', is_team_based=False, program_type='off_stage')

        assign_students(user=self.admin, team=self.team, program=prog1, student_ids=[self.students[0].id])
        assign_students(user=self.admin, team=self.team, program=prog2, student_ids=[self.students[0].id])

        with self.assertRaises(ValidationError) as ctx:
            assign_students(user=self.admin, team=self.team, program=prog3, student_ids=[self.students[0].id])
        self.assertIn('off stage', str(ctx.exception).lower())

    def test_category_mismatch_is_rejected(self):
        """Student in Junior category cannot be assigned to Senior program."""
        prog_senior = Program.objects.create(event=self.event, name='Senior Debate', category='senior', is_team_based=False)
        with self.assertRaises(ValidationError) as ctx:
            assign_students(user=self.admin, team=self.team, program=prog_senior, student_ids=[self.students[0].id])
        self.assertIn('not eligible', str(ctx.exception).lower())

    def test_squad_capacity_limit_enforced(self):
        """Team cannot exceed team_size squad limit for a sub-team."""
        prog_group = Program.objects.create(
            event=self.event, name='5s Football', category='junior', is_team_based=True, team_size=3,
        )
        # 3 students succeeds
        assign_students(
            user=self.admin, team=self.team, program=prog_group,
            student_ids=[self.students[0].id, self.students[1].id, self.students[2].id],
            sub_team_number=1,
        )
        # Adding a 4th exceeds capacity of 3
        with self.assertRaises(ValidationError) as ctx:
            assign_students(
                user=self.admin, team=self.team, program=prog_group,
                student_ids=[self.students[3].id],
                sub_team_number=1,
            )
        self.assertIn('at most 3 members', str(ctx.exception))

    # =========================================================================
    # 4. REGISTRATION DEADLINE (TIME CUT-OFF)
    # =========================================================================

    def test_team_manager_blocked_after_registration_deadline(self):
        """Team manager cannot assign or remove after registration deadline."""
        self.event.registration_deadline = timezone.now() - timedelta(hours=2)
        self.event.save(update_fields=['registration_deadline'])

        prog = Program.objects.create(event=self.event, name='Late Solo', category='junior', is_team_based=False)

        # Team manager assigning fails
        with self.assertRaises(ValidationError) as ctx:
            assign_students(user=self.team_manager_user, team=self.team, program=prog, student_ids=[self.students[0].id])
        self.assertIn('registration deadline has passed', str(ctx.exception).lower())

    def test_admin_can_modify_after_registration_deadline(self):
        """Admin can assign and remove after registration deadline without restriction."""
        self.event.registration_deadline = timezone.now() - timedelta(hours=2)
        self.event.save(update_fields=['registration_deadline'])

        prog = Program.objects.create(event=self.event, name='Late Solo Admin', category='junior', is_team_based=False)

        # Admin assigns successfully
        assignments = assign_students(user=self.admin, team=self.team, program=prog, student_ids=[self.students[0].id])
        self.assertEqual(len(assignments), 1)

        # Admin removes successfully
        deleted = remove_assignment_group(user=self.admin, assignment=assignments[0])
        self.assertEqual(deleted, 1)

    # =========================================================================
    # 5. REMOVAL / DELETION FLOW
    # =========================================================================

    def test_removing_one_member_from_group_subteam_preserves_other_members(self):
        """Removing one student from a squad must not delete the remaining teammates."""
        prog = Program.objects.create(
            event=self.event, name='Group Song', category='junior', is_team_based=True, team_size=4,
        )
        assignments = assign_students(
            user=self.admin,
            team=self.team,
            program=prog,
            student_ids=[self.students[0].id, self.students[1].id, self.students[2].id],
            sub_team_number=1,
            leader_id=self.students[0].id,
        )
        self.assertEqual(len(assignments), 3)
        self.assertEqual(ProgramAssignment.objects.filter(program=prog, team=self.team).count(), 3)

        # Remove member 2 (student[1])
        assignment_to_remove = assignments[1]
        remove_assignment_group(user=self.admin, assignment=assignment_to_remove)

        # Teammates 0 and 2 must still remain!
        remaining = ProgramAssignment.objects.filter(program=prog, team=self.team)
        self.assertEqual(remaining.count(), 2)
        remaining_student_ids = set(remaining.values_list('student_id', flat=True))
        self.assertEqual(remaining_student_ids, {self.students[0].id, self.students[2].id})

        # Result still exists for the subteam
        res = ProgramResult.objects.get(program=prog, team=self.team, sub_team_number=1)
        self.assertEqual(res.participant_id, self.students[0].id)

    def test_removing_leader_from_group_subteam_auto_promotes_new_leader(self):
        """Removing the leader from a squad automatically elects a remaining member as leader."""
        prog = Program.objects.create(
            event=self.event, name='Group Drama', category='junior', is_team_based=True, team_size=4,
        )
        assignments = assign_students(
            user=self.admin,
            team=self.team,
            program=prog,
            student_ids=[self.students[0].id, self.students[1].id],
            sub_team_number=1,
            leader_id=self.students[0].id,
        )
        # Remove leader (student[0])
        leader_assignment = assignments[0]
        remove_assignment_group(user=self.admin, assignment=leader_assignment)

        # Student 1 is now remaining and promoted to leader
        remaining = ProgramAssignment.objects.get(program=prog, team=self.team)
        self.assertEqual(remaining.student_id, self.students[1].id)
        self.assertTrue(remaining.is_leader)

        # ProgramResult participant updated to the new leader
        res = ProgramResult.objects.get(program=prog, team=self.team, sub_team_number=1)
        self.assertEqual(res.participant_id, self.students[1].id)

    def test_removing_last_member_cleans_up_subteam_result(self):
        """When the final member of a sub-team is removed, its ProgramResult is cleanly deleted."""
        prog = Program.objects.create(
            event=self.event, name='Group Dance', category='junior', is_team_based=True, team_size=4,
        )
        assignment = assign_students(
            user=self.admin,
            team=self.team,
            program=prog,
            student_ids=[self.students[0].id],
            sub_team_number=1,
        )[0]
        self.assertTrue(ProgramResult.objects.filter(program=prog, team=self.team).exists())

        remove_assignment_group(user=self.admin, assignment=assignment)
        self.assertFalse(ProgramAssignment.objects.filter(program=prog, team=self.team).exists())
        self.assertFalse(ProgramResult.objects.filter(program=prog, team=self.team).exists())

    # =========================================================================
    # 6. PORTAL API ENDPOINTS VERIFICATION
    # =========================================================================

    def test_admin_assignments_api_returns_student_name_team_name_and_chest_number(self):
        """The assignments endpoint returns complete student, team, and chest number metadata."""
        prog = Program.objects.create(
            event=self.event, name='Public Speaking', category='junior', is_team_based=False,
        )
        assignment = assign_students(
            user=self.admin, team=self.team, program=prog, student_ids=[self.students[0].id],
        )[0]

        self.client.force_authenticate(self.admin)
        res = self.client.get(f'/api/events/{self.event.id}/assignments/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        data = res.json()
        self.assertEqual(len(data), 1)
        row = data[0]
        self.assertEqual(row['id'], assignment.id)
        self.assertEqual(row['student_name'], self.students[0].name)
        self.assertEqual(row['team_name'], self.team.name)
        self.assertEqual(row['chest_number'], assignment.chest_number)
        self.assertEqual(row['student']['name'], self.students[0].name)
        self.assertEqual(row['student']['chest_number'], assignment.chest_number)
