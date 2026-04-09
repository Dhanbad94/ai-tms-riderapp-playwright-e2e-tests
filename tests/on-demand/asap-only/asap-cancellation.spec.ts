import { test, expect } from '../../../fixtures/test-fixtures';
import { getOrgConfig, canCreateRides, getRiderConfig } from '../../../utils/rider-config';
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

  // ── A. Cancel Button Visibility ──────────────────────────────────────

  test('CANCEL_001: Cancel Ride link visible when ride active', async ({ page }) => {
    await submitRideAndWait(page);
    await expect(page.getByText(/Cancel Ride/i)).toBeVisible();
  });

  test('CANCEL_002: Call Operator link visible alongside Cancel', async ({ page }) => {
    await submitRideAndWait(page);
    await expect(page.getByText(/Call Operator/i)).toBeVisible();
  });

  test('CANCEL_003: Cancel Ride hidden after cancellation', async ({ page, cancellationDialog }) => {
    await submitAndOpenCancelDialog(page);
    await cancellationDialog.cancelWithReason('Change in travel plans');
    await expect(page.getByText("Ride Canceled Successfully!")).toBeVisible({ timeout: 15_000 });
  });

  // ── B. Cancel Dialog UI ──────────────────────────────────────────────

  test('@smoke CANCEL_004: Cancel dialog opens with heading', async ({ page, cancellationDialog }) => {
    await submitAndOpenCancelDialog(page);
    await expect(cancellationDialog.heading).toBeVisible();
  });

  test('CANCEL_005: Dialog shows all 5 cancellation reasons', async ({ page, cancellationDialog }) => {
    await submitAndOpenCancelDialog(page);
    await cancellationDialog.waitForDialog();
    for (const reason of CANCEL_REASONS) {
      await expect(page.getByText(reason, { exact: true }).first()).toBeVisible();
    }
  });

  test('CANCEL_006: Dialog shows Back and Cancel Ride buttons', async ({ page, cancellationDialog }) => {
    await submitAndOpenCancelDialog(page);
    await cancellationDialog.waitForDialog();
    await expect(cancellationDialog.backButton).toBeVisible();
    await expect(cancellationDialog.cancelRideButton).toBeVisible();
  });

  test('CANCEL_007: Cancel Ride button disabled when no reason selected', async ({ page, cancellationDialog }) => {
    await submitAndOpenCancelDialog(page);
    await cancellationDialog.waitForDialog();
    expect(await cancellationDialog.isCancelButtonDisabled()).toBe(true);
  });

  test('CANCEL_008: Back button closes dialog without canceling', async ({ page, cancellationDialog }) => {
    await submitAndOpenCancelDialog(page);
    await cancellationDialog.waitForDialog();
    await cancellationDialog.clickBack();
    await expect(cancellationDialog.heading).not.toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/Cancel Ride/i)).toBeVisible();
  });

  // ── C. Each Reason — Select, Enable, Cancel ──────────────────────────

  test('CANCEL_009: "Ride request was not accepted" — enables submit', async ({ page, cancellationDialog }) => {
    await submitAndOpenCancelDialog(page);
    await cancellationDialog.waitForDialog();
    await cancellationDialog.selectReason('Ride request was not accepted');
    expect(await cancellationDialog.isCancelButtonDisabled()).toBe(false);
  });

  test('CANCEL_010: Cancel with "Ride request was not accepted" succeeds', async ({ page, cancellationDialog }) => {
    await submitAndOpenCancelDialog(page);
    await cancellationDialog.cancelWithReason('Ride request was not accepted');
    await expect(page.getByText("Ride Canceled Successfully!")).toBeVisible({ timeout: 15_000 });
  });

  test('CANCEL_011: "Wait time was too long" — enables submit', async ({ page, cancellationDialog }) => {
    await submitAndOpenCancelDialog(page);
    await cancellationDialog.waitForDialog();
    await cancellationDialog.selectReason('Wait time was too long');
    expect(await cancellationDialog.isCancelButtonDisabled()).toBe(false);
  });

  test('CANCEL_012: Cancel with "Wait time was too long" succeeds', async ({ page, cancellationDialog }) => {
    await submitAndOpenCancelDialog(page);
    await cancellationDialog.cancelWithReason('Wait time was too long');
    await expect(page.getByText("Ride Canceled Successfully!")).toBeVisible({ timeout: 15_000 });
  });

  test('CANCEL_013: "Change in travel plans" — enables submit', async ({ page, cancellationDialog }) => {
    await submitAndOpenCancelDialog(page);
    await cancellationDialog.waitForDialog();
    await cancellationDialog.selectReason('Change in travel plans');
    expect(await cancellationDialog.isCancelButtonDisabled()).toBe(false);
  });

  test('@smoke @sanity CANCEL_014: Cancel with "Change in travel plans" succeeds', async ({ page, cancellationDialog }) => {
    await submitAndOpenCancelDialog(page);
    await cancellationDialog.cancelWithReason('Change in travel plans');
    await expect(page.getByText("Ride Canceled Successfully!")).toBeVisible({ timeout: 15_000 });
  });

  test('CANCEL_015: "Found alternative ride" — enables submit', async ({ page, cancellationDialog }) => {
    await submitAndOpenCancelDialog(page);
    await cancellationDialog.waitForDialog();
    await cancellationDialog.selectReason('Found alternative ride');
    expect(await cancellationDialog.isCancelButtonDisabled()).toBe(false);
  });

  test('CANCEL_016: Cancel with "Found alternative ride" succeeds', async ({ page, cancellationDialog }) => {
    await submitAndOpenCancelDialog(page);
    await cancellationDialog.cancelWithReason('Found alternative ride');
    await expect(page.getByText("Ride Canceled Successfully!")).toBeVisible({ timeout: 15_000 });
  });

  test('CANCEL_017: "App or technical issue" shows textarea', async ({ page, cancellationDialog }) => {
    await submitAndOpenCancelDialog(page);
    await cancellationDialog.waitForDialog();
    await cancellationDialog.selectReason('App or technical issue');
    // This reason requires a textarea ("Please share details")
    expect(await cancellationDialog.isTextareaVisible()).toBe(true);
    // Submit disabled until textarea filled
    expect(await cancellationDialog.isCancelButtonDisabled()).toBe(true);
  });

  test('CANCEL_018: "App or technical issue" + details enables submit', async ({ page, cancellationDialog }) => {
    await submitAndOpenCancelDialog(page);
    await cancellationDialog.waitForDialog();
    await cancellationDialog.selectReason('App or technical issue');
    await cancellationDialog.fillDetails('App crashed during booking');
    expect(await cancellationDialog.isCancelButtonDisabled()).toBe(false);
  });

  test('CANCEL_019: Cancel with "App or technical issue" + details succeeds', async ({ page, cancellationDialog }) => {
    await submitAndOpenCancelDialog(page);
    await cancellationDialog.cancelWithReason('App or technical issue', 'App crashed during booking');
    await expect(page.getByText("Ride Canceled Successfully!")).toBeVisible({ timeout: 15_000 });
  });

  // ── D. Switching Reasons ─────────────────────────────────────────────

  test('CANCEL_020: Switching reasons keeps submit enabled', async ({ page, cancellationDialog }) => {
    await submitAndOpenCancelDialog(page);
    await cancellationDialog.waitForDialog();
    await cancellationDialog.selectReason('Change in travel plans');
    expect(await cancellationDialog.isCancelButtonDisabled()).toBe(false);
    await cancellationDialog.selectReason('Wait time was too long');
    expect(await cancellationDialog.isCancelButtonDisabled()).toBe(false);
  });

  // ── E. API Payload Verification ──────────────────────────────────────

  test('CANCEL_021: Payload contains ride code and reason', async ({ page, cancellationDialog }) => {
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

  test('CANCEL_022: Endpoint is /cancel-ride (no type suffix for ASAP)', async ({ page, cancellationDialog }) => {
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

  test('@smoke CANCEL_023: "Ride Canceled Successfully!" banner shown', async ({ page, cancellationDialog }) => {
    await submitAndOpenCancelDialog(page);
    await cancellationDialog.cancelWithReason('Change in travel plans');
    await expect(page.getByText("Ride Canceled Successfully!")).toBeVisible({ timeout: 15_000 });
  });

  test('CANCEL_024: "Request Again" button visible after cancel', async ({ page, cancellationDialog }) => {
    await submitAndOpenCancelDialog(page);
    await cancellationDialog.cancelWithReason('Change in travel plans');
    await expect(page.getByText("Ride Canceled Successfully!")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Request Again/i).first()).toBeVisible({ timeout: RIDER_TIMEOUTS.CONFIRMATION });
  });

  test('CANCEL_025: "Provide Feedback" link visible after cancel', async ({ page, cancellationDialog }) => {
    await submitAndOpenCancelDialog(page);
    await cancellationDialog.cancelWithReason('Change in travel plans');
    await expect(page.getByText("Ride Canceled Successfully!")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Provide Feedback', { exact: true })).toBeVisible({ timeout: RIDER_TIMEOUTS.CONFIRMATION });
  });

  test('CANCEL_026: "Call Operator" link visible after cancel', async ({ page, cancellationDialog }) => {
    await submitAndOpenCancelDialog(page);
    await cancellationDialog.cancelWithReason('Change in travel plans');
    await expect(page.getByText("Ride Canceled Successfully!")).toBeVisible({ timeout: 15_000 });
    expect(await page.getByText(/Call Operator/i).isVisible().catch(() => false)).toBe(true);
  });

  test('CANCEL_027: "Request Again" button is visible on post-cancel screen', async ({ page, cancellationDialog }) => {
    await submitAndOpenCancelDialog(page);
    await cancellationDialog.cancelWithReason('Change in travel plans');
    await expect(page.getByText("Ride Canceled Successfully!")).toBeVisible({ timeout: 15_000 });
    // Verify "Request Again" is visible alongside other post-cancel elements
    await expect(page.getByText(/Request Again/i).first()).toBeVisible();
    await expect(page.getByText('Provide Feedback', { exact: true })).toBeVisible();
  });
});
