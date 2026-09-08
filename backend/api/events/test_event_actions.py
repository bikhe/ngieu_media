"""Tests for event actions: take_task, submit_work, approve/reject,
comments chat, participant assignment, CSV export and the updates feed."""
import csv
import io
from unittest import mock

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model

from .models import Comment, Event, Equipment, EquipmentLoan, UpdateLog
from .tests_utils import random_password

User = get_user_model()

PASSWORD = random_password()


class EventActionsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(username='admin', password=PASSWORD, role='MAIN_ADMIN')
        self.org = User.objects.create_user(username='org', password=PASSWORD, role='ORGANIZER')
        self.org2 = User.objects.create_user(username='org2', password=PASSWORD, role='ORGANIZER')
        self.media1 = User.objects.create_user(username='media1', password=PASSWORD, role='MEDIA')
        self.media2 = User.objects.create_user(
            username='media2', password=PASSWORD, role='MEDIA', skill_level='PRO'
        )
        self.event = Event.objects.create(
            title='Open Shoot', date=timezone.now().date(),
            responsible_person=self.org, status='OPEN', max_participants=2,
        )
        self.camera = Equipment.objects.create(name='Camera X', total_quantity=1)

    def test_non_media_cannot_take_task(self):
        self.client.force_authenticate(user=self.org)
        response = self.client.post(f'/api/events/{self.event.id}/take_task/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_take_task_success_and_status_transition(self):
        event = Event.objects.create(
            title='Solo', date=timezone.now().date(),
            responsible_person=self.org, status='OPEN', max_participants=1,
        )
        self.client.force_authenticate(user=self.media1)
        response = self.client.post(f'/api/events/{event.id}/take_task/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        event.refresh_from_db()
        self.assertIn(self.media1, event.media_participants.all())
        # max_participants reached -> event moves to IN_PROGRESS
        self.assertEqual(event.status, 'IN_PROGRESS')

    def test_take_task_twice_rejected(self):
        self.client.force_authenticate(user=self.media1)
        self.client.post(f'/api/events/{self.event.id}/take_task/')
        response = self.client.post(f'/api/events/{self.event.id}/take_task/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_take_task_closed_event_rejected(self):
        self.event.status = 'COMPLETED'
        self.event.save()
        self.client.force_authenticate(user=self.media1)
        response = self.client.post(f'/api/events/{self.event.id}/take_task/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_take_task_missing_event(self):
        self.client.force_authenticate(user=self.media1)
        response = self.client.post('/api/events/99999/take_task/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_take_task_requires_skill(self):
        self.event.required_skill = 'PRO'
        self.event.save()
        self.client.force_authenticate(user=self.media1)  # skill_level ANY
        response = self.client.post(f'/api/events/{self.event.id}/take_task/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertNotIn(self.media1, self.event.media_participants.all())

    def test_pro_skill_level_bypasses_requirement(self):
        self.event.required_skill = 'VIDEO'
        self.event.save()
        self.client.force_authenticate(user=self.media2)  # skill_level PRO
        response = self.client.post(f'/api/events/{self.event.id}/take_task/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_take_task_unknown_equipment_rejected(self):
        self.client.force_authenticate(user=self.media1)
        response = self.client.post(f'/api/events/{self.event.id}/take_task/', {'equipment_ids': [99999]})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_media_cannot_create_event(self):
        self.client.force_authenticate(user=self.media1)
        response = self.client.post('/api/events/', {
            'title': 'Nope', 'date': str(timezone.now().date()), 'content_type': 'PHOTO'
        })
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_media_does_not_see_pending_events(self):
        pending = Event.objects.create(
            title='Hidden', date=timezone.now().date(),
            responsible_person=self.org, status='PENDING',
        )
        self.client.force_authenticate(user=self.media1)
        response = self.client.get('/api/events/')
        titles = [e['title'] for e in response.data]
        self.assertNotIn('Hidden', titles)
        self.assertIn('Open Shoot', titles)

    def test_organizer_sees_only_own_events(self):
        Event.objects.create(
            title='Foreign', date=timezone.now().date(),
            responsible_person=self.org2, status='OPEN',
        )
        self.client.force_authenticate(user=self.org)
        response = self.client.get('/api/events/')
        titles = [e['title'] for e in response.data]
        self.assertIn('Open Shoot', titles)
        self.assertNotIn('Foreign', titles)

    def test_admin_sees_all_events(self):
        Event.objects.create(
            title='Foreign', date=timezone.now().date(),
            responsible_person=self.org2, status='OPEN',
        )
        self.client.force_authenticate(user=self.admin)
        response = self.client.get('/api/events/')
        titles = [e['title'] for e in response.data]
        self.assertIn('Open Shoot', titles)
        self.assertIn('Foreign', titles)

    def test_status_filter(self):
        done = Event.objects.create(
            title='Done', date=timezone.now().date(),
            responsible_person=self.org, status='COMPLETED',
        )
        self.client.force_authenticate(user=self.org)
        response = self.client.get('/api/events/', {'status': 'COMPLETED'})
        titles = [e['title'] for e in response.data]
        self.assertEqual(titles, ['Done'])
        self.assertEqual(done.status, 'COMPLETED')

    def test_my_shoots_lists_only_taken(self):
        self.event.media_participants.add(self.media1)
        Event.objects.create(
            title='Not mine', date=timezone.now().date(),
            responsible_person=self.org, status='OPEN',
        )
        self.client.force_authenticate(user=self.media1)
        response = self.client.get('/api/events/my_shoots/')
        titles = [e['title'] for e in response.data]
        self.assertEqual(titles, ['Open Shoot'])

    def test_submit_work_completes_event(self):
        self.event.media_participants.add(self.media1)
        self.event.status = 'IN_PROGRESS'
        self.event.save()
        self.client.force_authenticate(user=self.media1)
        response = self.client.post(f'/api/events/{self.event.id}/submit_work/', {
            'result_link': 'https://example.com/gallery'
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.event.refresh_from_db()
        self.assertEqual(self.event.status, 'COMPLETED')
        self.assertEqual(self.event.result_link, 'https://example.com/gallery')

    def test_submit_work_appends_link(self):
        self.event.media_participants.add(self.media1)
        self.event.result_link = 'https://first.example.com'
        self.event.save()
        self.client.force_authenticate(user=self.media1)
        self.client.post(f'/api/events/{self.event.id}/submit_work/', {
            'result_link': 'https://second.example.com'
        })
        self.event.refresh_from_db()
        self.assertIn('https://first.example.com', self.event.result_link)
        self.assertIn('https://second.example.com', self.event.result_link)

    def test_submit_work_requires_link(self):
        self.event.media_participants.add(self.media1)
        self.client.force_authenticate(user=self.media1)
        response = self.client.post(f'/api/events/{self.event.id}/submit_work/', {})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_submit_work_non_participant_forbidden(self):
        self.client.force_authenticate(user=self.media2)
        response = self.client.post(f'/api/events/{self.event.id}/submit_work/', {
            'result_link': 'https://example.com'
        })
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_media_cannot_approve_or_reject(self):
        self.client.force_authenticate(user=self.media1)
        self.assertEqual(
            self.client.post(f'/api/events/{self.event.id}/approve/').status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(
            self.client.post(f'/api/events/{self.event.id}/reject/').status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_admin_approves_pending_event(self):
        self.event.status = 'PENDING'
        self.event.save()
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(f'/api/events/{self.event.id}/approve/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.event.refresh_from_db()
        self.assertEqual(self.event.status, 'OPEN')

    def test_admin_rejects_event(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(f'/api/events/{self.event.id}/reject/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.event.refresh_from_db()
        self.assertEqual(self.event.status, 'REJECTED')

    def test_user_with_approve_flag_can_approve(self):
        helper = User.objects.create_user(
            username='helper', password=PASSWORD, role='ORGANIZER', can_approve_events=True
        )
        event = Event.objects.create(
            title='Flagged', date=timezone.now().date(), responsible_person=helper, status='PENDING',
        )
        self.client.force_authenticate(user=helper)
        response = self.client.post(f'/api/events/{event.id}/approve/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class EventCommentsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.org = User.objects.create_user(username='org', password=PASSWORD, role='ORGANIZER')
        self.media1 = User.objects.create_user(username='media1', password=PASSWORD, role='MEDIA')
        self.media2 = User.objects.create_user(username='media2', password=PASSWORD, role='MEDIA')
        self.event = Event.objects.create(
            title='Chatty', date=timezone.now().date(),
            responsible_person=self.org, status='OPEN',
        )
        self.event.media_participants.add(self.media1)

    def test_participant_can_read_and_write_comments(self):
        self.client.force_authenticate(user=self.media1)
        response = self.client.post(f'/api/events/{self.event.id}/comments/', {'text': 'Привет!'})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        listing = self.client.get(f'/api/events/{self.event.id}/comments/')
        self.assertEqual(listing.status_code, status.HTTP_200_OK)
        texts = [c['text'] for c in listing.data]
        self.assertEqual(texts, ['Привет!'])

    def test_outsider_cannot_access_comments(self):
        self.client.force_authenticate(user=self.media2)
        response = self.client.get(f'/api/events/{self.event.id}/comments/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        response = self.client.post(f'/api/events/{self.event.id}/comments/', {'text': 'spam'})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(Comment.objects.count(), 0)

    def test_organizer_can_read_comments(self):
        Comment.objects.create(event=self.event, author=self.media1, text='hi')
        self.client.force_authenticate(user=self.org)
        response = self.client.get(f'/api/events/{self.event.id}/comments/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data[0]['author']['username'], 'media1')

    def test_comments_disabled_returns_403(self):
        with mock.patch('events.views.ENABLE_EVENT_CHAT', False):
            self.client.force_authenticate(user=self.org)
            response = self.client.get(f'/api/events/{self.event.id}/comments/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class ParticipantAssignmentTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(username='admin', password=PASSWORD, role='MAIN_ADMIN')
        self.org = User.objects.create_user(username='org', password=PASSWORD, role='ORGANIZER')
        self.media1 = User.objects.create_user(username='media1', password=PASSWORD, role='MEDIA')
        self.media2 = User.objects.create_user(username='media2', password=PASSWORD, role='MEDIA')
        self.event = Event.objects.create(
            title='Assignee', date=timezone.now().date(),
            responsible_person=self.org, status='OPEN',
        )

    def test_assign_participant(self):
        self.client.force_authenticate(user=self.org)
        response = self.client.post(f'/api/events/{self.event.id}/assign_participant/', {
            'user_id': self.media1.id, 'role_id': 3, 'location_id': 7
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.event.refresh_from_db()
        self.assertIn(self.media1, self.event.media_participants.all())
        self.assertEqual(self.event.status, 'IN_PROGRESS')
        details = self.event.participant_details[str(self.media1.id)]
        self.assertEqual(details['role_id'], 3)
        self.assertEqual(details['location_id'], 7)

    def test_assign_participant_ignores_non_numeric_ids(self):
        self.client.force_authenticate(user=self.org)
        self.client.post(f'/api/events/{self.event.id}/assign_participant/', {
            'user_id': self.media1.id, 'role_id': 'javascript:alert(1)'
        })
        self.event.refresh_from_db()
        self.assertIn(self.media1, self.event.media_participants.all())
        self.assertNotIn('role_id', self.event.participant_details[str(self.media1.id)])

    def test_assign_non_media_user_rejected(self):
        self.client.force_authenticate(user=self.org)
        response = self.client.post(f'/api/events/{self.event.id}/assign_participant/', {
            'user_id': self.org.id
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.event.media_participants.count(), 0)

    def test_media_cannot_assign_participant(self):
        self.client.force_authenticate(user=self.media1)
        response = self.client.post(f'/api/events/{self.event.id}/assign_participant/', {
            'user_id': self.media2.id
        })
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_remove_participant_reopens_event(self):
        self.event.media_participants.add(self.media1)
        self.event.status = 'IN_PROGRESS'
        self.event.participant_details = {str(self.media1.id): {'role_id': 1}}
        self.event.save()
        self.client.force_authenticate(user=self.org)
        response = self.client.post(f'/api/events/{self.event.id}/remove_participant/', {
            'user_id': self.media1.id
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.event.refresh_from_db()
        self.assertNotIn(self.media1, self.event.media_participants.all())
        self.assertEqual(self.event.status, 'OPEN')
        self.assertNotIn(str(self.media1.id), self.event.participant_details)

    def test_remove_unknown_user_rejected(self):
        self.client.force_authenticate(user=self.org)
        response = self.client.post(f'/api/events/{self.event.id}/remove_participant/', {'user_id': 424242})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class ExportCsvTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(username='admin', password=PASSWORD, role='MAIN_ADMIN')
        self.org = User.objects.create_user(username='org', password=PASSWORD, role='ORGANIZER')
        self.media1 = User.objects.create_user(username='media1', password=PASSWORD, role='MEDIA')
        self.event = Event.objects.create(
            title='CSV Shoot', date=timezone.now().date(),
            time=None, location='Hall', content_type='PHOTO', required_skill='ANY',
            status='COMPLETED', responsible_person=self.org, description='desc',
            result_link='https://result.example.com',
        )
        self.event.media_participants.add(self.media1)
        self.event.booked_equipment.add(Equipment.objects.create(name='Cam CSV'))

    def _rows(self, response):
        content = response.content.decode('utf-8-sig')
        return list(csv.reader(io.StringIO(content), delimiter=';'))

    def test_export_forbidden_for_organizer(self):
        self.client.force_authenticate(user=self.org)
        response = self.client.get('/api/events/export_csv/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_export_forbidden_for_media(self):
        self.client.force_authenticate(user=self.media1)
        response = self.client.get('/api/events/export_csv/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_export_contains_expected_columns(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get('/api/events/export_csv/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response['Content-Type'], 'text/csv')
        rows = self._rows(response)
        header, data = rows[0], rows[1]
        self.assertEqual(header[0], 'Название съёмки')
        self.assertIn('CSV Shoot', data)
        self.assertIn('org', data)          # organizer
        self.assertIn('media1', data)       # participant
        self.assertIn('Cam CSV', data)      # equipment
        self.assertIn('https://result.example.com', data)

    def test_export_date_range_filter(self):
        from datetime import timedelta
        self.client.force_authenticate(user=self.admin)
        today = timezone.now().date()
        response = self.client.get('/api/events/export_csv/', {
            'start_date': str(today + timedelta(days=1)),
        })
        data_rows = self._rows(response)[1:]
        self.assertEqual(data_rows, [])


class UpdatesFeedTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='watcher', password=PASSWORD, role='MEDIA')

    def test_unauthenticated_get_rejected(self):
        response = self.client.get('/api/updates/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_initial_poll_returns_last_id(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/updates/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('last_id', response.data)

    def test_poll_since_id_returns_new_logs(self):
        marker = UpdateLog.objects.create(entity_type='event', entity_id=1, action='create')
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/updates/', {'since_id': marker.id - 1})
        logs = response.data['logs']
        self.assertEqual(len(logs), 1)
        self.assertEqual(logs[0]['entity_type'], 'event')
        self.assertEqual(response.data['last_id'], marker.id)

    def test_ticket_flow(self):
        self.client.force_authenticate(user=self.user)
        issued = self.client.post('/api/updates/')
        self.assertEqual(issued.status_code, status.HTTP_200_OK)
        self.assertIn('ticket', issued.data)
        self.assertIn('expires_in', issued.data)

        self.client.force_authenticate(user=None)
        polled = self.client.get('/api/updates/', {'ticket': issued.data['ticket']})
        self.assertEqual(polled.status_code, status.HTTP_200_OK)

    def test_invalid_ticket_rejected(self):
        self.client.force_authenticate(user=None)
        response = self.client.get('/api/updates/', {'ticket': 'garbage.token.here'})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class UpdateLogSignalTests(TestCase):
    def setUp(self):
        self.org = User.objects.create_user(username='org', password=PASSWORD, role='ORGANIZER')
        UpdateLog.objects.all().delete()

    def test_event_create_logs_entity(self):
        event = Event.objects.create(
            title='Logged', date=timezone.now().date(),
            responsible_person=self.org, status='OPEN',
        )
        log = UpdateLog.objects.filter(entity_type='event', entity_id=event.id).latest('id')
        self.assertEqual(log.action, 'create')
        self.assertEqual(log.extra_data['title'], 'Logged')
        self.assertEqual(log.extra_data['status'], 'OPEN')

    def test_event_update_logged(self):
        event = Event.objects.create(
            title='First', date=timezone.now().date(), responsible_person=self.org,
        )
        event.title = 'Second'
        event.save()
        log = UpdateLog.objects.filter(entity_type='event', action='update').latest('id')
        self.assertEqual(log.extra_data['title'], 'Second')

    def test_event_delete_logged(self):
        event = Event.objects.create(
            title='Doomed', date=timezone.now().date(), responsible_person=self.org,
        )
        event_id = event.id
        event.delete()
        log = UpdateLog.objects.filter(entity_type='event', entity_id=event_id, action='delete').latest('id')
        self.assertIsNotNone(log)

    def test_loan_entity_type_mapping(self):
        camera = Equipment.objects.create(name='Cam L')
        media = User.objects.create_user(username='m', password=PASSWORD, role='MEDIA')
        EquipmentLoan.objects.create(equipment=camera, user=media, status='ISSUED')
        log = UpdateLog.objects.filter(entity_type='loan').latest('id')
        self.assertEqual(log.action, 'create')
        self.assertEqual(log.extra_data['status'], 'ISSUED')
        self.assertEqual(log.extra_data['user'], 'm')

    def test_user_create_logged_with_role(self):
        User.objects.create_user(username='fresh', password=PASSWORD, role='MEDIA')
        log = UpdateLog.objects.filter(entity_type='user', extra_data__username='fresh').latest('id')
        self.assertEqual(log.action, 'create')
        self.assertEqual(log.extra_data['role'], 'MEDIA')


class EventTemplateAndDirectoryTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(username='admin', password=PASSWORD, role='MAIN_ADMIN')
        self.media = User.objects.create_user(username='media', password=PASSWORD, role='MEDIA')

    def test_media_cannot_create_location(self):
        self.client.force_authenticate(user=self.media)
        response = self.client.post('/api/locations/', {'name': 'Secret Hall'})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_creates_location(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post('/api/locations/', {'name': 'Main Hall'})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_location_name_unique(self):
        self.client.force_authenticate(user=self.admin)
        self.client.post('/api/locations/', {'name': 'Dup Hall'})
        response = self.client.post('/api/locations/', {'name': 'Dup Hall'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_any_authenticated_user_can_read_directories(self):
        self.client.force_authenticate(user=self.media)
        for url in ('/api/locations/', '/api/skills/', '/api/templates/', '/api/event-roles/'):
            self.assertEqual(self.client.get(url).status_code, status.HTTP_200_OK, url)

    def test_media_cannot_create_skill_or_template(self):
        self.client.force_authenticate(user=self.media)
        self.assertEqual(
            self.client.post('/api/skills/', {'name': 'Pro', 'code': 'PRO'}).status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(
            self.client.post('/api/templates/', {'name': 'Tpl'}).status_code,
            status.HTTP_403_FORBIDDEN,
        )
