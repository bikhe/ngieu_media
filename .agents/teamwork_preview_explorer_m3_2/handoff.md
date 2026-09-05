# Handoff Report: Media Self-Signup (R3)

## 1. Observation
- The backend `take_task` endpoint in `backend/api/events/views.py` (line 494) explicitly rejects join requests if the event status is not exactly `'OPEN'`: `if event.media_participants.count() >= max_p or event.status != 'OPEN': return Response({'error': 'Места заняты'}, status=400)`.
- The frontend `openEvents` filter in `frontend/src/components/HomeScreen.tsx` (line 327) only includes events where `e.status === 'OPEN'`. If an event becomes `'IN_PROGRESS'` (e.g. after a partial assignment by an admin), it disappears from the Media user's home screen, even if `max_participants` is not reached.
- In `frontend/src/components/EventCard.tsx` (line 312), the "Я пойду" / "Пойти на мероприятие" button is shown as long as `event.status !== 'PENDING'`. This incorrectly shows the button on `'COMPLETED'` and `'OVERDUE'` events, leading to a backend rejection if clicked.

## 2. Logic Chain
- To fulfill the requirement "Any Media user can sign up as long as max_participants is not reached", the backend must accept signups for events in both `'OPEN'` and `'IN_PROGRESS'` states, provided the current participant count is below `max_participants`.
- The frontend `openEvents` feed must be updated to display `'IN_PROGRESS'` events that are not yet full, so Media users can discover and join them.
- Restricting the UI button visibility in `EventCard` strictly to `'OPEN'` and `'IN_PROGRESS'` states prevents invalid signup attempts on closed events. The button label can also be aligned closer to "Take event" ("Взять задачу").

## 3. Caveats
- No caveats. The backend `take_task` endpoint already perfectly handles adding the user to the `media_participants` list, checking skill levels, and booking equipment.

## 4. Conclusion
Apply the following fixes:

**Backend (`backend/api/events/views.py`)**:
- In `EventViewSet.take_task`, change the status check to allow `'IN_PROGRESS'`:
  ```python
  if event.media_participants.count() >= max_p or event.status not in ['OPEN', 'IN_PROGRESS']: return Response({'error': 'Места заняты'}, status=400)
  ```

**Frontend (`frontend/src/components/HomeScreen.tsx`)**:
- Update `openEvents` filter to include non-full `'IN_PROGRESS'` events:
  ```typescript
  const openEvents = events.filter(
    (e) => ['OPEN', 'IN_PROGRESS'].includes(e.status) && 
           (e.media_participants?.length || 0) < (e.max_participants || 1) && 
           !myEvents.some((m) => m.id === e.id)
  );
  ```

**Frontend (`frontend/src/components/EventCard.tsx`)**:
- Restrict button visibility and update label:
  ```typescript
  {!isParticipant && !isMyTask && !isFull && (event.status === 'OPEN' || event.status === 'IN_PROGRESS') && (
    <Button ...>
      {isAdmin ? 'Пойти на мероприятие' : 'Взять задачу'}
    </Button>
  )}
  ```

## 5. Verification Method
- Inspect the modified files to ensure the conditions correctly check for both `'OPEN'` and `'IN_PROGRESS'`.
- Run frontend build/tests to ensure syntax is valid.
- Test manually or via integration tests that a Media user can successfully take a task, and that a second Media user can join a task that is `'IN_PROGRESS'` if `max_participants` > 1.
