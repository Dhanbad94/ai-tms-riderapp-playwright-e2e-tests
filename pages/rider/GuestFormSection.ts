import { Page, Locator, expect } from '@playwright/test';
import { RIDER_TIMEOUTS } from '../../constants';
import { getRiderConfig } from '../../utils/rider-config';
import type { OrgModeConfig } from '../../types';

/**
 * Page Object for the "Enter Ride Details" form (GuestFormFullPage).
 * Handles name, phone, riders, special assistance, notes, and submission.
 */
export class GuestFormSection {
  readonly page: Page;
  readonly formTitle: Locator;
  readonly backButton: Locator;
  readonly nameInput: Locator;
  readonly phoneInput: Locator;
  readonly ridersDropdown: Locator;
  readonly specialAssistanceCheckbox: Locator;
  readonly notesTextarea: Locator;
  readonly flightInput: Locator;
  readonly roomInput: Locator;
  readonly riderTypeSection: Locator;
  readonly requestRideButton: Locator;
  readonly termsLink: Locator;
  readonly privacyLink: Locator;
  readonly timeValidationError: Locator;
  readonly countryCodeDisplay: Locator;
  readonly countryCodeDropdown: Locator;
  readonly countrySearchInput: Locator;

  constructor(page: Page) {
    this.page = page;
    // Phase 1: Use semantic selectors (role, text, placeholder, label)
    this.formTitle = page.getByText('Enter Ride Details');
    this.backButton = page.locator('button').filter({ has: page.locator('img[alt="back"]') }).first();
    this.nameInput = page.getByPlaceholder('Name *');
    this.phoneInput = page.getByPlaceholder('Phone number *');
    this.ridersDropdown = page.locator('#demo-simple-select');
    this.specialAssistanceCheckbox = page.getByText('Special Assistance');
    this.notesTextarea = page.getByRole('textbox').last();
    this.flightInput = page.getByPlaceholder(/flight/i);
    this.roomInput = page.getByPlaceholder(/room/i);
    this.riderTypeSection = page.getByRole('radiogroup');
    this.requestRideButton = page.getByRole('button', { name: /Request Ride/i });
    this.termsLink = page.getByRole('link', { name: /Terms of Service/i });
    this.privacyLink = page.getByRole('link', { name: /Privacy Policy/i });
    this.timeValidationError = page.getByText(/Pick-up time expired/i);
    this.countryCodeDisplay = page.locator('[class*="countryDialCode"]');
    this.countryCodeDropdown = page.getByText('Select Country Code');
    this.countrySearchInput = page.getByPlaceholder('Search by Country Code or Name');
  }

  async waitForFormVisible() {
    await expect(this.formTitle).toBeVisible({ timeout: RIDER_TIMEOUTS.FORM_LOAD });
  }

  async fillName(name: string) {
    await this.nameInput.click();
    await this.nameInput.fill(name);
  }

  async fillPhone(phone: string) {
    await this.phoneInput.click();
    await this.phoneInput.fill(phone);
  }

  async selectCountryCode(countryName: string) {
    await this.countryCodeDisplay.click();
    await expect(this.countryCodeDropdown).toBeVisible();
    await this.countrySearchInput.fill(countryName);
    await this.page.getByText(countryName, { exact: true }).first().click();
  }

  /** Select riders from MUI dropdown (skips if not visible — already on location page) */
  async selectRiders(count: number) {
    const isVisible = await this.ridersDropdown.isVisible({ timeout: 2_000 }).catch(() => false);
    if (!isVisible) return;
    await this.ridersDropdown.scrollIntoViewIfNeeded();
    await this.ridersDropdown.evaluate((el) => el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
    const option = this.page.getByRole('option', { name: new RegExp(`^${count} Rider`) }).first();
    await option.waitFor({ timeout: RIDER_TIMEOUTS.STOP_LIST });
    await option.click();
  }

  async toggleSpecialAssistance() {
    await this.page.locator('label[for="checkBoxOne"]').click();
  }

  async fillNotes(text: string) {
    await this.notesTextarea.scrollIntoViewIfNeeded();
    await this.notesTextarea.fill(text);
  }

  /**
   * Fill required fields using org config from environment.
   * Uses the phone number and country code from rider-config.ts.
   */
  async fillRequiredFields(overrides: Partial<{ name: string; phone: string; countryCode: string; riders: number }> = {}) {
    const config = getRiderConfig();
    const org = Object.values(config.orgs).find(o => o.enabled) as OrgModeConfig;
    const ts = Date.now().toString(36).slice(-4);
    const name = overrides.name ? `PW_${overrides.name}_${ts}` : `PW_Rider_${ts}`;
    const phone = overrides.phone || org.phone.number;
    const countryCode = overrides.countryCode || org.phone.countryCode;
    // Random rider count between 1-3 if not specified
    const riders = overrides.riders ?? Math.floor(Math.random() * 3) + 1;

    await this.selectCountryCode(countryCode);
    await this.fillName(name);
    await this.fillPhone(phone);
    await this.selectRiders(riders);
  }

  async submitForm() {
    await this.requestRideButton.click();
  }

  async clickBack() {
    await this.backButton.click();
  }

  /** Check if name input has validation error (borderError class) */
  async hasNameError(): Promise<boolean> {
    const classes = await this.nameInput.getAttribute('class') ?? '';
    return classes.includes('borderError');
  }

  /** Check if phone input has validation error */
  async hasPhoneError(): Promise<boolean> {
    const classes = await this.page.locator('input[placeholder="Phone number *"]').getAttribute('class') ?? '';
    return classes.includes('borderError');
  }

  /** Check if riders dropdown has validation error */
  async hasRidersError(): Promise<boolean> {
    const riderDrop = this.page.locator('.rider-drop');
    if (!(await riderDrop.isVisible({ timeout: 1_000 }).catch(() => false))) return false;
    const classes = await riderDrop.getAttribute('class') ?? '';
    return classes.includes('borderError');
  }

  /** Verify ASAP form state — correct fields visible/hidden */
  async verifyAsapFormState() {
    await expect(this.nameInput).toBeVisible();
    await expect(this.phoneInput).toBeVisible();
    await expect(this.specialAssistanceCheckbox).toBeVisible();
    await expect(this.notesTextarea).toBeVisible();
    await expect(this.flightInput).not.toBeVisible();
    await expect(this.roomInput).not.toBeVisible();
    await expect(this.riderTypeSection).not.toBeVisible();
  }

  /** Get rider option count from MUI dropdown */
  async getRiderOptionCount(): Promise<number> {
    await this.ridersDropdown.scrollIntoViewIfNeeded();
    await this.ridersDropdown.evaluate((el) => el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
    await this.page.getByRole('option').first().waitFor({ timeout: RIDER_TIMEOUTS.STOP_LIST });
    const count = await this.page.getByRole('option').count();
    await this.page.keyboard.press('Escape');
    return count;
  }
}
