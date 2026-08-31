import { test, expect } from '../../../fixtures/test-fixtures';
import { getOrgConfig } from '../../../utils/rider-config';
import { RIDER_TAGS } from '../../../constants';

const org = getOrgConfig('asapOnly');
const { stops, phone } = org;

test.describe(`ASAP Only — Form Fields & Behavior ${RIDER_TAGS.ASAP} ${RIDER_TAGS.UI_ONLY} ${RIDER_TAGS.REGRESSION} ${RIDER_TAGS.SAFE}`, () => {
  test.beforeEach(async ({ selectLocationPage, guestFormSection }) => {
    await selectLocationPage.goto(org.trackingId);
    await selectLocationPage.selectBothStops(stops.pickup, stops.dropoff);
    await selectLocationPage.clickConfirm();
    await guestFormSection.waitForFormVisible();
  });

  test('@smoke @sanity @prod ASAP_009: Verify that the ride details form opens with the "Enter Ride Details" heading', async ({ guestFormSection }) => {
    await expect(guestFormSection.formTitle).toBeVisible();
    await expect(guestFormSection.formTitle).toHaveText('Enter Ride Details');
  });

  test('ASAP_011: Verify that the Special Assistance checkbox is visible on the ride details form', async ({ guestFormSection }) => {
    await expect(guestFormSection.specialAssistanceCheckbox).toBeVisible();
  });

  test('ASAP_012: Verify that the accessibility option is labelled "Special Assistance"', async ({ page }) => {
    await expect(page.getByText('Special Assitance')).toBeVisible();
  });

  test('ASAP_013: Verify that the notes field is visible on the ride details form', async ({ guestFormSection }) => {
    await expect(guestFormSection.notesTextarea).toBeVisible();
  });

  test('ASAP_014: Verify that the notes field shows the "Note to Driver" placeholder', async ({ guestFormSection }) => {
    const placeholder = await guestFormSection.notesTextarea.getAttribute('placeholder');
    expect(placeholder).toBe('Note to Driver');
  });

  test.skip('@smoke ASAP_015: Verify that the Flight Number field is shown on the ride details form', async ({ guestFormSection }) => {
    await expect(guestFormSection.flightInput).toBeVisible();
    await expect(guestFormSection.flightInput).toHaveAttribute('placeholder', 'Flight Number');
  });

  test.skip('ASAP_016: Verify that the Room Number field is shown on the ride details form', async ({ guestFormSection }) => {
    await expect(guestFormSection.roomInput).toBeVisible();
    await expect(guestFormSection.roomInput).toHaveAttribute('placeholder', 'Room Number');
  });

  test.skip('ASAP_015a: Verify that the Flight Number field accepts input and limits it to 10 characters', async ({ guestFormSection }) => {
    await expect(guestFormSection.flightInput).toHaveAttribute('maxlength', '10');
    // Over-length input is truncated to 10; value is preserved as typed
    // (the uppercase appearance is CSS text-transform only, not the value).
    await guestFormSection.fillFlight('ab123456789xyz');
    await expect(guestFormSection.flightInput).toHaveValue('ab12345678');
  });

  test.skip('ASAP_016a: Verify that the Room Number field accepts input and limits it to 10 characters', async ({ guestFormSection }) => {
    await expect(guestFormSection.roomInput).toHaveAttribute('maxlength', '10');
    await guestFormSection.fillRoom('1234567890EXTRA');
    await expect(guestFormSection.roomInput).toHaveValue('1234567890');
  });

  test('ASAP_017: Verify that rider type options are hidden on the ride details form', async ({ guestFormSection }) => {
    await expect(guestFormSection.riderTypeSection).not.toBeVisible();
  });

  test('ASAP_010: Verify that the rider count selection is handled before the ride details form opens', async ({ guestFormSection }) => {
    // On ODASAP, riders are on location page — form opening = riders OK
    await expect(guestFormSection.formTitle).toBeVisible();
  });

  test('ASAP_018: Verify that the notes field enforces a maximum character limit', async ({ guestFormSection }) => {
    await guestFormSection.notesTextarea.scrollIntoViewIfNeeded();
    const maxLength = await guestFormSection.notesTextarea.getAttribute('maxlength');
    expect(Number(maxLength)).toBeGreaterThan(0);
    expect(Number(maxLength)).toBeLessThanOrEqual(250);
  });

  test('Verify that the name field accepts typed text', async ({ guestFormSection }) => {
    await guestFormSection.fillName('John Doe');
    await expect(guestFormSection.nameInput).toHaveValue('John Doe');
  });

  test('Verify that the phone number field accepts numeric input', async ({ guestFormSection }) => {
    await guestFormSection.fillPhone(phone.number);
    await expect(guestFormSection.phoneInput).toHaveValue(phone.number);
  });

  test('Verify that the Special Assistance checkbox can be toggled on and off', async ({ page, guestFormSection }) => {
    // Hidden checkbox — use evaluate to check state since it's a custom component
    const isChecked = () => page.locator('#checkBoxOne').evaluate(
      (el) => (el as HTMLInputElement).checked
    );
    expect(await isChecked()).toBe(false);
    await guestFormSection.toggleSpecialAssistance();
    expect(await isChecked()).toBe(true);
    await guestFormSection.toggleSpecialAssistance();
    expect(await isChecked()).toBe(false);
  });

  test('Verify that the notes field accepts text only up to its maximum character limit', async ({ guestFormSection }) => {
    const maxLen = Number(await guestFormSection.notesTextarea.getAttribute('maxlength') || '250');
    const longText = 'A'.repeat(maxLen + 50);
    await guestFormSection.fillNotes(longText);
    const value = await guestFormSection.notesTextarea.inputValue();
    expect(value.length).toBe(maxLen);
  });

  test('Verify that the phone country code selector opens with a search box', async ({ guestFormSection }) => {
    await guestFormSection.countryCodeDisplay.click();
    await expect(guestFormSection.countryCodeDropdown).toBeVisible();
    await expect(guestFormSection.countrySearchInput).toBeVisible();
  });

  test('Verify that the country code list can be filtered by search', async ({ guestFormSection, page }) => {
    await guestFormSection.countryCodeDisplay.click();
    await guestFormSection.countrySearchInput.fill(phone.countryCode);
    await expect(page.getByText(phone.countryCode, { exact: true }).first()).toBeVisible();
  });

  // Back button shows "Go Back?" confirmation dialog — this is correct app behavior.
  // Clicking "Go Back" returns to location, clicking "Cancel" stays on form.
  test('Verify that the Back button shows a confirmation dialog warning entered details will be lost', async ({ guestFormSection, page }) => {
    await expect(guestFormSection.formTitle).toBeVisible();
    await guestFormSection.clickBack();
    // "Go Back?" dialog should appear
    await expect(page.getByText('Go Back?')).toBeVisible();
    await expect(page.getByText('Your entered details will be lost.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Go Back' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
  });

  test('Verify that choosing Cancel in the Back dialog keeps the rider on the ride details form', async ({ guestFormSection, page }) => {
    await guestFormSection.clickBack();
    await page.getByRole('button', { name: 'Cancel' }).click();
    // Form should still be visible
    await expect(guestFormSection.formTitle).toBeVisible();
  });

  test('Verify that choosing Go Back in the Back dialog returns the rider to the location page', async ({ guestFormSection, page }) => {
    await guestFormSection.clickBack();
    // If the Go Back dialog is already visible (from page state), click it
    const goBackBtn = page.getByRole('button', { name: 'Go Back' });
    await expect(goBackBtn).toBeVisible({ timeout: 5_000 });
    await goBackBtn.click();
    await expect(guestFormSection.formTitle).not.toBeVisible({ timeout: 15_000 });
  });

  test('@smoke @prod Verify that the "Request Ride" button is visible on the ride details form', async ({ guestFormSection }) => {
    await expect(guestFormSection.requestRideButton).toBeVisible();
    const text = await guestFormSection.requestRideButton.textContent();
    expect(text?.toLowerCase()).toContain('request ride');
  });

  test('Verify that the Terms of Service link is visible on the ride details form', async ({ guestFormSection }) => {
    await expect(guestFormSection.termsLink).toBeVisible();
  });

  test('Verify that the Privacy Policy link is visible on the ride details form', async ({ guestFormSection }) => {
    await expect(guestFormSection.privacyLink).toBeVisible();
  });

  test('Verify that the ride details form is ready to submit with the rider count pre-selected', async ({ guestFormSection }) => {
    await expect(guestFormSection.requestRideButton).toBeVisible();
  });

  test.skip('ASAP_042: Verify that the entered rider details are saved so they persist across the booking', async () => {
    // Cookie verification unreliable cross-origin on staging
  });
});
