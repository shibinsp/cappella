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
  ['St. Andrews High School', 'Hyderabad, India', '9.0', '208K', '5,300'],
  ['St. Andrews School', 'Hyderabad, India', '7.6', '88K', '2,300'],
  ['St. Michael’s School', 'Hyderabad, India', '2.7', '132K', '3,600'],
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

  test('every card is a real campus photo — no stand-ins left to disclose', async ({ page }) => {
    // This used to assert the opposite: 14 real photos and one stand-in (The
    // Shri Ram Universal School) carrying a REPRESENTATIVE tag so it could not
    // read as the actual campus. Its photo arrived 2026-08-10, so the tag went
    // with it. Inverted rather than deleted — if a stand-in ever comes back
    // WITHOUT its disclosure, that is the regression worth catching.
    await page.goto('/projects.html');
    await expect(page.locator('.proj-card__reptag')).toHaveCount(0);
    await expect(page.locator('.proj-card')).toHaveCount(ALL.length);

    // No card may fall back to a rep-campus stand-in image either.
    const srcs = await page
      .locator('.proj-card__img')
      .evaluateAll((els) => els.map((e) => e.getAttribute('src')));
    expect(srcs).toHaveLength(ALL.length);
    expect(
      srcs.filter((s) => /rep-campus/.test(s)),
      'no card should still use a representative stand-in'
    ).toEqual([]);
  });

  test('state filters show the right subset', async ({ page }) => {
    // Client 2026-08-09 (p19): the two-way India/Dubai split became the seven
    // state groups the homepage uses. Every group is exercised, and the counts
    // are asserted against the button labels so a card whose data-region is
    // wrong shows up as a mismatch rather than passing silently.
    await page.goto('/projects.html');
    const visible = () => page.locator('.proj-card:visible');

    const STATES = [
      ['andhra-pradesh', 1],
      ['karnataka', 5],
      ['chhattisgarh', 1],
      ['tamil-nadu', 1],
      ['telangana', 4],
      ['maharashtra', 1],
      ['dubai', 2]
    ];
    expect(STATES.reduce((n, [, c]) => n + c, 0)).toBe(ALL.length);

    await expect(visible()).toHaveCount(ALL.length);

    for (const [key, count] of STATES) {
      const btn = page.locator(`.proj-filter[data-filter="${key}"]`);
      await expect(btn, `${key} filter exists`).toHaveCount(1);
      await expect(btn.locator('.count')).toHaveText(`(${count})`);

      await btn.click();
      await expect(visible(), `${key} shows ${count}`).toHaveCount(count);
      for (const c of await visible().all()) {
        await expect(c).toHaveAttribute('data-region', key);
      }
    }

    await page.locator('.proj-filter[data-filter="all"]').click();
    await expect(visible()).toHaveCount(ALL.length);
  });

  test('phone cards show name + location, and flip to the details', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'the card flip is inside the 860px query');
    // Client 2026-08-09 (p34): "only the name of the school and location should
    // be on the picture" + "add a flip behind where the project details come".
    await page.goto('/projects.html');
    const card = page.locator('.proj-card').first();
    await card.scrollIntoViewIfNeeded();

    // preserve-3d is the whole mechanism, and it is silently cancelled by any
    // grouping property on the card — overflow:hidden and isolation:isolate
    // both did, which rendered the card mirrored with no back face. Assert the
    // computed value, because the visual failure is easy to miss in a diff.
    const style = await card.evaluate((el) => {
      const c = getComputedStyle(el);
      return { ts: c.transformStyle, overflow: c.overflow, isolation: c.isolation };
    });
    expect(style.ts, 'the flip needs preserve-3d to survive').toBe('preserve-3d');
    expect(style.overflow, 'overflow:hidden would force transform-style flat').toBe('visible');
    expect(style.isolation, 'isolation:isolate would force transform-style flat').toBe('auto');

    // Front: the stats are turned away, so only the title block is facing.
    await expect(card).not.toHaveClass(/is-flipped/);
    const stats = card.locator('.proj-card__stats');
    await expect(stats).toHaveCSS('backface-visibility', 'hidden');

    await card.click();
    await expect(card).toHaveClass(/is-flipped/);
    // The figures are still the real ones — the back is the same DOM, not a copy.
    await expect(stats.locator('.proj-stat b').first()).toHaveText(GCC[0][2]);

    await card.click();
    await expect(card).not.toHaveClass(/is-flipped/);

    // Switching to list view must clear any flip: that layout has no back face.
    await card.click();
    await expect(card).toHaveClass(/is-flipped/);
    await page.locator('.proj-view-btn[data-view="list"]').click();
    await expect(card).not.toHaveClass(/is-flipped/);
  });

  test('the active-filter rule never reaches another filter', async ({ page }) => {
    // Regression: the rule sat at bottom:-19px, which was fine while the bar
    // was three filters on one line. p19 made it eight state filters, so it
    // wraps (2 rows at 1440, 5 at 360) and the rule landed INSIDE the next row,
    // striking through the labels there — reported from a real phone showing it
    // drawn across KARNATAKA.
    // Measured off the painted ::after box rather than an assumed offset, and
    // on BOTH axes: the rule spans its own button's width, so a vertical-only
    // check reports every same-row sibling as a false positive.
    for (const w of [1440, 1024, 768, 412, 390, 360]) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.goto('/projects.html');
      const hit = await page.evaluate(() => {
        const btns = [...document.querySelectorAll('.proj-filter')];
        const act = document.querySelector('.proj-filter[aria-pressed="true"]');
        const cs = getComputedStyle(act, '::after');
        const ar = act.getBoundingClientRect();
        const bottom = ar.bottom - (parseFloat(cs.bottom) || 0);
        const top = bottom - (parseFloat(cs.height) || 0);
        return btns
          .filter((x) => {
            const r = x.getBoundingClientRect();
            return x !== act &&
              r.top < bottom - 0.5 && r.bottom > top + 0.5 &&
              r.left < ar.right - 0.5 && r.right > ar.left + 0.5;
          })
          .map((x) => x.textContent.trim());
      });
      expect(hit, `active-filter rule overlaps another filter at ${w}px`).toEqual([]);
    }
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
