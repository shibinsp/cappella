// Phase 6 gate: full regression — homepage integrity after the nav
// conversion, cross-site link health, reduced motion, homepage screenshots.
const { test, expect } = require('./fixtures');
const {
  attachErrorCapture,
  expectNoPageErrors,
  fullPageShot,
  PAGES
} = require('./helpers');

const HOME = '/index.html';

/** The homepage hydrates its React frame + binds nav ~0.5–1.6s after load. */
async function gotoHome(page) {
  await page.goto(HOME, { waitUntil: 'networkidle' });
  // Nav spans get role="link" when the binding timer has run — wait on that,
  // not on a fixed sleep.
  await page
    .locator('span[role="link"]', { hasText: 'ABOUT US' })
    .first()
    .waitFor({ state: 'attached', timeout: 15000 });
  // The journey band setup (deferred ~1.6s) reorganizes the whole page
  // (shifts every element below the band) — clicking before it lands races
  // moving targets. The #cap-journey host appears only after that reorg.
  await page.waitForSelector('#cap-journey', { timeout: 15000 });
  await page.waitForTimeout(300); // one settle beat for the reflow
}

test.describe('homepage regression', () => {
  // Each of these loads the full ~11k-px animated homepage; under parallel-
  // suite CPU contention they slow down without being broken — give the
  // whole group headroom instead of racing the 30s default.
  test.describe.configure({ timeout: 90000 });
  test('smoke: loads at /, hero renders, no console errors or failed assets', async ({ page }) => {
    const errors = attachErrorCapture(page);
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500); // hydration + deferred animation setups

    // The materialized frame mounted and laid out (hero text is split into
    // per-character spans by SplitType, so text matching is not reliable —
    // assert structural integrity instead).
    await expect(page).toHaveTitle(/Cappella/);
    await expect(page.locator('#cap-scaler')).toBeVisible();
    // The frame is scaled by viewportWidth/1440, so its rendered height is
    // viewport-dependent — assert relative to the design height at scale.
    const { frameHeight, expected } = await page.locator('#cap-scaler').evaluate((el) => ({
      frameHeight: el.getBoundingClientRect().height,
      expected: 7000 * (window.innerWidth / 1440)
    }));
    expect(frameHeight, 'materialized frame should have its scaled design height').toBeGreaterThan(expected * 0.8);
    // The hero heading element exists inside the frame
    const heroSpans = await page.locator('#cap-scaler span').count();
    expect(heroSpans, 'frame should contain its text spans').toBeGreaterThan(50);

    expectNoPageErrors(errors);
  });

  test('top-nav spans navigate to the four pages', async ({ page }, testInfo) => {
    await gotoHome(page);

    await page.locator('span[role="link"]', { hasText: 'ABOUT US' }).first().click();
    await expect(page).toHaveURL(/about-us\.html$/);

    await gotoHome(page);
    await page.locator('span[role="link"]', { hasText: 'PROJECTS' }).first().click();
    await expect(page).toHaveURL(/projects\.html$/);

    await gotoHome(page);
    await page.locator('span[role="link"]', { hasText: 'TEAM' }).first().click();
    await expect(page).toHaveURL(/team\.html$/);

    await gotoHome(page);
    await page.locator('span[role="link"]', { hasText: 'CONTACT US' }).first().click();
    await expect(page).toHaveURL(/contact-us\.html$/);
  });

  test('keyboard: converted nav spans are focusable and Enter navigates', async ({ page }, testInfo) => {
    await gotoHome(page);

    const about = page.locator('span[role="link"]', { hasText: 'ABOUT US' }).first();
    await expect(about).toHaveAttribute('tabindex', '0');
    await about.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/about-us\.html$/);
  });

  test('menu overlay: page links navigate, EXPLORE still scrolls in-page, Escape closes', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'overlay interaction covered at desktop scale');
    await gotoHome(page);

    // The circular menu button appears after scrolling past ~180px
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.locator('#cap-menu-btn').click();
    const panel = page.locator('#cap-menu-panel');
    await expect(panel).toBeVisible();

    // EXPLORE row keeps data-target in-page scroll: URL unchanged, page
    // scrolls. The Lenis glide takes ~1.2s and runs on rAF, which parallel-
    // suite CPU contention can throttle — poll instead of a fixed wait.
    const beforeUrl = page.url();
    await panel.locator('a[data-target="3200"]').click(); // Our Journey
    await expect
      .poll(() => page.evaluate(() => window.scrollY), { timeout: 10000 })
      .toBeGreaterThan(1000);
    expect(page.url()).toBe(beforeUrl);

    // Escape closes the overlay
    await page.locator('#cap-menu-btn').click();
    await expect(panel).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(panel).not.toBeInViewport();

    // Main menu links are real page navigations now
    await page.locator('#cap-menu-btn').click();
    await panel.locator('a[href="projects.html"]').click();
    await expect(page).toHaveURL(/projects\.html$/);
  });

  test('footer spans navigate (PORTFOLIO → projects)', async ({ page }, testInfo) => {
    // The page is much taller with the pinned journey gap — scrolling to the
    // footer and binding retries need headroom under parallel load.
    testInfo.setTimeout(60000);
    await gotoHome(page);
    // Wait for the footer reveal flip, re-nudging the scroll each poll (the
    // flip listens to scroll; under heavy CPU contention a single programmatic
    // jump can land before the listener registers).
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight);
            return document.getElementById('cap-scaler').classList.contains('cap-footer-in');
          }),
        { timeout: 25000 }
      )
      .toBe(true);
    // …then let the staggered entrance finish so the click target is stable.
    await page.waitForTimeout(1800);
    await page.locator('span[role="link"]', { hasText: 'PORTFOLIO' }).first().click();
    await expect(page).toHaveURL(/projects\.html$/);
  });

  test('homepage full-page screenshot', async ({ page }, testInfo) => {
    // Capturing the full ~8,000px frame (grain + dot-grid + marquee canvases
    // live) is heavy; give it headroom under parallel-suite CPU contention.
    testInfo.setTimeout(150000);
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    await fullPageShot(page, testInfo, 'homepage');
  });
});

test.describe('cross-site link health', () => {
  test('every internal link on all five pages resolves 200', async ({ page, request }, testInfo) => {
    // Crawls five pages (two heavy homepage loads at networkidle) — needs
    // headroom beyond the 30s default under parallel-suite contention.
    testInfo.setTimeout(90000);

    const targets = new Set();
    const pagesToCrawl = [HOME, ...PAGES.map((p) => `/${p.file}`)];

    for (const path of pagesToCrawl) {
      await page.goto(path, { waitUntil: 'networkidle' });
      await page.waitForTimeout(path === HOME ? 2500 : 300); // homepage builds menu links in JS
      const hrefs = await page
        .locator('a[href]')
        .evaluateAll((as) => as.map((a) => a.getAttribute('href')));
      for (const h of hrefs) {
        if (!h || h.startsWith('mailto:') || h.startsWith('http') || h.startsWith('#')) continue;
        targets.add(h);
      }
    }

    expect(targets.size).toBeGreaterThanOrEqual(5);
    for (const t of targets) {
      const res = await request.get(`/${t.replace(/^\.?\//, '')}`);
      expect(res.status(), `link "${t}" should resolve`).toBe(200);
    }
  });
});

test.describe('reduced motion', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } });

  for (const pageDef of PAGES) {
    test(`${pageDef.file}: all reveal content immediately visible`, async ({ page }) => {
      await page.goto(`/${pageDef.file}`);
      await page.waitForTimeout(300);

      const opacities = await page
        .locator('[data-reveal]')
        .evaluateAll((els) => els.map((el) => getComputedStyle(el).opacity));
      for (const o of opacities) {
        expect(o).toBe('1');
      }
    });
  }
});
