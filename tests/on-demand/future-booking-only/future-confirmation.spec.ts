import { test, expect } from '../../../fixtures/test-fixtures';
import { getOrgConfig, getRiderConfig, canCreateRides, isOrgEnabled } from '../../../utils/rider-config';
import { RIDER_TAGS, RIDER_TIMEOUTS } from '../../../constants';
import { SelectLocationPage } from '../../../pages/rider/SelectLocationPage';
import { DateTimePicker } from '../../../pages/rider/DateTimePicker';
import { FutureGuestFormSection } from '../../../pages/rider/FutureGuestFormSection';

const rc = getRiderConfig();
const org = rc.orgs.futureBookingOnly;
const { stops } = org;

/** Submit a Future Booking ride and return the ride code from the redirect URL. */
async function submitFutureRideAndGetCode(page: import('@playwright/test').Page): Promise<string> {
  // getOrgConfig() (throwing variant) is safe to call here — every test in
  // this describe block already skips via isOrgEnabled() in beforeEach.
  const cfg = getOrgConfig('futureBookingOnly');
  const lp = new SelectLocationPage(page);
  const dt = new DateTimePicker(page);
  const gf = new FutureGuestFormSection(page);

  await lp.goto(cfg.trackingId);
  await lp.selectBothStops(cfg.stops.pickup, cfg.stops.dropoff);
  await dt.acceptDefaultSlot();
  await lp.clickConfirm();
  await gf.waitForFormVisible();
  await gf.fillRequiredFields();
  await gf.submitAndAwaitTracking();

  const closeBtn = page.locator('[aria-label="Close"], button:has-text("×")').first();
  if (await closeBtn.isVisible({ timeout: 2_000 }).catch(() => false)) await closeBtn.click();
  await page.getByRole('heading').first().waitFor({ state: 'visible', timeout: 15_000 });

  const match = page.url().match(/\/j\/([^/]+)\/s/);
  if (!match || !match[1]) throw new Error(`Failed to extract ride code from URL: ${page.url()}`);
  return match[1];
}

// RIDE-VOLUME REDUCTION: the pure-view tests (status text, live map, action
// buttons) only read an active ride's tracking screen, so they reuse ONE shared
// ride instead of each creating their own. FB_028 needs its own ride (it checks
// the specific rider details it entered) and the JS-error test must observe a
// live submission, so those two keep creating their own.
let sharedTrackingUrl = '';

test.describe(`Future Booking — Confirmation Page ${RIDER_TAGS.FUTURE} ${RIDER_TAGS.CREATES_RIDE} ${RIDER_TAGS.REGRESSION}`, () => {
  test.beforeAll(async ({ browser }) => {
    if (!isOrgEnabled('futureBookingOnly') || !canCreateRides()) return;
    const page = await browser.newPage();
    try {
      const code = await submitFutureRideAndGetCode(page);
      sharedTrackingUrl = `${rc.urls.ride}/j/${code}/s`;
    } finally {
      await page.close();
    }
  });

  test.beforeEach(async () => {
    test.skip(!isOrgEnabled('futureBookingOnly'), 'Future Booking org not configured for this environment — set trackingId/stops in rider-config.ts');
    test.skip(!canCreateRides(), 'Ride creation disabled on this environment');
  });

  // Throttle between tests so successive ride submissions don't trip staging's rate limiter.
  test.afterEach(async ({ page }) => {
    await page.waitForTimeout(RIDER_TIMEOUTS.RIDE_COOLDOWN);
  });

  /** Verify that the booking status text (e.g. "Scheduled for {date, time}") is displayed after successfully submitting a Future Booking ride. */
  test('@sanity FB_025: Verify that the booking status text is shown after submitting a future booking', async ({ page }) => {
    await page.goto(sharedTrackingUrl, { waitUntil: 'domcontentloaded' });
    // Live-verified on staging/ODFB: the future-booking status heading reads
    // "Scheduled for {Month Day, h:mm AM/PM TZ}" — distinct from ASAP's
    // "Request Submitted"/"Finding Driver" copy, since the ride isn't being
    // dispatched immediately. Keep the ASAP-style phrases as a tolerant
    // fallback in case status text varies once a driver is later assigned.
    const status = page.getByText(/Scheduled for|Request Submitted|Finding Driver|Driver Assigned|Booked/i);
    await expect(status.first()).toBeVisible({ timeout: RIDER_TIMEOUTS.CONFIRMATION });
  });

  /** Verify that the live map is displayed on the tracking/confirmation screen. */
  test('FB_026: Verify that the live map is shown on the tracking screen', async ({ page }) => {
    await page.goto(sharedTrackingUrl, { waitUntil: 'domcontentloaded' });
    // The Future Booking tracking screen renders a MapTiler/OpenStreetMap
    // embed (attribution links confirmed live), not Google Maps — so ASAP's
    // `.gm-style` class (see ConfirmationPage.mapContainer) doesn't apply
    // here. The map region carries a stable `role="region" name="Map"`
    // regardless of provider, which is what's asserted on instead.
    const mapEl = page.getByRole('region', { name: 'Map' });
    await expect(mapEl.first()).toBeVisible({ timeout: RIDER_TIMEOUTS.CONFIRMATION });
  });

  /** Verify that either the "Call Operator" or "Cancel Ride" action is visible after booking. */
  test('FB_027: Verify that a Call Operator or Cancel Ride action is shown after booking', async ({ page }) => {
    await page.goto(sharedTrackingUrl, { waitUntil: 'domcontentloaded' });
    const callOp = await page.getByText(/Call Operator/i).isVisible().catch(() => false);
    const cancel = await page.getByText(/Cancel Ride/i).isVisible().catch(() => false);
    expect(callOp || cancel).toBe(true);
  });

  /** Verify that the rider's submitted name and phone number are correctly displayed on the tracking screen. */
  test('FB_028: Verify that the submitted rider name and phone number are shown on the tracking screen', async ({ page, confirmationPage }) => {
    const cfg = getOrgConfig('futureBookingOnly');
    const lp = new SelectLocationPage(page);
    const dt = new DateTimePicker(page);
    const gf = new FutureGuestFormSection(page);
    await lp.goto(cfg.trackingId);
    await lp.selectBothStops(cfg.stops.pickup, cfg.stops.dropoff);
    await dt.acceptDefaultSlot();
    await lp.clickConfirm();
    await gf.waitForFormVisible();
    const details = await gf.fillRequiredFields({ riders: 1 });
    await gf.submitAndAwaitTracking();

    await confirmationPage.scrollRiderDetailsIntoView();
    const card = confirmationPage.riderDetailsCard;
    await expect(card).toBeVisible();
    await expect(card.getByText(details.name)).toBeVisible();
    await expect(card.getByText(details.phone)).toBeVisible();
  });

  /** Verify that no critical JavaScript errors occur during a Future Booking submission. */
  test('Verify that no critical JavaScript errors occur during a future booking submission', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await submitFutureRideAndGetCode(page);
    const critical = errors.filter(e =>
      !e.includes('gmp-internal') && !e.includes('google') && !e.includes('Maps') && !e.includes('getPhone')
    );
    expect(critical).toHaveLength(0);
  });
});
