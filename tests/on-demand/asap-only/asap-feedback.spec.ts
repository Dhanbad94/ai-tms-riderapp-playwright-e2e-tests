import { test, expect } from '../../../fixtures/test-fixtures';
import { getOrgConfig, canCreateRides, getRiderConfig } from '../../../utils/rider-config';
import { RIDER_TAGS, RIDER_TIMEOUTS } from '../../../constants';
import { SelectLocationPage } from '../../../pages/rider/SelectLocationPage';
import { GuestFormSection } from '../../../pages/rider/GuestFormSection';
import { CancellationDialog } from '../../../pages/rider/CancellationDialog';

const org = getOrgConfig('asapOnly');
const config = getRiderConfig();
const { stops } = org;

/** Submit ride → cancel → click "Provide Feedback" → feedback modal open */
async function submitCancelAndOpenFeedback(page: import('@playwright/test').Page): Promise<void> {
  const lp = new SelectLocationPage(page);
  const gf = new GuestFormSection(page);
  const cd = new CancellationDialog(page);

  await lp.goto(org.trackingId);
  await lp.selectBothStops(stops.pickup, stops.dropoff);
  await lp.clickConfirm();
  await gf.waitForFormVisible();
  await gf.fillRequiredFields();
  await gf.submitAndAwaitTracking();
  const closeBtn = page.locator('[aria-label="Close"], button:has-text("×")').first();
  if (await closeBtn.isVisible({ timeout: 2_000 }).catch(() => false)) await closeBtn.click();
  await page.getByRole("heading").first().waitFor({ state: "visible", timeout: 15_000 });

  await page.getByText(/Cancel Ride/i).click();
  await cd.cancelWithReason('Change in travel plans');
  await page.getByText('Ride Canceled Successfully!').waitFor({ state: 'visible', timeout: 15_000 });

  await page.getByText('Provide Feedback', { exact: true }).click();
  await page.getByText("How Was Your Experience?").waitFor({ state: "visible", timeout: 15_000 });
}

test.describe(`ASAP Only — Feedback After Cancel ${RIDER_TAGS.ASAP} ${RIDER_TAGS.CREATES_RIDE} ${RIDER_TAGS.REGRESSION}`, () => {
  test.beforeEach(async () => {
    test.skip(!canCreateRides(), 'Ride creation disabled on this environment');
  });

  // Throttle between tests so successive ride submissions don't trip staging's rate limiter.
  test.afterEach(async ({ page }) => {
    await page.waitForTimeout(RIDER_TIMEOUTS.RIDE_COOLDOWN);
  });

  // ── H. Feedback Modal UI ─────────────────────────────────────────────

  test('FB_001: Feedback modal opens with heading', async ({ page }) => {
    await submitCancelAndOpenFeedback(page);
    await expect(page.getByText('How Was Your Experience?')).toBeVisible();
  });

  test('FB_002: Subheading visible', async ({ page }) => {
    await submitCancelAndOpenFeedback(page);
    await expect(page.getByText('Your feedback helps us improve for you!')).toBeVisible();
  });

  test('FB_003: 3 emoji rating buttons visible', async ({ page, feedbackModal }) => {
    await submitCancelAndOpenFeedback(page);
    await feedbackModal.waitForFeedbackVisible();
    await expect(feedbackModal.sadButton).toBeVisible();
    await expect(feedbackModal.neutralButton).toBeVisible();
    await expect(feedbackModal.happyButton).toBeVisible();
  });

  test('FB_004: Textarea visible with "Type your feedback" placeholder', async ({ page, feedbackModal }) => {
    await submitCancelAndOpenFeedback(page);
    await feedbackModal.waitForFeedbackVisible();
    await expect(feedbackModal.feedbackTextarea).toBeVisible();
    const placeholder = await feedbackModal.getTextareaPlaceholder();
    expect(placeholder).toContain('Type your feedback');
  });

  test('FB_005: "Share Feedback" button visible but disabled', async ({ page, feedbackModal }) => {
    await submitCancelAndOpenFeedback(page);
    await feedbackModal.waitForFeedbackVisible();
    await expect(feedbackModal.shareFeedbackButton).toBeVisible();
    expect(await feedbackModal.isSubmitDisabled()).toBe(true);
  });

  // ── I. Rating 1 — Sad ────────────────────────────────────────────────

  test('FB_006: Selecting Sad enables "Share Feedback"', async ({ page, feedbackModal }) => {
    await submitCancelAndOpenFeedback(page);
    await feedbackModal.waitForFeedbackVisible();
    await feedbackModal.selectSad();
    expect(await feedbackModal.isSubmitDisabled()).toBe(false);
  });

  test('FB_007: Submit with Sad rating + text succeeds', async ({ page, feedbackModal }) => {
    await submitCancelAndOpenFeedback(page);
    await feedbackModal.submitWithRating('sad', 'The shuttle was too slow');
    await feedbackModal.verifyThankYouScreen();
  });

  // ── J. Rating 2 — Neutral ────────────────────────────────────────────

  test('FB_008: Selecting Neutral enables "Share Feedback"', async ({ page, feedbackModal }) => {
    await submitCancelAndOpenFeedback(page);
    await feedbackModal.waitForFeedbackVisible();
    await feedbackModal.selectNeutral();
    expect(await feedbackModal.isSubmitDisabled()).toBe(false);
  });

  test('FB_009: Submit with Neutral rating + text succeeds', async ({ page, feedbackModal }) => {
    await submitCancelAndOpenFeedback(page);
    await feedbackModal.submitWithRating('neutral', 'Could be better');
    await feedbackModal.verifyThankYouScreen();
  });

  // ── K. Rating 3 — Happy ──────────────────────────────────────────────

  test('FB_010: Selecting Happy enables "Share Feedback"', async ({ page, feedbackModal }) => {
    await submitCancelAndOpenFeedback(page);
    await feedbackModal.waitForFeedbackVisible();
    await feedbackModal.selectHappy();
    expect(await feedbackModal.isSubmitDisabled()).toBe(false);
  });

  test('FB_011: Submit with Happy rating (no text) succeeds', async ({ page, feedbackModal }) => {
    await submitCancelAndOpenFeedback(page);
    await feedbackModal.waitForFeedbackVisible();
    await feedbackModal.selectHappy();
    await feedbackModal.submitFeedback();
    await feedbackModal.verifyThankYouScreen();
  });

  test('@sanity FB_012: Submit with Happy rating + text succeeds', async ({ page, feedbackModal }) => {
    await submitCancelAndOpenFeedback(page);
    await feedbackModal.submitWithRating('happy', 'Great service!');
    await feedbackModal.verifyThankYouScreen();
  });

  // ── L. Validation & Edge Cases ───────────────────────────────────────

  test('FB_013: Selecting any rating enables submit', async ({ page, feedbackModal }) => {
    await submitCancelAndOpenFeedback(page);
    await feedbackModal.waitForFeedbackVisible();
    expect(await feedbackModal.isSubmitDisabled()).toBe(true);
    await feedbackModal.selectNeutral();
    expect(await feedbackModal.isSubmitDisabled()).toBe(false);
  });

  test('FB_014: Textarea sanitizes XSS input', async ({ page, feedbackModal }) => {
    await submitCancelAndOpenFeedback(page);
    await feedbackModal.waitForFeedbackVisible();
    await feedbackModal.selectSad();
    await feedbackModal.fillFeedback('javascript:void(0)');
    const value = await feedbackModal.feedbackTextarea.inputValue();
    expect(value).not.toContain('javascript:');
  });

  test('FB_015: Feedback text retained when switching ratings', async ({ page, feedbackModal }) => {
    await submitCancelAndOpenFeedback(page);
    await feedbackModal.waitForFeedbackVisible();
    await feedbackModal.selectSad();
    await feedbackModal.fillFeedback('My detailed feedback');
    await feedbackModal.selectHappy();
    const value = await feedbackModal.feedbackTextarea.inputValue();
    expect(value).toBe('My detailed feedback');
  });

  // ── M. API Payload ───────────────────────────────────────────────────

  test('FB_016: Feedback API called on submit', async ({ page, feedbackModal }) => {
    let feedbackCalled = false;
    page.on('request', (req) => {
      if (req.url().includes('/feedback') && req.method() === 'POST') feedbackCalled = true;
    });
    await submitCancelAndOpenFeedback(page);
    await feedbackModal.submitWithRating('happy', 'API test');
    await feedbackModal.verifyThankYouScreen();
    expect(feedbackCalled).toBe(true);
  });

  // ── N. Thank You Screen ──────────────────────────────────────────────

  test('FB_017: Thank You screen shown after feedback', async ({ page, feedbackModal }) => {
    await submitCancelAndOpenFeedback(page);
    await feedbackModal.submitWithRating('happy', 'Excellent!');
    await expect(page.getByText('Thank you for your feedback!')).toBeVisible();
  });

  test('FB_018: "Request Again" button visible on Thank You', async ({ page, feedbackModal }) => {
    await submitCancelAndOpenFeedback(page);
    await feedbackModal.submitWithRating('happy');
    await feedbackModal.verifyThankYouScreen();
    await expect(page.getByRole('button', { name: /Request Again/i })).toBeVisible();
  });

  test('FB_019: "Request Again" navigates to org page', async ({ page, feedbackModal }) => {
    await submitCancelAndOpenFeedback(page);
    await feedbackModal.submitWithRating('happy');
    await feedbackModal.verifyThankYouScreen();
    await page.getByRole('button', { name: /Request Again/i }).click();
    await page.waitForURL((url) => !url.href.includes("/j/"), { timeout: 15_000 }).catch(() => {});
    expect(page.url()).toMatch(/\/a\/|trackmyshuttle\.com\/?$/);
  });

  test('FB_020: Browser back blocked on Thank You', async ({ page, feedbackModal }) => {
    await submitCancelAndOpenFeedback(page);
    await feedbackModal.submitWithRating('happy');
    await feedbackModal.verifyThankYouScreen();
    await page.goBack().catch(() => {});
    const still = await page.getByText('Thank you for your feedback!').isVisible().catch(() => false);
    const reqAgain = await page.getByRole('button', { name: /Request Again/i }).isVisible().catch(() => false);
    expect(still || reqAgain).toBe(true);
  });
});
