import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { defineConfig, devices } from "@playwright/test";
import { TIMEOUTS, RIDER_TIMEOUTS } from "./constants";
import { getRiderConfig } from "./utils/rider-config";

/**
 * Playwright Configuration — TMS Rider Web App E2E Tests
 *
 * Projects:
 *   rider-chromium       — Desktop Chrome (default)
 *   rider-mobile-chrome  — Mobile Chrome (Pixel 7)
 *   rider-mobile-safari  — Mobile Safari (iPhone 14)
 *
 * Run:
 *   ./run-tests -e staging -u all --bc         # Desktop Chrome
 *   npx playwright test --project=rider-mobile-chrome
 *   npx playwright test --project=rider-mobile-safari
 *   npx playwright test  # All 3 projects
 */

const isCI = !!process.env.CI;
const riderConfig = getRiderConfig();

export default defineConfig({
  testDir: "./tests/on-demand",

  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 1,
  workers: isCI ? 3 : 5,

  timeout: RIDER_TIMEOUTS.RIDE_SUBMIT * 2,

  expect: {
    timeout: TIMEOUTS.EXPECT,
  },

  reporter: [
    ["html", { open: isCI ? "never" : "on-failure", outputFolder: "playwright-report" }],
    ["list"],
    ["junit", { outputFile: "results.xml" }],
    ["json", { outputFile: "test-results.json" }],
  ],

  use: {
    baseURL: riderConfig.urls.base,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    headless: true,
    ignoreHTTPSErrors: true,
    actionTimeout: TIMEOUTS.ACTION,
    navigationTimeout: TIMEOUTS.NAVIGATION,
    locale: "en-US",
    timezoneId: "America/New_York",
  },

  projects: [
    // Desktop Chrome
    {
      name: "rider-chromium",
      use: { ...devices["Desktop Chrome"] },
    },

    // Mobile Chrome (Android — Pixel 7)
    {
      name: "rider-mobile-chrome",
      use: { ...devices["Pixel 7"] },
    },

    // Mobile Safari (iOS — iPhone 14)
    // Note: WebKit may have internal errors on certain staging sites.
    // Run with: npx playwright test --project=rider-mobile-safari
    {
      name: "rider-mobile-safari",
      use: {
        ...devices["iPhone 14"],
        // Longer timeout for WebKit which is slower
        navigationTimeout: 45_000,
      },
    },
  ],

  outputDir: "test-results",
});
