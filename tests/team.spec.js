// Phase 4 gate: Team page — Leadership Collective, 4 text-only member cards.
const { test, expect } = require('@playwright/test');
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
    bio: 'Brings 20+ years of experience across real estate and infrastructure, including a decade in real estate private equity with two leading India-focused funds. Sets the firm’s investment direction and long-term growth strategy.'
  },
  {
    name: 'Vishal Goel',
    role: 'Advisor to the Board of Directors',
    bio: 'Brings 20+ years of experience in real estate investment and advisory, spanning REITs, strategy and industrial assets, including the development and management of ground-up core assets.'
  },
  {
    name: 'Anuraag Jhunjhunwala',
    role: 'Chief Business Officer',
    bio: 'Has 10+ years of experience in private equity investments, driving capital partnerships, deal origination and portfolio growth.'
  },
  {
    name: 'Sai Krishna Narla',
    role: 'Chief Executive Officer',
    bio: 'Carries 15+ years of expertise in real estate investments and development, leading the platform’s acquisition, development and asset management mandate across India and the GCC.'
  }
];

test.describe('team.html', () => {
  test('h1, intro, four exact member cards, no images in cards', async ({ page }) => {
    const errors = attachErrorCapture(page);
    await page.goto('/team.html');

    await expect(page.locator('h1')).toHaveText('Leadership Collective');
    await expect(page.locator('.hero-intro')).toHaveText(
      'A leadership team with 75+ combined years across real estate, private equity and education infrastructure.'
    );

    const cards = page.locator('.team-card');
    await expect(cards).toHaveCount(4);

    for (let i = 0; i < MEMBERS.length; i++) {
      await expect(cards.nth(i).locator('h2')).toHaveText(MEMBERS[i].name);
      await expect(cards.nth(i).locator('.role')).toHaveText(MEMBERS[i].role);
      await expect(cards.nth(i).locator('p.body-copy')).toHaveText(MEMBERS[i].bio);
    }

    // No photos exist for the team — cards must not fabricate any
    await expect(page.locator('.team-card img')).toHaveCount(0);

    await assertNoHorizontalOverflow(page);
    expectNoPageErrors(errors);
  });

  test('full-page screenshot', async ({ page }, testInfo) => {
    await page.goto('/team.html');
    await page.waitForTimeout(600);
    await fullPageShot(page, testInfo, 'team');
  });
});
