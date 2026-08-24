import { test, expect } from '../../../fixtures/test-fixtures';
import { getRiderConfig, isOrgEnabled } from '../../../utils/rider-config';
import { RIDER_TAGS } from '../../../constants';

/**
 * Future Booking — Time Picker (live org data).
 *
 * Exercises the custom scroll-wheel time picker (customTimePicker.js) opened
 * from the "Pick-up Time" field. Each hour/minute/period cell has its own
 * onClick handler in the app — no drag/scroll gesture is needed, a plain
 * click selects the value (see DateTimePicker.ts).
 *
 * Deterministic lead-time / slot-expiry validation-message tests (which need
 * a controlled "now" + controlled slot list) live in future-api-payload.spec.ts
 * against mocked /slots responses instead of live data.
 */
const rc = getRiderConfig();
const org = rc.orgs.futureBookingOnly;
const { stops } = org;

test.describe(`Future Booking — Time Picker ${RIDER_TAGS.FUTURE} ${RIDER_TAGS.UI_ONLY} ${RIDER_TAGS.REGRESSION} ${RIDER_TAGS.SAFE}`, () => {
  test.beforeEach(async ({ selectLocationPage, dateTimePicker }) => {
    test.skip(!isOrgEnabled('futureBookingOnly'), 'Future Booking org not configured for this environment — set trackingId/stops in rider-config.ts');
    await selectLocationPage.goto(org.trackingId);
    await selectLocationPage.selectBothStops(stops.pickup, stops.dropoff);
    // The auto-selected date's slots can be sold out from earlier test runs —
    // rather than skip the whole test when that happens, hop to a date that
    // still has room (see DateTimePicker.ensureBookableSlot).
    await dateTimePicker.ensureBookableSlot();
  });

  /** Verify that clicking the Pick-up Time field opens the "Select Time" modal. */
  test('@smoke FB_TP_001: Clicking Pick-up Time opens the "Select Time" modal', async ({ dateTimePicker }) => {
    await dateTimePicker.openTimeModal();
    await expect(dateTimePicker.timeModalHeading).toBeVisible();
  });

  /** Verify that the Hour, Minute, and Period columns render selectable time values inside the time picker. */
  test('FB_TP_002: Hour, minute, and period columns render selectable items', async ({ dateTimePicker }) => {
    await dateTimePicker.openTimeModal();
    await expect(dateTimePicker.hourColumn.locator('[class*="picker_item"]').first()).toBeVisible();
    await expect(dateTimePicker.minuteColumn.locator('[class*="picker_item"]').first()).toBeVisible();
    await expect(dateTimePicker.periodColumn.locator('[class*="picker_item"]').first()).toBeVisible();
  });

  /** Verify that confirming a time slot closes the modal, and that "Next" enables only after both a time is confirmed and the rider count is selected. */
  test('@smoke FB_TP_003: Selecting a slot and confirming closes the modal; "Next" enables once riders are set too', async ({ dateTimePicker, selectLocationPage }) => {
    await dateTimePicker.openTimeModal();
    // The first item in each column reflects an auto-populated valid slot
    // (guestForm.js seeds pickerValue from the first returned slot) — confirm
    // it directly rather than guessing a specific hour/minute combination.
    await dateTimePicker.clickSetPickupTime();
    await expect(dateTimePicker.timeModalHeading).not.toBeVisible({ timeout: 5_000 });
    await expect(dateTimePicker.timeInput).not.toHaveValue('');

    // Confirming a time alone is NOT enough to enable "Next" — live-verified:
    // the inline "No. of Riders" dropdown must also be set. (guestForm.js's
    // `isNextEnabled` reads as time-only in source, but the deployed app
    // requires both — see DateTimePicker.ts / SelectLocationPage.ts notes on
    // other confirmed source-vs-live mismatches in this build.)
    await expect(dateTimePicker.nextButton).toBeDisabled();
    await selectLocationPage.ridersDropdown.scrollIntoViewIfNeeded();
    await selectLocationPage.ridersDropdown.evaluate((el) => el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
    await dateTimePicker.page.getByRole('option').first().click();

    await expect(dateTimePicker.nextButton).toBeEnabled({ timeout: 5_000 });
  });

  /** Verify that clicking the Close (×) button dismisses the time modal without setting a pick-up time. */
  test('FB_TP_004: Close (×) button dismisses the modal without setting a time', async ({ dateTimePicker }) => {
    const before = await dateTimePicker.timeInput.inputValue();
    await dateTimePicker.openTimeModal();
    await dateTimePicker.closeTimeModal();
    await expect(dateTimePicker.timeModalHeading).not.toBeVisible();
    await expect(dateTimePicker.timeInput).toHaveValue(before);
  });

  /** Verify that the "Next" button remains disabled until a pick-up time is confirmed. */
  test('FB_TP_005: "Next" stays disabled until a pick-up time is confirmed', async ({ dateTimePicker }) => {
    const alreadySet = (await dateTimePicker.timeInput.inputValue()) !== '';
    test.skip(alreadySet, 'A time was already restored from a prior session cookie on this run');
    await expect(dateTimePicker.nextButton).toBeDisabled();
  });

  /** Verify that List View is the default time-selection view, and that switching to Grid View displays selectable time-slot chips. */
  test('@smoke FB_TP_006: List View is the default; switching to Grid View shows full-time chips', async ({ dateTimePicker }) => {
    await dateTimePicker.openTimeModal();
    // Default view is the scroll-wheel columns.
    await expect(dateTimePicker.hourColumn.locator('[class*="picker_item"]').first()).toBeVisible();
    await expect(dateTimePicker.gridSlotChips.first()).not.toBeVisible();

    await dateTimePicker.switchToGridView();
    await expect(dateTimePicker.gridSlotChips.first()).toBeVisible();
    const labels = await dateTimePicker.getGridSlotLabels();
    expect(labels.length).toBeGreaterThan(0);
    expect(labels[0]).toMatch(/^\d{1,2}:\d{2}\s?(AM|PM)$/i);
  });

  /** Verify that selecting a time slot in Grid View and confirming it correctly sets the Pick-up Time field. */
  test('FB_TP_007: Selecting a time slot in Grid View and confirming sets the Pick-up Time field', async ({ dateTimePicker }) => {
    await dateTimePicker.openTimeModal();
    await dateTimePicker.switchToGridView();
    const labels = await dateTimePicker.getGridSlotLabels();
    const label = labels[0]!;
    await dateTimePicker.selectGridSlot(label);
    expect(await dateTimePicker.isGridSlotSelected(label)).toBe(true);
    await dateTimePicker.clickSetPickupTime();
    await expect(dateTimePicker.timeModalHeading).not.toBeVisible({ timeout: 5_000 });
    await expect(dateTimePicker.timeInput).toHaveValue(label);
  });

  /** Verify that switching from Grid View back to List View restores the scroll-wheel time columns and time selection still works. */
  test('FB_TP_008: Switching back from Grid View to List View restores the scroll-wheel columns', async ({ dateTimePicker }) => {
    await dateTimePicker.openTimeModal();
    await dateTimePicker.switchToGridView();
    await expect(dateTimePicker.gridSlotChips.first()).toBeVisible();

    await dateTimePicker.switchToListView();
    await expect(dateTimePicker.hourColumn.locator('[class*="picker_item"]').first()).toBeVisible();
    await expect(dateTimePicker.gridSlotChips.first()).not.toBeVisible();

    // Confirming from List View after switching back should still work.
    await dateTimePicker.clickSetPickupTime();
    await expect(dateTimePicker.timeModalHeading).not.toBeVisible({ timeout: 5_000 });
    await expect(dateTimePicker.timeInput).not.toHaveValue('');
  });

  /** Verify that a randomly selected time slot chosen via Grid View is accurately reflected in the Pick-up Time field. */
  test('FB_TP_009: A random slot picked via Grid View is reflected correctly in the Pick-up Time field', async ({ dateTimePicker }) => {
    const picked = await dateTimePicker.pickRandomSlotViaGridView();
    await expect(dateTimePicker.timeInput).toHaveValue(picked);
  });
});
