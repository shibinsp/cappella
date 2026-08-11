// Phase 2 gate: About Us page content (docx-verbatim).
const { test, expect } = require('./fixtures');
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
    // Client 2026-08-09 p10: the numbers carry their units on the face now
    // ("16 Assets", not a bare "16"), and the tags were relabelled with them.
    const expected = [
      ['$500 Mn+', 'Assets Under Management'],
      ['16 Assets', 'Assets across India & GCC'],
      ['135 Acres', 'Acres of Land'],
      ['3.3 Mn SFT', 'SFT Total BUA']
    ];
    for (let i = 0; i < expected.length; i++) {
      await expect(stats.nth(i).locator('dd')).toHaveText(expected[i][0]);
      await expect(stats.nth(i).locator('dt')).toHaveText(expected[i][1]);
    }

    // The four tags, and the family they render in — p10 flagged the Space Mono
    // tag as reading like a different font from the number beneath it.
    const tags = page.locator('.flip-tag');
    await expect(tags).toHaveCount(4);
    for (const [i, label] of ['Total AUM', 'Portfolio', 'Land Area', 'Built-up Area'].entries()) {
      await expect(tags.nth(i)).toHaveText(label);
    }
    const tagFont = await tags.first().evaluate((el) => getComputedStyle(el).fontFamily);
    expect(tagFont).not.toMatch(/Space Mono/);

    // "Alignment of the text": every number on one line, sharing a baseline.
    // Asserted at desktop only — below 900px the grid stacks into 2 then 1
    // column, so multiple rows are correct there, not a regression.
    if (page.viewportSize().width >= 900) {
      const rows = await page
        .locator('.flip-front .stat-number')
        .evaluateAll((els) =>
          els.map((e) => ({
            bottom: Math.round(e.getBoundingClientRect().bottom),
            lines: Math.round(e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).fontSize))
          }))
        );
      expect(new Set(rows.map((r) => r.bottom)).size, 'stat numbers share one baseline').toBe(1);
      for (const r of rows) expect(r.lines, 'each stat number stays on one line').toBeLessThanOrEqual(1);
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

  test('stat cards do not flip on hover', async ({ page }) => {
    // Client 2026-08-09 (p12): "Remove the animation flip animation".
    // The card used to rotateY(180deg) into a crimson caption face on hover
    // and on focus-within, with the card itself made focusable to reach it.
    await page.goto('/about-us.html');
    const card = page.locator('.flip-card').first();
    await card.scrollIntoViewIfNeeded();

    const inner = card.locator('.flip-inner');
    await expect(inner).toHaveCSS('transform', 'none');
    await card.hover();
    await page.waitForTimeout(800); // the old flip settled in 700ms
    await expect(inner).toHaveCSS('transform', 'none');

    // Nothing left to reach by keyboard, so the cards are no longer focusable.
    await expect(page.locator('.flip-card[tabindex]')).toHaveCount(0);

    // The caption stays in the DOM: this is a <dl> and the <dt> is what makes
    // each figure meaningful to assistive tech. It is just not on screen.
    const dt = page.locator('.flip-back .stat-caption').first();
    await expect(dt).toHaveText('Assets Under Management');
    const box = await dt.boundingBox();
    expect(box.width, 'caption is clipped, not laid out').toBeLessThanOrEqual(2);
  });

  test('What We Do — three strategies, no intro paragraph', async ({ page }) => {
    await page.goto('/about-us.html');
    const section = page.locator('section', { has: page.locator('#what-we-do') });
    // Client 2026-08-09 (p11): the intro paragraph was removed. Asserted as an
    // absence so it cannot drift back in unnoticed.
    await expect(section).not.toContainText('Cappella operates across three core strategies');
    await expect(section.locator('.strat-intro')).toHaveCount(0);
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

  test('SKOLEN band stays, with a Learn More CTA out to the SKOLEN page', async ({ page }) => {
    // Client 2026-07-23: the tagline dropped its Space Mono face for Montserrat.
    // Client 2026-08-09: the modules moved to skolen.html and the band gained a
    // CTA out to it. The band copy itself is unchanged — only the cards left.
    await page.goto('/about-us.html');
    const section = page.locator('section', { has: page.locator('#skolen') });

    await expect(section).toContainText('Greenfield, modular school infrastructure');
    const taglineFont = await section
      .locator('.skolen-tagline')
      .evaluate((el) => getComputedStyle(el).fontFamily);
    expect(taglineFont).not.toMatch(/Space Mono/);

    await expect(section).toContainText(
      'SKOLEN rethinks this approach with standardised, pre-designed campuses that meet the needs of the vast majority of K-12 operators and can be operational without the extended timelines of traditional builds.'
    );

    const cta = section.locator('.skolen-cta');
    await expect(cta).toHaveCount(1);
    await expect(cta).toHaveAttribute('href', 'skolen.html');
    await expect(cta).toContainText('Learn More');
    // Same 24px AA floor the menu overlay work settled on (ISSUE-001).
    const box = await cta.boundingBox();
    expect(box.height, 'Learn More tap target height').toBeGreaterThanOrEqual(24);
    expect(box.width, 'Learn More tap target width').toBeGreaterThanOrEqual(24);
  });

  test('SKOLEN modules no longer live on About Us', async ({ page }) => {
    // The move IS the change (client 2026-08-09), so assert the absence — this
    // is what catches a merge quietly restoring a second copy of the section.
    await page.goto('/about-us.html');
    await expect(page.locator('[data-skolen-reveal]')).toHaveCount(0);
    await expect(page.locator('.skolen-module')).toHaveCount(0);
    await expect(page.locator('.skolen-modules-title')).toHaveCount(0);
  });

  test('full-page screenshot', async ({ page }, testInfo) => {
    await page.goto('/about-us.html');
    await page.waitForTimeout(600);
    await fullPageShot(page, testInfo, 'about-us');
  });
});
