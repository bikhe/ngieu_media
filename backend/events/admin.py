from django.contrib import admin
from .models import User, Event, InviteCode, Equipment, Comment

# Регистрируем модели, чтобы они появились в панели
admin.site.register(User)
admin.site.register(Event)
admin.site.register(InviteCode)
admin.site.register(Equipment)
admin.site.register(Comment)