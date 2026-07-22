// Shared Playwright fixtures for the Cappella site.
//
// Every spec imports `test` from here rather than from @playwright/test, so
// the third-party blocking below applies to the whole suite automatically.
const base = require('@playwright/test');

/**
 * The Contact page shows a Leaflet map (vendored locally) over OpenStreetMap
 * tiles. Leaflet itself is served from the repo, but the map tiles come from
 * tile.openstreetmap.org — letting those load makes the suite depend on OSM's
 * uptime and this machine's outbound network. So the tiles are blocked here;
 * the map still initialises without them.
 *
 * What we actually own — that the map container is present, initialises
 * (Leaflet adds .leaflet-container), is titled, and has a Get Directions link
 * — is asserted structurally in contact.spec.js and holds without the network.
 */
const THIRD_PARTY_PATTERNS = [
  '**tile.openstreetmap.org**'
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
