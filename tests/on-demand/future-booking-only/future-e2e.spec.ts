import { test, expect } from '../../../fixtures/test-fixtures';
import { getOrgConfig, getRiderConfig, canCreateRides, isOrgEnabled } from '../../../utils/rider-config';
import { RIDER_TAGS, RIDER_TIMEOUTS } from '../../../constants';
import { SelectLocationPage } from '../../../pages/rider/SelectLocationPage';
import { DateTimePicker } from '../../../pages/rider/DateTimePicker';
import { FutureGuestFormSection } from '../../../pages/rider/FutureGuestFormSection';

/**
 * Future Booking — End-to-End Flows with randomized inputs.
 *
 * Mirrors asap-e2e.spec.ts's "different stops each run" style, but goes
 * further: pickup/dropoff AND pickup date/time are all randomized per run
 * (via SelectLocationPage.selectRandomStops() and
 * DateTimePicker.selectRandomDateAndTime()), rather than always booking the
 * same fixed stop pair + auto-selected date. This both broadens real
 * coverage across the org's stop list and spreads booking load across more
 * dates — reducing how quickly any single date's seats get exhausted from
 * repeated automated runs (see DateTimePicker.ensureBookableSlot()).
 */
const rc = getRiderConfig();
const org = rc.orgs.futureBookingOnly;

test.describe(`Future Booking — End-to-End Flows (randomized) ${RIDER_TAGS.FUTURE} ${RIDER_TAGS.CREATES_RIDE} ${RIDER_TAGS.REGRESSION}`, () => {
  test.beforeEach(async () => {
    test.skip(!isOrgEnabled('futureBookingOnly'), 'Future Booking org not configured for this environment — set trackingId/stops in rider-config.ts');
    test.skip(!canCreateRides(), 'Ride creation disabled on this environment');
  });

  test.afterEach(async ({ page }) => {
    await page.waitForTimeout(RIDER_TIMEOUTS.RIDE_COOLDOWN);
  });

  /** Verify that a ride can be successfully booked using randomly selected pickup/drop-off locations and a randomly selected pickup date & time. */
  test('@sanity FB_037: Verify that a ride books with randomly selected pickup and drop-off stops and a random pickup date and time', async ({ page }) => {
    const cfg = getOrgConfig('futureBookingOnly');
    const lp = new SelectLocationPage(page);
    const dt = new DateTimePicker(page);
    const gf = new FutureGuestFormSection(page);

    await lp.goto(cfg.trackingId);
    const { pickup, dropoff } = await lp.selectRandomStops();
    expect(pickup).not.toBe(dropoff);

    const picked = await dt.selectRandomDateAndTime();
    expect(picked.day).toBeTruthy();

    await lp.clickConfirm();
    await gf.waitForFormVisible();
    await gf.fillRequiredFields();
    await gf.submitAndAwaitTracking();

    // Confirms the randomly-picked stops actually made it into the booking —
    // rider-details/pickup-dropoff summary card on the tracking screen.
    await expect(page.getByText(pickup).first()).toBeVisible({ timeout: RIDER_TIMEOUTS.CONFIRMATION });
    await expect(page.getByText(dropoff).first()).toBeVisible({ timeout: RIDER_TIMEOUTS.CONFIRMATION });
  });

  /** Verify that repeated randomized booking runs select different stops and times on each run. */
  test('FB_038: Verify that a repeated randomized run books with different stops and a different pickup time', async ({ page }) => {
    const cfg = getOrgConfig('futureBookingOnly');
    const lp = new SelectLocationPage(page);
    const dt = new DateTimePicker(page);
    const gf = new FutureGuestFormSection(page);

    await lp.goto(cfg.trackingId);
    const { pickup, dropoff } = await lp.selectRandomStops();
    const picked = await dt.selectRandomDateAndTime();

    await lp.clickConfirm();
    await gf.waitForFormVisible();
    const details = await gf.fillRequiredFields();
    await gf.submitAndAwaitTracking();

    expect(page.url()).toMatch(/\/j\/.*\/s/);
    expect(pickup).toBeTruthy();
    expect(dropoff).toBeTruthy();
    expect(picked.label).toBeTruthy();
    expect(details.riders).toBeGreaterThan(0);
  });
});
