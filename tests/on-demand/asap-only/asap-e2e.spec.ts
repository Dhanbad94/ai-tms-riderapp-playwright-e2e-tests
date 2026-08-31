import { test, expect } from '../../../fixtures/test-fixtures';
import { getOrgConfig, canCreateRides, getRiderConfig } from '../../../utils/rider-config';
import { RIDER_TAGS, RIDER_TIMEOUTS } from '../../../constants';

const org = getOrgConfig('asapOnly');
const config = getRiderConfig();
const { stops } = org;

test.describe(`ASAP Only — End-to-End Flows ${RIDER_TAGS.ASAP} ${RIDER_TAGS.CREATES_RIDE} ${RIDER_TAGS.REGRESSION}`, () => {
  test.beforeEach(async () => {
    test.skip(!canCreateRides(), 'Ride creation disabled on this environment');
  });

  // Throttle between tests so successive ride submissions don't trip staging's rate limiter.
  test.afterEach(async ({ page }) => {
    await page.waitForTimeout(RIDER_TIMEOUTS.RIDE_COOLDOWN);
  });

  test('@sanity ASAP_047: Verify that a rider can complete the full on-demand booking flow from location to confirmation', async ({ page, selectLocationPage, guestFormSection }) => {
    test.skip(getRiderConfig().name === 'staging', 'Skipped on staging for now — runs on preproduction/production');
    await selectLocationPage.goto(org.trackingId);
    await selectLocationPage.verifyDateTimePickerAbsent();
    await selectLocationPage.selectBothStops(stops.pickup, stops.dropoff);
    const btnText = await selectLocationPage.getConfirmButtonText();
    expect(btnText.toLowerCase()).toContain('confirm location');
    await selectLocationPage.clickConfirm();
    await guestFormSection.waitForFormVisible();
    await guestFormSection.verifyAsapFormState();
    await guestFormSection.fillRequiredFields({ name: 'E2E Happy Path' });
    await guestFormSection.requestRideButton.scrollIntoViewIfNeeded();
    await guestFormSection.submitForm();
    await page.waitForURL(/\/j\/.*\/s/, { timeout: RIDER_TIMEOUTS.RIDE_SUBMIT });
    expect(page.url()).toMatch(/\/j\/[A-Za-z0-9_]+\/s/);
    await page.getByRole("heading").first().waitFor({ state: "visible", timeout: 15_000 });
    const status = page.getByText(/Request Submitted|Finding Driver|Driver Assigned/i);
    await expect(status.first()).toBeVisible({ timeout: RIDER_TIMEOUTS.CONFIRMATION });
  });

  test('Verify that a rider can book a ride filling only the required fields', async ({ page, selectLocationPage, guestFormSection }) => {
    await selectLocationPage.goto(org.trackingId);
    await selectLocationPage.selectBothStops(stops.pickup, stops.dropoff);
    await selectLocationPage.clickConfirm();
    await guestFormSection.waitForFormVisible();
    await guestFormSection.fillRequiredFields({ name: 'Minimal User' });
    await guestFormSection.requestRideButton.scrollIntoViewIfNeeded();
    await guestFormSection.submitForm();
    await page.waitForURL(/\/j\/.*\/s/, { timeout: RIDER_TIMEOUTS.RIDE_SUBMIT });
    expect(page.url()).toMatch(/\/j\/[A-Za-z0-9_]+\/s/);
  });

  test('Verify that a rider can book a ride after filling every optional field as well', async ({ page, selectLocationPage, guestFormSection }) => {
    await selectLocationPage.goto(org.trackingId);
    await selectLocationPage.selectBothStops(stops.pickup, stops.dropoff);
    await selectLocationPage.clickConfirm();
    await guestFormSection.waitForFormVisible();
    await guestFormSection.fillRequiredFields({ name: 'Full Detail User' });
    await guestFormSection.toggleSpecialAssistance();
    await guestFormSection.fillNotes('E2E all fields');
    await guestFormSection.requestRideButton.scrollIntoViewIfNeeded();
    await guestFormSection.submitForm();
    await page.waitForURL(/\/j\/.*\/s/, { timeout: RIDER_TIMEOUTS.RIDE_SUBMIT });
  });

  test('Verify that an on-demand booking request contains no scheduled-booking data', async ({ page, selectLocationPage, guestFormSection }) => {
    let payload: Record<string, unknown> | null = null;
    await page.route(`${config.urls.api}/**/request`, async (route) => {
      if (route.request().method() === 'POST') payload = route.request().postDataJSON();
      await route.continue();
    });
    await selectLocationPage.goto(org.trackingId);
    await selectLocationPage.selectBothStops(stops.pickup, stops.dropoff);
    await selectLocationPage.clickConfirm();
    await guestFormSection.waitForFormVisible();
    await guestFormSection.fillRequiredFields({ name: 'No Future Data' });
    await guestFormSection.requestRideButton.scrollIntoViewIfNeeded();
    await guestFormSection.submitForm();
    await page.waitForURL(/\/j\/.*\/s/, { timeout: RIDER_TIMEOUTS.RIDE_SUBMIT });
    expect(payload).not.toBeNull();
    expect(payload!).not.toHaveProperty('booking');
  });

  test('Verify that a rider can complete a booking using an alternate pickup and dropoff', async ({ page, selectLocationPage, guestFormSection }) => {
    await selectLocationPage.goto(org.trackingId);
    await selectLocationPage.selectBothStops(stops.altPickup, stops.altDropoff);
    await selectLocationPage.clickConfirm();
    await guestFormSection.waitForFormVisible();
    await guestFormSection.fillRequiredFields({ name: 'Diff Stops' });
    await guestFormSection.requestRideButton.scrollIntoViewIfNeeded();
    await guestFormSection.submitForm();
    await page.waitForURL(/\/j\/.*\/s/, { timeout: RIDER_TIMEOUTS.RIDE_SUBMIT });
    expect(page.url()).toMatch(/\/j\/[A-Za-z0-9_]+\/s/);
  });

  test('Verify that no scheduled-booking date or time controls appear anywhere in on-demand mode', async ({ page, selectLocationPage, guestFormSection }) => {
    await selectLocationPage.goto(org.trackingId);
    await expect(page.getByText('Pick-up Date & Time')).not.toBeVisible();
    await expect(page.getByPlaceholder('Pick-up Date')).not.toBeVisible();
    await expect(page.getByPlaceholder('Pick-up Time')).not.toBeVisible();
    await selectLocationPage.selectBothStops(stops.pickup, stops.dropoff);
    const btnText = await selectLocationPage.getConfirmButtonText();
    expect(btnText.toLowerCase()).toContain('confirm location');
    await selectLocationPage.clickConfirm();
    await guestFormSection.waitForFormVisible();
    await guestFormSection.verifyAsapFormState();
  });

  test.fixme('Verify that a booking request failure keeps the rider on the form', async () => {
    // App navigates away on API error instead of staying
  });

  test.fixme('Verify that a booking request timeout keeps the rider on the form', async () => {
    // Cross-origin route abort unreliable on staging
  });

  test.fixme('ASAP_043: Verify that saved guest details are restored from cookies on a return visit', async () => {
    // Cookie path scoping prevents cross-visit restoration
  });

  test.fixme('ASAP_044: Verify that the saved sign-in is cleared when the rider changes their phone number', async () => {
    // localStorage state unreliable across cross-origin staging navigation
  });
});
