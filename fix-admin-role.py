#!/usr/bin/env python3
"""
Quick script to fix admin user role in the database.
Run this from the backend directory:
    cd backend
    python ../fix-admin-role.py
"""

import os
import sys
import django

# Add the backend directory to the path
backend_dir = os.path.join(os.path.dirname(__file__), 'backend')
sys.path.insert(0, backend_dir)

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'event_management.settings')
django.setup()

from accounts.models import User

def fix_admin_role():
    """Fix the admin user's role to 'admin'"""
    try:
        # Find the admin user
        admin_user = User.objects.get(email='admin@eventloo.com')
        
        print(f"Found user: {admin_user.email}")
        print(f"Current role: {admin_user.role}")
        
        if admin_user.role != 'admin':
            admin_user.role = 'admin'
            admin_user.save()
            print(f"✅ Updated role to: {admin_user.role}")
        else:
            print("✅ Role is already set to 'admin'")
        
        # Verify the change
        admin_user.refresh_from_db()
        print(f"\nVerification:")
        print(f"  Email: {admin_user.email}")
        print(f"  Username: {admin_user.username}")
        print(f"  Role: {admin_user.role}")
        print(f"  Is Staff: {admin_user.is_staff}")
        print(f"  Is Superuser: {admin_user.is_superuser}")
        
    except User.DoesNotExist:
        print("❌ Admin user not found!")
        print("Creating admin user...")
        
        admin_user = User.objects.create_user(
            email='admin@eventloo.com',
            username='admin',
            password='admin123',
            role='admin',
            is_staff=True,
            is_superuser=True
        )
        print(f"✅ Created admin user: {admin_user.email}")
    
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    print("Fixing admin user role...\n")
    fix_admin_role()
    print("\n✅ Done!")
