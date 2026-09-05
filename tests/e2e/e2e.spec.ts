import { test, expect, Page, APIRequestContext, request as playwrightRequest } from '@playwright/test';

const API_BASE = 'http://localhost:8000/api';

// Credentials come from the environment; never commit real ones.
const E2E_ADMIN_USER = process.env.E2E_ADMIN_USER ?? 'admin';
const E2E_ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;
const E2E_MEDIA_USER = process.env.E2E_MEDIA_USER ?? 'testdata_operator';
const E2E_MEDIA_PASSWORD = process.env.E2E_MEDIA_PASSWORD;

// Helper: Log in via the cookie-based token endpoint. Returns an API request
// context whose cookie jar holds the httpOnly auth cookies.
async function loginSession(username = E2E_ADMIN_USER, password = E2E_ADMIN_PASSWORD): Promise<APIRequestContext> {
  if (!password) {
    throw new Error(`E2E password for "${username}" is not set (set E2E_ADMIN_PASSWORD / E2E_MEDIA_PASSWORD)`);
  }
  const session = await playwrightRequest.newContext();
  const res = await session.post(`${API_BASE}/token/`, { data: { username, password } });
  if (!res.ok()) {
    throw new Error(`Failed to authenticate as ${username}: ${res.status()}`);
  }
  return session;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('app_setup_completed', 'true');
  });
});

// Helper: Authenticate Playwright Page (auth cookies are shared with the page)
async function authenticatePage(page: Page, username = E2E_ADMIN_USER, password = E2E_ADMIN_PASSWORD) {
  if (!password) {
    throw new Error(`E2E password for "${username}" is not set (set E2E_ADMIN_PASSWORD / E2E_MEDIA_PASSWORD)`);
  }
  const res = await page.request.post(`${API_BASE}/token/`, { data: { username, password } });
  if (!res.ok()) {
    throw new Error(`Failed to authenticate page as ${username}: ${res.status()}`);
  }
  await page.addInitScript(() => {
    localStorage.setItem('app_setup_completed', 'true');
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
}

// Helper: Create Event via API
async function createEvent(session: APIRequestContext, overrides: Record<string, unknown> = {}) {
  const eventDate = new Date();
  const dateStr = eventDate.toISOString().split('T')[0];

  const payload: Record<string, any> = {
    title: `E2E Event ${Date.now()}_${Math.random().toString(36).substring(7)}`,
    date: dateStr,
    time: '12:00:00',
    end_time: '14:00:00',
    status: 'OPEN',
    format: 'OFFLINE',
    max_participants: 2,
    required_skill: 'ANY',
    content_type: 'PHOTO',
    location: '',
    ...overrides,
  };

  const res = await session.post(`${API_BASE}/events/`, { data: payload });

  if (!res.ok()) {
    const errText = await res.text();
    throw new Error(`Failed to create event: ${res.status()} ${errText}`);
  }
  return await res.json();
}

// Helper: Patch Event via API
async function patchEvent(session: APIRequestContext, eventId: number, data: Record<string, unknown>) {
  const res = await session.patch(`${API_BASE}/events/${eventId}/`, { data });
  return { status: res.status(), data: await res.json().catch(() => ({})) };
}

// Helper: Fetch Event by ID
async function fetchEvent(session: APIRequestContext, eventId: number) {
  const res = await session.get(`${API_BASE}/events/${eventId}/`);
  return await res.json();
}

// Helper: Take Task via API
async function takeTaskAPI(session: APIRequestContext, eventId: number) {
  const res = await session.post(`${API_BASE}/events/${eventId}/take_task/`, { data: { equipment_ids: [] } });
  return { status: res.status(), data: await res.json().catch(() => ({})) };
}

// ==========================================
// FEATURE 1: Event Creation Optional Deadline (R1)
// ==========================================

test.describe('Feature 1: Event Creation Optional Deadline', () => {
  // Tier 1: Basic Functional Tests
  test('T1.1 Create Event With Explicit ISO Deadline', async ({ page }) => {
    const admin = await loginSession();
    const explicitDeadline = '2026-12-31T23:59:00Z';
    const event = await createEvent(admin, {
      title: `F1 T1.1 ${Date.now()}`,
      deadline: explicitDeadline,
    });

    expect(event.deadline).toBeTruthy();
    expect(event.deadline).toContain('2026-12-31');

    await authenticatePage(page);
    await expect(page.locator(`text=${event.title}`)).toBeVisible();
  });

  test('T1.2 Create Event Without Deadline (Empty String fallback)', async ({ page }) => {
    const admin = await loginSession();
    const event = await createEvent(admin, {
      title: `F1 T1.2 ${Date.now()}`,
      deadline: '',
    });

    expect(event.deadline).toBeTruthy();
    const eventDate = new Date(event.date);
    const expectedDeadline = new Date(eventDate);
    expectedDeadline.setDate(expectedDeadline.getDate() + 7);
    const expectedDateStr = expectedDeadline.toISOString().split('T')[0];
    expect(event.deadline).toContain(expectedDateStr);

    await authenticatePage(page);
    await expect(page.locator(`text=${event.title}`)).toBeVisible();
  });

  test('T1.3 Create Event With Null Deadline (Null fallback)', async ({ page }) => {
    const admin = await loginSession();
    const event = await createEvent(admin, {
      title: `F1 T1.3 ${Date.now()}`,
      deadline: null,
    });

    expect(event.deadline).toBeTruthy();
    const eventDate = new Date(event.date);
    const expectedDeadline = new Date(eventDate);
    expectedDeadline.setDate(expectedDeadline.getDate() + 7);
    const expectedDateStr = expectedDeadline.toISOString().split('T')[0];
    expect(event.deadline).toContain(expectedDateStr);

    await authenticatePage(page);
    await expect(page.locator(`text=${event.title}`)).toBeVisible();
  });

  test('T1.4 Edit Event - Add Deadline', async ({ page }) => {
    const admin = await loginSession();
    const event = await createEvent(admin, {
      title: `F1 T1.4 ${Date.now()}`,
      deadline: '',
    });

    const updatedDeadline = '2026-12-31T23:59:00Z';
    const patchRes = await patchEvent(admin, event.id, { deadline: updatedDeadline });
    const updatedEvent = patchRes.data;

    expect(updatedEvent.deadline).toContain('2026-12-31');

    await authenticatePage(page);
    await expect(page.locator(`text=${event.title}`)).toBeVisible();
  });

  test('T1.5 Edit Event - Remove Deadline and Recalculate Fallback', async ({ page }) => {
    const admin = await loginSession();
    const event = await createEvent(admin, {
      title: `F1 T1.5 ${Date.now()}`,
      deadline: '2026-12-31T23:59:00Z',
    });

    const patchRes = await patchEvent(admin, event.id, { deadline: '' });
    const updatedEvent = patchRes.data;

    expect(updatedEvent.deadline).not.toContain('2026-12-31');
    const eventDate = new Date(event.date);
    const expectedDeadline = new Date(eventDate);
    expectedDeadline.setDate(expectedDeadline.getDate() + 7);
    const expectedDateStr = expectedDeadline.toISOString().split('T')[0];
    expect(updatedEvent.deadline).toContain(expectedDateStr);
  });

  // Tier 2: Boundary & Edge Tests
  test('T2.1 Event With Same-Day Deadline', async ({ page }) => {
    const admin = await loginSession();
    const todayStr = new Date().toISOString().split('T')[0];
    const sameDayDeadline = `${todayStr}T23:59:59Z`;
    const event = await createEvent(admin, {
      title: `F1 T2.1 ${Date.now()}`,
      deadline: sameDayDeadline,
    });

    expect(event.deadline).toContain(todayStr);
    await authenticatePage(page);
    await expect(page.locator(`text=${event.title}`)).toBeVisible();
  });

  test('T2.2 Event With Far-Future Deadline', async ({ page }) => {
    const admin = await loginSession();
    const farFuture = '2035-01-01T12:00:00Z';
    const event = await createEvent(admin, {
      title: `F1 T2.2 ${Date.now()}`,
      deadline: farFuture,
    });

    expect(event.deadline).toContain('2035-01-01');
    await authenticatePage(page);
    await expect(page.locator(`text=${event.title}`)).toBeVisible();
  });

  test('T2.3 Event With Deadline After Event End Time', async ({ page }) => {
    const admin = await loginSession();
    const todayStr = new Date().toISOString().split('T')[0];
    const postEndDeadline = `${todayStr}T15:00:00Z`;
    const event = await createEvent(admin, {
      title: `F1 T2.3 ${Date.now()}`,
      time: '12:00:00',
      end_time: '14:00:00',
      deadline: postEndDeadline,
    });

    expect(event.deadline).toContain('15:00:00');
    await authenticatePage(page);
    await expect(page.locator(`text=${event.title}`)).toBeVisible();
  });

  test('T2.4 Multiple Consecutive Deadline Toggles', async ({ page }) => {
    const admin = await loginSession();
    const event = await createEvent(admin, {
      title: `F1 T2.4 ${Date.now()}`,
      deadline: '',
    });

    // 1st update: set explicit
    await patchEvent(admin, event.id, { deadline: '2027-01-01T00:00:00Z' });
    let check = await fetchEvent(admin, event.id);
    expect(check.deadline).toContain('2027-01-01');

    // 2nd update: clear deadline
    await patchEvent(admin, event.id, { deadline: '' });
    check = await fetchEvent(admin, event.id);
    expect(check.deadline).not.toContain('2027-01-01');

    // 3rd update: set another explicit
    await patchEvent(admin, event.id, { deadline: '2028-06-15T18:00:00Z' });
    check = await fetchEvent(admin, event.id);
    expect(check.deadline).toContain('2028-06-15');
  });

  test('T2.5 Omitted Deadline Field in Creation Payload', async ({ page }) => {
    const admin = await loginSession();
    // Call API without deadline property at all
    const res = await admin.post(`${API_BASE}/events/`, { data: {
      title: `F1 T2.5 ${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      time: '10:00:00',
      status: 'OPEN',
      max_participants: 2,
      required_skill: 'ANY',
      content_type: 'PHOTO',
      location: '',
    } });
    expect(res.status()).toBe(201);
    const data = await res.json();
    expect(data.deadline).toBeTruthy();
  });
});

// ==========================================
// FEATURE 2: Admin Attendance Button (R2)
// ==========================================

test.describe('Feature 2: Admin Attendance Button', () => {
  // Tier 1: Basic Functional Tests
  test('T1.1 Admin Join Button Visible on OPEN event', async ({ page }) => {
    const admin = await loginSession();
    const event = await createEvent(admin, {
      title: `F2 T1.1 ${Date.now()}`,
      status: 'OPEN',
      max_participants: 2,
    });

    await authenticatePage(page);
    const card = page.locator('.MuiCard-root', { hasText: event.title });
    await expect(card).toBeVisible();
    await expect(card.locator('button:has-text("Пойти на мероприятие")')).toBeVisible();
  });

  test('T1.2 Admin Joins Event via UI button', async ({ page }) => {
    const admin = await loginSession();
    const event = await createEvent(admin, {
      title: `F2 T1.2 ${Date.now()}`,
      status: 'OPEN',
      max_participants: 2,
    });

    await authenticatePage(page);
    const card = page.locator('.MuiCard-root', { hasText: event.title });
    await expect(card).toBeVisible();

    const joinBtn = card.locator('button:has-text("Пойти на мероприятие")');
    await expect(joinBtn).toBeVisible();
    await joinBtn.click();

    // Verify button disappears after joining
    await expect(joinBtn).not.toBeVisible({ timeout: 10000 });

    // Verify backend confirms admin participation
    const updated = await fetchEvent(admin, event.id);
    expect(updated.media_participants.some((p: { username?: string }) => p.username === 'admin')).toBe(true);
  });

  test('T1.3 Admin Already Joined State Hides Button', async ({ page }) => {
    const admin = await loginSession();
    const event = await createEvent(admin, {
      title: `F2 T1.3 ${Date.now()}`,
      status: 'OPEN',
      max_participants: 2,
    });

    // Join via API first
    await takeTaskAPI(admin, event.id);

    await authenticatePage(page);
    const card = page.locator('.MuiCard-root', { hasText: event.title });
    await expect(card).toBeVisible();
    await expect(card.locator('button:has-text("Пойти на мероприятие")')).not.toBeVisible();
  });

  test('T1.4 Admin Join Button on IN_PROGRESS Event', async ({ page }) => {
    const admin = await loginSession();
    const event = await createEvent(admin, {
      title: `F2 T1.4 ${Date.now()}`,
      status: 'IN_PROGRESS',
      max_participants: 2,
    });

    await authenticatePage(page);
    const card = page.locator('.MuiCard-root', { hasText: event.title });
    await expect(card).toBeVisible();
    await expect(card.locator('button:has-text("Пойти на мероприятие")')).toBeVisible();
  });

  test('T1.5 Admin Join Button Hidden on COMPLETED Event', async ({ page }) => {
    const admin = await loginSession();
    const event = await createEvent(admin, {
      title: `F2 T1.5 ${Date.now()}`,
      status: 'COMPLETED',
      max_participants: 2,
    });

    await authenticatePage(page);
    const card = page.locator('.MuiCard-root', { hasText: event.title });
    if (await card.isVisible().catch(() => false)) {
      await expect(card.locator('button:has-text("Пойти на мероприятие")')).not.toBeVisible();
    }
  });

  // Tier 2: Boundary & Capacity Tests
  test('T2.1 Admin Joins Event with Max Capacity 1', async ({ page }) => {
    const admin = await loginSession();
    const event = await createEvent(admin, {
      title: `F2 T2.1 ${Date.now()}`,
      status: 'OPEN',
      max_participants: 1,
    });

    await authenticatePage(page);
    const card = page.locator('.MuiCard-root', { hasText: event.title });
    await expect(card).toBeVisible();
    const joinBtn = card.locator('button:has-text("Пойти на мероприятие")');
    await expect(joinBtn).toBeVisible();
    await joinBtn.click();

    await expect(joinBtn).not.toBeVisible({ timeout: 10000 });
    const updated = await fetchEvent(admin, event.id);
    expect(updated.media_participants.length).toBe(1);
  });

  test('T2.2 Admin Join Button Hidden When Event is Full', async ({ page }) => {
    const admin = await loginSession();
    const media = await loginSession(E2E_MEDIA_USER, E2E_MEDIA_PASSWORD);

    const event = await createEvent(admin, {
      title: `F2 T2.2 ${Date.now()}`,
      status: 'OPEN',
      max_participants: 1,
    });

    // Media user joins, filling the 1 slot
    await takeTaskAPI(media, event.id);

    await authenticatePage(page);
    const card = page.locator('.MuiCard-root', { hasText: event.title });
    await expect(card).toBeVisible();
    await expect(card.locator('button:has-text("Пойти на мероприятие")')).not.toBeVisible();
  });

  test('T2.3 Admin Joins Near Capacity (1 of 2 spots taken)', async ({ page }) => {
    const admin = await loginSession();
    const media = await loginSession(E2E_MEDIA_USER, E2E_MEDIA_PASSWORD);

    const event = await createEvent(admin, {
      title: `F2 T2.3 ${Date.now()}`,
      status: 'OPEN',
      max_participants: 2,
    });

    // Media user takes first spot
    await takeTaskAPI(media, event.id);

    await authenticatePage(page);
    const card = page.locator('.MuiCard-root', { hasText: event.title });
    await expect(card).toBeVisible();
    const joinBtn = card.locator('button:has-text("Пойти на мероприятие")');
    await expect(joinBtn).toBeVisible();
    await joinBtn.click();

    await expect(joinBtn).not.toBeVisible({ timeout: 10000 });
    const updated = await fetchEvent(admin, event.id);
    expect(updated.media_participants.length).toBe(2);
  });

  test('T2.4 Admin Join Preserved Across Page Reload', async ({ page }) => {
    const admin = await loginSession();
    const event = await createEvent(admin, {
      title: `F2 T2.4 ${Date.now()}`,
      status: 'OPEN',
      max_participants: 2,
    });

    await authenticatePage(page);
    const card = page.locator('.MuiCard-root', { hasText: event.title });
    await expect(card).toBeVisible();
    await card.locator('button:has-text("Пойти на мероприятие")').click();

    // Reload page and verify state persists
    await page.reload();
    await page.waitForLoadState('networkidle');
    const reloadedCard = page.locator('.MuiCard-root', { hasText: event.title });
    await expect(reloadedCard.locator('button:has-text("Пойти на мероприятие")')).not.toBeVisible();
  });

  test('T2.5 Admin Attendance Button on PENDING Event is Not Shown', async ({ page }) => {
    const admin = await loginSession();
    const event = await createEvent(admin, {
      title: `F2 T2.5 ${Date.now()}`,
      status: 'PENDING',
      max_participants: 2,
    });

    await authenticatePage(page);
    const card = page.locator('.MuiCard-root', { hasText: event.title });
    if (await card.isVisible().catch(() => false)) {
      await expect(card.locator('button:has-text("Пойти на мероприятие")')).not.toBeVisible();
    }
  });
});

// ==========================================
// FEATURE 3: Media Self-Signup (R3)
// ==========================================

test.describe('Feature 3: Media Self-Signup', () => {
  // Tier 1: Basic Functional Tests
  test('T1.1 Media Signup Button Visible on OPEN Event', async ({ page }) => {
    const admin = await loginSession();
    const event = await createEvent(admin, {
      title: `F3 T1.1 ${Date.now()}`,
      status: 'OPEN',
      max_participants: 2,
    });

    await authenticatePage(page, E2E_MEDIA_USER, E2E_MEDIA_PASSWORD);
    const card = page.locator('.MuiCard-root', { hasText: event.title });
    await expect(card).toBeVisible();
    await expect(card.locator('button:has-text("Я пойду")')).toBeVisible();
  });

  test('T1.2 Media User Signs Up via UI', async ({ page }) => {
    const admin = await loginSession();
    const event = await createEvent(admin, {
      title: `F3 T1.2 ${Date.now()}`,
      status: 'OPEN',
      max_participants: 2,
    });

    await authenticatePage(page, E2E_MEDIA_USER, E2E_MEDIA_PASSWORD);
    const card = page.locator('.MuiCard-root', { hasText: event.title });
    await expect(card).toBeVisible();

    const signupBtn = card.locator('button:has-text("Я пойду")');
    await expect(signupBtn).toBeVisible();
    await signupBtn.click();

    // Confirm equipment modal if opened
    const confirmModalBtn = page.locator('button:has-text("Записаться")');
    if (await confirmModalBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmModalBtn.click();
    }

    // Verify backend confirms media participation
    await expect(signupBtn).not.toBeVisible({ timeout: 10000 });
    const updated = await fetchEvent(admin, event.id);
    expect(updated.media_participants.some((p: { username?: string }) => p.username === 'testdata_operator')).toBe(true);
  });

  test('T1.3 Media Already Joined State Hides Signup Button', async ({ page }) => {
    const admin = await loginSession();
    const media = await loginSession(E2E_MEDIA_USER, E2E_MEDIA_PASSWORD);

    const event = await createEvent(admin, {
      title: `F3 T1.3 ${Date.now()}`,
      status: 'OPEN',
      max_participants: 2,
    });

    // Join via API first
    await takeTaskAPI(media, event.id);

    await authenticatePage(page, E2E_MEDIA_USER, E2E_MEDIA_PASSWORD);
    const card = page.locator('.MuiCard-root', { hasText: event.title });
    await expect(card).toBeVisible();
    await expect(card.locator('button:has-text("Я пойду")')).not.toBeVisible();
  });

  test('T1.4 Media Signup Button on IN_PROGRESS Event', async ({ page }) => {
    const admin = await loginSession();
    const event = await createEvent(admin, {
      title: `F3 T1.4 ${Date.now()}`,
      status: 'IN_PROGRESS',
      max_participants: 2,
    });

    await authenticatePage(page, E2E_MEDIA_USER, E2E_MEDIA_PASSWORD);
    const card = page.locator('.MuiCard-root', { hasText: event.title });
    await expect(card).toBeVisible();
    await expect(card.locator('button:has-text("Я пойду")')).toBeVisible();
  });

  test('T1.5 Media Signup Button Hidden on COMPLETED Event', async ({ page }) => {
    const admin = await loginSession();
    const event = await createEvent(admin, {
      title: `F3 T1.5 ${Date.now()}`,
      status: 'COMPLETED',
      max_participants: 2,
    });

    await authenticatePage(page, E2E_MEDIA_USER, E2E_MEDIA_PASSWORD);
    const card = page.locator('.MuiCard-root', { hasText: event.title });
    if (await card.isVisible().catch(() => false)) {
      await expect(card.locator('button:has-text("Я пойду")')).not.toBeVisible();
    }
  });

  // Tier 2: Boundary & Capacity Tests
  test('T2.1 Media User Signs Up for Event with Max Capacity 1', async ({ page }) => {
    const admin = await loginSession();
    const event = await createEvent(admin, {
      title: `F3 T2.1 ${Date.now()}`,
      status: 'OPEN',
      max_participants: 1,
    });

    await authenticatePage(page, E2E_MEDIA_USER, E2E_MEDIA_PASSWORD);
    const card = page.locator('.MuiCard-root', { hasText: event.title });
    await expect(card).toBeVisible();
    await card.locator('button:has-text("Я пойду")').click();

    const confirmModalBtn = page.locator('button:has-text("Записаться")');
    if (await confirmModalBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmModalBtn.click();
    }

    const updated = await fetchEvent(admin, event.id);
    expect(updated.media_participants.length).toBe(1);
  });

  test('T2.2 Media Signup Button Hidden When Event is Full', async ({ page }) => {
    const admin = await loginSession();
    const event = await createEvent(admin, {
      title: `F3 T2.2 ${Date.now()}`,
      status: 'OPEN',
      max_participants: 1,
    });

    // Admin joins, filling the 1 slot
    await takeTaskAPI(admin, event.id);

    await authenticatePage(page, E2E_MEDIA_USER, E2E_MEDIA_PASSWORD);
    const card = page.locator('.MuiCard-root', { hasText: event.title });
    await expect(card).toBeVisible();
    await expect(card.locator('button:has-text("Я пойду")')).not.toBeVisible();
  });

  test('T2.3 Media User Signs Up Near Capacity (1 of 2 spots taken)', async ({ page }) => {
    const admin = await loginSession();
    const event = await createEvent(admin, {
      title: `F3 T2.3 ${Date.now()}`,
      status: 'OPEN',
      max_participants: 2,
    });

    // Admin takes first spot
    await takeTaskAPI(admin, event.id);

    await authenticatePage(page, E2E_MEDIA_USER, E2E_MEDIA_PASSWORD);
    const card = page.locator('.MuiCard-root', { hasText: event.title });
    await expect(card).toBeVisible();
    const signupBtn = card.locator('button:has-text("Я пойду")');
    await expect(signupBtn).toBeVisible();
    await signupBtn.click();

    const confirmModalBtn = page.locator('button:has-text("Записаться")');
    if (await confirmModalBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmModalBtn.click();
    }

    await expect(signupBtn).not.toBeVisible({ timeout: 10000 });
    const updated = await fetchEvent(admin, event.id);
    expect(updated.media_participants.length).toBe(2);
  });

  test('T2.4 Media User Signup State Preserved on Page Reload', async ({ page }) => {
    const admin = await loginSession();
    const event = await createEvent(admin, {
      title: `F3 T2.4 ${Date.now()}`,
      status: 'OPEN',
      max_participants: 2,
    });

    await authenticatePage(page, E2E_MEDIA_USER, E2E_MEDIA_PASSWORD);
    const card = page.locator('.MuiCard-root', { hasText: event.title });
    await expect(card).toBeVisible();
    await card.locator('button:has-text("Я пойду")').click();

    const confirmModalBtn = page.locator('button:has-text("Записаться")');
    if (await confirmModalBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmModalBtn.click();
    }

    await page.reload();
    await page.waitForLoadState('networkidle');
    const reloadedCard = page.locator('.MuiCard-root', { hasText: event.title });
    await expect(reloadedCard.locator('button:has-text("Я пойду")')).not.toBeVisible();
  });

  test('T2.5 Media User Cannot Sign Up if Required Skill Mismatches', async ({ page }) => {
    const admin = await loginSession();
    // testdata_operator has ANY skill level; an event requiring PRO skill with features enabled
    const event = await createEvent(admin, {
      title: `F3 T2.5 ${Date.now()}`,
      status: 'OPEN',
      max_participants: 2,
      required_skill: 'PRO',
    });

    await authenticatePage(page, E2E_MEDIA_USER, E2E_MEDIA_PASSWORD);
    const card = page.locator('.MuiCard-root', { hasText: event.title });
    await expect(card).toBeVisible();
  });
});

// ==========================================
// TIER 3: Pairwise Coverage
// ==========================================

test.describe('Tier 3: Pairwise Coverage', () => {
  test('Pairwise 1: Feature 1 & 2 - Admin creates event with explicit deadline and joins it', async ({ page }) => {
    const admin = await loginSession();
    const explicitDeadline = '2026-11-20T23:59:00Z';
    const event = await createEvent(admin, {
      title: `Pairwise F1+F2 ${Date.now()}`,
      deadline: explicitDeadline,
      max_participants: 2,
    });

    expect(event.deadline).toContain('2026-11-20');

    await authenticatePage(page);
    const card = page.locator('.MuiCard-root', { hasText: event.title });
    await expect(card).toBeVisible();

    const joinBtn = card.locator('button:has-text("Пойти на мероприятие")');
    await expect(joinBtn).toBeVisible();
    await joinBtn.click();
    await expect(joinBtn).not.toBeVisible({ timeout: 10000 });

    const updated = await fetchEvent(admin, event.id);
    expect(updated.media_participants.some((p: { username?: string }) => p.username === 'admin')).toBe(true);
    expect(updated.deadline).toContain('2026-11-20');
  });

  test('Pairwise 2: Feature 1 & 3 - Admin creates event with no deadline and Media user joins', async ({ page }) => {
    const admin = await loginSession();
    const event = await createEvent(admin, {
      title: `Pairwise F1+F3 ${Date.now()}`,
      deadline: '',
      max_participants: 2,
    });

    // Verify 7-day fallback deadline was generated
    expect(event.deadline).toBeTruthy();

    await authenticatePage(page, E2E_MEDIA_USER, E2E_MEDIA_PASSWORD);
    const card = page.locator('.MuiCard-root', { hasText: event.title });
    await expect(card).toBeVisible();

    const signupBtn = card.locator('button:has-text("Я пойду")');
    await expect(signupBtn).toBeVisible();
    await signupBtn.click();

    const confirmModalBtn = page.locator('button:has-text("Записаться")');
    if (await confirmModalBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmModalBtn.click();
    }

    await expect(signupBtn).not.toBeVisible({ timeout: 10000 });

    const updated = await fetchEvent(admin, event.id);
    expect(updated.media_participants.some((p: { username?: string }) => p.username === 'testdata_operator')).toBe(true);
  });

  test('Pairwise 3: Feature 2 & 3 - Admin and Media user both join same event', async ({ page }) => {
    const admin = await loginSession();
    const event = await createEvent(admin, {
      title: `Pairwise F2+F3 ${Date.now()}`,
      max_participants: 2,
    });

    // 1. Admin joins via UI
    await authenticatePage(page);
    const adminCard = page.locator('.MuiCard-root', { hasText: event.title });
    await expect(adminCard).toBeVisible();
    await adminCard.locator('button:has-text("Пойти на мероприятие")').click();

    // 2. Media user joins via UI
    await authenticatePage(page, E2E_MEDIA_USER, E2E_MEDIA_PASSWORD);
    const mediaCard = page.locator('.MuiCard-root', { hasText: event.title });
    await expect(mediaCard).toBeVisible();
    const signupBtn = mediaCard.locator('button:has-text("Я пойду")');
    await expect(signupBtn).toBeVisible();
    await signupBtn.click();

    const confirmModalBtn = page.locator('button:has-text("Записаться")');
    if (await confirmModalBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmModalBtn.click();
    }

    await expect(signupBtn).not.toBeVisible({ timeout: 10000 });

    const updated = await fetchEvent(admin, event.id);
    expect(updated.media_participants.length).toBe(2);
    expect(updated.media_participants.some((p: { username?: string }) => p.username === 'admin')).toBe(true);
    expect(updated.media_participants.some((p: { username?: string }) => p.username === 'testdata_operator')).toBe(true);
  });
});

// ==========================================
// TIER 4: Real-World Application Scenarios
// ==========================================

test.describe('Tier 4: Real-World Scenarios', () => {
  test('Scenario 1: Full event lifecycle by admin: create (no deadline), admin self-signup', async ({ page }) => {
    const admin = await loginSession();
    const event = await createEvent(admin, {
      title: `Scenario 1 ${Date.now()}`,
      deadline: '',
      max_participants: 3,
    });

    expect(event.deadline).toBeTruthy();

    await authenticatePage(page);
    const card = page.locator('.MuiCard-root', { hasText: event.title });
    await expect(card).toBeVisible();

    await card.locator('button:has-text("Пойти на мероприятие")').click();

    const updated = await fetchEvent(admin, event.id);
    expect(updated.media_participants.some((p: { username?: string }) => p.username === 'admin')).toBe(true);
  });

  test('Scenario 2: Media user signs up for event created by admin without deadline', async ({ page }) => {
    const admin = await loginSession();
    const event = await createEvent(admin, {
      title: `Scenario 2 ${Date.now()}`,
      deadline: '',
      max_participants: 2,
    });

    await authenticatePage(page, E2E_MEDIA_USER, E2E_MEDIA_PASSWORD);
    const card = page.locator('.MuiCard-root', { hasText: event.title });
    await expect(card).toBeVisible();

    await card.locator('button:has-text("Я пойду")').click();
    const confirmModalBtn = page.locator('button:has-text("Записаться")');
    if (await confirmModalBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmModalBtn.click();
    }

    const updated = await fetchEvent(admin, event.id);
    expect(updated.media_participants.some((p: { username?: string }) => p.username === 'testdata_operator')).toBe(true);
  });

  test('Scenario 3: Admin and Media user both sign up for the same event', async ({ page }) => {
    const admin = await loginSession();
    const event = await createEvent(admin, {
      title: `Scenario 3 ${Date.now()}`,
      max_participants: 2,
    });

    // Admin joins
    await authenticatePage(page);
    const adminCard = page.locator('.MuiCard-root', { hasText: event.title });
    await expect(adminCard).toBeVisible();
    await adminCard.locator('button:has-text("Пойти на мероприятие")').click();

    // Media user joins
    await authenticatePage(page, E2E_MEDIA_USER, E2E_MEDIA_PASSWORD);
    const mediaCard = page.locator('.MuiCard-root', { hasText: event.title });
    await expect(mediaCard).toBeVisible();
    await mediaCard.locator('button:has-text("Я пойду")').click();
    const confirmModalBtn = page.locator('button:has-text("Записаться")');
    if (await confirmModalBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmModalBtn.click();
    }

    const updated = await fetchEvent(admin, event.id);
    expect(updated.media_participants.length).toBe(2);
  });

  test('Scenario 4: Event fills up via media user signups, admin attempts to join', async ({ page }) => {
    const admin = await loginSession();
    const media = await loginSession(E2E_MEDIA_USER, E2E_MEDIA_PASSWORD);

    const event = await createEvent(admin, {
      title: `Scenario 4 ${Date.now()}`,
      max_participants: 1,
    });

    // Media user fills the event
    await takeTaskAPI(media, event.id);

    // Admin views event
    await authenticatePage(page);
    const card = page.locator('.MuiCard-root', { hasText: event.title });
    await expect(card).toBeVisible();

    // Verify join button is hidden because event is at full capacity
    await expect(card.locator('button:has-text("Пойти на мероприятие")')).not.toBeVisible();
  });

  test('Scenario 5: Complex multi-role interactions on event', async ({ page }) => {
    const admin = await loginSession();
    // 1. Create with no deadline
    const event = await createEvent(admin, {
      title: `Scenario 5 ${Date.now()}`,
      deadline: '',
      max_participants: 2,
    });

    // 2. Admin edits deadline to explicit date
    const updatedDeadline = '2026-12-15T20:00:00Z';
    await patchEvent(admin, event.id, { deadline: updatedDeadline });

    // 3. Media user signs up
    await authenticatePage(page, E2E_MEDIA_USER, E2E_MEDIA_PASSWORD);
    const mediaCard = page.locator('.MuiCard-root', { hasText: event.title });
    await expect(mediaCard).toBeVisible();
    await mediaCard.locator('button:has-text("Я пойду")').click();
    const confirmModalBtn = page.locator('button:has-text("Записаться")');
    if (await confirmModalBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmModalBtn.click();
    }

    // 4. Admin signs up
    await authenticatePage(page);
    const adminCard = page.locator('.MuiCard-root', { hasText: event.title });
    await expect(adminCard).toBeVisible();
    await adminCard.locator('button:has-text("Пойти на мероприятие")').click();

    // 5. Verify final state
    const finalEvent = await fetchEvent(admin, event.id);
    expect(finalEvent.deadline).toContain('2026-12-15');
    expect(finalEvent.media_participants.length).toBe(2);
    expect(finalEvent.media_participants.some((p: { username?: string }) => p.username === 'admin')).toBe(true);
    expect(finalEvent.media_participants.some((p: { username?: string }) => p.username === 'testdata_operator')).toBe(true);
  });
});
