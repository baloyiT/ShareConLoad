import { test, expect, type Page } from '@playwright/test';
import { adminClient, createTestUser, deleteTestUser, signInBrowser, sweepTestUsers, type TestUser } from './helpers/frontDoorUsers';
import { buildEnquiryContactUrl } from '../components/HomeEnquiryForm';

test.beforeAll(async () => {
  test.setTimeout(120_000);
  await sweepTestUsers();
});

test.setTimeout(120_000);

const FOOTER_LINE = 'Independent operators deliver the freight and are responsible for it. ShareConLoad connects you.';

const users: TestUser[] = [];

test.afterEach(async () => {
  test.setTimeout(120_000);
  for (const u of users.splice(0)) {
    try { await deleteTestUser(u); } catch (err) { console.error('cleanup failed', u.email, err); }
  }
});

type PortalRole = 'admin' | 'operator' | 'agent' | 'measurement_agent' | 'transporter' | 'customer';

// The user is recorded before any extra rows are seeded, so cleanup covers a partial seed.
async function newUser(role: PortalRole): Promise<TestUser> {
  const base = role === 'admin' || role === 'operator' ? role : 'customer';
  const user = await createTestUser(base);
  users.push(user);
  if (role === base) return user;

  const admin = adminClient();
  const { data: profile, error } = await admin
    .from('profiles')
    .insert({ user_id: user.id, role_type: role, is_admin: false })
    .select('id')
    .single();
  if (error || !profile) throw new Error(`profile insert failed: ${error?.message}`);

  if (role === 'agent') {
    // The /agent layout only admits an approved agent.
    const { error: agentErr } = await admin
      .from('agent_profiles')
      .insert({ profile_id: profile.id, business_name: 'Front Door Test Agent', status: 'approved' });
    if (agentErr) throw new Error(`agent_profiles insert failed: ${agentErr.message}`);
  }
  return user;
}

const pathOf = (page: Page) => new URL(page.url()).pathname;

// Waits for the signed-in home page, which also means its auth listener is attached.
async function openHomeSignedIn(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Sign out' }).first()).toBeVisible({ timeout: 20_000 });
}

// Returning to the tab makes Supabase recover the session and emit SIGNED_IN.
// auth-js listens on window, so the event has to be sent there.
async function returnToTab(page: Page) {
  await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')));
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe('public home', () => {
  test('home shows "What do you need to move?" and Browse operators link', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'What do you need to move?' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 }))
      .toHaveText("Tell us what you need to move. We'll find the right operators.");
    await expect(page.getByRole('link', { name: 'Browse operators' })).toHaveAttribute('href', '/directory');
  });

  test('home shows the three steps and the operator invitation', async ({ page }) => {
    await page.goto('/');
    for (const step of ['Describe it', 'We check and match', 'Compare and choose']) {
      await expect(page.getByRole('heading', { name: step })).toBeVisible();
    }
    await expect(page.getByRole('main').getByRole('link', { name: 'For operators' }))
      .toHaveAttribute('href', '/for-operators');
  });

  test('home has no container listing, List Your Container or Join as Agent', async ({ page }) => {
    const containerReads: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/rest/v1/containers')) containerReads.push(req.url());
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'What do you need to move?' })).toBeVisible();
    await expect(page.getByText('Available Containers')).toHaveCount(0);
    await expect(page.getByText(/List Your Container/i)).toHaveCount(0);
    await expect(page.getByText(/Join as Agent/i)).toHaveCount(0);
    await expect(page.getByText(/Become an Agent/i)).toHaveCount(0);
    expect(containerReads).toEqual([]);
  });

  test('home links to no Stage 3 entry point', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'What do you need to move?' })).toBeVisible();
    const hrefs = await page.locator('a[href]').evaluateAll(
      (links) => links.map((a) => a.getAttribute('href') ?? ''),
    );
    const stage3 = hrefs.filter((href) => /^\/(#listings|onboarding|container|booking\/|agent|transporter|measurement|pickup)/.test(href));
    expect(stage3).toEqual([]);
  });

  test('footer shows the operator responsibility line', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('contentinfo').getByText(FOOTER_LINE, { exact: true })).toBeVisible();
  });

  test('navigation links go to the right places', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Main' });
    await expect(nav.getByRole('link', { name: 'Find operators' })).toHaveAttribute('href', '/directory');
    await expect(nav.getByRole('link', { name: 'How it works' })).toHaveAttribute('href', '/how-it-works');
    await expect(nav.getByRole('link', { name: 'For operators' })).toHaveAttribute('href', '/for-operators');
    await expect(nav.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/auth/login');
    await expect(nav.getByRole('link', { name: 'Get quotes' })).toHaveAttribute('href', '/#get-quotes');
  });

  test('Get quotes brings the enquiry form into view', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 400 });
    await page.goto('/');
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Get quotes' }).click();
    await expect(page.locator('#get-quotes')).toBeInViewport();
  });

  test('site title uses the new position', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('ShareConLoad – Freight. Connected.');
    await expect(page.locator('meta[name="description"]')).not.toHaveAttribute('content', /container/i);
  });
});

test.describe('enquiry form', () => {
  test('Continue opens /contact with the three answers in the message', async ({ page }) => {
    const what = 'Tom & Jerry\'s "sofa" <b>fragile</b> 100%';
    await page.goto('/');
    await page.getByLabel('What do you need to move?').fill(what);
    await page.getByLabel('From').fill('Johannesburg, South Africa');
    await page.getByLabel('To', { exact: true }).fill('Accra, Ghana');
    await page.getByRole('button', { name: 'Continue' }).click();

    await page.waitForURL((url) => url.pathname === '/contact', { timeout: 20_000 });
    const params = new URL(page.url()).searchParams;
    expect(params.get('subject')).toBe('Freight enquiry');
    expect(params.get('message')).toBe(
      `What I need to move: ${what}\nFrom: Johannesburg, South Africa\nTo: Accra, Ghana`,
    );
  });

  test('Continue needs a description', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.waitForTimeout(500);
    expect(pathOf(page)).toBe('/');
  });

  test('From suggestions can be picked and are not cut off by the hero', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('From').pressSequentially('Accr');
    await page.getByRole('option', { name: 'Accra, Ghana' }).click();
    await expect(page.getByLabel('From')).toHaveValue('Accra, Ghana');
  });

  test('buildEnquiryContactUrl encodes the answers', () => {
    const url = buildEnquiryContactUrl('a&b=c', 'Durban', 'Lagos');
    expect(url.startsWith('/contact?subject=Freight%20enquiry&message=')).toBe(true);
    expect(new URL(url, 'http://x').searchParams.get('message'))
      .toBe('What I need to move: a&b=c\nFrom: Durban\nTo: Lagos');
  });

  test('buildEnquiryContactUrl says Not sure for a blank route', () => {
    const url = buildEnquiryContactUrl('A piano', ' ', '');
    expect(new URL(url, 'http://x').searchParams.get('message'))
      .toBe('What I need to move: A piano\nFrom: Not sure\nTo: Not sure');
  });

  test('buildEnquiryContactUrl keeps 500 characters and never splits an emoji', () => {
    const long = new URL(buildEnquiryContactUrl('x'.repeat(600), 'A', 'B'), 'http://x');
    expect(long.searchParams.get('message')).toBe(`What I need to move: ${'x'.repeat(500)}\nFrom: A\nTo: B`);

    // The 500th character is an emoji, which is two UTF-16 units.
    const emoji = new URL(buildEnquiryContactUrl(`${'x'.repeat(499)}😀tail`, 'A', 'B'), 'http://x');
    expect(emoji.searchParams.get('message')).toBe(`What I need to move: ${'x'.repeat(499)}😀\nFrom: A\nTo: B`);
  });
});

// The home page routes a role holder to their portal on the SIGNED_IN event, as it did
// before the rewrite. A plain page load emits INITIAL_SESSION, so it does not redirect.
test.describe('role routing on /', () => {
  const PORTALS: [PortalRole, string][] = [
    ['admin', '/admin'],
    ['operator', '/operator'],
    ['agent', '/agent'],
    ['measurement_agent', '/measurement-agent'],
    ['transporter', '/transporter'],
  ];

  for (const [role, portal] of PORTALS) {
    test(`logged-in ${role} on / reaches ${portal} on SIGNED_IN`, async ({ page }) => {
      const user = await newUser(role);
      await signInBrowser(page, user);
      await openHomeSignedIn(page);
      await returnToTab(page);
      await page.waitForURL((url) => url.pathname === portal, { timeout: 20_000 });
    });
  }

  test('an admin who also holds an operator row goes to /admin first', async ({ page }) => {
    const user = await newUser('admin');
    const { error } = await adminClient()
      .from('profiles')
      .insert({ user_id: user.id, role_type: 'operator', is_admin: false });
    expect(error).toBeNull();
    await signInBrowser(page, user);
    await openHomeSignedIn(page);
    await returnToTab(page);
    await page.waitForURL((url) => url.pathname === '/admin', { timeout: 20_000 });
  });

  test('logged-in customer stays on / on SIGNED_IN', async ({ page }) => {
    const user = await newUser('customer');
    await signInBrowser(page, user);
    await openHomeSignedIn(page);
    await returnToTab(page);
    await page.waitForTimeout(4000);
    expect(pathOf(page)).toBe('/');
  });

  test('logged-in operator opening / with no SIGNED_IN stays on /', async ({ page }) => {
    const user = await newUser('operator');
    await signInBrowser(page, user);
    await openHomeSignedIn(page);
    await page.waitForTimeout(4000);
    expect(pathOf(page)).toBe('/');
  });
});

test.describe('signed-in navigation', () => {
  test('admin sees My Bookings, Admin and Sign out, not Log in', async ({ page }) => {
    const user = await newUser('admin');
    await signInBrowser(page, user);
    await openHomeSignedIn(page);
    const nav = page.getByRole('navigation', { name: 'Main' });
    await expect(nav.getByRole('link', { name: 'My Bookings' })).toHaveAttribute('href', '/bookings');
    await expect(nav.getByRole('link', { name: 'Admin' })).toHaveAttribute('href', '/admin');
    await expect(nav.getByRole('link', { name: 'Log in' })).toHaveCount(0);
  });

  test('customer sees no Admin link', async ({ page }) => {
    const user = await newUser('customer');
    await signInBrowser(page, user);
    await openHomeSignedIn(page);
    await expect(page.getByRole('link', { name: 'My Bookings' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Admin' })).toHaveCount(0);
  });
});

test.describe('mobile', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('home has no horizontal scroll at 375px wide', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'What do you need to move?' })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test('menu opens at 375px with the public links', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Open menu' }).click();
    const drawer = page.getByRole('complementary');
    await expect(drawer.getByRole('link', { name: 'Find operators' })).toHaveAttribute('href', '/directory');
    await expect(drawer.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/auth/login');
    await expectNoHorizontalScroll(page);
  });

  test('signed-in home has no horizontal scroll at 375px and the menu offers Sign out', async ({ page }) => {
    const user = await newUser('customer');
    await signInBrowser(page, user);
    await page.goto('/');
    await page.getByRole('button', { name: 'Open menu' }).click();
    const drawer = page.getByRole('complementary');
    await expect(drawer.getByRole('button', { name: 'Sign out' })).toBeVisible({ timeout: 20_000 });
    await expect(drawer.getByRole('link', { name: 'My Bookings' })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});
