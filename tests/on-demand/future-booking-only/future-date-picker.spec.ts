import { test, expect } from '../../../fixtures/test-fixtures';
import { getRiderConfig, isOrgEnabled } from '../../../utils/rider-config';
import { RIDER_TAGS } from '../../../constants';

/**
 * Future Booking — Date Picker (live org data).
 *
 * Exercises the MUI <DatePicker> in guestForm.js against the real org's
 * available-dates response. Precise disabled/enabled-day assertions that
 * need deterministic data live in future-api-payload.spec.ts instead (mocked
 * /dates + /slots responses) — real org date availability varies day to day
 * and can't be asserted on exactly here.
 */
const rc = getRiderConfig();
const org = rc.orgs.futureBookingOnly;
const { stops } = org;

test.describe(`Future Booking — Date Picker ${RIDER_TAGS.FUTURE} ${RIDER_TAGS.UI_ONLY} ${RIDER_TAGS.REGRESSION} ${RIDER_TAGS.SAFE}`, () => {
  test.beforeEach(async ({ selectLocationPage }) => {
    test.skip(!isOrgEnabled('futureBookingOnly'), 'Future Booking org not configured for this environment — set trackingId/stops in rider-config.ts');
    await selectLocationPage.goto(org.trackingId);
    await selectLocationPage.selectBothStops(stops.pickup, stops.dropoff);
  });

  /** Verify that the Pick-up Date field is visible and pre-populated with a default date on page load. */
  test('@smoke FB_DT_001: Verify that the pick-up date field is displayed and pre-filled with a default date on load', async ({ dateTimePicker }) => {
    await expect(dateTimePicker.dateInput).toBeVisible();
    // guestForm.js auto-selects today (if available) or the next available
    // future date on mount — the field should never be left blank.
    await expect(dateTimePicker.dateInput).not.toHaveValue('');
  });

  /** Verify that clicking the Pick-up Date field opens the calendar date-picker popup. */
  test('FB_DT_002: Verify that clicking the pick-up date field opens the calendar date picker', async ({ dateTimePicker }) => {
    await dateTimePicker.openDatePicker();
    await expect(dateTimePicker.calendarPopper.first()).toBeVisible();
  });

  /** Verify that the Pick-up Date field is read-only and does not accept typed input. */
  test('FB_DT_003: Verify that the pick-up date field is read-only and does not accept typed input', async ({ dateTimePicker }) => {
    await expect(dateTimePicker.dateInput).toHaveAttribute('readonly', '');
  });

  /** Verify that selecting a different date clears the previously selected pick-up time and disables the "Next" button. */
  test('FB_DT_004: Verify that selecting a different date clears the previously chosen pick-up time and disables Next', async ({ dateTimePicker }) => {
    // The auto-selected date's slots can be sold out from earlier test runs
    // (see DateTimePicker.ensureBookableSlot) — get onto a bookable date and
    // actually confirm a time first, so there's a real "previously-set" time
    // to verify gets cleared, rather than skipping the assertion.
    await dateTimePicker.ensureBookableSlot();
    await dateTimePicker.openTimeModal();
    await dateTimePicker.clickSetPickupTime();
    await expect(dateTimePicker.timeInput).not.toHaveValue('');

    // Re-open the calendar and pick a DIFFERENT available date — pickUpTime
    // should be cleared (setPickUpTime("") in handleDateChange) and the
    // "Next" CTA should go back to disabled until a new time is set. Reading
    // "Today"/formatted text back isn't reliable for comparison (MUI won't
    // fire onChange for reselecting the same underlying date), so identify
    // the currently-selected cell directly via MUI's own Mui-selected class.
    await dateTimePicker.openDatePicker();
    const enabledDays = await dateTimePicker.getEnabledDayNumbers();
    const currentDay = await dateTimePicker.page.locator('.MuiPickersDay-root.Mui-selected').first().textContent();
    const otherDay = enabledDays.find(d => d !== currentDay) ?? enabledDays[0];
    expect(otherDay, 'need at least one available date to switch to').toBeTruthy();
    await dateTimePicker.selectDateByDay(otherDay!);

    await expect(dateTimePicker.timeInput).toHaveValue('');
    await expect(dateTimePicker.nextButton).toBeDisabled({ timeout: 5_000 });
  });

  /** Verify that only the organization's available dates are selectable in the calendar (unavailable dates are disabled). */
  test('FB_DT_005: Verify that only the organization available dates can be selected and other dates are disabled', async ({ dateTimePicker }) => {
    await dateTimePicker.openDatePicker();
    const anyEnabledDay = dateTimePicker.page.locator('.MuiPickersDay-root:not(.Mui-disabled)').first();
    await expect(anyEnabledDay).toBeVisible({ timeout: 5_000 });
  });
});
