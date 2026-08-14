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

/** Phones (<=767px) render #cap-mobile instead of the scaled 1440 frame. */
const isPhone = (testInfo) => testInfo.project.name === 'mobile';

/** The homepage hydrates its React frame + binds nav ~0.5–1.6s after load. */
async function gotoHome(page, testInfo) {
  await page.goto(HOME, { waitUntil: 'networkidle' });
  // Nav spans get role="link" when the binding timer has run — wait on that,
  // not on a fixed sleep. (Attached, not visible: below 900px they are hidden
  // and below 768px the whole frame is.)
  // PROJECTS, not ABOUT US: the export splits two-word labels into separate
  // child spans, so the top nav's textContent is "ABOUTUS" and never matched
  // "ABOUT US". This used to pass only because the baked FOOTER carried a
  // second, properly spaced copy — and that footer is gone (2026-08-14, one
  // shared <footer class="site-footer"> for every page). A single-word label
  // matches the real top nav on its own.
  await page
    .locator('span[role="link"]', { hasText: 'PROJECTS' })
    .first()
    .waitFor({ state: 'attached', timeout: 15000 });
  if (testInfo && isPhone(testInfo)) {
    // The frame-bound setups (including the journey band) are skipped on
    // phones, so #cap-journey never mounts — wait on the mobile layout being
    // populated instead.
    await page.waitForSelector('#cap-mobile .cm-acc-item', { timeout: 15000 });
  } else {
    // The journey band setup (deferred ~1.6s) reorganizes the whole page
    // (shifts every element below the band) — clicking before it lands races
    // moving targets. The #cap-journey host appears only after that reorg.
    await page.waitForSelector('#cap-journey', { timeout: 15000 });
  }
  await page.waitForTimeout(300); // one settle beat for the reflow
}

test.describe('homepage regression', () => {
  // Each of these loads the full ~11k-px animated homepage; under parallel-
  // suite CPU contention they slow down without being broken — give the
  // whole group headroom instead of racing the 30s default.
  test.describe.configure({ timeout: 90000 });
  test('smoke: loads at /, hero renders, no console errors or failed assets', async ({ page }, testInfo) => {
    const errors = attachErrorCapture(page);
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500); // hydration + deferred animation setups

    await expect(page).toHaveTitle(/Cappella/);

    if (isPhone(testInfo)) {
      // Phones swap the scaled frame for the purpose-built mobile layout.
      await expect(page.locator('#cap-viewport')).toBeHidden();
      await expect(page.locator('#cap-mobile')).toBeVisible();
      await expect(page.locator('#cap-mobile h1')).toContainText('Edu-Infra Asset');
    } else {
      // The materialized frame mounted and laid out (hero text is split into
      // per-character spans by SplitType, so text matching is not reliable —
      // assert structural integrity instead).
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
    }

    expectNoPageErrors(errors);
  });

  test('top-nav spans navigate to the four pages', async ({ page }, testInfo) => {
    // The baked hero nav (.cap-nav) is hidden below 900px, where the hamburger
    // overlay is the nav instead (see "hamburger overlay navigates" below).
    test.skip(testInfo.project.name !== 'desktop', 'hero nav spans are desktop-only; mobile/tablet navigate via the hamburger overlay');
    await gotoHome(page);

    // Regexes tolerant of the missing space: the export splits two-word labels
    // into separate child spans, so the hero nav's textContent is "ABOUTUS".
    // The literal 'ABOUT US' these used to pass with was matching the baked
    // FOOTER's spaced copy, not the hero nav this test is named for — so it
    // only started failing when that footer was retired (2026-08-14).
    await page.locator('span[role="link"]', { hasText: /ABOUT\s*US/ }).first().click();
    await expect(page).toHaveURL(/about-us\.html$/);

    await gotoHome(page);
    await page.locator('span[role="link"]', { hasText: 'PROJECTS' }).first().click();
    await expect(page).toHaveURL(/projects\.html$/);

    await gotoHome(page);
    await page.locator('span[role="link"]', { hasText: 'TEAM' }).first().click();
    await expect(page).toHaveURL(/team\.html$/);

    await gotoHome(page);
    await page.locator('span[role="link"]', { hasText: /CONTACT\s*US/ }).first().click();
    await expect(page).toHaveURL(/contact-us\.html$/);
  });

  test('keyboard: converted nav spans are focusable and Enter navigates', async ({ page }, testInfo) => {
    // Hero nav spans are hidden below 900px (mobile/tablet use the hamburger),
    // so keyboard focus on them is a desktop-only concern.
    test.skip(testInfo.project.name !== 'desktop', 'hero nav spans are desktop-only');
    await gotoHome(page);

    // See the note above on why this is a regex and not 'ABOUT US'.
    const about = page.locator('span[role="link"]', { hasText: /ABOUT\s*US/ }).first();
    await expect(about).toHaveAttribute('tabindex', '0');
    await about.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/about-us\.html$/);
  });

  test('hamburger overlay navigates to the four pages (mobile/tablet)', async ({ page }, testInfo) => {
    // Below 900px the baked hero nav is hidden and the cap-menu-btn hamburger
    // is the nav: it shows from the top (no scroll needed) and opens a panel
    // whose links are real page navigations.
    test.skip(testInfo.project.name === 'desktop', 'hero spans cover nav at desktop scale; this is the small-screen path');
    const targets = [
      ['about-us.html', /about-us\.html$/],
      ['projects.html', /projects\.html$/],
      ['team.html', /team\.html$/],
      ['contact-us.html', /contact-us\.html$/]
    ];
    for (const [href, url] of targets) {
      await gotoHome(page, testInfo);
      // Hero spans must be out of the way on small screens.
      await expect(page.locator('#cap-scaler span.cap-nav').first()).toBeHidden();
      const btn = page.locator('#cap-menu-btn');
      await expect(btn).toBeVisible();
      await btn.click();
      await expect(page.locator('#cap-menu-panel')).toBeVisible();
      await page.locator(`.cap-menu-links a[href="${href}"]`).click();
      await expect(page).toHaveURL(url);
    }
  });

  test('menu overlay: page links navigate, X and Escape close', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'overlay interaction covered at desktop scale');
    await gotoHome(page);

    // The circular menu button appears after scrolling past ~180px
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.locator('#cap-menu-btn').click();
    const panel = page.locator('#cap-menu-panel');
    await expect(panel).toBeVisible();

    // Client 2026-08-09 (p23): the EXPLORE row and its data-target in-page
    // glide were removed, so the assertion that used to live here is now that
    // no such link exists — with its click handler deleted alongside it.
    await expect(panel.locator('a[data-target]')).toHaveCount(0);

    // The X closes it (this replaced a button labelled CLOSE)
    await page.locator('#cap-menu-close').click();
    await expect(panel).not.toBeInViewport();

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

  test('footer links navigate (PROJECTS → projects)', async ({ page }, testInfo) => {
    // Runs on every project now, phones included. The homepage used to carry
    // two bespoke footers — the baked frame's role="link" spans on desktop and
    // #cap-mobile .cm-fnav on phones — so this test had to skip phones and dig
    // the right span out of three PROJECTS matches. Since 2026-08-14 all six
    // pages share one <footer class="site-footer"> of real anchors, at every
    // breakpoint, so the assertion is just the anchor.
    testInfo.setTimeout(60000);
    await gotoHome(page, testInfo);
    const footerLink = page.locator('.site-footer a[href="projects.html"]');
    await footerLink.scrollIntoViewIfNeeded();
    await expect(footerLink).toBeVisible();
    await footerLink.click();
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
