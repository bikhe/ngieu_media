"""Shared helpers for the events test suite."""
import hashlib
import hmac
import json
import time
import urllib.parse

from django.utils.crypto import get_random_string


def random_password():
    # Random so it never matches CommonPasswordValidator and no literal
    # credentials end up in the source.
    return get_random_string(20) + 'x9'


def make_telegram_init_data(user_id: int, bot_token: str, auth_date: int | None = None) -> str:
    """Build a correctly signed Telegram WebApp init_data string."""
    params = {
        'auth_date': str(int(time.time()) if auth_date is None else auth_date),
        'query_id': 'AAFtest',
        'user': json.dumps({'id': user_id, 'first_name': 'Test'}, separators=(',', ':')),
    }
    data_check_string = '\n'.join(f'{k}={params[k]}' for k in sorted(params))
    secret_key = hmac.new(b'WebAppData', bot_token.encode(), hashlib.sha256).digest()
    params['hash'] = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
    return urllib.parse.urlencode(params)
