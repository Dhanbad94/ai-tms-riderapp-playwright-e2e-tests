import { Page, Locator } from '@playwright/test';
import { GuestFormSection } from './GuestFormSection';

/**
 * Future Booking variant of the "Enter Ride Details" form.
 *
 * Extends the shared GuestFormSection (ASAP's page object) rather than
 * duplicating it — the form itself is the same React component
 * (GuestFullPageForm) for both modes; only the org-configurable "Other
 * Details" fields differ:
 *  - Room Number / Flight Number placeholders are org-configured
 *    (futureOthers.room/flight.placeholder) and may not match ASAP's exact
 *    "Room Number"/"Flight Number" text, so this subclass overrides those two
 *    locators with tolerant partial matches instead of exact strings.
 *  - Rider Type radios (hidden in ASAP — see GuestFormSection.riderTypeSection
 *    and ASAP_017) can render here, gated by futureOthers.riderType.status.
 *
 * All other locators/methods (name, phone, riders dropdown, special
 * assistance, notes, submit, back/Go-Back dialog, validation-error checks)
 * are inherited unchanged from GuestFormSection.
 */
export class FutureGuestFormSection extends GuestFormSection {
  readonly roomInput: Locator;
  readonly flightInput: Locator;

  constructor(page: Page) {
    super(page);
    // Override with placeholder-tolerant locators — org-configurable text,
    // unverified against a live Future Booking org (see DateTimePicker.ts note).
    this.roomInput = page.getByPlaceholder(/Room/i);
    this.flightInput = page.getByPlaceholder(/Flight/i);
  }

  /**
   * Fill the required fields for a Future Booking submission.
   *
   * Overrides GuestFormSection.fillRequiredFields() to additionally handle
   * the two fields that are mandatory on ODFB but not on ASAP:
   *  - Room Number (futureOthers.room.optional === 0 — placeholder renders
   *    with a trailing " *"; confirmed live). Without this, "Request Ride"
   *    is blocked client-side and every @creates-ride test hangs waiting on
   *    a navigation that never happens.
   *  - Rider Type — filled defensively (first option) whenever the org
   *    renders the radios, since it's cheap and avoids the same class of
   *    silent-block failure if a given org also requires it.
   * Both are filled only when the field is actually present, so this stays
   * safe to call against an org where either is optional/disabled.
   *
   * Rider count is ALSO bounded by the actually-available options in the
   * dropdown before picking a random value, rather than the inherited
   * base's blind `1-3` random range. On Future Booking, the dropdown's max
   * is the selected slot's `seats_available` (can be less than 3 — e.g. the
   * last seat on a near-full slot), so an unbounded random pick occasionally
   * requests a rider count the slot doesn't have, hanging on a dropdown
   * option that will never appear. Confirmed live on staging/ODFB.
   */
  async fillRequiredFields(
    overrides: Partial<{ name: string; phone: string; countryCode: string; riders: number; room: string }> = {}
  ) {
    let riders = overrides.riders;
    if (riders === undefined) {
      const maxAvailable = await this.getRiderOptionCount().catch(() => 1);
      riders = Math.floor(Math.random() * Math.max(1, maxAvailable)) + 1;
    }
    const base = await super.fillRequiredFields({ ...overrides, riders });

    let room: string | undefined;
    if (await this.roomInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
      room = overrides.room || `R${Math.floor(100 + Math.random() * 900)}`;
      await this.fillRoom(room);
    }

    const riderTypeOptions = await this.getRiderTypeOptions();
    if (riderTypeOptions.length > 0 && riderTypeOptions[0]) {
      await this.selectRiderType(riderTypeOptions[0]);
    }

    return { ...base, room };
  }

  /** Select a Rider Type radio option by its visible label. */
  async selectRiderType(label: string) {
    await this.riderTypeSection.locator('label').filter({ hasText: label }).click();
  }

  /** All visible Rider Type option labels, as configured by the org. */
  async getRiderTypeOptions(): Promise<string[]> {
    const labels = this.riderTypeSection.locator('label');
    return await labels.allTextContents();
  }

  /** Whether the Rider Type section shows a required-field error message. */
  async hasRiderTypeError(): Promise<boolean> {
    const err = this.page.getByText(/Please select rider type/i);
    return await err.isVisible({ timeout: 1_000 }).catch(() => false);
  }

  /**
   * Whether the "Pick-up time expired" banner is showing — the future-booking
   * -only re-validation that runs on submit (slotsTimeExpired()), separate
   * from GuestFormSection's ASAP-oriented `timeValidationError` locator which
   * targets the same text; kept here as a semantically-named alias for
   * future-booking specs to read clearly.
   */
  async hasTimeExpiredOnSubmitError(): Promise<boolean> {
    return await this.timeValidationError.isVisible({ timeout: 2_000 }).catch(() => false);
  }
}
