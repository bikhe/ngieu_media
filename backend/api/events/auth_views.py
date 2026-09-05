"""Login/refresh/logout views that deliver JWTs as httpOnly cookies.

The token values are never returned in the response body, so no JavaScript
(legitimate or malicious) ever holds a long-lived credential.
"""
import django.middleware.csrf
from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from rest_framework.response import Response
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .authentication import clear_auth_cookies, set_auth_cookies


def _ensure_csrf_cookie(request) -> None:
    """Have CsrfViewMiddleware attach a csrftoken cookie on the way out so the
    SPA can echo it in X-CSRFToken for unsafe methods."""
    request.META['CSRF_COOKIE_NEEDS_UPDATE'] = True
    django.middleware.csrf.get_token(request)


class CookieTokenObtainPairView(TokenObtainPairView):
    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200 and 'access' in response.data:
            set_auth_cookies(response, response.data['access'], response.data['refresh'])
            del response.data['access']
            del response.data['refresh']
            response.data['status'] = 'ok'
            _ensure_csrf_cookie(request)
        return response


class CookieTokenRefreshView(TokenRefreshView):
    def post(self, request, *args, **kwargs):
        # The refresh token normally lives in the httpOnly cookie; fall back to
        # the request body for non-browser clients.
        refresh = request.COOKIES.get(settings.JWT_REFRESH_COOKIE) or request.data.get('refresh')
        if not refresh:
            raise InvalidToken('No refresh token provided')

        serializer = self.get_serializer(data={'refresh': refresh})
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as e:
            # Refresh expired/revoked: drop the cookies so the browser stops
            # retrying and gets sent to the login screen.
            response = Response({'detail': e.args[0]}, status=401)
            clear_auth_cookies(response)
            return response

        result = serializer.validated_data
        response = Response({'status': 'ok'})
        response.set_cookie(
            settings.JWT_ACCESS_COOKIE, result['access'],
            max_age=int(settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds()),
            httponly=True,
            secure=getattr(settings, 'JWT_COOKIE_SECURE', False),
            samesite=getattr(settings, 'JWT_COOKIE_SAMESITE', 'Lax'),
            path='/',
        )
        return response


@require_POST
def logout_view(request):
    """POST /api/token/logout/ — clears the auth cookies.

    A plain Django view: CsrfViewMiddleware validates the X-CSRFToken header
    for this POST, and clearing cookies works even when they already expired.
    """
    response = JsonResponse({'status': 'ok'})
    clear_auth_cookies(response)
    return response
