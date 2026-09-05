# Scope: Admin Attendance Button

## Architecture
- Backend: Django API (`backend/api/events`), serving REST endpoints.
- Frontend: React / Vite app (`frontend/src`), handling UI.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Admin Attendance Button | `frontend/src/components/`, `backend/api/events/views.py`, `backend/api/events/urls.py` | none | PLANNED |

## Interface Contracts
- **Admin Attendance**: Add an endpoint or update an existing one so an admin can join the event's `media_participants` list. The frontend should show a "Пойти на мероприятие" button for admins if they are not already participating.
