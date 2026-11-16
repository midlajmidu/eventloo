from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import School, SchoolSettings
from events.models import Event

User = get_user_model()


class PublicEventPortalTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.school = School.objects.create(
            name="Greenwood High", code="GWD01", email="info@greenwood.edu"
        )
        cls.school_settings = SchoolSettings.objects.create(school=cls.school)
        cls.admin = User.objects.create_user(
            username="admin_greenwood",
            email="admin@greenwood.edu",
            password="AdminPassword123!",
            role="admin",
            school=cls.school,
        )
        cls.event = Event.objects.create(
            title="Greenwood Fest 2026",
            school=cls.school,
            created_by=cls.admin,
            start_date="2026-11-20",
            end_date="2026-11-23",
            public_theme_title="Dare To Dream",
            public_about_text="An unforgettable celebration of creativity and student spirit.",
            public_theme_color="sunset",
            enable_public_portal=True,
        )

    def test_public_portal_returns_theme_data(self):
        url = f"/api/events/{self.event.id}/public-portal/"
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["event"]["title"], "Greenwood Fest 2026")
        self.assertEqual(res.data["event"]["public_theme_title"], "Dare To Dream")
        self.assertEqual(res.data["event"]["public_about_text"], "An unforgettable celebration of creativity and student spirit.")
        self.assertEqual(res.data["event"]["public_theme_color"], "sunset")
        self.assertTrue(res.data["event"]["enable_public_portal"])
        self.assertIn("stats", res.data)

    def test_disabled_public_portal_returns_forbidden(self):
        self.event.enable_public_portal = False
        self.event.save()
        url = f"/api/events/{self.event.id}/public-portal/"
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
