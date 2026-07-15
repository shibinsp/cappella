// Phase 1 gate: shared shell — header/nav/footer/menu/a11y on all 4 subpages.
const { test, expect } = require('@playwright/test');
const {
  attachErrorCapture,
  expectNoPageErrors,
  assertNoHorizontalOverflow,
  PAGES
} = require('./helpers');

for (const pageDef of PAGES) {
  test.describe(pageDef.file, () => {
    test('shell: landmarks, single h1, aria-current, footer, no linkedin', async ({ page }) => {
      const errors = attachErrorCapture(page);
      await page.goto(`/${pageDef.file}`);

      // Landmarks
      await expect(page.locator('header.site-header')).toHaveCount(1);
      await expect(page.locator('main')).toHaveCount(1);
      await expect(page.locator('footer.site-footer')).toHaveCount(1);
      await expect(page.locator('nav#site-nav')).toHaveCount(1);

      // Exactly one h1, with the expected text
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('h1')).toContainText(pageDef.h1);

      // aria-current marks exactly this page's nav link
      const current = page.locator('#site-nav a[aria-current="page"]');
      await expect(current).toHaveCount(1);
      await expect(current).toHaveAttribute('href', pageDef.file);

      // Wordmark links home (space encoded)
      await expect(page.locator('.site-logo')).toHaveAttribute(
        'href',
        'Cappella%20Website.dc.html'
      );

      // Footer: mailto + address present; nav links to all 4 pages
      await expect(
        page.locator('footer a[href="mailto:partner@cappella.in"]')
      ).toHaveCount(1);
      await expect(page.locator('footer address')).toContainText('Hyderabad');
      for (const p of PAGES) {
        await expect(
          page.locator(`footer nav a[href="${p.file}"]`)
        ).toHaveCount(1);
      }

      // No LinkedIn anchor anywhere (label-only on homepage; no URL exists)
      await expect(page.locator('a[href*="linkedin"]')).toHaveCount(0);

      // No dead-looking anchors (every href non-empty, not "#")
      const hrefs = await page
        .locator('a')
        .evaluateAll((as) => as.map((a) => a.getAttribute('href')));
      for (const h of hrefs) {
        expect(h, 'anchor with empty/# href').toBeTruthy();
        expect(h).not.toBe('#');
      }

      await assertNoHorizontalOverflow(page);
      expectNoPageErrors(errors);
    });

    test('keyboard: tab reaches nav links with visible focus', async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'desktop', 'inline nav exists only ≥900px (desktop project)');
      await page.goto(`/${pageDef.file}`);

      // Tab from the top: skip link → logo → nav links
      await page.keyboard.press('Tab'); // skip link
      await expect(page.locator('.skip-link')).toBeFocused();
      await page.keyboard.press('Tab'); // logo
      await expect(page.locator('.site-logo')).toBeFocused();
      await page.keyboard.press('Tab'); // first nav link
      const first = page.locator('#site-nav a').first();
      await expect(first).toBeFocused();

      // Focus is visibly indicated (non-none outline from :focus-visible)
      const outline = await first.evaluate(
        (el) => getComputedStyle(el).outlineStyle
      );
      expect(outline).not.toBe('none');
    });
  });
}

test.describe('mobile menu behavior', () => {
  test('opens, closes via button/Escape/backdrop, restores focus, locks scroll', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'desktop', 'panel exists only <900px (tablet + mobile projects)');
    await page.goto('/about-us.html');
    const toggle = page.locator('.nav-toggle');
    const nav = page.locator('#site-nav');

    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(nav).not.toBeInViewport();

    // Open
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(nav).toBeInViewport();
    // Focus moved into the panel
    await expect(nav.locator('a').first()).toBeFocused();
    // Body scroll locked
    const bodyOverflow = await page.evaluate(
      () => getComputedStyle(document.body).overflow
    );
    expect(bodyOverflow).toBe('hidden');

    // Escape closes and returns focus to the toggle
    await page.keyboard.press('Escape');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toBeFocused();

    // Backdrop click closes
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await page.locator('.menu-backdrop').click({ position: { x: 10, y: 300 } });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    // Toggle button closes too
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  test('menu links navigate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'desktop', 'panel exists only <900px (tablet + mobile projects)');
    await page.goto('/about-us.html');
    await page.locator('.nav-toggle').click();
    await page.locator('#site-nav a[href="team.html"]').click();
    await expect(page).toHaveURL(/team\.html$/);
  });
});

test.describe('JavaScript disabled', () => {
  test.use({ javaScriptEnabled: false });

  for (const pageDef of PAGES) {
    test(`${pageDef.file}: content and nav visible without JS`, async ({ page }) => {
      await page.goto(`/${pageDef.file}`);

      // Core content renders
      await expect(page.locator('h1')).toContainText(pageDef.h1);

      // All 4 nav links visible and usable (stacked list on mobile)
      for (const p of PAGES) {
        await expect(page.locator(`#site-nav a[href="${p.file}"]`)).toBeVisible();
      }

      // Toggle button not shown (it's a JS-only affordance)
      await expect(page.locator('.nav-toggle')).toBeHidden();

      // Navigation actually works
      await page.locator(`#site-nav a[href="contact-us.html"]`).click();
      await expect(page).toHaveURL(/contact-us\.html$/);

      await assertNoHorizontalOverflow(page);
    });
  }
});
