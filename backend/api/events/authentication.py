"""Cookie-based JWT authentication.

Tokens are delivered in httpOnly cookies instead of localStorage so that a
successful XSS cannot exfiltrate long-lived credentials. Cookie-authenticated
unsafe requests (POST/PUT/PATCH/DELETE) are additionally protected with
Django's CSRF machinery: the frontend reads the csrftoken cookie and echoes
it in the X-CSRFToken header.
"""
from django.conf import settings
from django.middleware.csrf import CsrfViewMiddleware
from rest_framework.exceptions import PermissionDenied
from rest_framework_simplejwt.authentication import JWTAuthentication


def _dummy_get_response(request):
    return None


class CookieJWTAuthentication(JWTAuthentication):
    """Authenticates via Authorization header (B2B clients, SSE broker) or
    via the httpOnly access cookie (browsers)."""

    def authenticate(self, request):
        header = self.get_header(request)
        if header is not None:
            return super().authenticate(request)

        raw_token = request.COOKIES.get(settings.JWT_ACCESS_COOKIE)
        if raw_token is None:
            return None

        validated_token = self.get_validated_token(raw_token)
        user = self.get_user(validated_token)

        if request.method in ('POST', 'PUT', 'PATCH', 'DELETE'):
            self._enforce_csrf(request)

        return user, validated_token

    def _enforce_csrf(self, request):
        # Same approach as DRF's SessionAuthentication.enforce_csrf.
        check = CsrfViewMiddleware(_dummy_get_response)
        check.process_request(request)
        rejection_reason = check.process_view(request, None, (), {})
        if rejection_reason:
            raise PermissionDenied(f'CSRF Failed: {rejection_reason}')


def set_auth_cookies(response, access: str, refresh: str) -> None:
    """Attach httpOnly access/refresh cookies to a login/refresh response."""
    secure = getattr(settings, 'JWT_COOKIE_SECURE', False)
    samesite = getattr(settings, 'JWT_COOKIE_SAMESITE', 'Lax')
    access_lifetime = int(settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds())
    refresh_lifetime = int(settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds())

    response.set_cookie(
        settings.JWT_ACCESS_COOKIE, access,
        max_age=access_lifetime, httponly=True, secure=secure, samesite=samesite, path='/', domain=getattr(settings, 'JWT_COOKIE_DOMAIN', None)
    )
    response.set_cookie(
        settings.JWT_REFRESH_COOKIE, refresh,
        max_age=refresh_lifetime, httponly=True, secure=secure, samesite=samesite, path='/', domain=getattr(settings, 'JWT_COOKIE_DOMAIN', None)
    )


def clear_auth_cookies(response) -> None:
    """Remove auth cookies (logout / failed refresh)."""
    response.delete_cookie(settings.JWT_ACCESS_COOKIE, path='/', domain=getattr(settings, 'JWT_COOKIE_DOMAIN', None))
    response.delete_cookie(settings.JWT_REFRESH_COOKIE, path='/', domain=getattr(settings, 'JWT_COOKIE_DOMAIN', None))
