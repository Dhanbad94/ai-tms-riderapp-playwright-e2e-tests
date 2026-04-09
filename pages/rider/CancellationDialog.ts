import { Page, Locator, expect } from '@playwright/test';
import { RIDER_TIMEOUTS } from '../../constants';

/**
 * Page Object for the Cancel Ride bottom modal dialog.
 *
 * Staging ODASAP has 5 fixed cancellation reasons (no "Other" textarea):
 *   1. "Ride request was not accepted"
 *   2. "Wait time was too long"
 *   3. "Change in travel plans"
 *   4. "Found alternative ride"
 *   5. "App or technical issue"
 */

/** All available cancellation reasons on staging */
export const CANCEL_REASONS = [
  'Ride request was not accepted',
  'Wait time was too long',
  'Change in travel plans',
  'Found alternative ride',
  'App or technical issue',   // This one requires a textarea ("Please share details")
] as const;

export type CancelReason = typeof CANCEL_REASONS[number];

/** Reasons that require a textarea entry before submit is enabled */
export const REASONS_WITH_TEXTAREA: CancelReason[] = ['App or technical issue'];

export class CancellationDialog {
  readonly page: Page;

  // Dialog elements
  readonly heading: Locator;
  readonly backButton: Locator;
  readonly cancelRideButton: Locator;

  // All radio labels
  readonly allRadios: Locator;

  // Textarea for "App or technical issue" (and any other reason that requires it)
  readonly detailsTextarea: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByText('Reason for Cancelation?');
    this.allRadios = page.getByRole('radio');
    this.detailsTextarea = page.getByPlaceholder(/share|details|reason/i);
    this.backButton = page.getByRole('button', { name: 'Back' });
    this.cancelRideButton = page.getByRole('button', { name: /Cancel Ride/i }).last();
  }

  async waitForDialog() {
    await expect(this.heading).toBeVisible({ timeout: RIDER_TIMEOUTS.FORM_LOAD });
  }

  /** Select a cancellation reason by its label text */
  async selectReason(reason: CancelReason) {
    // Click the label that contains the reason text
    const label = this.page.locator('label').filter({ hasText: reason }).first();
    await label.click({ timeout: 5_000 });
  }

  /** Select a reason by its index (0-based) */
  async selectReasonByIndex(index: number) {
    await this.allRadios.nth(index).check({ force: true });
  }

  /** Get all visible reason label texts */
  async getAllReasonTexts(): Promise<string[]> {
    const labels = this.page.locator('label').filter({ has: this.page.locator('input[type="radio"]') });
    return await labels.allTextContents();
  }

  /** Click the Cancel Ride submit button inside the dialog */
  async submitCancel() {
    await this.cancelRideButton.click();
  }

  /** Click Back to close the dialog */
  async clickBack() {
    await this.backButton.click();
  }

  /** Check if Cancel Ride submit button is disabled */
  async isCancelButtonDisabled(): Promise<boolean> {
    return await this.cancelRideButton.isDisabled();
  }

  /** Check if the details textarea is visible */
  async isTextareaVisible(): Promise<boolean> {
    return await this.detailsTextarea.isVisible().catch(() => false);
  }

  /** Fill the details textarea */
  async fillDetails(text: string) {
    await this.detailsTextarea.fill(text);
  }

  /** Full cancel flow: select reason, fill textarea if needed, and submit */
  async cancelWithReason(reason: CancelReason, customText?: string) {
    await this.waitForDialog();
    await this.selectReason(reason);

    // If this reason requires a textarea, fill it
    if (REASONS_WITH_TEXTAREA.includes(reason) || await this.isTextareaVisible()) {
      await this.fillDetails(customText || 'Automated test cancellation');
    }

    await this.submitCancel();
  }
}
