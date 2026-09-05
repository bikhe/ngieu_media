# Handoff Report for Milestone 3: Media Self-Signup

## 1. Observation
- The frontend `EventCard.tsx` displays the "Я пойду" (Join) button for Media users if `!isParticipant && !isMyTask && !isFull && event.status !== 'PENDING'`. 
- The `isFull` check on the frontend uses `participantsCount >= event.max_participants`.
- The `HomeScreen.tsx` filters available events for Media users into `openEvents` using `e.status === 'OPEN' && !myEvents.some(...)`. Events that are `IN_PROGRESS` are hidden from the "Свободные" (Open) tab.
- In the backend `views.py` `EventViewSet.take_task`, the system uses `max_p = event.max_participants if ENABLE_MULTIPLE_PHOTOGRAPHERS else 1`. It then rejects signups with `if event.media_participants.count() >= max_p or event.status != 'OPEN': return Response({'error': 'Места заняты'}, status=400)`.
- If an admin assigns a user via `assign_participant`, the event status is unconditionally set to `IN_PROGRESS` (even if `max_participants` is not reached).
- If a user is removed via `remove_participant`, the status only reverts to `OPEN` if the count is exactly 0.

## 2. Logic Chain
- Because `assign_participant` sets `event.status = 'IN_PROGRESS'` immediately, multi-participant events drop out of `OPEN` status before they are actually full.
- Since they are no longer `OPEN`:
  1. The frontend hides them from the Media users' `openEvents` list.
  2. If a user somehow accesses the event, `take_task` rejects the signup due to the `event.status != 'OPEN'` check.
- Additionally, if `ENABLE_MULTIPLE_PHOTOGRAPHERS` is toggled off, `max_p` is forced to 1 in `take_task`, directly contradicting the requirement that Media users can sign up "as long as max_participants is not reached".

## 3. Caveats
- Assuming `ENABLE_MULTIPLE_PHOTOGRAPHERS` feature toggle should either be bypassed for this specific requirement, or the requirement implies relying purely on `max_participants`.
- Another agent is actively modifying `take_task` for R2 (Admin Attendance), so the solution must safely integrate with those changes (e.g. `request.user.role not in ['MEDIA', 'MAIN_ADMIN', 'ORGANIZER']`).

## 4. Conclusion
To ensure Media Self-Signup works properly for multi-participant events:
1. **Backend (`backend/api/events/views.py`)**:
   - In `take_task`, change the logic to use `max_participants` unconditionally: `max_p = event.max_participants`.
   - In `take_task`, allow joining if the event is in progress but not full: `if event.media_participants.count() >= max_p or event.status not in ['OPEN', 'IN_PROGRESS']: ...`
   - In `assign_participant`, only set `IN_PROGRESS` if full: `if event.media_participants.count() >= event.max_participants and event.status == 'OPEN': event.status = 'IN_PROGRESS'`
   - In `remove_participant`, revert to `OPEN` if not full: `if event.media_participants.count() < event.max_participants and event.status == 'IN_PROGRESS': event.status = 'OPEN'`
2. **Frontend (`frontend/src/components/HomeScreen.tsx`)**:
   - Update `openEvents` filter to include `IN_PROGRESS` events that are not full:
     ```typescript
     const openEvents = events.filter(
       (e) => (e.status === 'OPEN' || e.status === 'IN_PROGRESS') && !myEvents.some((m) => m.id === e.id) && e.media_participants.length < e.max_participants
     );
     ```

## 5. Verification Method
- Ensure the backend tests pass.
- From a test script or Swagger/Postman, create an event with `max_participants=3`.
- Have an Admin assign one Media user. Verify the event status is `OPEN` (not `IN_PROGRESS`).
- Have a second Media user call `take_task`. Verify it succeeds and status remains `OPEN`.
- Have a third Media user call `take_task`. Verify it succeeds and status becomes `IN_PROGRESS`.
- Have a fourth Media user call `take_task`. Verify it returns 400 'Места заняты'.
