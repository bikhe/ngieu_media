from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    UserViewSet, EventViewSet, RegisterView, InviteCodeViewSet, EquipmentViewSet,
    TelegramAuthView, TelegramRegisterView, TelegramLinkView, EquipmentLoanViewSet,
    UpdatesView, SkillViewSet, EventTemplateViewSet, LocationViewSet, EventRoleViewSet
)

router = DefaultRouter()
router.register(r'users', UserViewSet)
router.register(r'events', EventViewSet)
router.register(r'invites', InviteCodeViewSet, basename='invite')
router.register(r'equipment', EquipmentViewSet)
router.register(r'loans', EquipmentLoanViewSet)
router.register(r'skills', SkillViewSet)
router.register(r'templates', EventTemplateViewSet)
router.register(r'locations', LocationViewSet)
router.register(r'event-roles', EventRoleViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('register/', RegisterView.as_view({'post': 'create'}), name='register'),
    path('telegram/auth/', TelegramAuthView.as_view(), name='telegram_auth'),
    path('telegram/register/', TelegramRegisterView.as_view(), name='telegram_register'),
    path('telegram/link/', TelegramLinkView.as_view(), name='telegram_link'),
    path('updates/', UpdatesView.as_view(), name='updates'),
]