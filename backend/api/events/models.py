from django.db import models
from django.contrib.auth.models import AbstractUser, UserManager as DjangoUserManager

class Skill(models.Model):
    name = models.CharField(max_length=50)
    code = models.CharField(max_length=20, unique=True)
    is_pro = models.BooleanField(default=False, help_text="Может брать любые задачи")
    is_default = models.BooleanField(default=False)

    def __str__(self):
        return self.name

class UserManager(DjangoUserManager):
    def create_user(self, username, email=None, password=None, **extra_fields):
        extra_fields.setdefault('role', 'ORGANIZER')
        return super().create_user(username, email, password, **extra_fields)

    def create_superuser(self, username, email=None, password=None, **extra_fields):
        # API permissions check request.user.role == 'MAIN_ADMIN', which
        # plain is_superuser=True does not imply on its own.
        extra_fields.setdefault('role', 'MAIN_ADMIN')
        extra_fields.setdefault('can_approve_events', True)
        extra_fields.setdefault('can_manage_warehouse', True)
        extra_fields.setdefault('can_view_all_events', True)
        return super().create_superuser(username, email, password, **extra_fields)

class User(AbstractUser):
    ROLE_CHOICES = (('MAIN_ADMIN', 'Админ'), ('MEDIA', 'СМИ'), ('ORGANIZER', 'Орг'))
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='ORGANIZER')
    skill_level = models.CharField(max_length=20, default='ANY', verbose_name="Уровень")
    telegram_id = models.CharField(max_length=100, blank=True, null=True)
    phone_number = models.CharField(max_length=20, blank=True, null=True, verbose_name="Номер телефона")

    can_approve_events = models.BooleanField(default=False, verbose_name="Может одобрять мероприятия")
    can_manage_warehouse = models.BooleanField(default=False, verbose_name="Может управлять складом")
    can_view_all_events = models.BooleanField(default=False, verbose_name="Может просматривать все мероприятия")

    objects = UserManager()

class Location(models.Model):
    name = models.CharField(max_length=255, unique=True)
    def __str__(self): return self.name

class EventRole(models.Model):
    name = models.CharField(max_length=100, unique=True)
    def __str__(self): return self.name

class InviteCode(models.Model):
    code = models.CharField(max_length=20, unique=True)
    role = models.CharField(max_length=20, choices=User.ROLE_CHOICES, default='ORGANIZER')
    is_used = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

class Equipment(models.Model):
    CATEGORY_CHOICES = (
        ('CAMERA', 'Камера'),
        ('LENS', 'Объектив'),
        ('LIGHT', 'Свет'),
        ('AUDIO', 'Звук'),
        ('OTHER', 'Другое'),
    )
    STATUS_CHOICES = (
        ('AVAILABLE', 'Доступно'),
        ('MAINTENANCE', 'Ремонт'),
        ('RETIRED', 'Списано'),
    )

    name = models.CharField(max_length=100)
    total_quantity = models.PositiveIntegerField(default=1)
    description = models.TextField(blank=True, null=True)
    serial_number = models.CharField(max_length=100, blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='AVAILABLE')
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='OTHER')

    @property
    def available_quantity(self):
        from .models import EquipmentLoan
        issued = EquipmentLoan.objects.filter(
            equipment=self,
            status__in=['ISSUED', 'RETURN_REQUESTED']
        ).aggregate(total=models.Sum('quantity'))['total'] or 0
        return max(0, self.total_quantity - issued)

    def get_available_quantity_at(self, start_dt, end_dt, exclude_event_id=None, exclude_loan_id=None):
        from django.db.models import Q
        from datetime import timedelta, datetime, time
        from django.utils.timezone import is_aware, make_aware, get_current_timezone
        
        # 1. Find overlapping loans
        loans_qs = self.loans.filter(
            status__in=['REQUESTED', 'ISSUED', 'RETURN_REQUESTED'],
            loan_start__lt=end_dt,
            loan_end__gt=start_dt
        )
        if exclude_loan_id:
            loans_qs = loans_qs.exclude(id=exclude_loan_id)
            
        # 2. Find overlapping events
        events_qs = self.event_set.filter(
            booked_equipment=self
        ).exclude(status__in=['REJECTED', 'PENDING'])
        if exclude_event_id:
            events_qs = events_qs.exclude(id=exclude_event_id)
            
        # Exclude events that already have active loans for this equipment to avoid double-counting
        loaned_event_ids = [eid for eid in loans_qs.values_list('event_id', flat=True) if eid is not None]
        if loaned_event_ids:
            events_qs = events_qs.exclude(id__in=loaned_event_ids)
            
        intervals = []
        
        for loan in loans_qs:
            if loan.loan_start and loan.loan_end:
                intervals.append((loan.loan_start, loan.loan_end, loan.quantity))
                
        for evt in events_qs:
            if evt.date:
                evt_start = datetime.combine(evt.date, evt.time or time(0, 0))
                if is_aware(start_dt):
                    if not is_aware(evt_start):
                        evt_start = make_aware(evt_start, get_current_timezone())
                else:
                    if is_aware(evt_start):
                        evt_start = evt_start.replace(tzinfo=None)
                        
                if evt.end_time:
                    evt_end = datetime.combine(evt.date, evt.end_time)
                else:
                    evt_end = evt_start + timedelta(hours=2)
                    
                if is_aware(start_dt) and not is_aware(evt_end):
                    evt_end = make_aware(evt_end, get_current_timezone())
                elif not is_aware(start_dt) and is_aware(evt_end):
                    evt_end = evt_end.replace(tzinfo=None)
                    
                if evt_start < end_dt and evt_end > start_dt:
                    intervals.append((evt_start, evt_end, 1))
                    
        if not intervals:
            return self.total_quantity
            
        events = []
        for s, e, q in intervals:
            s_clamp = max(start_dt, s)
            e_clamp = min(end_dt, e)
            if s_clamp < e_clamp:
                events.append((s_clamp, 1, q))
                events.append((e_clamp, -1, q))
                
        if not events:
            return self.total_quantity
            
        events.sort(key=lambda x: (x[0], x[1]))
        
        max_concurrent = 0
        current = 0
        for time_val, type_val, q in events:
            if type_val == 1:
                current += q
                if current > max_concurrent:
                    max_concurrent = current
            else:
                current -= q
                
        return max(0, self.total_quantity - max_concurrent)

    def __str__(self): return self.name


class Event(models.Model):
    STATUS_CHOICES = (('PENDING', 'Ожидание'), ('OPEN', 'Открыт'), ('IN_PROGRESS', 'В работе'), ('COMPLETED', 'Готово'), ('REJECTED', 'Отклонено'), ('OVERDUE', 'Просрочено'))
    CONTENT_TYPES = (('PHOTO', 'Фото'), ('VIDEO', 'Видео'), ('ALL', 'Всё вместе'))

    title = models.CharField(max_length=200)
    date = models.DateField()
    time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    deadline = models.DateTimeField(null=True, blank=True)

    location = models.CharField(max_length=255, blank=True, null=True) # Оставляем для совместимости
    locations = models.ManyToManyField(Location, blank=True, related_name='events')
    short_comment = models.CharField(max_length=255, blank=True, null=True, verbose_name="Короткий комментарий")
    description = models.TextField(blank=True, null=True, verbose_name="Комментарий")
    content_type = models.CharField(max_length=10, choices=CONTENT_TYPES, default='PHOTO')
    required_skill = models.CharField(max_length=20, default='ANY')
    
    responsible_person = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_events')
    media_participants = models.ManyToManyField(User, related_name='taken_events', blank=True)
    
    max_participants = models.PositiveIntegerField(default=1)
    booked_equipment = models.ManyToManyField(Equipment, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    document_link = models.URLField(max_length=1000, blank=True, null=True)
    result_link = models.URLField(max_length=1000, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    participant_details = models.JSONField(default=dict, blank=True)

class EventTemplate(models.Model):
    name = models.CharField(max_length=100)
    content_type = models.CharField(max_length=10, choices=Event.CONTENT_TYPES, default='PHOTO')
    required_skill = models.CharField(max_length=20, default='ANY')
    max_participants = models.PositiveIntegerField(default=1)
    equipment = models.ManyToManyField(Equipment, blank=True)

    def __str__(self):
        return self.name

class Comment(models.Model):
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='comments')
    author = models.ForeignKey(User, on_delete=models.CASCADE)
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta: ordering = ['created_at']

class EventAttachment(models.Model):
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='attachments')
    file = models.FileField(upload_to='event_attachments/')

class EquipmentLoan(models.Model):
    STATUS_CHOICES = (
        ('REQUESTED', 'Запрошено'),
        ('ISSUED', 'Выдано'),
        ('RETURN_REQUESTED', 'Запрос на возврат'),
        ('RETURNED', 'Возвращено'),
        ('REJECTED', 'Отклонено'),
    )
    equipment = models.ForeignKey(Equipment, on_delete=models.CASCADE, related_name='loans')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='equipment_loans')
    event = models.ForeignKey(Event, on_delete=models.SET_NULL, null=True, blank=True, related_name='equipment_loans')
    quantity = models.PositiveIntegerField(default=1)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='REQUESTED')
    requested_at = models.DateTimeField(auto_now_add=True)
    loan_start = models.DateTimeField(null=True, blank=True)
    loan_end = models.DateTimeField(null=True, blank=True)
    issued_at = models.DateTimeField(null=True, blank=True)
    returned_at = models.DateTimeField(null=True, blank=True)
    comment = models.TextField(blank=True, null=True)


    def __str__(self):
        return f"{self.user.username} - {self.equipment.name} ({self.status})"

class UpdateLog(models.Model):
    entity_type = models.CharField(max_length=50)  # 'event', 'comment', 'loan', 'equipment'
    entity_id = models.IntegerField()
    action = models.CharField(max_length=20)  # 'create', 'update', 'delete'
    timestamp = models.DateTimeField(auto_now_add=True)
    extra_data = models.JSONField(null=True, blank=True)

    def __str__(self):
        return f"{self.entity_type} {self.entity_id} {self.action} at {self.timestamp}"


# Signals for real-time update tracking
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

@receiver(post_save, sender=Event)
@receiver(post_save, sender=Comment)
@receiver(post_save, sender=Equipment)
@receiver(post_save, sender=EquipmentLoan)
@receiver(post_save, sender=User)
def log_save(sender, instance, created, **kwargs):
    action = 'create' if created else 'update'
    entity_type = sender.__name__.lower()
    
    # Map 'equipmentloan' entity type to 'loan' to match plan
    if entity_type == 'equipmentloan':
        entity_type = 'loan'

    extra_data = {}
    if entity_type == 'comment':
        extra_data['event_id'] = instance.event_id
        extra_data['author'] = instance.author.username
        extra_data['text'] = instance.text[:100]
    elif entity_type == 'event':
        extra_data['title'] = instance.title
        extra_data['status'] = instance.status
    elif entity_type == 'loan':
        extra_data['status'] = instance.status
        extra_data['user'] = instance.user.username
        if instance.event:
            extra_data['event_id'] = instance.event_id
    elif entity_type == 'user':
        extra_data['username'] = instance.username
        extra_data['role'] = instance.role
    
    # Auto-cleanup old logs has been moved to Celery task: cleanup_update_logs

    UpdateLog.objects.create(
        entity_type=entity_type,
        entity_id=instance.id,
        action=action,
        extra_data=extra_data
    )

@receiver(post_delete, sender=Event)
@receiver(post_delete, sender=Comment)
@receiver(post_delete, sender=Equipment)
@receiver(post_delete, sender=EquipmentLoan)
@receiver(post_delete, sender=User)
def log_delete(sender, instance, **kwargs):
    entity_type = sender.__name__.lower()
    if entity_type == 'equipmentloan':
        entity_type = 'loan'
    
    extra_data = {}
    if entity_type == 'comment':
        extra_data['event_id'] = instance.event_id
    elif entity_type == 'loan' and instance.event:
        extra_data['event_id'] = instance.event_id
    elif entity_type == 'user':
        extra_data['username'] = instance.username

    UpdateLog.objects.create(
        entity_type=entity_type,
        entity_id=instance.id,
        action='delete',
        extra_data=extra_data
    )

import json
import redis
import os

# Reuse one client: creating a Redis object per signal wastes a connection
# and, when the host is unreachable, a full DNS timeout on every save.
_redis_publisher = None

def _get_redis_publisher():
    global _redis_publisher
    if _redis_publisher is None:
        redis_host = os.environ.get('REDIS_HOST', 'redis')
        redis_port = int(os.environ.get('REDIS_PORT', '6379'))
        _redis_publisher = redis.Redis(
            host=redis_host, port=redis_port, db=0,
            socket_connect_timeout=1, socket_timeout=1,
        )
    return _redis_publisher

@receiver(post_save, sender=UpdateLog)
def publish_update_log_to_redis(sender, instance, created, **kwargs):
    if not created:
        return
    
    from django.db import transaction
    def do_publish():
        try:
            r = _get_redis_publisher()
            log_data = {
                'id': instance.id,
                'entity_type': instance.entity_type,
                'entity_id': instance.entity_id,
                'action': instance.action,
                'extra_data': instance.extra_data,
                'timestamp': instance.timestamp.isoformat()
            }
            r.publish('ngieu_updates', json.dumps({'type': 'updates', 'logs': [log_data]}))
        except Exception as e:
            print("Failed to publish to Redis:", e)
            
    transaction.on_commit(do_publish)