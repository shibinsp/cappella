// Phase 1 gate: shared shell — header/nav/footer/menu/a11y on all 4 subpages.
const { test, expect } = require('./fixtures');
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

      // Wordmark links home
      await expect(page.locator('.site-logo')).toHaveAttribute(
        'href',
        'index.html'
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

      // LinkedIn: team.html carries one real profile link per leader (added
      // with the leadership card rebuild, 2026-07-22). Every other page still
      // has none — the homepage reference is label-only.
      const linkedin = page.locator('a[href*="linkedin"]');
      if (pageDef.file === 'team.html') {
        await expect(linkedin).toHaveCount(4);
        // opened in a new tab, so each must be protected against window.opener
        const rels = await linkedin.evaluateAll((as) =>
          as.map((a) => a.getAttribute('rel') || '')
        );
        for (const rel of rels) expect(rel).toContain('noopener');
      } else {
        await expect(linkedin).toHaveCount(0);
      }

      // No dead-looking anchors (every href non-empty, not "#"). Excludes the
      // Leaflet map's own controls (contact page) — its zoom buttons use
      // href="#" by design; that is third-party markup, not ours.
      const hrefs = await page
        .locator('a')
        .evaluateAll((as) =>
          as
            .filter((a) => !a.closest('.leaflet-container'))
            .map((a) => a.getAttribute('href'))
        );
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

test.describe('sticky header', () => {
  for (const pageDef of PAGES) {
    test(`${pageDef.file}: header stays pinned to the top while scrolled`, async ({ page }) => {
      await page.goto(`/${pageDef.file}`);
      await page.waitForTimeout(400);
      // Re-nudge inside the poll (an early scrollTo can be swallowed while
      // Lenis registers), and poll the is-scrolled class too — the scroll
      // event that sets it fires a frame AFTER scrollTo, so a one-shot read
      // races it under parallel-suite CPU contention.
      await expect
        .poll(
          () =>
            page.evaluate(() => {
              window.scrollTo(0, 900);
              return (
                window.scrollY > 300 &&
                document.querySelector('.site-header').classList.contains('is-scrolled')
              );
            }),
          { timeout: 10000 }
        )
        .toBe(true);
      const top = await page.evaluate(() =>
        Math.round(document.querySelector('.site-header').getBoundingClientRect().top)
      );
      expect(top, 'header pinned at viewport top').toBe(0);
    });
  }
});

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
    // Scroll locked — on <html>, not <body> (body overflow:hidden would
    // un-stick the sticky header while the menu is open)
    const rootOverflow = await page.evaluate(
      () => getComputedStyle(document.documentElement).overflow
    );
    expect(rootOverflow).toBe('hidden');

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
