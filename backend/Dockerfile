FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
# Устанавливаем зависимости + gunicorn для продакшена
RUN pip install -r requirements.txt gunicorn
COPY . .
# Собираем статику админки Django
RUN python manage.py collectstatic --noinput
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "core.wsgi:application"]