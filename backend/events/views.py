import csv
import requests
from django.http import HttpResponse
from django.utils.crypto import get_random_string
from django.utils import timezone
from django.db import transaction
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django_filters.rest_framework import DjangoFilterBackend
from .models import *
from .serializers import *

ENABLE_MULTIPLE_PHOTOGRAPHERS = True 
ENABLE_STRICT_DEADLINES = True       
ENABLE_EQUIPMENT_BOOKING = True      
ENABLE_EVENT_CHAT = True             
ENABLE_SKILL_LEVELS = True       
ENABLE_TELEGRAM_BOT = True       
ENABLE_CSV_REPORTS = True

TELEGRAM_BOT_TOKEN = "ТВОЙ_ТОКЕН_ИЗ_BOTFATHER" 

def send_tg_notification(chat_id, text):
    if not ENABLE_TELEGRAM_BOT or not chat_id or not TELEGRAM_BOT_TOKEN: return
    try:
        requests.post(f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage", json={"chat_id": chat_id, "text": text}, timeout=2)
    except: pass

class UserViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['GET', 'POST'])
    def me(self, request):
        if request.method == 'POST':
            user = request.user
            user.first_name = request.data.get('first_name', user.first_name)
            user.last_name = request.data.get('last_name', user.last_name)
            user.telegram_id = request.data.get('telegram_id', user.telegram_id)
            user.save()
            return Response({'status': 'Профиль обновлен'})

        serializer = self.get_serializer(request.user)
        data = serializer.data
        data['features'] = {
            'multiple_photographers': ENABLE_MULTIPLE_PHOTOGRAPHERS, 'strict_deadlines': ENABLE_STRICT_DEADLINES,
            'equipment_booking': ENABLE_EQUIPMENT_BOOKING, 'event_chat': ENABLE_EVENT_CHAT,
            'skill_levels': ENABLE_SKILL_LEVELS, 'telegram_bot': ENABLE_TELEGRAM_BOT, 'csv_reports': ENABLE_CSV_REPORTS
        }
        return Response(data)

class EquipmentViewSet(viewsets.ModelViewSet):
    queryset = Equipment.objects.all()
    serializer_class = EquipmentSerializer
    permission_classes = [IsAuthenticated]

class EventViewSet(viewsets.ModelViewSet):
    queryset = Event.objects.all()
    serializer_class = EventSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status']

    def perform_create(self, serializer): serializer.save(responsible_person=self.request.user)

    def get_queryset(self):
        user = self.request.user
        qs = Event.objects.all()
        if ENABLE_STRICT_DEADLINES:
            qs.filter(status='IN_PROGRESS', deadline__lt=timezone.now()).update(status='OVERDUE')
        if user.role == 'MAIN_ADMIN': return qs
        elif user.role == 'MEDIA': return qs.exclude(status__in=['PENDING', 'REJECTED'])
        return qs.filter(responsible_person=user)

    @action(detail=False, methods=['GET'])
    def export_csv(self, request):
        if not ENABLE_CSV_REPORTS or request.user.role != 'MAIN_ADMIN': return Response(status=403)
        qs = self.get_queryset().order_by('-date')
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="report.csv"'
        response.write('\ufeff'.encode('utf8'))
        writer = csv.writer(response, delimiter=';')
        writer.writerow(['Событие', 'Дата', 'Орг', 'СМИ', 'Техника', 'Материалы'])
        for e in qs:
            writer.writerow([
                e.title, e.date.strftime("%d.%m.%Y") if e.date else "", e.responsible_person.username,
                ", ".join([u.username for u in e.media_participants.all()]),
                ", ".join([eq.name for eq in e.booked_equipment.all()]), e.result_link or ""
            ])
        return response

    @action(detail=False, methods=['get'])
    def my_shoots(self, request):
        return Response(self.get_serializer(self.get_queryset().filter(media_participants=request.user).order_by('-date'), many=True).data)

    @action(detail=True, methods=['post'])
    def take_task(self, request, pk=None):
        with transaction.atomic():
            try: event = Event.objects.select_for_update().get(pk=pk)
            except: return Response({'error': 'Не найдено'}, status=404)

            if ENABLE_SKILL_LEVELS and event.required_skill != 'ANY' and request.user.skill_level not in [event.required_skill, 'PRO']:
                return Response({'error': 'Нужен VIP доступ'}, status=403)

            max_p = event.max_participants if ENABLE_MULTIPLE_PHOTOGRAPHERS else 1
            if request.user in event.media_participants.all(): return Response({'error': 'Уже взято'}, status=400)
            if event.media_participants.count() >= max_p or event.status != 'OPEN': return Response({'error': 'Места заняты'}, status=400)

            event.media_participants.add(request.user)
            if ENABLE_EQUIPMENT_BOOKING:
                for e_id in request.data.get('equipment_ids', []):
                    try: event.booked_equipment.add(Equipment.objects.get(id=e_id))
                    except: pass
            if event.media_participants.count() >= max_p: event.status = 'IN_PROGRESS'
            event.save()
            if event.responsible_person.telegram_id: send_tg_notification(event.responsible_person.telegram_id, f"✅ Взяли вашу съемку '{event.title}'!")
        return Response({'status': 'Успех'})

    @action(detail=True, methods=['post'])
    def submit_work(self, request, pk=None):
        event = self.get_object()
        new_link = request.data.get('result_link')
        if not new_link: return Response(status=400)
        event.result_link = ((event.result_link or "") + " " + new_link).strip()
        event.status = 'COMPLETED'
        event.save()
        if event.responsible_person.telegram_id: send_tg_notification(event.responsible_person.telegram_id, f"🎉 Сдали работу '{event.title}': {new_link}")
        return Response({'status': 'ok'})

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        event = self.get_object(); event.status = 'OPEN'; event.save(); return Response({'status': 'ok'})

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        event = self.get_object(); event.status = 'REJECTED'; event.save(); return Response({'status': 'ok'})

    @action(detail=True, methods=['get', 'post'])
    def comments(self, request, pk=None):
        if not ENABLE_EVENT_CHAT: return Response(status=403)
        event = self.get_object()
        if request.method == 'GET': return Response(CommentSerializer(event.comments.all(), many=True).data)
        comment = Comment.objects.create(event=event, author=request.user, text=request.data.get('text', ''))
        if request.user != event.responsible_person and event.responsible_person.telegram_id:
            send_tg_notification(event.responsible_person.telegram_id, f"💬 Новое сообщение в '{event.title}':\n{comment.text}")
        return Response(CommentSerializer(comment).data, status=201)

class RegisterView(viewsets.ViewSet):
    permission_classes = [AllowAny]
    def create(self, request):
        try: invite = InviteCode.objects.get(code=request.data.get('invite_code'), is_used=False)
        except: return Response({'error': 'Неверный код'}, status=400)
        User.objects.create_user(username=request.data.get('username'), password=request.data.get('password'), role='ORGANIZER')
        invite.is_used = True; invite.save()
        return Response({'status': 'ok'})

class InviteCodeViewSet(viewsets.ModelViewSet):
    serializer_class = InviteCodeSerializer
    permission_classes = [IsAuthenticated]
    def get_queryset(self): return InviteCode.objects.filter(is_used=False) if self.request.user.role == 'MAIN_ADMIN' else InviteCode.objects.none()
    def create(self, request, *args, **kwargs):
        if request.user.role != 'MAIN_ADMIN': return Response(status=403)
        invite = InviteCode.objects.create(code=get_random_string(10).upper())
        return Response(self.get_serializer(invite).data, status=201)