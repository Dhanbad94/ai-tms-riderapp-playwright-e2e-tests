import { defineConfig, devices } from "@playwright/test";
import { TIMEOUTS, RIDER_TIMEOUTS } from "./constants";
import { getRiderConfig } from "./utils/rider-config";

/**
 * Playwright Configuration — TMS Rider Web App E2E Tests
 *
 * The app is mobile-responsive, and rider-mobile-chrome/rider-mobile-safari
 * cover that layout — but a real MUI-level incompatibility rules out running
 * the PRIMARY projects (rider-chromium/rider-creates-ride) under mobile
 * device emulation: MUI's DatePicker renders as a full-screen Dialog under
 * touch/mobile viewports instead of the desktop Popper (confirmed live:
 * .MuiDialog-root count 1 / .MuiPickersPopper-root count 0 under Pixel 7
 * emulation, vs. the reverse under Desktop Chrome), and DateTimePicker.ts's
 * calendar-open/day-select logic is written for the Popper variant. Trying
 * mobile-only here caused 37 previously-passing tests across the suite to
 * fail (every spec that touches the date/time picker). Reverted back to
 * Desktop Chrome for these two projects per explicit direction — mobile
 * coverage for the date picker specifically would need DateTimePicker.ts
 * rewritten for the Dialog variant, which hasn't been done.
 *
 * Projects:
 *   rider-chromium       — Desktop Chrome (default)
 *   rider-mobile-chrome  — Mobile Chrome (Pixel 7)
 *   rider-mobile-safari  — Mobile Safari (iPhone 14)
 *
 * Run:
 *   npx playwright test --project=rider-chromium
 *   npx playwright test --project=rider-mobile-chrome
 *   npx playwright test --project=rider-mobile-safari
 *   npx playwright test  # All 4 projects
 */

const isCI = !!process.env.CI;
const riderConfig = getRiderConfig();

/**
 * Specs that submit REAL rides against the shared staging org. These share a
 * single rate-limited resource, so they must NOT run concurrently — they get a
 * dedicated project pinned to workers:1 and are excluded from the parallel
 * Desktop Chrome project to avoid tripping staging's rate limiter.
 *
 * Covers both the `asap-*` suite and the `future-*` suite (tests/on-demand/
 * future-booking-only/) so ride-creating Future Booking specs are serialized
 * the same way ASAP's are.
 */
const CREATES_RIDE_FILES = /(asap|future)-(confirmation|feedback|cancellation|e2e|dispatch-lifecycle|have-a-booking-flight|rider-details-verification|tracking-actions)\.spec\.ts$/;

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
    // Desktop Chrome — UI-only / safe specs, fully parallel.
    // Ride-creating specs are excluded here and handled by rider-creates-ride.
    {
      name: "rider-chromium",
      testIgnore: CREATES_RIDE_FILES,
      use: { ...devices["Desktop Chrome"] },
    },

    // Desktop Chrome — ride-creating specs only, serialized to one worker so
    // concurrent submissions don't trip staging's rate limiter.
    {
      name: "rider-creates-ride",
      testMatch: CREATES_RIDE_FILES,
      fullyParallel: false,
      workers: 1,
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
