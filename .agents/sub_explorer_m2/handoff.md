# Observation
- In `backend/api/events/views.py`, the `take_task` action currently rejects any request where `event.media_participants.count() >= max_p or event.status != 'OPEN'`, regardless of the user's role (except checking for `is_admin_or_org` earlier but not applying it to the capacity/status constraint).
- In `frontend/src/components/EventCard.tsx`, the "Я пойду" button is hidden when `isFull` or when `event.status === 'PENDING'`, restricting admins from seeing the button if the event is full or already in progress (meaning it's not OPEN).
- The SCOPE.md requires an admin to be able to join an event's `media_participants` list, and for the frontend to show a "Пойти на мероприятие" button for admins if they are not already participating.

# Logic Chain
1. We need to modify `views.py` inside `EventViewSet.take_task` to allow `is_admin_or_org` users to bypass the capacity (`max_p`) and status (`OPEN`) check.
   - The line `if event.media_participants.count() >= max_p or event.status != 'OPEN':` should become:
     `if not is_admin_or_org and (event.media_participants.count() >= max_p or event.status != 'OPEN'):`
2. We need to modify `frontend/src/components/EventCard.tsx` to conditionally show the take task button.
   - For regular users, it should be shown if `!isFull` and `event.status === 'OPEN'`. 
   - For admins, it should be shown simply if `!isMyTask` and `event.status !== 'PENDING'`. 
   - The button text can be "Пойти на мероприятие" for admins, or we can just update the existing "Я пойду" button to have dynamic text or visibility.

# Caveats
- "Admin" typically corresponds to `MAIN_ADMIN` or `ORGANIZER` in this application context based on `is_admin_or_org`. The frontend currently identifies admin via `currentUser.role === 'MAIN_ADMIN' || currentUser.is_staff || currentUser.is_superuser` or similar. I'll rely on the existing `isAdmin` constant in `EventCard.tsx` (which is `currentUser.role === 'MAIN_ADMIN' || currentUser.is_staff || currentUser.is_superuser`).

# Conclusion
Modify the backend API (`take_task` in `views.py`) to bypass capacity and status checks for `is_admin_or_org` users. Update `EventCard.tsx` on the frontend to render the "Пойти на мероприятие" button for admins as long as they are not already participating and the event is not PENDING.

# Verification Method
1. Modify `views.py` and `EventCard.tsx`.
2. Start the backend (`python manage.py runserver`) and frontend (`npm run dev`).
3. Log in as an admin, navigate to an event that is full or in progress, and click "Пойти на мероприятие".
4. Verify the backend successfully adds the admin to `media_participants` and the UI updates.
