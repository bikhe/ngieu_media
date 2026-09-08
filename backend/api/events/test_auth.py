"""Tests for registration, invite codes, profile management, password change
and the httpOnly-cookie JWT flow."""
import time
from unittest import mock

from django.test import TestCase
from django.utils.crypto import get_random_string
from rest_framework import status
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model

from .models import InviteCode
from .tests_utils import make_telegram_init_data, random_password

User = get_user_model()

PASSWORD = random_password()
NEW_PASSWORD = random_password()


class RegistrationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.invite = InviteCode.objects.create(code='ORG456', role='ORGANIZER')

    def test_register_invalid_invite_code(self):
        response = self.client.post('/api/register/', {
            'username': 'newcomer', 'password': PASSWORD, 'invite_code': 'NOPE'
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(username='newcomer').exists())

    def test_register_used_invite_code(self):
        self.invite.is_used = True
        self.invite.save()
        response = self.client.post('/api/register/', {
            'username': 'newcomer', 'password': PASSWORD, 'invite_code': 'ORG456'
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_missing_username_or_password(self):
        response = self.client.post('/api/register/', {'invite_code': 'ORG456'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_duplicate_username(self):
        User.objects.create_user(username='taken', password=PASSWORD)
        response = self.client.post('/api/register/', {
            'username': 'taken', 'password': PASSWORD, 'invite_code': 'ORG456'
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_weak_password_rejected(self):
        response = self.client.post('/api/register/', {
            'username': 'weakling', 'password': '123', 'invite_code': 'ORG456'
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(username='weakling').exists())
        # The invite must stay unused after a failed registration
        self.invite.refresh_from_db()
        self.assertFalse(self.invite.is_used)

    def test_register_assigns_invite_role(self):
        media_invite = InviteCode.objects.create(code='MEDIA789', role='MEDIA')
        response = self.client.post('/api/register/', {
            'username': 'media_new', 'password': PASSWORD, 'invite_code': 'MEDIA789'
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user = User.objects.get(username='media_new')
        self.assertEqual(user.role, 'MEDIA')


class InviteCodeTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(username='admin', password=PASSWORD, role='MAIN_ADMIN')
        self.org = User.objects.create_user(username='org', password=PASSWORD, role='ORGANIZER')

    def test_only_admin_can_create_invite(self):
        self.client.force_authenticate(user=self.org)
        response = self.client.post('/api/invites/', {'role': 'MEDIA'})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_creates_invite_with_valid_role(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post('/api/invites/', {'role': 'MEDIA'})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        code = response.data['code']
        invite = InviteCode.objects.get(code=code)
        self.assertEqual(invite.role, 'MEDIA')
        self.assertFalse(invite.is_used)

    def test_admin_cannot_create_invite_with_invalid_role(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post('/api/invites/', {'role': 'MAIN_ADMIN'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_admin_lists_only_unused_invites(self):
        InviteCode.objects.create(code='FRESH1', role='MEDIA')
        InviteCode.objects.create(code='USED01', role='MEDIA', is_used=True)
        self.client.force_authenticate(user=self.admin)
        response = self.client.get('/api/invites/')
        codes = [i['code'] for i in response.data]
        self.assertIn('FRESH1', codes)
        self.assertNotIn('USED01', codes)

    def test_non_admin_sees_no_invites(self):
        InviteCode.objects.create(code='FRESH2', role='MEDIA')
        self.client.force_authenticate(user=self.org)
        response = self.client.get('/api/invites/')
        self.assertEqual(response.data, [])


class CookieTokenFlowTests(TestCase):
    def setUp(self):
        self.client = APIClient(enforce_csrf_checks=True)
        self.user = User.objects.create_user(username='cookieman', password=PASSWORD)

    def test_login_sets_httponly_cookies_and_hides_tokens(self):
        response = self.client.post('/api/token/', {'username': 'cookieman', 'password': PASSWORD})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn('access', response.data)
        self.assertNotIn('refresh', response.data)
        self.assertEqual(response.data['status'], 'ok')
        access_cookie = response.cookies['access']
        refresh_cookie = response.cookies['refresh']
        self.assertTrue(access_cookie['httponly'])
        self.assertTrue(refresh_cookie['httponly'])

    def test_login_wrong_password(self):
        response = self.client.post('/api/token/', {'username': 'cookieman', 'password': get_random_string(16)})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_refresh_via_cookie(self):
        self.client.post('/api/token/', {'username': 'cookieman', 'password': PASSWORD})
        response = self.client.post('/api/token/refresh/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'ok')
        self.assertIn('access', response.cookies)

    def test_refresh_without_token_rejected(self):
        response = self.client.post('/api/token/refresh/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_logout_clears_cookies(self):
        self.client.post('/api/token/', {'username': 'cookieman', 'password': PASSWORD})
        # logout_view is a plain Django view with CSRF protection; the test
        # client skips it only when enforce_csrf_checks is off.
        client = APIClient()
        response = client.post('/api/token/logout/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # delete_cookie marks the cookie for removal
        self.assertEqual(response.cookies['access']['max-age'], 0)
        self.assertEqual(response.cookies['refresh']['max-age'], 0)

    def test_cookie_authenticated_request(self):
        self.client.post('/api/token/', {'username': 'cookieman', 'password': PASSWORD})
        response = self.client.get('/api/users/me/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['username'], 'cookieman')


class ProfileAndPasswordTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='profiler', password=PASSWORD)

    def test_me_post_updates_names_only(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post('/api/users/me/', {'first_name': 'Anna', 'last_name': 'Petrova'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, 'Anna')
        self.assertEqual(self.user.last_name, 'Petrova')

    def test_change_password_success(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post('/api/users/change_password/', {
            'old_password': PASSWORD, 'new_password': NEW_PASSWORD
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(NEW_PASSWORD))

    def test_change_password_missing_new(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post('/api/users/change_password/', {'old_password': PASSWORD})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_change_password_missing_old(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post('/api/users/change_password/', {'new_password': NEW_PASSWORD})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_change_password_wrong_old(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post('/api/users/change_password/', {
            'old_password': get_random_string(16), 'new_password': NEW_PASSWORD
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(PASSWORD))

    def test_change_password_weak_new(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post('/api/users/change_password/', {
            'old_password': PASSWORD, 'new_password': '123'
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(PASSWORD))


class SuperuserManagerTests(TestCase):
    """create_superuser must imply MAIN_ADMIN and warehouse/approve flags."""

    def test_superuser_gets_main_admin_role_and_flags(self):
        admin = User.objects.create_superuser(username='boss', password=PASSWORD)
        self.assertEqual(admin.role, 'MAIN_ADMIN')
        self.assertTrue(admin.can_approve_events)
        self.assertTrue(admin.can_manage_warehouse)
        self.assertTrue(admin.can_view_all_events)
        self.assertTrue(admin.is_superuser)

    def test_create_user_defaults_to_organizer(self):
        user = User.objects.create_user(username='plain', password=PASSWORD)
        self.assertEqual(user.role, 'ORGANIZER')
        self.assertFalse(user.can_approve_events)


class TelegramAuthTests(TestCase):
    """Telegram views use a module-level token read from settings, so patch it."""

    BOT_TOKEN = get_random_string(20) + ':TESTTOKEN'

    def setUp(self):
        self.client = APIClient()

    def test_telegram_auth_missing_init_data(self):
        with mock.patch('events.views.TELEGRAM_BOT_TOKEN', self.BOT_TOKEN):
            response = self.client.post('/api/telegram/auth/', {})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_telegram_auth_invalid_signature(self):
        with mock.patch('events.views.TELEGRAM_BOT_TOKEN', self.BOT_TOKEN):
            response = self.client.post('/api/telegram/auth/', {'init_data': 'auth_date=1&hash=bad'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_telegram_auth_unregistered_user(self):
        init_data = make_telegram_init_data(424242, self.BOT_TOKEN)
        with mock.patch('events.views.TELEGRAM_BOT_TOKEN', self.BOT_TOKEN):
            response = self.client.post('/api/telegram/auth/', {'init_data': init_data})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(response.data['error'], 'User not registered')

    def test_telegram_auth_registered_user_gets_cookies(self):
        user = User.objects.create_user(username='tguser', password=PASSWORD, telegram_id='777')
        init_data = make_telegram_init_data(777, self.BOT_TOKEN)
        with mock.patch('events.views.TELEGRAM_BOT_TOKEN', self.BOT_TOKEN):
            response = self.client.post('/api/telegram/auth/', {'init_data': init_data})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['user']['id'], user.id)
        self.assertIn('access', response.cookies)
        self.assertIn('refresh', response.cookies)

    def test_telegram_register_success(self):
        InviteCode.objects.create(code='TGINV1', role='MEDIA')
        init_data = make_telegram_init_data(555, self.BOT_TOKEN)
        with mock.patch('events.views.TELEGRAM_BOT_TOKEN', self.BOT_TOKEN):
            response = self.client.post('/api/telegram/register/', {
                'init_data': init_data, 'invite_code': 'TGINV1', 'username': 'tg_new'
            })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user = User.objects.get(username='tg_new')
        self.assertEqual(user.role, 'MEDIA')
        self.assertEqual(user.telegram_id, '555')
        self.assertTrue(InviteCode.objects.get(code='TGINV1').is_used)
        self.assertIn('access', response.cookies)

    def test_telegram_register_duplicate_telegram_id(self):
        User.objects.create_user(username='existing', password=PASSWORD, telegram_id='555')
        InviteCode.objects.create(code='TGINV2', role='MEDIA')
        init_data = make_telegram_init_data(555, self.BOT_TOKEN)
        with mock.patch('events.views.TELEGRAM_BOT_TOKEN', self.BOT_TOKEN):
            response = self.client.post('/api/telegram/register/', {
                'init_data': init_data, 'invite_code': 'TGINV2', 'username': 'another'
            })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_telegram_register_missing_fields(self):
        response = self.client.post('/api/telegram/register/', {'init_data': 'x'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_telegram_link_success(self):
        user = User.objects.create_user(username='linkme', password=PASSWORD)
        self.client.force_authenticate(user=user)
        init_data = make_telegram_init_data(888, self.BOT_TOKEN)
        with mock.patch('events.views.TELEGRAM_BOT_TOKEN', self.BOT_TOKEN):
            response = self.client.post('/api/telegram/link/', {'init_data': init_data})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertEqual(user.telegram_id, '888')

    def test_telegram_link_conflict_with_other_user(self):
        User.objects.create_user(username='owner', password=PASSWORD, telegram_id='999')
        user = User.objects.create_user(username='attacker', password=PASSWORD)
        self.client.force_authenticate(user=user)
        init_data = make_telegram_init_data(999, self.BOT_TOKEN)
        with mock.patch('events.views.TELEGRAM_BOT_TOKEN', self.BOT_TOKEN):
            response = self.client.post('/api/telegram/link/', {'init_data': init_data})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        user.refresh_from_db()
        self.assertIsNone(user.telegram_id)


class TelegramInitDataVerificationTests(TestCase):
    """Unit tests for the signature-verification helper itself."""

    BOT_TOKEN = get_random_string(20) + ':UNITTEST'

    def test_valid_signature_accepted(self):
        from .views import verify_telegram_init_data
        init_data = make_telegram_init_data(42, self.BOT_TOKEN)
        user_data = verify_telegram_init_data(init_data, self.BOT_TOKEN)
        self.assertIsNotNone(user_data)
        self.assertEqual(user_data['id'], 42)

    def test_tampered_payload_rejected(self):
        from .views import verify_telegram_init_data
        init_data = make_telegram_init_data(42, self.BOT_TOKEN)
        tampered = init_data.replace('Test', 'Hacked')
        self.assertIsNone(verify_telegram_init_data(tampered, self.BOT_TOKEN))

    def test_wrong_bot_token_rejected(self):
        from .views import verify_telegram_init_data
        init_data = make_telegram_init_data(42, self.BOT_TOKEN)
        self.assertIsNone(verify_telegram_init_data(init_data, get_random_string(20) + ':OTHERTOKEN'))

    def test_missing_hash_rejected(self):
        from .views import verify_telegram_init_data
        self.assertIsNone(verify_telegram_init_data('auth_date=1&query_id=X', self.BOT_TOKEN))

    def test_expired_auth_date_rejected(self):
        from .views import verify_telegram_init_data
        stale = int(time.time()) - 86401
        init_data = make_telegram_init_data(42, self.BOT_TOKEN, auth_date=stale)
        self.assertIsNone(verify_telegram_init_data(init_data, self.BOT_TOKEN))

    def test_empty_inputs_rejected(self):
        from .views import verify_telegram_init_data
        self.assertIsNone(verify_telegram_init_data('', self.BOT_TOKEN))
        self.assertIsNone(verify_telegram_init_data('auth_date=1', ''))
