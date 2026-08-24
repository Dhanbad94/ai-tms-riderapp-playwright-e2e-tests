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
  // The <label> for each reason — sibling of its <input>, not a wrapper
  // around it (CustomRadioBtn: `<input .../><label htmlFor={id}>...`), so
  // reason text/selection is read/driven through these labels directly
  // rather than via `label:has(input)`, which cannot match sibling markup.
  readonly reasonLabels: Locator;

  // Textarea for "App or technical issue" (and any other reason that requires it)
  readonly detailsTextarea: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByText('Reason for Cancelation?');
    // The native <input type="radio"> in CustomRadioBtn is visually hidden
    // behind a styled <span> replacement and is NOT exposed with role="radio"
    // in the accessibility tree (confirmed live on staging: getByRole('radio')
    // matches zero elements even though 6 real radio inputs exist in the DOM
    // and are perfectly checkable). Query the DOM element directly instead of
    // by role — matches the `force: true` already used in selectReasonByIndex,
    // which anticipated this same non-standard visibility.
    this.allRadios = page.locator('input[type="radio"]');
    this.reasonLabels = page.locator('label');
    this.detailsTextarea = page.getByPlaceholder(/share|details|reason/i);
    // A plain name:'Back' role match is ambiguous on Future Booking's tracking
    // screen: it also has a post-cancel "Back to Home" button whose accessible
    // name is "Back Back to Home" (still matches a loose 'Back' filter) —
    // confirmed live via a 3-way strict-mode violation. Scope to the dialog's
    // own exact-text "Back" button instead.
    this.backButton = page.getByRole('button', { name: 'Back', exact: true });
    this.cancelRideButton = page.getByRole('button', { name: /Cancel Ride/i }).last();
  }

  async waitForDialog() {
    await expect(this.heading).toBeVisible({ timeout: RIDER_TIMEOUTS.FORM_LOAD });
    // The heading renders slightly before the reason radios finish mounting
    // (confirmed live on staging/ODFB: getAllReasonTexts() immediately after
    // the heading alone intermittently returned 0 results). Wait for the
    // first radio to attach — not toBeVisible(), since these inputs are
    // deliberately visually hidden by design (see allRadios above) — so every
    // caller can safely read/select reasons right after waitForDialog() returns.
    await this.allRadios.first().waitFor({ state: 'attached', timeout: RIDER_TIMEOUTS.FORM_LOAD });
  }

  /** Select a cancellation reason by its label text */
  async selectReason(reason: CancelReason) {
    // Click the label that contains the reason text
    const label = this.page.locator('label').filter({ hasText: reason }).first();
    await label.click({ timeout: 5_000 });
  }

  /**
   * Select a reason by its index (0-based). Clicks the associated <label>
   * rather than checking the radio directly — Playwright's .check() still
   * enforces the visibility actionability check even with force:true
   * (unlike .click()), and these radios are deliberately visually hidden by
   * design (see allRadios above). Labels and radios share the same document
   * order (confirmed live: label[for] values line up 1:1 with each radio's
   * id), so reasonLabels.nth(index) targets the same reason.
   */
  async selectReasonByIndex(index: number) {
    await this.reasonLabels.nth(index).click({ force: true });
  }

  /** Get all visible reason label texts */
  async getAllReasonTexts(): Promise<string[]> {
    return await this.reasonLabels.allTextContents();
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
