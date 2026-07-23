// Projects page — "Hero Style" portfolio listing. Rebuilt 2026-07-22: the
// .asset-card tables/grids became .proj-card hero cards with region filters
// and a grid/list toggle. Cards are static HTML (progressive enhancement);
// JS only filters and toggles the view.
const { test, expect } = require('./fixtures');
const {
  attachErrorCapture,
  expectNoPageErrors,
  assertNoHorizontalOverflow,
  fullPageShot
} = require('./helpers');

// [name, location, acres, BUA (formatted), students]
const GCC = [
  ['Hartland International School', 'Dubai, UAE', '9.03', '278K', '2,400'],
  ['North London Collegiate School', 'Dubai, UAE', '9.44', '420K', '2,100']
];
const INDIA = [
  ['St. Andrews, Suchitra', 'Hyderabad, India', '9.0', '208K', '5,300'],
  ['St. Andrews, Keesara', 'Hyderabad, India', '7.6', '88K', '2,300'],
  ['St. Michael’s', 'Hyderabad, India', '2.7', '132K', '3,600'],
  ['Sancta Maria International School', 'Hyderabad, India', '5.0', '193K', '1,500'],
  ['The Shri Ram Universal School', 'Chennai, India', '2.0', '183K', '2,600'],
  ['Billabong High International School', 'Pune, India', '2.1', '69K', '1,350'],
  ['Jain International Residential School', 'Bangalore, India', '58.4', '1.2M', '1,000'],
  ['Jain Public School', 'Chintamani, India', '6.3', '66K', '1,575'],
  ['Jain Public School', 'Tumkur, India', '3.5', '70K', '1,240'],
  ['Jain Public School', 'Korba, India', '2.8', '55K', '1,050'],
  ['Jain Public School', 'Kadiri, India', '3.5', '64K', '1,050'],
  ['IFIM — Student Housing', 'Bangalore, India', '2.5', '73K', '440'],
  ['JU-SET Hostel', 'Bangalore, India', '10.8', '271K', '1,100']
];
const ALL = [...GCC, ...INDIA];
const STAT_LABELS = ['Acres', 'BUA (sf)', 'Students', 'Established'];

test.describe('projects.html', () => {
  test('h1 and every card with exact values', async ({ page }) => {
    const errors = attachErrorCapture(page);
    await page.goto('/projects.html');

    await expect(page.locator('h1')).toHaveText('Our Portfolio');

    const cards = page.locator('.proj-card');
    await expect(cards).toHaveCount(ALL.length);

    for (let i = 0; i < ALL.length; i++) {
      const [name, loc, acres, bua, students] = ALL[i];
      const c = cards.nth(i);
      await expect(c.locator('.proj-card__name')).toHaveText(name);
      await expect(c.locator('.proj-card__loc')).toHaveText(loc);
      const vals = c.locator('.proj-stat b');
      await expect(vals.nth(0)).toHaveText(acres);
      await expect(vals.nth(1)).toHaveText(bua);
      await expect(vals.nth(2)).toHaveText(students);
      const labels = c.locator('.proj-stat span');
      for (let l = 0; l < STAT_LABELS.length; l++) {
        await expect(labels.nth(l)).toHaveText(STAT_LABELS[l]);
      }
    }

    await assertNoHorizontalOverflow(page);
    expectNoPageErrors(errors);
  });

  test('cards are static HTML — present without JavaScript', async ({ browser }) => {
    // Progressive enhancement: the portfolio must not depend on JS to exist.
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/projects.html');
    await expect(page.locator('.proj-card')).toHaveCount(ALL.length);
    await expect(page.locator('.proj-card__name').first()).toHaveText(GCC[0][0]);
    await context.close();
  });

  test('every card carries an image that loads', async ({ page }) => {
    await page.goto('/projects.html');
    const imgs = page.locator('.proj-card .proj-card__img');
    await expect(imgs).toHaveCount(ALL.length);
    for (let i = 0; i < ALL.length; i++) {
      const img = imgs.nth(i);
      await img.scrollIntoViewIfNeeded();
      await expect
        .poll(() => img.evaluate((el) => el.complete && el.naturalWidth > 0), { timeout: 10000 })
        .toBe(true);
    }
  });

  test('representative images are disclosed with a tag', async ({ page }) => {
    // 14 real campus photos (client batch 2026-07-23); only The Shri Ram
    // Universal School still uses a stand-in, which must carry the
    // REPRESENTATIVE tag so it can't read as the actual campus.
    await page.goto('/projects.html');
    await expect(page.locator('.proj-card__reptag')).toHaveCount(1);
    for (const tag of await page.locator('.proj-card__reptag').all()) {
      await expect(tag).toHaveText('REPRESENTATIVE');
    }
    const untagged = page.locator('.proj-card:not(:has(.proj-card__reptag))');
    await expect(untagged).toHaveCount(14);
  });

  test('region filters show the right subset', async ({ page }) => {
    await page.goto('/projects.html');
    const visible = () => page.locator('.proj-card:visible');

    await expect(visible()).toHaveCount(ALL.length);

    await page.locator('.proj-filter[data-filter="gcc"]').click();
    await expect(visible()).toHaveCount(GCC.length);
    for (const c of await visible().all()) {
      await expect(c).toHaveAttribute('data-region', 'gcc');
    }

    await page.locator('.proj-filter[data-filter="india"]').click();
    await expect(visible()).toHaveCount(INDIA.length);
    for (const c of await visible().all()) {
      await expect(c).toHaveAttribute('data-region', 'india');
    }

    await page.locator('.proj-filter[data-filter="all"]').click();
    await expect(visible()).toHaveCount(ALL.length);
  });

  test('grid / list toggle switches layout', async ({ page }) => {
    await page.goto('/projects.html');
    const grid = page.locator('.proj-grid');
    await expect(grid).not.toHaveClass(/is-list/);

    await page.locator('.proj-view-btn[data-view="list"]').click();
    await expect(grid).toHaveClass(/is-list/);
    await expect(page.locator('.proj-view-btn[data-view="list"]')).toHaveAttribute('aria-pressed', 'true');
    await assertNoHorizontalOverflow(page);

    await page.locator('.proj-view-btn[data-view="grid"]').click();
    await expect(grid).not.toHaveClass(/is-list/);
  });

  test('full-page screenshot', async ({ page }, testInfo) => {
    await page.goto('/projects.html');
    await page.waitForTimeout(600);
    await fullPageShot(page, testInfo, 'projects');
  });
});
