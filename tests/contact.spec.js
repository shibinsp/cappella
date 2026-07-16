// Phase 5 gate: Contact page — Registered Office, exact address, no form/tel.
const { test, expect } = require('@playwright/test');
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

  test('nothing invented: no form, no tel links, no map embeds', async ({ page }) => {
    await page.goto('/contact-us.html');
    await expect(page.locator('form')).toHaveCount(0);
    await expect(page.locator('input, textarea, select')).toHaveCount(0);
    await expect(page.locator('a[href^="tel:"]')).toHaveCount(0);
    await expect(page.locator('iframe')).toHaveCount(0);
  });

  test('full-page screenshot', async ({ page }, testInfo) => {
    await page.goto('/contact-us.html');
    await page.waitForTimeout(600);
    await fullPageShot(page, testInfo, 'contact-us');
  });
});
