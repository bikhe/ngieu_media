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
        time_val = attrs.get('time', self.instance.time if self.instance else None)
        end_time_val = attrs.get('end_time', self.instance.end_time if self.instance else None)
        
        if booked_equipment and date:
            from datetime import datetime, timedelta, time
            from django.utils.timezone import make_aware, get_current_timezone
            
            start_dt = datetime.combine(date, time_val or time(0, 0))
            if end_time_val:
                end_dt = datetime.combine(date, end_time_val)
            else:
                end_dt = start_dt + timedelta(hours=2)
                
            try:
                start_dt = make_aware(start_dt, get_current_timezone())
                end_dt = make_aware(end_dt, get_current_timezone())
            except ValueError:
                pass
                
            for eq in booked_equipment:
                avail = eq.get_available_quantity_at(
                    start_dt, end_dt,
                    exclude_event_id=self.instance.id if self.instance else None
                )
                if avail < 1:
                    raise serializers.ValidationError(
                        f'Оборудование "{eq.name}" на выбранный период ({start_dt.strftime("%d.%m.%Y %H:%M")}-{end_dt.strftime("%H:%M")}) уже полностью забронировано!'
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
            'quantity', 'status', 'requested_at', 'loan_start', 'loan_end',
            'issued_at', 'returned_at', 'comment'
        ]

    def validate(self, attrs):
        loan_start = attrs.get('loan_start')
        loan_end = attrs.get('loan_end')
        event = attrs.get('event')
        
        # Prefill from event if not specified
        if event and (not loan_start or not loan_end):
            from datetime import datetime, timedelta, time
            from django.utils.timezone import make_aware, get_current_timezone
            
            evt_start = datetime.combine(event.date, event.time or time(0, 0))
            if event.end_time:
                evt_end = datetime.combine(event.date, event.end_time)
            else:
                evt_end = evt_start + timedelta(hours=2)
                
            try:
                evt_start = make_aware(evt_start, get_current_timezone())
                evt_end = make_aware(evt_end, get_current_timezone())
            except ValueError:
                pass
                
            if not loan_start:
                loan_start = evt_start
                attrs['loan_start'] = loan_start
            if not loan_end:
                loan_end = evt_end
                attrs['loan_end'] = loan_end
                
        if not loan_start or not loan_end:
            raise serializers.ValidationError("Необходимо указать время начала и окончания бронирования.")
            
        if loan_start >= loan_end:
            raise serializers.ValidationError("Время начала бронирования должно быть раньше времени окончания.")
            
        equipment = attrs.get('equipment')
        quantity = attrs.get('quantity', 1)
        
        if equipment:
            exclude_event_id = event.id if event else None
            avail = equipment.get_available_quantity_at(
                loan_start, loan_end,
                exclude_event_id=exclude_event_id,
                exclude_loan_id=self.instance.id if self.instance else None
            )
            if avail < quantity:
                raise serializers.ValidationError(
                    f'Недостаточно доступного оборудования "{equipment.name}". Запрошено: {quantity}, доступно: {avail} в выбранный период ({loan_start.strftime("%d.%m.%Y %H:%M")} - {loan_end.strftime("%H:%M")})'
                )
                
        return attrs