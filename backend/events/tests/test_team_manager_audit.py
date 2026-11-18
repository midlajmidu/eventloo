import json
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient
from accounts.models import User, School, StudentCategory, StudentClass
from events.models import Event, Program, Team, ProgramAssignment
from events.permissions import TeamScopedPrincipal


class TeamManagerAuditTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # School A
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

        # Team A1 Manager Principal
        self.tm_principal_a1 = TeamScopedPrincipal(self.team_a1)

        # Students for Team A1
        self.student_a1_1 = User.objects.create_user(
            username="student_a1_1@alpha.edu",
            email="student_a1_1@alpha.edu",
            password="Password123!",
            name="Student A1 One",
            role="student",
            school=self.school_a,
            category="senior",
            grade="10",
            chest_code="A101"
        )
        self.student_a1_2 = User.objects.create_user(
            username="student_a1_2@alpha.edu",
            email="student_a1_2@alpha.edu",
            password="Password123!",
            name="Student A1 Two",
            role="student",
            school=self.school_a,
            category="senior",
            grade="10",
            chest_code="A102"
        )
        self.team_a1.members.add(self.student_a1_1, self.student_a1_2)

        # Student for Team A2
        self.student_a2_1 = User.objects.create_user(
            username="student_a2_1@alpha.edu",
            email="student_a2_1@alpha.edu",
            password="Password123!",
            name="Student A2 One",
            role="student",
            school=self.school_a,
            category="senior",
            grade="10",
            chest_code="A201"
        )
        self.team_a2.members.add(self.student_a2_1)

        # Event & Programs
        self.event_a = Event.objects.create(
            school=self.school_a,
            title="Alpha Annual Fest",
            status="published",
            start_date=timezone.now().date(),
            end_date=timezone.now().date() + timezone.timedelta(days=2),
            registration_deadline=timezone.now() + timezone.timedelta(days=1),
            is_schedule_published=True,
            created_by=self.admin_a
        )
        self.program_single = Program.objects.create(
            event=self.event_a,
            name="Recitation",
            category="senior",
            is_team_based=False,
            max_participants=5,
            is_active=True
        )

        # Assign students
        self.assign_a1 = ProgramAssignment.objects.create(
            program=self.program_single,
            team=self.team_a1,
            student=self.student_a1_1,
            chest_number=101
        )
        self.assign_a2 = ProgramAssignment.objects.create(
            program=self.program_single,
            team=self.team_a2,
            student=self.student_a2_1,
            chest_number=201
        )

    def test_team_manager_profile_isolation(self):
        """Team manager can only fetch their own team profile; accessing another team returns 403."""
        self.client.force_authenticate(user=self.tm_principal_a1)

        # Own team profile
        res_own = self.client.get(f"/api/team-manager/profile/{self.team_a1.id}/")
        self.assertEqual(res_own.status_code, status.HTTP_200_OK)
        self.assertEqual(res_own.data['team']['id'], self.team_a1.id)

        # Other team profile in same school
        res_other = self.client.get(f"/api/team-manager/profile/{self.team_a2.id}/")
        self.assertEqual(res_other.status_code, status.HTTP_403_FORBIDDEN)

    def test_team_manager_cross_team_mutation_blocked(self):
        """Team manager attempting to assign or remove another team's assignment gets 403."""
        self.client.force_authenticate(user=self.tm_principal_a1)

        # Attempt to assign to other team
        res_assign = self.client.post(
            f"/api/team-manager/{self.team_a2.id}/events/{self.event_a.id}/programs/{self.program_single.id}/assign/",
            {'student_id': self.student_a2_1.id}
        )
        self.assertEqual(res_assign.status_code, status.HTTP_403_FORBIDDEN)

        # Attempt to delete assignment from other team
        res_del = self.client.delete(
            f"/api/team-manager/{self.team_a2.id}/assignments/{self.assign_a2.id}/remove/"
        )
        self.assertEqual(res_del.status_code, status.HTTP_403_FORBIDDEN)

    def test_call_list_enforces_team_isolation_in_all_modes(self):
        """Team manager calling generate_call_list cannot see competitor students in team or competition mode."""
        self.client.force_authenticate(user=self.tm_principal_a1)

        # Competition mode with team_id='all' requested
        res_comp = self.client.get(
            f"/api/events/{self.event_a.id}/call-list/",
            {'mode': 'competition', 'team_id': 'all', 'program_id': self.program_single.id, 'format': 'json'}
        )
        self.assertEqual(res_comp.status_code, status.HTTP_200_OK)
        data = res_comp.json()
        items = data.get('items', [])
        # Should only contain items for team_a1, never team_a2
        for item in items:
            self.assertEqual(str(item.get('team_id')), str(self.team_a1.id))
            self.assertNotEqual(item.get('participant_names'), self.student_a2_1.name)

        # Team mode attempting to request Team A2's ID
        res_team = self.client.get(
            f"/api/events/{self.event_a.id}/call-list/",
            {'mode': 'team', 'team_id': str(self.team_a2.id), 'program_id': self.program_single.id, 'format': 'json'}
        )
        self.assertEqual(res_team.status_code, status.HTTP_200_OK)
        data_team = res_team.json()
        # Forcibly overridden to team_a1
        for item in data_team.get('items', []):
            self.assertEqual(str(item.get('team_id')), str(self.team_a1.id))
            self.assertNotEqual(item.get('participant_names'), self.student_a2_1.name)

    def test_team_students_roster_unpaginated_and_paginated(self):
        """Team manager students endpoint returns complete roster when unpaginated and paginates when requested."""
        self.client.force_authenticate(user=self.tm_principal_a1)

        # Unpaginated request
        res = self.client.get(f"/api/team-manager/{self.team_a1.id}/students/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        students = res.data.get('students', [])
        self.assertEqual(len(students), 2)
        student_ids = {s['id'] for s in students}
        self.assertIn(self.student_a1_1.id, student_ids)
        self.assertIn(self.student_a1_2.id, student_ids)

        # Paginated request with page_size=1
        res_paginated = self.client.get(
            f"/api/team-manager/{self.team_a1.id}/students/",
            {'page': 1, 'page_size': 1}
        )
        self.assertEqual(res_paginated.status_code, status.HTTP_200_OK)
        self.assertIn('count', res_paginated.data)
        self.assertEqual(res_paginated.data['count'], 2)
        self.assertEqual(len(res_paginated.data['results']), 1)

    def test_event_programs_preaggregated_response(self):
        """Team manager event_programs endpoint returns program list and member assignments cleanly."""
        self.client.force_authenticate(user=self.tm_principal_a1)

        res = self.client.get(f"/api/team-manager/{self.team_a1.id}/events/{self.event_a.id}/programs/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('programs', res.data)
        self.assertIn('team_members', res.data)
        self.assertIn('event', res.data)
        self.assertIn('logo', res.data['event'])
        self.assertIn('event_logo', res.data['event'])
        programs = res.data['programs']
        self.assertEqual(len(programs), 1)
        self.assertEqual(programs[0]['id'], self.program_single.id)
        self.assertEqual(programs[0]['assigned_count'], 1)

    def test_team_manager_events_includes_logo(self):
        """Team manager events list returns logo and event_logo for sync with UI."""
        self.client.force_authenticate(user=self.tm_principal_a1)

        res = self.client.get(f"/api/team-manager/{self.team_a1.id}/events/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        events = res.data.get('events', [])
        self.assertTrue(len(events) >= 1)
        ev = events[0]
        self.assertIn('logo', ev)
        self.assertIn('event_logo', ev)
