import { Page, Locator, expect } from '@playwright/test';
import { RIDER_TIMEOUTS } from '../../constants';

/**
 * Page Object for the "Pick-up Date & Time" section (GuestForm), shown on the
 * location/map screen only when the org has Future Booking enabled
 * (future_booking.status === true). Absent entirely in ASAP-only mode — see
 * SelectLocationPage.verifyDateTimePickerAbsent()/verifyDateTimePickerPresent().
 *
 * Wraps two distinct pieces of app UI:
 *  - an MUI <DatePicker> (date field + calendar popper), restricted to
 *    org-available dates only (shouldDisableDate)
 *  - a custom scroll-wheel time picker (hour/minute/period columns) opened
 *    from a "Pick-up Time" field inside a modal dialog
 *
 * NOTE: locators here are grounded directly in the app source
 * (src/components/web/guestForm/guestForm.js and its customTimePicker
 * subcomponent) rather than a live-verified staging org, since no Future
 * Booking org is configured yet (see rider-config.ts PLACEHOLDER_ORG /
 * isOrgEnabled()). Re-verify against the real app once a trackingId is set,
 * the same way the ASAP page objects were refined against ODASAP.
 */
export class DateTimePicker {
  readonly page: Page;

  // Section heading + inline error banners (rendered above the card, plain
  // "errorMsg" class — not CSS-module scoped, so this is a literal match).
  readonly heading: Locator;
  readonly inlineErrorBanner: Locator;

  // Date field — MUI TextField, placeholder "Pick-up Date", readOnly (opens
  // the calendar on click rather than accepting typed input).
  readonly dateInput: Locator;
  readonly calendarPopper: Locator;

  // Time field — opens the time-selection modal on click.
  readonly timeInput: Locator;

  // Time modal
  readonly timeModalHeading: Locator;
  readonly timeModalCloseButton: Locator;
  readonly timeExpiredError: Locator;
  readonly hourColumn: Locator;
  readonly minuteColumn: Locator;
  readonly periodColumn: Locator;
  readonly seatsAvailableText: Locator;
  readonly setPickupTimeButton: Locator;

  // List/Grid view toggle — two buttons in the modal header. "List View" (the
  // scroll-wheel hour/minute/period columns above) is the default; the second,
  // icon-only button switches to a flat grid of full-time chips instead
  // (confirmed live on staging/ODFB — see gridSlotChips below).
  readonly listViewToggleButton: Locator;
  readonly gridViewToggleButton: Locator;
  readonly gridSlotChips: Locator;

  // Shared "Next" CTA at the bottom of the card (same element SelectLocationPage
  // .confirmButton targets — future booking renders it as "Next").
  readonly nextButton: Locator;

  constructor(page: Page) {
    this.page = page;

    this.heading = page.getByText('Pick-up Date & Time');
    this.inlineErrorBanner = page.locator('.errorMsg');

    this.dateInput = page.getByPlaceholder('Pick-up Date');
    // MUI X DatePicker renders the open calendar in a popper; day cells use the
    // library's own MuiPickersDay class (stable across app releases, same
    // pattern this repo already uses for `.rider-drop` / `#demo-simple-select`).
    this.calendarPopper = page.locator('.MuiPickersPopper-root, .MuiPickersLayout-root');

    this.timeInput = page.getByPlaceholder('Pick-up Time');

    // NOTE: the app renders the entire time-modal content twice in the DOM
    // (confirmed live on staging/ODFB — two identical sets of "Select Time"
    // heading, hour/minute/period columns, and the "Set Pick-up Time" button;
    // likely a duplicate-for-responsive/print render, not something QA should
    // "fix" in the app). Every page-level (non-column-scoped) locator here
    // uses .first() so interactions consistently target the first copy.
    this.timeModalHeading = page.getByText('Select Time', { exact: true }).first();
    this.timeModalCloseButton = page.getByRole('button', { name: 'close' }).first();
    // "Bookings are only available from…" / "Please select a time at least…"
    this.timeExpiredError = this.timeModalHeading
      .locator('..')
      .locator('..')
      .getByText(/Bookings are only available from|Please select a time at least/i)
      .first();
    this.hourColumn = page.locator('[class*="picker_column"]').nth(0);
    this.minuteColumn = page.locator('[class*="picker_column"]').nth(1);
    this.periodColumn = page.locator('[class*="picker_column"]').nth(2);
    this.seatsAvailableText = page.getByText(/seats available/i).first();
    this.setPickupTimeButton = page.getByRole('button', { name: 'Set Pick-up Time' }).first();

    // The toggle pair only shows its active button's text label ("List View"
    // / "Grid View") — the inactive one renders icon-only with no accessible
    // name (confirmed live) — so these are targeted positionally within the
    // toggle wrapper rather than by name, scoped to the first (of the
    // duplicated) modal copies via .first() on the wrapper itself.
    const viewToggleWrapper = page.locator('[class*="viewToggleWrapper"]').first();
    this.listViewToggleButton = viewToggleWrapper.locator('button').nth(0);
    this.gridViewToggleButton = viewToggleWrapper.locator('button').nth(1);
    this.gridSlotChips = page.locator('[class*="gridSlotChip"]');

    // Anchored regex — an unanchored 'Next' also matches the calendar's own
    // "Next month" arrow button whenever the date popper happens to still be
    // in the DOM (confirmed live: a plain /Next/i caused a 2-element strict
    // -mode violation once the calendar had been opened earlier in a test).
    this.nextButton = page.getByRole('button', { name: /^(Confirm Location|Next)$/i });
  }

  /** Click the date field to open the MUI calendar popper. */
  async openDatePicker() {
    await this.dateInput.click();
    await this.calendarPopper.first().waitFor({ state: 'visible', timeout: RIDER_TIMEOUTS.DATE_PICKER });
    // The popper container mounts a beat before its day cells render (and
    // before shouldDisableDate has applied enabled/disabled state to them) —
    // wait for at least one day cell before any caller reads/acts on them.
    await this.page.locator('.MuiPickersDay-root').first().waitFor({ state: 'visible', timeout: RIDER_TIMEOUTS.DATE_PICKER });
  }

  /**
   * Locate a day cell by its EXACT day-of-month number. `hasText` does
   * substring matching by default, so a plain string ("4") would also match
   * "14"/"24"/"34" — an anchored regex avoids picking the wrong (possibly
   * disabled/invisible) day.
   */
  private dayCellLocator(day: number | string): Locator {
    return this.page.locator('.MuiPickersDay-root', { hasText: new RegExp(`^${day}$`) }).first();
  }

  /**
   * Select a day in the open calendar by its visible day-of-month number
   * (e.g. "15"). Only enabled (org-available) days are clickable; disabled
   * days ignore the click per MUI's own disabled-day handling.
   */
  async selectDateByDay(day: number | string) {
    // The calendar can still be mid-re-render right after its cells first
    // become visible/enabled-state-settled (observed live: a day cell
    // detaches from the DOM between locating it and the click landing,
    // "element was detached from the DOM, retrying" followed by a timeout).
    // Same class of re-render race SelectLocationPage.openStopListAndSelect()
    // already retries for the stop list — re-query the cell fresh each
    // attempt rather than reusing a single possibly-stale locator resolution.
    const MAX_ATTEMPTS = 3;
    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        const dayCell = this.dayCellLocator(day);
        await dayCell.waitFor({ state: 'visible', timeout: RIDER_TIMEOUTS.DATE_PICKER });
        // MUI's day-row container (.MuiDayCalendar-weekContainer) intercepts the
        // pointer event before it reaches the day button (same class of MUI
        // overlay quirk already worked around for the riders <Select> and the
        // stop-list heading elsewhere in this repo — see SelectLocationPage).
        await dayCell.click({ force: true, timeout: RIDER_TIMEOUTS.DATE_PICKER });
        return;
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError;
  }

  /**
   * Whether the given day-of-month is disabled (not an org-available date).
   * MUI marks disabled days with a real `disabled` attribute/property (+ a
   * `Mui-disabled` class) — NOT `aria-disabled` (confirmed live on staging:
   * every day cell, enabled or not, has `aria-disabled=null`; only `.disabled`
   * distinguishes them). Uses Playwright's isDisabled(), which reads the
   * actual disabled state rather than an ARIA attribute that isn't set here.
   */
  async isDateDisabled(day: number | string): Promise<boolean> {
    return await this.dayCellLocator(day).isDisabled();
  }

  /** Day-of-month numbers for every currently selectable (org-available) date. */
  async getEnabledDayNumbers(): Promise<string[]> {
    const cells = this.page.locator('.MuiPickersDay-root:not(.Mui-disabled)');
    return await cells.allTextContents();
  }

  /**
   * Same as getEnabledDayNumbers(), but polls briefly first — MUI applies
   * the Mui-disabled class to each cell a beat after the popper/cells
   * themselves become visible, so reading immediately after openDatePicker()
   * can transiently see zero enabled days even though the calendar does have
   * available dates. Throws if none are enabled once the poll window elapses.
   */
  private async waitForEnabledDayNumbers(): Promise<string[]> {
    await expect.poll(() => this.getEnabledDayNumbers(), { timeout: RIDER_TIMEOUTS.DATE_PICKER })
      .not.toHaveLength(0);
    return await this.getEnabledDayNumbers();
  }

  /**
   * Open the calendar and pick a random org-available date. Used both to
   * exercise date randomization directly, and as the fallback inside
   * ensureBookableSlot() when the currently-selected date has run out of
   * remaining seats. Returns the day-of-month picked, for assertions.
   */
  async selectRandomAvailableDate(): Promise<string> {
    await this.openDatePicker();
    const enabledDays = await this.waitForEnabledDayNumbers();
    const day = enabledDays[Math.floor(Math.random() * enabledDays.length)]!;
    await this.selectDateByDay(day);
    return day;
  }

  /** Current value shown in the date field — literal "Today" when today is selected. */
  async getSelectedDateText(): Promise<string> {
    return (await this.dateInput.inputValue().catch(async () => (await this.dateInput.textContent()) ?? '')) ?? '';
  }

  /** Click the Pick-up Time field to open the time-selection modal. */
  async openTimeModal() {
    await this.timeInput.click();
    await expect(this.timeModalHeading).toBeVisible({ timeout: RIDER_TIMEOUTS.FORM_LOAD });
  }

  async closeTimeModal() {
    await this.timeModalCloseButton.click();
  }

  /** Whether the Pick-up Time field is disabled (no slots for the selected date). */
  async isTimeInputDisabled(): Promise<boolean> {
    return await this.timeInput.isDisabled();
  }

  /** Click a specific hour/minute/period value inside the open time modal. */
  async selectHour(hour: string) {
    await this.hourColumn.locator('[class*="picker_item"]', { hasText: hour }).first().click();
  }

  async selectMinute(minute: string) {
    await this.minuteColumn.locator('[class*="picker_item"]', { hasText: minute }).first().click();
  }

  async selectPeriod(period: 'AM' | 'PM') {
    await this.periodColumn.locator('[class*="picker_item"]', { hasText: period }).first().click();
  }

  /** Pick an hour/minute/period triple in one call. */
  async selectTime({ hour, minute, period }: { hour: string; minute: string; period: 'AM' | 'PM' }) {
    await this.selectHour(hour);
    await this.selectMinute(minute);
    await this.selectPeriod(period);
  }

  /** Confirm the selected time — closes the modal and enables the "Next" CTA. */
  async clickSetPickupTime() {
    await this.setPickupTimeButton.click();
  }

  /** Switch the open time modal to the scroll-wheel "List View" (the default). */
  async switchToListView() {
    await this.listViewToggleButton.click();
    await expect(this.hourColumn.locator('[class*="picker_item"]').first()).toBeVisible({ timeout: RIDER_TIMEOUTS.MUI_DROPDOWN * 4 });
  }

  /** Switch the open time modal to "Grid View" — a flat grid of full-time chips (e.g. "9:00 AM"). */
  async switchToGridView() {
    await this.gridViewToggleButton.click();
    await expect(this.gridSlotChips.first()).toBeVisible({ timeout: RIDER_TIMEOUTS.MUI_DROPDOWN * 4 });
  }

  /** All time labels ("9:00 AM", …) offered in the currently-open Grid View. */
  async getGridSlotLabels(): Promise<string[]> {
    return await this.gridSlotChips.allTextContents();
  }

  /** Select a slot in Grid View by its exact visible time label (e.g. "9:00 AM"). */
  async selectGridSlot(label: string) {
    await this.gridSlotChips.filter({ hasText: new RegExp(`^${label}$`) }).first().click();
  }

  /** Whether the given Grid View chip is currently selected (visual "chip selected" state). */
  async isGridSlotSelected(label: string): Promise<boolean> {
    const chip = this.gridSlotChips.filter({ hasText: new RegExp(`^${label}$`) }).first();
    const classes = await chip.getAttribute('class').catch(() => '');
    return (classes ?? '').includes('Selected');
  }

  /**
   * Exercise both time-picker views end-to-end: open the modal (defaults to
   * List View), switch to Grid View and pick a random slot from it, confirm,
   * then reopen and switch back to List View to leave it in its default state.
   * Returns the grid label that was picked.
   */
  async pickRandomSlotViaGridView(maxAttempts = 4): Promise<string> {
    await this.openTimeModal();
    await this.switchToGridView();
    const labels = await this.getGridSlotLabels();
    if (labels.length === 0) throw new Error('Grid View reported no time-slot chips.');

    // A slot chip is a valid combination, but if the picked date is TODAY a
    // chip can still be rejected at confirm time if it's fallen inside the
    // minimum lead-time window between being listed and being confirmed
    // (slotsTimeExpired() in the app) — a genuine, if infrequent, real-time
    // race rather than a locator bug. Retry with a different chip if so.
    const remaining = [...labels].sort(() => Math.random() - 0.5).slice(0, maxAttempts);
    for (const label of remaining) {
      await this.selectGridSlot(label);
      await this.clickSetPickupTime();
      const confirmed = await this.timeInput.inputValue().catch(() => '');
      if (confirmed === label) return label;
      // Rejected — the modal stays open with a lead-time error; try the next chip.
      const stillOpen = await this.timeModalHeading.isVisible({ timeout: 1_000 }).catch(() => false);
      if (!stillOpen) await this.openTimeModal();
      await this.switchToGridView();
    }
    throw new Error(`Could not confirm any of ${remaining.length} randomly-tried Grid View slots (all rejected, likely lead-time expiry).`);
  }

  /** Full happy-path: open the modal, pick a time, confirm it. */
  async pickTime(time: { hour: string; minute: string; period: 'AM' | 'PM' }) {
    await this.openTimeModal();
    await this.selectTime(time);
    await this.clickSetPickupTime();
  }

  /**
   * Ensure the Pick-up Time field is fillable before proceeding. The date
   * guestForm.js auto-selects on load (today, if available) can run out of
   * remaining seats over the course of a test session — confirmed live: every
   * ride this suite creates consumes one seat from its slot, and once a
   * whole day is exhausted the Pick-up Time input is left `disabled` with no
   * slots to pick. Tries a handful of other available dates (shuffled) when
   * that happens, since under heavy test-session load more than one nearby
   * date can be sold out — not just today.
   */
  async ensureBookableSlot(maxAttempts = 5) {
    if (!(await this.isTimeInputDisabled())) return;

    await this.openDatePicker();
    const enabledDays = await this.waitForEnabledDayNumbers();
    const candidates = [...enabledDays].sort(() => Math.random() - 0.5).slice(0, maxAttempts);

    for (const day of candidates) {
      await this.openDatePicker();
      await this.selectDateByDay(day);
      try {
        await expect(this.timeInput).toBeEnabled({ timeout: RIDER_TIMEOUTS.SLOTS_LOAD });
        return;
      } catch {
        // This date is also sold out — loop tries the next candidate.
      }
    }
    throw new Error(`No bookable slot found among ${candidates.length} candidate dates (all sold out or errored).`);
  }

  /**
   * Accept whichever slot is pre-selected when the modal opens. guestForm.js
   * seeds pickerValue from the first slot returned by /slots on fetch
   * (fetchTimeSlots: `setPickerValue({hour: firstSlot.hour, ...})`), so simply
   * confirming without changing the columns books the earliest available slot
   * for the currently-selected date. The building block every future-booking
   * spec that needs to reach the guest form uses to get past the date/time step.
   */
  async acceptDefaultSlot() {
    await this.ensureBookableSlot();
    await this.openTimeModal();
    await this.clickSetPickupTime();
  }

  /**
   * Pick a random org-available date, then a random VALID time slot on that
   * date (via Grid View, whose chips are one-per-slot, so no combination can
   * be invalid), and confirm it. Returns what was picked so callers can
   * assert against it downstream.
   *
   * Retries across a handful of shuffled candidate dates (same reasoning as
   * ensureBookableSlot()) since a randomly-picked date can turn out to be
   * fully booked under heavy test-session load.
   *
   * IMPORTANT: does NOT pick hour/minute/period independently from the
   * scroll-wheel List View columns — confirmed live that this can silently
   * fail. The minute column is filtered per selected hour (filteredMinutes()
   * in guestForm.js), so an hour and a minute chosen independently of each
   * other can land on a combination no real slot has; handleSetPickUpTime()
   * then just sets a validation error and leaves Pick-up Time empty, with no
   * thrown exception to catch. Grid View sidesteps this entirely since each
   * chip already IS a real, selectable slot.
   */
  async selectRandomDateAndTime(maxAttempts = 5): Promise<{ day: string; label: string }> {
    await this.openDatePicker();
    const enabledDays = await this.waitForEnabledDayNumbers();
    const candidates = [...enabledDays].sort(() => Math.random() - 0.5).slice(0, maxAttempts);

    let day: string | undefined;
    for (const candidate of candidates) {
      await this.openDatePicker();
      await this.selectDateByDay(candidate);
      try {
        await expect(this.timeInput).toBeEnabled({ timeout: RIDER_TIMEOUTS.SLOTS_LOAD });
        day = candidate;
        break;
      } catch {
        // Sold out — try the next candidate date.
      }
    }
    if (!day) throw new Error(`No bookable date found among ${candidates.length} random candidates (all sold out or errored).`);

    const label = await this.pickRandomSlotViaGridView();
    return { day, label };
  }

  /** Text of the in-modal lead-time/earliest-slot validation error, if shown. */
  async getTimeExpiredErrorText(): Promise<string | null> {
    if (!(await this.timeExpiredError.isVisible({ timeout: 2_000 }).catch(() => false))) return null;
    return (await this.timeExpiredError.textContent())?.trim() ?? null;
  }

  /** Text of the section-level inline error banner (no dates/slots available, etc.), if shown. */
  async getInlineErrorText(): Promise<string | null> {
    if (!(await this.inlineErrorBanner.first().isVisible({ timeout: 2_000 }).catch(() => false))) return null;
    return (await this.inlineErrorBanner.first().textContent())?.trim() ?? null;
  }
}
