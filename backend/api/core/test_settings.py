"""Settings for local test runs: no GDAL/PostGIS, SQLite in-memory.

The production settings require a real SECRET_KEY/DB_PASSWORD and the
django.contrib.gis app (which needs system GDAL libs). None of that is
relevant to the events app, which uses no GIS fields.
"""
import os
os.environ.setdefault('SECRET_KEY', 'test-secret-key-not-for-production-0123456789')
os.environ.setdefault('DB_PASSWORD', 'test')

from core.settings import *  # noqa: F401,F403

INSTALLED_APPS = [app for app in INSTALLED_APPS if app != 'django.contrib.gis']

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
}

# Speed up tests: skip password hashing cost
PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']

# Telegram notifications must not hit the network during tests
TELEGRAM_BOT_TOKEN = None
ENABLE_TELEGRAM_BOT = False

# The update-log signal publishes to Redis; point it at localhost so failed
# connections are instant instead of waiting on DNS for the "redis" hostname.
os.environ['REDIS_HOST'] = '127.0.0.1'
