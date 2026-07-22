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

  test('nothing invented: no form, no tel links; the map is the vendored Leaflet map', async ({ page }) => {
    await page.goto('/contact-us.html');
    await expect(page.locator('form')).toHaveCount(0);
    await expect(page.locator('input, textarea, select')).toHaveCount(0);
    await expect(page.locator('a[href^="tel:"]')).toHaveCount(0);

    // The flaky Google Maps embed was replaced with a locally-vendored Leaflet
    // map over OpenStreetMap tiles — so no third-party iframe.
    await expect(page.locator('iframe')).toHaveCount(0);
    const map = page.locator('#cap-map');
    await expect(map).toHaveCount(1);
    await expect(map).toHaveAttribute('aria-label', /map/i);
    // Leaflet initialises the container (it adds .leaflet-container).
    await expect(page.locator('#cap-map.leaflet-container')).toHaveCount(1);
    // A Get Directions link points at a maps directions URL.
    await expect(page.locator('.map-actions a', { hasText: /directions/i }))
      .toHaveAttribute('href', /maps/);
  });

  test('full-page screenshot', async ({ page }, testInfo) => {
    await page.goto('/contact-us.html');
    await page.waitForTimeout(600);
    await fullPageShot(page, testInfo, 'contact-us');
  });
});
