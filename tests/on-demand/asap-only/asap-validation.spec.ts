import { test, expect } from '../../../fixtures/test-fixtures';
import { getOrgConfig, getRiderConfig } from '../../../utils/rider-config';
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

  test('@smoke @sanity ASAP_019: Verify that submitting an empty booking form is blocked and shows a validation error on the name field', async ({ guestFormSection, page }) => {
    await guestFormSection.requestRideButton.scrollIntoViewIfNeeded();
    await guestFormSection.submitForm();
    const nameHasError = await guestFormSection.hasNameError();
    expect(nameHasError).toBe(true);
  });

  test('ASAP_020: Verify that the name field shows a validation error when left empty on submit', async ({ guestFormSection, page }) => {
    await guestFormSection.fillPhone(org.phone.number);
    await guestFormSection.requestRideButton.scrollIntoViewIfNeeded();
    await guestFormSection.submitForm();
    const nameHasError = await guestFormSection.hasNameError();
    expect(nameHasError).toBe(true);
  });

  test('ASAP_021: Verify that the phone field shows an error when the phone number is too short', async ({ guestFormSection, page }) => {
    await guestFormSection.fillName('Test User');
    await guestFormSection.fillPhone('12345');
    await guestFormSection.nameInput.click();
    const phoneHasError = await guestFormSection.hasPhoneError();
    expect(phoneHasError).toBe(true);
  });

  test('Verify that the phone field accepts a valid phone number of 10 to 16 digits without error', async ({ guestFormSection, page }) => {
    await guestFormSection.selectCountryCode(org.phone.countryCode);
    await guestFormSection.fillName('Test User');
    await guestFormSection.fillPhone(org.phone.number);
    await guestFormSection.nameInput.click();
    const phoneHasError = await guestFormSection.hasPhoneError();
    expect(phoneHasError).toBe(false);
  });

  test('Verify that an overly long phone number is truncated to at most 16 digits', async ({ guestFormSection }) => {
    await guestFormSection.fillPhone('12345678901234567890');
    const value = await guestFormSection.phoneInput.inputValue();
    expect(value.length).toBeLessThanOrEqual(16);
  });

  test('ASAP_022: Verify that the booking form is displayed after stops and riders are selected', async ({ guestFormSection }) => {
    await expect(guestFormSection.formTitle).toBeVisible();
  });

  test('ASAP_023: Verify that no time-related validation error is shown on the booking form', async ({ guestFormSection }) => {
    await expect(guestFormSection.timeValidationError).not.toBeVisible();
  });

  test('@smoke ASAP_024: Verify that script content typed into the name field is stripped out for safety', async ({ guestFormSection }) => {
    await guestFormSection.fillName('<script>alert("xss")</script>');
    const val = await guestFormSection.nameInput.inputValue();
    expect(val).not.toContain('<script>');
    expect(val).not.toContain('alert');
  });

  test('ASAP_025: Verify that unsafe script content typed into the notes field is stripped out for safety', async ({ guestFormSection }) => {
    await guestFormSection.fillNotes('javascript:void(0)');
    const val = await guestFormSection.notesTextarea.inputValue();
    expect(val).not.toContain('javascript:');
  });

  test('ASAP_026: Verify that submitting an invalid form scrolls to and reveals the first field in error', async ({ guestFormSection }) => {
    await guestFormSection.submitForm();
    await expect(guestFormSection.nameInput).toBeVisible();
  });

  test('Verify that entering a valid name clears the previously shown name validation error', async ({ guestFormSection, page }) => {
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

  test('Verify that entering a valid phone number clears the previously shown phone validation error', async ({ guestFormSection, page }) => {
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

  test('Verify that the booking form and Request Ride button are available when riders are already selected', async ({ guestFormSection }) => {
    await expect(guestFormSection.nameInput).toBeVisible();
    await expect(guestFormSection.requestRideButton).toBeVisible();
  });

  test('Verify that the notes field prevents entering more than its maximum allowed characters', async ({ guestFormSection }) => {
    const maxLen = Number(await guestFormSection.notesTextarea.getAttribute('maxlength') || '250');
    const over = 'X'.repeat(maxLen + 100);
    await guestFormSection.fillNotes(over);
    const val = await guestFormSection.notesTextarea.inputValue();
    expect(val.length).toBeLessThanOrEqual(maxLen);
  });

});

// ── Form negatives — STAGING-ONLY ───────────────────────────────────────────
// These exercise client/UI logic that is identical across environments. Preprod
// and production render the stop list slowly/unreliably, so they're scoped to
// staging (verified reliable there) and NOT tagged @ui-only, so the preprod/prod
// cron never collects them.
test.describe(`ASAP Only — Form Negatives ${RIDER_TAGS.ASAP} ${RIDER_TAGS.SAFE} ${RIDER_TAGS.REGRESSION} ${RIDER_TAGS.NEGATIVE}`, () => {
  test.beforeEach(async ({ selectLocationPage, guestFormSection }) => {
    test.skip(getRiderConfig().name !== 'staging', 'UI negatives run on staging only (preprod/prod stop-list is slow/unreliable)');
    await selectLocationPage.goto(org.trackingId);
    await selectLocationPage.selectBothStops(stops.pickup, stops.dropoff);
    await selectLocationPage.clickConfirm();
    await guestFormSection.waitForFormVisible();
  });

  // Phone is a plain type=tel, maxlength 16; it does NOT strip non-numeric
  // characters, so the boundary here is length-based.
  test('@negative NEG_FORM_001: Verify that the phone field prevents entering more than 16 digits', async ({ guestFormSection }) => {
    await guestFormSection.fillPhone('1'.repeat(30));
    const val = await guestFormSection.phoneInput.inputValue();
    expect(val.length).toBeLessThanOrEqual(16);
  });

  test('@negative NEG_FORM_002: Verify that the name field removes HTML and script characters entered by the user', async ({ guestFormSection }) => {
    await guestFormSection.fillName('<img src=x onerror=alert(1)>');
    const val = await guestFormSection.nameInput.inputValue();
    expect(val).not.toContain('<');
    expect(val).not.toContain('onerror');
  });

  test('@negative NEG_FORM_003: Verify that submitting with only the name filled shows a validation error on the phone field', async ({ guestFormSection }) => {
    await guestFormSection.fillName('Only Name');
    await guestFormSection.requestRideButton.scrollIntoViewIfNeeded();
    await guestFormSection.submitForm();
    expect(await guestFormSection.hasPhoneError()).toBe(true);
  });

  test('@negative NEG_FORM_004: Verify that a name containing only spaces is rejected and no ride is created', async ({ guestFormSection, page }) => {
    await guestFormSection.fillName('     ');
    await guestFormSection.selectCountryCode(org.phone.countryCode);
    await guestFormSection.fillPhone(org.phone.number);
    await guestFormSection.requestRideButton.scrollIntoViewIfNeeded();
    await guestFormSection.submitForm();
    // Client validation must block a whitespace-only name — no redirect to /j/{code}/s.
    await page.waitForTimeout(3_000);
    expect(page.url()).not.toMatch(/\/j\/.*\/s/);
  });
});
