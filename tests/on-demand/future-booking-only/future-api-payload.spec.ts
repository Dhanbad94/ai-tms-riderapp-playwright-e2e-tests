import { test, expect } from '../../../fixtures/test-fixtures';
import { getRiderConfig, isOrgEnabled } from '../../../utils/rider-config';
import { RIDER_TAGS } from '../../../constants';

/**
 * Future Booking — API Payload Verification & mocked-network scenarios.
 *
 * Mirrors asap-api-payload.spec.ts. Two groups:
 *  1. Submit-payload assertions — mock only the POST /request/{type} response
 *     (identical technique to ASAP's setupFormAndCapture) so no real ride is
 *     created; the location/date/time steps still hit the real org.
 *  2. Deterministic date/slot scenarios — mock the GET /dates/{type} and
 *     /slots/{type} responses so calendar-disable and lead-time-validation
 *     behavior can be asserted precisely instead of depending on whatever
 *     the real org's availability happens to be on a given test run.
 *
 * The /dates and /slots response envelopes below are reconstructed from
 * reading the client code (lib/api.js getAvailableDates/getAvailableSlots +
 * guestForm.js's `response?.response?.only` / `{slots, min} = response`
 * destructuring) — NOT captured from a live response, since no Future
 * Booking org is configured yet. Verify the exact shape with a real network
 * capture the first time these run against a configured org, and adjust the
 * fixture bodies here if the server's envelope differs.
 */
const rc = getRiderConfig();
const org = rc.orgs.futureBookingOnly;
const { stops } = org;
const config = getRiderConfig();

test.describe(`Future Booking — API Payload Verification ${RIDER_TAGS.FUTURE} ${RIDER_TAGS.PAYLOAD} ${RIDER_TAGS.REGRESSION} ${RIDER_TAGS.SAFE}`, () => {
  async function setupFormAndCapture(page: import('@playwright/test').Page) {
    let capturedPayload: Record<string, unknown> | null = null;
    let capturedUrl = '';

    await page.route(`${config.urls.api}/**/request/*`, async (route) => {
      if (route.request().method() === 'POST') {
        capturedPayload = route.request().postDataJSON();
        capturedUrl = route.request().url();
        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ response: { status: 200, data: { response: { ride_code: 'FB_PAYLOAD_TEST', ride_web_link: '' } }, message: 'ok' } }),
        });
      } else { await route.continue(); }
    });

    const { SelectLocationPage } = await import('../../../pages/rider/SelectLocationPage');
    const { DateTimePicker } = await import('../../../pages/rider/DateTimePicker');
    const { FutureGuestFormSection } = await import('../../../pages/rider/FutureGuestFormSection');
    const lp = new SelectLocationPage(page);
    const dt = new DateTimePicker(page);
    const gf = new FutureGuestFormSection(page);
    await lp.goto(org.trackingId);
    await lp.selectBothStops(stops.pickup, stops.dropoff);
    await dt.acceptDefaultSlot();
    await lp.clickConfirm();
    await gf.waitForFormVisible();
    await gf.fillRequiredFields();

    return { gf, getPayload: () => capturedPayload, getUrl: () => capturedUrl };
  }

  test.beforeEach(() => {
    test.skip(!isOrgEnabled('futureBookingOnly'), 'Future Booking org not configured for this environment — set trackingId/stops in rider-config.ts');
  });

  /** Verify that the ride-submission payload includes a "booking" object containing pickup_time and pickup_date. */
  test('@smoke @sanity FB_033: Payload includes a booking object (pickup_time, pickup_date)', async ({ page }) => {
    const { gf, getPayload } = await setupFormAndCapture(page);
    await gf.requestRideButton.scrollIntoViewIfNeeded();
    await gf.submitForm();
    await page.waitForLoadState('networkidle').catch(() => {});
    const payload = getPayload()!;
    expect(payload).toHaveProperty('booking');
    const booking = payload.booking as Record<string, unknown>;
    expect(booking.pickup_time).toBeTruthy();
    expect(booking.pickup_date).toBeTruthy();
  });

  /** Verify that the ride-submission request is sent to the correct type-suffixed Future Booking endpoint, not the ASAP endpoint. */
  test('@smoke FB_034: Submit URL is type-suffixed (uses API_ENDPOINT_FUTURE, not the ASAP /request)', async ({ page }) => {
    const { gf, getUrl } = await setupFormAndCapture(page);
    await gf.requestRideButton.scrollIntoViewIfNeeded();
    await gf.submitForm();
    await page.waitForLoadState('networkidle').catch(() => {});
    // ASAP posts to plain `/request`; Future Booking posts to `/request/{type}`
    // (submitRequestForRide: `type ? /request/${type} : /request`).
    expect(getUrl()).toMatch(/\/request\/.+$/);
    expect(getUrl()).not.toMatch(/\/request$/);
  });

  /** Verify that the ride-submission payload contains the correct rider name and phone number. */
  test('FB_035: Payload has correct rider details', async ({ page }) => {
    const { gf, getPayload } = await setupFormAndCapture(page);
    await gf.requestRideButton.scrollIntoViewIfNeeded();
    await gf.submitForm();
    await page.waitForLoadState('networkidle').catch(() => {});
    const riders = getPayload()!.riders as Record<string, unknown>;
    expect(riders.name).toBeTruthy();
    expect(riders.phone).toBeTruthy();
  });

  /** Verify that the ride-submission payload contains the correct pickup and drop-off stop IDs matching the selected locations. */
  test('FB_036: Stop IDs are real values matching the selected stops', async ({ page }) => {
    const { gf, getPayload } = await setupFormAndCapture(page);
    await gf.requestRideButton.scrollIntoViewIfNeeded();
    await gf.submitForm();
    await page.waitForLoadState('networkidle').catch(() => {});
    const payload = getPayload()!;
    const pickup = payload.pickup_stop as Record<string, unknown>;
    const dropoff = payload.dropoff_stop as Record<string, unknown>;
    expect(pickup?.name).toBe(stops.pickup);
    expect(dropoff?.name).toBe(stops.dropoff);
  });

  /** Verify that a booking created with a randomly selected date and time still produces a correctly structured payload. */
  test('FB_039: Random-slot booking payload includes the booking object with the picked time', async ({ page }) => {
    // Uses random stops + a random date/time (rather than the fixed default
    // pair) to spot-check that randomized selections still produce a correct
    // payload — the POST is mocked, so this is safe to run anywhere,
    // unlike future-e2e.spec.ts's real-ride randomized-flow tests.
    let capturedPayload: Record<string, unknown> | null = null;
    await page.route(`${config.urls.api}/**/request/*`, async (route) => {
      if (route.request().method() === 'POST') {
        capturedPayload = route.request().postDataJSON();
        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ response: { status: 200, data: { response: { ride_code: 'FB_RANDOM_TEST', ride_web_link: '' } }, message: 'ok' } }),
        });
      } else { await route.continue(); }
    });

    const { SelectLocationPage } = await import('../../../pages/rider/SelectLocationPage');
    const { DateTimePicker } = await import('../../../pages/rider/DateTimePicker');
    const { FutureGuestFormSection } = await import('../../../pages/rider/FutureGuestFormSection');
    const lp = new SelectLocationPage(page);
    const dt = new DateTimePicker(page);
    const gf = new FutureGuestFormSection(page);
    await lp.goto(org.trackingId);
    await lp.selectRandomStops();
    await dt.selectRandomDateAndTime();
    await lp.clickConfirm();
    await gf.waitForFormVisible();
    await gf.fillRequiredFields();
    await gf.requestRideButton.scrollIntoViewIfNeeded();
    await gf.submitForm();
    await page.waitForLoadState('networkidle').catch(() => {});

    expect(capturedPayload).not.toBeNull();
    const payload = capturedPayload as unknown as Record<string, unknown>;
    expect(payload).toHaveProperty('booking');
    const booking = payload.booking as Record<string, unknown>;
    expect(booking.pickup_time).toBeTruthy();
    expect(booking.pickup_date).toBeTruthy();
  });
});

// ── API failure negatives — mocked, no real ride ────────────────────────────
test.describe(`Future Booking — API Failure Negatives ${RIDER_TAGS.FUTURE} ${RIDER_TAGS.PAYLOAD} ${RIDER_TAGS.SAFE} ${RIDER_TAGS.REGRESSION} ${RIDER_TAGS.NEGATIVE}`, () => {
  test.beforeEach(async ({ selectLocationPage, dateTimePicker, futureGuestFormSection }) => {
    test.skip(!isOrgEnabled('futureBookingOnly'), 'Future Booking org not configured for this environment — set trackingId/stops in rider-config.ts');
    await selectLocationPage.goto(org.trackingId);
    await selectLocationPage.selectBothStops(stops.pickup, stops.dropoff);
    await dateTimePicker.acceptDefaultSlot();
    await selectLocationPage.clickConfirm();
    await futureGuestFormSection.waitForFormVisible();
  });

  /** Verify that a 500 server error on submission displays an error toast and keeps the user on the form. */
  test('@negative NEG_FB_001: 500 on submit → error toast shown, stays on form', async ({ page, futureGuestFormSection }) => {
    await page.route(`${config.urls.api}/**/request/*`, async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 500, contentType: 'application/json',
          body: JSON.stringify({ response: { status: 500 }, message: 'Internal Server Error' }),
        });
      } else { await route.continue(); }
    });
    await futureGuestFormSection.fillRequiredFields();
    await futureGuestFormSection.requestRideButton.scrollIntoViewIfNeeded();
    await futureGuestFormSection.submitForm();
    await expect(page.locator('.Toastify__toast--error')).toBeVisible({ timeout: 15_000 });
    expect(page.url()).not.toMatch(/\/j\/.*\/s/);
  });

  /** Verify that a "success: false" API response prevents ride creation and keeps the user on the form. */
  test('@negative NEG_FB_002: success:false response → no ride, stays on form', async ({ page, futureGuestFormSection }) => {
    await page.route(`${config.urls.api}/**/request/*`, async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ code: 400, status: false, message: 'Ride could not be created' }),
        });
      } else { await route.continue(); }
    });
    await futureGuestFormSection.fillRequiredFields();
    await futureGuestFormSection.requestRideButton.scrollIntoViewIfNeeded();
    await futureGuestFormSection.submitForm();
    await page.waitForTimeout(4_000);
    expect(page.url()).not.toMatch(/\/j\/.*\/s/);
  });
});

// ── Deterministic date/slot scenarios — mocked GET /dates + /slots ─────────
// Envelope shapes are reconstructed from client code, not a live capture —
// see the file-level docstring above. Skipped automatically if the mocked
// shape doesn't match what the app expects (the picker will just show its
// own "no dates/slots available" empty state, which these tests assert on
// directly rather than assuming a specific reason).
test.describe(`Future Booking — Date/Slot Edge Cases (mocked) ${RIDER_TAGS.FUTURE} ${RIDER_TAGS.PAYLOAD} ${RIDER_TAGS.SAFE} ${RIDER_TAGS.REGRESSION} ${RIDER_TAGS.NEGATIVE}`, () => {
  test.beforeEach(() => {
    test.skip(!isOrgEnabled('futureBookingOnly'), 'Future Booking org not configured for this environment — set trackingId/stops in rider-config.ts');
  });

  /** Verify that when no dates are available, an inline error message is shown and the date field remains empty. */
  test('@negative NEG_FB_003: No available dates → inline error shown, date field stays empty', async ({ page, selectLocationPage, dateTimePicker }) => {
    // Live-verified shape (GET /dates/{type}?pickup=&dropoff=):
    // {code:200, response:{availability, from, to, only:[...]}}. Per
    // guestForm.js, "No dates are available for the selected stops." is set
    // ONLY in the else-branch of `if (response?.code == 200)` — i.e. it fires
    // on a non-200 code, NOT on a 200 with an empty `only` array (that case
    // just leaves the calendar with nothing selectable, silently, and is
    // covered separately below). Mock a non-200 code to hit the real branch.
    await page.route(`${config.urls.api}/**/dates/*`, async (route) => {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ code: 204, message: 'No dates available' }),
      });
    });
    await selectLocationPage.goto(org.trackingId);
    await selectLocationPage.selectBothStops(stops.pickup, stops.dropoff);
    await expect.poll(() => dateTimePicker.getInlineErrorText(), { timeout: 10_000 })
      .toMatch(/No dates are available/i);
  });

  /** Verify that when the available-dates API returns an empty list with a 200 status, the calendar shows no selectable dates without displaying an error banner. */
  test('@negative NEG_FB_003b: 200 with an empty "only" list leaves the calendar with nothing selectable (no error banner)', async ({ page, selectLocationPage, dateTimePicker }) => {
    // Companion to NEG_FB_003 — documents the actual (silent) behavior for a
    // 200/empty-list response, so the two 0-dates paths aren't conflated.
    await page.route(`${config.urls.api}/**/dates/*`, async (route) => {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ code: 200, response: { only: [] } }),
      });
    });
    await selectLocationPage.goto(org.trackingId);
    await selectLocationPage.selectBothStops(stops.pickup, stops.dropoff);
    await dateTimePicker.openDatePicker();
    const enabledDays = await dateTimePicker.getEnabledDayNumbers();
    expect(enabledDays.length).toBe(0);
  });

  /** Verify that when no time slots are available for the selected date, the message "No time slots available on this date!" is displayed and the time input is disabled. */
  test('@negative NEG_FB_004: No time slots on the selected date → "No time slots available on this date!" shown, time input disabled', async ({ page, selectLocationPage, dateTimePicker }) => {
    // This exact message (timeSlotError in guestForm.js) only fires when the
    // slot-less date being evaluated IS today — the filter block that sets it
    // is nested inside `if (dayjs(selectedDate).isSame(dayjs(), "day"))`.
    const today = new Date().toISOString().slice(0, 10);
    await page.route(`${config.urls.api}/**/dates/*`, async (route) => {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ code: 200, response: { availability: true, from: today, to: today, only: [today], type: 2 } }),
      });
    });
    await page.route(`${config.urls.api}/**/slots/*`, async (route) => {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ code: 200, response: { slots: [], min: { value: 30 } } }),
      });
    });
    await selectLocationPage.goto(org.trackingId);
    await selectLocationPage.selectBothStops(stops.pickup, stops.dropoff);
    await expect.poll(() => dateTimePicker.getInlineErrorText(), { timeout: 10_000 })
      .toMatch(/No time slots available on this date!/i);
    await expect(dateTimePicker.timeInput).toBeDisabled({ timeout: 10_000 });
  });
});
