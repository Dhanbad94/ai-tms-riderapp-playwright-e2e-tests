import { test, expect } from '../../../fixtures/test-fixtures';
import { getOrgConfig, getRiderConfig } from '../../../utils/rider-config';
import { RIDER_TAGS, RIDER_TIMEOUTS } from '../../../constants';

const org = getOrgConfig('asapOnly');
const { stops } = org;
const rc = getRiderConfig();

test.describe(`ASAP Only — Location Selection ${RIDER_TAGS.ASAP} ${RIDER_TAGS.UI_ONLY} ${RIDER_TAGS.REGRESSION} ${RIDER_TAGS.SAFE}`, () => {
  test.beforeEach(async ({ selectLocationPage }) => {
    await selectLocationPage.goto(org.trackingId);
  });

  test('@smoke @sanity @prod ASAP_001: Verify that no date or time picker is shown in the ASAP booking flow', async ({ selectLocationPage }) => {
    await selectLocationPage.verifyDateTimePickerAbsent();
  });

  test('ASAP_005: Verify that the header reads Select Location before any stops are chosen', async ({ selectLocationPage }) => {
    const text = await selectLocationPage.getHeaderText();
    expect(text).toContain('Select');
    expect(text).toContain('Location');
    expect(text).not.toContain('Time');
  });

  test('ASAP_006: Verify that the header reads Confirm Location after both stops are selected', async ({ selectLocationPage }) => {
    await selectLocationPage.selectBothStops(stops.pickup, stops.dropoff);
    const text = await selectLocationPage.getHeaderText();
    expect(text).toContain('Confirm');
    expect(text).toContain('Location');
    expect(text).not.toContain('Time');
  });

  test('@smoke ASAP_002: Verify that the action button reads Confirm Location and not Next', async ({ selectLocationPage }) => {
    await selectLocationPage.selectBothStops(stops.pickup, stops.dropoff);
    const text = await selectLocationPage.getConfirmButtonText();
    expect(text.toLowerCase()).toContain('confirm location');
    expect(text.toLowerCase()).not.toContain('next');
  });

  test('ASAP_003: Verify that the Confirm Location button is enabled once both stops are chosen without needing a time', async ({ selectLocationPage, page }) => {
    await selectLocationPage.selectBothStops(stops.pickup, stops.dropoff);
    // If riders dropdown inline, select 1 rider first
    const ridersDD = page.locator('#demo-simple-select');
    if (await ridersDD.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await ridersDD.scrollIntoViewIfNeeded();
      await ridersDD.evaluate((el: Element) => el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
      await page.getByRole('option').first().click();
    }
    await expect(page.getByRole('button', { name: /confirm location/i })).toBeEnabled({ timeout: 10_000 });
  });

  test('@smoke ASAP_004: Verify that the Use Current Location button is visible on the location screen', async ({ selectLocationPage }) => {
    const isVisible = await selectLocationPage.useCurrentLocationBtn.isVisible();
    expect(isVisible).toBe(true);
  });

  test('ASAP_007: Verify that no available-dates lookup is triggered during ASAP stop selection', async ({ selectLocationPage, page }) => {
    let called = false;
    page.on('request', (r) => { if (r.url().includes('/dates/')) called = true; });
    await selectLocationPage.selectBothStops(stops.pickup, stops.dropoff);
    expect(called).toBe(false);
  });

  test('ASAP_008: Verify that no available-time-slots lookup is triggered during ASAP stop selection', async ({ selectLocationPage, page }) => {
    let called = false;
    page.on('request', (r) => { if (r.url().includes('/slots/')) called = true; });
    await selectLocationPage.selectBothStops(stops.pickup, stops.dropoff);
    expect(called).toBe(false);
  });

  test('Verify that a riders selection dropdown is available somewhere in the booking flow', async ({ selectLocationPage, page }) => {
    await selectLocationPage.selectBothStops(stops.pickup, stops.dropoff);
    const ridersCombo = await page.locator('#demo-simple-select').isVisible().catch(() => false);
    const ridersLabel = await page.getByText(/Rider/i).first().isVisible().catch(() => false);
    if (ridersCombo || ridersLabel) {
      expect(true).toBe(true);
    } else {
      await selectLocationPage.clickConfirm();
      await page.waitForLoadState('domcontentloaded');
      const onForm = await page.locator('#demo-simple-select').isVisible().catch(() => false);
      const labelOnForm = await page.getByText(/Rider/i).first().isVisible().catch(() => false);
      expect(onForm || labelOnForm).toBe(true);
    }
  });

  test('@smoke Verify that the stop list loads and displays available stops', async ({ selectLocationPage }) => {
    // The screen defaults to the map view now — open the stop list first.
    await selectLocationPage.showStopList();
    const names = await selectLocationPage.getVisibleStopNames();
    expect(names.length).toBeGreaterThan(0);
  });

  test('@smoke @sanity Verify that selecting a pickup stop fills the pickup field with that stop', async ({ selectLocationPage }) => {
    await selectLocationPage.selectPickupStop(stops.pickup);
    await selectLocationPage.expectStopInputValue(selectLocationPage.pickupInput, stops.pickup);
  });

  test('Verify that selecting a dropoff stop fills the dropoff field with that stop', async ({ selectLocationPage }) => {
    await selectLocationPage.selectPickupStop(stops.pickup);
    await selectLocationPage.selectDropoffStop(stops.dropoff);
    await selectLocationPage.expectStopInputValue(selectLocationPage.dropoffInput, stops.dropoff);
  });

  test('Verify that the same stop cannot be used for both pickup and dropoff', async ({ selectLocationPage, page }) => {
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

  test('Verify that typing in the stop search narrows the list to matching stops', async ({ selectLocationPage, page }) => {
    await selectLocationPage.pickupInput.click();
    await selectLocationPage.pickupInput.fill(stops.searchKeyword);
    await page.getByRole('heading', { level: 4, name: new RegExp(stops.searchKeyword) }).first()
      .waitFor({ timeout: 5_000 });
    const match = page.getByRole('heading', { level: 4, name: new RegExp(stops.searchKeyword) });
    await expect(match.first()).toBeVisible();
  });

  test('Verify that a stop search with no matches shows a not-found message', async ({ selectLocationPage }) => {
    await selectLocationPage.pickupInput.click();
    await selectLocationPage.pickupInput.fill('zzz_nonexistent_stop');
    await expect(selectLocationPage.notFoundMessage).toBeVisible({ timeout: RIDER_TIMEOUTS.STOP_LIST });
  });

  test('Verify that clearing the pickup field resets the pickup selection', async ({ selectLocationPage }) => {
    await selectLocationPage.selectPickupStop(stops.pickup);
    const clearIcon = selectLocationPage.page.locator('img[alt="clear"]').first();
    if (await clearIcon.isVisible()) await clearIcon.click();
    await expect(selectLocationPage.pickupInput).toHaveValue('');
  });

  test('Verify that the map and list view toggle is visible on the location screen', async ({ selectLocationPage }) => {
    // Screen defaults to map view ("View Stop List" toggle); either label
    // satisfies the toggle's presence.
    await expect(selectLocationPage.mapListToggle).toBeVisible();
  });

  test('Verify that pressing back after selecting a stop opens a confirmation dialog', async ({ selectLocationPage }) => {
    await selectLocationPage.selectPickupStop(stops.pickup);
    await selectLocationPage.clickBack();
    await expect(selectLocationPage.goBackDialogHeading).toBeVisible();
  });

  test('Verify that cancelling the back confirmation dialog keeps the rider on the location screen', async ({ selectLocationPage }) => {
    await selectLocationPage.selectPickupStop(stops.pickup);
    await selectLocationPage.clickBack();
    await selectLocationPage.cancelGoBack();
    await expect(selectLocationPage.pickupInput).toBeVisible();
  });

});

// ── Location negatives — STAGING-ONLY ───────────────────────────────────────
// Depend on stop-list rendering, which is slow/unreliable on preprod/prod, so
// they're scoped to staging and not tagged @ui-only (prod cron won't collect).
test.describe(`ASAP Only — Location Negatives ${RIDER_TAGS.ASAP} ${RIDER_TAGS.SAFE} ${RIDER_TAGS.REGRESSION} ${RIDER_TAGS.NEGATIVE}`, () => {
  test.beforeEach(async ({ selectLocationPage }) => {
    test.skip(getRiderConfig().name !== 'staging', 'UI negatives run on staging only (preprod/prod stop-list is slow/unreliable)');
    await selectLocationPage.goto(org.trackingId);
  });

  test('@negative NEG_LOC_001: Verify that the chosen pickup stop is excluded from the dropoff stop list', async ({ selectLocationPage }) => {
    await selectLocationPage.pickupInput.click();
    const pickupStops = await selectLocationPage.getVisibleStopNames();
    expect(pickupStops.length).toBeGreaterThan(1);
    const chosen = pickupStops[0]!;
    await selectLocationPage.selectPickupStop(chosen);

    await selectLocationPage.dropoffInput.click();
    const dropoffStops = await selectLocationPage.getVisibleStopNames();
    expect(dropoffStops).not.toContain(chosen); // can't drop off at the same stop
  });

  test('@negative NEG_LOC_002: Verify that the rider cannot reach the booking form without selecting both stops', async ({ selectLocationPage, guestFormSection }) => {
    // With only the pickup selected, the Confirm CTA is not offered …
    await selectLocationPage.selectPickupStop(stops.pickup);
    await expect(selectLocationPage.confirmButton).not.toBeVisible({ timeout: 5_000 });
    // … and the guest form never opens.
    await expect(guestFormSection.formTitle).not.toBeVisible();
  });

  test('@negative NEG_LOC_003: Verify that searching stops with junk characters shows the not-found state', async ({ selectLocationPage }) => {
    await selectLocationPage.searchPickupStops('!@#$%^&*()_zzzq');
    await expect(selectLocationPage.notFoundMessage).toBeVisible({ timeout: RIDER_TIMEOUTS.STOP_LIST });
  });
});

// ── Bad-route / navigation negatives (no stop-selection setup) ──────────────
test.describe(`ASAP Only — Navigation Negatives ${RIDER_TAGS.ASAP} ${RIDER_TAGS.UI_ONLY} ${RIDER_TAGS.SAFE} ${RIDER_TAGS.REGRESSION} ${RIDER_TAGS.NEGATIVE}`, () => {

  test('@negative NEG_NAV_001: Verify that visiting an unknown app route shows a 404 page-not-found screen', async ({ page }) => {
    await page.goto(`${rc.urls.ride}/this-route-does-not-exist-xyz`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/This page could not be found|404/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('@negative NEG_NAV_002: Verify that opening a nonexistent booking id shows a 404 page-not-found screen', async ({ page }) => {
    await page.goto(`${rc.urls.ride}/b/ZZZZZZ`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/This page could not be found|404/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('@negative NEG_NAV_003: Verify that an invalid ride code does not display a working ride status page', async ({ page }) => {
    await page.goto(`${rc.urls.ride}/j/ZZZZZZ/s`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(6_000);
    await expect(page.getByText('Request Submitted')).toHaveCount(0);
    await expect(page.getByText(/Cancel Ride/i)).toHaveCount(0);
    await expect(page.getByText('Driver Assigned')).toHaveCount(0);
  });
});
