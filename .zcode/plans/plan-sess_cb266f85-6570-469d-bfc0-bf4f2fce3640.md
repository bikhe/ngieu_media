# План: чистка от вайбкода, фиксы сборки, аудит безопасности

## 1. Восстановление бэкенда
- `git restore backend/` — вернуть все удалённые файлы Django API (`backend/api/`), update-broker, миграции, `requirements.txt`, Dockerfile, `.env.example`.
- Удалить stale `__pycache__` (root-owned) в `backend/`.
- Проверить, что `docker-compose.yml` / `docker-compose.prod.yml` снова консистентны (build-контексты, env_file).
- Убрать устаревший ключ `version: '3.8'` из `docker-compose.prod.yml`.

## 2. Фронтенд — полный фикс линта (106 ошибок / 6 варнингов)
- Включить в `tsconfig.app.json`: `strict: true`, `noUnusedLocals`, `noUnusedParameters`.
- Типизировать все 88 `no-explicit-any` (в первую очередь `Analytics.tsx` ~25 шт., `CalendarView.tsx`, `UsersManagement.tsx`, `Dashboard.tsx`, `HomeScreen.tsx`).
- Удалить неиспользуемый тип `Author` в `ChatDrawer.tsx:18`.
- Починить нарушения react-hooks: 10× `set-state-in-effect`, 3× `immutability`, 2× запись в `ref.current` во время рендера (`useUpdatesBroker.ts:20,22`), 5× `exhaustive-deps`, stale `eslint-disable` (`useUpdatesBroker.ts:92`), `react-refresh/only-export-components` (`ThemeSettingsContext.tsx`).
- Добиться `npx eslint .` → 0 ошибок и зелёного `npm run build` + включить code-splitting, чтобы убрать варнинг про чанк 884 КБ (lazy-загрузка admin-страниц).
- Удалить unused-ассеты `hero.png`, `vite.svg`, `react.svg`.

## 3. Мусор в репозитории
- Удалить из репо: `dist/` (добавить в `.gitignore`), `node_modules/` в корне (если трекается), `tmp.log`, `test_auth.py`, `check_events.py`, `test_admin_attendance.py`, `handoff.md`, `PROJECT.md` (если дублирует README), `TEST_READY.md`, дублирующую заготовку `e2e/example.spec.ts` + её конфиг, `frontend/test_lucide.js`.
- Прочитать `TEST_INFRA.md` / `playwright.config.ts` перед удалением, чтобы не сломать реальные тесты в `tests/e2e/`.

## 4. Безопасность
- **JWT в query-параметре (критично):** `/api/updates/` (`backend/api/events/views.py:941`) и SSE-брокер (`backend/update-broker/main.py:37`) — заменить на одноразовые короткоживущие тикеты: фронт запрашивает тикет аутентифицированным POST, брокер передаёт тикет, бэкенд валидирует одноразово. Убрать `token` из URL.
- **password123:** удалить хардкод `admin`/`password123` из `tests/e2e/e2e.spec.ts` (~40 мест) и вынести в env (`E2E_ADMIN_USER`/`E2E_ADMIN_PASSWORD` с дефолтом-плейсхолдером).
- **Telegram token fallback:** заменить `os.getenv('TELEGRAM_BOT_TOKEN', 'ТВОЙ_ТОКЕН_ИЗ_BOTFATHER')` на fail-fast (ошибка запуска без переменной) — `settings.py:158`, `views.py:35`, `run_bot.py:14`.
- **localStorage-токены:** оставить как есть (объёмная переделка), но отметить в отчёте как известный риск; по желанию — сократить REFRESH_TOKEN_LIFETIME с 30 дней.
- **`dangerouslySetInnerHTML`** в `Analytics.tsx:630` — заменить статическим импортом CSS.
- **История git:** найти закоммиченный секрет (`git log -S`), вычистить через `git filter-repo` (или `filter-branch`/BFG, если filter-repo недоступен) и предупредить, что нужен force-push и ротация секретов.

## 5. Верификация
- `npm run build` (tsc + vite) — 0 ошибок, 0 варнингов (или объяснённые).
- `npx eslint .` — 0 ошибок.
- Бэкенд: `python manage.py check` / `makemigrations --check --dry-run` (если есть python-окружение; иначе хотя бы синтаксическая проверка).
- `docker compose config` — валидация обоих compose-файлов.
- Финальный `git status` и сводка всех изменений.