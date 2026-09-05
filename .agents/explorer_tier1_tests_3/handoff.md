# Observation
- Requirements extracted from `ORIGINAL_REQUEST.md`:
  - **R1:** Make Submission Time Optional during event creation.
  - **R2:** Admin Attendance Button (Admins can join events).
  - **R3:** Media Self-Signup (Media users can join open events up to `max_participants`).
- Test architecture and coverage requirements from `TEST_INFRA.md` & `SCOPE.md`:
  - Playwright test runner in `tests/e2e`.
  - Opaque-box UI testing.
  - Tier 1 requires 15 tests total (5 per feature).

# Logic Chain
- For **R1**, we need to verify the core success path (no deadline), the control path (explicit deadline), edge cases for empty values (e.g., empty string), interaction with missing required fields, and interaction with other optional fields.
- For **R2**, we need to test the success path (Admin joins), already joined state, capacity limits (max_participants reached), and boundary conditions (0 participants, n-1 participants).
- For **R3**, we need to test similar cases for the Media user: success path, already joined state, capacity limits, and boundary conditions (first to join, last to join).
- For **Playwright Setup**, standard installation via `npm init playwright@latest` is required, followed by configuring the `playwright.config.ts` to point to the correct frontend URL and setting up authentication fixtures for the different roles (Admin, Media).

# Tier 1 Test Plan (15 Tests)

## R1: Make Submission Time Optional
1. **T1.1 (Success):** Create an event with all required fields filled and deadline left entirely empty (should succeed, fallback applied).
2. **T1.2 (Control):** Create an event with an explicit valid deadline (should succeed).
3. **T1.3 (Edge Case):** Create an event with the deadline field explicitly cleared or sending an empty string (should succeed).
4. **T1.4 (Negative Interaction):** Create an event with no deadline AND missing required fields like title (should fail on title, not complain about deadline).
5. **T1.5 (Complex Success):** Create an event with no deadline but all other optional fields filled.

## R2: Admin Attendance Button
1. **T2.1 (Success):** Admin clicks "Go to event" on an event they haven't joined (should succeed and join).
2. **T2.2 (Already Joined):** Admin viewing an event they already joined (button should be hidden or show "Already Joined").
3. **T2.3 (Capacity Limit):** Admin attempts to join an event that has reached `max_participants` (button disabled/hidden).
4. **T2.4 (Boundary - Empty):** Admin joins an event with 0 current participants.
5. **T2.5 (Boundary - Near Full):** Admin joins an event that has `max_participants - 1` attendees (should succeed, event becomes full).

## R3: Media Self-Signup
1. **T3.1 (Success):** Media user clicks "Take event" or "Join" on an open event (should succeed).
2. **T3.2 (Already Joined):** Media user viewing an event they already joined (button should change state).
3. **T3.3 (Capacity Limit):** Media user attempts to join a full event (button disabled/hidden).
4. **T3.4 (Boundary - Empty):** Media user joins an event with 0 current participants.
5. **T3.5 (Boundary - Near Full):** Media user joins an event that has `max_participants - 1` attendees (should succeed, event becomes full).

# Playwright Setup Plan
1. **Initialization:** Run `npm init playwright@latest` in the `tests/e2e` directory.
2. **Configuration:** Update `playwright.config.ts`:
   - Set `baseURL` to the frontend dev server URL (e.g., `http://localhost:5173` or `http://localhost:3000`).
   - Configure projects for desktop (Chromium, Firefox, WebKit) or just Chromium for initial speed.
3. **Authentication Fixtures:** Create helpers in `tests/e2e/fixtures/auth.ts` to log in as:
   - Admin user
   - Media user
   This will avoid duplicating login UI steps in every test.
4. **Test Files Structure:**
   - `tests/e2e/r1-event-creation.spec.ts`
   - `tests/e2e/r2-admin-attendance.spec.ts`
   - `tests/e2e/r3-media-signup.spec.ts`
5. **Execution Scripts:** Add `"test:e2e": "playwright test"` to the project's `package.json` (if applicable) or document the run command `npx playwright test`.

# Caveats
- Exact selectors for buttons (like "Go to event" and "Take event") will depend on the DOM structure.
- We assume `max_participants` can be easily mocked or set during test setup.

# Conclusion
The proposed 15 Tier 1 tests cover the Category-Partition and BVA methodology for R1, R2, and R3. The Playwright setup plan outlines a structured approach to initializing the test suite and managing authentication states.

# Verification Method
1. Verify the `handoff.md` file contains exactly 15 tests (5 per requirement).
2. Proceed to execute the Playwright setup plan and implement the tests.
