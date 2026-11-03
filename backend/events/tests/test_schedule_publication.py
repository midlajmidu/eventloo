from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from django.utils import timezone
from datetime import timedelta
from events.models import Event, Team
from accounts.models import School
from django.contrib.auth import get_user_model

User = get_user_model()


class SchedulePublicationTests(TestCase):
    def setUp(self):
        self.school = School.objects.create(name='Test School', code='TEST', status='active')
        self.admin_user = User.objects.create_user(
            username='admin_test',
            email='admin_test@test.com',
            password='password123',
            role='admin',
            school=self.school
        )
        self.event_manager_user = User.objects.create_user(
            username='em_test',
            email='em_test@test.com',
            password='password123',
            role='event_manager',
            school=self.school
        )
        self.team_manager_user = User.objects.create_user(
            username='tm_test',
            email='tm_test@test.com',
            password='password123',
            role='team_manager',
            school=self.school
        )
        self.team = Team.objects.create(
            name='Alpha Team',
            school=self.school,
            team_username='alpha_team'
        )
        self.event = Event.objects.create(
            title='Annual Arts Fest',
            school=self.school,
            created_by=self.admin_user,
            event_type='cultural',
            status='published',
            start_date=timezone.now().date(),
            end_date=timezone.now().date() + timedelta(days=2),
            is_schedule_published=False
        )
        self.client = APIClient()

    def test_toggle_schedule_publish_by_admin(self):
        self.client.force_authenticate(user=self.admin_user)
        # Default is False
        self.assertFalse(self.event.is_schedule_published)

        # Toggle to True
        response = self.client.post(f'/api/events/{self.event.id}/toggle_schedule_publish/', {'is_published': True})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.event.refresh_from_db()
        self.assertTrue(self.event.is_schedule_published)

        # Toggle back to False
        response = self.client.post(f'/api/events/{self.event.id}/toggle_schedule_publish/', {'is_published': False})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.event.refresh_from_db()
        self.assertFalse(self.event.is_schedule_published)

    def test_toggle_schedule_publish_by_event_manager(self):
        self.client.force_authenticate(user=self.event_manager_user)
        response = self.client.post(f'/api/events/{self.event.id}/toggle_schedule_publish/', {'is_published': True})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.event.refresh_from_db()
        self.assertTrue(self.event.is_schedule_published)

    def test_toggle_schedule_publish_forbidden_for_team_manager(self):
        self.client.force_authenticate(user=self.team_manager_user)
        response = self.client.post(f'/api/events/{self.event.id}/toggle_schedule_publish/', {'is_published': True})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_schedule_export_restricted_when_unpublished(self):
        self.event.is_schedule_published = False
        self.event.save()

        # Admin can access regardless
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(f'/api/events/{self.event.id}/schedule-export/?export_format=csv')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Team manager is forbidden when schedule is not published
        self.client.force_authenticate(user=self.team_manager_user)
        response = self.client.get(f'/api/events/{self.event.id}/schedule-export/?export_format=csv')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Now publish the schedule
        self.event.is_schedule_published = True
        self.event.save()

        # Team manager can now export/view the schedule
        response = self.client.get(f'/api/events/{self.event.id}/schedule-export/?export_format=csv')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_team_scoped_principal_schedule_export(self):
        from events.permissions import TeamScopedPrincipal
        principal = TeamScopedPrincipal(self.team)

        # Unpublished -> forbidden
        self.event.is_schedule_published = False
        self.event.save()
        self.client.force_authenticate(user=principal)
        response = self.client.get(f'/api/events/{self.event.id}/schedule-export/?export_format=csv')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Published -> OK
        self.event.is_schedule_published = True
        self.event.save()
        response = self.client.get(f'/api/events/{self.event.id}/schedule-export/?export_format=csv')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

