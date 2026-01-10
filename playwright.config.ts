import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for viewport and responsive testing.
 *
 * Focus on iPad responsiveness issues discovered in the epics page:
 * - iPad Safari viewport hiding action buttons
 * - Touch target compliance (44px minimum)
 * - Mobile navigation accessibility
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },

  projects: [
    // Desktop Chrome - baseline
    {
      name: "desktop-chrome",
      use: { ...devices["Desktop Chrome"] },
    },

    // iPad Pro 11" (834 x 1194) - portrait mode (our main problem case)
    {
      name: "ipad-portrait",
      use: {
        viewport: { width: 834, height: 1194 },
        userAgent:
          "Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
        isMobile: true,
        hasTouch: true,
      },
    },

    // iPad Pro 11" - landscape mode
    {
      name: "ipad-landscape",
      use: {
        viewport: { width: 1194, height: 834 },
        userAgent:
          "Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
        isMobile: true,
        hasTouch: true,
      },
    },

    // iPhone 14 Pro (393 x 852) - smallest supported viewport
    {
      name: "mobile-iphone",
      use: { ...devices["iPhone 14 Pro"] },
    },
  ],

  // Run dev server if not already running
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
