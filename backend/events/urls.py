from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UserViewSet, EventViewSet, RegisterView, InviteCodeViewSet, EquipmentViewSet

router = DefaultRouter()
router.register(r'users', UserViewSet)
router.register(r'events', EventViewSet)
router.register(r'invites', InviteCodeViewSet, basename='invite')
router.register(r'equipment', EquipmentViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('register/', RegisterView.as_view({'post': 'create'}), name='register'),
]