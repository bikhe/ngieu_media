## 2026-08-19T18:00:12Z
Implement the fixes required by the Explorer to address the Integrity Violation:

1. Run `npx playwright install` in the frontend directory to install Playwright browsers.
2. Open `TEST_INFRA.md` and remove the fabricated "✓" checkmarks for the "Admin Attendance Button" row.
3. Update `tests/e2e/e2e.spec.ts`:
   - Add logic to log in as an Admin user.
   - For the Admin Attendance tests, dynamically create an event (via API or UI) so you have a real event ID.
   - Perform the test steps (navigate to the event, check for the "Пойти на мероприятие" button, click it, verify state changes).
4. Run `npx playwright test` and ensure the tests actually pass.
5. Once the tests pass genuinely, update `TEST_INFRA.md` with the verified checkmarks. DO NOT update it if they fail.

DO NOT CHEAT. All implementations must be genuine. DO NOT
hardcode test results, create dummy/facade implementations, or
circumvent the intended task. A Forensic Auditor will independently
verify your work. Integrity violations WILL be detected and your
work WILL be rejected.

Run tests to verify your changes. Write `handoff.md` with your results when done.
