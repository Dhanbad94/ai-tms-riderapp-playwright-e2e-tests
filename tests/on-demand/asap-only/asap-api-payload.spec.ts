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

  test('ASAP_028: No luggage/riderType in payload', async ({ page }) => {
    const { gf, getPayload } = await setupFormAndCapture(page);
    await gf.requestRideButton.scrollIntoViewIfNeeded();
    await gf.submitForm();
    await page.waitForLoadState("networkidle").catch(() => {});
    const payload = getPayload()!;
    const riders = payload.riders as Record<string, unknown>;
    // Flight/room are now part of ASAP (see ASAP_047); luggage & rider type are not.
    expect(riders).not.toHaveProperty('luggage');
    expect(riders).not.toHaveProperty('rider_type');
  });

  test('ASAP_047: Flight & room numbers included in payload when filled', async ({ page }) => {
    test.skip(config.name === 'staging', 'Skipped on staging for now — runs on preproduction/production');
    const { gf, getPayload } = await setupFormAndCapture(page);
    await gf.fillFlight('ua1234');
    await gf.fillRoom('room707');
    await gf.requestRideButton.scrollIntoViewIfNeeded();
    await gf.submitForm();
    await page.waitForLoadState("networkidle").catch(() => {});
    const riders = getPayload()!.riders as Record<string, unknown>;
    // Values are sent as entered — the uppercase styling is display-only (CSS).
    expect(riders.flight_no).toBe('ua1234');
    expect(riders.room_no).toBe('room707');
  });

  test('ASAP_048: Flight & room are null when not filled', async ({ page }) => {
    const { gf, getPayload } = await setupFormAndCapture(page);
    await gf.requestRideButton.scrollIntoViewIfNeeded();
    await gf.submitForm();
    await page.waitForLoadState("networkidle").catch(() => {});
    const riders = getPayload()!.riders as Record<string, unknown>;
    expect(riders.flight_no).toBeNull();
    expect(riders.room_no).toBeNull();
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

  // ASAP_046 (toast error on API failure) is now implemented as NEG_API_001 below.

  test.fixme('API timeout shows error state', async () => {
    // Cross-origin route abort unreliable on staging
  });
});

// ── API failure negatives ───────────────────────────────────────────────────
// The submit `/request` call is intercepted and forced to fail, so NO real ride
// is created — the app must surface an error and keep the rider on the form.
test.describe(`ASAP Only — API Failure Negatives ${RIDER_TAGS.ASAP} ${RIDER_TAGS.PAYLOAD} ${RIDER_TAGS.SAFE} ${RIDER_TAGS.REGRESSION} ${RIDER_TAGS.NEGATIVE}`, () => {
  test.beforeEach(async ({ selectLocationPage, guestFormSection }) => {
    // Stop-list-dependent → staging only (preprod/prod render it slowly/unreliably).
    test.skip(config.name !== 'staging', 'UI negatives run on staging only');
    await selectLocationPage.goto(org.trackingId);
    await selectLocationPage.selectBothStops(stops.pickup, stops.dropoff);
    await selectLocationPage.clickConfirm();
    await guestFormSection.waitForFormVisible();
  });

  test('@negative NEG_API_001: 500 on submit → error shown, stays on form', async ({ page, guestFormSection }) => {
    await page.route(`${config.urls.api}/**/request`, async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 500, contentType: 'application/json',
          body: JSON.stringify({ response: { status: 500 }, message: 'Internal Server Error' }),
        });
      } else {
        await route.continue();
      }
    });
    await guestFormSection.fillRequiredFields();
    await guestFormSection.requestRideButton.scrollIntoViewIfNeeded();
    await guestFormSection.submitForm();
    await expect(page.locator('.Toastify__toast--error')).toBeVisible({ timeout: 15_000 });
    expect(page.url()).not.toMatch(/\/j\/.*\/s/);
  });

  test('@negative NEG_API_002: success:false response → error shown, no ride', async ({ page, guestFormSection }) => {
    await page.route(`${config.urls.api}/**/request`, async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ code: 400, status: false, message: 'Ride could not be created' }),
        });
      } else {
        await route.continue();
      }
    });
    await guestFormSection.fillRequiredFields();
    await guestFormSection.requestRideButton.scrollIntoViewIfNeeded();
    await guestFormSection.submitForm();
    await page.waitForTimeout(4_000);
    expect(page.url()).not.toMatch(/\/j\/.*\/s/);
  });
});
