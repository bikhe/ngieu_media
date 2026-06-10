from rest_framework import serializers
from .models import *

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'role', 'telegram_id', 'skill_level']

class InviteCodeSerializer(serializers.ModelSerializer):
    class Meta: model = InviteCode; fields = '__all__'

class EquipmentSerializer(serializers.ModelSerializer):
    available_quantity = serializers.ReadOnlyField()
    class Meta:
        model = Equipment
        fields = ['id', 'name', 'total_quantity', 'description', 'serial_number', 'status', 'category', 'available_quantity']

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

    def validate(self, attrs):
        booked_equipment = attrs.get('booked_equipment')
        date = attrs.get('date', self.instance.date if self.instance else None)
        
        if booked_equipment and date:
            for eq in booked_equipment:
                qs = Event.objects.filter(date=date, booked_equipment=eq).exclude(status__in=['REJECTED', 'PENDING'])
                if self.instance:
                    qs = qs.exclude(id=self.instance.id)
                if qs.count() >= eq.total_quantity:
                    raise serializers.ValidationError(
                        f'Оборудование "{eq.name}" на выбранную дату ({date.strftime("%d.%m.%Y") if hasattr(date, "strftime") else date}) уже полностью забронировано!'
                    )
        return attrs

class EquipmentLoanSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    equipment = EquipmentSerializer(read_only=True)
    equipment_id = serializers.PrimaryKeyRelatedField(
        queryset=Equipment.objects.all(), source='equipment', write_only=True
    )
    event_title = serializers.ReadOnlyField(source='event.title')

    class Meta:
        model = EquipmentLoan
        fields = [
            'id', 'equipment', 'equipment_id', 'user', 'event', 'event_title',
            'quantity', 'status', 'requested_at', 'issued_at', 'returned_at', 'comment'
        ]