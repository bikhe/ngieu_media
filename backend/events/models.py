from django.db import models
from django.contrib.auth.models import AbstractUser

class User(AbstractUser):
    ROLE_CHOICES = (('MAIN_ADMIN', 'Админ'), ('MEDIA', 'СМИ'), ('ORGANIZER', 'Орг'))
    SKILL_CHOICES = (('ANY', 'Любой'), ('PRO', 'Профи'), ('VIDEO', 'Видео'), ('DRONE', 'Дрон'))
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='ORGANIZER')
    skill_level = models.CharField(max_length=20, choices=SKILL_CHOICES, default='ANY', verbose_name="Уровень")
    telegram_id = models.CharField(max_length=100, blank=True, null=True)

class InviteCode(models.Model):
    code = models.CharField(max_length=20, unique=True)
    role = models.CharField(max_length=20, choices=User.ROLE_CHOICES, default='MEDIA')
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

    def __str__(self): return self.name

class Event(models.Model):
    STATUS_CHOICES = (('PENDING', 'Ожидание'), ('OPEN', 'Открыт'), ('IN_PROGRESS', 'В работе'), ('COMPLETED', 'Готово'), ('REJECTED', 'Отклонено'), ('OVERDUE', 'Просрочено'))
    CONTENT_TYPES = (('PHOTO', 'Фото'), ('VIDEO', 'Видео'), ('ALL', 'Всё вместе'))

    title = models.CharField(max_length=200)
    date = models.DateField()
    time = models.TimeField(null=True, blank=True)
    deadline = models.DateTimeField(null=True, blank=True)
    location = models.CharField(max_length=255)
    content_type = models.CharField(max_length=10, choices=CONTENT_TYPES, default='PHOTO')
    required_skill = models.CharField(max_length=20, choices=User.SKILL_CHOICES, default='ANY')
    
    responsible_person = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_events')
    media_participants = models.ManyToManyField(User, related_name='taken_events', blank=True)
    
    max_participants = models.PositiveIntegerField(default=1)
    booked_equipment = models.ManyToManyField(Equipment, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    document_link = models.URLField(max_length=1000, blank=True, null=True)
    result_link = models.URLField(max_length=1000, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

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
    
    # Auto-cleanup old logs to prevent DB bloat (keep last 1000 logs)
    try:
        if UpdateLog.objects.count() > 1000:
            old_ids = list(UpdateLog.objects.order_by('-id').values_list('id', flat=True)[1000:])
            UpdateLog.objects.filter(id__in=old_ids).delete()
    except Exception:
        pass

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
def log_delete(sender, instance, **kwargs):
    entity_type = sender.__name__.lower()
    if entity_type == 'equipmentloan':
        entity_type = 'loan'
    
    extra_data = {}
    if entity_type == 'comment':
        extra_data['event_id'] = instance.event_id
    elif entity_type == 'loan' and instance.event:
        extra_data['event_id'] = instance.event_id

    UpdateLog.objects.create(
        entity_type=entity_type,
        entity_id=instance.id,
        action='delete',
        extra_data=extra_data
    )