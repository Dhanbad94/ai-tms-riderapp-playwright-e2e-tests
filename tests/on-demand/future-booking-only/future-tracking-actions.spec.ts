import { test, expect } from '../../../fixtures/test-fixtures';
import { getOrgConfig, getRiderConfig, canCreateRides, isOrgEnabled } from '../../../utils/rider-config';
import { RIDER_TAGS, RIDER_TIMEOUTS } from '../../../constants';

/**
 * Future Booking — Tracking Screen Draggable Bottom Sheet & Post-Booking CTAs.
 *
 * The tracking card (trackingCard.js) is a REAL draggable bottom sheet
 * (onMouseDown/onTouchStart={handleDragStart}, height animates via CSS
 * transition) — not a decorative element. It carries two CTAs near the top
 * of its content, right after the status heading:
 *  - "Create New Request" — a plain <a href="{WEB_URL}/a/{orgCode}">,
 *    restarts a request for the SAME org.
 *  - "Back to Home" — a <button> (no href, JS navigation) that goes to the
 *    bare landing page instead.
 *
 * Live-verified against staging/ODFB on 2026-08-21: both CTAs are already
 * present as soon as the card renders — the drag is NOT a precondition for
 * them to exist in this app's current build (tested at both 412×915 and
 * 390×667). The drag gesture itself is still real, functional UI (the card's
 * height genuinely responds to it) and is exercised directly here rather
 * than assumed; TRACK_006/007 verify each CTA navigates correctly regardless
 * of drag state, which is what actually matters end-to-end.
 */
const rc = getRiderConfig();
const org = rc.orgs.futureBookingOnly;

async function submitFutureRideAndGetCode(page: import('@playwright/test').Page): Promise<string> {
  const cfg = getOrgConfig('futureBookingOnly');
  const { SelectLocationPage } = await import('../../../pages/rider/SelectLocationPage');
  const { DateTimePicker } = await import('../../../pages/rider/DateTimePicker');
  const { FutureGuestFormSection } = await import('../../../pages/rider/FutureGuestFormSection');
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

test.describe(`Future Booking — Tracking Actions ${RIDER_TAGS.FUTURE} ${RIDER_TAGS.CREATES_RIDE} ${RIDER_TAGS.REGRESSION}`, () => {
  test.beforeEach(async () => {
    test.skip(!isOrgEnabled('futureBookingOnly'), 'Future Booking org not configured for this environment — set trackingId/stops in rider-config.ts');
    test.skip(!canCreateRides(), 'Ride creation disabled on this environment');
  });

  test.afterEach(async ({ page }) => {
    await page.waitForTimeout(RIDER_TIMEOUTS.RIDE_COOLDOWN);
  });

  /** Verify that the tracking screen's bottom-sheet drag handle is visible after a ride is created. */
  test('@smoke TRACK_001: Verify that the tracking screen bottom-sheet drag handle is visible after a ride is created', async ({ page, confirmationPage }) => {
    await submitFutureRideAndGetCode(page);
    await expect(confirmationPage.dragHandle).toBeVisible({ timeout: RIDER_TIMEOUTS.CONFIRMATION });
  });

  /**
   * Verify that dragging the bottom sheet's handle changes the card's height
   * (a real, functional drag gesture). Live-verified: the card starts near
   * its floor height on this project's viewport (~115px, not expanded), so
   * the drag that actually moves it is UP (negative deltaY) — a drag-down
   * attempt from there has nowhere to go and correctly no-ops.
   */
  test('@sanity TRACK_002: Verify that dragging the bottom-sheet handle upward expands the tracking card height', async ({ page, confirmationPage }) => {
    await submitFutureRideAndGetCode(page);
    await expect(confirmationPage.dragHandle).toBeVisible({ timeout: RIDER_TIMEOUTS.CONFIRMATION });

    const heightBefore = await confirmationPage.getTrackingCardHeight();
    await confirmationPage.dragBottomSheet(-300); // drag up — expand
    const heightAfter = await confirmationPage.getTrackingCardHeight();

    expect(Number.isNaN(heightBefore)).toBe(false);
    expect(Number.isNaN(heightAfter)).toBe(false);
    expect(heightAfter).toBeGreaterThan(heightBefore);
  });

  /** Verify that dragging the bottom sheet back down collapses it again from its expanded height. */
  test('TRACK_003: Verify that dragging the expanded bottom sheet back down collapses the tracking card', async ({ page, confirmationPage }) => {
    await submitFutureRideAndGetCode(page);
    await expect(confirmationPage.dragHandle).toBeVisible({ timeout: RIDER_TIMEOUTS.CONFIRMATION });

    await confirmationPage.dragBottomSheet(-300); // expand up first
    const expandedHeight = await confirmationPage.getTrackingCardHeight();
    await confirmationPage.dragBottomSheet(300); // drag back down — collapse
    const collapsedHeight = await confirmationPage.getTrackingCardHeight();

    expect(collapsedHeight).toBeLessThan(expandedHeight);
  });

  /** Verify that "Create New Request" and "Back to Home" are both visible after dragging the personal-details sheet. */
  test('@sanity TRACK_004: Verify that "Create New Request" and "Back to Home" are both visible after dragging the bottom sheet', async ({ page, confirmationPage }) => {
    await submitFutureRideAndGetCode(page);
    await expect(confirmationPage.dragHandle).toBeVisible({ timeout: RIDER_TIMEOUTS.CONFIRMATION });

    await confirmationPage.dragBottomSheet(-300);
    await expect(confirmationPage.createNewRequestLink).toBeVisible();
    await expect(confirmationPage.backToHomeButton).toBeVisible();
  });

  /** Verify that "Create New Request" links to the same org's request-a-ride page. */
  test('TRACK_005: Verify that "Create New Request" links to the same organisation request-a-ride page', async ({ page, confirmationPage }) => {
    await submitFutureRideAndGetCode(page);
    await expect(confirmationPage.createNewRequestLink).toBeVisible({ timeout: RIDER_TIMEOUTS.CONFIRMATION });
    await expect(confirmationPage.createNewRequestLink).toHaveAttribute(
      'href', new RegExp(`/a/${org.trackingId}$`, 'i')
    );
  });

  /** Verify that clicking "Create New Request" navigates to the org's Welcome/request screen. */
  test('@sanity TRACK_006: Verify that clicking "Create New Request" opens the organisation Welcome screen', async ({ page, confirmationPage }) => {
    await submitFutureRideAndGetCode(page);
    await expect(confirmationPage.createNewRequestLink).toBeVisible({ timeout: RIDER_TIMEOUTS.CONFIRMATION });
    await confirmationPage.clickCreateNewRequest();
    await expect(page).toHaveURL(new RegExp(`/a/${org.trackingId}$`, 'i'), { timeout: 15_000 });
  });

  /** Verify that clicking "Back to Home" navigates to the bare landing page. */
  test('@sanity TRACK_007: Verify that clicking "Back to Home" opens the bare landing page', async ({ page, confirmationPage }) => {
    await submitFutureRideAndGetCode(page);
    await expect(confirmationPage.backToHomeButton).toBeVisible({ timeout: RIDER_TIMEOUTS.CONFIRMATION });
    await confirmationPage.clickBackToHome();
    // Live-verified: lands on the marketing site's bare root, "Here to Book
    // or Track your Shuttle?" — not the org-scoped Welcome screen.
    await expect(page).toHaveURL(/^https:\/\/[^/]+\/?$/, { timeout: 15_000 });
    await expect(page.getByRole('textbox', { name: 'Enter Tracking Code' })).toBeVisible();
  });
});
