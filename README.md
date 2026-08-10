# Media Events — Комплексная система управления медиацентром

[![Backend: Django REST Framework](https://img.shields.io/badge/Backend-Django_REST_Framework-green?style=flat-square&logo=django)](https://www.djangoproject.com/)
[![Frontend: Vite + React + TS](https://img.shields.io/badge/Frontend-React_+_Vite_+_TS-646CFF?style=flat-square&logo=react)](https://react.dev/)
[![Update Broker: FastAPI](https://img.shields.io/badge/Update_Broker-FastAPI-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Database: PostgreSQL 15](https://img.shields.io/badge/Database-PostgreSQL_15-336791?style=flat-square&logo=postgresql)](https://www.postgresql.org/)
[![Search: Meilisearch](https://img.shields.io/badge/Search-Meilisearch-FF4E61?style=flat-square&logo=meilisearch)](https://www.meilisearch.com/)
[![Tasks: Celery](https://img.shields.io/badge/Tasks-Celery-37814A?style=flat-square&logo=celery)](https://docs.celeryq.dev/)
[![Cache/Broker: Redis](https://img.shields.io/badge/Broker-Redis-DC382D?style=flat-square&logo=redis)](https://redis.io/)
[![Proxy: Nginx](https://img.shields.io/badge/Proxy-Nginx-009639?style=flat-square&logo=nginx)](https://nginx.org/)
[![Bot: Telegram API](https://img.shields.io/badge/Bot-Telegram_API-26A5E4?style=flat-square&logo=telegram)](https://core.telegram.org/bots)
[![Monitoring: Prometheus & Grafana](https://img.shields.io/badge/Monitoring-Prometheus_+_Grafana-E6522C?style=flat-square&logo=grafana)](https://grafana.com/)
[![Docker: Supported](https://img.shields.io/badge/Docker-Supported-2496ED?style=flat-square&logo=docker)](https://www.docker.com/)

**Media Events** — это комплексная экосистема для автоматизации работы медиацентра (фотографов, видеографов, монтажеров, операторов дронов). Проект позволяет организаторам оперативно создавать заявки на съемку и бронировать необходимое оборудование из единого склада, а исполнителям (СМИ) — отслеживать, находить, бронировать и брать задачи в работу через удобное кроссплатформенное веб-приложение.

---

## Архитектура системы

Система построена на базе микросервисной архитектуры с единой точкой входа через Nginx (в production) и REST API для коммуникации между компонентами. В качестве брокера сообщений и кэша используется Redis, поиск осуществляется с помощью быстрого движка Meilisearch, а фоновые задачи выполняются воркерами Celery.

### Схема взаимодействия компонентов

```mermaid
graph TD
    Client[Пользователь / Браузер] -->|Запросы 80/443| Nginx{Nginx Reverse Proxy}
    
    %% Nginx Routing
    Nginx -->|Frontend SPA| Frontend[React + Vite + TS]
    Nginx -->|/static/ & /media/| Static[Статика & Медиа]
    Nginx -->|/api/| Backend[Django REST API]
    Nginx -->|/stream/| UpdateBroker[Update Broker <br> FastAPI SSE]
    
    %% Internal Connections
    Backend -->|Чтение/Запись| DB[(PostgreSQL 15)]
    Backend -->|Полнотекстовый поиск| Meili[(Meilisearch)]
    Backend -.->|Фоновые задачи| Redis[(Redis)]
    Backend -.->|Pub/Sub обновления| Redis
    
    Celery[Celery Worker] -.->|Читает задачи| Redis
    Celery -->|Запись результатов| DB
    Celery -.->|Отправка уведомлений| TG[Telegram API]
    
    UpdateBroker -.->|Подписка на обновления| Redis
    UpdateBroker -.->|HTTP Polling (Fallback)| Backend
    
    Bot[Telegram Bot <br> Aiogram] -->|Чтение/Запись| DB
    Bot -.->|Уведомления и Команды| TG
    
    Prometheus[Prometheus] -.->|Сбор метрик| Backend
    Grafana[Grafana] -.->|Визуализация| Prometheus
```

---

## Ключевые возможности

*   **Ролевая модель и допуски:** 
    *   *Администраторы* имеют полный контроль над системой, складом техники, метриками и пользователями. При входе попадают в подробный дашборд.
    *   *Организаторы* могут создавать мероприятия, описывать требования к съемке, бронировать технику и координировать команду (с доступом на чтение и общение в чате).
    *   *Исполнители (СМИ)* видят доступные задачи в соответствии со своим профессиональным грейдом (например, PRO, VIDEO, DRONE) и принимают их в работу.
*   **Статусная модель заявок:** Заявки проходят через жизненный цикл: Ожидание (PENDING) -> Открыто (OPEN) -> В работе (IN_PROGRESS) -> На проверке / Выполнено (COMPLETED).
*   **Интегрированный склад оборудования:** При назначении исполнителя на съемку за ним автоматически или вручную закрепляется необходимый комплект техники.
*   **Event-чаты с Live Updates:** Каждая заявка снабжена локальным изолированным чатом для обсуждения технических деталей. Все новые сообщения доставляются в реальном времени через Server-Sent Events (SSE).
*   **Мгновенный поиск:** Интеграция с Meilisearch позволяет осуществлять опечаточный (typo-tolerant) и невероятно быстрый поиск по заявкам, оборудованию и пользователям.
*   **Фоновые задачи:** Тяжелые операции (например, экспорт отчетов, массовые рассылки) вынесены в асинхронные задачи с использованием Celery.
*   **Telegram-бот:** Автоматически оповещает организаторов и исполнителей о статусах заявок. Написан на базе асинхронного фреймворка `aiogram`.
*   **Мониторинг:** Встроенный сбор метрик посредством `django-prometheus` с визуализацией состояния системы через Grafana.
*   **Динамические Feature Toggles:** Гибкое отключение/подключение модулей системы без пересборки.

---

## Технологический стек

### Frontend
*   **React 19 + TypeScript** — основа пользовательского интерфейса.
*   **Vite 8** — сверхбыстрый сборщик проектов.
*   **Material UI (MUI v9)** — библиотека готовых компонентов с поддержкой тем (включая `@emotion`).
*   **React Router v7** — клиентская маршрутизация.
*   **Axios** — HTTP-клиент для взаимодействия с API.

### Backend
*   **Python 3.x**
*   **Django 4.2+ & Django REST Framework (DRF)** — основное API.
*   **FastAPI** — выделенный высокопроизводительный сервис (Update Broker) для раздачи Server-Sent Events (SSE) клиентам.
*   **Celery** — обработчик фоновых задач.
*   **Aiogram** — асинхронный фреймворк для Telegram-бота.
*   **Gunicorn** — WSGI HTTP сервер.

### Инфраструктура и Хранение данных
*   **PostgreSQL 15 (PostGIS)** — основное реляционное хранилище.
*   **Redis 7** — брокер сообщений для Celery, кэш и Pub/Sub для Update Broker.
*   **Meilisearch v1.12** — поисковый движок.
*   **Prometheus + Grafana** — мониторинг и метрики.
*   **Nginx** — веб-сервер и обратный прокси.
*   **Docker & Docker Compose** — контейнеризация всех компонентов.

---

## Структура репозитория

```bash
├── frontend/           # Единое кроссплатформенное SPA (React, Vite, TS, MUI)
├── backend/            # Серверная часть (микросервисы)
│   ├── api/            # Основной REST API, Celery-воркер и Telegram-бот (Django, DRF)
│   └── update-broker/  # Микросервис для Real-Time обновлений по SSE (FastAPI)
├── nginx/              # Конфигурационные файлы Nginx для production-сборки
├── docker-compose.yml  # Локальный Docker-compose (Development) со всеми сервисами
└── docker-compose.prod.yml # Боевой Docker-compose (Production)
```

---

## Быстрый старт (Локальная разработка)

Все компоненты полностью контейнеризированы, что позволяет запустить весь стек (включая БД, кэш, поиск и мониторинг) одной командой.

### Шаг 1. Переменные окружения (`.env`)

Создайте файлы конфигурации на основе примеров. Для быстрого запуска в режиме разработки файлы `.env` уже преднастроены со стандартными значениями:

*   В папке `backend/api/` проверьте файл `.env` (если планируете использовать Telegram-уведомления, укажите ваш `TELEGRAM_BOT_TOKEN`).
*   В папке `frontend/` проверьте файл `.env` (по умолчанию `VITE_API_URL=http://localhost:8000/api`).

### Шаг 2. Запуск контейнеров

В корневой директории проекта выполните команду сборки и запуска:
```bash
docker compose up -d --build
```

Будут запущены следующие сервисы: `db` (Postgres), `redis`, `meilisearch`, `backend`, `frontend`, `update-broker`, `bot`, `celery_worker`, `prometheus`, и `grafana`.

### Шаг 3. Миграции и создание Администратора

Миграции базы данных применяются автоматически при старте основного контейнера `backend`. Чтобы войти в панель управления, создайте суперпользователя:
```bash
docker compose exec backend python manage.py createsuperuser
```
Введите имя пользователя, email и пароль.

### Локальные адреса сервисов:

*   **Frontend (React/Vite):** [http://localhost:5173/](http://localhost:5173/)
*   **Django Admin (Бэкенд панель):** [http://localhost:8000/admin/](http://localhost:8000/admin/)
*   **Интерактивная REST API документация:** [http://localhost:8000/api/](http://localhost:8000/api/)
*   **FastAPI Update Broker:** [http://localhost:8001/stream](http://localhost:8001/stream)
*   **Grafana Dashboards:** [http://localhost:3000/](http://localhost:3000/) (по умолчанию admin:admin)
*   **Meilisearch:** [http://localhost:7700/](http://localhost:7700/)

---

## Развертывание в Production

Для боевого сервера используется файл конфигурации `docker-compose.prod.yml`, обеспечивающий сборку фронтенд-приложения в статические файлы и их раздачу через оптимизированный Nginx с поддержкой SSL-сертификатов.

### Инструкция по деплою:

1.  **Настройка доменов и DNS:** 
    Направьте ваши поддомены (например, `admin.yourdomain.com`, `mobile.yourdomain.com`, `api.yourdomain.com`) на IP-адрес вашего сервера.
2.  **Генерация SSL-сертификатов:**
    Установите `certbot` на сервере и получите сертификаты. Nginx ожидает пути `/etc/letsencrypt/live/...`.
3.  **Переменные окружения для Production:**
    Отредактируйте `.env` файлы. В `backend/api/.env.prod` переведите `DEBUG=False`, укажите надежный `SECRET_KEY`, ключи доступа к Meilisearch (`MEILI_MASTER_KEY`), а также боевые реквизиты PostgreSQL.
4.  **Запуск production-окружения:**
    ```bash
    docker compose -f docker-compose.prod.yml up -d --build
    ```
5.  **Сбор статики Django:**
    Выполните сборку статических файлов бэкенда для их корректной раздачи через Nginx:
    ```bash
    docker compose -f docker-compose.prod.yml exec backend python manage.py collectstatic --noinput
    ```

Детальную информацию о деплое можно найти в файле [deploy.md](deploy.md).

---

## Полезные команды при администрировании

*   **Просмотр логов всех контейнеров в реальном времени:**
    ```bash
    docker compose logs -f
    ```
*   **Просмотр логов конкретного сервиса (например, Telegram-бота или Celery-воркера):**
    ```bash
    docker compose logs -f bot
    docker compose logs -f celery_worker
    ```
*   **Принудительная остановка системы и очистка всех данных БД и кэшей:**
    ```bash
    docker compose down -v
    ```
*   **Вход внутрь контейнера бэкенда для отладки (Django shell):**
    ```bash
    docker compose exec backend python manage.py shell
    ```
*   **Переиндексация базы данных в Meilisearch:**
    ```bash
    # (Требуется наличие соответствующей management команды в Django)
    docker compose exec backend python manage.py ... 
    ```

---

## Лицензия

Проект распространяется под лицензией **MIT**. Подробности в файле [LICENSE](LICENSE).
