// Phase 2 gate: the standalone SKOLEN page.
// Client 2026-08-09 ("SEND THIS ENTIRE SECTION TO THE SEPARATE SKOLEN PAGE")
// moved the modules cardwrap off about-us.html onto skolen.html. The module
// content and pinned-reveal assertions came with it from about.spec.js — they
// are unchanged apart from the URL, so a regression in the move shows up as the
// same failure it always would have.
const { test, expect } = require('./fixtures');
const {
  attachErrorCapture,
  expectNoPageErrors,
  assertNoHorizontalOverflow,
  fullPageShot,
  PAGES
} = require('./helpers');

const SKOLEN = '/skolen.html';

test.describe('skolen.html', () => {
  test('shell: landmarks, single h1, aria-current, footer, no errors', async ({ page }) => {
    const errors = attachErrorCapture(page);
    await page.goto(SKOLEN);

    await expect(page.locator('header.site-header')).toHaveCount(1);
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.locator('footer.site-footer')).toHaveCount(1);
    await expect(page.locator('nav#site-nav')).toHaveCount(1);

    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveText('SKOLEN');

    // The nav marks THIS page, and does so on the SKOLEN tab specifically.
    const current = page.locator('#site-nav a[aria-current="page"]');
    await expect(current).toHaveCount(1);
    await expect(current).toHaveAttribute('href', 'skolen.html');
    await expect(current).toHaveText('SKOLEN');

    await expect(page.locator('.site-logo')).toHaveAttribute('href', 'index.html');
    await expect(
      page.locator('footer a[href="mailto:partner@cappella.in"]')
    ).toHaveCount(1);
    await expect(page.locator('footer address')).toContainText('Hyderabad');

    await assertNoHorizontalOverflow(page);
    expectNoPageErrors(errors);
  });

  test('every other page links to it, and it links back to every other page', async ({ page }) => {
    // A page nothing routes to is the failure mode worth guarding here: the tab
    // lives in five separate nav surfaces, so one missed edit is easy.
    for (const p of PAGES) {
      await page.goto(`/${p.file}`);
      const tab = page.locator('#site-nav a[href="skolen.html"]');
      await expect(tab, `${p.file} nav links to skolen.html`).toHaveCount(1);
      await expect(tab).toHaveText('SKOLEN');
    }
    await page.goto(SKOLEN);
    for (const p of PAGES) {
      await expect(
        page.locator(`#site-nav a[href="${p.file}"]`),
        `skolen.html nav links to ${p.file}`
      ).toHaveCount(1);
    }
  });

  test('module cards with exact Indian digit grouping', async ({ page }) => {
    await page.goto(SKOLEN);
    await expect(page.locator('.skolen-modules-title')).toHaveText('SKOLEN Modules');
    const cards = page.locator('.skolen-module');
    await expect(cards).toHaveCount(3);

    // Exact strings per card — tripwire against digit-grouping "fixes"
    const MODULES = [
      ['SKOLEN 1-Acre', '1 acre', '70,000–75,000 sq ft', '900–1,100'],
      ['SKOLEN 2-Acre', '2 acres', '1,40,000–1,50,000 sq ft', '2,000–2,200'],
      ['SKOLEN 3-Acre', '3 acres', '2,80,000–3,00,000 sq ft', '3,000–3,300']
    ];
    for (let i = 0; i < MODULES.length; i++) {
      const [name, land, bua, capacity] = MODULES[i];
      const card = cards.nth(i);
      await expect(card.locator('.skolen-module__name')).toHaveText(name);
      const labels = card.locator('dt');
      await expect(labels.nth(0)).toHaveText('Land');
      await expect(labels.nth(1)).toHaveText('Built-up Area');
      await expect(labels.nth(2)).toHaveText('Capacity');
      const values = card.locator('dd');
      await expect(values.nth(0)).toHaveText(land);
      await expect(values.nth(1)).toHaveText(bua);
      await expect(values.nth(2)).toHaveText(capacity);
    }
  });

  test('pinned mask-reveal on desktop, inline fallback on small screens', async ({ page }) => {
    // Client 2026-07-24: the module cards became a sticky aerial that wipes
    // between the three renders as the module blocks scroll (shared/js/about.js
    // — still the owner, it binds to [data-skolen-reveal] wherever it lands).
    await page.goto(SKOLEN);
    const reveal = page.locator('[data-skolen-reveal]');
    await expect(reveal).toHaveCount(1);
    await expect(reveal.locator('.skolen-reveal__img')).toHaveCount(3);
    await reveal.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    const width = page.viewportSize().width;
    if (width >= 901) {
      await expect(reveal).toHaveClass(/is-pinned/);
      await expect(reveal.locator('.skolen-reveal__media')).toHaveCSS('position', 'sticky');
      // scrolling to the end of the section wipes the first aerial away and
      // leaves the last one shown (clip-path is driven from the scroll fraction)
      await page.evaluate(() => {
        const r = document.querySelector('[data-skolen-reveal]');
        const rect = r.getBoundingClientRect();
        window.scrollTo(0, rect.top + window.scrollY + r.offsetHeight - window.innerHeight);
      });
      await page.waitForTimeout(300);
      const clips = await reveal
        .locator('.skolen-reveal__img')
        .evaluateAll((els) => els.map((e) => e.style.clipPath));
      expect(clips[0]).toMatch(/100(\.0+)?%/); // first fully wiped
      expect(clips[2] === '' || /\b0(\.0+)?%/.test(clips[2])).toBeTruthy(); // last shown
    } else {
      await expect(reveal).not.toHaveClass(/is-pinned/);
    }
  });

  test('the About Us CTA lands here', async ({ page }) => {
    await page.goto('/about-us.html');
    await page.locator('.skolen-cta').click();
    await page.waitForLoadState('load');
    expect(new URL(page.url()).pathname).toBe('/skolen.html');
    await expect(page.locator('h1')).toHaveText('SKOLEN');
  });

  test('full-page screenshot', async ({ page }, testInfo) => {
    await page.goto(SKOLEN);
    await page.waitForTimeout(600);
    await fullPageShot(page, testInfo, 'skolen');
  });
});
