// @ts-check
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  outputDir: './test-artifacts/results',
  fullyParallel: true,
  // The homepage is animation-heavy (preloader, canvases, Lenis); too many
  // concurrent instances starve the compositor and flake the timing-
  // sensitive regression tests. Four workers is stable on this machine.
  workers: 4,
  forbidOnly: true,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }]
  ],
  use: {
    baseURL: 'http://127.0.0.1:8788',
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'node scripts/serve.mjs 8788',
    url: 'http://127.0.0.1:8788/index.html',
    reuseExistingServer: true,
    timeout: 15000
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'tablet', use: { viewport: { width: 768, height: 1024 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 } } }
  ]
});
