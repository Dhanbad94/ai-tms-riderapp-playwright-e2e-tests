import { test, expect } from '../../../fixtures/test-fixtures';
import { getOrgConfig, getRiderConfig } from '../../../utils/rider-config';
import { RIDER_TAGS } from '../../../constants';

const org = getOrgConfig('asapOnly');
const { stops } = org;
const config = getRiderConfig();

test.describe(`ASAP Only — API Payload Verification ${RIDER_TAGS.ASAP} ${RIDER_TAGS.PAYLOAD} ${RIDER_TAGS.REGRESSION} ${RIDER_TAGS.SAFE}`, () => {

  async function setupFormAndCapture(page: import('@playwright/test').Page) {
    let capturedPayload: Record<string, unknown> | null = null;
    let capturedUrl = '';

    await page.route(`${config.urls.api}/**/request`, async (route) => {
      if (route.request().method() === 'POST') {
        capturedPayload = route.request().postDataJSON();
        capturedUrl = route.request().url();
        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ response: { status: 200, data: { response: { ride_code: 'PAYLOAD_TEST', ride_web_link: '' } }, message: 'ok' } }),
        });
      } else { await route.continue(); }
    });

    const { SelectLocationPage } = await import('../../../pages/rider/SelectLocationPage');
    const { GuestFormSection } = await import('../../../pages/rider/GuestFormSection');
    const lp = new SelectLocationPage(page);
    const gf = new GuestFormSection(page);
    await lp.goto(org.trackingId);
    await lp.selectBothStops(stops.pickup, stops.dropoff);
    await lp.clickConfirm();
    await gf.waitForFormVisible();
    await gf.fillRequiredFields();

    return { gf, getPayload: () => capturedPayload, getUrl: () => capturedUrl };
  }

  test('@smoke @sanity ASAP_027: No booking object in payload', async ({ page }) => {
    const { gf, getPayload } = await setupFormAndCapture(page);
    await gf.requestRideButton.scrollIntoViewIfNeeded();
    await gf.submitForm();
    await page.waitForLoadState("networkidle").catch(() => {});
    expect(getPayload()).not.toBeNull();
    expect(getPayload()).not.toHaveProperty('booking');
  });

  test('ASAP_028: No flight/room/riderType in payload', async ({ page }) => {
    const { gf, getPayload } = await setupFormAndCapture(page);
    await gf.requestRideButton.scrollIntoViewIfNeeded();
    await gf.submitForm();
    await page.waitForLoadState("networkidle").catch(() => {});
    const payload = getPayload()!;
    const riders = payload.riders as Record<string, unknown>;
    expect(riders).not.toHaveProperty('flight_no');
    expect(riders).not.toHaveProperty('room_no');
    expect(riders).not.toHaveProperty('luggage');
    expect(riders).not.toHaveProperty('rider_type');
  });

  test('ASAP_029: Stop IDs are real values (not 0)', async ({ page }) => {
    const { gf, getPayload } = await setupFormAndCapture(page);
    await gf.requestRideButton.scrollIntoViewIfNeeded();
    await gf.submitForm();
    await page.waitForLoadState("networkidle").catch(() => {});
    const payload = getPayload()!;
    const pickup = payload.pickup_stop as Record<string, unknown>;
    const dropoff = payload.dropoff_stop as Record<string, unknown>;
    expect(pickup?.name).toBe(stops.pickup);
    expect(dropoff?.name).toBe(stops.dropoff);
    expect(pickup?.id).not.toBe(0);
    expect(dropoff?.id).not.toBe(0);
  });

  test('@smoke ASAP_030: API uses /rider/api/v1 endpoint', async ({ page }) => {
    const { gf, getUrl } = await setupFormAndCapture(page);
    await gf.requestRideButton.scrollIntoViewIfNeeded();
    await gf.submitForm();
    await page.waitForLoadState("networkidle").catch(() => {});
    expect(getUrl()).toContain('/rider/api/v1');
    expect(getUrl()).not.toContain('/rider/web/basic/v1');
  });

  test('ASAP_031: Submit uses /request (no type suffix)', async ({ page }) => {
    const { gf, getUrl } = await setupFormAndCapture(page);
    await gf.requestRideButton.scrollIntoViewIfNeeded();
    await gf.submitForm();
    await page.waitForLoadState("networkidle").catch(() => {});
    expect(getUrl()).toMatch(/\/request$/);
  });

  test('ASAP_044: Payload has correct rider details', async ({ page }) => {
    const { gf, getPayload } = await setupFormAndCapture(page);
    await gf.toggleSpecialAssistance();
    await gf.fillNotes('VIP guest');
    await gf.requestRideButton.scrollIntoViewIfNeeded();
    await gf.submitForm();
    await page.waitForLoadState("networkidle").catch(() => {});
    const payload = getPayload()!;
    const riders = payload.riders as Record<string, unknown>;
    expect(riders?.ada).toBe(true);
    expect(riders?.note).toBe('VIP guest');
  });

  test('Payload has pickup/dropoff coordinates', async ({ page }) => {
    const { gf, getPayload } = await setupFormAndCapture(page);
    await gf.requestRideButton.scrollIntoViewIfNeeded();
    await gf.submitForm();
    await page.waitForLoadState("networkidle").catch(() => {});
    const payload = getPayload()!;
    const pickup = payload.pickup_stop as Record<string, unknown>;
    const dropoff = payload.dropoff_stop as Record<string, unknown>;
    expect(pickup?.latitude).toBeDefined();
    expect(pickup?.longitude).toBeDefined();
    expect(dropoff?.latitude).toBeDefined();
    expect(dropoff?.longitude).toBeDefined();
  });

  test.fixme('ASAP_045: Loader appears during submission', async () => {
    // Cross-origin route delay unreliable on staging
  });

  test.fixme('ASAP_046: Toast error on API failure', async () => {
    // App uses global snackbar for API errors, not per-form toast
  });

  test.fixme('API timeout shows error state', async () => {
    // Cross-origin route abort unreliable on staging
  });
});
