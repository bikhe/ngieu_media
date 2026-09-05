from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from .models import InviteCode, Equipment, Event

User = get_user_model()

class MediaExchangeTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        
        # Create users
        self.admin = User.objects.create_superuser(username='admin', password='password123', role='MAIN_ADMIN')
        self.org1 = User.objects.create_user(username='org1', password='password123', role='ORGANIZER')
        self.org2 = User.objects.create_user(username='org2', password='password123', role='ORGANIZER')
        self.media1 = User.objects.create_user(username='media1', password='password123', role='MEDIA', skill_level='ANY')
        self.media2 = User.objects.create_user(username='media2', password='password123', role='MEDIA', skill_level='ANY')
        
        # Create equipment
        self.camera = Equipment.objects.create(name='Camera A', total_quantity=1)
        self.lens = Equipment.objects.create(name='Lens B', total_quantity=2)

    def test_registration_role_from_invite(self):
        # Create invite code for media
        code_media = InviteCode.objects.create(code='MEDIA123', role='MEDIA')
        
        # Register user
        response = self.client.post('/api/register/', {
            'username': 'new_media',
            'password': 'password123',
            'invite_code': 'MEDIA123'
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify user role
        new_user = User.objects.get(username='new_media')
        self.assertEqual(new_user.role, 'MEDIA')
        self.assertTrue(InviteCode.objects.get(code='MEDIA123').is_used)

    def test_event_editing_permissions(self):
        # Create event owned by org1
        event = Event.objects.create(
            title='Org1 Event',
            date=timezone.now().date(),
            responsible_person=self.org1,
            status='OPEN'
        )
        
        # Authenticate as org2 (different organizer)
        self.client.force_authenticate(user=self.org2)
        response = self.client.patch(f'/api/events/{event.id}/', {'title': 'Updated Title'})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        
        # Authenticate as media1
        self.client.force_authenticate(user=self.media1)
        response = self.client.patch(f'/api/events/{event.id}/', {'title': 'Updated Title'})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        
        # Authenticate as admin
        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(f'/api/events/{event.id}/', {'title': 'Updated Title'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        event.refresh_from_db()
        self.assertEqual(event.title, 'Updated Title')
        
        # Authenticate as org1 (owner)
        self.client.force_authenticate(user=self.org1)
        response = self.client.patch(f'/api/events/{event.id}/', {'title': 'Updated Again'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        event.refresh_from_db()
        self.assertEqual(event.title, 'Updated Again')

    def test_equipment_double_booking_prevention(self):
        event_date = timezone.now().date()
        
        # Event 1 books camera
        event1 = Event.objects.create(
            title='Event 1',
            date=event_date,
            responsible_person=self.org1,
            status='OPEN'
        )
        event1.booked_equipment.add(self.camera)
        
        # Event 2 tries to book same camera (total_quantity is 1)
        self.client.force_authenticate(user=self.org1)
        response = self.client.post('/api/events/', {
            'title': 'Event 2',
            'date': str(event_date),
            'location': 'Main Hall',
            'content_type': 'PHOTO',
            'required_skill': 'ANY',
            'max_participants': 1,
            'equipment_ids': [self.camera.id]
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('уже полностью забронировано', str(response.data))

    def test_take_task_equipment_conflict(self):
        event_date = timezone.now().date()
        
        # Event 1 books camera (status OPEN)
        event1 = Event.objects.create(
            title='Event 1',
            date=event_date,
            responsible_person=self.org1,
            status='OPEN'
        )
        event1.booked_equipment.add(self.camera)
        
        # Event 2 is OPEN and has no equipment initially
        event2 = Event.objects.create(
            title='Event 2',
            date=event_date,
            responsible_person=self.org1,
            status='OPEN'
        )
        
        # Media 1 tries to take Event 2 and book the same camera
        self.client.force_authenticate(user=self.media1)
        response = self.client.post(f'/api/events/{event2.id}/take_task/', {
            'equipment_ids': [self.camera.id]
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('уже полностью забронирована', str(response.data))

    def test_equipment_time_overlap_booking(self):
        from datetime import time
        event_date = timezone.now().date()
        
        # Event 1 books camera from 12:00 to 14:00
        event1 = Event.objects.create(
            title='Event 1',
            date=event_date,
            time=time(12, 0),
            end_time=time(14, 0),
            responsible_person=self.org1,
            status='OPEN'
        )
        event1.booked_equipment.add(self.camera)
        
        self.client.force_authenticate(user=self.org1)
        
        # Event 2 tries to book same camera from 10:00 to 12:00 (non-overlapping, touching at 12:00) -> Should succeed
        response = self.client.post('/api/events/', {
            'title': 'Event 2',
            'date': str(event_date),
            'time': '10:00',
            'end_time': '12:00',
            'location': 'Main Hall',
            'content_type': 'PHOTO',
            'required_skill': 'ANY',
            'max_participants': 1,
            'equipment_ids': [self.camera.id]
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Event 3 tries to book same camera from 13:00 to 15:00 (overlapping 13:00-14:00) -> Should fail
        response = self.client.post('/api/events/', {
            'title': 'Event 3',
            'date': str(event_date),
            'time': '13:00',
            'end_time': '15:00',
            'location': 'Main Hall',
            'content_type': 'PHOTO',
            'required_skill': 'ANY',
            'max_participants': 1,
            'equipment_ids': [self.camera.id]
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        
    def test_loan_time_overlap_booking(self):
        from datetime import datetime, time
        from django.utils.timezone import make_aware, get_current_timezone
        from .models import EquipmentLoan
        
        event_date = timezone.now().date()
        
        # Create an EquipmentLoan from 12:00 to 14:00 on event_date
        tz = get_current_timezone()
        loan_start = make_aware(datetime.combine(event_date, time(12, 0)), tz)
        loan_end = make_aware(datetime.combine(event_date, time(14, 0)), tz)
        
        loan = EquipmentLoan.objects.create(
            equipment=self.camera,
            user=self.media1,
            status='ISSUED',
            loan_start=loan_start,
            loan_end=loan_end,
            quantity=1
        )
        
        self.client.force_authenticate(user=self.org1)
        
        # Event 1 tries to book same camera from 10:00 to 12:00 -> Should succeed
        response = self.client.post('/api/events/', {
            'title': 'Event 1',
            'date': str(event_date),
            'time': '10:00',
            'end_time': '12:00',
            'location': 'Main Hall',
            'content_type': 'PHOTO',
            'required_skill': 'ANY',
            'max_participants': 1,
            'equipment_ids': [self.camera.id]
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Event 2 tries to book same camera from 13:00 to 15:00 -> Should fail
        response = self.client.post('/api/events/', {
            'title': 'Event 2',
            'date': str(event_date),
            'time': '13:00',
            'end_time': '15:00',
            'location': 'Main Hall',
            'content_type': 'PHOTO',
            'required_skill': 'ANY',
            'max_participants': 1,
            'equipment_ids': [self.camera.id]
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


    def test_equipment_permissions(self):
        # Media tries to create equipment -> 403
        self.client.force_authenticate(user=self.media1)
        response = self.client.post('/api/equipment/', {
            'name': 'Hacked Camera',
            'total_quantity': 5
        })
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        
        # Org tries to create equipment -> 403
        self.client.force_authenticate(user=self.org1)
        response = self.client.post('/api/equipment/', {
            'name': 'Hacked Camera',
            'total_quantity': 5
        })
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Admin tries to create equipment -> 201
        self.client.force_authenticate(user=self.admin)
        response = self.client.post('/api/equipment/', {
            'name': 'Admin Camera',
            'total_quantity': 5
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        new_eq_id = response.data['id']
        
        # Media tries to delete equipment -> 403
        self.client.force_authenticate(user=self.media1)
        response = self.client.delete(f'/api/equipment/{new_eq_id}/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_analytics_permissions_and_data(self):
        # 1. Verify permissions
        self.client.force_authenticate(user=self.media1)
        response = self.client.get('/api/events/analytics/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(user=self.org1)
        response = self.client.get('/api/events/analytics/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # 2. Setup mock events for analytics verification
        # Event 1: Completed photo shoot with camera
        e1 = Event.objects.create(
            title='Analytics Shoot 1',
            date=timezone.now().date(),
            responsible_person=self.org1,
            status='COMPLETED',
            content_type='PHOTO'
        )
        e1.media_participants.add(self.media1)
        e1.booked_equipment.add(self.camera)

        # Event 2: Open video shoot (no media or equipment)
        e2 = Event.objects.create(
            title='Analytics Shoot 2',
            date=timezone.now().date(),
            responsible_person=self.org2,
            status='OPEN',
            content_type='VIDEO'
        )

        # 3. Call as admin and verify data structure
        self.client.force_authenticate(user=self.admin)
        response = self.client.get('/api/events/analytics/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.data
        self.assertIn('summary', data)
        self.assertEqual(data['summary']['total_events'], 2)
        self.assertEqual(data['summary']['completed_events'], 1)
        self.assertEqual(data['summary']['overdue_events'], 0)

        # Statuses count
        self.assertEqual(data['status_distribution']['COMPLETED'], 1)
        self.assertEqual(data['status_distribution']['OPEN'], 1)
        self.assertEqual(data['status_distribution']['IN_PROGRESS'], 0)

        # Content types
        self.assertEqual(data['content_type_distribution']['PHOTO'], 1)
        self.assertEqual(data['content_type_distribution']['VIDEO'], 1)

        # Equipment usage
        camera_util = next(item for item in data['equipment_utilization'] if item['name'] == 'Camera A')
        self.assertEqual(camera_util['bookings_count'], 1)
        self.assertEqual(camera_util['booking_rate'], 50.0)

        # Media stats
        media1_stats = next(item for item in data['media_stats'] if item['username'] == 'media1')
        self.assertEqual(media1_stats['total_taken'], 1)
        self.assertEqual(media1_stats['completed_count'], 1)
        self.assertEqual(media1_stats['success_rate'], 100.0)

        # Organizer stats
        org1_stats = next(item for item in data['organizer_stats'] if item['username'] == 'org1')
        self.assertEqual(org1_stats['created_count'], 1)

    def test_user_management_permissions_and_crud(self):
        # 1. Non-admin user tries to create a user -> 403
        self.client.force_authenticate(user=self.media1)
        response = self.client.post('/api/users/', {
            'username': 'temp_user',
            'password': 'password123',
            'role': 'ORGANIZER'
        })
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # 2. Admin creates a new user -> 201
        self.client.force_authenticate(user=self.admin)
        response = self.client.post('/api/users/', {
            'username': 'new_staff',
            'password': 'securepassword123',
            'role': 'ORGANIZER',
            'first_name': 'Ivan',
            'last_name': 'Ivanov'
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        new_user_id = response.data['id']
        
        # Verify user was created with correct hashed password and fields
        new_user = User.objects.get(id=new_user_id)
        self.assertEqual(new_user.username, 'new_staff')
        self.assertEqual(new_user.role, 'ORGANIZER')
        self.assertEqual(new_user.first_name, 'Ivan')
        self.assertTrue(new_user.check_password('securepassword123'))

        # 3. Non-admin user tries to edit -> 403
        self.client.force_authenticate(user=self.media1)
        response = self.client.patch(f'/api/users/{new_user_id}/', {'first_name': 'Petr'})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # 4. Admin edits user and updates password -> 200
        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(f'/api/users/{new_user_id}/', {
            'first_name': 'Petr',
            'password': 'newpassword123'
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        new_user.refresh_from_db()
        self.assertEqual(new_user.first_name, 'Petr')
        self.assertTrue(new_user.check_password('newpassword123'))

        # 5. Non-admin tries to delete -> 403
        self.client.force_authenticate(user=self.media1)
        response = self.client.delete(f'/api/users/{new_user_id}/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # 6. Admin deletes user -> 204
        self.client.force_authenticate(user=self.admin)
        response = self.client.delete(f'/api/users/{new_user_id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(User.objects.filter(id=new_user_id).exists())

    def test_take_task_creates_loan_and_prevents_double_booking(self):
        from .models import EquipmentLoan
        from datetime import time
        
        event_date = timezone.now().date()
        
        # Create an OPEN event
        event = Event.objects.create(
            title='Test Event with Equipment',
            date=event_date,
            time=time(12, 0),
            end_time=time(14, 0),
            responsible_person=self.org1,
            status='OPEN'
        )
        
        # Authenticate as media1 and take the task, booking the camera
        self.client.force_authenticate(user=self.media1)
        response = self.client.post(f'/api/events/{event.id}/take_task/', {
            'equipment_ids': [self.camera.id]
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify EquipmentLoan was created
        loans = EquipmentLoan.objects.filter(user=self.media1, event=event, equipment=self.camera)
        self.assertEqual(loans.count(), 1)
        loan = loans.first()
        self.assertEqual(loan.status, 'REQUESTED')
        self.assertEqual(loan.quantity, 1)
        self.assertEqual(loan.comment, f"Бронирование под мероприятие '{event.title}'")
        
        # Now try to request the same camera as media2 for an overlapping period -> Should fail because it is booked
        self.client.force_authenticate(user=self.media2)
        response = self.client.post('/api/loans/', {
            'equipment_id': self.camera.id,
            'quantity': 1,
            'loan_start': f"{event_date}T12:30:00Z",
            'loan_end': f"{event_date}T13:30:00Z"
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Недостаточно доступного оборудования', str(response.data))

    def test_event_roles_endpoint_accessible(self):
        """Regression test: Dashboard crashed because event-roles/ returned 404/error."""
        from .models import EventRole
        EventRole.objects.create(name='Фотограф')
        EventRole.objects.create(name='Видеограф')

        self.client.force_authenticate(user=self.admin)
        response = self.client.get('/api/event-roles/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should return a list (paginated or not)
        data = response.data.get('results', response.data) if isinstance(response.data, dict) else response.data
        self.assertGreaterEqual(len(data), 2)

    def test_media_users_filter(self):
        """Regression test: Dashboard crashed because users/?role=MEDIA failed."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.get('/api/users/', {'role': 'MEDIA'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data.get('results', response.data) if isinstance(response.data, dict) else response.data
        # media1 and media2 are MEDIA users created in setUp
        media_usernames = [u['username'] for u in data]
        self.assertIn('media1', media_usernames)
        self.assertIn('media2', media_usernames)

    def test_user_serializer_excludes_password(self):
        """Security test: UserSerializer must never return password hash."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(f'/api/users/{self.media1.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn('password', response.data)

    def test_user_me_returns_features(self):
        """Test that /users/me/ includes feature toggles."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.get('/api/users/me/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('features', response.data)
        self.assertIn('equipment_booking', response.data['features'])
        self.assertIn('event_chat', response.data['features'])


