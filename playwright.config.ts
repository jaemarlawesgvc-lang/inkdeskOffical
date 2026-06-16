import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E test configuration.
 * Tests live in tests/e2e/ and cover the full user journey from auth to booking.
 *
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests/e2e',

  // Run all tests in a file in parallel
  fullyParallel: true,

  // Fail the build on CI if test.only is accidentally committed
  forbidOnly: !!process.env.CI,

  // Retry on CI only; fast-fail locally
  retries: process.env.CI ? 2 : 0,

  // Single worker on CI (avoids resource contention); auto-detect locally
  workers: process.env.CI ? 1 : undefined,

  // Reporter: HTML for local review, dot for CI conciseness
  reporter: process.env.CI
    ? [['dot'], ['html', { open: 'never' }]]
    : [['html', { open: 'on-failure' }]],

  use: {
    // Base URL — override with PLAYWRIGHT_BASE_URL in CI if needed
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',

    // Capture trace on first retry for debugging
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on retry
    video: 'on-first-retry',

    // Viewport
    viewport: { width: 1280, height: 720 },
  },

  projects: [
    // Desktop Chrome — primary browser target
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    // Mobile Chrome — critical for the public artist booking page
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],

  // Auto-start the Next.js dev server before running tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },

  // Output folder for test artefacts
  outputDir: 'tests/e2e/results',
})
