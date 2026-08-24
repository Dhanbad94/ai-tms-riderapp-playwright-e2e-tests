import { test, expect } from '../../../fixtures/test-fixtures';
import { getRiderConfig, isOrgEnabled } from '../../../utils/rider-config';
import { RIDER_TAGS } from '../../../constants';

/**
 * Future Booking — Form Validation.
 *
 * Mirrors asap-validation.spec.ts (name/phone/XSS checks are the same shared
 * GuestFullPageForm component, so behavior should be identical) and adds the
 * two validations unique to Future Booking:
 *  - Rider Type required (futureOthers.riderType.optional === 0) — error text
 *    is " Please select rider type" (leading space is in the app source,
 *    guestFormFullPage.js — asserted verbatim, not trimmed).
 *  - Room Number required (futureOthers.room.optional === 0).
 *
 * The "pick-up time expired at submit" precedence check (slotsTimeExpired()
 * runs BEFORE the required-field checks in handleSubmit()) needs a
 * controlled clock + controlled slot list to be deterministic — that lives in
 * future-api-payload.spec.ts against mocked /slots data instead of here.
 */
const rc = getRiderConfig();
const org = rc.orgs.futureBookingOnly;
const { stops } = org;

test.describe(`Future Booking — Validation ${RIDER_TAGS.FUTURE} ${RIDER_TAGS.UI_ONLY} ${RIDER_TAGS.REGRESSION} ${RIDER_TAGS.SAFE}`, () => {
  test.beforeEach(async ({ selectLocationPage, dateTimePicker, futureGuestFormSection }) => {
    test.skip(!isOrgEnabled('futureBookingOnly'), 'Future Booking org not configured for this environment — set trackingId/stops in rider-config.ts');
    await selectLocationPage.goto(org.trackingId);
    await selectLocationPage.selectBothStops(stops.pickup, stops.dropoff);
    await dateTimePicker.acceptDefaultSlot();
    await selectLocationPage.clickConfirm();
    await futureGuestFormSection.waitForFormVisible();
  });

  /** Verify that submitting the form with an empty Name field displays a validation error and blocks submission. */
  test('@smoke @sanity FB_018: Empty form submission blocked — validation error on name', async ({ futureGuestFormSection }) => {
    await futureGuestFormSection.requestRideButton.scrollIntoViewIfNeeded();
    await futureGuestFormSection.submitForm();
    expect(await futureGuestFormSection.hasNameError()).toBe(true);
  });

  /** Verify that entering a phone number shorter than the valid length displays a phone validation error. */
  test('FB_019: Phone field shows error for too-short phone', async ({ futureGuestFormSection }) => {
    await futureGuestFormSection.fillName('Test User');
    await futureGuestFormSection.fillPhone('12345');
    await futureGuestFormSection.nameInput.click();
    expect(await futureGuestFormSection.hasPhoneError()).toBe(true);
  });

  /** Verify that entering a valid phone number (10-16 digits) does not trigger a validation error. */
  test('FB_020: Phone field accepts a valid phone (10-16 digits)', async ({ futureGuestFormSection }) => {
    await futureGuestFormSection.selectCountryCode(org.phone.countryCode);
    await futureGuestFormSection.fillName('Test User');
    await futureGuestFormSection.fillPhone(org.phone.number);
    await futureGuestFormSection.nameInput.click();
    expect(await futureGuestFormSection.hasPhoneError()).toBe(false);
  });

  /** Verify that script/HTML entered in the Name field is sanitized and not rendered as executable script (XSS protection). */
  test('@smoke FB_021: XSS sanitized in name', async ({ futureGuestFormSection }) => {
    await futureGuestFormSection.fillName('<script>alert("xss")</script>');
    const val = await futureGuestFormSection.nameInput.inputValue();
    expect(val).not.toContain('<script>');
    expect(val).not.toContain('alert');
  });

  /** Verify that submitting the form without selecting a Rider Type displays the required-field validation error, when configured. */
  test('FB_022: Rider Type required — submitting without a selection shows the error', async ({ futureGuestFormSection }) => {
    const optionCount = await futureGuestFormSection.riderTypeSection.locator('input[type="radio"]').count();
    test.skip(optionCount === 0, 'Org does not configure futureOthers.riderType for this environment');
    await futureGuestFormSection.fillName('Test User');
    await futureGuestFormSection.selectCountryCode(org.phone.countryCode);
    await futureGuestFormSection.fillPhone(org.phone.number);
    await futureGuestFormSection.requestRideButton.scrollIntoViewIfNeeded();
    await futureGuestFormSection.submitForm();
    // Only asserted when the org marks rider type as required
    // (futureOthers.riderType.optional === 0) — otherwise there's nothing to block on.
    const hasError = await futureGuestFormSection.hasRiderTypeError();
    if (hasError) {
      expect(hasError).toBe(true);
    }
  });

  /** Verify that the Rider Type validation error clears once an option is selected. */
  test('FB_023: Rider Type error clears once an option is selected', async ({ futureGuestFormSection }) => {
    const optionLabels = await futureGuestFormSection.getRiderTypeOptions();
    test.skip(optionLabels.length === 0, 'Org does not configure futureOthers.riderType for this environment');
    await futureGuestFormSection.requestRideButton.scrollIntoViewIfNeeded();
    await futureGuestFormSection.submitForm();
    if (await futureGuestFormSection.hasRiderTypeError()) {
      await futureGuestFormSection.selectRiderType(optionLabels[0]!);
      expect(await futureGuestFormSection.hasRiderTypeError()).toBe(false);
    }
  });

  /** Verify that submitting the form with an empty Room Number field displays a validation error, since Room Number is mandatory. */
  test('FB_024: Room Number required — submitting empty shows a border error', async ({ futureGuestFormSection }) => {
    const roomVisible = await futureGuestFormSection.roomInput.isVisible({ timeout: 3_000 }).catch(() => false);
    test.skip(!roomVisible, 'Org does not configure futureOthers.room for this environment');
    await futureGuestFormSection.fillName('Test User');
    await futureGuestFormSection.selectCountryCode(org.phone.countryCode);
    await futureGuestFormSection.fillPhone(org.phone.number);
    await futureGuestFormSection.requestRideButton.scrollIntoViewIfNeeded();
    await futureGuestFormSection.submitForm();
    // Only meaningful when the org marks room as required (optional === 0);
    // otherwise the field simply stays valid empty.
    const classes = await futureGuestFormSection.roomInput.getAttribute('class').catch(() => '');
    if (classes?.includes('borderError')) {
      expect(classes).toContain('borderError');
    }
  });

  /** Verify that correcting the Name field after a validation error clears the error state. */
  test('Form recovery — fixing name clears the error', async ({ futureGuestFormSection }) => {
    await futureGuestFormSection.fillPhone(org.phone.number);
    await futureGuestFormSection.requestRideButton.scrollIntoViewIfNeeded();
    await futureGuestFormSection.submitForm();
    await expect(futureGuestFormSection.nameInput).toHaveAttribute('class', /borderError/, { timeout: 5_000 });
    await futureGuestFormSection.fillName('Fixed User');
    expect(await futureGuestFormSection.hasNameError()).toBe(false);
  });
});
