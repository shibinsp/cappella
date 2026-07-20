// Shared Playwright fixtures for the Cappella site.
//
// Every spec imports `test` from here rather than from @playwright/test, so
// the third-party blocking below applies to the whole suite automatically.
const base = require('@playwright/test');

/**
 * The Contact page embeds a Google Map (client request, 2026-07-17). Letting
 * it load makes the suite depend on Google's uptime and on this machine's
 * outbound network: the Maps bootstrap dies with ERR_CONNECTION_RESET, or its
 * module loader throws `Could not load "util".` partway through, and an
 * unrelated spec goes red. Neither failure is ever actionable for us.
 *
 * So the map never loads under test. What we actually own — that the embed is
 * present, points at maps, is titled, and sits correctly in the layout — is
 * asserted structurally in contact.spec.js and holds without the network.
 *
 * Consequence to know about: a malformed embed URL would not be caught here.
 * The src is a static string in contact-us.html and is visible in every
 * screenshot the client reviews, so that is covered outside the suite.
 */
const THIRD_PARTY_PATTERNS = [
  '**maps.googleapis.com**',
  '**maps.gstatic.com**',
  '**www.google.com/maps**'
];

const test = base.test.extend({
  page: async ({ page }, use) => {
    for (const pattern of THIRD_PARTY_PATTERNS) {
      // Fulfill with a real, empty document rather than aborting. An abort
      // surfaces as requestfailed, and so does a 204 here — Chrome treats
      // "no content" on a frame navigation as an aborted navigation. Both
      // would recreate exactly the noise this fixture exists to remove.
      await page.route(pattern, (route) =>
        route.fulfill({
          status: 200,
          contentType: 'text/html',
          body: '<!doctype html><title>Map (stubbed in tests)</title>'
        })
      );
    }
    await use(page);
  }
});

module.exports = { test, expect: base.expect };
