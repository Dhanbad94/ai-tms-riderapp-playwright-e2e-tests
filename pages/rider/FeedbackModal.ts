import { Page, Locator, expect } from '@playwright/test';
import { RIDER_TIMEOUTS } from '../../constants';

/**
 * Page Object for the Feedback modal after ride cancellation/completion.
 *
 * Staging UI:
 * - "How Was Your Experience?" heading
 * - 3 emoji buttons (Sad, Neutral, Happy) as <button> with SVGs
 * - Textarea with placeholder "Type your feedback"
 * - "Share Feedback" submit button
 * - After submit: "Thank you for your feedback!" screen
 */
export class FeedbackModal {
  readonly page: Page;

  // Heading
  readonly heading: Locator;
  readonly subheading: Locator;

  // 3 emoji rating buttons — they are <button> elements inside feedback_flexBox
  readonly sadButton: Locator;
  readonly neutralButton: Locator;
  readonly happyButton: Locator;

  // Textarea
  readonly feedbackTextarea: Locator;

  // Submit
  readonly shareFeedbackButton: Locator;

  // Thank You screen
  readonly thankYouText: Locator;
  readonly thankYouRequestAgainBtn: Locator;

  constructor(page: Page) {
    this.page = page;

    this.heading = page.getByText('How Was Your Experience?');
    this.subheading = page.getByText('Your feedback helps us improve for you!');

    // Emoji buttons: 3 <button> elements between heading and textarea
    // They're the only buttons with SVGs in the feedback area
    const feedbackButtons = page.locator('button:has(svg)');
    this.sadButton = feedbackButtons.nth(0);
    this.neutralButton = feedbackButtons.nth(1);
    this.happyButton = feedbackButtons.nth(2);

    // Placeholder changes per rating: "Oh no! What went wrong?" / "How can we improve?" /
    // "What did you enjoy the most?" / "Type your feedback"
    this.feedbackTextarea = page.locator('textarea');
    this.shareFeedbackButton = page.getByRole('button', { name: /Share Feedback/i });

    // Thank You screen
    this.thankYouText = page.getByText('Thank you for your feedback!');
    this.thankYouRequestAgainBtn = page.getByRole('button', { name: /Request Again/i });
  }

  async waitForFeedbackVisible() {
    await expect(this.heading).toBeVisible({ timeout: RIDER_TIMEOUTS.FORM_LOAD });
  }

  async selectSad() { await this.sadButton.click(); }
  async selectNeutral() { await this.neutralButton.click(); }
  async selectHappy() { await this.happyButton.click(); }

  async fillFeedback(text: string) {
    await this.feedbackTextarea.fill(text);
  }

  async submitFeedback() {
    await this.shareFeedbackButton.click();
  }

  async getTextareaPlaceholder(): Promise<string> {
    return (await this.feedbackTextarea.getAttribute('placeholder')) ?? '';
  }

  async isSubmitDisabled(): Promise<boolean> {
    return await this.shareFeedbackButton.isDisabled();
  }

  async verifyThankYouScreen() {
    await expect(this.thankYouText).toBeVisible({ timeout: RIDER_TIMEOUTS.CONFIRMATION });
  }

  /** Full feedback flow: select rating, type text, submit */
  async submitWithRating(rating: 'sad' | 'neutral' | 'happy', text?: string) {
    await this.waitForFeedbackVisible();
    if (rating === 'sad') await this.selectSad();
    else if (rating === 'neutral') await this.selectNeutral();
    else await this.selectHappy();

    if (text) await this.fillFeedback(text);
    await this.submitFeedback();
  }
}
