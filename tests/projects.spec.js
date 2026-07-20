// Phase 3 gate: Projects page — both portfolio asset GRIDS (client-requested
// card format, replacing the original tables), every card, exact values.
const { test, expect } = require('./fixtures');
const {
  attachErrorCapture,
  expectNoPageErrors,
  assertNoHorizontalOverflow,
  fullPageShot
} = require('./helpers');

// [name, 'Location — Est. year', land, bua, students]
const GCC_CARDS = [
  ['Hartland International School', 'Dubai — Est. 2015', '9.03', '278k', '1,947 / 2,400'],
  ['North London Collegiate School', 'Dubai — Est. 2017', '9.44', '420k', '1,820 / 2,100']
];

const INDIA_CARDS = [
  ['St. Andrews, Suchitra', 'Hyderabad — Est. 1987', '9.0', '208k', '5,255 / 5,300'],
  ['St. Andrews, Keesara', 'Hyderabad — Est. 2012', '7.6', '88k', '1,732 / 2,300'],
  ['St. Michael’s', 'Hyderabad — Est. 2004', '2.7', '132k', '2,908 / 3,600'],
  ['Sancta Maria International School', 'Hyderabad — Est. 2010', '5.0', '193k', '1,500 / 1,500'],
  ['The Shri Ram Universal School', 'Chennai — Est. 2020', '2.0', '183k', '1,450 / 2,600'],
  ['Billabong High International School', 'Pune — Est. 2019', '2.1', '69k', '773 / 1,350'],
  ['Jain International Residential School', 'Bangalore — Est. 1999', '58.4', '1,200k', '690 / 1,000'],
  ['Jain Public School', 'Bengaluru — Est. 2013', '6.3', '66k', '1,226 / 1,575'],
  ['Jain Public School', 'Bengaluru — Est. 2012', '3.5', '70k', '928 / 1,240'],
  ['Jain Public School', 'Korba — Est. 2012', '2.8', '55k', '438 / 1,050'],
  ['Jain Public School', 'Kadiri — Est. 2012', '3.5', '64k', '795 / 1,050'],
  ['IFIM – Student Housing', 'Bangalore — Est. 1995', '2.5', '73k', '400 / 440'],
  ['JU-SET Hostel', 'Bangalore — Est. 1990', '10.8', '271k', '1,100 / 1,100']
];

const STAT_LABELS = ['Land (acre)', 'BUA (sf)', 'Students (Current / Capacity)'];

async function expectGrid(page, region, cards) {
  const items = page.locator(`[aria-labelledby="${region}-grid-caption"] .asset-card`);
  await expect(items).toHaveCount(cards.length);
  for (let i = 0; i < cards.length; i++) {
    const [name, meta, land, bua, students] = cards[i];
    const card = items.nth(i);
    await expect(card.locator('h3')).toHaveText(name);
    await expect(card.locator('.asset-meta')).toHaveText(meta);
    const values = card.locator('.asset-stats b');
    await expect(values.nth(0)).toHaveText(land);
    await expect(values.nth(1)).toHaveText(bua);
    await expect(values.nth(2)).toHaveText(students);
    const labels = card.locator('.asset-stats span');
    for (let l = 0; l < STAT_LABELS.length; l++) {
      await expect(labels.nth(l)).toHaveText(STAT_LABELS[l]);
    }
  }
}

test.describe('projects.html', () => {
  test('h1, sections, captions and grid structure', async ({ page }) => {
    const errors = attachErrorCapture(page);
    await page.goto('/projects.html');

    await expect(page.locator('h1')).toHaveText('Our Portfolio');

    // Two clearly labelled asset grids
    await expect(page.locator('#gcc-grid-caption')).toContainText('GCC — Dubai (K-12 Schools)');
    await expect(page.locator('#india-grid-caption')).toContainText('India — Portfolio Assets');
    await expect(page.locator('#gcc-heading')).toContainText('GCC — Dubai');
    await expect(page.locator('#india-heading')).toHaveText('India');

    // Grids are lists labelled by their captions
    for (const region of ['gcc', 'india']) {
      const grid = page.locator(`ul[aria-labelledby="${region}-grid-caption"]`);
      await expect(grid).toHaveCount(1);
    }

    await assertNoHorizontalOverflow(page);
    expectNoPageErrors(errors);
  });

  test('GCC grid: every card, exact values', async ({ page }) => {
    await page.goto('/projects.html');
    await expectGrid(page, 'gcc', GCC_CARDS);
  });

  test('India grid: every card, exact values', async ({ page }) => {
    await page.goto('/projects.html');
    await expectGrid(page, 'india', INDIA_CARDS);
  });

  test('grid never hides data: all cards visible, no horizontal overflow', async ({ page }) => {
    await page.goto('/projects.html');
    // Every card participates in normal flow — nothing is clipped or
    // scrolled away at any project viewport
    const cards = page.locator('.asset-card');
    const n = await cards.count();
    expect(n).toBe(GCC_CARDS.length + INDIA_CARDS.length);
    for (let i = 0; i < n; i++) {
      await cards.nth(i).scrollIntoViewIfNeeded();
      await expect(cards.nth(i)).toBeVisible();
    }
    await assertNoHorizontalOverflow(page);
  });

  test('photo band: only existing school photos, descriptive alt, all load', async ({ page }) => {
    const errors = attachErrorCapture(page);
    await page.goto('/projects.html');

    const imgs = page.locator('main .photo-band img');
    await expect(imgs).toHaveCount(4);
    for (let i = 0; i < 4; i++) {
      const img = imgs.nth(i);
      const alt = await img.getAttribute('alt');
      expect(alt, 'photo alt must be descriptive').toBeTruthy();
      expect(alt.length).toBeGreaterThan(10);
      // natural width > 0 → the file actually loaded. Lazy images can still
      // be fetching under load, so poll instead of a one-shot read (a real
      // 404 is caught separately by the error capture).
      await img.scrollIntoViewIfNeeded();
      await expect
        .poll(() => img.evaluate((el) => el.complete && el.naturalWidth > 0), {
          timeout: 10000
        })
        .toBe(true);
    }
    expectNoPageErrors(errors);
  });

  test('full-page screenshot', async ({ page }, testInfo) => {
    await page.goto('/projects.html');
    await page.waitForTimeout(600);
    await fullPageShot(page, testInfo, 'projects');
  });
});
