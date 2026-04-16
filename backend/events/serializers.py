from rest_framework import serializers
from .models import *

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'role', 'telegram_id', 'skill_level']

class InviteCodeSerializer(serializers.ModelSerializer):
    class Meta: model = InviteCode; fields = '__all__'

class EquipmentSerializer(serializers.ModelSerializer):
    class Meta: model = Equipment; fields = '__all__'

class CommentSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)
    class Meta:
        model = Comment
        fields = ['id', 'event', 'author', 'text', 'created_at']
        read_only_fields = ['author', 'event']

class EventSerializer(serializers.ModelSerializer):
    responsible_person = UserSerializer(read_only=True)
    media_participants = UserSerializer(many=True, read_only=True)
    booked_equipment = EquipmentSerializer(many=True, read_only=True)
    equipment_ids = serializers.PrimaryKeyRelatedField(
        queryset=Equipment.objects.all(), source='booked_equipment', many=True, write_only=True, required=False
    )
    class Meta: model = Event; fields = '__all__'