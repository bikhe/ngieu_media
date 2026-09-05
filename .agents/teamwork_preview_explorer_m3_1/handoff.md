# Handoff Report: Media Self-Signup Fix

## Observation
1. In `backend/api/events/views.py`, the `take_task` method strictly requires the event status to be `'OPEN'` (`if event.media_participants.count() >= max_p or event.status != 'OPEN': return Response({'error': 'Места заняты'}, status=400)`).
2. In `backend/api/events/views.py`, the `assign_participant` method forcefully sets the event status to `'IN_PROGRESS'` as soon as one participant is added (`if event.status == 'OPEN': event.status = 'IN_PROGRESS'`), regardless of whether `max_participants` has been reached.
3. In `frontend/src/components/HomeScreen.tsx`, the `openEvents` list is filtered strictly by `e.status === 'OPEN'` (`const openEvents = events.filter((e) => e.status === 'OPEN' && ...)`), completely hiding any `IN_PROGRESS` events from the "Свободные" (Open) tab.
4. In `frontend/src/components/EventCard.tsx`, the "Я пойду" (Join) button renders without checking the `hasAccess` variable, which means users who do not meet the `required_skill` will see the button but receive a 403 error upon clicking.

## Logic Chain
1. If an event has `max_participants > 1`, and an Admin assigns a single participant via `assign_participant` (or a Media user joins and then another leaves), the event's status becomes or remains `'IN_PROGRESS'`.
2. Because `HomeScreen.tsx` only shows `'OPEN'` events in the open tab, Media users will not see this partially filled event on their Home Screen. 
3. Even if the event were displayed, if a Media user clicked "Я пойду", the `take_task` API would reject them because the status is `'IN_PROGRESS'`, not `'OPEN'`, violating the requirement that "Any Media user can sign up as long as max_participants is not reached."
4. Furthermore, the frontend button in `EventCard.tsx` needs to check `hasAccess` to ensure it accurately reflects whether the user is permitted to sign up based on their `skill_level`.

## Caveats
- I did not modify any code per the read-only constraints.
- This fix assumes that `IN_PROGRESS` means "partially or fully staffed and ongoing". If the business logic expects a different status for partially filled events (e.g., remaining `OPEN`), an alternative would be to change `assign_participant` and `remove_participant` to keep the status `'OPEN'` until `max_participants` is reached. However, allowing signups for `IN_PROGRESS` is safer and requires fewer state-transition changes.

## Conclusion
To fully enable Media Self-Signup for all open slots, the system must allow signups for `IN_PROGRESS` events that are not yet full. 
**Proposed Fixes**:
1. **Backend (`backend/api/events/views.py`)**: Update `take_task` to allow joining if the event is `OPEN` or `IN_PROGRESS`:
   `if event.media_participants.count() >= max_p or event.status not in ['OPEN', 'IN_PROGRESS']: return Response({'error': 'Места заняты'}, status=400)`
2. **Frontend (`frontend/src/components/HomeScreen.tsx`)**: Update the `openEvents` filter to include `IN_PROGRESS` events that have available slots:
   `const openEvents = events.filter((e) => (e.status === 'OPEN' || (e.status === 'IN_PROGRESS' && (e.media_participants?.length || 0) < e.max_participants)) && !myEvents.some((m) => m.id === e.id));`
3. **Frontend (`frontend/src/components/EventCard.tsx`)**: Update the "Я пойду" button rendering condition to check `hasAccess` and explicitly allow `OPEN` or `IN_PROGRESS`:
   `{!isMyTask && !isFull && (event.status === 'OPEN' || event.status === 'IN_PROGRESS') && hasAccess && (`

## Verification Method
1. Create an event with `max_participants = 3` and status `OPEN`.
2. Admin assigns one Media user to it. (Observe the event status becomes `IN_PROGRESS`).
3. Log in as a different Media user.
4. Verify the event still appears in the "Свободные" tab on the Home Screen.
5. Click "Я пойду" and verify the signup succeeds and the participant count increments.
