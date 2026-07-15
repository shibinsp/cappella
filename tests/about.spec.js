// Phase 2 gate: About Us page content (docx-verbatim).
const { test, expect } = require('@playwright/test');
const {
  attachErrorCapture,
  expectNoPageErrors,
  assertNoHorizontalOverflow,
  fullPageShot
} = require('./helpers');

test.describe('about-us.html', () => {
  test('hero + stats exact strings', async ({ page }) => {
    const errors = attachErrorCapture(page);
    await page.goto('/about-us.html');

    await expect(page.locator('h1')).toHaveText(
      'India’s Leading Edu-Infra Asset Management Company'
    );
    await expect(page.locator('.hero-intro')).toHaveText(
      'Acquiring, repositioning and developing premium K-12 school infrastructure across India and the GCC.'
    );

    // The four stats — exact number + caption pairs
    const stats = page.locator('.stats-band .stat');
    await expect(stats).toHaveCount(4);
    const expected = [
      ['$500 Mn+', 'Assets Under Management'],
      ['16', 'Assets across India & GCC'],
      ['135', 'Acres of Land'],
      ['3.3 Mn', 'SFT Total BUA']
    ];
    for (let i = 0; i < expected.length; i++) {
      await expect(stats.nth(i).locator('dd')).toHaveText(expected[i][0]);
      await expect(stats.nth(i).locator('dt')).toHaveText(expected[i][1]);
    }

    await assertNoHorizontalOverflow(page);
    expectNoPageErrors(errors);
  });

  test('Who We Are — both paragraphs', async ({ page }) => {
    await page.goto('/about-us.html');
    const section = page.locator('section', { has: page.locator('#who-we-are') });
    await expect(section.locator('p')).toHaveCount(2);
    await expect(section).toContainText(
      'We acquire, reposition and develop institutional-grade school properties, partnering with established educators to deliver premium K-12 infrastructure.'
    );
    await expect(section).toContainText(
      'Our platform manages $500+ million across 16 schools in India and the UAE, encompassing 135 acres and 3.3 million sq. ft. of built-up space, backed by leadership with 75+ years of combined real estate and education infrastructure expertise.'
    );
  });

  test('The Cappella Edge — all four points, docx copy', async ({ page }) => {
    await page.goto('/about-us.html');
    const section = page.locator('section', { has: page.locator('#cappella-edge') });
    const items = section.locator('.item');
    await expect(items).toHaveCount(4);

    const points = [
      ['Operator-aligned structures', 'We structure every asset around the operator, aligning incentives so that infrastructure and education delivery work as one.'],
      ['Future-ready campuses', 'We build, upgrade and reposition campuses to meet the standards of modern, high-performance schooling.'],
      ['Active asset management', 'Through our affiliated ecosystem, we integrate operational management, value-added services and construction expertise to deliver fully-optimised institutions.'],
      ['Proven, long-term investor value', 'Disciplined acquisition and development, institutional governance and proven exits translate into durable, long-term returns.']
    ];
    for (let i = 0; i < points.length; i++) {
      await expect(items.nth(i).locator('h3')).toHaveText(points[i][0]);
      await expect(items.nth(i).locator('p')).toHaveText(points[i][1]);
    }
  });

  test('What We Do — intro and three strategies', async ({ page }) => {
    await page.goto('/about-us.html');
    const section = page.locator('section', { has: page.locator('#what-we-do') });
    await expect(section).toContainText(
      'Cappella operates across three core strategies, each designed to expand access to quality education while building a resilient, income-generating real-estate portfolio.'
    );
    const items = section.locator('.item');
    await expect(items).toHaveCount(3);
    const strategies = [
      ['PropCo + OpCo', 'Complete takeover of school operations alongside the underlying infrastructure.'],
      ['Sale & Leaseback', 'Acquiring school infrastructure (land and buildings) and leasing it back to the operator.'],
      ['Greenfield + School District', 'Developing end-to-end, innovative edu-infra products in collaboration with operators, productised through SKOLEN, our spec-school platform.']
    ];
    for (let i = 0; i < strategies.length; i++) {
      await expect(items.nth(i).locator('h3')).toHaveText(strategies[i][0]);
      await expect(items.nth(i).locator('p')).toHaveText(strategies[i][1]);
    }
  });

  test('SKOLEN — paragraph and module table with exact Indian digit grouping', async ({ page }) => {
    await page.goto('/about-us.html');
    const section = page.locator('section', { has: page.locator('#skolen') });

    await expect(section).toContainText('Greenfield, modular school infrastructure');
    await expect(section).toContainText(
      'SKOLEN rethinks this approach with standardised, pre-designed campuses that meet the needs of the vast majority of K-12 operators and can be operational without the extended timelines of traditional builds.'
    );

    const wrapper = section.locator('.table-scroll');
    await expect(wrapper).toHaveAttribute('tabindex', '0');
    await expect(wrapper).toHaveAttribute('role', 'region');
    await expect(section.locator('caption')).toHaveText('SKOLEN Modules');

    // 4 column headers + 3 row headers
    await expect(section.locator('thead th[scope="col"]')).toHaveCount(4);
    await expect(section.locator('tbody th[scope="row"]')).toHaveCount(3);

    // Exact cell strings — tripwire against digit-grouping "fixes"
    const rows = section.locator('tbody tr');
    await expect(rows.nth(0)).toContainText('SKOLEN 1-Acre');
    await expect(rows.nth(0)).toContainText('1 acre');
    await expect(rows.nth(0)).toContainText('70,000–75,000 sq ft');
    await expect(rows.nth(0)).toContainText('900–1,100');
    await expect(rows.nth(1)).toContainText('SKOLEN 2-Acre');
    await expect(rows.nth(1)).toContainText('2 acres');
    await expect(rows.nth(1)).toContainText('1,40,000–1,50,000 sq ft');
    await expect(rows.nth(1)).toContainText('2,000–2,200');
    await expect(rows.nth(2)).toContainText('SKOLEN 3-Acre');
    await expect(rows.nth(2)).toContainText('3 acres');
    await expect(rows.nth(2)).toContainText('2,80,000–3,00,000 sq ft');
    await expect(rows.nth(2)).toContainText('3,000–3,300');
  });

  test('full-page screenshot', async ({ page }, testInfo) => {
    await page.goto('/about-us.html');
    await page.waitForTimeout(600);
    await fullPageShot(page, testInfo, 'about-us');
  });
});
