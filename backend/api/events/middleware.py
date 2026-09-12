"""Self-healing for the csrftoken cookie on cookie-authenticated clients.

The SPA reads `csrftoken` from document.cookie and echoes it in X-CSRFToken
for unsafe methods. If a logged-in client somehow lost that cookie (expired,
cleared for the host, or created before the shared cookie domain was
configured), every POST/PATCH/DELETE would fail with 403 "CSRF Failed" until
re-login, because nothing else re-issues it outside the login views.

This middleware re-issues the csrftoken on safe requests from clients that
present the access cookie but no csrftoken, so such sessions recover on the
next GET (e.g. /api/users/me/ at SPA startup). Clients that hold an unreadable
(stale-domain) csrftoken instead recover via the refresh endpoint, which also
re-issues the cookie — see the SPA's 403-retry in services/api.ts.
"""
import django.middleware.csrf
from django.conf import settings

SAFE_METHODS = ('GET', 'HEAD', 'OPTIONS', 'TRACE')


class EnsureCsrfCookieMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if (
            request.method in SAFE_METHODS
            and settings.JWT_ACCESS_COOKIE in request.COOKIES
            and settings.CSRF_COOKIE_NAME not in request.COOKIES
        ):
            # Generates a secret and flags CSRF_COOKIE_NEEDS_UPDATE so
            # CsrfViewMiddleware (later in the response phase) attaches the
            # csrftoken cookie with the configured domain attributes.
            django.middleware.csrf.get_token(request)

        return self.get_response(request)
