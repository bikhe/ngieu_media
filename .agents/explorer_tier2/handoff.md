# Handoff Report: Tier 2 Boundary & Corner Case Tests Design

## Observation
1. **Infrastructure & Requirements Specification**:
   - `TEST_INFRA.md` (lines 8-13, 28-33) specifies Category-Partition, Boundary Value Analysis (BVA), and Workload Testing across 3 core features, requiring 15 Tier 2 tests (5 for each feature).
   - `.agents/ORIGINAL_REQUEST.md` (lines 12-20) defines the 3 core features:
     - **R1: Make Submission Time Optional**: Event creation succeeds when deadline is omitted, with 7-day fallback logic.
     - **R2: Admin Attendance Button**: Admin can join open events via "Пойти на мероприятие" and be added to `media_participants`.
     - **R3: Media Self-Signup**: Media users ('MEDIA' role) can self-enroll into events provided `max_participants` has not been reached.
2. **Current Test Suite State**:
   - `tests/e2e/e2e.spec.ts` (lines 1-118) contains 15 baseline Tier 1 tests covering standard positive/happy paths and single interactions. Tier 3 (pairwise) and Tier 4 (scenarios) are also defined (lines 119-224). Tier 2 tests are needed to cover boundary, edge, and corner cases.
3. **Backend Logic & Data Model Constraints**:
   - `backend/api/events/models.py` (lines 154-181): `Event` model defines `date` (DateField), `deadline` (DateTimeField, nullable), `status` (`PENDING`, `OPEN`, `IN_PROGRESS`, `COMPLETED`, `REJECTED`, `OVERDUE`), `max_participants` (PositiveIntegerField, default 1), and `media_participants` (ManyToManyField to User).
   - `backend/api/events/serializers.py` (lines 63-90): `to_internal_value` normalizes empty string `deadline` to `None`. `validate()` sets `attrs['deadline'] = make_aware(datetime.combine(date + timedelta(days=7), time(23, 59, 59)), get_current_timezone())` if deadline is omitted.
   - `backend/api/events/views.py` (lines 480-556): `take_task` enforces:
     - Role access: `request.user.role in ['MEDIA', 'MAIN_ADMIN', 'ORGANIZER']`.
     - Skill check: `if not is_admin_or_org and ENABLE_SKILL_LEVELS and event.required_skill != 'ANY' and request.user.skill_level not in [event.required_skill, 'PRO']: return Response({'error': 'Нужен VIP доступ'}, status=403)`.
     - Duplicate prevention: `if request.user in event.media_participants.all(): return Response({'error': 'Уже взято'}, status=400)`.
     - Capacity check: `if event.media_participants.count() >= max_p or event.status not in ['OPEN', 'IN_PROGRESS']: return Response({'error': 'Места заняты'}, status=400)`.
     - Status transition: `if event.media_participants.count() >= max_p: event.status = 'IN_PROGRESS'`.
4. **Frontend UI State & Action Elements**:
   - `frontend/src/components/EventFormModal.tsx` (lines 81-102, 213-216): Form handles empty/unspecified deadline by converting `""` to `null` in payload.
   - `frontend/src/components/EventCard.tsx` (lines 125-136, 312-322): Attendance button is rendered when `!isParticipant && !isMyTask && !isFull && (event.status === 'OPEN' || event.status === 'IN_PROGRESS')`. Text is `'Пойти на мероприятие'` for admins and `'Я пойду'` for media users.

---

## Logic Chain
Based on the observations, we apply opaque-box Category-Partition and Boundary Value Analysis (BVA) across the input domains, lifecycle state machines, capacity thresholds, and temporal limits for each feature.

```
Observations (Models, Serializers, Views, UI)
               │
               ├── Input & Datetime Boundaries (BVA on 0-interval, far-future, whitespace, calendar rollovers)
               ├── Capacity Threshold Transitions (BVA at N=1, N-1 -> N, N=0, and N -> N-1 -> N oscillation)
               ├── State Machine & Role Constraints (BVA on non-active statuses, skill level gates)
               └── Concurrency & Idempotency Edge Conditions (Atomic locking & double-click prevention)
               │
               ▼
15 Discrete Tier 2 Boundary & Corner Case Test Designs
```

---

### Feature R1: Event Creation Optional Deadline (5 Tier 2 Tests)

1. **Test R1-T2-1: Event Creation with Zero-Interval Deadline ($t_{deadline} = t_{start}$)**
   - **Type**: Lower Boundary Value Analysis (BVA).
   - **Description**: Admin creates an event setting the deadline to the exact same date and start time as the event (e.g. `date="2026-09-01"`, `time="10:00"`, `deadline="2026-09-01T10:00"`).
   - **Expected Outcome**: Form submission succeeds, event is created with the exact provided deadline, and no false-positive validation error is triggered for zero time delta.
   - **Rationale as Boundary Case**: Validates the lower boundary limit where deadline delta is zero relative to start time ($t_{deadline} - t_{start} = 0$).

2. **Test R1-T2-2: Event Creation with Far-Future Boundary Deadline (Year 2099)**
   - **Type**: Upper Boundary Value Analysis (BVA).
   - **Description**: Admin creates an event setting an extreme future deadline (e.g. `2099-12-31T23:59`).
   - **Expected Outcome**: Datetime parsing, serialization, and database persistence handle the boundary year without integer overflow, date truncation, or ISO conversion errors.
   - **Rationale as Boundary Case**: Validates upper bound limits of date pickers, ISO serialization, and timezone converters.

3. **Test R1-T2-3: Event Creation with Whitespace / Empty String Sanitization**
   - **Type**: Input Sanitization & Type Coercion Corner Case.
   - **Description**: Admin interacts with the deadline input, enters spaces or clears the field, submitting an empty string payload (`""`).
   - **Expected Outcome**: The system coerces empty string to `null`, successfully saves the event, and applies the 7-day fallback calculation rather than throwing a `400 Bad Request` datetime parse error.
   - **Rationale as Corner Case**: Validates edge handling of empty string payloads versus null/omitted fields across frontend-backend boundary.

4. **Test R1-T2-4: Automatic 7-Day Fallback Deadline Across Month and Leap-Year Rollovers**
   - **Type**: Calendar Arithmetic Boundary Case.
   - **Description**: Admin creates an event scheduled on a month-end or leap-year boundary (e.g., `2028-02-28` in leap year or `2026-10-31`) leaving deadline empty.
   - **Expected Outcome**: The calculated deadline is exactly 7 days later (`2028-03-06` or `2026-11-07`), confirming date arithmetic handles month transitions and leap days correctly without off-by-one errors.
   - **Rationale as Boundary Case**: Validates calendar rollover boundary conditions in automated date calculations.

5. **Test R1-T2-5: Dynamic Recalculation of Fallback Deadline on Event Date Modification**
   - **Type**: State Mutation & Fallback Recalculation Corner Case.
   - **Description**: Admin edits an existing event that was created without a deadline, changes the event date from Date $D_1$ to Date $D_2$, and leaves the deadline field empty.
   - **Expected Outcome**: The event updates successfully, and the deadline updates to $D_2 + 7\text{ days}$ rather than retaining the stale $D_1 + 7\text{ days}$ or reverting to null.
   - **Rationale as Corner Case**: Tests boundary state transition during updates when implicit calculated fields depend on mutable source fields.

---

### Feature R2: Admin Attendance Button (5 Tier 2 Tests)

6. **Test R2-T2-1: Admin Joins Minimum-Capacity Event ($max\_participants = 1$)**
   - **Type**: Lower Capacity Boundary ($N=1$).
   - **Description**: Admin views an open event configured with `max_participants = 1` and 0 participants. Admin clicks "Пойти на мероприятие".
   - **Expected Outcome**: Admin is added as the sole participant ($1/1$), the event status transitions immediately from `OPEN` to `IN_PROGRESS`, and the join button disappears/switches to participating.
   - **Rationale as Boundary Case**: Tests lower bound capacity limit ($N=1$) where a single action immediately saturates 100% capacity and triggers a state transition.

7. **Test R2-T2-2: Admin Attendance Button Hidden on Terminal/Inactive Statuses (`REJECTED`, `COMPLETED`, `OVERDUE`)**
   - **Type**: State Machine Boundary / Inactive State Filtering.
   - **Description**: Admin navigates to events in non-actionable lifecycle states (`REJECTED`, `COMPLETED`, `OVERDUE`).
   - **Expected Outcome**: The "Пойти на мероприятие" button is absent across all inactive states, preventing invalid state mutations.
   - **Rationale as Corner Case**: Validates lifecycle state boundary enforcement to prevent join attempts on closed/terminal entities.

8. **Test R2-T2-3: Rapid Double-Click / Idempotent Admin Attendance Submission**
   - **Type**: Concurrency / Idempotency Corner Case.
   - **Description**: Admin rapidly double-clicks the "Пойти на мероприятие" button in rapid succession.
   - **Expected Outcome**: Only one request succeeds; the admin is added once to `media_participants`, and duplicate key or 500 errors are prevented.
   - **Rationale as Corner Case**: Tests race conditions and UI debounce/backend idempotency at the moment of interaction.

9. **Test R2-T2-4: Admin Joins Multi-Capacity Event at Boundary $N-1 \rightarrow N$ Triggering Capacity Lock**
   - **Type**: Upper Threshold Transition Boundary.
   - **Description**: An event with `max_participants = 3` already has 2 participants. Admin clicks "Пойти на мероприятие".
   - **Expected Outcome**: Admin is enrolled ($3/3$), event status transitions to `IN_PROGRESS`, participant counter displays `3 / 3`, and further join actions are disabled.
   - **Rationale as Boundary Case**: Verifies the exact boundary transition where the admin fills the final slot in a multi-slot event.

10. **Test R2-T2-5: Admin Re-joins Event After Participant Removal (Capacity Re-opening Boundary)**
    - **Type**: Capacity Oscillation Boundary ($N \rightarrow N-1 \rightarrow N$).
    - **Description**: An event at full capacity ($N/N$) has one participant removed, dropping participant count to $N-1$. An admin views the event.
    - **Expected Outcome**: The "Пойти на мероприятие" button reappears, allowing the admin to join and restore capacity to $N/N$.
    - **Rationale as Boundary Case**: Tests reversible capacity boundary transitions and UI state responsiveness.

---

### Feature R3: Media Self-Signup (5 Tier 2 Tests)

11. **Test R3-T2-1: Media User Self-Signup at Final Available Slot ($N-1 \rightarrow N$)**
    - **Type**: Upper Capacity Threshold Boundary.
    - **Description**: Media user views an open event with `max_participants = 4` and 3 existing participants. Media user clicks "Я пойду" / "Пойти на мероприятие".
    - **Expected Outcome**: User is added as the 4th participant ($4/4$), the event transitions to `IN_PROGRESS`, and the button transitions to participating/disabled.
    - **Rationale as Boundary Case**: Verifies boundary threshold allocation for self-signup on the final available slot.

12. **Test R3-T2-2: Media User Gated by Skill Level Boundary Requirement**
    - **Type**: Attribute / Qualification Constraint Boundary.
    - **Description**: A Media user with standard skill level (`ANY`) views an event requiring `PRO` skill (`required_skill = 'PRO'`).
    - **Expected Outcome**: The join button is locked/disabled or displays the `Нужен PRO` lock badge, preventing unauthorized self-signup.
    - **Rationale as Corner Case**: Tests skill-gating boundary conditions preventing privilege escalation/unqualified enrollment.

13. **Test R3-T2-3: Media User Self-Signup on Zero-Capacity Event ($max\_participants = 0$)**
    - **Type**: Non-Positive Capacity Lower Bound ($N=0$).
    - **Description**: Media user navigates to an event where `max_participants = 0`.
    - **Expected Outcome**: The join button is disabled or hidden, preventing enrollment on zero-capacity events.
    - **Rationale as Boundary Case**: Validates defensive lower bound handling for zero or non-positive capacity limits.

14. **Test R3-T2-4: Concurrent Media Signups for Last Remaining Slot (Contention Corner Case)**
    - **Type**: Concurrency & Atomic Locking Corner Case.
    - **Description**: Two media users simultaneously attempt to join an event with only 1 remaining open slot.
    - **Expected Outcome**: Exactly one user successfully enrolls; the second receives an appropriate notification ("Места заняты" / capacity reached), and the participant count does not exceed `max_participants`.
    - **Rationale as Corner Case**: Tests database transactions, `select_for_update` locking, and frontend error notification under simultaneous boundary contention.

15. **Test R3-T2-5: Media User Signup on Past/Overdue Event Boundary**
    - **Type**: Temporal Boundary / State Transition Corner Case.
    - **Description**: Media user attempts to sign up for an event whose scheduled date or deadline has elapsed (`status = 'OVERDUE'`).
    - **Expected Outcome**: The signup button is disabled/absent, preventing late self-signups on expired events.
    - **Rationale as Corner Case**: Validates temporal boundary enforcement on event signups.

---

## Caveats
- Tests assume standard Playwright test fixtures and seeded test data or API mock intercepts representing different capacity states ($N-1$, $N$, $N=1$, $N=0$, skill gates, and terminal statuses).
- In accordance with explorer read-only constraints, test definitions are specified design blueprints and rationale; code implementation is deferred to the implementer/worker agent.

---

## Conclusion
A comprehensive suite of 15 Tier 2 boundary and corner case tests (5 for R1, 5 for R2, 5 for R3) has been designed following opaque-box BVA and category-partition methodologies. The specifications, preconditions, assertions, and boundary rationales are fully detailed and ready for the implementer agent to implement in `tests/e2e/e2e.spec.ts`.

---

## Verification Method
1. **Inspection Verification**:
   - Verify that all 15 tests are documented in `handoff.md` and cover each of the 3 features (5 tests per feature).
   - Verify that all test cases target specific boundary/corner conditions (BVA, capacity limits, datetime rollovers, idempotency, skill gates, state machine boundaries).
2. **Implementation Verification**:
   - Implementer adds the 15 test definitions to `tests/e2e/e2e.spec.ts`.
   - Run the test suite: `npx playwright test tests/e2e/e2e.spec.ts`.
