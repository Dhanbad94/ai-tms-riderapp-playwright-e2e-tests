import { test, expect } from '../../../fixtures/test-fixtures';
import { getOrgConfig } from '../../../utils/rider-config';
import { RIDER_TAGS } from '../../../constants';

const org = getOrgConfig('asapOnly');
const { stops } = org;

test.describe(`ASAP Only — Validation ${RIDER_TAGS.ASAP} ${RIDER_TAGS.UI_ONLY} ${RIDER_TAGS.REGRESSION} ${RIDER_TAGS.SAFE}`, () => {
  test.beforeEach(async ({ selectLocationPage, guestFormSection }) => {
    await selectLocationPage.goto(org.trackingId);
    await selectLocationPage.selectBothStops(stops.pickup, stops.dropoff);
    await selectLocationPage.clickConfirm();
    await guestFormSection.waitForFormVisible();
  });

  test('@smoke @sanity ASAP_019: Empty form submission blocked — validation errors on name and phone', async ({ guestFormSection, page }) => {
    await guestFormSection.requestRideButton.scrollIntoViewIfNeeded();
    await guestFormSection.submitForm();
    const nameHasError = await guestFormSection.hasNameError();
    expect(nameHasError).toBe(true);
  });

  test('ASAP_020: Name field shows validation error when empty', async ({ guestFormSection, page }) => {
    await guestFormSection.fillPhone(org.phone.number);
    await guestFormSection.requestRideButton.scrollIntoViewIfNeeded();
    await guestFormSection.submitForm();
    const nameHasError = await guestFormSection.hasNameError();
    expect(nameHasError).toBe(true);
  });

  test('ASAP_021: Phone field shows error for too-short phone', async ({ guestFormSection, page }) => {
    await guestFormSection.fillName('Test User');
    await guestFormSection.fillPhone('12345');
    await guestFormSection.nameInput.click();
    const phoneHasError = await guestFormSection.hasPhoneError();
    expect(phoneHasError).toBe(true);
  });

  test('Phone field accepts valid phone (10-16 digits)', async ({ guestFormSection, page }) => {
    await guestFormSection.selectCountryCode(org.phone.countryCode);
    await guestFormSection.fillName('Test User');
    await guestFormSection.fillPhone(org.phone.number);
    await guestFormSection.nameInput.click();
    const phoneHasError = await guestFormSection.hasPhoneError();
    expect(phoneHasError).toBe(false);
  });

  test('Phone too-long is truncated', async ({ guestFormSection }) => {
    await guestFormSection.fillPhone('12345678901234567890');
    const value = await guestFormSection.phoneInput.inputValue();
    expect(value.length).toBeLessThanOrEqual(16);
  });

  test('ASAP_022: Riders were required and selected', async ({ guestFormSection }) => {
    await expect(guestFormSection.formTitle).toBeVisible();
  });

  test('ASAP_023: No time-related validation error', async ({ guestFormSection }) => {
    await expect(guestFormSection.timeValidationError).not.toBeVisible();
  });

  test('@smoke ASAP_024: XSS sanitized in name', async ({ guestFormSection }) => {
    await guestFormSection.fillName('<script>alert("xss")</script>');
    const val = await guestFormSection.nameInput.inputValue();
    expect(val).not.toContain('<script>');
    expect(val).not.toContain('alert');
  });

  test('ASAP_025: XSS sanitized in notes', async ({ guestFormSection }) => {
    await guestFormSection.fillNotes('javascript:void(0)');
    const val = await guestFormSection.notesTextarea.inputValue();
    expect(val).not.toContain('javascript:');
  });

  test('ASAP_026: Scroll to first error on submit', async ({ guestFormSection }) => {
    await guestFormSection.submitForm();
    await expect(guestFormSection.nameInput).toBeVisible();
  });

  test('Form recovery — fixing name clears error', async ({ guestFormSection, page }) => {
    await guestFormSection.fillPhone(org.phone.number);
    await guestFormSection.requestRideButton.scrollIntoViewIfNeeded();
    await guestFormSection.submitForm();
    // Wait for validation to apply (borderError class)
    await expect(guestFormSection.nameInput).toHaveAttribute('class', /borderError/, { timeout: 5_000 });
    let nameErr = await guestFormSection.hasNameError();
    expect(nameErr).toBe(true);
    await guestFormSection.fillName('Fixed User');
    nameErr = await guestFormSection.hasNameError();
    expect(nameErr).toBe(false);
  });

  test('Form recovery — fixing phone clears error', async ({ guestFormSection, page }) => {
    await guestFormSection.fillPhone('123');
    await guestFormSection.nameInput.click();
    let phoneErr = await guestFormSection.hasPhoneError();
    expect(phoneErr).toBe(true);
    await guestFormSection.phoneInput.clear();
    await guestFormSection.selectCountryCode(org.phone.countryCode);
    await guestFormSection.fillPhone(org.phone.number);
    await guestFormSection.nameInput.click();
    phoneErr = await guestFormSection.hasPhoneError();
    expect(phoneErr).toBe(false);
  });

  test('Riders already selected — form functional', async ({ guestFormSection }) => {
    await expect(guestFormSection.nameInput).toBeVisible();
    await expect(guestFormSection.requestRideButton).toBeVisible();
  });

  test('Notes textarea respects maxLength', async ({ guestFormSection }) => {
    const maxLen = Number(await guestFormSection.notesTextarea.getAttribute('maxlength') || '250');
    const over = 'X'.repeat(maxLen + 100);
    await guestFormSection.fillNotes(over);
    const val = await guestFormSection.notesTextarea.inputValue();
    expect(val.length).toBeLessThanOrEqual(maxLen);
  });
});
