FROM python:3.11-slim
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/
WORKDIR /app

# Устанавливаем системные зависимости для PostGIS (GDAL, PROJ, etc)
RUN apt-get update && apt-get install -y --no-install-recommends \
    binutils libproj-dev gdal-bin \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
# Устанавливаем зависимости + gunicorn для продакшена
RUN uv pip install --system -r requirements.txt gunicorn
COPY . .
# Собираем статику админки Django
RUN python manage.py collectstatic --noinput
RUN adduser --disabled-password --gecos '' appuser
USER appuser
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "core.wsgi:application"]