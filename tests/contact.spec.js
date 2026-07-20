// Phase 5 gate: Contact page — Registered Office, exact address, no form/tel.
const { test, expect } = require('./fixtures');
const {
  attachErrorCapture,
  expectNoPageErrors,
  assertNoHorizontalOverflow,
  fullPageShot
} = require('./helpers');

test.describe('contact-us.html', () => {
  test('h1, exact registered-office address, mailto CTA', async ({ page }) => {
    const errors = attachErrorCapture(page);
    await page.goto('/contact-us.html');

    await expect(page.locator('h1')).toHaveText('Registered Office');

    // Exact docx address (deliberately different from the homepage footer
    // version — do not "harmonize")
    const address = page.locator('main address.address-block');
    await expect(address).toHaveCount(1);
    const text = (await address.innerText()).replace(/\s+/g, ' ').trim();
    expect(text).toBe('303, Niharika One, Jubilee Hills, Hyderabad, Telangana, India');

    // Mailto CTA present and correct
    await expect(page.locator('main a.contact-cta')).toHaveAttribute(
      'href',
      'mailto:partner@cappella.in'
    );

    await assertNoHorizontalOverflow(page);
    expectNoPageErrors(errors);
  });

  test('nothing invented: no form, no tel links; one client-requested map embed', async ({ page }) => {
    await page.goto('/contact-us.html');
    await expect(page.locator('form')).toHaveCount(0);
    await expect(page.locator('input, textarea, select')).toHaveCount(0);
    await expect(page.locator('a[href^="tel:"]')).toHaveCount(0);

    // Map added per client feedback (2026-07-17 screenshot: "Map, text style")
    const iframe = page.locator('iframe');
    await expect(iframe).toHaveCount(1);
    await expect(iframe).toHaveAttribute('src', /google\.com\/maps/);
    await expect(iframe).toHaveAttribute('title', /map/i);
  });

  test('full-page screenshot', async ({ page }, testInfo) => {
    await page.goto('/contact-us.html');
    await page.waitForTimeout(600);
    await fullPageShot(page, testInfo, 'contact-us');
  });
});
