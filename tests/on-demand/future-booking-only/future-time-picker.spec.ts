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
  test('@smoke FB_TP_001: Verify that clicking the pick-up time field opens the Select Time modal', async ({ dateTimePicker }) => {
    await dateTimePicker.openTimeModal();
    await expect(dateTimePicker.timeModalHeading).toBeVisible();
  });

  /** Verify that the Hour, Minute, and Period columns render selectable time values inside the time picker. */
  test('FB_TP_002: Verify that the hour, minute, and period columns show selectable time values', async ({ dateTimePicker }) => {
    await dateTimePicker.openTimeModal();
    // Grid is the default view post Oct-2026; the scroll-wheel columns are now
    // the toggled-to view, so switch to List before asserting the columns.
    await dateTimePicker.switchToListView();
    await expect(dateTimePicker.hourColumn.locator('[class*="picker_item"]').first()).toBeVisible();
    await expect(dateTimePicker.minuteColumn.locator('[class*="picker_item"]').first()).toBeVisible();
    await expect(dateTimePicker.periodColumn.locator('[class*="picker_item"]').first()).toBeVisible();
  });

  /** Verify that confirming a time slot closes the modal, and that "Next" enables only after both a time is confirmed and the rider count is selected. */
  test('@smoke FB_TP_003: Verify that confirming a time closes the modal and Next enables only after a time and rider count are set', async ({ dateTimePicker, selectLocationPage }) => {
    await dateTimePicker.openTimeModal();
    // Ensure Grid View (idempotent — no-op on the new grid-default build, a
    // toggle on the old list-default build still live on production), then pick
    // the first offered slot explicitly so a time is committed, and confirm —
    // the modal should close and the Pick-up Time field be populated.
    await dateTimePicker.switchToGridView();
    const labels = await dateTimePicker.getGridSlotLabels();
    await dateTimePicker.selectGridSlot(labels[0]!);
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
  test('FB_TP_004: Verify that the close button dismisses the time modal without setting a pick-up time', async ({ dateTimePicker }) => {
    const before = await dateTimePicker.timeInput.inputValue();
    await dateTimePicker.openTimeModal();
    await dateTimePicker.closeTimeModal();
    await expect(dateTimePicker.timeModalHeading).not.toBeVisible();
    await expect(dateTimePicker.timeInput).toHaveValue(before);
  });

  /** Verify that the "Next" button remains disabled until a pick-up time is confirmed. */
  test('FB_TP_005: Verify that the Next button stays disabled until a pick-up time is confirmed', async ({ dateTimePicker }) => {
    const alreadySet = (await dateTimePicker.timeInput.inputValue()) !== '';
    test.skip(alreadySet, 'A time was already restored from a prior session cookie on this run');
    await expect(dateTimePicker.nextButton).toBeDisabled();
  });

  /** Verify that both the Grid View (time-slot chips) and the List View (scroll-wheel columns) are reachable and each shows its own content. */
  test('@smoke FB_TP_006: Verify that both Grid View (slot chips) and List View (scroll-wheel columns) are available', async ({ dateTimePicker }) => {
    // Build-agnostic: the DEFAULT view differs across builds (grid on the new
    // staging/preprod build, list on the old production build), so assert that
    // EACH view is reachable and shows its own content rather than which one is
    // default. The switch helpers are idempotent on both builds.
    await dateTimePicker.openTimeModal();

    await dateTimePicker.switchToGridView();
    await expect(dateTimePicker.gridSlotChips.first()).toBeVisible();
    const labels = await dateTimePicker.getGridSlotLabels();
    expect(labels.length).toBeGreaterThan(0);
    expect(labels[0]).toMatch(/^\d{1,2}:\d{2}\s?(AM|PM)$/i);

    await dateTimePicker.switchToListView();
    await expect(dateTimePicker.hourColumn.locator('[class*="picker_item"]').first()).toBeVisible();
    await expect(dateTimePicker.gridSlotChips.first()).not.toBeVisible();
  });

  /** Verify that selecting a time slot in Grid View and confirming it correctly sets the Pick-up Time field. */
  test('FB_TP_007: Verify that selecting and confirming a time slot in Grid View sets the pick-up time field', async ({ dateTimePicker }) => {
    await dateTimePicker.openTimeModal();
    await dateTimePicker.switchToGridView();
    const labels = await dateTimePicker.getGridSlotLabels();
    const label = labels[0]!;
    await dateTimePicker.selectGridSlot(label);
    // Web-first: the "Selected" class is applied a beat after the click; poll
    // rather than read once.
    await expect.poll(() => dateTimePicker.isGridSlotSelected(label)).toBe(true);
    await dateTimePicker.clickSetPickupTime();
    await expect(dateTimePicker.timeModalHeading).not.toBeVisible({ timeout: 5_000 });
    await expect(dateTimePicker.timeInput).toHaveValue(label);
  });

  /** Verify that the view can switch from the default Grid View to List View and back, and that a time can still be confirmed. */
  test('FB_TP_008: Verify that switching between Grid and List views works and a time can still be confirmed', async ({ dateTimePicker }) => {
    await dateTimePicker.openTimeModal();
    // Default is Grid; switch to List and confirm the columns appear…
    await dateTimePicker.switchToListView();
    await expect(dateTimePicker.hourColumn.locator('[class*="picker_item"]').first()).toBeVisible();
    await expect(dateTimePicker.gridSlotChips.first()).not.toBeVisible();

    // …then back to Grid, pick a slot explicitly, and confirm it commits.
    await dateTimePicker.switchToGridView();
    await expect(dateTimePicker.gridSlotChips.first()).toBeVisible();
    const labels = await dateTimePicker.getGridSlotLabels();
    await dateTimePicker.selectGridSlot(labels[0]!);
    await dateTimePicker.clickSetPickupTime();
    await expect(dateTimePicker.timeModalHeading).not.toBeVisible({ timeout: 5_000 });
    await expect(dateTimePicker.timeInput).not.toHaveValue('');
  });

  /** Verify that a randomly selected time slot chosen via Grid View is accurately reflected in the Pick-up Time field. */
  test('FB_TP_009: Verify that a random time slot picked in Grid View is shown correctly in the pick-up time field', async ({ dateTimePicker }) => {
    const picked = await dateTimePicker.pickRandomSlotViaGridView();
    await expect(dateTimePicker.timeInput).toHaveValue(picked);
  });
});
