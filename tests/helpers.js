// Shared Playwright test helpers for the Cappella site.
const { expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

/**
 * Origins whose failures are tolerated: Google Fonts loads with
 * display=swap, so an offline/blocked fonts CDN degrades gracefully and
 * must never fail the release gate. Everything else (local assets, pages)
 * must load cleanly.
 */
const IGNORED_ORIGINS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

function isIgnored(url) {
  return IGNORED_ORIGINS.some((origin) => url.includes(origin));
}

/**
 * Attach console-error / page-error / failed-request capture to a page.
 * Returns a live array of strings; assert it is empty at the end of a test
 * via expectNoPageErrors().
 */
function attachErrorCapture(page) {
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !isIgnored(msg.location().url || '')) {
      errors.push(`console.error: ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => {
    errors.push(`pageerror: ${err.message}`);
  });
  page.on('response', (res) => {
    if (res.status() >= 400 && !isIgnored(res.url())) {
      errors.push(`HTTP ${res.status()}: ${res.url()}`);
    }
  });
  page.on('requestfailed', (req) => {
    if (!isIgnored(req.url())) {
      errors.push(`requestfailed: ${req.url()} (${req.failure()?.errorText})`);
    }
  });
  return errors;
}

function expectNoPageErrors(errors) {
  expect(errors, `Page errors captured:\n${errors.join('\n')}`).toEqual([]);
}

/**
 * The document itself must never scroll horizontally. (The Projects tables
 * scroll INSIDE their own wrapper, so this holds on every page/viewport.)
 * Allow 1px of sub-pixel rounding slack.
 */
async function assertNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow, 'document-level horizontal overflow (px)').toBeLessThanOrEqual(1);
}

/**
 * Full-page screenshot into test-artifacts/screenshots/<name>-<project>.png
 * Scrolls through the page first (fullPage stitching does not fire
 * IntersectionObserver, so [data-reveal] content below the fold would
 * otherwise be captured at opacity 0), waits for fonts, then captures.
 */
async function fullPageShot(page, testInfo, name) {
  await page.evaluate(() => document.fonts && document.fonts.ready);
  // Walk the page so every [data-reveal] enters the viewport once.
  await page.evaluate(async () => {
    const step = window.innerHeight * 0.8;
    for (let y = 0; y <= document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 90));
    }
    window.scrollTo(0, 0);
  });
  // Longest reveal chains: footer clip 1.1s + 0.1s delay; India table rows
  // cascade ~1.6s. 1600ms lets everything settle after the walk.
  await page.waitForTimeout(1600);
  const dir = path.join(__dirname, '..', 'test-artifacts', 'screenshots');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${name}-${testInfo.project.name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

/** The four subpages + their nav labels/hrefs, shared by several specs. */
// NOTE: the About h1 uses the docx's typographic apostrophe (U+2019).
const PAGES = [
  { file: 'about-us.html', title: 'About Us', h1: 'India’s Leading Edu-Infra Asset Management Company' },
  { file: 'projects.html', title: 'Projects', h1: 'Our Portfolio' },
  { file: 'team.html', title: 'Team', h1: 'Leadership Collective' },
  { file: 'contact-us.html', title: 'Contact Us', h1: 'Registered Office' }
];

module.exports = {
  attachErrorCapture,
  expectNoPageErrors,
  assertNoHorizontalOverflow,
  fullPageShot,
  PAGES
};
