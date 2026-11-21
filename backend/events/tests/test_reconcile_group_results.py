from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from events.models import Event, Program, Team, ProgramAssignment, ProgramResult
from accounts.models import School
from events.services import (
    assign_students,
    reconcile_program_result_placeholders,
    ensure_program_code_letters,
    shuffle_program_code_letters,
)

User = get_user_model()


class ReconcileGroupResultsTestCase(TestCase):
    def setUp(self):
        self.school = School.objects.create(name='Test School', code='TS1')
        self.admin = User.objects.create_user(
            username='admin_user',
            email='admin@test.com',
            password='password123',
            role='admin',
            school_id=self.school.id,
        )
        self.event = Event.objects.create(
            title='Test Fest',
            school=self.school,
            created_by=self.admin,
            status='ongoing',
            start_date='2026-11-20',
            end_date='2026-11-25',
        )
        self.team_nexus = Team.objects.create(name='Nexus', school=self.school)
        self.team_vortex = Team.objects.create(name='Vortex', school=self.school)
        self.team_epoch = Team.objects.create(name='Epoch', school=self.school)

        # Create students
        self.students_nexus = [
            User.objects.create_user(username=f'nexus_{i}', email=f'nexus_{i}@test.com', role='student', school_id=self.school.id)
            for i in range(3)
        ]
        self.students_vortex = [
            User.objects.create_user(username=f'vortex_{i}', email=f'vortex_{i}@test.com', role='student', school_id=self.school.id)
            for i in range(3)
        ]
        self.students_epoch = [
            User.objects.create_user(username=f'epoch_{i}', email=f'epoch_{i}@test.com', role='student', school_id=self.school.id)
            for i in range(3)
        ]

        for s in self.students_nexus:
            self.team_nexus.members.add(s)
        for s in self.students_vortex:
            self.team_vortex.members.add(s)
        for s in self.students_epoch:
            self.team_epoch.members.add(s)

        # Group program with team_size 3
        self.program = Program.objects.create(
            event=self.event,
            name='Group Song Competition',
            is_team_based=True,
            team_size=3,
            max_teams_per_school=1,
        )

    def test_reconciles_legacy_individual_draft_results_and_assigns_epoch(self):
        """
        Simulate the exact bug seen on live server:
        1. Program starts as individual (is_team_based=False).
        2. NEXUS and VORTEX are assigned, creating individual results (is_team_result=False).
        3. Program is switched to group (is_team_based=True, team_size=3).
        4. EPOCH tries to assign students.
        With the fix:
        - Legacy individual draft results are cleaned up automatically without collision.
        - EPOCH assignment succeeds without unique_group_subteam_result error.
        - Exactly 3 team-wise results (Nexus, Vortex, Epoch) exist with is_team_result=True.
        - Code letters are generated team-wise (A, B, C).
        """
        # Start as individual program
        self.program.is_team_based = False
        self.program.save()

        # Assign Nexus and Vortex as individual participants
        for s in self.students_nexus:
            assign_students(
                user=self.admin,
                team=self.team_nexus,
                program=self.program,
                student_ids=[s.id],
            )
        for s in self.students_vortex:
            assign_students(
                user=self.admin,
                team=self.team_vortex,
                program=self.program,
                student_ids=[s.id],
            )

        # Verify 6 individual results currently exist (is_team_result=False)
        self.assertEqual(ProgramResult.objects.filter(program=self.program).count(), 6)
        self.assertEqual(ProgramResult.objects.filter(program=self.program, is_team_result=False).count(), 6)

        # Now, switch program to group!
        self.program.is_team_based = True
        self.program.team_size = 3
        self.program.save()

        # Assign EPOCH as a group team. This should NOT fail with unique_group_subteam_result!
        epoch_assignments = assign_students(
            user=self.admin,
            team=self.team_epoch,
            program=self.program,
            student_ids=[s.id for s in self.students_epoch],
            sub_team_number=1,
        )
        self.assertEqual(len(epoch_assignments), 3)

        # After assignment, verify that results have been healed into 3 team-wise results
        results = ProgramResult.objects.filter(program=self.program)
        self.assertEqual(results.count(), 3)
        self.assertEqual(results.filter(is_team_result=True).count(), 3)

        teams_with_results = set(results.values_list('team_id', flat=True))
        self.assertEqual(teams_with_results, {self.team_nexus.id, self.team_vortex.id, self.team_epoch.id})

        # Verify each team result has a distinct code letter
        codes = [r.code_letter for r in results]
        self.assertEqual(len(set(codes)), 3)
        self.assertTrue(all(c in ['A', 'B', 'C'] for c in codes))

    def test_reconcile_preserves_results_with_submitted_marks(self):
        """Ensure results that already have marks are never deleted during reconciliation."""
        res = ProgramResult.objects.create(
            program=self.program,
            participant=self.students_nexus[0],
            team=self.team_nexus,
            sub_team_number=1,
            is_team_result=True,
            judge1_marks=Decimal('85.00'),
            judge2_marks=Decimal('85.00'),
            judge3_marks=Decimal('85.00'),
            entry_status='submitted',
        )

        reconcile_program_result_placeholders(self.program)

        # The submitted result must remain intact
        self.assertTrue(ProgramResult.objects.filter(id=res.id).exists())

    def test_deduplicates_duplicate_subteam_draft_placeholders(self):
        """Duplicate un-scored draft placeholders for the same team/subteam are cleaned up."""
        # Create program as individual first to bypass unique constraint during setup
        self.program.is_team_based = False
        self.program.save()

        res1 = ProgramResult.objects.create(
            program=self.program,
            participant=self.students_nexus[0],
            team=self.team_nexus,
            sub_team_number=1,
            is_team_result=False,
            entry_status='draft',
        )
        res2 = ProgramResult.objects.create(
            program=self.program,
            participant=self.students_nexus[1],
            team=self.team_nexus,
            sub_team_number=1,
            is_team_result=False,
            entry_status='draft',
        )
        self.assertEqual(ProgramResult.objects.filter(program=self.program, team=self.team_nexus).count(), 2)

        # Now switch to group and assign assignment
        self.program.is_team_based = True
        self.program.team_size = 3
        self.program.save()

        ProgramAssignment.objects.create(
            program=self.program,
            student=self.students_nexus[0],
            team=self.team_nexus,
            sub_team_number=1,
            assigned_by=self.admin,
        )

        reconcile_program_result_placeholders(self.program)

        nexus_results = ProgramResult.objects.filter(program=self.program, team=self.team_nexus)
        self.assertEqual(nexus_results.count(), 1)
        self.assertTrue(nexus_results.first().is_team_result)
