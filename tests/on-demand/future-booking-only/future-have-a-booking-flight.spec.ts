import { test, expect } from '../../../fixtures/test-fixtures';
import { getOrgConfig, getRiderConfig, canCreateRides, isOrgEnabled } from '../../../utils/rider-config';
import { RIDER_TAGS, RIDER_TIMEOUTS } from '../../../constants';
import { SelectLocationPage } from '../../../pages/rider/SelectLocationPage';
import { DateTimePicker } from '../../../pages/rider/DateTimePicker';
import { FutureGuestFormSection } from '../../../pages/rider/FutureGuestFormSection';
import { SignInPage } from '../../../pages/rider/SignInPage';

/**
 * "Have a Booking?" — org-scoped entry point with Phone/Flight tabs.
 *
 * Reached live by: php-staging.trackmyshuttle.com → enter tracking code
 * (e.g. ODFB) → org Welcome screen → "Have a Booking?" link, which points to
 * `{rider-app}/sign-in?showFlight&orgCode={code}` (live-verified against
 * staging/ODFB on 2026-08-21). This exact query-param combination is what
 * gates the two-tab UI in src/components/web/signIn/signIn.js (`staging`
 * branch — this feature is absent from `main`); navigating straight there
 * (rather than click-driving the separate php-staging marketing site, which
 * isn't part of this app) reaches the identical page state.
 *
 * The Flight tab calls a REAL `findBookingByFlight` (POST /ride-bookings)
 * lookup — no OTP is involved on this path, so (unlike the Phone tab) the
 * happy-path test can run all the way through to the resulting /bookings
 * page.
 */
const rc = getRiderConfig();
const org = rc.orgs.futureBookingOnly;

/**
 * Create a real Future Booking ride with a known Flight Number, for the
 * Flight-tab lookup tests to find. Uses today's default date/slot so the
 * ride's pickup date matches the Flight tab's default "Select Day" (Today) —
 * findBookingByFlight requires the booking_date to match exactly. However,
 * acceptDefaultSlot()/ensureBookableSlot() will silently hop to a LATER date
 * if today's slots have sold out (live-confirmed: this happens under
 * repeated test-session load) — so the actual date used is captured and
 * returned rather than assumed, and the Flight tab test re-selects that same
 * day before looking the booking up.
 */
async function createFutureRideWithFlight(
  page: import('@playwright/test').Page,
  flightNo: string
): Promise<{ rideCode: string; pickup: string; dropoff: string; name: string; dateText: string }> {
  const cfg = getOrgConfig('futureBookingOnly');
  const lp = new SelectLocationPage(page);
  const dt = new DateTimePicker(page);
  const gf = new FutureGuestFormSection(page);

  await lp.goto(cfg.trackingId);
  await lp.selectBothStops(cfg.stops.pickup, cfg.stops.dropoff);
  await dt.acceptDefaultSlot();
  const dateText = await dt.getSelectedDateText();
  await lp.clickConfirm();
  await gf.waitForFormVisible();
  const details = await gf.fillRequiredFields();
  await gf.fillFlight(flightNo);
  await gf.submitAndAwaitTracking();
  // Brief settle wait before the caller immediately queries this same ride
  // back via findBookingByFlight — observed live: an immediate lookup can
  // race the backend indexing the just-created booking and return no match,
  // succeeding a moment later with no other change (confirmed via a clean
  // retry). Reuses the same constant already used for staging rate-limit
  // settling elsewhere in this suite.
  await page.waitForTimeout(RIDER_TIMEOUTS.RIDE_COOLDOWN);

  const match = page.url().match(/\/j\/([^/]+)\/s/);
  if (!match || !match[1]) throw new Error(`Failed to extract ride code from URL: ${page.url()}`);
  return { rideCode: match[1], pickup: cfg.stops.pickup, dropoff: cfg.stops.dropoff, name: details.name, dateText };
}

test.describe(`Have a Booking — Org-Scoped Tabs (Phone/Flight) ${RIDER_TAGS.FUTURE} ${RIDER_TAGS.CREATES_RIDE} ${RIDER_TAGS.REGRESSION}`, () => {
  test.describe('Tab presence & switching (no ride required)', () => {
    test.beforeEach(async ({ signInPage }) => {
      test.skip(!isOrgEnabled('futureBookingOnly'), 'Future Booking org not configured for this environment — set trackingId/stops in rider-config.ts');
      await signInPage.goto({ showFlight: true, orgCode: org.trackingId.toLowerCase() });
    });

    /** Verify that both "Find by Phone No." and "Find by Flight No." tabs render when reached via the org-scoped link. */
    test('@smoke HB_008: Both Phone and Flight tabs are visible with ?showFlight&orgCode', async ({ signInPage }) => {
      await expect(signInPage.phoneTabLabel).toBeVisible();
      await expect(signInPage.flightTabLabel).toBeVisible();
    });

    /** Verify that the Phone tab is the default active tab. */
    test('HB_009: Phone tab is selected by default', async ({ signInPage }) => {
      await expect(signInPage.phoneInput).toBeVisible();
      await expect(signInPage.flightNumberInput).not.toBeVisible();
    });

    /** Verify that switching to the Flight tab shows the "Select Day" date field and "Enter Flight Number" field. */
    test('HB_010: Switching to the Flight tab shows the date and flight-number fields', async ({ signInPage }) => {
      await signInPage.switchToFlightTab();
      await expect(signInPage.flightDateInput).toBeVisible();
      await expect(signInPage.flightDateInput).toHaveValue('Today');
      await expect(signInPage.flightNumberInput).toBeVisible();
      await expect(signInPage.phoneInput).not.toBeVisible();
    });

    /** Verify that switching back to the Phone tab restores the phone field and clears the Flight tab's state. */
    test('HB_011: Switching back to the Phone tab restores the phone field', async ({ signInPage }) => {
      await signInPage.switchToFlightTab();
      await signInPage.switchToPhoneTab();
      await expect(signInPage.phoneInput).toBeVisible();
      await expect(signInPage.flightNumberInput).not.toBeVisible();
    });

    /** Verify that "Next" on the Flight tab stays disabled until a flight number of at least 3 characters is entered. */
    test('HB_012: "Next" on the Flight tab is disabled until a valid flight number is entered', async ({ signInPage }) => {
      await signInPage.switchToFlightTab();
      await expect(signInPage.nextButton).toBeDisabled();
      await signInPage.fillFlightNumber('A1');
      await expect(signInPage.nextButton).toBeDisabled();
      await signInPage.fillFlightNumber('AA1');
      await expect(signInPage.nextButton).toBeEnabled();
    });

    /** Verify that looking up a flight number with no matching booking shows "No reservation records match the provided flight number." */
    test('@negative HB_013: A non-existent flight number shows "No reservation records match" error', async ({ signInPage }) => {
      await signInPage.switchToFlightTab();
      await signInPage.fillFlightNumber('ZZ0000000');
      await expect(signInPage.nextButton).toBeEnabled();
      await signInPage.clickNext();
      await expect.poll(() => signInPage.getFlightErrorText(), { timeout: 15_000 })
        .toBe('No reservation records match the provided flight number.');
    });

    /** Verify that the Phone tab's validation messages (from HB_004/HB_005) also apply when reached via the org-scoped tabbed URL. */
    test('HB_014: Phone tab validation still applies on the org-scoped tabbed page', async ({ signInPage }) => {
      // Fresh sessions default to United States (+1) — select India explicitly
      // to match this suite's phone test-data format (see SignInPage.ts).
      await signInPage.selectCountryCode('India');
      await signInPage.fillPhone('86769138311');
      await expect.poll(() => signInPage.getPhoneErrorText()).toBe('Phone must be 10 digits');
    });
  });

  test.describe('Flight lookup — real booking', () => {
    test.beforeEach(async () => {
      test.skip(!isOrgEnabled('futureBookingOnly'), 'Future Booking org not configured for this environment — set trackingId/stops in rider-config.ts');
      test.skip(!canCreateRides(), 'Ride creation disabled on this environment');
    });

    test.afterEach(async ({ page }) => {
      await page.waitForTimeout(RIDER_TIMEOUTS.RIDE_COOLDOWN);
    });

    // KNOWN FLAKE (backend, not app/test): the flight-search endpoint
    // (POST /ride-bookings) lags the booking write by a variable delay that
    // can exceed 90s, so a just-created booking is intermittently not yet
    // findable — the same booking is viewable immediately at its /j/{code}/s
    // URL, so only the search index is behind. submitFlightLookupWithRetry()
    // widens the client poll window (~90s) and CI retries cover the rest, but
    // this can only be truly fixed backend-side. Tracked in the PR description.
    /** Verify that a Flight Number lookup for a real, just-created booking succeeds and lands on the bookings page with matching details. */
    test('@sanity HB_015: A real flight number finds the booking and navigates to /bookings', async ({ page }) => {
      const flightNo = `FL${Math.floor(1000 + Math.random() * 9000)}`;
      const { pickup, dropoff, dateText } = await createFutureRideWithFlight(page, flightNo);

      const signInPage = new SignInPage(page);
      await signInPage.goto({ showFlight: true, orgCode: org.trackingId.toLowerCase() });
      await signInPage.switchToFlightTab();
      // Date field defaults to "Today" — only override it if the ride ended
      // up booked for a different day (ensureBookableSlot() hops dates when
      // today's slots are sold out; see createFutureRideWithFlight above).
      if (dateText !== 'Today') {
        const day = dateText.match(/^(\d{1,2})/)?.[1];
        if (day) await signInPage.selectFlightDateByDay(day);
      }
      await signInPage.fillFlightNumber(flightNo);
      await expect(signInPage.nextButton).toBeEnabled();
      // Retries internally — findBookingByFlight can briefly not find a
      // booking created moments earlier (backend search-index lag on this
      // endpoint specifically, live-diagnosed 2026-08-21; see SignInPage.ts).
      await signInPage.submitFlightLookupWithRetry();

      await expect(page).toHaveURL(/\/bookings$/, { timeout: 15_000 });
      await expect(page.getByText(new RegExp(`Flight:\\s*${flightNo}`, 'i'))).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(pickup).first()).toBeVisible();
      await expect(page.getByText(dropoff).first()).toBeVisible();
    });
  });
});
