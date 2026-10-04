/**
 * Visual-system oracle for the styling card: every listed page renders in the
 * one token-based visual system — signed-in pages inside the shared sidebar +
 * top-bar shell, grouped Vendor / Customer / Admin navigation — with no
 * horizontal overflow on phone or desktop. Signed-out Login / Sign Up too.
 *
 * Hermetic: runs against the static SPA build with every /api/** call mocked.
 */
import { test, expect, type Page } from '@playwright/test';
import { mockApi, login } from '../spec/_support';

test.use({ serviceWorkers: 'block' });

const FEATURE_PAGES: { path: string; testId: string; group: 'vendor' | 'customer' | 'admin' }[] = [
  { path: 'vendor/profile', testId: 'vendor-profile-screen', group: 'vendor' },
  { path: 'channels', testId: 'channels-screen', group: 'vendor' },
  { path: 'invoices', testId: 'invoices-screen', group: 'vendor' },
  { path: 'settings/notifications', testId: 'settings-notifications-screen', group: 'vendor' },
  { path: 'orders', testId: 'orders-screen', group: 'customer' },
  { path: 'admin/customers', testId: 'admin-customers-screen', group: 'admin' },
  { path: 'admin/audit-log', testId: 'admin-audit-log-screen', group: 'admin' },
];

const SHELL_PAGES = ['dashboard', 'settings', 'admin'];

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
];

async function expectNoHorizontalOverflow(page: Page, label: string): Promise<void> {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    const main = document.querySelector('main.main-content') as HTMLElement | null;
    return {
      doc: doc.scrollWidth - doc.clientWidth,
      main: main ? main.scrollWidth - main.clientWidth : 0,
    };
  });
  expect(overflow.doc, `${label}: document overflows horizontally`).toBeLessThanOrEqual(1);
  expect(overflow.main, `${label}: main content overflows horizontally`).toBeLessThanOrEqual(1);
}

test.describe('visual-system shell', () => {
  for (const vp of VIEWPORTS) {
    test(`visual-system shell: feature pages render inside the sidebar shell (${vp.name})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await mockApi(page);
      await login(page);
      for (const p of FEATURE_PAGES) {
        await page.goto(`/#/${p.path}`);
        const screen = page.locator(`main.main-content [data-testid="${p.testId}"]`);
        await expect(screen, p.path).toBeVisible();
        await expect(page.locator('aside.sidebar'), p.path).toHaveCount(1);
        // Token primitives applied: the page root is a .page and uses the token spacing.
        await expect(screen, p.path).toHaveClass(/\bpage\b/);
        await expectNoHorizontalOverflow(page, `${vp.name} ${p.path}`);
      }
    });
  }

  test('visual-system shell: sidebar groups nav into Vendor / Customer / Admin', async ({ page }) => {
    await mockApi(page);
    await login(page);
    await page.goto('/#/channels');
    await expect(page.locator('[data-testid="channels-screen"]')).toBeVisible();
    for (const p of FEATURE_PAGES) {
      const group = page.locator(`aside.sidebar [data-nav-group="${p.group}"]`);
      await expect(group).toHaveCount(1);
      await expect(group.locator(`a[href="#/${p.path}"]`), p.path).toHaveCount(1);
    }
    const labels = await page.locator('aside.sidebar .nav-group-label').allInnerTexts();
    expect(labels.map((l) => l.trim().toLowerCase())).not.toContain('workspace');
  });

  test('visual-system shell: desktop top bar is shown above every signed-in page', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await mockApi(page);
    await login(page);
    for (const r of [...FEATURE_PAGES.map((p) => p.path), ...SHELL_PAGES]) {
      await page.goto(`/#/${r}`);
      await expect(page.locator('main.main-content .top-bar'), r).toBeVisible();
      await expectNoHorizontalOverflow(page, `desktop ${r}`);
    }
  });

  test('visual-system shell: tokens are defined and page primitives read them', async ({ page }) => {
    await mockApi(page);
    await login(page);
    await page.goto('/#/orders');
    await expect(page.locator('[data-testid="orders-screen"]')).toBeVisible();
    const probe = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      const el = document.querySelector('[data-testid="orders-screen"]') as HTMLElement;
      const cs = getComputedStyle(el);
      return {
        space4: root.getPropertyValue('--space-4').trim(),
        maxWidth: root.getPropertyValue('--page-max-width').trim(),
        overlay: root.getPropertyValue('--color-overlay').trim(),
        pageMaxWidth: cs.maxWidth,
      };
    });
    expect(probe.space4).not.toBe('');
    expect(probe.maxWidth).not.toBe('');
    expect(probe.overlay).not.toBe('');
    expect(probe.pageMaxWidth).not.toBe('none');
  });

  for (const vp of VIEWPORTS) {
    test(`visual-system shell: signed-out login and sign-up pages fit (${vp.name})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await mockApi(page);
      await page.goto('/#/login');
      await expect(page.locator('#email')).toBeVisible();
      await expect(page.locator('aside.sidebar')).toHaveCount(0);
      await expectNoHorizontalOverflow(page, `${vp.name} login`);
      await page.goto('/#/signup/1');
      await page.waitForLoadState('networkidle');
      await expect(page.locator('aside.sidebar')).toHaveCount(0);
      await expectNoHorizontalOverflow(page, `${vp.name} signup`);
    });
  }
});
