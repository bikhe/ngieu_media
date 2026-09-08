import logging
import requests
from celery import shared_task
from django.conf import settings
from django.utils import timezone
from .models import Event, UpdateLog

logger = logging.getLogger(__name__)

ENABLE_TELEGRAM_BOT = getattr(settings, 'ENABLE_TELEGRAM_BOT', True)
TELEGRAM_BOT_TOKEN = getattr(settings, 'TELEGRAM_BOT_TOKEN', None)
TELEGRAM_WEBAPP_URL = getattr(settings, 'TELEGRAM_WEBAPP_URL', 'http://localhost:5173')

@shared_task
def send_tg_notification_task(chat_id, text, event_id=None, open_chat=False):
    if not ENABLE_TELEGRAM_BOT or not chat_id or not TELEGRAM_BOT_TOKEN:
        return
    
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML"
    }
    
    if event_id is not None:
        url = f"{TELEGRAM_WEBAPP_URL}?event_id={event_id}"
        if open_chat:
            url += "&open_chat=true"
            
        payload["reply_markup"] = {
            "inline_keyboard": [[
                {
                    "text": "💬 Открыть чат" if open_chat else "🔍 Детали съемки",
                    "web_app": {
                        "url": url
                    }
                }
            ]]
        }
        
    try:
        requests.post(f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage", json=payload, timeout=5)
    except Exception as e:
        logger.warning("Failed to send telegram notification: %s", e)

@shared_task
def check_event_deadlines():
    ENABLE_STRICT_DEADLINES = getattr(settings, 'ENABLE_STRICT_DEADLINES', True)
    if ENABLE_STRICT_DEADLINES:
        updated_count = Event.objects.filter(
            status='IN_PROGRESS', 
            deadline__lt=timezone.now()
        ).update(status='OVERDUE')
        logger.info(f"Marked {updated_count} events as OVERDUE.")

@shared_task
def cleanup_update_logs():
    try:
        if UpdateLog.objects.count() > 1000:
            old_ids = list(UpdateLog.objects.order_by('-id').values_list('id', flat=True)[1000:])
            if old_ids:
                UpdateLog.objects.filter(id__in=old_ids).delete()
                logger.info(f"Cleaned up {len(old_ids)} old update logs.")
    except Exception as e:
        logger.warning("Failed to cleanup update logs: %s", e)
