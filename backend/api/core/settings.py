

import os
from pathlib import Path
from dotenv import load_dotenv

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from .env file
load_dotenv(BASE_DIR / '.env')


# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/6.0/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.environ['SECRET_KEY']  # REQUIRED — fail fast if not set

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = os.getenv('DEBUG', 'False').lower() in ('true', '1', 't')

ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')


# Application definition

INSTALLED_APPS = [
    'django_prometheus',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.gis',
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'django_filters',
    'events',
]


MIDDLEWARE = [
    'django_prometheus.middleware.PrometheusBeforeMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'events.middleware.EnsureCsrfCookieMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'django_prometheus.middleware.PrometheusAfterMiddleware',
]

ROOT_URLCONF = 'core.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'core.wsgi.application'


# Database
# https://docs.djangoproject.com/en/6.0/ref/settings/#databases

import sys
if 'test' in sys.argv:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.contrib.gis.db.backends.postgis',
            'NAME': os.getenv('DB_NAME', 'events_db'),
            'USER': os.getenv('DB_USER', 'events_user'),
            'PASSWORD': os.environ['DB_PASSWORD'],  # REQUIRED — fail fast if not set
            'HOST': os.getenv('DB_HOST', 'db'),
            'PORT': os.getenv('DB_PORT', '5432'),
        }
    }


# Password validation
# https://docs.djangoproject.com/en/6.0/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# Internationalization
# https://docs.djangoproject.com/en/6.0/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/6.0/howto/static-files/

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

MEDIA_URL = 'media/'
MEDIA_ROOT = BASE_DIR / 'media'


# Указываем нашу кастомную модель юзера! Без этого не сработает migrate!
AUTH_USER_MODEL = 'events.User'

# Настройки CORS (чтобы React и Flutter могли делать запросы)
CORS_ALLOW_ALL_ORIGINS = os.getenv('CORS_ALLOW_ALL_ORIGINS', 'False').lower() in ('true', '1', 't')  # Secure default: deny all origins unless explicitly enabled
CORS_ALLOWED_ORIGINS = os.getenv('CORS_ALLOWED_ORIGINS', 'https://admin.pivas.su,https://mobile.pivas.su').split(',')
CORS_ALLOW_CREDENTIALS = True  # httpOnly-cookie аутентификация

# Настройки доверенных источников для CSRF (необходимо для Django Admin по HTTPS)
CSRF_TRUSTED_ORIGINS = os.getenv(
    'CSRF_TRUSTED_ORIGINS',
    'https://api.pivas.su,https://admin.pivas.su,https://mobile.pivas.su,http://localhost:5173,http://localhost:8000'
).split(',')

# SECURE_PROXY_SSL_HEADER & USE_X_FORWARDED_HOST
# Критично при работе за Nginx по HTTPS: говорит Django доверять заголовку X-Forwarded-Proto от Nginx.
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
USE_X_FORWARDED_HOST = True

# Настройки Django REST Framework
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'events.authentication.CookieJWTAuthentication',
    ),
    'DEFAULT_FILTER_BACKENDS': (
        'django_filters.rest_framework.DjangoFilterBackend',
    ),
}

# Настройки жизни токенов (опционально)
from datetime import timedelta
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(days=1),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=30),
}

# JWT в httpOnly-cookie: токены недоступны JS, поэтому XSS не может их украсть.
# Frontend ходит с withCredentials; для unsafe-методов отправляет X-CSRFToken.
JWT_AUTH_COOKIE = True
JWT_ACCESS_COOKIE = 'access'
JWT_REFRESH_COOKIE = 'refresh'
JWT_COOKIE_SECURE = os.getenv('JWT_COOKIE_SECURE', str(not DEBUG)).lower() in ('true', '1', 't')
JWT_COOKIE_SAMESITE = os.getenv('JWT_COOKIE_SAMESITE', 'Lax')  # admin/mobile — поддомены одного сайта
CSRF_COOKIE_HTTPONLY = False  # JS читает csrftoken и шлёт его в X-CSRFToken
CSRF_COOKIE_SECURE = JWT_COOKIE_SECURE  # те же условия доставки, что и у auth-cookie

COOKIE_DOMAIN = os.getenv('COOKIE_DOMAIN', '.pivas.su')
if COOKIE_DOMAIN.lower() in ('none', 'false', ''):
    COOKIE_DOMAIN = None

CSRF_COOKIE_DOMAIN = COOKIE_DOMAIN
SESSION_COOKIE_DOMAIN = COOKIE_DOMAIN
JWT_COOKIE_DOMAIN = COOKIE_DOMAIN

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Интеграция с Telegram (None отключает функции бота — код обязан это проверять)
TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN') or None
TELEGRAM_WEBAPP_URL = os.getenv('TELEGRAM_WEBAPP_URL', 'http://localhost:5173')

# Feature Toggles (Переключатели функций)
ENABLE_MULTIPLE_PHOTOGRAPHERS = os.getenv('ENABLE_MULTIPLE_PHOTOGRAPHERS', 'True').lower() in ('true', '1', 't')
ENABLE_STRICT_DEADLINES = os.getenv('ENABLE_STRICT_DEADLINES', 'True').lower() in ('true', '1', 't')
ENABLE_EQUIPMENT_BOOKING = os.getenv('ENABLE_EQUIPMENT_BOOKING', 'True').lower() in ('true', '1', 't')
ENABLE_EVENT_CHAT = os.getenv('ENABLE_EVENT_CHAT', 'True').lower() in ('true', '1', 't')
ENABLE_SKILL_LEVELS = os.getenv('ENABLE_SKILL_LEVELS', 'True').lower() in ('true', '1', 't')
ENABLE_TELEGRAM_BOT = os.getenv('ENABLE_TELEGRAM_BOT', 'True').lower() in ('true', '1', 't')
ENABLE_CSV_REPORTS = os.getenv('ENABLE_CSV_REPORTS', 'True').lower() in ('true', '1', 't')

# Настройки Celery
CELERY_BROKER_URL = os.getenv('CELERY_BROKER_URL', 'redis://redis:6379/0')
CELERY_RESULT_BACKEND = os.getenv('CELERY_RESULT_BACKEND', 'redis://redis:6379/0')
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE
