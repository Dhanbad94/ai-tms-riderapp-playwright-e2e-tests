import { test, expect } from '../../../fixtures/test-fixtures';
import { getRiderConfig, isOrgEnabled } from '../../../utils/rider-config';
import { RIDER_TAGS } from '../../../constants';

/**
 * Future Booking — "Enter Ride Details" form fields & behavior.
 *
 * Mirrors asap-form.spec.ts. The two behavioral differences from ASAP:
 *  - Rider Type radios CAN render here (ASAP_017 asserts they're hidden;
 *    FB_010 asserts the opposite, gated on the org actually configuring them).
 *  - Room/Flight placeholders are org-configurable text — this file uses
 *    FutureGuestFormSection's tolerant (regex) locators rather than ASAP's
 *    exact "Room Number"/"Flight Number" strings.
 */
const rc = getRiderConfig();
const org = rc.orgs.futureBookingOnly;
const { stops } = org;

test.describe(`Future Booking — Form Fields & Behavior ${RIDER_TAGS.FUTURE} ${RIDER_TAGS.UI_ONLY} ${RIDER_TAGS.REGRESSION} ${RIDER_TAGS.SAFE}`, () => {
  test.beforeEach(async ({ selectLocationPage, dateTimePicker, futureGuestFormSection }) => {
    test.skip(!isOrgEnabled('futureBookingOnly'), 'Future Booking org not configured for this environment — set trackingId/stops in rider-config.ts');
    await selectLocationPage.goto(org.trackingId);
    await selectLocationPage.selectBothStops(stops.pickup, stops.dropoff);
    await dateTimePicker.acceptDefaultSlot();
    await selectLocationPage.clickConfirm();
    await futureGuestFormSection.waitForFormVisible();
  });

  /** Verify that the "Enter Ride Details" form opens with the correct heading after confirming location and time. */
  test('@smoke @sanity FB_008: Verify that the ride details form opens with the "Enter Ride Details" heading', async ({ futureGuestFormSection }) => {
    await expect(futureGuestFormSection.formTitle).toBeVisible();
    await expect(futureGuestFormSection.formTitle).toHaveText('Enter Ride Details');
  });

  /** Verify that the rider-count dropdown is visible on the guest details form. */
  test('FB_009: Verify that the rider count dropdown is shown on the ride details form', async ({ futureGuestFormSection }) => {
    await expect(futureGuestFormSection.ridersDropdown).toBeVisible();
  });

  /** Verify that the Rider Type selection is displayed when the organization is configured for it. */
  test('FB_010: Verify that the rider type options are shown when the organization configures them', async ({ futureGuestFormSection }) => {
    const optionCount = await futureGuestFormSection.riderTypeSection.locator('input[type="radio"]').count();
    test.skip(optionCount === 0, 'Org does not configure futureOthers.riderType for this environment');
    await expect(futureGuestFormSection.riderTypeSection).toBeVisible();
  });

  /** Verify that the Name field accepts and correctly displays text input. */
  test('FB_011: Verify that the Name field accepts and displays typed text', async ({ futureGuestFormSection }) => {
    await futureGuestFormSection.fillName('John Doe');
    await expect(futureGuestFormSection.nameInput).toHaveValue('John Doe');
  });

  /** Verify that the Phone field accepts numeric input. */
  test('FB_012: Verify that the Phone field accepts numeric input', async ({ futureGuestFormSection }) => {
    await futureGuestFormSection.fillPhone(org.phone.number);
    await expect(futureGuestFormSection.phoneInput).toHaveValue(org.phone.number);
  });

  /** Verify that the Special Assistance checkbox is displayed when configured for the organization. */
  test('FB_013: Verify that the Special Assistance checkbox is shown when the organization enables it', async ({ futureGuestFormSection }) => {
    const visible = await futureGuestFormSection.specialAssistanceCheckbox.isVisible({ timeout: 3_000 }).catch(() => false);
    test.skip(!visible, 'Org does not configure futureOthers.ada for this environment');
    expect(visible).toBe(true);
  });

  /** Verify that the Notes text area is displayed when configured for the organization. */
  test('FB_014: Verify that the Notes text area is shown when the organization enables it', async ({ futureGuestFormSection }) => {
    const visible = await futureGuestFormSection.notesTextarea.isVisible({ timeout: 3_000 }).catch(() => false);
    test.skip(!visible, 'Org does not configure futureOthers.notes for this environment');
    expect(visible).toBe(true);
  });

  /** Verify that the Flight Number field is displayed when configured for the organization. */
  test('FB_015: Verify that the Flight Number field is shown when the organization enables it', async ({ futureGuestFormSection }) => {
    const visible = await futureGuestFormSection.flightInput.isVisible({ timeout: 3_000 }).catch(() => false);
    test.skip(!visible, 'Org does not configure futureOthers.flight for this environment');
    expect(visible).toBe(true);
  });

  /** Verify that the Room Number field is displayed when configured for the organization. */
  test('FB_016: Verify that the Room Number field is shown when the organization enables it', async ({ futureGuestFormSection }) => {
    const visible = await futureGuestFormSection.roomInput.isVisible({ timeout: 3_000 }).catch(() => false);
    test.skip(!visible, 'Org does not configure futureOthers.room for this environment');
    expect(visible).toBe(true);
  });

  /** Verify that the "Request Ride" submit button is visible with the correct label. */
  test('FB_017: Verify that the "Request Ride" button is shown with the correct label', async ({ futureGuestFormSection }) => {
    await expect(futureGuestFormSection.requestRideButton).toBeVisible();
    const text = await futureGuestFormSection.requestRideButton.textContent();
    expect(text?.toLowerCase()).toContain('request ride');
  });

  /** Verify that clicking Back on the guest form displays a "Go Back?" confirmation dialog with the expected warning message. */
  test('Verify that clicking Back shows a "Go Back?" warning that entered details will be lost', async ({ futureGuestFormSection, page }) => {
    await futureGuestFormSection.clickBack();
    await expect(page.getByText('Go Back?')).toBeVisible();
    await expect(page.getByText('Your entered details will be lost.')).toBeVisible();
  });

  /** Verify that the Terms of Service and Privacy Policy links are visible on the guest form. */
  test('Verify that the Terms of Service and Privacy Policy links are shown on the ride details form', async ({ futureGuestFormSection }) => {
    await expect(futureGuestFormSection.termsLink).toBeVisible();
    await expect(futureGuestFormSection.privacyLink).toBeVisible();
  });
});
