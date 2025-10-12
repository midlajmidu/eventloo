# Django Shell Test Snippet for Events API
# Copy and paste this into Django shell: python manage.py shell

from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from events.models import Event
from events.serializers import EventListSerializer

User = get_user_model()

# Create test client
client = APIClient()

# Create test user
test_user = User.objects.create_user(
    username='testuser',
    email='test@example.com',
    password='testpass123',
    name='Test User',
    role='admin'
)

# Create test event
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

# Test Event model properties
print("Event Properties:")
print(f"current_participants: {test_event.current_participants}")
print(f"current_teams: {test_event.current_teams}")
print(f"is_registration_open: {test_event.is_registration_open}")

# Test EventListSerializer
print("\nSerializer Test:")
serializer = EventListSerializer(test_event)
print(f"Serialized data keys: {list(serializer.data.keys())}")
print(f"Event title: {serializer.data.get('title')}")
print(f"Created by name: {serializer.data.get('created_by', {}).get('name')}")

# Test API endpoint
print("\nAPI Test:")
client.force_authenticate(user=test_user)
response = client.get('/api/events/')
print(f"Status code: {response.status_code}")

if response.status_code == 200:
    data = response.json()
    print(f"Success! Found {len(data.get('results', []))} events")
    print(f"Pagination: count={data.get('count')}")
else:
    print(f"Error: {response.content.decode()}")

# Cleanup
test_event.delete()
test_user.delete()
print("\nTest complete and cleaned up!")
