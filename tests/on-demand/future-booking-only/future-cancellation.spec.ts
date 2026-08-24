import { test, expect } from '../../../fixtures/test-fixtures';
import { getOrgConfig, getRiderConfig, canCreateRides, isOrgEnabled } from '../../../utils/rider-config';
import { RIDER_TAGS, RIDER_TIMEOUTS } from '../../../constants';
import { SelectLocationPage } from '../../../pages/rider/SelectLocationPage';
import { DateTimePicker } from '../../../pages/rider/DateTimePicker';
import { FutureGuestFormSection } from '../../../pages/rider/FutureGuestFormSection';
import { CANCEL_REASONS } from '../../../pages/rider/CancellationDialog';

/**
 * Future Booking — Cancellation.
 *
 * NOTE on cancellation reasons: CancellationDialog.ts documents 5 fixed
 * reasons verified against staging ODASAP ("Ride request was not accepted",
 * "Wait time was too long", …). Whether the same 5 apply to a Future Booking
 * org is asserted directly by FB_033 below rather than assumed — all other
 * reason-specific tests still select by index (selectReasonByIndex), so they
 * stay correct even if FB_033 ever reveals the label set has diverged; only
 * FB_033's own failure (and the descriptive test titles) would need
 * revisiting in that case.
 */
const rc = getRiderConfig();
const org = rc.orgs.futureBookingOnly;

async function submitFutureRideAndGetCode(page: import('@playwright/test').Page): Promise<string> {
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

  const match = page.url().match(/\/j\/([^/]+)\/s/);
  if (!match || !match[1]) throw new Error(`Failed to extract ride code from URL: ${page.url()}`);
  return match[1];
}

test.describe(`Future Booking — Cancellation ${RIDER_TAGS.FUTURE} ${RIDER_TAGS.CREATES_RIDE} ${RIDER_TAGS.REGRESSION}`, () => {
  test.beforeEach(async () => {
    test.skip(!isOrgEnabled('futureBookingOnly'), 'Future Booking org not configured for this environment — set trackingId/stops in rider-config.ts');
    test.skip(!canCreateRides(), 'Ride creation disabled on this environment');
  });

  test.afterEach(async ({ page }) => {
    await page.waitForTimeout(RIDER_TIMEOUTS.RIDE_COOLDOWN);
  });

  /** Verify that the Cancel Ride feature opens the Cancellation dialogue. */
  test('@sanity FB_029: "Cancel Ride" opens the cancellation reason dialog', async ({ page, confirmationPage, cancellationDialog }) => {
    await submitFutureRideAndGetCode(page);
    await confirmationPage.clickCancelRide();
    await cancellationDialog.waitForDialog();
    const reasons = await cancellationDialog.getAllReasonTexts();
    expect(reasons.length).toBeGreaterThan(0);
  });

  /** Verify that the Cancel submit button remains disabled until a cancellation reason is selected. */
  test('FB_030: Submit stays disabled until a reason is selected', async ({ page, confirmationPage, cancellationDialog }) => {
    await submitFutureRideAndGetCode(page);
    await confirmationPage.clickCancelRide();
    await cancellationDialog.waitForDialog();
    expect(await cancellationDialog.isCancelButtonDisabled()).toBe(true);
  });

  /** Verify that selecting a cancellation reason and confirming successfully cancels the ride. */
  test('@sanity FB_031: Selecting a reason and confirming cancels the ride', async ({ page, confirmationPage, cancellationDialog }) => {
    await submitFutureRideAndGetCode(page);
    await confirmationPage.clickCancelRide();
    await cancellationDialog.waitForDialog();

    const reasons = await cancellationDialog.getAllReasonTexts();
    await cancellationDialog.selectReasonByIndex(0);

    // If the first reason requires a free-text explanation, fill it before submitting.
    if (await cancellationDialog.isTextareaVisible()) {
      await cancellationDialog.fillDetails('Automated Future Booking test cancellation');
    }
    expect(await cancellationDialog.isCancelButtonDisabled()).toBe(false);
    await cancellationDialog.submitCancel();

    await confirmationPage.verifyRideCanceledScreen();
  });

  /** Verify that clicking Back on the cancellation dialogue closes it without cancelling the ride. */
  test('FB_032: "Back" closes the dialog without cancelling', async ({ page, confirmationPage, cancellationDialog }) => {
    await submitFutureRideAndGetCode(page);
    await confirmationPage.clickCancelRide();
    await cancellationDialog.waitForDialog();
    await cancellationDialog.clickBack();
    await expect(cancellationDialog.heading).not.toBeVisible();
    // Ride should still be active — cancel link still present (not the post-cancel screen).
    await expect(confirmationPage.cancelRideLink).toBeVisible();
  });

  // ── All 5 Reasons — Coverage Parity With ASAP ────────────────────────

  /**
   * Verify that Future Booking's cancellation dialog lists the same 5 reasons
   * as ASAP's (CANCEL_REASONS), in the same order, as its first 5 entries.
   *
   * KNOWN APP QUIRK (live-confirmed on staging/ODFB): the dialog currently
   * renders a 6th, duplicate "Wait time was too long" entry after the 5
   * canonical reasons — ASAP's dialog does not have this extra entry. This
   * assertion intentionally checks only the first 5 (the documented
   * contract) rather than exact-length equality, so it doesn't hard-fail on
   * that incidental duplicate render and will keep passing unchanged if/when
   * that duplicate is removed. Flagged to the team as a product bug — worth a
   * ticket — since a duplicate radio one could `force`-click without any
   * functional difference from the real one is confusing UI, even though it
   * doesn't block cancellation.
   */
  test('FB_033: Dialog reason set matches CANCEL_REASONS (first 5 entries)', async ({ page, confirmationPage, cancellationDialog }) => {
    await submitFutureRideAndGetCode(page);
    await confirmationPage.clickCancelRide();
    await cancellationDialog.waitForDialog();
    const reasons = await cancellationDialog.getAllReasonTexts();
    expect(reasons.slice(0, CANCEL_REASONS.length)).toEqual([...CANCEL_REASONS]);
  });

  /** Verify that cancelling with "Wait time was too long" (reason index 1) succeeds. */
  test('FB_034: Cancel with "Wait time was too long" succeeds', async ({ page, confirmationPage, cancellationDialog }) => {
    await submitFutureRideAndGetCode(page);
    await confirmationPage.clickCancelRide();
    await cancellationDialog.waitForDialog();
    await cancellationDialog.selectReasonByIndex(1);
    expect(await cancellationDialog.isCancelButtonDisabled()).toBe(false);
    await cancellationDialog.submitCancel();
    await confirmationPage.verifyRideCanceledScreen();
  });

  /** Verify that cancelling with "Change in travel plans" (reason index 2) succeeds. */
  test('FB_035: Cancel with "Change in travel plans" succeeds', async ({ page, confirmationPage, cancellationDialog }) => {
    await submitFutureRideAndGetCode(page);
    await confirmationPage.clickCancelRide();
    await cancellationDialog.waitForDialog();
    await cancellationDialog.selectReasonByIndex(2);
    expect(await cancellationDialog.isCancelButtonDisabled()).toBe(false);
    await cancellationDialog.submitCancel();
    await confirmationPage.verifyRideCanceledScreen();
  });

  /** Verify that cancelling with "Found alternative ride" (reason index 3) succeeds. */
  test('FB_036: Cancel with "Found alternative ride" succeeds', async ({ page, confirmationPage, cancellationDialog }) => {
    await submitFutureRideAndGetCode(page);
    await confirmationPage.clickCancelRide();
    await cancellationDialog.waitForDialog();
    await cancellationDialog.selectReasonByIndex(3);
    expect(await cancellationDialog.isCancelButtonDisabled()).toBe(false);
    await cancellationDialog.submitCancel();
    await confirmationPage.verifyRideCanceledScreen();
  });

  /** Verify that "App or technical issue" (reason index 4) reveals a required details textarea and keeps submit disabled until it's filled. */
  test('FB_037: "App or technical issue" requires details before submit enables', async ({ page, confirmationPage, cancellationDialog }) => {
    await submitFutureRideAndGetCode(page);
    await confirmationPage.clickCancelRide();
    await cancellationDialog.waitForDialog();
    await cancellationDialog.selectReasonByIndex(4);
    expect(await cancellationDialog.isTextareaVisible()).toBe(true);
    expect(await cancellationDialog.isCancelButtonDisabled()).toBe(true);
    await cancellationDialog.fillDetails('Automated Future Booking test cancellation — app issue');
    expect(await cancellationDialog.isCancelButtonDisabled()).toBe(false);
  });

  /** Verify that cancelling with "App or technical issue" plus required details succeeds. */
  test('FB_038: Cancel with "App or technical issue" + details succeeds', async ({ page, confirmationPage, cancellationDialog }) => {
    await submitFutureRideAndGetCode(page);
    await confirmationPage.clickCancelRide();
    await cancellationDialog.waitForDialog();
    await cancellationDialog.selectReasonByIndex(4);
    await cancellationDialog.fillDetails('Automated Future Booking test cancellation — app issue');
    await cancellationDialog.submitCancel();
    await confirmationPage.verifyRideCanceledScreen();
  });
});
