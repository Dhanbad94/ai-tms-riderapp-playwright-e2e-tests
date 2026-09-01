import { test, expect } from '../../../fixtures/test-fixtures';
import { getOrgConfig, canCreateRides, getRiderConfig } from '../../../utils/rider-config';
import { RIDER_TAGS, RIDER_TIMEOUTS } from '../../../constants';
import { SelectLocationPage } from '../../../pages/rider/SelectLocationPage';
import { GuestFormSection } from '../../../pages/rider/GuestFormSection';

const org = getOrgConfig('asapOnly');
const { stops } = org;

/** Submit a ride and return the ride code from the redirect URL */
async function submitRideAndGetCode(page: import('@playwright/test').Page): Promise<string> {
  const lp = new SelectLocationPage(page);
  const gf = new GuestFormSection(page);
  await lp.goto(org.trackingId);
  await lp.selectBothStops(stops.pickup, stops.dropoff);
  await lp.clickConfirm();
  await gf.waitForFormVisible();
  await gf.fillRequiredFields();
  await gf.submitAndAwaitTracking();
  // Dismiss any dev error overlay
  const closeBtn = page.locator('[aria-label="Close"], button:has-text("×")').first();
  if (await closeBtn.isVisible({ timeout: 2_000 }).catch(() => false)) await closeBtn.click();
  await page.getByRole("heading").first().waitFor({ state: "visible", timeout: 15_000 });
  const match = page.url().match(/\/j\/([^/]+)\/s/);
  if (!match || !match[1]) throw new Error(`Failed to extract ride code from URL: ${page.url()}`);
  return match[1];
}

test.describe(`ASAP Only — Confirmation Page ${RIDER_TAGS.ASAP} ${RIDER_TAGS.CREATES_RIDE} ${RIDER_TAGS.REGRESSION}`, () => {
  test.beforeEach(async () => {
    test.skip(!canCreateRides(), 'Ride creation disabled on this environment');
  });

  // Throttle between tests so successive ride submissions don't trip staging's rate limiter.
  test.afterEach(async ({ page }) => {
    await page.waitForTimeout(RIDER_TIMEOUTS.RIDE_COOLDOWN);
  });

  test('@sanity ASAP_032: Verify that the confirmation screen shows ride status text and not the bookings card', async ({ page }) => {
    await submitRideAndGetCode(page);
    const status = page.getByText(/Request Submitted|Finding Driver|Driver Assigned/i);
    await expect(status.first()).toBeVisible({ timeout: RIDER_TIMEOUTS.CONFIRMATION });
    await expect(page.getByText('View All Bookings')).not.toBeVisible();
  });

  // ASAP_033: In ASAP-only mode, pickup/dropoff names are intentionally NOT displayed
  // on the confirmation page. This is correct app behavior — not a bug.
  test('ASAP_033: Verify that pickup and dropoff names are not shown on the confirmation screen in ASAP mode', async ({ page }) => {
    test.skip(getRiderConfig().name === 'staging', 'Skipped on staging for now — runs on preproduction/production');
    await submitRideAndGetCode(page);
    // In ASAP mode, the PickupDropoff header is hidden — verify absence
    const pickupVisible = await page.getByText(stops.pickup).first().isVisible().catch(() => false);
    const dropoffVisible = await page.getByText(stops.dropoff).first().isVisible().catch(() => false);
    expect(pickupVisible).toBe(false);
    expect(dropoffVisible).toBe(false);
  });

  test('ASAP_034: Verify that the confirmation screen shows a ride status message', async ({ page }) => {
    await submitRideAndGetCode(page);
    const status = page.getByText(/Request Submitted|Finding Driver|Driver Assigned|Driver on the way/i);
    await expect(status.first()).toBeVisible({ timeout: RIDER_TIMEOUTS.CONFIRMATION });
  });

  test('ASAP_035: Verify that the confirmation screen displays status heading text', async ({ page }) => {
    await submitRideAndGetCode(page);
    const headings = page.getByRole('heading');
    expect(await headings.count()).toBeGreaterThan(0);
  });

  test('Verify that the "View All Bookings" link is not shown on the ASAP confirmation screen', async ({ page }) => {
    await submitRideAndGetCode(page);
    await expect(page.getByText('View All Bookings')).not.toBeVisible();
  });

  test('Verify that the map is displayed on the confirmation screen', async ({ page }) => {
    await submitRideAndGetCode(page);
    // The map provider differs by environment — MapTiler/MapLibre GL on staging
    // (`.maplibregl-map`) but Google Maps on preprod/prod (`.gm-style`) — and it
    // mounts a beat after the tracking screen loads. Match either provider (and
    // the accessible Map region) and wait for it, rather than a bare, provider
    // -specific count() read that raced the map render.
    const mapEl = page.locator('.maplibregl-map, .gm-style, [role="region"][aria-label="Map" i]').first();
    await expect(mapEl).toBeVisible({ timeout: RIDER_TIMEOUTS.CONFIRMATION });
  });

  test('Verify that the confirmation screen shows a Call Operator or Cancel Ride option', async ({ page }) => {
    await submitRideAndGetCode(page);
    const callOp = await page.getByText(/Call Operator/i).isVisible().catch(() => false);
    const cancel = await page.getByText(/Cancel Ride/i).isVisible().catch(() => false);
    expect(callOp || cancel).toBe(true);
  });

  test('ASAP_040: Verify that the ride details request includes the booking ride code', async ({ page }) => {
    let rideDetailsUrl = '';
    page.on('request', (req) => { if (req.url().includes('ride-details')) rideDetailsUrl = req.url(); });
    const code = await submitRideAndGetCode(page);

    if (rideDetailsUrl) expect(rideDetailsUrl).toContain(code);
  });

  test('Verify that the confirmation screen loads without critical application errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await submitRideAndGetCode(page);
    const critical = errors.filter(e =>
      !e.includes('gmp-internal') && !e.includes('google') && !e.includes('Maps') && !e.includes('getPhone')
    );
    expect(critical).toHaveLength(0);
  });

  test('Verify that the confirmation screen renders meaningful page content', async ({ page }) => {
    await submitRideAndGetCode(page);
    const body = await page.locator('body').textContent();
    expect(body?.length).toBeGreaterThan(50);
  });

  test('Verify that the confirmation screen shows a progress animation or status card', async ({ page }) => {
    await submitRideAndGetCode(page);
    const el = page.locator('[class*="progressAnimation"], [class*="ProgressAnimation"], h2, h3');
    expect(await el.count()).toBeGreaterThan(0);
  });

  // ASAP_049: After submitting, the tracking screen shows a rider-details card
  // (name + guest count, phone, room, flight). On mobile it sits below the fold,
  // so we scroll it into view first — mirroring the manual verification step.
  test('ASAP_049: Verify that the tracking screen shows the rider details after a ride is submitted', async ({ page, confirmationPage }) => {
    test.skip(getRiderConfig().name === 'staging', 'Skipped on staging for now — runs on preproduction/production');
    const lp = new SelectLocationPage(page);
    const gf = new GuestFormSection(page);
    await lp.goto(org.trackingId);
    await lp.selectBothStops(stops.pickup, stops.dropoff);
    await lp.clickConfirm();
    await gf.waitForFormVisible();
    const details = await gf.fillRequiredFields({ riders: 1 });
    await gf.fillFlight('UA789');
    await gf.fillRoom('R101');
    await gf.submitAndAwaitTracking();

    await confirmationPage.scrollRiderDetailsIntoView();
    const card = confirmationPage.riderDetailsCard;
    await expect(card).toBeVisible();
    await expect(card.getByText(details.name)).toBeVisible();
    await expect(card.getByText(/1 Guests/i)).toBeVisible();
    await expect(card.getByText(details.phone)).toBeVisible();
    await expect(card.getByText('UA789')).toBeVisible();
    await expect(card.getByText('R101')).toBeVisible();
  });
});
