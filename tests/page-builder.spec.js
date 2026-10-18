// CMS page builder: /p/<slug> is page.html, filled from Sanity by cms.js.
// Sanity is stubbed here, so the suite does not depend on the network or on
// whatever the client has published.
const { test, expect } = require('./fixtures');
const { attachErrorCapture, expectNoPageErrors, assertNoHorizontalOverflow } = require('./helpers');

const CDN = 'https://cdn.sanity.io/images/xkccdy4d/production';
const PX = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

const FULL_PAGE = {
  title: 'Our Approach',
  description: 'How Cappella invests in school infrastructure.',
  blocks: [
    { _type: 'heroBlock', _key: 'a', heading: 'Our Approach', intro: 'Patient capital.\nReal assets.' },
    {
      _type: 'textBlock', _key: 'b', heading: 'Principles',
      body: [
        { _type: 'block', style: 'normal', markDefs: [{ _key: 'l1', _type: 'link', href: 'https://example.com/x' }],
          children: [{ _type: 'span', text: 'We are ', marks: [] }, { _type: 'span', text: 'long-term', marks: ['strong'] },
            { _type: 'span', text: ' and ', marks: [] }, { _type: 'span', text: 'careful', marks: ['em'] },
            { _type: 'span', text: ' — read more', marks: ['l1'] }] },
        { _type: 'block', style: 'h3', markDefs: [], children: [{ _type: 'span', text: 'Sub heading', marks: [] }] },
        { _type: 'block', style: 'normal', listItem: 'bullet', markDefs: [], children: [{ _type: 'span', text: 'Bullet one', marks: [] }] },
        { _type: 'block', style: 'normal', listItem: 'bullet', markDefs: [], children: [{ _type: 'span', text: 'Bullet two', marks: [] }] },
        { _type: 'block', style: 'normal', listItem: 'number', markDefs: [], children: [{ _type: 'span', text: 'Step one', marks: [] }] },
        { _type: 'block', style: 'blockquote', markDefs: [], children: [{ _type: 'span', text: 'A quote', marks: [] }] }
      ]
    },
    { _type: 'imageBlock', _key: 'c', alt: 'A campus', caption: 'Campus view', size: 'wide', url: `${CDN}/aaa-100x100.jpg` },
    { _type: 'galleryBlock', _key: 'd', heading: 'Gallery', images: [
      { alt: 'One', url: `${CDN}/g1-100x100.jpg` }, { alt: 'Two', url: `${CDN}/g2-100x100.jpg` }, { alt: 'Three', url: `${CDN}/g3-100x100.jpg` }] },
    { _type: 'cardsBlock', _key: 'e', heading: 'Cards', cards: [
      { title: 'Linked card', text: 'Has a link', link: 'https://example.com/card', url: `${CDN}/c1-100x100.jpg`, alt: 'Card photo' },
      { title: 'Plain card', text: 'No link' }] },
    { _type: 'buttonBlock', _key: 'f', label: 'Get in touch', url: '/contact-us.html' }
  ]
};

// Stub Sanity: answer the page query by slug; images resolve to a 1px gif.
async function stubSanity(page, pages, { fail = false } = {}) {
  await page.route('**/*.apicdn.sanity.io/**', (route) => {
    if (fail) return route.abort();
    const slug = JSON.parse(new URL(route.request().url()).searchParams.get('$slug') || 'null');
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ result: pages[slug] || null })
    });
  });
  await page.route('https://cdn.sanity.io/**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/gif', body: Buffer.from(PX.split(',')[1], 'base64') })
  );
}

test.describe('page builder (/p/<slug>)', () => {
  test('renders every block type from the CMS', async ({ page }) => {
    const errors = attachErrorCapture(page);
    await stubSanity(page, { 'our-approach': FULL_PAGE });
    await page.goto('/p/our-approach');

    await expect(page.locator('h1')).toHaveText('Our Approach');
    await expect(page.locator('.hero-intro')).toContainText('Real assets.');
    await expect(page).toHaveTitle('Our Approach — Cappella');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', FULL_PAGE.description);

    const prose = page.locator('.pb-prose');
    await expect(prose.locator('strong')).toHaveText('long-term');
    await expect(prose.locator('em')).toHaveText('careful');
    await expect(prose.locator('h3')).toHaveText('Sub heading');
    await expect(prose.locator('ul > li')).toHaveCount(2);
    await expect(prose.locator('ol > li')).toHaveCount(1);
    await expect(prose.locator('blockquote')).toHaveText('A quote');
    const link = prose.locator('a');
    await expect(link).toHaveAttribute('href', 'https://example.com/x');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');

    const fig = page.locator('.pb-image--wide');
    await expect(fig.locator('img')).toHaveAttribute('alt', 'A campus');
    await expect(fig.locator('img')).toHaveAttribute('src', /aaa-100x100\.jpg\?w=1800/);
    await expect(fig.locator('figcaption')).toHaveText('Campus view');

    await expect(page.locator('.pb-gallery img')).toHaveCount(3);
    await expect(page.locator('a.pb-card')).toHaveCount(1);
    await expect(page.locator('.pb-card')).toHaveCount(2);
    await expect(page.locator('.pb-card__title').first()).toHaveText('Linked card');

    const btn = page.locator('.pb-btn');
    await expect(btn).toHaveText('Get in touch');
    await expect(btn).toHaveAttribute('href', '/contact-us.html');
    await expect(btn).not.toHaveAttribute('target', /.+/);

    await assertNoHorizontalOverflow(page);
    expectNoPageErrors(errors);
  });

  test('shares the site header and footer, and resolves nav links from the root', async ({ page }) => {
    await stubSanity(page, { 'our-approach': FULL_PAGE });
    await page.goto('/p/our-approach');
    await expect(page.locator('.site-header')).toBeVisible();
    await expect(page.locator('.site-footer')).toBeVisible();
    // The nav is behind the menu button on small screens, so assert where the
    // links resolve rather than clicking them: under /p/ a relative href would
    // land on /p/projects.html without the <base href="/">.
    const hrefs = await page.locator('.site-nav a').evaluateAll((as) => as.map((a) => new URL(a.href).pathname));
    expect(hrefs).toEqual(['/about-us.html', '/projects.html', '/skolen.html', '/team.html', '/contact-us.html']);
    await expect(page.locator('link[rel="stylesheet"][href="shared/css/page.css"]')).toHaveCount(1);
    const css = await page.evaluate(() => getComputedStyle(document.querySelector('.pb-btn') || document.body).fontFamily);
    expect(css).toMatch(/Montserrat/i);
  });

  test('a page without a heading block still gets an h1 from its title', async ({ page }) => {
    await stubSanity(page, {
      'plain': { title: 'Plain Page', blocks: [{ _type: 'buttonBlock', _key: 'x', label: 'Go', url: 'https://example.com' }] }
    });
    await page.goto('/p/plain');
    await expect(page.locator('h1')).toHaveText('Plain Page');
    await expect(page.locator('.pb-btn')).toHaveAttribute('target', '_blank');
  });

  test('unknown address shows Page not found and is marked noindex', async ({ page }) => {
    await stubSanity(page, {});
    await page.goto('/p/does-not-exist');
    await expect(page.locator('h1')).toHaveText('Page not found');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  });

  test('a failed fetch says so, and is not marked noindex', async ({ page }) => {
    await stubSanity(page, {}, { fail: true });
    await page.goto('/p/anything');
    await expect(page.locator('h1')).toHaveText('This page could not be loaded');
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  });

  test('editor content is escaped, and script URLs are dropped', async ({ page }) => {
    const errors = attachErrorCapture(page);
    let dialogs = 0;
    page.on('dialog', (d) => { dialogs++; d.dismiss(); });
    await stubSanity(page, {
      evil: {
        title: '<img src=x onerror=alert(1)>',
        blocks: [
          { _type: 'heroBlock', _key: 'h', heading: '<img src=x onerror=alert(1)>' },
          { _type: 'textBlock', _key: 't', heading: '<b>bold?</b>', body: [
            { _type: 'block', style: 'normal', markDefs: [{ _key: 'j', _type: 'link', href: 'javascript:alert(1)' }],
              children: [{ _type: 'span', text: 'click me', marks: ['j'] }] }] },
          { _type: 'buttonBlock', _key: 'b', label: 'Bad', url: 'javascript:alert(1)' },
          { _type: 'cardsBlock', _key: 'c', cards: [{ title: 'Card', link: 'data:text/html,<script>alert(1)</script>' }] }
        ]
      }
    });
    await page.goto('/p/evil');
    await expect(page.locator('h1')).toHaveText('<img src=x onerror=alert(1)>');
    await expect(page.locator('main img')).toHaveCount(0);
    await expect(page.locator('main b')).toHaveCount(0);
    await expect(page.locator('main a[href^="javascript"]')).toHaveCount(0);
    await expect(page.locator('.pb-btn')).toHaveCount(0);
    await expect(page.locator('a.pb-card')).toHaveCount(0);
    await expect(page.locator('.pb-prose')).toContainText('click me');
    expect(dialogs, 'no script ran').toBe(0);
    expectNoPageErrors(errors);
  });

  test('page.html?slug= works too (no rewrite needed)', async ({ page }) => {
    await stubSanity(page, { 'our-approach': FULL_PAGE });
    await page.goto('/page.html?slug=our-approach');
    await expect(page.locator('h1')).toHaveText('Our Approach');
  });
});
