// Regression: ISSUE-001 — menu overlay links below the 24px AA tap target
// Found by /qa on 2026-07-30
// Report: .gstack/qa-reports/qa-report-localhost-8788-2026-07-30.md
//
// The <=599px squeeze in shared/css/home.css shrinks .cap-menu-info to
// 14px/1.45 to buy vertical room in the panel. Four of those items are LINKS,
// so shrinking the line box took their tap targets from 24px to 20.3px —
// under the 24x24 WCAG 2.5.8 AA floor. The panel has competing pressure (it
// must also fit a 320x568 phone without scrolling), so the two properties are
// asserted together: shaving pixels to win the fit must never again come out
// of a tap target.
const { test, expect } = require('./fixtures');
const { attachErrorCapture, expectNoPageErrors } = require('./helpers');

const HOME = '/index.html';

/** Opens the body-level overlay built by _setupMenuOverlay. */
async function openMenu(page) {
  await page.goto(HOME, { waitUntil: 'networkidle' });
  await page.locator('#cap-menu-btn').click();
  await page.locator('#cap-menu-panel').waitFor({ state: 'visible' });
  // The panel slides in over 0.75s; measure only once it has landed.
  await page.waitForTimeout(1000);
}

/** Every focusable control in the overlay, with its rendered box. */
function measureTargets(page) {
  return page.evaluate(() => {
    const overlay = document.getElementById('cap-menu-overlay');
    return [...overlay.querySelectorAll('a, button, input')].map((el) => {
      const r = el.getBoundingClientRect();
      return {
        label: (el.textContent || el.placeholder || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 30),
        width: +r.width.toFixed(2),
        height: +r.height.toFixed(2)
      };
    });
  });
}

test.describe('menu overlay tap targets', () => {
  test.describe.configure({ timeout: 90000 });

  // The <=599px squeeze only applies on phones; the tablet/desktop projects
  // keep the roomier 15px/1.6 info type, which was never under the floor.
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'the <=599px menu squeeze only applies below 600px');
  });

  test('no overlay control is under the 24x24 AA minimum', async ({ page }) => {
    const errors = attachErrorCapture(page);
    await openMenu(page);

    const targets = await measureTargets(page);
    // Guard the guard: if the overlay ever stops rendering, an empty list must
    // not read as a pass. 6 = five page links + the close control; it was 8
    // before p23 stripped the EXPLORE / STAY IN TOUCH / email blocks out.
    expect(targets.length, 'overlay controls found').toBeGreaterThanOrEqual(6);

    const undersized = targets.filter((t) => t.height < 24 || t.width < 24);
    expect(
      undersized,
      `controls under 24x24:\n${undersized.map((t) => `  ${t.label}: ${t.width}x${t.height}`).join('\n')}`
    ).toEqual([]);

    expectNoPageErrors(errors);
  });

  test('the overlay is just the page links and a close control', async ({ page }) => {
    // Client 2026-08-09 (p23). This test used to assert the four EXPLORE /
    // STAY IN TOUCH links cleared 24px — ISSUE-001's original subject. Those
    // blocks are gone, so the assertion becomes their absence; the tap-target
    // guarantee itself is still enforced by the AA test above, which measures
    // whatever controls remain.
    await openMenu(page);

    await expect(page.locator('.cap-menu-tag')).toHaveCount(0);
    await expect(page.locator('.cap-menu-row')).toHaveCount(0);
    await expect(page.locator('.cap-menu-info')).toHaveCount(0);
    await expect(page.locator('.cap-menu-email')).toHaveCount(0);
    await expect(page.locator('#cap-menu-overlay a[data-target]')).toHaveCount(0);

    const links = page.locator('.cap-menu-links a');
    await expect(links).toHaveCount(5);
    // "Projects", not "Portfolio": the two surfaces that still said Portfolio
    // (this overlay and the baked homepage footer) were unified 2026-08-11 —
    // same destination, one label.
    for (const label of ['About Us', 'Projects', 'SKOLEN', 'Team', 'Contact Us']) {
      await expect(page.locator('.cap-menu-links a', { hasText: label })).toHaveCount(1);
    }

    // The close control is an X now, so its accessible name has to carry the
    // meaning the word CLOSE used to.
    const close = page.locator('#cap-menu-close');
    await expect(close).toHaveAttribute('aria-label', /close/i);
    const box = await close.boundingBox();
    expect(box.width, 'close target width').toBeGreaterThanOrEqual(44);
    expect(box.height, 'close target height').toBeGreaterThanOrEqual(44);
  });

  test('the panel still fits a 320x568 phone without scrolling', async ({ page }) => {
    // The fit is why the type was shrunk in the first place. If a future tap
    // target fix is paid for in panel height instead of padding, this fails.
    await page.setViewportSize({ width: 320, height: 568 });
    await openMenu(page);

    const fit = await page.evaluate(() => {
      const panel = document.getElementById('cap-menu-panel');
      const cs = getComputedStyle(panel);
      // .cap-menu-links carries margin-bottom:auto to push the lower blocks
      // down, and Chrome resolves that to the absorbed slack in px — counting
      // it would make the sum trivially equal the container height.
      let content = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      for (const el of panel.children) {
        const s = getComputedStyle(el);
        const mb = el.classList.contains('cap-menu-links') ? 0 : parseFloat(s.marginBottom);
        content += el.getBoundingClientRect().height + parseFloat(s.marginTop) + mb;
      }
      return {
        content: Math.round(content),
        viewport: panel.clientHeight,
        scrollsY: panel.scrollHeight > panel.clientHeight,
        scrollsX: panel.scrollWidth > panel.clientWidth
      };
    });

    expect(fit.content, `panel content ${fit.content}px vs ${fit.viewport}px viewport`).toBeLessThanOrEqual(fit.viewport);
    expect(fit.scrollsY, 'panel scrolls vertically at 320x568').toBe(false);
    expect(fit.scrollsX, 'panel scrolls horizontally at 320x568').toBe(false);
  });
});
