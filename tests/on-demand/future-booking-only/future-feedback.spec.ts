import { test, expect } from '../../../fixtures/test-fixtures';
import { getOrgConfig, canCreateRides, isOrgEnabled } from '../../../utils/rider-config';
import { RIDER_TAGS, RIDER_TIMEOUTS } from '../../../constants';
import { SelectLocationPage } from '../../../pages/rider/SelectLocationPage';
import { DateTimePicker } from '../../../pages/rider/DateTimePicker';
import { FutureGuestFormSection } from '../../../pages/rider/FutureGuestFormSection';
import { CancellationDialog } from '../../../pages/rider/CancellationDialog';

/**
 * Future Booking — Feedback After Cancellation.
 *
 * Mirrors asap-feedback.spec.ts exactly (same FeedbackModal component,
 * "How Was Your Experience?" — shared across ASAP and Future Booking), with
 * the Future Booking submission/cancellation flow instead of ASAP's.
 */
const org = getOrgConfig('futureBookingOnly');
const { stops } = org;

// RIDE-VOLUME REDUCTION: submitting feedback is a ONE-SHOT per ride (once given,
// the ride's screen permanently shows the thank-you state — live-verified). So
// the modal-UI tests that only VIEW/interact and never submit all reuse ONE
// shared cancelled ride, while the tests that actually submit each keep their
// own fresh ride. This cuts the suite from 20 real rides per run down to ~10.
let sharedFeedbackUrl = '';

/** Submit a Future Booking ride → cancel it → return its (cancelled) tracking URL. */
async function submitAndCancelRide(page: import('@playwright/test').Page): Promise<string> {
  const lp = new SelectLocationPage(page);
  const dt = new DateTimePicker(page);
  const gf = new FutureGuestFormSection(page);
  const cd = new CancellationDialog(page);

  await lp.goto(org.trackingId);
  await lp.selectBothStops(stops.pickup, stops.dropoff);
  await dt.acceptDefaultSlot();
  await lp.clickConfirm();
  await gf.waitForFormVisible();
  await gf.fillRequiredFields();
  await gf.submitAndAwaitTracking();
  const trackingUrl = page.url();

  // The tracking page renders "Cancel Ride" a beat after navigation (once the
  // ride-details load); wait for it explicitly instead of relying on the 10s
  // action timeout, which occasionally lapses under serialized ride creation.
  const cancelRide = page.getByText(/Cancel Ride/i);
  await cancelRide.waitFor({ state: 'visible', timeout: RIDER_TIMEOUTS.CONFIRMATION });
  await cancelRide.click();
  await cd.waitForDialog();
  await cd.selectReasonByIndex(0);
  if (await cd.isTextareaVisible()) {
    await cd.fillDetails('Automated Future Booking feedback test cancellation');
  }
  await cd.submitCancel();
  await page.getByText('Ride Canceled Successfully!').waitFor({ state: 'visible', timeout: 15_000 });
  return trackingUrl;
}

/** Click "Provide Feedback" on a cancelled-ride screen and wait for the modal. */
async function openFeedbackModal(page: import('@playwright/test').Page): Promise<void> {
  await page.getByText('Provide Feedback', { exact: true }).click();
  await page.getByText('How Was Your Experience?').waitFor({ state: 'visible', timeout: 15_000 });
}

/** Create a FRESH cancelled ride and open its feedback modal — for the tests
 *  that submit feedback (a one-shot that consumes the ride). */
async function submitCancelAndOpenFeedback(page: import('@playwright/test').Page): Promise<void> {
  await submitAndCancelRide(page);
  await openFeedbackModal(page);
}

/** Reuse the suite's single shared cancelled ride — for modal-UI tests that
 *  only view/interact and never submit. Re-opens the modal fresh each time. */
async function openFeedbackOnSharedRide(page: import('@playwright/test').Page): Promise<void> {
  await page.goto(sharedFeedbackUrl, { waitUntil: 'domcontentloaded' });
  await openFeedbackModal(page);
}

test.describe(`Future Booking — Feedback After Cancel ${RIDER_TAGS.FUTURE} ${RIDER_TAGS.CREATES_RIDE} ${RIDER_TAGS.REGRESSION}`, () => {
  test.beforeAll(async ({ browser }) => {
    // Create the single shared cancelled ride the view/interact tests reuse.
    if (!isOrgEnabled('futureBookingOnly') || !canCreateRides()) return;
    const page = await browser.newPage();
    try {
      sharedFeedbackUrl = await submitAndCancelRide(page);
    } finally {
      await page.close();
    }
  });

  test.beforeEach(async () => {
    test.skip(!isOrgEnabled('futureBookingOnly'), 'Future Booking org not configured for this environment — set trackingId/stops in rider-config.ts');
    test.skip(!canCreateRides(), 'Ride creation disabled on this environment');
  });

  test.afterEach(async ({ page }) => {
    await page.waitForTimeout(RIDER_TIMEOUTS.RIDE_COOLDOWN);
  });

  // ── Feedback Modal UI ─────────────────────────────────────────────

  /** Verify that the feedback modal opens with the "How Was Your Experience?" heading after a cancellation. */
  test('@smoke FFB_001: Verify that the feedback modal opens with the How Was Your Experience heading after a cancellation', async ({ page }) => {
    await openFeedbackOnSharedRide(page);
    await expect(page.getByText('How Was Your Experience?')).toBeVisible();
  });

  /** Verify that the feedback modal's subheading is visible. */
  test('FFB_002: Verify that the feedback modal subheading is displayed', async ({ page }) => {
    await openFeedbackOnSharedRide(page);
    await expect(page.getByText('Your feedback helps us improve for you!')).toBeVisible();
  });

  /** Verify that all 3 emoji rating buttons (Sad, Neutral, Happy) are visible. */
  test('FFB_003: Verify that all three emoji rating buttons (Sad, Neutral, Happy) are displayed', async ({ page, feedbackModal }) => {
    await openFeedbackOnSharedRide(page);
    await feedbackModal.waitForFeedbackVisible();
    await expect(feedbackModal.sadButton).toBeVisible();
    await expect(feedbackModal.neutralButton).toBeVisible();
    await expect(feedbackModal.happyButton).toBeVisible();
  });

  /** Verify that the feedback textarea is visible with the "Type your feedback" placeholder. */
  test('FFB_004: Verify that the feedback text box is displayed with the Type your feedback placeholder', async ({ page, feedbackModal }) => {
    await openFeedbackOnSharedRide(page);
    await feedbackModal.waitForFeedbackVisible();
    await expect(feedbackModal.feedbackTextarea).toBeVisible();
    const placeholder = await feedbackModal.getTextareaPlaceholder();
    expect(placeholder).toContain('Type your feedback');
  });

  /** Verify that "Share Feedback" is visible but disabled until a rating is selected. */
  test('FFB_005: Verify that the Share Feedback button is displayed but disabled until a rating is selected', async ({ page, feedbackModal }) => {
    await openFeedbackOnSharedRide(page);
    await feedbackModal.waitForFeedbackVisible();
    await expect(feedbackModal.shareFeedbackButton).toBeVisible();
    await expect(feedbackModal.shareFeedbackButton).toBeDisabled();
  });

  // ── Rating 1 — Sad ────────────────────────────────────────────

  /** Verify that selecting the Sad rating enables "Share Feedback". */
  test('FFB_006: Verify that selecting the Sad rating enables the Share Feedback button', async ({ page, feedbackModal }) => {
    await openFeedbackOnSharedRide(page);
    await feedbackModal.waitForFeedbackVisible();
    await feedbackModal.selectSad();
    await expect(feedbackModal.shareFeedbackButton).toBeEnabled();
  });

  /** Verify that submitting feedback with a Sad rating and text succeeds. */
  test('FFB_007: Verify that feedback with a Sad rating and text is submitted successfully', async ({ page, feedbackModal }) => {
    await submitCancelAndOpenFeedback(page);
    await feedbackModal.submitWithRating('sad', 'The shuttle was too slow');
    await feedbackModal.verifyThankYouScreen();
  });

  // ── Rating 2 — Neutral ────────────────────────────────────────

  /** Verify that selecting the Neutral rating enables "Share Feedback". */
  test('FFB_008: Verify that selecting the Neutral rating enables the Share Feedback button', async ({ page, feedbackModal }) => {
    await openFeedbackOnSharedRide(page);
    await feedbackModal.waitForFeedbackVisible();
    await feedbackModal.selectNeutral();
    await expect(feedbackModal.shareFeedbackButton).toBeEnabled();
  });

  /** Verify that submitting feedback with a Neutral rating and text succeeds. */
  test('FFB_009: Verify that feedback with a Neutral rating and text is submitted successfully', async ({ page, feedbackModal }) => {
    await submitCancelAndOpenFeedback(page);
    await feedbackModal.submitWithRating('neutral', 'Could be better');
    await feedbackModal.verifyThankYouScreen();
  });

  // ── Rating 3 — Happy ──────────────────────────────────────────

  /** Verify that selecting the Happy rating enables "Share Feedback". */
  test('FFB_010: Verify that selecting the Happy rating enables the Share Feedback button', async ({ page, feedbackModal }) => {
    await openFeedbackOnSharedRide(page);
    await feedbackModal.waitForFeedbackVisible();
    await feedbackModal.selectHappy();
    await expect(feedbackModal.shareFeedbackButton).toBeEnabled();
  });

  /** Verify that submitting feedback with a Happy rating and no text still succeeds. */
  test('FFB_011: Verify that feedback with a Happy rating and no text is submitted successfully', async ({ page, feedbackModal }) => {
    await submitCancelAndOpenFeedback(page);
    await feedbackModal.waitForFeedbackVisible();
    await feedbackModal.selectHappy();
    await feedbackModal.submitFeedback();
    await feedbackModal.verifyThankYouScreen();
  });

  /** Verify that submitting feedback with a Happy rating and text succeeds. */
  test('@sanity FFB_012: Verify that feedback with a Happy rating and text is submitted successfully', async ({ page, feedbackModal }) => {
    await submitCancelAndOpenFeedback(page);
    await feedbackModal.submitWithRating('happy', 'Great service!');
    await feedbackModal.verifyThankYouScreen();
  });

  // ── Validation & Edge Cases ───────────────────────────────────

  /** Verify that selecting any rating enables the submit button. */
  test('FFB_013: Verify that selecting any rating enables the submit button', async ({ page, feedbackModal }) => {
    await openFeedbackOnSharedRide(page);
    await feedbackModal.waitForFeedbackVisible();
    await expect(feedbackModal.shareFeedbackButton).toBeDisabled();
    await feedbackModal.selectNeutral();
    await expect(feedbackModal.shareFeedbackButton).toBeEnabled();
  });

  /** Verify that the feedback textarea sanitizes script/URL-like input. */
  test('FFB_014: Verify that the feedback text box removes script or URL-like input', async ({ page, feedbackModal }) => {
    await openFeedbackOnSharedRide(page);
    await feedbackModal.waitForFeedbackVisible();
    await feedbackModal.selectSad();
    await feedbackModal.fillFeedback('javascript:void(0)');
    const value = await feedbackModal.feedbackTextarea.inputValue();
    expect(value).not.toContain('javascript:');
  });

  /** Verify that typed feedback text is retained when the selected rating is changed. */
  test('FFB_015: Verify that typed feedback text is kept when the selected rating is changed', async ({ page, feedbackModal }) => {
    await openFeedbackOnSharedRide(page);
    await feedbackModal.waitForFeedbackVisible();
    await feedbackModal.selectSad();
    await feedbackModal.fillFeedback('My detailed feedback');
    await feedbackModal.selectHappy();
    const value = await feedbackModal.feedbackTextarea.inputValue();
    expect(value).toBe('My detailed feedback');
  });

  // ── API Payload ───────────────────────────────────────────────

  /** Verify that submitting feedback fires a real POST /feedback API call. */
  test('FFB_016: Verify that submitting feedback sends a feedback request to the server', async ({ page, feedbackModal }) => {
    let feedbackCalled = false;
    page.on('request', (req) => {
      if (req.url().includes('/feedback') && req.method() === 'POST') feedbackCalled = true;
    });
    await submitCancelAndOpenFeedback(page);
    await feedbackModal.submitWithRating('happy', 'API test');
    await feedbackModal.verifyThankYouScreen();
    expect(feedbackCalled).toBe(true);
  });

  // ── Thank You Screen ──────────────────────────────────────────

  /** Verify that the "Thank you for your feedback!" screen is shown after submitting. */
  test('FFB_017: Verify that the thank-you screen is shown after feedback is submitted', async ({ page, feedbackModal }) => {
    await submitCancelAndOpenFeedback(page);
    await feedbackModal.submitWithRating('happy', 'Excellent!');
    await expect(page.getByText('Thank you for your feedback!')).toBeVisible();
  });

  /** Verify that the "Request Again" button is visible on the Thank You screen. */
  test('FFB_018: Verify that the Request Again button is displayed on the thank-you screen', async ({ page, feedbackModal }) => {
    await submitCancelAndOpenFeedback(page);
    await feedbackModal.submitWithRating('happy');
    await feedbackModal.verifyThankYouScreen();
    await expect(page.getByRole('button', { name: /Request Again/i })).toBeVisible();
  });

  /** Verify that clicking "Request Again" on the Thank You screen navigates to the org page. */
  test('FFB_019: Verify that clicking Request Again returns the rider to the organization booking page', async ({ page, feedbackModal }) => {
    await submitCancelAndOpenFeedback(page);
    await feedbackModal.submitWithRating('happy');
    await feedbackModal.verifyThankYouScreen();
    await page.getByRole('button', { name: /Request Again/i }).click();
    await page.waitForURL((url) => !url.href.includes('/j/'), { timeout: 15_000 }).catch(() => {});
    expect(page.url()).toMatch(/\/a\/|trackmyshuttle\.com\/?$/);
  });

  /** Verify that using the browser's Back button from the Thank You screen doesn't lose the completed state. */
  test('FFB_020: Verify that using the browser back button on the thank-you screen keeps the completed state', async ({ page, feedbackModal }) => {
    await submitCancelAndOpenFeedback(page);
    await feedbackModal.submitWithRating('happy');
    await feedbackModal.verifyThankYouScreen();
    await page.goBack().catch(() => {});
    const still = await page.getByText('Thank you for your feedback!').isVisible().catch(() => false);
    const reqAgain = await page.getByRole('button', { name: /Request Again/i }).isVisible().catch(() => false);
    expect(still || reqAgain).toBe(true);
  });
});
