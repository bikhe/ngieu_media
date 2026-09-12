import csv
import requests
import hmac
import hashlib
import urllib.parse
import json
import logging
import django.middleware.csrf
from datetime import timedelta

logger = logging.getLogger(__name__)
from django.conf import settings
from django.http import HttpResponse
from django.utils.crypto import get_random_string
from django.utils import timezone
from django.db import transaction
from rest_framework import viewsets, filters, status
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.exceptions import PermissionDenied
from rest_framework_simplejwt.tokens import RefreshToken, AccessToken
from rest_framework_simplejwt.settings import api_settings
from django_filters.rest_framework import DjangoFilterBackend
from .models import *
from .serializers import *
from .pagination import OptionalPageNumberPagination
from .authentication import set_auth_cookies


def _ensure_csrf_cookie(request) -> None:
    """Rotate and attach the csrftoken cookie on login responses so the SPA
    can echo it in X-CSRFToken for unsafe methods."""
    django.middleware.csrf.rotate_token(request)

ENABLE_MULTIPLE_PHOTOGRAPHERS = getattr(settings, 'ENABLE_MULTIPLE_PHOTOGRAPHERS', True)
ENABLE_STRICT_DEADLINES = getattr(settings, 'ENABLE_STRICT_DEADLINES', True)
ENABLE_EQUIPMENT_BOOKING = getattr(settings, 'ENABLE_EQUIPMENT_BOOKING', True)
ENABLE_EVENT_CHAT = getattr(settings, 'ENABLE_EVENT_CHAT', True)
ENABLE_SKILL_LEVELS = getattr(settings, 'ENABLE_SKILL_LEVELS', True)
ENABLE_TELEGRAM_BOT = getattr(settings, 'ENABLE_TELEGRAM_BOT', True)
ENABLE_CSV_REPORTS = getattr(settings, 'ENABLE_CSV_REPORTS', True)

# Read config from settings
TELEGRAM_BOT_TOKEN = getattr(settings, 'TELEGRAM_BOT_TOKEN', None)
TELEGRAM_WEBAPP_URL = getattr(settings, 'TELEGRAM_WEBAPP_URL', 'http://localhost:5173')

def verify_telegram_init_data(init_data: str, bot_token: str) -> dict | None:
    if not init_data or not bot_token:
        return None
    try:
        parsed_data = dict(urllib.parse.parse_qsl(init_data, keep_blank_values=True))
        if 'hash' not in parsed_data:
            return None
        
        tg_hash = parsed_data.pop('hash')
        sorted_keys = sorted(parsed_data.keys())
        data_check_string = "\n".join([f"{k}={parsed_data[k]}" for k in sorted_keys])
        
        secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
        calculated_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
        
        if calculated_hash != tg_hash:
            return None
            
        # Reject init_data older than 24 hours (replay attack protection)
        import time as time_module
        auth_date = int(parsed_data.get('auth_date', '0'))
        if time_module.time() - auth_date > 86400:
            return None

        user_data = json.loads(parsed_data.get('user', '{}'))
        return user_data
    except Exception as e:
        logger.error("Telegram init data verification error: %s", e)
        return None

def send_tg_notification(chat_id, text, event_id=None, open_chat=False):
    from .tasks import send_tg_notification_task
    send_tg_notification_task.delay(chat_id, text, event_id, open_chat)

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by('id')
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = OptionalPageNumberPagination

    def check_permissions(self, request):
        super().check_permissions(request)
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            if request.user.role != 'MAIN_ADMIN':
                raise PermissionDenied("Только администратор может управлять учетными записями.")

    def perform_create(self, serializer):
        password = self.request.data.get('password')
        user = serializer.save()
        if password:
            user.set_password(password)
        else:
            user.set_password(get_random_string(12))
        user.save()

    def perform_update(self, serializer):
        password = self.request.data.get('password')
        user = serializer.save()
        if password:
            user.set_password(password)
            user.save()

    @action(detail=False, methods=['GET', 'POST'])
    def me(self, request):
        if request.method == 'POST':
            user = request.user
            user.first_name = request.data.get('first_name', user.first_name)
            user.last_name = request.data.get('last_name', user.last_name)
            # telegram_id removed from mass assignment — use /telegram/link/ endpoint instead
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

    @action(detail=False, methods=['POST'])
    def change_password(self, request):
        user = request.user
        old_password = request.data.get('old_password')
        new_password = request.data.get('new_password')
        init_data = request.data.get('init_data')

        is_telegram_verified = False
        if init_data and user.telegram_id:
            user_data = verify_telegram_init_data(init_data, TELEGRAM_BOT_TOKEN)
            if user_data and str(user_data.get('id')) == user.telegram_id:
                is_telegram_verified = True

        if not new_password:
            return Response({'error': 'Новый пароль обязателен'}, status=status.HTTP_400_BAD_REQUEST)

        if not is_telegram_verified:
            if not old_password:
                return Response({'error': 'Старый пароль обязателен'}, status=status.HTTP_400_BAD_REQUEST)
            if not user.check_password(old_password):
                return Response({'error': 'Неверный старый пароль'}, status=status.HTTP_400_BAD_REQUEST)

        # Validate password strength
        from django.contrib.auth.password_validation import validate_password
        from django.core.exceptions import ValidationError as DjangoValidationError
        try:
            validate_password(new_password, user=user)
        except DjangoValidationError as e:
            return Response({'error': ' '.join(e.messages)}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save()
        return Response({'status': 'Пароль успешно изменен'})

class EquipmentViewSet(viewsets.ModelViewSet):
    queryset = Equipment.objects.all()
    serializer_class = EquipmentSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = OptionalPageNumberPagination

    def check_permissions(self, request):
        super().check_permissions(request)
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            if request.user.role != 'MAIN_ADMIN' and not getattr(request.user, 'can_manage_warehouse', False):
                raise PermissionDenied("У вас нет прав для управления оборудованием.")

class EventViewSet(viewsets.ModelViewSet):
    queryset = Event.objects.all()
    serializer_class = EventSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = OptionalPageNumberPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status']

    def check_object_permissions(self, request, obj):
        super().check_object_permissions(request, obj)
        if self.action in ['update', 'partial_update', 'destroy']:
            if request.user.role == 'MAIN_ADMIN' or getattr(request.user, 'can_approve_events', False) or getattr(request.user, 'can_view_all_events', False):
                return
            if request.user.role == 'ORGANIZER' and obj.responsible_person == request.user:
                return
            raise PermissionDenied("У вас нет прав для изменения этого мероприятия.")

    def perform_create(self, serializer):
        if self.request.user.role not in ['MAIN_ADMIN', 'ORGANIZER']:
            raise PermissionDenied("Только организаторы и админы могут создавать события.")
        serializer.save(responsible_person=self.request.user)

    def get_queryset(self):
        user = self.request.user
        qs = Event.objects.all()
        if user.role == 'MAIN_ADMIN' or getattr(user, 'can_view_all_events', False): return qs
        elif user.role == 'MEDIA': return qs.exclude(status__in=['PENDING', 'REJECTED'])
        return qs.filter(responsible_person=user)

    @action(detail=False, methods=['GET'])
    def export_csv(self, request):
        if not ENABLE_CSV_REPORTS or (request.user.role != 'MAIN_ADMIN' and not getattr(request.user, 'can_view_all_events', False)): return Response(status=403)
        qs = self.get_queryset()
        
        # Filter by date range
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        if start_date:
            qs = qs.filter(date__gte=start_date)
        if end_date:
            qs = qs.filter(date__lte=end_date)
            
        # Filter by specific media personnel
        media_ids_str = request.query_params.get('media_ids')
        if media_ids_str:
            media_ids = [int(x) for x in media_ids_str.split(',') if x.isdigit()]
            if media_ids:
                qs = qs.filter(media_participants__id__in=media_ids).distinct()

        qs = qs.order_by('-date')
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="report.csv"'
        response.write('\ufeff'.encode('utf8'))
        writer = csv.writer(response, delimiter=';')
        writer.writerow(['Название съёмки', 'Дата', 'Время', 'Локация', 'Тип контента', 'Сложность', 'Статус', 'Организатор', 'Исполнители (СМИ)', 'Забронированная техника', 'Комментарий', 'Ссылка на результат'])
        for e in qs:
            writer.writerow([
                e.title,
                e.date.strftime("%d.%m.%Y") if e.date else "",
                e.time.strftime("%H:%M") if e.time else "",
                e.location,
                e.get_content_type_display(),
                e.required_skill,
                e.get_status_display(),
                e.responsible_person.username,
                ", ".join([u.username for u in e.media_participants.all()]),
                ", ".join([eq.name for eq in e.booked_equipment.all()]),
                e.description or "",
                e.result_link or ""
            ])
        return response

    from rest_framework.parsers import MultiPartParser
    @action(detail=False, methods=['POST'], parser_classes=[MultiPartParser])
    def import_excel(self, request):
        if request.user.role not in ['MAIN_ADMIN', 'ORGANIZER']:
            return Response({'error': 'Доступ запрещен'}, status=403)
            
        excel_file = request.FILES.get('file')
        if not excel_file:
            return Response({'error': 'Файл не найден'}, status=400)
            
        try:
            import openpyxl
            import datetime
            wb = openpyxl.load_workbook(excel_file)
            sheet = wb.active
            
            created_count = 0
            # Expecting columns: Название, Дата(DD.MM.YYYY), Время(HH:MM), Локация, Комментарий
            for row in sheet.iter_rows(min_row=2, values_only=True):
                if not row[0]: continue
                
                title = str(row[0])
                date_str = str(row[1]) if row[1] else None
                time_str = str(row[2]) if row[2] else None
                location = str(row[3]) if len(row) > 3 and row[3] else "Не указана"
                description = str(row[4]) if len(row) > 4 and row[4] else ""
                
                # Parse date
                event_date = timezone.now().date()
                if date_str:
                    try:
                        if isinstance(row[1], datetime.datetime):
                            event_date = row[1].date()
                        else:
                            event_date = datetime.datetime.strptime(date_str.split()[0], '%d.%m.%Y').date()
                    except Exception: pass
                    
                # Parse time
                event_time = datetime.time(12, 0)
                if time_str:
                    try:
                        if isinstance(row[2], datetime.time):
                            event_time = row[2]
                        elif isinstance(row[2], datetime.datetime):
                            event_time = row[2].time()
                        else:
                            event_time = datetime.datetime.strptime(time_str.strip(), '%H:%M').time()
                    except Exception: pass
                    
                Event.objects.create(
                    title=title,
                    date=event_date,
                    time=event_time,
                    end_time=(datetime.datetime.combine(event_date, event_time) + datetime.timedelta(hours=2)).time(),
                    location=location,
                    description=description,
                    responsible_person=request.user,
                    status='PENDING'
                )
                created_count += 1
                
            return Response({'status': 'ok', 'created': created_count})
        except Exception as e:
            return Response({'error': f'Ошибка обработки файла: {str(e)}'}, status=400)


    @action(detail=False, methods=['GET'])
    def analytics(self, request):
        if request.user.role != 'MAIN_ADMIN' and not getattr(request.user, 'can_view_all_events', False):
            raise PermissionDenied("У вас нет доступа к аналитике.")

        from django.db.models import Count, Q
        from django.db.models.functions import TruncMonth

        # Calculate time range if filter is applied (days = all, 30, 7)
        days_param = request.query_params.get('days', 'all')
        
        event_filter = Q()
        if days_param == '30':
            start_date = timezone.now().date() - timezone.timedelta(days=30)
            event_filter &= Q(date__gte=start_date)
        elif days_param == '7':
            start_date = timezone.now().date() - timezone.timedelta(days=7)
            event_filter &= Q(date__gte=start_date)

        events_filtered = Event.objects.filter(event_filter)

        # 1. Summary statistics
        total_events = events_filtered.count()
        completed_events = events_filtered.filter(status='COMPLETED').count()
        overdue_events = events_filtered.filter(status='OVERDUE').count()
        
        # Unique active media personnel (with events in progress)
        active_media_count = User.objects.filter(
            role='MEDIA',
            taken_events__status='IN_PROGRESS',
            taken_events__in=events_filtered
        ).distinct().count()

        # 2. Status distribution
        statuses = ['PENDING', 'OPEN', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'OVERDUE']
        status_dist = {s: events_filtered.filter(status=s).count() for s in statuses}

        # 3. Content type distribution
        content_types = ['PHOTO', 'VIDEO', 'ALL']
        content_dist = {ct: events_filtered.filter(content_type=ct).count() for ct in content_types}

        # 4. Skill level distribution
        skill_levels = ['ANY', 'PRO', 'VIDEO', 'DRONE']
        skill_dist = {sl: events_filtered.filter(required_skill=sl).count() for sl in skill_levels}

        # 5. Monthly trend (last 12 months)
        trend_start = timezone.now().date() - timezone.timedelta(days=365)
        trend_data = (
            Event.objects.filter(date__gte=trend_start)
            .annotate(month=TruncMonth('date'))
            .values('month')
            .annotate(
                total=Count('id'),
                completed=Count('id', filter=Q(status='COMPLETED')),
                overdue=Count('id', filter=Q(status='OVERDUE'))
            )
            .order_by('month')
        )
        
        trend = []
        for item in trend_data:
            if item['month']:
                month_str = item['month'].strftime('%Y-%m')
                trend.append({
                    'month': month_str,
                    'total': item['total'],
                    'completed': item['completed'],
                    'overdue': item['overdue']
                })

        # 6. Equipment utilization
        equipment_stats_raw = list(Equipment.objects.annotate(
            bookings_count=Count('event', filter=Q(event__in=events_filtered))
        ).values('id', 'name', 'total_quantity', 'bookings_count'))
        
        equipment_stats = []
        for eq in equipment_stats_raw:
            eq['booking_rate'] = round((eq['bookings_count'] / total_events * 100), 1) if total_events > 0 else 0
            equipment_stats.append(eq)
        
        # Sort equipment by popularity
        equipment_stats.sort(key=lambda x: x['bookings_count'], reverse=True)

        # 7. Media performers stats
        media_stats_raw = list(User.objects.filter(role='MEDIA').annotate(
            total_taken=Count('taken_events', filter=Q(taken_events__in=events_filtered)),
            completed_count=Count('taken_events', filter=Q(taken_events__in=events_filtered, taken_events__status='COMPLETED')),
            overdue_count=Count('taken_events', filter=Q(taken_events__in=events_filtered, taken_events__status='OVERDUE')),
            in_progress_count=Count('taken_events', filter=Q(taken_events__in=events_filtered, taken_events__status='IN_PROGRESS'))
        ).values('id', 'username', 'first_name', 'last_name', 'skill_level', 'total_taken', 'completed_count', 'overdue_count', 'in_progress_count'))

        media_stats = []
        for m in media_stats_raw:
            m['success_rate'] = round((m['completed_count'] / m['total_taken'] * 100), 1) if m['total_taken'] > 0 else 0
            media_stats.append(m)
        
        media_stats.sort(key=lambda x: x['completed_count'], reverse=True)

        # 8. Organizer stats
        organizer_stats = list(User.objects.filter(role__in=['ORGANIZER', 'MAIN_ADMIN']).annotate(
            created_count=Count('created_events', filter=Q(created_events__in=events_filtered))
        ).values('id', 'username', 'first_name', 'last_name', 'role', 'created_count'))
        
        organizer_stats.sort(key=lambda x: x['created_count'], reverse=True)

        return Response({
            'summary': {
                'total_events': total_events,
                'completed_events': completed_events,
                'overdue_events': overdue_events,
                'active_media': active_media_count
            },
            'status_distribution': status_dist,
            'content_type_distribution': content_dist,
            'skill_level_distribution': skill_dist,
            'monthly_trend': trend,
            'equipment_utilization': equipment_stats,
            'media_stats': media_stats,
            'organizer_stats': organizer_stats
        })

    @action(detail=False, methods=['get'])
    def my_shoots(self, request):
        return Response(self.get_serializer(self.get_queryset().filter(media_participants=request.user).order_by('-date'), many=True).data)

    @action(detail=True, methods=['post'])
    def take_task(self, request, pk=None):
        if request.user.role != 'MEDIA':
            return Response({'error': 'Только исполнители (СМИ) могут брать задачи'}, status=403)
        with transaction.atomic():
            try: event = Event.objects.select_for_update().get(pk=pk)
            except Event.DoesNotExist: return Response({'error': 'Не найдено'}, status=404)

            if ENABLE_SKILL_LEVELS and event.required_skill != 'ANY' and request.user.skill_level not in [event.required_skill, 'PRO']:
                return Response({'error': 'Нужен VIP доступ'}, status=403)

            max_p = event.max_participants if ENABLE_MULTIPLE_PHOTOGRAPHERS else 1
            if request.user in event.media_participants.all(): return Response({'error': 'Уже взято'}, status=400)
            if event.media_participants.count() >= max_p or event.status != 'OPEN': return Response({'error': 'Места заняты'}, status=400)

            # Check equipment availability on this date!
            equipments = []
            if ENABLE_EQUIPMENT_BOOKING:
                equipment_ids = request.data.get('equipment_ids', [])
                if equipment_ids:
                    equipments = list(Equipment.objects.filter(id__in=equipment_ids).select_for_update().order_by('id'))
                    if len(equipments) != len(set(equipment_ids)):
                        return Response({'error': 'Некоторая техника не найдена'}, status=400)

                    from datetime import datetime, timedelta, time
                    from django.utils.timezone import make_aware, get_current_timezone

                    start_dt = datetime.combine(event.date, event.time or time(0, 0))
                    if event.end_time:
                        end_dt = datetime.combine(event.date, event.end_time)
                    else:
                        end_dt = start_dt + timedelta(hours=2)

                    try:
                        start_dt = make_aware(start_dt, get_current_timezone())
                        end_dt = make_aware(end_dt, get_current_timezone())
                    except ValueError:
                        pass

                    for eq in equipments:
                        avail = eq.get_available_quantity_at(
                            start_dt, end_dt, exclude_event_id=event.id
                        )
                        if avail < 1:
                            return Response(
                                {'error': f'Техника "{eq.name}" уже полностью забронирована на выбранный период ({start_dt.strftime("%d.%m.%Y %H:%M")}-{end_dt.strftime("%H:%M")})!'},
                                status=400
                            )


            event.media_participants.add(request.user)
            location_id = request.data.get('location_id')
            if location_id and str(location_id).isdigit():
                details = event.participant_details.copy() if event.participant_details else {}
                user_details = details.get(str(request.user.id), {})
                user_details['location_id'] = int(location_id)
                details[str(request.user.id)] = user_details
                event.participant_details = details

            if ENABLE_EQUIPMENT_BOOKING:
                for eq in equipments:
                    event.booked_equipment.add(eq)
                    EquipmentLoan.objects.create(
                        equipment=eq,
                        user=request.user,
                        event=event,
                        quantity=1,
                        status='REQUESTED',
                        loan_start=start_dt,
                        loan_end=end_dt,
                        comment=f"Бронирование под мероприятие '{event.title}'"
                    )
            if event.media_participants.count() >= max_p: event.status = 'IN_PROGRESS'
            event.save()
            if event.responsible_person.telegram_id: send_tg_notification(event.responsible_person.telegram_id, f"✅ Взяли вашу съемку '{event.title}'!", event_id=event.id)
        return Response({'status': 'Успех'})

    @action(detail=True, methods=['post'])
    def assign_participant(self, request, pk=None):
        if request.user.role not in ['MAIN_ADMIN', 'ORGANIZER']:
            return Response({'error': 'Только админы и организаторы могут назначать участников'}, status=403)
        
        with transaction.atomic():
            event = self.get_object()
            user_id = request.data.get('user_id')
            role_id = request.data.get('role_id')
            location_id = request.data.get('location_id')
            
            try:
                user = User.objects.get(id=user_id, role='MEDIA')
            except User.DoesNotExist:
                return Response({'error': 'Пользователь не найден или не является СМИ'}, status=400)
                
            event.media_participants.add(user)
            
            details = event.participant_details.copy() if event.participant_details else {}
            user_details = details.get(str(user.id), {})
            if role_id and str(role_id).isdigit():
                user_details['role_id'] = int(role_id)
            if location_id and str(location_id).isdigit():
                user_details['location_id'] = int(location_id)
            
            details[str(user.id)] = user_details
            event.participant_details = details
            
            if event.status == 'OPEN':
                event.status = 'IN_PROGRESS'
            event.save()
            
            if user.telegram_id:
                send_tg_notification(user.telegram_id, f"📝 Вас назначили на мероприятие '{event.title}'!", event_id=event.id)
                
            return Response({'status': 'Участник назначен'})

    @action(detail=True, methods=['post'])
    def remove_participant(self, request, pk=None):
        if request.user.role not in ['MAIN_ADMIN', 'ORGANIZER']:
            return Response({'error': 'Только админы и организаторы могут удалять участников'}, status=403)
        
        with transaction.atomic():
            event = self.get_object()
            user_id = request.data.get('user_id')
            
            try:
                user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                return Response({'error': 'Пользователь не найден'}, status=400)
                
            event.media_participants.remove(user)
            
            if event.participant_details and str(user.id) in event.participant_details:
                details = event.participant_details.copy()
                del details[str(user.id)]
                event.participant_details = details
                
            if event.media_participants.count() == 0 and event.status == 'IN_PROGRESS':
                event.status = 'OPEN'
            event.save()
            
            if user.telegram_id:
                send_tg_notification(user.telegram_id, f"❌ Вас сняли с мероприятия '{event.title}'", event_id=event.id)
                
            return Response({'status': 'Участник удален'})

    @action(detail=True, methods=['post'])
    def submit_work(self, request, pk=None):
        with transaction.atomic():
            base_event = self.get_object()
            event = Event.objects.select_for_update().get(pk=base_event.pk)
            if request.user.role != 'MEDIA' or not event.media_participants.filter(id=request.user.id).exists():
                return Response({'error': 'Вы не являетесь исполнителем этой задачи'}, status=403)
            new_link = request.data.get('result_link')
            if not new_link: return Response(status=400)
            event.result_link = ((event.result_link or "") + " " + new_link).strip()
            event.status = 'COMPLETED'
            event.save()
            if event.responsible_person.telegram_id: send_tg_notification(event.responsible_person.telegram_id, f"🎉 Сдали работу '{event.title}': {new_link}", event_id=event.id)

        return Response({'status': 'ok'})

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        if request.user.role != 'MAIN_ADMIN' and not getattr(request.user, 'can_approve_events', False):
            return Response({'error': 'У вас нет прав для одобрения задач'}, status=403)
        event = self.get_object(); event.status = 'OPEN'; event.save(); return Response({'status': 'ok'})

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        if request.user.role != 'MAIN_ADMIN' and not getattr(request.user, 'can_approve_events', False):
            return Response({'error': 'У вас нет прав для отклонения задач'}, status=403)
        event = self.get_object(); event.status = 'REJECTED'; event.save(); return Response({'status': 'ok'})

    @action(detail=True, methods=['get', 'post'])
    def comments(self, request, pk=None):
        if not ENABLE_EVENT_CHAT: return Response(status=403)
        event = self.get_object()
        is_participant = (
            request.user.role == 'MAIN_ADMIN' or
            event.responsible_person == request.user or
            event.media_participants.filter(id=request.user.id).exists()
        )
        if not is_participant:
            return Response({'error': 'Нет доступа к обсуждению этой задачи'}, status=403)

        if request.method == 'GET': return Response(CommentSerializer(event.comments.all(), many=True).data)
        comment = Comment.objects.create(event=event, author=request.user, text=request.data.get('text', ''))
        if request.user != event.responsible_person and event.responsible_person.telegram_id:
            send_tg_notification(event.responsible_person.telegram_id, f"💬 Новое сообщение в '{event.title}':\n{comment.text}", event_id=event.id, open_chat=True)
        return Response(CommentSerializer(comment).data, status=201)

class RegisterView(viewsets.ViewSet):
    permission_classes = [AllowAny]
    @transaction.atomic
    def create(self, request):
        try: invite = InviteCode.objects.select_for_update().get(code=request.data.get('invite_code'), is_used=False)
        except: return Response({'error': 'Неверный код'}, status=400)
        username = request.data.get('username')
        password = request.data.get('password')
        if not username or not password:
            return Response({'error': 'Укажите логин и пароль'}, status=400)
        if User.objects.filter(username=username).exists():
            return Response({'error': 'Пользователь с таким именем уже существует'}, status=400)
        from django.contrib.auth.password_validation import validate_password
        from django.core.exceptions import ValidationError as DjangoValidationError
        try:
            validate_password(password)
        except DjangoValidationError as e:
            return Response({'error': ' '.join(e.messages)}, status=status.HTTP_400_BAD_REQUEST)
        User.objects.create_user(username=username, password=password, role=invite.role)
        invite.is_used = True; invite.save()
        return Response({'status': 'ok'})

class InviteCodeViewSet(viewsets.ModelViewSet):
    serializer_class = InviteCodeSerializer
    permission_classes = [IsAuthenticated]
    def get_queryset(self): return InviteCode.objects.filter(is_used=False) if self.request.user.role == 'MAIN_ADMIN' else InviteCode.objects.none()
    def create(self, request, *args, **kwargs):
        if request.user.role != 'MAIN_ADMIN':
            return Response({'detail': 'Только администратор может создавать инвайт-коды.'}, status=403)
        role = request.data.get('role', 'ORGANIZER')
        if role not in ['MEDIA', 'ORGANIZER']:
            return Response({'error': 'Недопустимая роль'}, status=400)
        invite = InviteCode.objects.create(code=get_random_string(10).upper(), role=role)
        return Response(self.get_serializer(invite).data, status=201)

class TelegramAuthView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        init_data = request.data.get('init_data')
        if not init_data:
            return Response({'error': 'init_data is required'}, status=status.HTTP_400_BAD_REQUEST)

        user_data = verify_telegram_init_data(init_data, TELEGRAM_BOT_TOKEN)
        if user_data is None:
            return Response({'error': 'Invalid Telegram signature'}, status=status.HTTP_400_BAD_REQUEST)

        telegram_id = str(user_data.get('id'))
        try:
            user = User.objects.get(telegram_id=telegram_id)
        except User.DoesNotExist:
            return Response({
                'error': 'User not registered',
                'telegram_user': user_data
            }, status=status.HTTP_404_NOT_FOUND)

        refresh = RefreshToken.for_user(user)
        response = Response({
            'status': 'ok',
            'user': UserSerializer(user).data
        })
        set_auth_cookies(response, str(refresh.access_token), str(refresh))
        _ensure_csrf_cookie(request)
        return response

class TelegramRegisterView(APIView):
    permission_classes = [AllowAny]

    @transaction.atomic
    def post(self, request):
        init_data = request.data.get('init_data')
        invite_code = request.data.get('invite_code')
        username = request.data.get('username')

        if not init_data or not invite_code or not username:
            return Response({'error': 'init_data, invite_code, and username are required'}, status=status.HTTP_400_BAD_REQUEST)

        user_data = verify_telegram_init_data(init_data, TELEGRAM_BOT_TOKEN)
        if user_data is None:
            return Response({'error': 'Invalid Telegram signature'}, status=status.HTTP_400_BAD_REQUEST)

        telegram_id = str(user_data.get('id'))
        if User.objects.filter(telegram_id=telegram_id).exists():
            return Response({'error': 'Telegram account already linked to another user'}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(username=username).exists():
            return Response({'error': 'Пользователь с таким именем уже существует'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            invite = InviteCode.objects.select_for_update().get(code=invite_code, is_used=False)
        except InviteCode.DoesNotExist:
            return Response({'error': 'Неверный или использованный код инвайта'}, status=status.HTTP_400_BAD_REQUEST)

        first_name = user_data.get('first_name', '')
        last_name = user_data.get('last_name', '')
        
        user = User.objects.create_user(
            username=username,
            password=get_random_string(32),
            role=invite.role,
            first_name=first_name,
            last_name=last_name,
            telegram_id=telegram_id
        )

        invite.is_used = True
        invite.save()

        refresh = RefreshToken.for_user(user)
        response = Response({
            'status': 'ok',
            'user': UserSerializer(user).data
        })
        set_auth_cookies(response, str(refresh.access_token), str(refresh))
        _ensure_csrf_cookie(request)
        return response

class TelegramLinkView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        init_data = request.data.get('init_data')
        if not init_data:
            return Response({'error': 'init_data is required'}, status=status.HTTP_400_BAD_REQUEST)

        user_data = verify_telegram_init_data(init_data, TELEGRAM_BOT_TOKEN)
        if user_data is None:
            return Response({'error': 'Invalid Telegram signature'}, status=status.HTTP_400_BAD_REQUEST)

        telegram_id = str(user_data.get('id'))
        
        if User.objects.filter(telegram_id=telegram_id).exclude(id=request.user.id).exists():
            return Response({'error': 'Этот Telegram аккаунт уже привязан к другому пользователю'}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        user.telegram_id = telegram_id
        if not user.first_name:
            user.first_name = user_data.get('first_name', '')
        if not user.last_name:
            user.last_name = user_data.get('last_name', '')
        user.save()

        return Response({
            'status': 'Telegram успешно привязан',
            'user': UserSerializer(user).data
        })

class EquipmentLoanViewSet(viewsets.ModelViewSet):
    queryset = EquipmentLoan.objects.all()
    serializer_class = EquipmentLoanSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = OptionalPageNumberPagination

    def get_queryset(self):
        user = self.request.user
        if user.role == 'MAIN_ADMIN' or getattr(user, 'can_manage_warehouse', False):
            return EquipmentLoan.objects.all().order_by('-requested_at')
        return EquipmentLoan.objects.filter(user=user).order_by('-requested_at')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user, status='REQUESTED')

    @action(detail=True, methods=['post'])
    def approve_issue(self, request, pk=None):
        if request.user.role != 'MAIN_ADMIN' and not getattr(request.user, 'can_manage_warehouse', False):
            return Response({'error': 'У вас нет прав для выдачи техники'}, status=403)
        loan = self.get_object()
        if loan.status != 'REQUESTED':
            return Response({'error': 'Можно выдать только запрошенную технику'}, status=400)
        
        # Check availability
        available = loan.equipment.get_available_quantity_at(
            loan.loan_start, loan.loan_end, exclude_loan_id=loan.id
        )
        if available < loan.quantity:
            return Response({'error': f'Недостаточно доступного оборудования на складе в этот период. Доступно: {available}'}, status=400)


        loan.status = 'ISSUED'
        loan.issued_at = timezone.now()
        loan.save()
        return Response(self.get_serializer(loan).data)

    @action(detail=True, methods=['post'])
    def reject_request(self, request, pk=None):
        if request.user.role != 'MAIN_ADMIN' and not getattr(request.user, 'can_manage_warehouse', False):
            return Response({'error': 'У вас нет прав для отклонения запросов'}, status=403)
        loan = self.get_object()
        if loan.status != 'REQUESTED':
            return Response({'error': 'Можно отклонить только запрошенную технику'}, status=400)
        loan.status = 'REJECTED'
        loan.save()
        return Response(self.get_serializer(loan).data)

    @action(detail=True, methods=['post'])
    def request_return(self, request, pk=None):
        loan = self.get_object()
        if loan.user != request.user and request.user.role != 'MAIN_ADMIN' and not getattr(request.user, 'can_manage_warehouse', False):
            return Response({'error': 'Вы не можете сдать чужую технику'}, status=403)
        if loan.status != 'ISSUED':
            return Response({'error': 'Сдать можно только выданную технику'}, status=400)
        loan.status = 'RETURN_REQUESTED'
        loan.save()
        return Response(self.get_serializer(loan).data)

    @action(detail=True, methods=['post'])
    def approve_return(self, request, pk=None):
        if request.user.role != 'MAIN_ADMIN' and not getattr(request.user, 'can_manage_warehouse', False):
            return Response({'error': 'У вас нет прав для подтверждения возврата'}, status=403)
        loan = self.get_object()
        if loan.status != 'RETURN_REQUESTED' and loan.status != 'ISSUED':
            return Response({'error': 'Возврат возможен только для выданной или запрошенной к возврату техники'}, status=400)
        loan.status = 'RETURNED'
        loan.returned_at = timezone.now()
        loan.save()
        return Response(self.get_serializer(loan).data)

from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.authentication import JWTAuthentication
from django.http import StreamingHttpResponse

class SkillViewSet(viewsets.ModelViewSet):
    queryset = Skill.objects.all()
    serializer_class = SkillSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = OptionalPageNumberPagination

    def check_permissions(self, request):
        super().check_permissions(request)
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            if request.user.role != 'MAIN_ADMIN':
                raise PermissionDenied("Только администратор может управлять ролями.")



class EventTemplateViewSet(viewsets.ModelViewSet):
    queryset = EventTemplate.objects.all()
    serializer_class = EventTemplateSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = OptionalPageNumberPagination

    def check_permissions(self, request):
        super().check_permissions(request)
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            if request.user.role != 'MAIN_ADMIN':
                raise PermissionDenied("Только администратор может управлять шаблонами.")

class LocationViewSet(viewsets.ModelViewSet):
    queryset = Location.objects.all()
    serializer_class = LocationSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = OptionalPageNumberPagination

    def check_permissions(self, request):
        super().check_permissions(request)
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            if request.user.role != 'MAIN_ADMIN':
                raise PermissionDenied("У вас нет прав для управления локациями.")

class EventRoleViewSet(viewsets.ModelViewSet):
    queryset = EventRole.objects.all()
    serializer_class = EventRoleSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = OptionalPageNumberPagination

    def check_permissions(self, request):
        super().check_permissions(request)
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            if request.user.role != 'MAIN_ADMIN':
                raise PermissionDenied("У вас нет прав для управления ролями.")

class UpdatesView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        user = request.user
        if not user or not user.is_authenticated:
            # The SSE broker cannot send Authorization headers, so it forwards
            # a short-lived ticket (see post()) instead of a long-lived JWT.
            ticket = request.query_params.get('ticket')
            if ticket:
                try:
                    validated_token = JWTAuthentication().get_validated_token(ticket)
                    user = JWTAuthentication().get_user(validated_token)
                except (InvalidToken, TokenError):
                    return Response({'error': 'Invalid ticket'}, status=401)

            if not user or not user.is_authenticated:
                return Response({'error': 'Unauthorized'}, status=401)

        since_id = request.query_params.get('since_id')
        
        last_id = int(since_id) if since_id and since_id.isdigit() else None
        if last_id is None:
            latest = UpdateLog.objects.order_by('-id').first()
            return Response({'last_id': latest.id if latest else 0, 'logs': []})

        new_logs = UpdateLog.objects.filter(id__gt=last_id).order_by('id')
        logs_data = [{
            'id': log.id,
            'entity_type': log.entity_type,
            'entity_id': log.entity_id,
            'action': log.action,
            'extra_data': log.extra_data,
            'timestamp': log.timestamp.isoformat()
        } for log in new_logs]

        return Response({
            'last_id': new_logs.last().id if new_logs.exists() else last_id,
            'logs': logs_data
        })

    def post(self, request):
        """Issue a short-lived ticket for the SSE stream.

        The browser exchanges its normal Authorization header for a ticket
        that only lives a few seconds, so the value that ends up in the
        /stream?ticket=... URL is useless to log readers within moments.
        """
        if not request.user or not request.user.is_authenticated:
            return Response({'error': 'Unauthorized'}, status=401)

        class SSEAccessToken(AccessToken):
            lifetime = timedelta(seconds=getattr(settings, 'SSE_TICKET_LIFETIME', 30))

        ticket = SSEAccessToken()
        ticket[api_settings.USER_ID_CLAIM] = getattr(request.user, api_settings.USER_ID_FIELD)
        return Response({'ticket': str(ticket), 'expires_in': SSEAccessToken.lifetime.seconds})