# Scope: Optional Submission Time

## Architecture
- React frontend form
- Django backend serializer / views

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Optional Submission Time | `frontend/src/pages/`, `frontend/src/components/`, `backend/api/events/serializers.py`, `backend/api/events/views.py` | none | DONE |

## Interface Contracts
### Frontend ↔ Backend
- **Events Creation**: `POST /api/events/` (or similar) accepts `deadline` as optional (can be null/empty).
