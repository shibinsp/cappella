// The phone home page (#cap-mobile). Below 768px index.html hides the scaled
// 1440 Figma frame entirely and renders a purpose-built flow layout instead —
// see the header comment in shared/css/home-mobile.css. These assertions are
// about that layout: that it is the one showing, that its content comes from
// the shared constants, that it is legible and tappable, and that the desktop
// frame is untouched above the breakpoint.
const { test, expect } = require('./fixtures');
const {
  attachErrorCapture,
  expectNoPageErrors,
  assertNoHorizontalOverflow,
  fullPageShot
} = require('./helpers');

const HOME = '/index.html';

/** Waits for _setupMobileHome to have filled the containers. */
async function gotoMobileHome(page) {
  await page.goto(HOME, { waitUntil: 'networkidle' });
  await page.waitForSelector('#cap-mobile .cm-acc-item', { timeout: 20000 });
  await page.waitForTimeout(300);
}

test.describe('mobile home', () => {
  test.describe.configure({ timeout: 90000 });

  // Everything here is about the phone layout; the frame path is covered by
  // regression.spec.js / animations.spec.js at the other two viewports.
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'the #cap-mobile layout only renders below 768px');
  });

  test('the mobile layout replaces the scaled frame, and nothing overflows', async ({ page }) => {
    const errors = attachErrorCapture(page);
    await gotoMobileHome(page);

    await expect(page.locator('#cap-viewport')).toBeHidden();
    await expect(page.locator('#cap-mobile')).toBeVisible();
    // The frame-bound journey pin must not have been built.
    await expect(page.locator('#cap-journey')).toHaveCount(0);

    // index.html was the one page never covered by this assertion.
    await assertNoHorizontalOverflow(page);
    expectNoPageErrors(errors);
  });

  test('hero renders at a legible size, not the 0.271 scaled-down frame', async ({ page }) => {
    await gotoMobileHome(page);

    const h1 = page.locator('#cap-mobile h1');
    await expect(h1).toBeVisible();
    await expect(h1).toContainText('Edu-Infra Asset');

    // The scaled frame put the 100px headline at ~27px with 6.5px body copy;
    // this layout must not be anywhere near that.
    const sizes = await page.evaluate(() => {
      const px = (sel) => parseFloat(getComputedStyle(document.querySelector(sel)).fontSize);
      return { h1: px('#cap-mobile h1'), sub: px('#cap-mobile .cm-hero-sub'), body: px('#cap-mobile .cm-sub') };
    });
    expect(sizes.h1).toBeGreaterThanOrEqual(24);
    expect(sizes.sub).toBeGreaterThanOrEqual(12);
    expect(sizes.body).toBeGreaterThanOrEqual(12);

    // The CTA is new content from the mockup and must actually go somewhere.
    await expect(page.locator('#cap-mobile .cm-cta')).toHaveAttribute('href', './projects.html');
  });

  test('content is driven by the shared constants', async ({ page }) => {
    await gotoMobileHome(page);

    // Frame 6 shows three stats (the desktop band's 75 Years+ is dropped).
    await expect(page.locator('#cap-mobile .cm-stat')).toHaveCount(3);
    await expect(page.locator('#cap-mobile .cm-stats')).toContainText('$500 Mn+');
    await expect(page.locator('#cap-mobile .cm-stats')).toContainText('135 Acres');

    // CAP_EDGE — same four rows as the desktop accordion.
    const rows = page.locator('#cap-mobile .cm-acc-item');
    await expect(rows).toHaveCount(4);
    await expect(rows.first()).toContainText('Operator-aligned structures');
    await expect(rows.last()).toContainText('Proven, long-term investor value');

    // CAP_JOURNEY — real 2016-2025 records, all three phases.
    await expect(page.locator('#cap-mobile .cm-tl-phase')).toHaveCount(3);
    await expect(page.locator('#cap-mobile .cm-tl-item')).toHaveCount(8);
    await expect(page.locator('#cap-mobile .cm-tl').first()).toContainText('2016');

    // CAP_CITIES / CAP_OPERATORS.
    await expect(page.locator('#cap-mobile .cm-city')).toHaveCount(7);
    await expect(page.locator('#cap-mobile .cm-ops-logo')).toHaveCount(7);
  });

  test('accordion toggles on tap and every row is a real tap target', async ({ page }) => {
    await gotoMobileHome(page);

    const second = page.locator('#cap-mobile .cm-acc-item').nth(1);
    // Row 2 starts open, matching the mockup.
    await expect(second).toHaveClass(/is-open/);

    const first = page.locator('#cap-mobile .cm-acc-item').first();
    await expect(first).not.toHaveClass(/is-open/);
    await first.locator('.cm-acc-btn').click();
    await expect(first).toHaveClass(/is-open/);
    await expect(first.locator('.cm-acc-btn')).toHaveAttribute('aria-expanded', 'true');
    await first.locator('.cm-acc-btn').click();
    await expect(first).not.toHaveClass(/is-open/);

    const short = await page.evaluate(() =>
      [...document.querySelectorAll('#cap-mobile .cm-acc-btn, #cap-mobile .cm-city, #cap-mobile .cm-fnav a')]
        .map((el) => ({ t: el.textContent.trim().slice(0, 28), h: Math.round(el.getBoundingClientRect().height) }))
        .filter((r) => r.h < 30)
    );
    expect(short, 'interactive rows should not be smaller than a fingertip').toEqual([]);
  });

  test('the rows render as separated cards, not a flat divided list', async ({ page }) => {
    await gotoMobileHome(page);

    // Frame 6 renders each row as a raised white card: rounded, soft-shadowed,
    // and clear of its neighbours. A regression to the old hairline list would
    // drop the radius/shadow and close the gaps.
    const cards = await page.evaluate(() => {
      const items = [...document.querySelectorAll('#cap-mobile .cm-acc-item')];
      const gaps = [];
      for (let i = 1; i < items.length; i++) {
        gaps.push(items[i].getBoundingClientRect().top - items[i - 1].getBoundingClientRect().bottom);
      }
      const cs = getComputedStyle(items[0]);
      return {
        radius: parseFloat(cs.borderRadius),
        hasShadow: cs.boxShadow !== 'none' && cs.boxShadow !== '',
        minGap: Math.min(...gaps)
      };
    });
    expect(cards.radius).toBeGreaterThan(0);
    expect(cards.hasShadow, 'cards are separated by a shadow, not a border').toBe(true);
    expect(cards.minGap, 'cards must not touch').toBeGreaterThanOrEqual(6);

    // The open row's photo sits INSIDE its card, not edge-to-edge.
    const inset = await page.evaluate(() => {
      const img = document.querySelector('#cap-mobile .cm-acc-img');
      const card = img.closest('.cm-acc-item').getBoundingClientRect();
      const r = img.getBoundingClientRect();
      return { left: r.left - card.left, right: card.right - r.right };
    });
    expect(inset.left).toBeGreaterThan(0);
    expect(inset.right).toBeGreaterThan(0);
  });

  test('Our Journey carries its blue-grey ground', async ({ page }) => {
    await gotoMobileHome(page);
    // The export washes the top of this section in rgb(214,227,239) and fades
    // it out; flat white means the gradient was lost.
    const cast = await page.evaluate(() => {
      const s = getComputedStyle(document.querySelector('#cap-mobile .cm-journey'));
      const m = s.backgroundImage.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      return m ? { r: +m[1], g: +m[2], b: +m[3] } : null;
    });
    expect(cast, 'journey section should have a gradient background').not.toBeNull();
    expect(cast.b - cast.r, 'the wash should read blue, not neutral grey').toBeGreaterThanOrEqual(15);
  });

  test('the city rail swaps the portfolio tiles', async ({ page }) => {
    await gotoMobileHome(page);

    // Hyderabad is the default, matching the desktop frame.
    await expect(page.locator('#cap-mobile .cm-city.is-active')).toHaveText('Hyderabad');
    await expect(page.locator('#cap-mobile .cm-tile')).toHaveCount(4);
    // Real school names and real localities — never the mockup's garbled
    // "Spruha Mata" / "Bowrampet" / "Sainikpuri".
    await expect(page.locator('#cap-mobile .cm-tiles')).toContainText('Sancta Maria International School');
    await expect(page.locator('#cap-mobile .cm-tiles')).toContainText('Serilingampally, Hyderabad');
    await expect(page.locator('#cap-mobile .cm-tiles')).toContainText('Suchitra, Hyderabad');
    await expect(page.locator('#cap-mobile .cm-tiles')).not.toContainText('Spruha');
    await expect(page.locator('#cap-mobile .cm-tiles')).not.toContainText('Bowrampet');

    await page.locator('#cap-mobile .cm-city', { hasText: 'Dubai' }).click();
    await expect(page.locator('#cap-mobile .cm-city.is-active')).toHaveText('Dubai');
    await expect(page.locator('#cap-mobile .cm-tile')).toHaveCount(2);
    await expect(page.locator('#cap-mobile .cm-tiles')).toContainText('Hartland International School');
    // Single-campus cities: the locality IS the city, so it must not double up.
    await expect(page.locator('#cap-mobile .cm-tiles')).not.toContainText('Dubai, Dubai');

    // Every tile resolves an image (the Shri Ram stand-in included).
    const broken = await page.evaluate(() =>
      [...document.querySelectorAll('#cap-mobile .cm-tile-img')]
        .filter((i) => i.complete && i.naturalWidth === 0)
        .map((i) => i.getAttribute('src'))
    );
    expect(broken).toEqual([]);
  });

  test('footer links navigate', async ({ page }) => {
    await gotoMobileHome(page);
    await page.locator('#cap-mobile .cm-fnav a[href="./projects.html"]').click();
    await expect(page).toHaveURL(/projects\.html$/);
  });

  test('widening past the breakpoint hands back to the scaled frame', async ({ page }) => {
    const errors = attachErrorCapture(page);
    await gotoMobileHome(page);
    await expect(page.locator('#cap-viewport')).toBeHidden();

    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.locator('#cap-mobile')).toBeHidden();
    await expect(page.locator('#cap-scaler')).toBeVisible();

    // The deferred one-shot must have run the frame setups and re-fitted:
    // a scale of 0 would leave the frame collapsed.
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const m = getComputedStyle(document.getElementById('cap-scaler')).transform;
            const s = m === 'none' ? 1 : parseFloat(m.split('(')[1]);
            return s;
          }),
        { timeout: 15000 }
      )
      .toBeGreaterThan(0.5);
    await page.waitForSelector('#cap-journey', { timeout: 20000 });
    expectNoPageErrors(errors);
  });

  test('mobile home full-page screenshot', async ({ page }, testInfo) => {
    testInfo.setTimeout(150000);
    await gotoMobileHome(page);
    await fullPageShot(page, testInfo, 'home-mobile');
  });
});
