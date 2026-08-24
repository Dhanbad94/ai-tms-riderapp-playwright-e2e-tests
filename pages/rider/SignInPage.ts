import { Page, Locator, expect } from '@playwright/test';
import { RIDER_TIMEOUTS } from '../../constants';
import { getRiderConfig } from '../../utils/rider-config';

/**
 * Page Object for the "Have a booking?" phone/flight lookup page (/sign-in).
 *
 * Two distinct entry points exist in the deployed app, both landing on this
 * same page/component (src/components/web/signIn/signIn.js, `staging` branch
 * — NOT `main`, which is stale for this feature):
 *
 *  1. The rider-app's own landing page ("Have a Booking?" next to the
 *     tracking-code input) links to plain `/sign-in` — phone number only,
 *     no tabs (`showFlightNo` is false since `router.query.showFlight` is
 *     undefined).
 *  2. The org "Welcome" screen — reached via php-staging.trackmyshuttle.com
 *     after entering a tracking code — links to
 *     `/sign-in?showFlight&orgCode={code}`, which renders BOTH tabs:
 *     "Find by Phone No." and "Find by Flight No.". Live-verified against
 *     staging/ODFB on 2026-08-21.
 *
 * The Phone tab always triggers a REAL `findMyBookings` API call and (on a
 * match) a REAL OTP send + navigation to /otp — tests must stop there rather
 * than proceeding into OTP entry (out of scope; no way to receive the SMS).
 *
 * The Flight tab calls `findBookingByFlight(flightNo, bookingDate, orgCode)`
 * — POST /ride-bookings — and only exists when `showFlight` is present.
 */
export class SignInPage {
  readonly page: Page;

  readonly heading: Locator;
  readonly backButton: Locator;

  // Tabs (only rendered when the page is reached with ?showFlight)
  readonly phoneTabLabel: Locator;
  readonly flightTabLabel: Locator;

  // Phone tab
  readonly phoneInput: Locator;
  readonly phoneErrorBox: Locator;
  readonly createBookingLink: Locator;
  readonly countryCodeDisplay: Locator;
  readonly countryCodeDropdown: Locator;
  readonly countrySearchInput: Locator;

  // Flight tab
  readonly flightDateInput: Locator;
  readonly flightNumberInput: Locator;
  readonly flightErrorBox: Locator;

  readonly nextButton: Locator;

  constructor(page: Page) {
    this.page = page;

    this.heading = page.getByRole('heading', { name: 'Have a booking?' });
    this.backButton = page.locator('button').filter({ has: page.locator('img[alt="back"]') }).first();

    this.phoneTabLabel = page.locator('label').filter({ hasText: 'Find by Phone No.' });
    this.flightTabLabel = page.locator('label').filter({ hasText: 'Find by Flight No.' });

    this.phoneInput = page.getByRole('textbox', { name: 'Enter Phone Number' });
    // Plain global `.errorMsg` class (not a CSS-module hash) — used verbatim
    // in signIn.js: className={"errorMsg my10 mb20"}.
    this.phoneErrorBox = page.locator('.errorMsg');
    this.createBookingLink = page.getByRole('link', { name: 'Create a booking' });
    // Same CountryDropdown component used on the guest form — defaults to
    // United States (+1) on a fresh, cookie-less session (live-verified),
    // NOT +91/India as this suite's org phone numbers assume. Tests must
    // call selectCountryCode() explicitly rather than relying on the default.
    this.countryCodeDisplay = page.locator('[class*="countryDialCode"]');
    this.countryCodeDropdown = page.getByText('Select Country Code');
    this.countrySearchInput = page.getByPlaceholder('Search by Country Code or Name');

    this.flightDateInput = page.getByRole('textbox', { name: 'Select Day' });
    this.flightNumberInput = page.getByRole('textbox', { name: 'Enter Flight Number' });
    // CSS-module class (hashed) — match the stable part.
    this.flightErrorBox = page.locator('[class*="error_msg"]');

    // Exact match — the Flight tab's MUI calendar popper also has a "Next
    // month" arrow button, which an unanchored /Next/i would also match once
    // the popper has been opened (same class of strict-mode violation fixed
    // in DateTimePicker.ts/SelectLocationPage.ts earlier this session).
    this.nextButton = page.getByRole('button', { name: 'Next', exact: true });
  }

  /**
   * Navigate directly to /sign-in. Pass `{ showFlight: true, orgCode }` to
   * reach the org-scoped, tabbed variant (mirrors clicking "Have a Booking?"
   * from an org's Welcome screen on php-staging.trackmyshuttle.com); omit for
   * the plain landing-page variant (phone-only, no tabs).
   */
  async goto(options: { showFlight?: boolean; orgCode?: string } = {}) {
    const config = getRiderConfig();
    let url = `${config.urls.ride}/sign-in`;
    if (options.showFlight) {
      url += `?showFlight${options.orgCode ? `&orgCode=${options.orgCode}` : ''}`;
    }
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    await expect(this.heading).toBeVisible({ timeout: RIDER_TIMEOUTS.FORM_LOAD });
  }

  async switchToPhoneTab() {
    await this.phoneTabLabel.click();
  }

  async switchToFlightTab() {
    await this.flightTabLabel.click();
  }

  async fillPhone(value: string) {
    await this.phoneInput.fill(value);
  }

  /** Select the dial code by country name (e.g. "India") — see constructor note on the default. */
  async selectCountryCode(countryName: string) {
    await this.countryCodeDisplay.click();
    await expect(this.countryCodeDropdown).toBeVisible();
    await this.countrySearchInput.fill(countryName);
    await this.page.getByText(countryName, { exact: true }).first().click();
  }

  /** Trimmed text of the phone-tab error box (empty string if not shown). */
  async getPhoneErrorText(): Promise<string> {
    const visible = await this.phoneErrorBox.isVisible({ timeout: 1_000 }).catch(() => false);
    if (!visible) return '';
    return ((await this.phoneErrorBox.textContent()) ?? '').trim();
  }

  async fillFlightNumber(value: string) {
    await this.flightNumberInput.fill(value);
  }

  /**
   * Change the Flight tab's "Select Day" date away from its default (Today)
   * to a specific day-of-month. Needed when the ride being looked up was
   * booked for a different day than today — findBookingByFlight requires the
   * looked-up booking_date to match the ride's actual pickup date exactly
   * (live-verified: a mismatch returns no match, not an error). Mirrors
   * DateTimePicker.selectDateByDay()'s retry — same MUI DatePicker component,
   * same day-cell detachment/overlay-intercept quirks.
   */
  async selectFlightDateByDay(day: number | string) {
    await this.flightDateInput.click();
    const MAX_ATTEMPTS = 3;
    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        const dayCell = this.page.locator('.MuiPickersDay-root', { hasText: new RegExp(`^${day}$`) }).first();
        await dayCell.waitFor({ state: 'visible', timeout: RIDER_TIMEOUTS.DATE_PICKER });
        await dayCell.click({ force: true, timeout: RIDER_TIMEOUTS.DATE_PICKER });
        return;
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError;
  }

  /** Trimmed text of the flight-tab error box (empty string if not shown). */
  async getFlightErrorText(): Promise<string> {
    const visible = await this.flightErrorBox.isVisible({ timeout: 1_000 }).catch(() => false);
    if (!visible) return '';
    return ((await this.flightErrorBox.textContent()) ?? '').trim();
  }

  async isNextDisabled(): Promise<boolean> {
    return await this.nextButton.isDisabled();
  }

  async clickNext() {
    await this.nextButton.click();
  }

  /**
   * Submit the Flight tab and retry if the just-created booking isn't found
   * yet. Live-diagnosed (2026-08-21): findBookingByFlight (POST
   * /ride-bookings) can briefly return no match for a booking that was JUST
   * created seconds earlier via POST /request — a genuine backend
   * eventual-consistency gap on the search endpoint specifically (the same
   * booking is immediately viewable at its own /j/{code}/s URL, so the write
   * itself isn't delayed, only its visibility to this particular search).
   * Retries the click after a short backoff rather than padding a single
   * fixed wait, which measurably did not eliminate the race on its own.
   */
  async submitFlightLookupWithRetry(maxAttempts = 4): Promise<void> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await this.clickNext();
      const navigated = await this.page
        .waitForURL(/\/bookings$/, { timeout: 5_000 })
        .then(() => true)
        .catch(() => false);
      if (navigated) return;

      if (attempt < maxAttempts - 1) {
        await this.page.waitForTimeout(2_000 * (attempt + 1));
        // A failed lookup returns to the Flight tab with the same values
        // still filled in — clicking Next again re-submits the same query.
      }
    }
    throw new Error(`Flight lookup did not navigate to /bookings after ${maxAttempts} attempts.`);
  }
}
