# Fix Strategy for Tier 3 & Tier 4 Tests

## 1. Observation
The current `tests/e2e/e2e.spec.ts` fails review for three main reasons:
1. **Facade Tests**: The tests perform actions on behalf of both "Admin" and "Media user" in the same `page` context without ever logging in, logging out, or using separate browser contexts (e.g., `test('3. Admin and Media user both sign up for the same event', async ({ page }) => { ... })`).
2. **Syntactically Invalid**: The use of `page.click('button', { hasText: '...' })` is invalid in Playwright, resulting in TS error `TS2353`.
3. **Opaque-box Methodology Violation**: The tests navigate to hardcoded, arbitrary internal URLs (e.g., `await page.goto('/events/15');`) instead of following the application's natural UI flow or extracting the generated event URL after creation.

## 2. Logic Chain & Fix Strategy
To resolve these issues, the tests must be refactored to align with end-to-end testing best practices:

*   **Addressing Facade Tests (Integrity)**: Instead of using the default single `page` fixture, tests that require multiple roles will instantiate separate browser contexts (`browser.newContext()`). One context will be used to log in as the Admin (e.g., `adminPage`), and the other will log in as the Media user (e.g., `mediaPage`). This ensures true isolation and role verification.
*   **Addressing Syntactically Invalid Code**: Replace all invalid click calls. The correct syntax `page.locator('button', { hasText: '...' }).click()` will be strictly used across all tests.
*   **Addressing Opaque-box Methodology Violation**: Tests will no longer hardcode event IDs. When an Admin creates an event, the test will either capture the resulting redirect URL (e.g., `const eventUrl = adminPage.url();`) or navigate to the event list and click on the newly created event by its title. The Media user will then use this extracted URL or the UI to find the event.

## 3. Exact Scenarios (Tier 3 & Tier 4)

**Tier 3: Pairwise Coverage**
*   **Feature 1 & 2**: Admin logs in, navigates to `/admin/events/new`, creates an event with a title and deadline, and submits. The test intercepts the redirect URL. Admin uses the UI on the redirected page to click "Пойти на мероприятие" via `locator().click()` and verifies the "Participating" status.
*   **Feature 1 & 3**: Admin logs in, creates an event without a deadline, and submits. The test captures the new event's URL. In a separate browser context, a Media user logs in, navigates to the captured URL (or finds it in the event list), clicks "Пойти на мероприятие", and verifies participation.
*   **Feature 2 & 3**: (Assuming event created beforehand or within test) Admin and Media user log into their respective contexts. Both navigate to the same event URL. Both successfully click the join button in their own contexts and verify their participation status independently.

**Tier 4: Real-World Scenarios**
*   **Scenario 1 (Full lifecycle by admin)**: Admin logs in, creates an event without a deadline via the UI form. After successful creation, the admin follows the UI redirect, clicks the join button using valid syntax, and verifies status.
*   **Scenario 2 (Media user signs up for admin's event)**: Admin logs in, creates an event. Test stores the resulting URL. Media user logs in via a separate context, navigates to the stored URL, clicks the join button, and verifies status.
*   **Scenario 3 (Admin and Media both sign up)**: Admin logs in and creates an event. Test stores the URL. Admin clicks join on the redirected page. Media user logs in (separate context), navigates to the URL, and clicks join. Both verify they are participating.
*   **Scenario 4 (Event fills up, admin rejected)**: Admin creates an event with `max_participants` set to 1. Media user logs in, navigates to the event, and joins, thereby filling the capacity. Admin then attempts to join the same event, but the test verifies the join button is disabled.
*   **Scenario 5 (Complex multi-role)**: Admin logs in, creates an event with a deadline and limited capacity (e.g., `max_participants = 1`). Media user logs in, navigates to the event, and joins. Admin attempts to join, but the button is disabled.

## 4. Caveats
- The exact login mechanism (e.g., `/login` endpoint, required credentials) must be known or mocked if testing in an environment without pre-seeded users.
- The UI flow post-event-creation (whether it redirects to the event page or a list) dictates how we extract the URL. We assume a redirect to the created event's page.

## 5. Conclusion
The proposed strategy strictly addresses all three violations by utilizing multiple browser contexts for role separation, correcting the Playwright locator syntax, and enforcing UI-driven navigation over hardcoded internal IDs.

## 6. Verification Method
- **Syntax**: Run `npx tsc --noEmit` to ensure TS2353 is resolved.
- **Role Separation**: Inspect the test code to ensure `browser.newContext()` is used for multi-role tests.
- **Opaque-box**: Inspect the test code to ensure no hardcoded IDs (like `/events/15`) exist. Run the Playwright tests (`npx playwright test tests/e2e/e2e.spec.ts`) to confirm they pass in a real environment.
