import { Page, Locator, expect } from '@playwright/test';
import { RIDER_TIMEOUTS } from '../../constants';
import { getRiderConfig } from '../../utils/rider-config';

/**
 * Page Object for the Ride Confirmation / Tracking page (/j/{rideCode}/s).
 * Covers active ride status, post-cancel screen, and navigation.
 */
export class ConfirmationPage {
  readonly page: Page;

  // Active ride elements
  readonly mainStatusText: Locator;
  readonly subStatusText: Locator;
  readonly progressAnimation: Locator;
  readonly trackingCard: Locator;
  readonly viewAllBookingsBtn: Locator;
  readonly mapContainer: Locator;
  readonly riderDetailsCard: Locator;
  readonly dragHandle: Locator;
  readonly createNewRequestLink: Locator;
  readonly backToHomeButton: Locator;

  // Footer actions
  readonly cancelRideLink: Locator;
  readonly callOperatorLink: Locator;
  readonly provideFeedbackLink: Locator;

  // Post-cancel screen (ride_status = 9)
  readonly rideCanceledTitle: Locator;
  readonly rideCanceledDescription: Locator;
  readonly requestAgainBtn: Locator;

  // Ride completed screen (ride_status = 5/6)
  readonly rideCompletedBanner: Locator;

  constructor(page: Page) {
    this.page = page;

    // Active ride — use semantic selectors where possible
    this.mainStatusText = page.getByRole('heading', { level: 2 }).first();
    this.subStatusText = page.locator('p').first();
    this.progressAnimation = page.locator('[class*="progressAnimation"], [class*="ProgressAnimation"]');
    this.trackingCard = page.locator('[class*="trackingCard"]');
    this.viewAllBookingsBtn = page.getByRole('button', { name: /View All Bookings/i });
    // Provider-agnostic: MapTiler/MapLibre on staging (`.maplibregl-map`),
    // Google Maps on preprod/prod (`.gm-style`); both expose the accessible
    // Map region. Matching all three keeps this stable across the migration.
    this.mapContainer = page.locator('.maplibregl-map, .gm-style, [role="region"][aria-label="Map" i]').first();
    // Rider-details card at the bottom of the tracking screen (name/guests, phone,
    // room, flight). CSS-module class is hash-suffixed, so match the stable part.
    this.riderDetailsCard = page.locator('[class*="riderItems"]').first();
    // The draggable bottom-sheet handle at the top of the tracking card
    // (trackingCard.js: onMouseDown/onTouchStart={handleDragStart}, a real
    // resizable-height gesture, not a decoration).
    this.dragHandle = page.locator('[class*="dragHandle"]').first();
    // Both CTAs sit near the top of the card content, right after the status
    // heading — live-verified they render on load, not gated behind a drag.
    // "Create New Request" is a plain <a href="{WEB_URL}/a/{orgCode}">, i.e.
    // restart a request for the SAME org; "Back to Home" is a <button> with
    // no href (JS navigation) that goes to the bare landing page instead.
    this.createNewRequestLink = page.getByRole('link', { name: 'Create New Request' });
    this.backToHomeButton = page.getByRole('button', { name: 'Back to Home' });

    // Footer actions — these use text matching (CSS uppercased)
    this.cancelRideLink = page.getByText(/Cancel Ride/i);
    this.callOperatorLink = page.getByText(/Call Operator/i);
    this.provideFeedbackLink = page.getByText('Provide Feedback', { exact: true });

    // Post-cancel screen
    this.rideCanceledTitle = page.getByText('Ride Canceled Successfully!');
    this.rideCanceledDescription = page.getByText(/request again or provide feedback/i);
    this.requestAgainBtn = page.getByText(/Request Again/i).first();

    // Ride completed
    this.rideCompletedBanner = page.getByText(/Your Ride Has Been Completed|Ride Canceled/i);
  }

  async goto(rideCode: string) {
    const config = getRiderConfig();
    await this.page.goto(`${config.urls.ride}/j/${rideCode}/s`, {
      waitUntil: 'domcontentloaded',
    });
    const closeBtn = this.page.locator('[aria-label="Close"], button:has-text("×")').first();
    if (await closeBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await closeBtn.click();
    }
    // Wait for page content instead of hardcoded sleep
    await this.page.waitForLoadState('domcontentloaded');
    // Wait for either status text or ride completed banner to appear
    // Wait for any heading or status content to appear
    await this.page.getByRole('heading').first()
      .waitFor({ state: 'visible', timeout: RIDER_TIMEOUTS.CONFIRMATION });
  }

  /**
   * Scroll the rider-details card into view. On mobile viewports the tracking
   * screen is a bottom sheet, so the details sit below the fold — this mirrors
   * the manual "scroll up from the bottom" step and is a no-op on desktop.
   */
  async scrollRiderDetailsIntoView() {
    await this.riderDetailsCard.scrollIntoViewIfNeeded();
  }

  /**
   * Full text content of the rider-details card — name+guest count, phone,
   * Special Assistance, note, and the dynamic "meta" rows (room number,
   * flight number + time, rider type), whichever the org/ride actually set.
   * Trackers each field with a single locator rather than one per meta row
   * since the row set/order is data-driven (trackingCard.js `meta.map(...)`).
   */
  async getRiderDetailsFullText(): Promise<string> {
    return ((await this.riderDetailsCard.textContent()) ?? '').trim();
  }

  /** Current height (px) of the draggable tracking card, read from its inline `height` style. */
  async getTrackingCardHeight(): Promise<number> {
    const style = await this.trackingCard.first().getAttribute('style');
    const match = style?.match(/height:\s*([\d.]+)px/);
    return match?.[1] ? parseFloat(match[1]) : NaN;
  }

  /**
   * Drag the bottom-sheet handle by `deltaY` pixels (negative = drag up,
   * expanding the card; positive = drag down, collapsing it) — a real mouse
   * gesture (mousedown/mousemove/mouseup), matching trackingCard.js's own
   * onMouseDown={handleDragStart} handler on the card, not a synthetic
   * one-shot click. Requires the handle's bounding box, so the card must
   * already be visible.
   */
  async dragBottomSheet(deltaY: number) {
    const box = await this.dragHandle.boundingBox();
    if (!box) throw new Error('Drag handle has no bounding box — is the tracking card visible?');
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;
    await this.page.mouse.move(startX, startY);
    await this.page.mouse.down();
    await this.page.mouse.move(startX, startY + deltaY, { steps: 15 });
    await this.page.mouse.up();
    // Card height animates via CSS transition when not actively dragging
    // (trackingCard.js: `transition: isDragging ? 'none' : 'height 0.3s ...'`).
    await this.page.waitForTimeout(RIDER_TIMEOUTS.MUI_DROPDOWN);
  }

  /** Click "Create New Request" — restarts a request for the same org. */
  async clickCreateNewRequest() {
    await this.createNewRequestLink.click();
  }

  /** Click "Back to Home" — navigates to the bare landing page. */
  async clickBackToHome() {
    await this.backToHomeButton.click();
  }

  async verifyAsapRideType() {
    await expect(this.mainStatusText).toBeVisible({ timeout: RIDER_TIMEOUTS.CONFIRMATION });
    await expect(this.trackingCard).not.toBeVisible();
    await expect(this.viewAllBookingsBtn).not.toBeVisible();
  }

  async verifyRequestSubmittedState() {
    const text = await this.mainStatusText.textContent();
    expect(text).toMatch(/Request Submitted|Finding Driver/i);
  }

  /** Click "Cancel Ride" link to open the cancellation dialog */
  async clickCancelRide() {
    await this.cancelRideLink.click();
  }

  /** Click "Provide Feedback" link to open the feedback modal */
  async clickProvideFeedback() {
    await this.provideFeedbackLink.click();
  }

  /** Click "Request Again" button */
  async clickRequestAgain() {
    await this.requestAgainBtn.click();
  }

  /** Verify the post-cancel screen is shown (ride_status = 9) */
  async verifyRideCanceledScreen() {
    await expect(this.rideCanceledTitle).toBeVisible({ timeout: RIDER_TIMEOUTS.CONFIRMATION });
    await expect(this.rideCanceledDescription).toBeVisible();
    await expect(this.requestAgainBtn).toBeVisible();
  }
}
