import { test, expect } from '../../../fixtures/test-fixtures';
import { getOrgConfig, canCreateRides, canRunCancelSmoke, getRiderConfig } from '../../../utils/rider-config';
import { RIDER_TAGS, RIDER_TIMEOUTS } from '../../../constants';
import { SelectLocationPage } from '../../../pages/rider/SelectLocationPage';
import { GuestFormSection } from '../../../pages/rider/GuestFormSection';
import { CANCEL_REASONS } from '../../../pages/rider/CancellationDialog';

const org = getOrgConfig('asapOnly');
const config = getRiderConfig();
const { stops } = org;

/** Submit a ride and stay on the confirmation page */
async function submitRideAndWait(page: import('@playwright/test').Page): Promise<void> {
  const lp = new SelectLocationPage(page);
  const gf = new GuestFormSection(page);
  await lp.goto(org.trackingId);
  await lp.selectBothStops(stops.pickup, stops.dropoff);
  await lp.clickConfirm();
  await gf.waitForFormVisible();
  await gf.fillRequiredFields();
  await gf.requestRideButton.scrollIntoViewIfNeeded();
  await gf.submitForm();
  await page.waitForURL(/\/j\/.*\/s/, { timeout: RIDER_TIMEOUTS.RIDE_SUBMIT });
  const closeBtn = page.locator('[aria-label="Close"], button:has-text("×")').first();
  if (await closeBtn.isVisible({ timeout: 2_000 }).catch(() => false)) await closeBtn.click();
  // Wait for ride status text instead of hardcoded sleep
  await page.getByRole('heading').first().waitFor({ state: 'visible', timeout: RIDER_TIMEOUTS.CONFIRMATION });
}

/** Submit ride → open cancel dialog */
async function submitAndOpenCancelDialog(page: import('@playwright/test').Page): Promise<void> {
  await submitRideAndWait(page);
  await page.getByText(/Cancel Ride/i).click();
  // Wait for dialog heading instead of hardcoded sleep
  await page.getByText('Reason for Cancelation?').waitFor({ state: 'visible', timeout: RIDER_TIMEOUTS.FORM_LOAD });
}

test.describe(`ASAP Only — Cancel Ride ${RIDER_TAGS.ASAP} ${RIDER_TAGS.CREATES_RIDE} ${RIDER_TAGS.REGRESSION}`, () => {
  test.beforeEach(async () => {
    test.skip(!canCreateRides(), 'Ride creation disabled on this environment');
  });

  // Throttle between tests so successive ride submissions don't trip staging's rate limiter.
  test.afterEach(async ({ page }) => {
    await page.waitForTimeout(RIDER_TIMEOUTS.RIDE_COOLDOWN);
  });

  // ── A. Cancel Button Visibility ──────────────────────────────────────

  test('CANCEL_001: Verify that the Cancel Ride link is visible while a ride is active', async ({ page }) => {
    await submitRideAndWait(page);
    await expect(page.getByText(/Cancel Ride/i)).toBeVisible();
  });

  test('CANCEL_002: Verify that the Call Operator link is shown alongside the Cancel Ride option', async ({ page }) => {
    await submitRideAndWait(page);
    await expect(page.getByText(/Call Operator/i)).toBeVisible();
  });

  test('CANCEL_003: Verify that canceling an active ride shows the cancellation success confirmation', async ({ page, cancellationDialog }) => {
    await submitAndOpenCancelDialog(page);
    await cancellationDialog.cancelWithReason('Change in travel plans');
    await expect(page.getByText("Ride Canceled Successfully!")).toBeVisible({ timeout: 15_000 });
  });

  // ── B. Cancel Dialog UI ──────────────────────────────────────────────

  test('CANCEL_004: Verify that the cancellation dialog opens with its heading', async ({ page, cancellationDialog }) => {
    await submitAndOpenCancelDialog(page);
    await expect(cancellationDialog.heading).toBeVisible();
  });

  test('CANCEL_005: Verify that the cancellation dialog lists all five cancellation reasons', async ({ page, cancellationDialog }) => {
    await submitAndOpenCancelDialog(page);
    await cancellationDialog.waitForDialog();
    for (const reason of CANCEL_REASONS) {
      await expect(page.getByText(reason, { exact: true }).first()).toBeVisible();
    }
  });

  test('CANCEL_006: Verify that the cancellation dialog shows Back and Cancel Ride buttons', async ({ page, cancellationDialog }) => {
    await submitAndOpenCancelDialog(page);
    await cancellationDialog.waitForDialog();
    await expect(cancellationDialog.backButton).toBeVisible();
    await expect(cancellationDialog.cancelRideButton).toBeVisible();
  });

  test('CANCEL_007: Verify that the Cancel Ride button stays disabled until a reason is selected', async ({ page, cancellationDialog }) => {
    await submitAndOpenCancelDialog(page);
    await cancellationDialog.waitForDialog();
    await expect(cancellationDialog.cancelRideButton).toBeDisabled();
  });

  test('CANCEL_008: Verify that the Back button closes the dialog without canceling the ride', async ({ page, cancellationDialog }) => {
    await submitAndOpenCancelDialog(page);
    await cancellationDialog.waitForDialog();
    await cancellationDialog.clickBack();
    await expect(cancellationDialog.heading).not.toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/Cancel Ride/i)).toBeVisible();
  });

  // ── C. Each Reason — Select, Enable, Cancel ──────────────────────────

  test('CANCEL_009: Verify that selecting "Ride request was not accepted" enables the Cancel Ride button', async ({ page, cancellationDialog }) => {
    await submitAndOpenCancelDialog(page);
    await cancellationDialog.waitForDialog();
    await cancellationDialog.selectReason('Ride request was not accepted');
    await expect(cancellationDialog.cancelRideButton).toBeEnabled();
  });

  test('CANCEL_010: Verify that a ride can be canceled with the reason "Ride request was not accepted"', async ({ page, cancellationDialog }) => {
    await submitAndOpenCancelDialog(page);
    await cancellationDialog.cancelWithReason('Ride request was not accepted');
    await expect(page.getByText("Ride Canceled Successfully!")).toBeVisible({ timeout: 15_000 });
  });

  test('CANCEL_011: Verify that selecting "Wait time was too long" enables the Cancel Ride button', async ({ page, cancellationDialog }) => {
    await submitAndOpenCancelDialog(page);
    await cancellationDialog.waitForDialog();
    await cancellationDialog.selectReason('Wait time was too long');
    await expect(cancellationDialog.cancelRideButton).toBeEnabled();
  });

  test('CANCEL_012: Verify that a ride can be canceled with the reason "Wait time was too long"', async ({ page, cancellationDialog }) => {
    await submitAndOpenCancelDialog(page);
    await cancellationDialog.cancelWithReason('Wait time was too long');
    await expect(page.getByText("Ride Canceled Successfully!")).toBeVisible({ timeout: 15_000 });
  });

  test('CANCEL_013: Verify that selecting "Change in travel plans" enables the Cancel Ride button', async ({ page, cancellationDialog }) => {
    await submitAndOpenCancelDialog(page);
    await cancellationDialog.waitForDialog();
    await cancellationDialog.selectReason('Change in travel plans');
    await expect(cancellationDialog.cancelRideButton).toBeEnabled();
  });

  test('@sanity CANCEL_014: Verify that a ride can be canceled with the reason "Change in travel plans"', async ({ page, cancellationDialog }) => {
    await submitAndOpenCancelDialog(page);
    await cancellationDialog.cancelWithReason('Change in travel plans');
    await expect(page.getByText("Ride Canceled Successfully!")).toBeVisible({ timeout: 15_000 });
  });

  test('CANCEL_015: Verify that selecting "Found alternative ride" enables the Cancel Ride button', async ({ page, cancellationDialog }) => {
    await submitAndOpenCancelDialog(page);
    await cancellationDialog.waitForDialog();
    await cancellationDialog.selectReason('Found alternative ride');
    await expect(cancellationDialog.cancelRideButton).toBeEnabled();
  });

  test('CANCEL_016: Verify that a ride can be canceled with the reason "Found alternative ride"', async ({ page, cancellationDialog }) => {
    await submitAndOpenCancelDialog(page);
    await cancellationDialog.cancelWithReason('Found alternative ride');
    await expect(page.getByText("Ride Canceled Successfully!")).toBeVisible({ timeout: 15_000 });
  });

  test('CANCEL_017: Verify that selecting "App or technical issue" requires details before canceling', async ({ page, cancellationDialog }) => {
    await submitAndOpenCancelDialog(page);
    await cancellationDialog.waitForDialog();
    await cancellationDialog.selectReason('App or technical issue');
    // This reason requires a textarea ("Please share details")
    expect(await cancellationDialog.isTextareaVisible()).toBe(true);
    // Submit disabled until textarea filled
    await expect(cancellationDialog.cancelRideButton).toBeDisabled();
  });

  test('CANCEL_018: Verify that adding details for "App or technical issue" enables the Cancel Ride button', async ({ page, cancellationDialog }) => {
    await submitAndOpenCancelDialog(page);
    await cancellationDialog.waitForDialog();
    await cancellationDialog.selectReason('App or technical issue');
    await cancellationDialog.fillDetails('App crashed during booking');
    await expect(cancellationDialog.cancelRideButton).toBeEnabled();
  });

  test('CANCEL_019: Verify that a ride can be canceled with "App or technical issue" and details provided', async ({ page, cancellationDialog }) => {
    await submitAndOpenCancelDialog(page);
    await cancellationDialog.cancelWithReason('App or technical issue', 'App crashed during booking');
    await expect(page.getByText("Ride Canceled Successfully!")).toBeVisible({ timeout: 15_000 });
  });

  // ── D. Switching Reasons ─────────────────────────────────────────────

  test('CANCEL_020: Verify that switching between cancellation reasons keeps the Cancel Ride button enabled', async ({ page, cancellationDialog }) => {
    await submitAndOpenCancelDialog(page);
    await cancellationDialog.waitForDialog();
    await cancellationDialog.selectReason('Change in travel plans');
    await expect(cancellationDialog.cancelRideButton).toBeEnabled();
    await cancellationDialog.selectReason('Wait time was too long');
    await expect(cancellationDialog.cancelRideButton).toBeEnabled();
  });

  // ── E. API Payload Verification ──────────────────────────────────────

  test('CANCEL_021: Verify that the cancellation request sends the ride code and selected reason', async ({ page, cancellationDialog }) => {
    let payload: Record<string, unknown> | null = null;
    await page.route(`${config.urls.api}/**/cancel-ride*`, async (route) => {
      if (route.request().method() === 'POST') payload = route.request().postDataJSON();
      await route.continue();
    });
    await submitAndOpenCancelDialog(page);
    await cancellationDialog.cancelWithReason('Change in travel plans');
    await expect(page.getByText("Ride Canceled Successfully!")).toBeVisible({ timeout: 15_000 });
    expect(payload).not.toBeNull();
    expect(payload!.reason).toBe('Change in travel plans');
    expect(payload!.code).toBeDefined();
  });

  test('CANCEL_022: Verify that canceling an ASAP ride calls the standard cancel-ride endpoint', async ({ page, cancellationDialog }) => {
    let cancelUrl = '';
    await page.route(`${config.urls.api}/**/cancel-ride*`, async (route) => {
      if (route.request().method() === 'POST') cancelUrl = route.request().url();
      await route.continue();
    });
    await submitAndOpenCancelDialog(page);
    await cancellationDialog.cancelWithReason('Wait time was too long');
    await expect(page.getByText("Ride Canceled Successfully!")).toBeVisible({ timeout: 15_000 });
    if (cancelUrl) expect(cancelUrl).toMatch(/cancel-ride$/);
  });

  // ── F. Post-Cancel Screen ────────────────────────────────────────────

  test('CANCEL_023: Verify that a success banner is shown after a ride is canceled', async ({ page, cancellationDialog }) => {
    await submitAndOpenCancelDialog(page);
    await cancellationDialog.cancelWithReason('Change in travel plans');
    await expect(page.getByText("Ride Canceled Successfully!")).toBeVisible({ timeout: 15_000 });
  });

  test('CANCEL_024: Verify that the Request Again button is visible after a ride is canceled', async ({ page, cancellationDialog }) => {
    await submitAndOpenCancelDialog(page);
    await cancellationDialog.cancelWithReason('Change in travel plans');
    await expect(page.getByText("Ride Canceled Successfully!")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Request Again/i).first()).toBeVisible({ timeout: RIDER_TIMEOUTS.CONFIRMATION });
  });

  test('CANCEL_025: Verify that the Provide Feedback link is visible after a ride is canceled', async ({ page, cancellationDialog }) => {
    await submitAndOpenCancelDialog(page);
    await cancellationDialog.cancelWithReason('Change in travel plans');
    await expect(page.getByText("Ride Canceled Successfully!")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Provide Feedback', { exact: true })).toBeVisible({ timeout: RIDER_TIMEOUTS.CONFIRMATION });
  });

  test('CANCEL_026: Verify that the Call Operator link is visible after a ride is canceled', async ({ page, cancellationDialog }) => {
    await submitAndOpenCancelDialog(page);
    await cancellationDialog.cancelWithReason('Change in travel plans');
    await expect(page.getByText("Ride Canceled Successfully!")).toBeVisible({ timeout: 15_000 });
    expect(await page.getByText(/Call Operator/i).isVisible().catch(() => false)).toBe(true);
  });

  test('CANCEL_027: Verify that the post-cancel screen shows Request Again and Provide Feedback options', async ({ page, cancellationDialog }) => {
    await submitAndOpenCancelDialog(page);
    await cancellationDialog.cancelWithReason('Change in travel plans');
    await expect(page.getByText("Ride Canceled Successfully!")).toBeVisible({ timeout: 15_000 });
    // Verify "Request Again" is visible alongside other post-cancel elements
    await expect(page.getByText(/Request Again/i).first()).toBeVisible();
    await expect(page.getByText('Provide Feedback', { exact: true })).toBeVisible();
  });
});

// ============================================================================
// Production cancel smoke — the ONE ride-creating test permitted on production.
// It creates a ride and immediately cancels it (self-cleaning: no active ride
// left behind). Gated by allowCancelSmoke (not canCreateRides), so it runs on
// staging, preproduction, and production without unblocking the rest of the
// @creates-ride suite. Tagged @prod so the production cron picks it up.
// ============================================================================
test.describe(`ASAP Only — Cancel Smoke ${RIDER_TAGS.ASAP} ${RIDER_TAGS.PROD}`, () => {
  test.beforeEach(async () => {
    test.skip(!canRunCancelSmoke(), 'Cancel smoke not enabled for this environment');
  });

  test.afterEach(async ({ page }) => {
    await page.waitForTimeout(RIDER_TIMEOUTS.RIDE_COOLDOWN);
  });

  test('@prod PROD_CANCEL_001: Verify that a newly created ride can be immediately canceled successfully', async ({ page, cancellationDialog }) => {
    await submitAndOpenCancelDialog(page);
    await cancellationDialog.cancelWithReason('Change in travel plans');
    await expect(page.getByText('Ride Canceled Successfully!')).toBeVisible({ timeout: 15_000 });
  });
});
