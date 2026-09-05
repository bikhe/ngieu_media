# Handoff: Tier 1 E2E Tests & Playwright Setup

## Observation
- `TEST_INFRA.md` requires 15 Tier 1 tests (5 each for R1, R2, R3) using Playwright. Playwright should be initialized in `/home/bikhe/ngieu-media/ngieu_media-main/tests/e2e`.
- `ORIGINAL_REQUEST.md` details three requirements:
  - **R1**: Event creation succeeds even if the submission time (deadline) is empty.
  - **R2**: Admin Attendance Button ("Пойти на мероприятие") exists for admins, allowing them to join events and be added to `media_participants`.
  - **R3**: Media Self-Signup exists for users with the 'MEDIA' (СМИ) role to join open events (not reached `max_participants`).

## Logic Chain
To fulfill the Tier 1 test requirements and guarantee functional coverage of the 3 core features without touching edge cases (Tier 2/3), the 15 tests should verify standard behavior and primary UI components:

**R1: Make Submission Time Optional (5 Tests)**
1. Admin creates an event leaving the deadline input completely empty -> Event created successfully.
2. Admin creates an event providing a specific deadline -> Event created successfully with the provided date.
3. After creating an event with an empty deadline, verify the UI displays a fallback deadline (e.g., 7 days from creation).
4. Verify the backend successfully accepted the payload and did not throw a validation error (network interception on event creation).
5. Verify the newly created event without an explicit deadline appears in the Active Events list with correct base details.

**R2: Admin Attendance Button (5 Tests)**
1. Admin views an event they are not participating in -> Ensure the "Пойти на мероприятие" button is visible.
2. Admin clicks the "Пойти на мероприятие" button -> Verify successful network request and the admin is added to `media_participants` in the UI.
3. Admin views an event they have already joined -> Verify the "Пойти на мероприятие" button is absent or disabled (shows joined state).
4. Admin views an event where participant count equals `max_participants` -> Ensure they cannot join (button absent/disabled).
5. Admin joins an event, navigates away, and returns -> Verify the UI still reflects their participation state.

**R3: Media Self-Signup (5 Tests)**
1. Media user views an open event -> Ensure the "Take event" / "Join" button is visible.
2. Media user clicks the Join button -> Verify successful signup, count increments, and user state updates to participating.
3. Media user views an event they have already joined -> Ensure the Join button is absent or disabled.
4. Media user views an event that is full (`max_participants` reached) -> Ensure the Join button is absent or disabled.
5. Media user successfully joins an event -> Verify an Admin viewing the same event sees the Media user in the `media_participants` list.

**Playwright Setup Plan:**
1. Navigate to `/home/bikhe/ngieu-media/ngieu_media-main/`.
2. Create directory: `mkdir -p tests/e2e`
3. Enter directory: `cd tests/e2e`
4. Initialize Playwright: `npm init playwright@latest --yes -- --quiet --browser=chromium`
5. Configure `playwright.config.ts` to use a local or staging `baseURL` pointing to the frontend (e.g., `http://localhost:3000`).
6. Place the above test cases in `tests/e2e/tests/` (e.g., `event-creation.spec.ts`, `admin-attendance.spec.ts`, `media-signup.spec.ts`).

## Caveats
- Auth state management (login steps) is assumed to be handled either via global setup (storing auth tokens) or before-each hooks for Admins and Media roles.
- The exact API routes and UI selectors (e.g., data-testid) need to be determined by the implementer during the actual test authoring.
- Fallback deadline is assumed to be exactly 7 days, as mentioned in `ORIGINAL_REQUEST.md`.

## Conclusion
The 15 Tier 1 E2E tests have been fully defined to cover standard workflows for the three requested features. The Playwright setup sequence has been established. This plan is ready for the implementer agent to execute.

## Verification Method
- **Setup Verification**: Run `cd tests/e2e && npx playwright test` after setup to confirm the framework runs correctly.
- **Test Verification**: Implement the 15 tests as described. The `npx playwright test` command must report 15 tests passed.
