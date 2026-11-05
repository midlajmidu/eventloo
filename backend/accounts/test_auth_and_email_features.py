import json
from unittest.mock import patch
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient
from accounts.models import User, School, PasswordResetOTP
from accounts.serializers import CustomTokenObtainPairSerializer
from events.models import Team


class AuthAndEmailFeaturesTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.school = School.objects.create(
            name="Delhi Public School",
            code="dps",
            email="contact@dps.edu",
            status="active"
        )
        self.admin_user = User.objects.create_user(
            username="admin@dps.edu",
            email="admin@dps.edu",
            password="InitialStrongPassword123!",
            name="DPS Admin",
            role="admin",
            school=self.school
        )
        self.super_admin = User.objects.create_user(
            username="superadmin@eventloo.in",
            email="superadmin@eventloo.in",
            password="SuperSecretPassword#123",
            name="Super Admin",
            role="super_admin",
            school=None,
            is_superuser=True
        )
        self.team = Team.objects.create(
            school=self.school,
            name="Red Tigers",
            team_username="red_tigers",
            team_password="PlainTeamPassword123"
        )

    # --------------------------------------------------------------------------
    # 1. Error message distinction (Account Not Found vs Incorrect Password)
    # --------------------------------------------------------------------------
    def test_login_incorrect_password_vs_account_not_found(self):
        # Case A: Unknown email (using 'email' field like frontend)
        response = self.client.post(
            reverse('token_obtain_pair'),
            {'email': 'nonexistent@test.com', 'password': 'SomePassword123!'},
            format='json',
            HTTP_X_REQUESTED_WITH='XMLHttpRequest',
        )
        self.assertEqual(response.status_code, 400)
        detail_msg = str(response.data)
        self.assertIn("No account found with this email address", detail_msg)

        # Case B: Existing user, but wrong password
        response = self.client.post(
            reverse('token_obtain_pair'),
            {'email': 'admin@dps.edu', 'password': 'WrongPassword123!'},
            format='json',
            HTTP_X_REQUESTED_WITH='XMLHttpRequest',
        )
        self.assertEqual(response.status_code, 400)
        detail_msg = str(response.data)
        self.assertIn("Incorrect password", detail_msg)

        # Case C: Correct credentials
        response = self.client.post(
            reverse('token_obtain_pair'),
            {'email': 'admin@dps.edu', 'password': 'InitialStrongPassword123!'},
            format='json',
            HTTP_X_REQUESTED_WITH='XMLHttpRequest',
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn('user', response.data)
        self.assertEqual(response.data['user']['email'], 'admin@dps.edu')

    def test_super_admin_login_error_distinction(self):
        # Case A: Unknown super admin email
        response = self.client.post(
            reverse('super_admin_login'),
            {'email': 'unknown@admin.com', 'password': 'AnyPassword123'},
            format='json',
            HTTP_X_REQUESTED_WITH='XMLHttpRequest',
        )
        self.assertEqual(response.status_code, 401)
        self.assertIn("No super-admin account found", response.data.get('error', ''))

        # Case B: Existing super admin, wrong password
        response = self.client.post(
            reverse('super_admin_login'),
            {'email': 'superadmin@eventloo.in', 'password': 'WrongPassword456'},
            format='json',
            HTTP_X_REQUESTED_WITH='XMLHttpRequest',
        )
        self.assertEqual(response.status_code, 401)
        self.assertIn("Incorrect password", response.data.get('error', ''))

    def test_team_manager_login_error_distinction(self):
        # Case A: Unknown team username
        response = self.client.post(
            reverse('team_manager_login'),
            {'team_username': 'non_existent_team', 'team_password': 'AnyPassword'},
            format='json',
        )
        self.assertEqual(response.status_code, 400)
        errors = str(response.data)
        self.assertIn("No team account found", errors)

        # Case B: Wrong team password
        response = self.client.post(
            reverse('team_manager_login'),
            {'team_username': 'red_tigers', 'team_password': 'WrongPassword'},
            format='json',
        )
        self.assertEqual(response.status_code, 400)
        errors = str(response.data)
        self.assertIn("Incorrect team password", errors)

    # --------------------------------------------------------------------------
    # 2. Automated Welcome Email for School Admin
    # --------------------------------------------------------------------------
    @patch('accounts.email_service.send_school_admin_welcome_email')
    def test_super_admin_creates_school_admin_triggers_email(self, mock_send_email):
        mock_send_email.return_value = True

        self.client.force_authenticate(user=self.super_admin)
        url = reverse('super-admin-schools-admins', kwargs={'pk': self.school.pk})
        response = self.client.post(
            url,
            {
                'email': 'secondadmin@dps.edu',
                'name': 'Second Administrator',
                'password': 'TempAdminPassword123!',
            },
            format='json',
        )
        self.assertEqual(response.status_code, 201)
        self.assertTrue(mock_send_email.called)
        mock_send_email.assert_called_once_with(
            to_email='secondadmin@dps.edu',
            name='Second Administrator',
            school_name=self.school.name,
            password='TempAdminPassword123!',
        )

    # --------------------------------------------------------------------------
    # 3. Automated Staff Invitation Email
    # --------------------------------------------------------------------------
    @patch('accounts.email_service.send_staff_invitation_email')
    def test_school_admin_creates_staff_triggers_email(self, mock_send_email):
        mock_send_email.return_value = True

        self.client.force_authenticate(user=self.admin_user)
        response = self.client.post(
            reverse('school-users-list'),
            {
                'email': 'coordinator@dps.edu',
                'name': 'Festival Coordinator',
                'role': 'event_manager',
                'password': 'CoordinatorPass123!',
            },
            format='json',
        )
        self.assertEqual(response.status_code, 201)
        self.assertTrue(mock_send_email.called)
        mock_send_email.assert_called_once_with(
            to_email='coordinator@dps.edu',
            name='Festival Coordinator',
            school_name=self.school.name,
            role_name='event_manager',
            password='CoordinatorPass123!',
        )

    # --------------------------------------------------------------------------
    # 4. Forgot Password Flow with OTP
    # --------------------------------------------------------------------------
    @patch('accounts.email_service.send_otp_email')
    def test_forgot_password_flow(self, mock_send_otp):
        mock_send_otp.return_value = True

        # Request OTP for non-existent email
        response = self.client.post(
            reverse('forgot_password_request_otp'),
            {'email': 'ghost@nowhere.com'},
            format='json',
            HTTP_X_REQUESTED_WITH='XMLHttpRequest',
        )
        self.assertEqual(response.status_code, 404)

        # Request OTP for valid user
        response = self.client.post(
            reverse('forgot_password_request_otp'),
            {'email': 'admin@dps.edu'},
            format='json',
            HTTP_X_REQUESTED_WITH='XMLHttpRequest',
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(mock_send_otp.called)

        # Verify OTP record created
        otp_record = PasswordResetOTP.objects.filter(
            user=self.admin_user,
            purpose='forgot_password',
            is_used=False
        ).first()
        self.assertIsNotNone(otp_record)
        self.assertEqual(len(otp_record.otp_code), 6)
        self.assertTrue(otp_record.is_valid())

        # Test verify with wrong OTP
        wrong_res = self.client.post(
            reverse('forgot_password_verify_reset'),
            {
                'email': 'admin@dps.edu',
                'otp': '000000',
                'new_password': 'BrandNewPassword999!',
            },
            format='json',
            HTTP_X_REQUESTED_WITH='XMLHttpRequest',
        )
        self.assertEqual(wrong_res.status_code, 400)
        self.assertIn("Incorrect verification code", wrong_res.data.get('error', ''))

        # Test verify with correct OTP
        old_session = self.admin_user.session_version
        correct_res = self.client.post(
            reverse('forgot_password_verify_reset'),
            {
                'email': 'admin@dps.edu',
                'otp': otp_record.otp_code,
                'new_password': 'BrandNewPassword999!',
            },
            format='json',
            HTTP_X_REQUESTED_WITH='XMLHttpRequest',
        )
        self.assertEqual(correct_res.status_code, 200)

        # Verify password changed in DB
        self.admin_user.refresh_from_db()
        self.assertTrue(self.admin_user.check_password('BrandNewPassword999!'))
        self.assertGreater(self.admin_user.session_version, old_session)

        # Verify OTP is marked used
        otp_record.refresh_from_db()
        self.assertTrue(otp_record.is_used)

    # --------------------------------------------------------------------------
    # 5. Settings Change Password Flow with OTP
    # --------------------------------------------------------------------------
    @patch('accounts.email_service.send_otp_email')
    def test_settings_change_password_with_otp(self, mock_send_otp):
        mock_send_otp.return_value = True

        self.client.force_authenticate(user=self.admin_user)

        # Request OTP from Settings
        req_res = self.client.post(
            reverse('settings_request_password_otp'),
            {},
            format='json',
            HTTP_X_REQUESTED_WITH='XMLHttpRequest',
        )
        self.assertEqual(req_res.status_code, 200)
        self.assertTrue(mock_send_otp.called)

        otp_record = PasswordResetOTP.objects.filter(
            user=self.admin_user,
            purpose='settings_change',
            is_used=False
        ).first()
        self.assertIsNotNone(otp_record)

        # Submit change with wrong current password
        bad_curr = self.client.post(
            reverse('settings_change_password_with_otp'),
            {
                'current_password': 'WrongCurrentPassword',
                'otp': otp_record.otp_code,
                'new_password': 'SettingsNewPassword#123',
            },
            format='json',
            HTTP_X_REQUESTED_WITH='XMLHttpRequest',
        )
        self.assertEqual(bad_curr.status_code, 400)
        self.assertIn("Current password is incorrect", bad_curr.data.get('error', ''))

        # Submit change with correct details
        ok_res = self.client.post(
            reverse('settings_change_password_with_otp'),
            {
                'current_password': 'InitialStrongPassword123!',
                'otp': otp_record.otp_code,
                'new_password': 'SettingsNewPassword#123',
            },
            format='json',
            HTTP_X_REQUESTED_WITH='XMLHttpRequest',
        )
        self.assertEqual(ok_res.status_code, 200)

        # Verify password updated
        self.admin_user.refresh_from_db()
        self.assertTrue(self.admin_user.check_password('SettingsNewPassword#123'))
