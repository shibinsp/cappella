// Animation-system guarantees: text integrity, revert-to-pristine DOM,
// reduced-motion behavior, menu stagger, scramble restoration.
const { test, expect } = require('@playwright/test');
const { attachErrorCapture, expectNoPageErrors, PAGES } = require('./helpers');

test.describe('animation system', () => {
  test('counters end on the exact authored strings with no extra DOM', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'behavior is viewport-independent');
    await page.goto('/about-us.html');
    await page.locator('.stats-band').scrollIntoViewIfNeeded();

    const expected = ['$500 Mn+', '16', '135', '3.3 Mn'];
    const dds = page.locator('.stats-band .stat dd');
    for (let i = 0; i < expected.length; i++) {
      // toHaveText auto-retries past the 1.5s count-up
      await expect(dds.nth(i)).toHaveText(expected[i]);
      // count-up is a pure text tween — never any odometer DOM
      const children = await dds.nth(i).evaluate((el) => el.childElementCount);
      expect(children).toBe(0);
    }
  });

  for (const pageDef of PAGES) {
    test(`${pageDef.file}: h1 reverts to pristine DOM after the char rise`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'desktop', 'behavior is viewport-independent');
      const errors = attachErrorCapture(page);
      await page.goto(`/${pageDef.file}`);

      // After the char animation + revert window the h1 must be plain text
      await expect
        .poll(
          () => page.locator('h1').evaluate((el) => el.childElementCount),
          { timeout: 8000 }
        )
        .toBe(0);
      await expect(page.locator('h1')).toHaveText(pageDef.h1);
      expectNoPageErrors(errors);
    });
  }

  test('vendor libs present and no console errors', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'load set identical everywhere');
    for (const p of PAGES) {
      const errors = attachErrorCapture(page);
      await page.goto(`/${p.file}`);
      await page.waitForTimeout(800);
      const libs = await page.evaluate(() => ({
        gsap: typeof window.gsap !== 'undefined',
        lenis: typeof window.Lenis !== 'undefined',
        split: typeof window.SplitType !== 'undefined'
      }));
      expect(libs, `${p.file} vendor libs`).toEqual({ gsap: true, lenis: true, split: true });
      expectNoPageErrors(errors);
    }
  });

  test('scramble hover restores the exact link text', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'hover is desktop-only');
    await page.goto('/about-us.html');
    const link = page.locator('#site-nav a[href="projects.html"]');
    await link.hover();
    await page.waitForTimeout(200); // mid-scramble
    await page.mouse.move(10, 400); // leave
    await expect(link).toHaveText('Projects'); // restored verbatim
  });

  test('menu links rise with homepage stagger delays', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'panel menu is <900px');
    await page.goto('/about-us.html');
    await page.locator('.nav-toggle').click();
    const third = page.locator('#site-nav li:nth-child(3) a');
    await expect(third).toHaveCSS('transition-delay', '0.26s');
    await page.keyboard.press('Escape');
    await expect(page.locator('.nav-toggle')).toHaveAttribute('aria-expanded', 'false');
  });
});

test.describe('reduced motion', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } });

  test('no Lenis, counters static, hero instantly visible', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'behavior is viewport-independent');
    await page.goto('/about-us.html');
    await page.waitForTimeout(400);

    // Lenis never initializes under reduce (its class lands on <html>)
    const htmlClass = await page.evaluate(() => document.documentElement.className);
    expect(htmlClass).not.toContain('lenis');

    // Counters show final text immediately, h1 untouched by SplitType
    const dd = page.locator('.stats-band .stat dd').first();
    await expect(dd).toHaveText('$500 Mn+');
    expect(await page.locator('h1').evaluate((el) => el.childElementCount)).toBe(0);

    // Everything visible without scrolling
    const opacities = await page
      .locator('[data-reveal]')
      .evaluateAll((els) => els.map((el) => getComputedStyle(el).opacity));
    for (const o of opacities) expect(o).toBe('1');
  });
});
