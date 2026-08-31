import { test, expect } from '../../../fixtures/test-fixtures';
import { getRiderConfig, isOrgEnabled } from '../../../utils/rider-config';
import { RIDER_TAGS } from '../../../constants';

/**
 * Future Booking — Location Selection.
 *
 * Mirrors asap-location.spec.ts but asserts the OPPOSITE of several ASAP
 * expectations: the Pick-up Date & Time section renders, the CTA reads
 * "Next" (not "Confirm Location"), and the header includes "& Time" once
 * both stops are chosen — see src/components/web/selectLocation/
 * selectLocation.js: `future_booking && pickUpVal && dropOff && !showStopList
 * ? "Confirm Location & Time" : ...`.
 *
 * Gated on isOrgEnabled('futureBookingOnly') — configured as ODFB in
 * utils/rider-config.ts (verified live on staging 2026-08-20). Kept as a
 * skip guard (mirroring canCreateRides()) rather than removed, so this file
 * degrades gracefully if the org is ever disabled again.
 */
const rc = getRiderConfig();
const org = rc.orgs.futureBookingOnly;
const { stops } = org;

test.describe(`Future Booking — Location Selection ${RIDER_TAGS.FUTURE} ${RIDER_TAGS.UI_ONLY} ${RIDER_TAGS.REGRESSION} ${RIDER_TAGS.SAFE}`, () => {
  test.beforeEach(async ({ selectLocationPage }) => {
    test.skip(!isOrgEnabled('futureBookingOnly'), 'Future Booking org not configured for this environment — set trackingId/stops in rider-config.ts');
    await selectLocationPage.goto(org.trackingId);
  });

  /** Verify that the Pick-up Date & Time picker is displayed only after both pickup and drop-off locations are selected. */
  test('@smoke FB_001: Verify that the pickup date and time picker appears only after both pickup and drop-off stops are chosen', async ({ selectLocationPage }) => {
    // The Pick-up Date & Time section is part of the map/GuestForm view,
    // which only mounts after both pickup and dropoff are selected — it is
    // NOT present on the bare location page (see FB_002 below, which asserts
    // the opposite for that earlier state).
    await selectLocationPage.selectBothStops(stops.pickup, stops.dropoff);
    await selectLocationPage.verifyDateTimePickerPresent();
  });

  /** Verify that the page header displays "Select Location" (without "Time") before any stop is selected. */
  test('FB_002: Verify that the header reads "Select Location" without "Time" before any stop is chosen', async ({ selectLocationPage }) => {
    const text = await selectLocationPage.getHeaderText();
    expect(text).toContain('Select');
    expect(text).toContain('Location');
    expect(text).not.toContain('Time');
  });

  /** Verify that the page header updates to "Confirm Location & Time" once both pickup and drop-off stops are selected. */
  test('FB_003: Verify that the header updates to "Confirm Location & Time" after both stops are selected', async ({ selectLocationPage }) => {
    await selectLocationPage.selectBothStops(stops.pickup, stops.dropoff);
    const text = await selectLocationPage.getHeaderText();
    expect(text).toContain('Confirm');
    expect(text).toContain('Location');
    expect(text).toContain('Time');
  });

  /** Verify that the CTA button displays "Next" instead of "Confirm Location" once both stops are selected. */
  test('@smoke FB_004: Verify that the action button reads "Next" and not "Confirm Location" after both stops are selected', async ({ selectLocationPage }) => {
    await selectLocationPage.selectBothStops(stops.pickup, stops.dropoff);
    const text = await selectLocationPage.getConfirmButtonText();
    expect(text.toLowerCase()).toContain('next');
    expect(text.toLowerCase()).not.toContain('confirm location');
  });

  /** Verify that the "Use Current Location" quick-select option is visible on the Future Booking org. */
  test('FB_005: Verify that the "Use Current Location" quick action is visible on the Future Booking org', async ({ selectLocationPage }) => {
    // Reading selectLocation.js in isolation suggested this quick-select only
    // renders when !future_booking (`focusedInput !== "dropOff" && !pickUpVal
    // && !future_booking`). Live-verified against staging/ODFB on 2026-08-20:
    // it IS visible on this future-booking org before any stop is picked — so
    // either that reading was wrong, another condition in the render path
    // overrides it, or the deployed build differs from the source reviewed.
    // Asserting the observed behavior rather than the source-derived guess.
    await expect(selectLocationPage.useCurrentLocationBtn).toBeVisible({ timeout: 5_000 });
  });

  /** Verify that the "Get Available Dates" API is called once both pickup and drop-off stops are selected. */
  test('FB_006: Verify that the available dates request is sent once both stops are chosen', async ({ selectLocationPage, page }) => {
    let called = false;
    page.on('request', (r) => { if (r.url().includes('/dates/')) called = true; });
    await selectLocationPage.selectBothStops(stops.pickup, stops.dropoff);
    await expect.poll(() => called, { timeout: 10_000 }).toBe(true);
  });

  /** Verify that the "Get Available Slots" API is called after a date is auto-selected. */
  test('FB_007: Verify that the available slots request is sent after a date is auto-selected', async ({ selectLocationPage, page }) => {
    let called = false;
    page.on('request', (r) => { if (r.url().includes('/slots/')) called = true; });
    await selectLocationPage.selectBothStops(stops.pickup, stops.dropoff);
    await expect.poll(() => called, { timeout: 10_000 }).toBe(true);
  });

  /** Verify that the stop list loads and displays at least one available stop when the pickup field is clicked. */
  test('@smoke Verify that the pickup stop list loads and shows at least one available stop', async ({ selectLocationPage }) => {
    // ODFB's location page loads directly into the map view (unlike ODASAP,
    // which loads straight into the stop list) — the pickup field must be
    // clicked to open the stop-list panel before any h4 stop headings render.
    await selectLocationPage.pickupInput.click();
    const names = await selectLocationPage.getVisibleStopNames();
    expect(names.length).toBeGreaterThan(0);
  });

  /** Verify that selecting a pickup stop correctly populates the pickup input field. */
  test('Verify that selecting a pickup stop fills in the pickup field', async ({ selectLocationPage }) => {
    await selectLocationPage.selectPickupStop(stops.pickup);
    await expect(selectLocationPage.pickupInput).toHaveValue(stops.pickup);
  });

  /** Verify that the same location cannot be selected for both pickup and drop-off. */
  test('Verify that the same stop cannot be selected for both pickup and drop-off', async ({ selectLocationPage, page }) => {
    await selectLocationPage.selectPickupStop(stops.pickup);
    await selectLocationPage.dropoffInput.click();
    const sameInDropoff = page.getByRole('heading', { level: 4, name: stops.pickup });
    const isVisible = await sameInDropoff.isVisible();
    if (isVisible) {
      await sameInDropoff.first().click({ force: true });
      const toast = page.locator('.Toastify__toast');
      await expect(toast).toBeVisible({ timeout: 3000 });
    } else {
      expect(isVisible).toBe(false); // Filtered out — valid
    }
  });

  /** Verify that clicking the Back button displays a "Go Back?" confirmation dialog. */
  test('Verify that clicking Back opens the "Go Back?" confirmation dialog', async ({ selectLocationPage }) => {
    await selectLocationPage.selectPickupStop(stops.pickup);
    await selectLocationPage.clickBack();
    await expect(selectLocationPage.goBackDialogHeading).toBeVisible();
  });
});
