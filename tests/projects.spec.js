// Phase 3 gate: Projects page — both portfolio tables, every row, exact values.
const { test, expect } = require('@playwright/test');
const {
  attachErrorCapture,
  expectNoPageErrors,
  assertNoHorizontalOverflow,
  fullPageShot
} = require('./helpers');

const GCC_ROWS = [
  ['Hartland International School', 'Dubai', '2015', '9.03', '278k', '1,947 / 2,400'],
  ['North London Collegiate School', 'Dubai', '2017', '9.44', '420k', '1,820 / 2,100']
];

const INDIA_ROWS = [
  ['St. Andrews, Suchitra', 'Hyderabad', '1987', '9.0', '208k', '5,255 / 5,300'],
  ['St. Andrews, Keesara', 'Hyderabad', '2012', '7.6', '88k', '1,732 / 2,300'],
  ['St. Michael’s', 'Hyderabad', '2004', '2.7', '132k', '2,908 / 3,600'],
  ['Sancta Maria International School', 'Hyderabad', '2010', '5.0', '193k', '1,500 / 1,500'],
  ['The Shri Ram Universal School', 'Chennai', '2020', '2.0', '183k', '1,450 / 2,600'],
  ['Billabong High International School', 'Pune', '2019', '2.1', '69k', '773 / 1,350'],
  ['Jain International Residential School', 'Bangalore', '1999', '58.4', '1,200k', '690 / 1,000'],
  ['Jain Public School', 'Bengaluru', '2013', '6.3', '66k', '1,226 / 1,575'],
  ['Jain Public School', 'Bengaluru', '2012', '3.5', '70k', '928 / 1,240'],
  ['Jain Public School', 'Korba', '2012', '2.8', '55k', '438 / 1,050'],
  ['Jain Public School', 'Kadiri', '2012', '3.5', '64k', '795 / 1,050'],
  ['IFIM – Student Housing', 'Bangalore', '1995', '2.5', '73k', '400 / 440'],
  ['JU-SET Hostel', 'Bangalore', '1990', '10.8', '271k', '1,100 / 1,100']
];

const COLUMNS = ['Asset', 'Location', 'Est.', 'Land (acre)', 'BUA (sf)', 'Students (Current / Capacity)'];

test.describe('projects.html', () => {
  test('h1, sections, captions and column headers', async ({ page }) => {
    const errors = attachErrorCapture(page);
    await page.goto('/projects.html');

    await expect(page.locator('h1')).toHaveText('Our Portfolio');

    // Two clearly labelled tables
    await expect(page.locator('#gcc-table-caption')).toContainText('GCC — Dubai (K-12 Schools)');
    await expect(page.locator('#india-table-caption')).toContainText('India — Portfolio Assets');
    await expect(page.locator('#gcc-heading')).toContainText('GCC — Dubai');
    await expect(page.locator('#india-heading')).toHaveText('India');

    // 6 column headers per table, correct labels
    for (const region of ['gcc', 'india']) {
      const ths = page.locator(`[aria-labelledby="${region}-table-caption"] thead th[scope="col"]`);
      await expect(ths).toHaveCount(6);
      for (let i = 0; i < COLUMNS.length; i++) {
        await expect(ths.nth(i)).toHaveText(COLUMNS[i]);
      }
    }

    await assertNoHorizontalOverflow(page);
    expectNoPageErrors(errors);
  });

  test('GCC table: every row, exact values', async ({ page }) => {
    await page.goto('/projects.html');
    const rows = page.locator('[aria-labelledby="gcc-table-caption"] tbody tr');
    await expect(rows).toHaveCount(GCC_ROWS.length);
    for (let r = 0; r < GCC_ROWS.length; r++) {
      const cells = rows.nth(r).locator('th, td');
      for (let c = 0; c < GCC_ROWS[r].length; c++) {
        await expect(cells.nth(c)).toHaveText(GCC_ROWS[r][c]);
      }
    }
  });

  test('India table: every row, exact values', async ({ page }) => {
    await page.goto('/projects.html');
    const rows = page.locator('[aria-labelledby="india-table-caption"] tbody tr');
    await expect(rows).toHaveCount(INDIA_ROWS.length);
    for (let r = 0; r < INDIA_ROWS.length; r++) {
      const cells = rows.nth(r).locator('th, td');
      for (let c = 0; c < INDIA_ROWS[r].length; c++) {
        await expect(cells.nth(c)).toHaveText(INDIA_ROWS[r][c]);
      }
    }
  });

  test('tables are accessible scroll regions; data never hidden', async ({ page }, testInfo) => {
    await page.goto('/projects.html');

    for (const region of ['gcc', 'india']) {
      const wrapper = page.locator(`[aria-labelledby="${region}-table-caption"]`);
      await expect(wrapper).toHaveAttribute('role', 'region');
      await expect(wrapper).toHaveAttribute('tabindex', '0');
    }

    if (testInfo.project.name === 'mobile') {
      // The wrapper itself overflows (scrolls internally)…
      const scrolls = await page
        .locator('[aria-labelledby="india-table-caption"]')
        .evaluate((el) => el.scrollWidth > el.clientWidth);
      expect(scrolls, 'india table wrapper should scroll internally on mobile').toBe(true);
      // …with a visible affordance…
      await expect(page.locator('.table-hint').first()).toBeVisible();
      // …and the wrapper is keyboard-scrollable. Key-driven scrolling applies
      // on a later frame, so poll rather than reading scrollLeft immediately.
      const wrapper = page.locator('[aria-labelledby="india-table-caption"]');
      await wrapper.focus();
      await expect
        .poll(
          async () => {
            await page.keyboard.press('ArrowRight');
            return wrapper.evaluate((el) => el.scrollLeft);
          },
          { timeout: 5000 }
        )
        .toBeGreaterThan(0);
    }

    // …while the DOCUMENT never overflows
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
