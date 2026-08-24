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

/** Submit a Future Booking ride → cancel it → click "Provide Feedback" → feedback modal open */
async function submitCancelAndOpenFeedback(page: import('@playwright/test').Page): Promise<void> {
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

  await page.getByText('Provide Feedback', { exact: true }).click();
  await page.getByText('How Was Your Experience?').waitFor({ state: 'visible', timeout: 15_000 });
}

test.describe(`Future Booking — Feedback After Cancel ${RIDER_TAGS.FUTURE} ${RIDER_TAGS.CREATES_RIDE} ${RIDER_TAGS.REGRESSION}`, () => {
  test.beforeEach(async () => {
    test.skip(!isOrgEnabled('futureBookingOnly'), 'Future Booking org not configured for this environment — set trackingId/stops in rider-config.ts');
    test.skip(!canCreateRides(), 'Ride creation disabled on this environment');
  });

  test.afterEach(async ({ page }) => {
    await page.waitForTimeout(RIDER_TIMEOUTS.RIDE_COOLDOWN);
  });

  // ── Feedback Modal UI ─────────────────────────────────────────────

  /** Verify that the feedback modal opens with the "How Was Your Experience?" heading after a cancellation. */
  test('@smoke FFB_001: Feedback modal opens with heading', async ({ page }) => {
    await submitCancelAndOpenFeedback(page);
    await expect(page.getByText('How Was Your Experience?')).toBeVisible();
  });

  /** Verify that the feedback modal's subheading is visible. */
  test('FFB_002: Subheading visible', async ({ page }) => {
    await submitCancelAndOpenFeedback(page);
    await expect(page.getByText('Your feedback helps us improve for you!')).toBeVisible();
  });

  /** Verify that all 3 emoji rating buttons (Sad, Neutral, Happy) are visible. */
  test('FFB_003: 3 emoji rating buttons visible', async ({ page, feedbackModal }) => {
    await submitCancelAndOpenFeedback(page);
    await feedbackModal.waitForFeedbackVisible();
    await expect(feedbackModal.sadButton).toBeVisible();
    await expect(feedbackModal.neutralButton).toBeVisible();
    await expect(feedbackModal.happyButton).toBeVisible();
  });

  /** Verify that the feedback textarea is visible with the "Type your feedback" placeholder. */
  test('FFB_004: Textarea visible with "Type your feedback" placeholder', async ({ page, feedbackModal }) => {
    await submitCancelAndOpenFeedback(page);
    await feedbackModal.waitForFeedbackVisible();
    await expect(feedbackModal.feedbackTextarea).toBeVisible();
    const placeholder = await feedbackModal.getTextareaPlaceholder();
    expect(placeholder).toContain('Type your feedback');
  });

  /** Verify that "Share Feedback" is visible but disabled until a rating is selected. */
  test('FFB_005: "Share Feedback" button visible but disabled', async ({ page, feedbackModal }) => {
    await submitCancelAndOpenFeedback(page);
    await feedbackModal.waitForFeedbackVisible();
    await expect(feedbackModal.shareFeedbackButton).toBeVisible();
    expect(await feedbackModal.isSubmitDisabled()).toBe(true);
  });

  // ── Rating 1 — Sad ────────────────────────────────────────────

  /** Verify that selecting the Sad rating enables "Share Feedback". */
  test('FFB_006: Selecting Sad enables "Share Feedback"', async ({ page, feedbackModal }) => {
    await submitCancelAndOpenFeedback(page);
    await feedbackModal.waitForFeedbackVisible();
    await feedbackModal.selectSad();
    expect(await feedbackModal.isSubmitDisabled()).toBe(false);
  });

  /** Verify that submitting feedback with a Sad rating and text succeeds. */
  test('FFB_007: Submit with Sad rating + text succeeds', async ({ page, feedbackModal }) => {
    await submitCancelAndOpenFeedback(page);
    await feedbackModal.submitWithRating('sad', 'The shuttle was too slow');
    await feedbackModal.verifyThankYouScreen();
  });

  // ── Rating 2 — Neutral ────────────────────────────────────────

  /** Verify that selecting the Neutral rating enables "Share Feedback". */
  test('FFB_008: Selecting Neutral enables "Share Feedback"', async ({ page, feedbackModal }) => {
    await submitCancelAndOpenFeedback(page);
    await feedbackModal.waitForFeedbackVisible();
    await feedbackModal.selectNeutral();
    expect(await feedbackModal.isSubmitDisabled()).toBe(false);
  });

  /** Verify that submitting feedback with a Neutral rating and text succeeds. */
  test('FFB_009: Submit with Neutral rating + text succeeds', async ({ page, feedbackModal }) => {
    await submitCancelAndOpenFeedback(page);
    await feedbackModal.submitWithRating('neutral', 'Could be better');
    await feedbackModal.verifyThankYouScreen();
  });

  // ── Rating 3 — Happy ──────────────────────────────────────────

  /** Verify that selecting the Happy rating enables "Share Feedback". */
  test('FFB_010: Selecting Happy enables "Share Feedback"', async ({ page, feedbackModal }) => {
    await submitCancelAndOpenFeedback(page);
    await feedbackModal.waitForFeedbackVisible();
    await feedbackModal.selectHappy();
    expect(await feedbackModal.isSubmitDisabled()).toBe(false);
  });

  /** Verify that submitting feedback with a Happy rating and no text still succeeds. */
  test('FFB_011: Submit with Happy rating (no text) succeeds', async ({ page, feedbackModal }) => {
    await submitCancelAndOpenFeedback(page);
    await feedbackModal.waitForFeedbackVisible();
    await feedbackModal.selectHappy();
    await feedbackModal.submitFeedback();
    await feedbackModal.verifyThankYouScreen();
  });

  /** Verify that submitting feedback with a Happy rating and text succeeds. */
  test('@sanity FFB_012: Submit with Happy rating + text succeeds', async ({ page, feedbackModal }) => {
    await submitCancelAndOpenFeedback(page);
    await feedbackModal.submitWithRating('happy', 'Great service!');
    await feedbackModal.verifyThankYouScreen();
  });

  // ── Validation & Edge Cases ───────────────────────────────────

  /** Verify that selecting any rating enables the submit button. */
  test('FFB_013: Selecting any rating enables submit', async ({ page, feedbackModal }) => {
    await submitCancelAndOpenFeedback(page);
    await feedbackModal.waitForFeedbackVisible();
    expect(await feedbackModal.isSubmitDisabled()).toBe(true);
    await feedbackModal.selectNeutral();
    expect(await feedbackModal.isSubmitDisabled()).toBe(false);
  });

  /** Verify that the feedback textarea sanitizes script/URL-like input. */
  test('FFB_014: Textarea sanitizes XSS input', async ({ page, feedbackModal }) => {
    await submitCancelAndOpenFeedback(page);
    await feedbackModal.waitForFeedbackVisible();
    await feedbackModal.selectSad();
    await feedbackModal.fillFeedback('javascript:void(0)');
    const value = await feedbackModal.feedbackTextarea.inputValue();
    expect(value).not.toContain('javascript:');
  });

  /** Verify that typed feedback text is retained when the selected rating is changed. */
  test('FFB_015: Feedback text retained when switching ratings', async ({ page, feedbackModal }) => {
    await submitCancelAndOpenFeedback(page);
    await feedbackModal.waitForFeedbackVisible();
    await feedbackModal.selectSad();
    await feedbackModal.fillFeedback('My detailed feedback');
    await feedbackModal.selectHappy();
    const value = await feedbackModal.feedbackTextarea.inputValue();
    expect(value).toBe('My detailed feedback');
  });

  // ── API Payload ───────────────────────────────────────────────

  /** Verify that submitting feedback fires a real POST /feedback API call. */
  test('FFB_016: Feedback API called on submit', async ({ page, feedbackModal }) => {
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
  test('FFB_017: Thank You screen shown after feedback', async ({ page, feedbackModal }) => {
    await submitCancelAndOpenFeedback(page);
    await feedbackModal.submitWithRating('happy', 'Excellent!');
    await expect(page.getByText('Thank you for your feedback!')).toBeVisible();
  });

  /** Verify that the "Request Again" button is visible on the Thank You screen. */
  test('FFB_018: "Request Again" button visible on Thank You', async ({ page, feedbackModal }) => {
    await submitCancelAndOpenFeedback(page);
    await feedbackModal.submitWithRating('happy');
    await feedbackModal.verifyThankYouScreen();
    await expect(page.getByRole('button', { name: /Request Again/i })).toBeVisible();
  });

  /** Verify that clicking "Request Again" on the Thank You screen navigates to the org page. */
  test('FFB_019: "Request Again" navigates to org page', async ({ page, feedbackModal }) => {
    await submitCancelAndOpenFeedback(page);
    await feedbackModal.submitWithRating('happy');
    await feedbackModal.verifyThankYouScreen();
    await page.getByRole('button', { name: /Request Again/i }).click();
    await page.waitForURL((url) => !url.href.includes('/j/'), { timeout: 15_000 }).catch(() => {});
    expect(page.url()).toMatch(/\/a\/|trackmyshuttle\.com\/?$/);
  });

  /** Verify that using the browser's Back button from the Thank You screen doesn't lose the completed state. */
  test('FFB_020: Browser back blocked on Thank You', async ({ page, feedbackModal }) => {
    await submitCancelAndOpenFeedback(page);
    await feedbackModal.submitWithRating('happy');
    await feedbackModal.verifyThankYouScreen();
    await page.goBack().catch(() => {});
    const still = await page.getByText('Thank you for your feedback!').isVisible().catch(() => false);
    const reqAgain = await page.getByRole('button', { name: /Request Again/i }).isVisible().catch(() => false);
    expect(still || reqAgain).toBe(true);
  });
});
