from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from events.auth_views import CookieTokenObtainPairView, CookieTokenRefreshView, logout_view

urlpatterns = [
    path('admin/', admin.site.urls),
    # Эндпоинты для логина (JWT в httpOnly-cookie)
    path('api/token/', CookieTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', CookieTokenRefreshView.as_view(), name='token_refresh'),
    path('api/token/logout/', logout_view, name='token_logout'),
    # Подключаем роуты нашего приложения
    path('api/', include('events.urls')),
    path('', include('django_prometheus.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)