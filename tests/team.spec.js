// Team page — leadership cards. Rebuilt 2026-07-22: the page moved from the
// .team-card grid to the .leader-* cards (transparent-PNG portraits bleeding
// from the bottom-right, a Read More modal, and a pointer-tracked 3D tilt).
const { test, expect } = require('./fixtures');
const {
  attachErrorCapture,
  expectNoPageErrors,
  assertNoHorizontalOverflow,
  fullPageShot
} = require('./helpers');

const MEMBERS = [
  {
    name: 'Jasmeet Chhabra',
    role: 'Managing Director',
    bio: 'Brings 20+ years of experience across real estate and infrastructure, including a decade in real estate private equity with two leading India-focused funds. Sets the firm’s investment direction and long-term growth strategy.',
    linkedin: 'https://www.linkedin.com/in/jasmeet-singh-chhabra-1892721/',
    lead: true
  },
  {
    name: 'Vishal Goel',
    role: 'Advisor to the Board of Directors',
    bio: 'Brings 20+ years of experience in real estate investment and advisory, spanning REITs, strategy and industrial assets, including the development and management of ground-up core assets.',
    linkedin: 'https://www.linkedin.com/in/vishalhbs/',
    lead: true
  },
  {
    name: 'Anuraag Jhunjhunwala',
    role: 'Chief Executive Officer',
    bio: 'Has 10+ years of experience in private equity investments, driving capital partnerships, deal origination and portfolio growth.',
    linkedin: 'https://www.linkedin.com/in/anuraag-jhunjhunwala-4727145/',
    lead: false
  },
  {
    name: 'Sai Krishna Narla',
    role: 'Chief Business Officer',
    bio: 'Carries 15+ years of expertise in real estate investments and development, leading the platform’s acquisition, development and asset management mandate across India and the GCC.',
    linkedin: 'https://www.linkedin.com/in/sai-krishna-narla-39b81881/',
    lead: false
  }
];

test.describe('team.html', () => {
  test('four exact member cards with portraits', async ({ page }) => {
    const errors = attachErrorCapture(page);
    await page.goto('/team.html');

    // The visible headline is the decorative TEAM watermark; the h1 stays
    // descriptive for assistive tech and search, and is visually hidden.
    await expect(page.locator('h1')).toHaveText('Leadership Collective');
    await expect(page.locator('.leader-watermark')).toHaveAttribute('aria-hidden', 'true');
    // Client 2026-08-09 (p17): "A leadership team with" was struck out.
    await expect(page.locator('.leader-intro')).toHaveText(
      '75+ combined years across real estate, private equity and education infrastructure.'
    );

    const cards = page.locator('.leader-card');
    await expect(cards).toHaveCount(4);

    for (let i = 0; i < MEMBERS.length; i++) {
      await expect(cards.nth(i).locator('h2')).toHaveText(MEMBERS[i].name);
      await expect(cards.nth(i).locator('.leader-role')).toHaveText(MEMBERS[i].role);
      await expect(cards.nth(i).locator('.leader-bio')).toHaveText(MEMBERS[i].bio);
    }

    // Portraits: descriptive alt, and the file actually decodes.
    const portraits = page.locator('.leader-card img.leader-portrait');
    await expect(portraits).toHaveCount(4);
    for (let i = 0; i < MEMBERS.length; i++) {
      const img = portraits.nth(i);
      await expect(img).toHaveAttribute('alt', `Portrait of ${MEMBERS[i].name}`);
      await img.scrollIntoViewIfNeeded();
      await expect
        .poll(() => img.evaluate((el) => el.complete && el.naturalWidth > 0), { timeout: 10000 })
        .toBe(true);
    }

    await assertNoHorizontalOverflow(page);
    expectNoPageErrors(errors);
  });

  test('LinkedIn links resolve to the right profile and open safely', async ({ page }) => {
    await page.goto('/team.html');
    const cards = page.locator('.leader-card');
    for (let i = 0; i < MEMBERS.length; i++) {
      const link = cards.nth(i).locator('.leader-social a');
      await expect(link).toHaveAttribute('href', MEMBERS[i].linkedin);
      await expect(link).toHaveAttribute('target', '_blank');
      // rel must include noopener: target=_blank without it exposes window.opener
      await expect(link).toHaveAttribute('rel', /noopener/);
      await expect(link).toHaveAttribute('aria-label', `${MEMBERS[i].name} on LinkedIn`);
    }
  });

  test('every card renders its portrait and type at the same size', async ({ page }) => {
    // Client 2026-08-09: this used to assert the OPPOSITE — the senior row was
    // deliberately scaled up. p18 ("Image size for all is to be the same") and
    // p12 (one type scale sitewide) reversed that, so the assertion is inverted
    // rather than deleted: the lead row keeps its taller box, nothing else.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/team.html');
    const cards = page.locator('.leader-card');

    for (let i = 0; i < MEMBERS.length; i++) {
      const isLead = await cards.nth(i).evaluate((el) => el.classList.contains('leader-card--lead'));
      expect(isLead, `${MEMBERS[i].name} lead flag`).toBe(MEMBERS[i].lead);
    }

    const widths = await page
      .locator('.leader-portrait')
      .evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().width)));
    expect(widths).toHaveLength(4);
    expect(new Set(widths).size, `portrait widths differ: ${widths}`).toBe(1);

    const sizes = await page
      .locator('.leader-card h2')
      .evaluateAll((els) => els.map((e) => getComputedStyle(e).fontSize));
    expect(new Set(sizes).size, `heading sizes differ: ${sizes}`).toBe(1);

    const roles = await page
      .locator('.leader-role')
      .evaluateAll((els) => els.map((e) => getComputedStyle(e).fontSize));
    expect(new Set(roles).size, `role sizes differ: ${roles}`).toBe(1);
  });

  test('Read More opens a modal with that person’s bio, and closes', async ({ page }) => {
    const errors = attachErrorCapture(page);
    await page.goto('/team.html');

    const overlay = page.locator('.premium-modal-overlay');
    await expect(overlay).toBeHidden();

    // open from the second card to prove content is per-card, not fixed
    await page.locator('.leader-card').nth(1).locator('.leader-more').click();
    await expect(overlay).toBeVisible();
    await expect(page.locator('.modal-title')).toHaveText(MEMBERS[1].name);
    await expect(page.locator('.premium-modal-body p').first()).toContainText(
      'Vishal is an alumnus of Harvard Business School'
    );

    // focus moves into the dialog and the page behind is locked
    await expect(page.locator('.close-button')).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');

    // clicking inside must not dismiss it
    await page.locator('.premium-modal-body').click({ position: { x: 10, y: 10 } });
    await expect(overlay).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(overlay).toBeHidden();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('');

    // focus returns to the trigger
    const restored = await page.evaluate(() =>
      document.activeElement.classList.contains('leader-more')
    );
    expect(restored).toBe(true);

    expectNoPageErrors(errors);
  });

  test('tilt is disabled under reduced motion', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto('/team.html');
    const transform = await page
      .locator('.leader-card')
      .first()
      .evaluate((el) => getComputedStyle(el).transform);
    expect(transform).toBe('none');
    await context.close();
  });

  test('full-page screenshot', async ({ page }, testInfo) => {
    await page.goto('/team.html');
    await page.waitForTimeout(600);
    await fullPageShot(page, testInfo, 'team');
  });
});
