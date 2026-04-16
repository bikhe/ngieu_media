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
    is_used = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

class Equipment(models.Model):
    name = models.CharField(max_length=100)
    total_quantity = models.PositiveIntegerField(default=1)
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