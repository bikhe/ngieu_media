# Handoff Report: Milestone 3 'Media Self-Signup'

## Observation
- The initial problem was that Media users could not sign up for events that were partially filled, because the backend and frontend strict-checked for `OPEN` status, whereas an event with 1 participant (but max > 1) was set to `IN_PROGRESS`.
- Explorers identified the needed changes in `backend/api/events/views.py` (`take_task` method), `frontend/src/components/HomeScreen.tsx` (`openEvents` filter), and `frontend/src/components/EventCard.tsx` (button visibility).

## Logic Chain
- The Worker successfully updated the backend `take_task` check to allow `IN_PROGRESS` as well as `OPEN`.
- The Worker updated the `openEvents` frontend filter to show `IN_PROGRESS` events that are not full.
- The Worker updated the EventCard button visibility to appear for `OPEN` and `IN_PROGRESS` events, checking if it is full.

## Caveats
- Challenger 1 noted an existing flaw in the application where if multiple participants are assigned, the *first* one submitting work changes the status to `COMPLETED`, locking out others. This is an existing bug that was out of scope for this milestone but should be noted.

## Conclusion
- Milestone 3 is `DONE`. The Media self-signup logic now works correctly for partially filled events up to `max_participants`.

## Verification
- Reviewer 1 and 2 passed the implementation manually via static logic verification.
- Challenger 1 and 2 passed the implementation regarding the milestone's acceptance criteria.
- Forensic Auditor passed the integrity checks with a CLEAN verdict.
