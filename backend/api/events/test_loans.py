"""Tests for the equipment loan workflow (request -> issue -> return) and
the availability calculation on the Equipment model."""
from datetime import datetime, time, timedelta

from django.test import TestCase
from django.utils import timezone
from django.utils.timezone import make_aware, get_current_timezone
from rest_framework import status
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model

from .models import Equipment, EquipmentLoan, Event
from .tests_utils import random_password

User = get_user_model()

PASSWORD = random_password()


def dt_on(day, hour, minute=0):
    return make_aware(datetime.combine(day, time(hour, minute)), get_current_timezone())


class LoanWorkflowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(username='admin', password=PASSWORD, role='MAIN_ADMIN')
        self.warehouse = User.objects.create_user(
            username='warehouse', password=PASSWORD, role='MEDIA', can_manage_warehouse=True
        )
        self.media1 = User.objects.create_user(username='media1', password=PASSWORD, role='MEDIA')
        self.media2 = User.objects.create_user(username='media2', password=PASSWORD, role='MEDIA')
        self.camera = Equipment.objects.create(name='Camera W', total_quantity=2)
        self.today = timezone.now().date()

    def _create_loan(self, user, equipment, quantity=1, start_h=10, end_h=12):
        self.client.force_authenticate(user=user)
        return self.client.post('/api/loans/', {
            'equipment_id': equipment.id,
            'quantity': quantity,
            'loan_start': f"{self.today}T{start_h:02d}:00:00Z",
            'loan_end': f"{self.today}T{end_h:02d}:00:00Z",
        })

    def test_media_can_create_loan_request(self):
        response = self._create_loan(self.media1, self.camera)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        loan = EquipmentLoan.objects.get(id=response.data['id'])
        self.assertEqual(loan.user, self.media1)
        self.assertEqual(loan.status, 'REQUESTED')
        self.assertEqual(loan.quantity, 1)

    def test_loan_requires_start_before_end(self):
        self.client.force_authenticate(user=self.media1)
        response = self.client.post('/api/loans/', {
            'equipment_id': self.camera.id,
            'quantity': 1,
            'loan_start': f"{self.today}T12:00:00Z",
            'loan_end': f"{self.today}T10:00:00Z",
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_loan_requires_both_datetimes(self):
        self.client.force_authenticate(user=self.media1)
        response = self.client.post('/api/loans/', {'equipment_id': self.camera.id, 'quantity': 1})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_loan_exceeding_quantity_rejected(self):
        response = self._create_loan(self.media1, self.camera, quantity=3)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_overlapping_loan_exceeds_stock(self):
        # Both units of the camera are issued to media1 for 10:00-12:00
        self._create_loan(self.media1, self.camera, quantity=2)
        self.client.force_authenticate(user=self.admin)
        loan = EquipmentLoan.objects.first()
        self.client.post(f'/api/loans/{loan.id}/approve_issue/')
        # media2 wants one more in the same window -> none left
        response = self._create_loan(self.media2, self.camera, quantity=1)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_non_overlapping_loans_both_ok(self):
        response = self._create_loan(self.media1, self.camera, quantity=2, start_h=10, end_h=12)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        response = self._create_loan(self.media2, self.camera, quantity=2, start_h=14, end_h=16)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_user_sees_only_own_loans(self):
        self._create_loan(self.media1, self.camera)
        self.client.force_authenticate(user=self.media2)
        response = self.client.get('/api/loans/')
        self.assertEqual(response.data, [])

    def test_admin_sees_all_loans(self):
        self._create_loan(self.media1, self.camera)
        self.client.force_authenticate(user=self.admin)
        response = self.client.get('/api/loans/')
        self.assertEqual(len(response.data), 1)

    def test_media_cannot_approve_issue(self):
        self._create_loan(self.media1, self.camera)
        loan = EquipmentLoan.objects.first()
        self.client.force_authenticate(user=self.media2)
        response = self.client.post(f'/api/loans/{loan.id}/approve_issue/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_approve_issue_sets_status_and_timestamp(self):
        self._create_loan(self.media1, self.camera)
        loan = EquipmentLoan.objects.first()
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(f'/api/loans/{loan.id}/approve_issue/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        loan.refresh_from_db()
        self.assertEqual(loan.status, 'ISSUED')
        self.assertIsNotNone(loan.issued_at)

    def test_approve_issue_twice_rejected(self):
        self._create_loan(self.media1, self.camera)
        loan = EquipmentLoan.objects.first()
        self.client.force_authenticate(user=self.admin)
        self.client.post(f'/api/loans/{loan.id}/approve_issue/')
        response = self.client.post(f'/api/loans/{loan.id}/approve_issue/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_warehouse_manager_can_approve_issue(self):
        self._create_loan(self.media1, self.camera)
        loan = EquipmentLoan.objects.first()
        self.client.force_authenticate(user=self.warehouse)
        response = self.client.post(f'/api/loans/{loan.id}/approve_issue/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_reject_request(self):
        self._create_loan(self.media1, self.camera)
        loan = EquipmentLoan.objects.first()
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(f'/api/loans/{loan.id}/reject_request/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        loan.refresh_from_db()
        self.assertEqual(loan.status, 'REJECTED')

    def test_reject_non_requested_rejected(self):
        loan = EquipmentLoan.objects.create(
            equipment=self.camera, user=self.media1, status='ISSUED'
        )
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(f'/api/loans/{loan.id}/reject_request/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_request_return_by_owner(self):
        loan = EquipmentLoan.objects.create(
            equipment=self.camera, user=self.media1, status='ISSUED'
        )
        self.client.force_authenticate(user=self.media1)
        response = self.client.post(f'/api/loans/{loan.id}/request_return/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        loan.refresh_from_db()
        self.assertEqual(loan.status, 'RETURN_REQUESTED')

    def test_request_return_of_foreign_loan_forbidden(self):
        loan = EquipmentLoan.objects.create(
            equipment=self.camera, user=self.media1, status='ISSUED'
        )
        self.client.force_authenticate(user=self.media2)
        # media2's queryset only contains its own loans, so the foreign loan
        # is invisible (404) rather than merely forbidden.
        response = self.client.post(f'/api/loans/{loan.id}/request_return/')
        self.assertIn(response.status_code, (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND))

    def test_request_return_of_requested_loan_rejected(self):
        loan = EquipmentLoan.objects.create(
            equipment=self.camera, user=self.media1, status='REQUESTED'
        )
        self.client.force_authenticate(user=self.media1)
        response = self.client.post(f'/api/loans/{loan.id}/request_return/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_approve_return_full_cycle(self):
        loan = EquipmentLoan.objects.create(
            equipment=self.camera, user=self.media1, status='RETURN_REQUESTED'
        )
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(f'/api/loans/{loan.id}/approve_return/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        loan.refresh_from_db()
        self.assertEqual(loan.status, 'RETURNED')
        self.assertIsNotNone(loan.returned_at)

    def test_media_cannot_approve_return(self):
        loan = EquipmentLoan.objects.create(
            equipment=self.camera, user=self.media1, status='ISSUED'
        )
        self.client.force_authenticate(user=self.media2)
        response = self.client.post(f'/api/loans/{loan.id}/approve_return/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_returned_loan_frees_stock(self):
        self._create_loan(self.media1, self.camera, quantity=2)
        self.client.force_authenticate(user=self.admin)
        loan = EquipmentLoan.objects.first()
        self.client.post(f'/api/loans/{loan.id}/approve_issue/')
        # Now the whole stock is out; a new overlapping request fails...
        self.assertEqual(self._create_loan(self.media2, self.camera, quantity=1).status_code,
                         status.HTTP_400_BAD_REQUEST)
        # ...until it is returned
        loan.status = 'RETURNED'
        loan.save()
        response = self._create_loan(self.media2, self.camera, quantity=1)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)


class EquipmentAvailabilityTests(TestCase):
    """Unit tests for Equipment.available_quantity / get_available_quantity_at."""

    def setUp(self):
        self.user = User.objects.create_user(username='u1', password=PASSWORD, role='MEDIA')
        self.camera = Equipment.objects.create(name='Cam', total_quantity=2)
        self.today = timezone.now().date()
        self.start = dt_on(self.today, 10)
        self.end = dt_on(self.today, 12)

    def _loan(self, qty=1, status_name='ISSUED', start=None, end=None, event=None):
        return EquipmentLoan.objects.create(
            equipment=self.camera, user=self.user, quantity=qty,
            status=status_name, event=event,
            loan_start=start or self.start, loan_end=end or self.end,
        )

    def test_available_quantity_subtracts_issued(self):
        self._loan(qty=1)
        self.assertEqual(self.camera.available_quantity, 1)

    def test_available_quantity_counts_return_requested(self):
        self._loan(qty=2, status_name='RETURN_REQUESTED')
        self.assertEqual(self.camera.available_quantity, 0)

    def test_available_quantity_ignores_returned_and_rejected(self):
        self._loan(status_name='RETURNED')
        self._loan(status_name='REJECTED')
        self.assertEqual(self.camera.available_quantity, 2)

    def test_available_quantity_never_negative(self):
        self.camera.total_quantity = 1
        self.camera.save()
        self._loan(qty=2)
        self.assertEqual(self.camera.available_quantity, 0)

    def test_no_intervals_returns_full_stock(self):
        self.assertEqual(self.camera.get_available_quantity_at(self.start, self.end), 2)

    def test_overlapping_loan_reduces_availability(self):
        self._loan(qty=1)
        self.assertEqual(self.camera.get_available_quantity_at(self.start, self.end), 1)

    def test_touching_intervals_do_not_overlap(self):
        self._loan(start=self.start, end=self.end)
        after = self.camera.get_available_quantity_at(self.end, dt_on(self.today, 14))
        self.assertEqual(after, 2)

    def test_exclude_loan_id(self):
        loan = self._loan(qty=1)
        self.assertEqual(
            self.camera.get_available_quantity_at(self.start, self.end, exclude_loan_id=loan.id),
            2,
        )

    def test_overlapping_open_event_reduces_availability(self):
        event = Event.objects.create(
            title='Shoot', date=self.today, time=time(10, 0), end_time=time(12, 0),
            responsible_person=self.user, status='OPEN',
        )
        event.booked_equipment.add(self.camera)
        self.assertEqual(self.camera.get_available_quantity_at(self.start, self.end), 1)

    def test_pending_event_does_not_block(self):
        event = Event.objects.create(
            title='Maybe', date=self.today, time=time(10, 0), end_time=time(12, 0),
            responsible_person=self.user, status='PENDING',
        )
        event.booked_equipment.add(self.camera)
        self.assertEqual(self.camera.get_available_quantity_at(self.start, self.end), 2)

    def test_loan_on_event_excluded_event_not_double_counted(self):
        event = Event.objects.create(
            title='Shoot', date=self.today, time=time(10, 0), end_time=time(12, 0),
            responsible_person=self.user, status='OPEN',
        )
        event.booked_equipment.add(self.camera)
        self._loan(qty=1, event=event)  # the loan that covers this event
        # 1 taken by the loan; the event itself must not be counted again
        self.assertEqual(self.camera.get_available_quantity_at(self.start, self.end), 1)

    def test_event_without_end_time_defaults_to_two_hours(self):
        event = Event.objects.create(
            title='Short', date=self.today, time=time(10, 0),
            responsible_person=self.user, status='OPEN',
        )
        event.booked_equipment.add(self.camera)
        # 11:30-12:30 overlaps the default 10:00-12:00 window by 30 minutes
        busy = self.camera.get_available_quantity_at(
            dt_on(self.today, 11, 30), dt_on(self.today, 12, 30)
        )
        self.assertEqual(busy, 1)

    def test_quantity_aggregation_across_loans(self):
        self._loan(qty=1, start=dt_on(self.today, 9), end=dt_on(self.today, 11))
        self._loan(qty=2, start=dt_on(self.today, 10), end=dt_on(self.today, 13))
        # Peak concurrent demand between 10:00 and 11:00 is 3 > total 2
        self.assertEqual(
            self.camera.get_available_quantity_at(dt_on(self.today, 9), dt_on(self.today, 13)), 0
        )
