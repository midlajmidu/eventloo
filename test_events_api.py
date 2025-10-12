#!/usr/bin/env python3
"""
Django shell test script to verify the events API is working correctly.
Run this with: python manage.py shell < test_events_api.py
"""

import os
import sys
import django

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'event_management.settings')
django.setup()

from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from events.models import Event
from events.serializers import EventListSerializer

User = get_user_model()

def test_events_api():
    """Test the events API endpoints"""
    print("=== Testing Events API ===")
    
    # Create a test client
    client = APIClient()
    
    # Create a test user for authentication
    try:
        test_user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123',
            name='Test User',
            role='admin'
        )
        print(f"✓ Created test user: {test_user.name}")
    except Exception as e:
        print(f"✗ Failed to create test user: {e}")
        return
    
    # Create a test event
    try:
        test_event = Event.objects.create(
            title='Test Event',
            description='Test event description',
            event_type='competition',
            status='published',
            start_date='2024-12-01',
            end_date='2024-12-02',
            venue='Test Venue',
            max_participants=100,
            is_team_based=True,
            created_by=test_user
        )
        print(f"✓ Created test event: {test_event.title}")
    except Exception as e:
        print(f"✗ Failed to create test event: {e}")
        return
    
    # Test 1: Test Event model properties
    print("\n--- Testing Event Model Properties ---")
    try:
        participants = test_event.current_participants
        teams = test_event.current_teams
        registration_open = test_event.is_registration_open
        print(f"✓ current_participants: {participants}")
        print(f"✓ current_teams: {teams}")
        print(f"✓ is_registration_open: {registration_open}")
    except Exception as e:
        print(f"✗ Event properties failed: {e}")
    
    # Test 2: Test EventListSerializer
    print("\n--- Testing EventListSerializer ---")
    try:
        serializer = EventListSerializer(test_event)
        data = serializer.data
        print(f"✓ Serializer data keys: {list(data.keys())}")
        print(f"✓ Event title: {data.get('title')}")
        print(f"✓ Created by name: {data.get('created_by', {}).get('name')}")
    except Exception as e:
        print(f"✗ Serializer failed: {e}")
    
    # Test 3: Test API endpoint with authentication
    print("\n--- Testing API Endpoint (Authenticated) ---")
    try:
        client.force_authenticate(user=test_user)
        response = client.get('/api/events/')
        print(f"✓ Status code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Response contains {len(data.get('results', []))} events")
            print(f"✓ Pagination info: count={data.get('count')}, next={data.get('next')}")
        else:
            print(f"✗ Response error: {response.content.decode()}")
    except Exception as e:
        print(f"✗ API test failed: {e}")
    
    # Test 4: Test API endpoint without authentication (should fail)
    print("\n--- Testing API Endpoint (Unauthenticated) ---")
    try:
        client.force_authenticate(user=None)
        response = client.get('/api/events/')
        print(f"✓ Status code: {response.status_code} (expected 401)")
        
        if response.status_code == 401:
            print("✓ Authentication required as expected")
        else:
            print(f"✗ Unexpected response: {response.content.decode()}")
    except Exception as e:
        print(f"✗ Unauthenticated test failed: {e}")
    
    # Cleanup
    print("\n--- Cleanup ---")
    try:
        test_event.delete()
        test_user.delete()
        print("✓ Test data cleaned up")
    except Exception as e:
        print(f"✗ Cleanup failed: {e}")
    
    print("\n=== Test Complete ===")

if __name__ == '__main__':
    test_events_api()
