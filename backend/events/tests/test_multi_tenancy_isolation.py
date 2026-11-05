import json
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from accounts.models import User, School, StudentCategory, StudentClass
from events.models import Event, Program, Team, ProgramAssignment, ChestNumber, ProgramResult
from events.permissions import TeamScopedPrincipal


class MultiTenancyIsolationTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # -------------------------------------------------------------
        # School A Setup
        # -------------------------------------------------------------
        self.school_a = School.objects.create(
            name="School Alpha",
            code="alpha",
            email="contact@alpha.edu",
            status="active"
        )
        self.admin_a = User.objects.create_user(
            username="admin@alpha.edu",
            email="admin@alpha.edu",
            password="Password123!",
            name="Alpha Admin",
            role="admin",
            school=self.school_a
        )
        self.em_a = User.objects.create_user(
            username="em@alpha.edu",
            email="em@alpha.edu",
            password="Password123!",
            name="Alpha Event Manager",
            role="event_manager",
            school=self.school_a
        )
        self.cat_a = StudentCategory.objects.create(
            school=self.school_a,
            name="Senior",
            code="senior"
        )
        self.class_a = StudentClass.objects.create(
            school=self.school_a,
            name="Grade 10",
            code="10",
            category=self.cat_a
        )
        self.team_a1 = Team.objects.create(
            school=self.school_a,
            name="Alpha Lions",
            team_number=1,
            team_username="alpha_lions",
            team_password="Password123!"
        )
        self.team_a2 = Team.objects.create(
            school=self.school_a,
            name="Alpha Tigers",
            team_number=2,
            team_username="alpha_tigers",
            team_password="Password123!"
        )
        self.student_a1 = User.objects.create_user(
            username="student_a1@alpha.edu",
            email="student_a1@alpha.edu",
            password="Password123!",
            name="Alice Alpha",
            role="student",
            school=self.school_a,
            category="senior",
            grade="10"
        )
        self.team_a1.members.add(self.student_a1)

        self.student_a2 = User.objects.create_user(
            username="student_a2@alpha.edu",
            email="student_a2@alpha.edu",
            password="Password123!",
            name="Bob Alpha",
            role="student",
            school=self.school_a,
            category="senior",
            grade="10"
        )
        self.team_a2.members.add(self.student_a2)

        self.event_a = Event.objects.create(
            school=self.school_a,
            title="Alpha Fest",
            status="published",
            start_date=timezone.now().date(),
            end_date=timezone.now().date() + timezone.timedelta(days=2),
            registration_deadline=timezone.now() + timezone.timedelta(days=1),
            created_by=self.admin_a
        )
        self.prog_a = Program.objects.create(
            event=self.event_a,
            name="Alpha Solo Singing",
            category="senior",
            is_team_based=False,
            max_participants=5,
            is_active=True
        )

        self.assignment_a1 = ProgramAssignment.objects.create(
            program=self.prog_a,
            team=self.team_a1,
            student=self.student_a1,
            sub_team_number=1,
            chest_number=101
        )
        self.chest_a1 = ChestNumber.objects.get(event=self.event_a, student=self.student_a1)

        self.assignment_a2 = ProgramAssignment.objects.create(
            program=self.prog_a,
            team=self.team_a2,
            student=self.student_a2,
            sub_team_number=1,
            chest_number=102
        )
        self.chest_a2 = ChestNumber.objects.get(event=self.event_a, student=self.student_a2)

        # -------------------------------------------------------------
        # School B Setup
        # -------------------------------------------------------------
        self.school_b = School.objects.create(
            name="School Beta",
            code="beta",
            email="contact@beta.edu",
            status="active"
        )
        self.admin_b = User.objects.create_user(
            username="admin@beta.edu",
            email="admin@beta.edu",
            password="Password123!",
            name="Beta Admin",
            role="admin",
            school=self.school_b
        )
        self.team_b1 = Team.objects.create(
            school=self.school_b,
            name="Beta Eagles",
            team_number=1,
            team_username="beta_eagles",
            team_password="Password123!"
        )
        self.student_b1 = User.objects.create_user(
            username="student_b1@beta.edu",
            email="student_b1@beta.edu",
            password="Password123!",
            name="Charlie Beta",
            role="student",
            school=self.school_b,
            category="senior",
            grade="10"
        )
        self.team_b1.members.add(self.student_b1)

        self.event_b = Event.objects.create(
            school=self.school_b,
            title="Beta Fest",
            status="published",
            start_date=timezone.now().date(),
            end_date=timezone.now().date() + timezone.timedelta(days=2),
            registration_deadline=timezone.now() + timezone.timedelta(days=1),
            created_by=self.admin_b
        )
        self.prog_b = Program.objects.create(
            event=self.event_b,
            name="Beta Solo Singing",
            category="senior",
            is_team_based=False,
            max_participants=5,
            is_active=True
        )

    # =========================================================================
    # PART 1: School-Level Tenant Isolation
    # =========================================================================

    def test_school_admin_cannot_access_or_modify_other_school_events(self):
        self.client.force_authenticate(self.admin_a)
        # Attempt to retrieve Event B
        res = self.client.get(f'/api/events/{self.event_b.id}/')
        self.assertEqual(res.status_code, 404)

        # Attempt to update Event B
        res = self.client.patch(f'/api/events/{self.event_b.id}/', {'title': 'Hacked Fest'})
        self.assertEqual(res.status_code, 404)

        # Listing events only shows School A events
        res = self.client.get('/api/events/')
        self.assertEqual(res.status_code, 200)
        results = res.data if isinstance(res.data, list) else res.data.get('results', [])
        event_ids = [item['id'] for item in results]
        self.assertIn(self.event_a.id, event_ids)
        self.assertNotIn(self.event_b.id, event_ids)

    def test_school_admin_cannot_access_or_modify_other_school_teams_and_students(self):
        self.client.force_authenticate(self.admin_a)
        # Team B
        res = self.client.get(f'/api/teams/{self.team_b1.id}/')
        self.assertEqual(res.status_code, 404)

        # Student B
        res = self.client.get(f'/api/students/{self.student_b1.id}/')
        self.assertEqual(res.status_code, 404)

        # Listing students only shows School A students
        res = self.client.get('/api/students/')
        self.assertEqual(res.status_code, 200)
        results = res.data if isinstance(res.data, list) else res.data.get('results', [])
        student_ids = [item['id'] for item in results]
        self.assertIn(self.student_a1.id, student_ids)
        self.assertIn(self.student_a2.id, student_ids)
        self.assertNotIn(self.student_b1.id, student_ids)

    def test_event_manager_can_read_school_students_but_cannot_mutate(self):
        self.client.force_authenticate(self.em_a)
        # Event manager can list and retrieve school students
        res = self.client.get('/api/students/')
        self.assertEqual(res.status_code, 200)

        res = self.client.get(f'/api/students/{self.student_a1.id}/')
        self.assertEqual(res.status_code, 200)

        # Cannot create student (only IsSchoolAdmin)
        res = self.client.post('/api/students/', {
            'name': 'Intruder Student',
            'email': 'intruder@alpha.edu',
            'category': 'senior',
            'grade': '10'
        }, format='json')
        self.assertEqual(res.status_code, 403)

        # Cannot delete student
        res = self.client.delete(f'/api/students/{self.student_a1.id}/')
        self.assertEqual(res.status_code, 403)

    # =========================================================================
    # PART 2: Team Manager Isolation (Team 1 vs Team 2 in School A)
    # =========================================================================

    def test_team_manager_cannot_access_other_teams_students_via_team_manager_endpoint(self):
        principal = TeamScopedPrincipal(self.team_a1)
        self.client.force_authenticate(principal)

        # Accessing own team students succeeds
        res = self.client.get(f'/api/team-manager/{self.team_a1.id}/students/')
        self.assertEqual(res.status_code, 200)
        data = res.data.get('students', res.data if isinstance(res.data, list) else res.data.get('results', []))
        student_ids = [s['id'] for s in data]
        self.assertIn(self.student_a1.id, student_ids)
        self.assertNotIn(self.student_a2.id, student_ids)

        # Accessing another team's students in the same school fails with 403
        res = self.client.get(f'/api/team-manager/{self.team_a2.id}/students/')
        self.assertEqual(res.status_code, 403)

        # Accessing a team from another school fails with 403/404
        res = self.client.get(f'/api/team-manager/{self.team_b1.id}/students/')
        self.assertIn(res.status_code, [403, 404])

    def test_team_manager_students_listing_only_returns_own_team_members(self):
        principal = TeamScopedPrincipal(self.team_a1)
        self.client.force_authenticate(principal)

        # Listing /api/students/
        res = self.client.get('/api/students/')
        self.assertEqual(res.status_code, 200)
        results = res.data if isinstance(res.data, list) else res.data.get('results', [])
        returned_ids = [s['id'] for s in results]
        self.assertIn(self.student_a1.id, returned_ids)
        self.assertNotIn(self.student_a2.id, returned_ids)
        self.assertNotIn(self.student_b1.id, returned_ids)

        # Filtering /api/students/?team={team_a2.id} returns empty
        res = self.client.get(f'/api/students/?team={self.team_a2.id}')
        self.assertEqual(res.status_code, 200)
        results = res.data if isinstance(res.data, list) else res.data.get('results', [])
        self.assertEqual(len(results), 0)

        # Filtering /api/students/?team=unassigned returns empty
        res = self.client.get('/api/students/?team=unassigned')
        self.assertEqual(res.status_code, 200)
        results = res.data if isinstance(res.data, list) else res.data.get('results', [])
        self.assertEqual(len(results), 0)

        # Direct retrieval of student from other team fails with 404 or 403
        res = self.client.get(f'/api/students/{self.student_a2.id}/')
        self.assertIn(res.status_code, [403, 404])

    def test_team_manager_cannot_access_other_teams_event_programs(self):
        principal = TeamScopedPrincipal(self.team_a1)
        self.client.force_authenticate(principal)

        # Accessing own team's event programs succeeds
        res = self.client.get(f'/api/team-manager/{self.team_a1.id}/events/{self.event_a.id}/programs/')
        self.assertEqual(res.status_code, 200)

        # Accessing another team's event programs fails with 403
        res = self.client.get(f'/api/team-manager/{self.team_a2.id}/events/{self.event_a.id}/programs/')
        self.assertEqual(res.status_code, 403)

    def test_team_manager_cannot_assign_other_teams_student_or_to_other_team(self):
        principal = TeamScopedPrincipal(self.team_a1)
        self.client.force_authenticate(principal)

        # Attempt to assign to Team A2
        res = self.client.post(
            f'/api/team-manager/{self.team_a2.id}/events/{self.event_a.id}/programs/{self.prog_a.id}/assign/',
            {'student_id': self.student_a1.id},
            format='json'
        )
        self.assertEqual(res.status_code, 403)

        # Attempt to assign student_a2 (belongs to Team A2) to Team A1
        res = self.client.post(
            f'/api/team-manager/{self.team_a1.id}/events/{self.event_a.id}/programs/{self.prog_a.id}/assign/',
            {'student_id': self.student_a2.id},
            format='json'
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn('do not belong to', str(res.data).lower())

        # Attempt to assign student_b1 (from School B) to Team A1
        res = self.client.post(
            f'/api/team-manager/{self.team_a1.id}/events/{self.event_a.id}/programs/{self.prog_a.id}/assign/',
            {'student_id': self.student_b1.id},
            format='json'
        )
        self.assertEqual(res.status_code, 400)

    def test_team_manager_cannot_remove_other_teams_assignment(self):
        principal = TeamScopedPrincipal(self.team_a1)
        self.client.force_authenticate(principal)

        # Attempt to delete assignment of Team A2 via remove_student_from_program
        res = self.client.delete(
            f'/api/team-manager/{self.team_a2.id}/events/{self.event_a.id}/programs/{self.prog_a.id}/students/{self.student_a2.id}/remove/'
        )
        self.assertEqual(res.status_code, 403)

        # Attempt to delete assignment of Team A2 via remove_assignment_by_id
        res = self.client.delete(
            f'/api/team-manager/{self.team_a2.id}/assignments/{self.assignment_a2.id}/remove/'
        )
        self.assertEqual(res.status_code, 403)

        # Attempt to delete assignment of Team A2 via remove_assignment
        res = self.client.delete(
            '/api/team-manager/remove_assignment/',
            {'assignment_id': self.assignment_a2.id},
            format='json'
        )
        self.assertEqual(res.status_code, 403)

    def test_team_manager_cannot_access_admin_programs_and_other_teams_chest_numbers(self):
        principal = TeamScopedPrincipal(self.team_a1)
        self.client.force_authenticate(principal)

        # Calling admin_programs must be 403 Forbidden for team manager
        res = self.client.get(f'/api/events/{self.event_a.id}/admin_programs/')
        self.assertEqual(res.status_code, 403)

        # Calling search_by_chest_number with other team's student chest number returns 403
        res = self.client.get(f'/api/events/{self.event_a.id}/search_by_chest_number/?chest_number={self.chest_a2.chest_number}')
        self.assertEqual(res.status_code, 403)

        # Calling search_by_chest_number with own team's chest number returns 200
        res = self.client.get(f'/api/events/{self.event_a.id}/search_by_chest_number/?chest_number={self.chest_a1.chest_number}')
        self.assertEqual(res.status_code, 200)

        # Calling chest_numbers only lists own team's chest numbers
        res = self.client.get(f'/api/events/{self.event_a.id}/chest_numbers/')
        self.assertEqual(res.status_code, 200)
        c_numbers = [item['chest_number'] for item in res.data]
        self.assertIn(self.chest_a1.chest_number, c_numbers)
        self.assertNotIn(self.chest_a2.chest_number, c_numbers)

    def test_team_manager_scoped_to_own_team_in_teams_viewset(self):
        principal = TeamScopedPrincipal(self.team_a1)
        self.client.force_authenticate(principal)

        # Listing /api/teams/ only returns Team A1
        res = self.client.get('/api/teams/')
        self.assertEqual(res.status_code, 200)
        results = res.data if isinstance(res.data, list) else res.data.get('results', [])
        team_ids = [t['id'] for t in results]
        self.assertIn(self.team_a1.id, team_ids)
        self.assertNotIn(self.team_a2.id, team_ids)
        self.assertNotIn(self.team_b1.id, team_ids)

        # Accessing Team A2 details returns 403 or 404 (denied)
        res = self.client.get(f'/api/teams/{self.team_a2.id}/')
        self.assertIn(res.status_code, [403, 404])
