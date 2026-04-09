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
    this.mapContainer = page.locator('.gm-style').first();

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
