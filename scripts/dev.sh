#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG_FILE="${DEV_CONFIG_FILE:-$ROOT_DIR/.dev.env}"
RUNTIME_DIR="$ROOT_DIR/.dev"
LOG_DIR="$RUNTIME_DIR/logs"
PID_DIR="$RUNTIME_DIR/pids"

BACKEND_DIR="$ROOT_DIR/backend/api"
BROKER_DIR="$ROOT_DIR/backend/update-broker"
FRONTEND_DIR="$ROOT_DIR/frontend"

mkdir -p "$LOG_DIR" "$PID_DIR"

load_config() {
  if [[ -f "$CONFIG_FILE" ]]; then
    # shellcheck disable=SC1090
    source "$CONFIG_FILE"
  fi

  : "${PYTHON_BIN:=python3}"
  : "${BACKEND_HOST:=127.0.0.1}"
  : "${BACKEND_PORT:=8000}"
  : "${BROKER_HOST:=127.0.0.1}"
  : "${BROKER_PORT:=8001}"
  : "${FRONTEND_HOST:=127.0.0.1}"
  : "${FRONTEND_PORT:=5173}"
  : "${REDIS_URL:=redis://127.0.0.1:6379/0}"
  : "${DB_HOST:=127.0.0.1}"
  : "${DB_PORT:=5432}"
  : "${DB_NAME:=events_db}"
  : "${DB_USER:=events_user}"
  : "${DB_PASSWORD:=dev_password}"
  REDIS_ENDPOINT="${REDIS_URL#*://}"
  REDIS_ENDPOINT="${REDIS_ENDPOINT%%/*}"
  REDIS_HOST="${REDIS_ENDPOINT%%:*}"
  if [[ "$REDIS_ENDPOINT" == *:* ]]; then
    REDIS_PORT="${REDIS_ENDPOINT##*:}"
  else
    REDIS_PORT=6379
  fi
  apply_config_env
}

apply_config_env() {
  export DB_HOST DB_PORT DB_NAME DB_USER DB_PASSWORD
  export REDIS_HOST REDIS_PORT
  export CELERY_BROKER_URL="$REDIS_URL"
}

save_config() {
  cat > "$CONFIG_FILE" <<EOF
# Local development launcher settings. This file is ignored by git.
PYTHON_BIN=${PYTHON_BIN@Q}
BACKEND_HOST=${BACKEND_HOST@Q}
BACKEND_PORT=${BACKEND_PORT@Q}
BROKER_HOST=${BROKER_HOST@Q}
BROKER_PORT=${BROKER_PORT@Q}
FRONTEND_HOST=${FRONTEND_HOST@Q}
FRONTEND_PORT=${FRONTEND_PORT@Q}
REDIS_URL=${REDIS_URL@Q}
DB_HOST=${DB_HOST@Q}
DB_PORT=${DB_PORT@Q}
DB_NAME=${DB_NAME@Q}
DB_USER=${DB_USER@Q}
DB_PASSWORD=${DB_PASSWORD@Q}
EOF
}

ensure_backend_env() {
  local env_file="$BACKEND_DIR/.env"
  local temp_file
  temp_file="$(mktemp)"
  if [[ -f "$env_file" ]]; then
    awk '!/^(DB_NAME|DB_USER|DB_PASSWORD|DB_HOST|DB_PORT|REDIS_HOST|REDIS_PORT|CELERY_BROKER_URL|TELEGRAM_WEBAPP_URL|CORS_ALLOW_ALL_ORIGINS|ENABLE_TELEGRAM_BOT)=/' "$env_file" > "$temp_file"
  else
    printf '%s\n' \
      'SECRET_KEY=dev-only-secret-key' \
      'DEBUG=True' \
      'ALLOWED_HOSTS=localhost,127.0.0.1' > "$temp_file"
  fi
  cat >> "$temp_file" <<EOF
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_HOST=$DB_HOST
DB_PORT=$DB_PORT
REDIS_HOST=$REDIS_HOST
REDIS_PORT=$REDIS_PORT
CELERY_BROKER_URL=$REDIS_URL
TELEGRAM_WEBAPP_URL=http://localhost:$FRONTEND_PORT
CORS_ALLOW_ALL_ORIGINS=True
ENABLE_TELEGRAM_BOT=False
EOF
  mv "$temp_file" "$env_file"
  echo "Синхронизирован $env_file с настройками лаунчера."
}

venv_python() {
  echo "$BACKEND_DIR/.venv/bin/python"
}

check_command() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Не найдена команда '$1'. Установите зависимость и повторите."
    return 1
  }
}

check_infrastructure() {
  local failed=0
  check_command "$PYTHON_BIN" || failed=1
  check_command npm || failed=1
  check_command curl || failed=1

  if ! (echo >/dev/tcp/"$DB_HOST"/"$DB_PORT") 2>/dev/null; then
    echo "PostgreSQL недоступен на $DB_HOST:$DB_PORT."
    failed=1
  fi
  if ! (echo >/dev/tcp/"$REDIS_HOST"/"$REDIS_PORT") 2>/dev/null; then
    echo "Redis недоступен на $REDIS_HOST:$REDIS_PORT."
    failed=1
  fi
  return "$failed"
}

prepare() {
  check_command "$PYTHON_BIN"
  check_command npm
  ensure_backend_env

  if [[ ! -x "$(venv_python)" ]]; then
    echo "Создаю Python-окружение backend/api/.venv..."
    "$PYTHON_BIN" -m venv "$BACKEND_DIR/.venv"
  fi
  "$(venv_python)" -m pip install -r "$BACKEND_DIR/requirements.txt"
  "$PYTHON_BIN" -m venv "$BROKER_DIR/.venv"
  "$BROKER_DIR/.venv/bin/python" -m pip install -r "$BROKER_DIR/requirements.txt"
  npm ci --prefix "$FRONTEND_DIR"
  echo "Зависимости установлены."
}

service_pid_file() { echo "$PID_DIR/$1.pid"; }
service_log_file() { echo "$LOG_DIR/$1.log"; }

is_running() {
  local pid_file="$1" pid
  [[ -f "$pid_file" ]] || return 1
  pid="$(cat "$pid_file")"
  kill -0 "$pid" 2>/dev/null
}

start_service() {
  local service="$1" pid_file command
  pid_file="$(service_pid_file "$service")"

  if is_running "$pid_file"; then
    echo "$service уже запущен (PID $(cat "$pid_file"))."
    return
  fi

  case "$service" in
    backend)
      ensure_backend_env
      command=("$BACKEND_DIR/.venv/bin/python" "$BACKEND_DIR/manage.py" runserver --noreload "$BACKEND_HOST:$BACKEND_PORT")
      ;;
    broker)
      command=(env BACKEND_URL="http://$BACKEND_HOST:$BACKEND_PORT" CORS_ALLOWED_ORIGINS="http://localhost:$FRONTEND_PORT" "$BROKER_DIR/.venv/bin/uvicorn" main:app --host "$BROKER_HOST" --port "$BROKER_PORT")
      ;;
    frontend)
      command=(env VITE_API_URL="http://$BACKEND_HOST:$BACKEND_PORT/api" npm run dev --prefix "$FRONTEND_DIR" -- --host "$FRONTEND_HOST" --port "$FRONTEND_PORT")
      ;;
    celery)
      command=("$BACKEND_DIR/.venv/bin/celery" -A core worker -l info)
      ;;
    *)
      echo "Неизвестный сервис: $service"
      return 1
      ;;
  esac

  if [[ "${command[0]}" == "env" ]]; then
    local executable_index=3
    [[ "${command[2]}" == "npm" ]] && executable_index=2
    [[ -x "${command[$executable_index]}" ]] || {
      echo "Сначала выберите пункт подготовки зависимостей."
      return 1
    }
  elif [[ ! -x "${command[0]}" ]] && [[ "${command[0]}" != "npm" ]]; then
    echo "Сначала выберите пункт подготовки зависимостей."
    return 1
  fi

  echo "Запуск $service... Лог: $(service_log_file "$service")"
  (
    cd "$BACKEND_DIR"
    if [[ "$service" == broker ]]; then
      cd "$BROKER_DIR"
    elif [[ "$service" == frontend ]]; then
      cd "$FRONTEND_DIR"
    fi
    setsid nohup "${command[@]}" >> "$(service_log_file "$service")" 2>&1 &
    echo $! > "$pid_file"
  )
  sleep 1
  is_running "$pid_file" || {
    echo "$service не запустился. Проверьте лог: $(service_log_file "$service")"
    return 1
  }
}

stop_service() {
  local service="$1" pid_file pid
  pid_file="$(service_pid_file "$service")"
  if ! is_running "$pid_file"; then
    rm -f "$pid_file"
    echo "$service не запущен."
    return
  fi
  pid="$(cat "$pid_file")"
  kill -TERM -- "-$pid" 2>/dev/null || kill "$pid"
  for _ in {1..20}; do
    is_running "$pid_file" || break
    sleep 0.25
  done
  if is_running "$pid_file"; then
    kill -KILL -- "-$pid" 2>/dev/null || kill -KILL "$pid"
  fi
  rm -f "$pid_file"
  echo "$service остановлен."
}

status() {
  local service
  for service in backend broker frontend celery; do
    if is_running "$(service_pid_file "$service")"; then
      echo "[ON ] $service (PID $(cat "$(service_pid_file "$service")"))"
    else
      echo "[OFF] $service"
    fi
  done
}

start_default() {
  check_infrastructure || echo "Предупреждение: инфраструктура проверена не полностью."
  prepare
  "$(venv_python)" "$BACKEND_DIR/manage.py" migrate
  start_service backend
  start_service broker
  start_service frontend
}

stop_all() {
  stop_service celery
  stop_service frontend
  stop_service broker
  stop_service backend
}

configure() {
  local value
  read -r -p "Backend port [$BACKEND_PORT]: " value; [[ -n "$value" ]] && BACKEND_PORT="$value"
  read -r -p "Update broker port [$BROKER_PORT]: " value; [[ -n "$value" ]] && BROKER_PORT="$value"
  read -r -p "Frontend port [$FRONTEND_PORT]: " value; [[ -n "$value" ]] && FRONTEND_PORT="$value"
  read -r -p "PostgreSQL host [$DB_HOST]: " value; [[ -n "$value" ]] && DB_HOST="$value"
  read -r -p "PostgreSQL port [$DB_PORT]: " value; [[ -n "$value" ]] && DB_PORT="$value"
  read -r -p "Redis URL [$REDIS_URL]: " value; [[ -n "$value" ]] && REDIS_URL="$value"
  save_config
  apply_config_env
  echo "Конфигурация сохранена в $CONFIG_FILE."
}

menu() {
  while true; do
    echo
    echo "=== Media Events: локальная разработка ==="
    echo "1) Запустить основной набор (backend + broker + frontend)"
    echo "2) Запустить сервис"
    echo "3) Остановить сервис"
    echo "4) Запустить Celery"
    echo "5) Остановить все"
    echo "6) Статус"
    echo "7) Показать лог"
    echo "8) Настроить порты и подключения"
    echo "9) Установить/обновить зависимости"
    echo "0) Выход"
    read -r -p "Выбор: " choice
    case "$choice" in
      1) start_default ;;
      2) read -r -p "Сервис (backend/broker/frontend): " service; start_service "$service" ;;
      3) read -r -p "Сервис (backend/broker/frontend/celery): " service; stop_service "$service" ;;
      4) start_service celery ;;
      5) stop_all ;;
      6) status ;;
      7) read -r -p "Сервис (backend/broker/frontend/celery): " service; tail -n 80 -f "$(service_log_file "$service")" ;;
      8) configure ;;
      9) prepare ;;
      0) exit 0 ;;
      *) echo "Неизвестный пункт." ;;
    esac
  done
}

load_config
save_config
case "${1:-menu}" in
  all) start_default ;;
  stop) stop_all ;;
  status) status ;;
  menu) menu ;;
  *) echo "Использование: $0 [menu|all|stop|status]"; exit 2 ;;
esac
