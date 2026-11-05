"""
Comprehensive Email Service for Eventloo
Handles:
1. Password Reset & Security OTP emails (Sent from Eventloo Security <noreply@eventloo.in>)
2. School Admin Welcome emails (Sent from Eventloo Team <contact@eventloo.in>)
3. Staff Invitation emails (Sent from Eventloo Team <contact@eventloo.in>)
"""

import logging
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from accounts.email_backend import SSLContextEmailBackend

logger = logging.getLogger(__name__)

def get_noreply_connection():
    """SMTP Connection dedicated to security alerts, password resets, and OTPs"""
    return SSLContextEmailBackend(
        host=getattr(settings, 'NOREPLY_EMAIL_HOST', 'smtp.zoho.in'),
        port=getattr(settings, 'NOREPLY_EMAIL_PORT', 587),
        username=getattr(settings, 'NOREPLY_EMAIL_USER', 'noreply@eventloo.in'),
        password=getattr(settings, 'NOREPLY_EMAIL_PASSWORD', 'EyqVrVAGVEYP'),
        use_tls=True,
        timeout=10,
    )

def get_contact_connection():
    """SMTP Connection dedicated to school creation, staff invitations, and welcome messages"""
    return SSLContextEmailBackend(
        host=getattr(settings, 'CONTACT_EMAIL_HOST', 'smtp.zoho.in'),
        port=getattr(settings, 'CONTACT_EMAIL_PORT', 587),
        username=getattr(settings, 'CONTACT_EMAIL_USER', 'contact@eventloo.in'),
        password=getattr(settings, 'CONTACT_EMAIL_PASSWORD', '9HfUJjAK07t5'),
        use_tls=True,
        timeout=10,
    )

def send_otp_email(to_email, otp_code, user_name='', purpose="Password Change Request", expiry_minutes=5):
    """
    Send OTP email matching the exact security card layout from the specification.
    Sent from Eventloo Security <noreply@eventloo.in>.
    """
    subject = f"Your Eventloo Security Code: {otp_code}"
    from_email = getattr(settings, 'NOREPLY_FROM_EMAIL', 'Eventloo Security <noreply@eventloo.in>')

    # Format digits with clean letter-spacing
    formatted_digits = " ".join(str(otp_code))

    text_content = f"""
Eventloo Security - {purpose}

We received a request to change the password for your Eventloo account.
Please use the following One-Time Password (OTP) to securely complete this process:

YOUR SECURITY CODE: {otp_code}

This code will securely expire in {expiry_minutes} minutes.
For your protection, never share this code with anyone, including Eventloo support staff.

- Eventloo Security Team
"""

    html_content = f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{purpose}</title>
</head>
<body style="margin: 0; padding: 30px 10px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px border #e2e8f0;">
    <!-- Top Header Banner -->
    <tr>
      <td style="background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%); padding: 22px 24px; text-align: center;">
        <span style="color: #ffffff; font-size: 19px; font-weight: 800; letter-spacing: 0.5px;">Eventloo Security</span>
      </td>
    </tr>

    <!-- Main Content Container -->
    <tr>
      <td style="padding: 36px 32px 28px 32px;">
        <h1 style="margin: 0 0 16px 0; color: #0f172a; font-size: 21px; font-weight: 700; line-height: 1.3;">
          {purpose}
        </h1>
        
        <p style="margin: 0 0 26px 0; color: #475569; font-size: 14px; line-height: 1.6;">
          We received a request to change the password for your Eventloo account. Please use the following <strong style="color: #1e293b;">One-Time Password (OTP)</strong> to securely complete this process.
        </p>

        <!-- OTP Highlight Card -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; margin-bottom: 26px;">
          <tr>
            <td style="padding: 26px 20px; text-align: center;">
              <div style="color: #64748b; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 12px;">
                YOUR SECURITY CODE
              </div>
              <div style="color: #4338ca; font-size: 38px; font-weight: 800; letter-spacing: 7px; font-family: 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace;">
                {formatted_digits}
              </div>
            </td>
          </tr>
        </table>

        <!-- Expiry and Security Notice -->
        <p style="margin: 0 0 10px 0; color: #64748b; font-size: 12.5px; line-height: 1.6;">
          This code will securely expire in <strong style="color: #0f172a;">{expiry_minutes} minutes</strong>. For your protection, never share this code with anyone, including Eventloo support staff.
        </p>
        
        <p style="margin: 18px 0 0 0; color: #94a3b8; font-size: 12px; line-height: 1.5;">
          If you did not initiate this request, you can safely ignore this email or review your account credentials.
        </p>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background-color: #f8fafc; padding: 18px 32px; border-top: 1px solid #f1f5f9; text-align: center; color: #94a3b8; font-size: 11.5px;">
        © 2026 Eventloo Management System. All rights reserved.
      </td>
    </tr>
  </table>
</body>
</html>
"""

    try:
        connection = get_noreply_connection()
        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_content.strip(),
            from_email=from_email,
            to=[to_email],
            connection=connection,
        )
        msg.attach_alternative(html_content, "text/html")
        msg.send()
        logger.info(f"Successfully sent OTP email to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send OTP email to {to_email}: {e}")
        return False


def send_school_admin_welcome_email(to_email, name, school_name, password, login_url="https://app.eventloo.in/login"):
    """
    Send welcome email when a Super Admin creates an admin for a school.
    Sent from Eventloo Team <contact@eventloo.in>.
    """
    subject = f"Welcome to Eventloo - Your Administrator Account for {school_name}"
    from_email = getattr(settings, 'CONTACT_FROM_EMAIL', 'Eventloo Team <contact@eventloo.in>')

    text_content = f"""
Welcome to Eventloo!

Dear {name},

You have been registered as a School Administrator for {school_name} on the Eventloo School Event Management System.

Your Login Credentials:
- Portal URL: {login_url}
- Username / Email: {to_email}
- Temporary Password: {password}

Please log in and update your temporary password from your profile settings.

Best regards,
The Eventloo Team
contact@eventloo.in
"""

    html_content = f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Eventloo</title>
</head>
<body style="margin: 0; padding: 30px 10px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
    <!-- Top Header Banner -->
    <tr>
      <td style="background: linear-gradient(135deg, #0284c7 0%, #2563eb 50%, #4f46e5 100%); padding: 26px 28px; text-align: center;">
        <div style="color: #ffffff; font-size: 22px; font-weight: 800; letter-spacing: 0.5px;">Eventloo</div>
        <div style="color: #e0e7ff; font-size: 13px; font-weight: 500; margin-top: 4px;">School Event & Festival Management Platform</div>
      </td>
    </tr>

    <!-- Body -->
    <tr>
      <td style="padding: 36px 32px 28px 32px;">
        <h1 style="margin: 0 0 14px 0; color: #0f172a; font-size: 21px; font-weight: 700;">
          Welcome to Eventloo, {name}!
        </h1>
        
        <p style="margin: 0 0 22px 0; color: #475569; font-size: 14px; line-height: 1.6;">
          You have been registered as the <strong style="color: #1e293b;">School Administrator</strong> for <strong style="color: #1e293b;">{school_name}</strong>. You now have full access to configure festival categories, assign team managers, schedule programs, and monitor live scoring.
        </p>

        <!-- Credentials Card -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 24px;">
          <tr>
            <td style="padding: 20px 24px;">
              <div style="color: #64748b; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">
                YOUR ADMINISTRATIVE ACCESS DETAILS
              </div>
              <div style="margin-bottom: 8px; font-size: 13.5px; color: #334155;">
                <strong style="color: #0f172a;">Portal URL:</strong> <a href="{login_url}" style="color: #2563eb; text-decoration: none;">{login_url}</a>
              </div>
              <div style="margin-bottom: 8px; font-size: 13.5px; color: #334155;">
                <strong style="color: #0f172a;">Login Email:</strong> <span style="font-family: monospace; background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">{to_email}</span>
              </div>
              <div style="font-size: 13.5px; color: #334155;">
                <strong style="color: #0f172a;">Temporary Password:</strong> <span style="font-family: monospace; font-weight: 700; color: #4338ca; background: #e0e7ff; padding: 2px 8px; border-radius: 4px;">{password}</span>
              </div>
            </td>
          </tr>
        </table>

        <!-- CTA Button -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
          <tr>
            <td align="center">
              <a href="{login_url}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 13px 32px; border-radius: 10px; font-size: 14px; font-weight: 700; box-shadow: 0 2px 8px rgba(79, 70, 229, 0.3);">
                Sign In to Admin Portal →
              </a>
            </td>
          </tr>
        </table>

        <p style="margin: 0; color: #64748b; font-size: 12.5px; line-height: 1.6;">
          <strong>Security Recommendation:</strong> Please sign in and update your temporary password upon your first login.
        </p>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background-color: #f8fafc; padding: 18px 32px; border-top: 1px solid #f1f5f9; text-align: center; color: #94a3b8; font-size: 11.5px;">
        Need help? Reach out to us at <a href="mailto:contact@eventloo.in" style="color: #6366f1; text-decoration: none;">contact@eventloo.in</a><br/>
        © 2026 Eventloo Management System. All rights reserved.
      </td>
    </tr>
  </table>
</body>
</html>
"""

    try:
        connection = get_contact_connection()
        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_content.strip(),
            from_email=from_email,
            to=[to_email],
            connection=connection,
        )
        msg.attach_alternative(html_content, "text/html")
        msg.send()
        logger.info(f"Successfully sent school admin welcome email to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send school admin welcome email to {to_email}: {e}")
        return False


def send_staff_invitation_email(to_email, name, school_name, role_name="Staff", password="", login_url="https://app.eventloo.in/login"):
    """
    Send invitation email when an admin adds an Event Manager or Staff in Admin Portal.
    Sent from Eventloo Team <contact@eventloo.in>.
    """
    role_display = "Event Manager" if role_name == 'event_manager' else ("Administrator" if role_name == 'admin' else role_name)
    subject = f"You have been invited to manage {school_name} on Eventloo"
    from_email = getattr(settings, 'CONTACT_FROM_EMAIL', 'Eventloo Team <contact@eventloo.in>')

    text_content = f"""
Eventloo Staff Invitation

Hello {name},

You have been invited to join the management team for {school_name} on Eventloo as an {role_display}.

Your Login Credentials:
- Portal URL: {login_url}
- Login Email: {to_email}
{f'- Temporary Password: {password}' if password else ''}

Please sign in to access festival schedules, program management, and live score updates.

Best regards,
The Eventloo Team
contact@eventloo.in
"""

    html_content = f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Eventloo Staff Invitation</title>
</head>
<body style="margin: 0; padding: 30px 10px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
    <!-- Top Header Banner -->
    <tr>
      <td style="background: linear-gradient(135deg, #0ea5e9 0%, #3b82f6 50%, #6366f1 100%); padding: 24px 28px; text-align: center;">
        <div style="color: #ffffff; font-size: 21px; font-weight: 800; letter-spacing: 0.5px;">Eventloo</div>
        <div style="color: #e0e7ff; font-size: 13px; font-weight: 500; margin-top: 4px;">Staff & Event Management Portal</div>
      </td>
    </tr>

    <!-- Body -->
    <tr>
      <td style="padding: 34px 32px 28px 32px;">
        <h1 style="margin: 0 0 14px 0; color: #0f172a; font-size: 20px; font-weight: 700;">
          Hello {name},
        </h1>
        
        <p style="margin: 0 0 20px 0; color: #475569; font-size: 14px; line-height: 1.6;">
          You have been invited to join the management team for <strong style="color: #1e293b;">{school_name}</strong> as an <strong style="color: #4338ca;">{role_display}</strong> on Eventloo.
        </p>

        <!-- Credentials Card -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 24px;">
          <tr>
            <td style="padding: 20px 24px;">
              <div style="color: #64748b; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">
                YOUR INVITATION DETAILS
              </div>
              <div style="margin-bottom: 8px; font-size: 13.5px; color: #334155;">
                <strong style="color: #0f172a;">Assigned Role:</strong> {role_display}
              </div>
              <div style="margin-bottom: 8px; font-size: 13.5px; color: #334155;">
                <strong style="color: #0f172a;">Portal URL:</strong> <a href="{login_url}" style="color: #2563eb; text-decoration: none;">{login_url}</a>
              </div>
              <div style="margin-bottom: 8px; font-size: 13.5px; color: #334155;">
                <strong style="color: #0f172a;">Login Email:</strong> <span style="font-family: monospace; background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">{to_email}</span>
              </div>
              {f'''<div style="font-size: 13.5px; color: #334155;">
                <strong style="color: #0f172a;">Temporary Password:</strong> <span style="font-family: monospace; font-weight: 700; color: #4338ca; background: #e0e7ff; padding: 2px 8px; border-radius: 4px;">{password}</span>
              </div>''' if password else ''}
            </td>
          </tr>
        </table>

        <!-- CTA Button -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 22px;">
          <tr>
            <td align="center">
              <a href="{login_url}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 13px 32px; border-radius: 10px; font-size: 14px; font-weight: 700; box-shadow: 0 2px 8px rgba(79, 70, 229, 0.3);">
                Sign In to Eventloo Portal →
              </a>
            </td>
          </tr>
        </table>

        <p style="margin: 0; color: #64748b; font-size: 12.5px; line-height: 1.6;">
          Please sign in and set your personal password to begin managing events.
        </p>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background-color: #f8fafc; padding: 18px 32px; border-top: 1px solid #f1f5f9; text-align: center; color: #94a3b8; font-size: 11.5px;">
        Questions? Contact us at <a href="mailto:contact@eventloo.in" style="color: #6366f1; text-decoration: none;">contact@eventloo.in</a><br/>
        © 2026 Eventloo Management System. All rights reserved.
      </td>
    </tr>
  </table>
</body>
</html>
"""

    try:
        connection = get_contact_connection()
        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_content.strip(),
            from_email=from_email,
            to=[to_email],
            connection=connection,
        )
        msg.attach_alternative(html_content, "text/html")
        msg.send()
        logger.info(f"Successfully sent staff invitation email to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send staff invitation email to {to_email}: {e}")
        return False
