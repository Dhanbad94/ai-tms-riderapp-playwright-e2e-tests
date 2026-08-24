import { test, expect } from '../../../fixtures/test-fixtures';
import { getOrgConfig, getRiderConfig, canCreateRides, isOrgEnabled } from '../../../utils/rider-config';
import { RIDER_TAGS, RIDER_TIMEOUTS } from '../../../constants';

/**
 * Future Booking — Rider Details Verification After Ride Creation.
 *
 * Creates a real ride with EVERY optional field filled in (special
 * assistance, note to driver, flight number, room number, 2 riders) and
 * verifies each one is displayed correctly on the tracking/confirmation
 * screen's rider-details card (trackingCard.js, `riderItemsCard` — shared
 * with ASAP, read on the `staging` branch since that's what's deployed).
 *
 * Exact display formats below are live-verified against staging/ODFB on
 * 2026-08-21 (booking #TMS-4453), not assumed from source:
 *  - Name + guest count: "{name} ({riders} Guests)"
 *  - Phone: "+{dialCode} {phone}"
 *  - Special Assistance row renders the text "Special Assistance" (correctly
 *    spelled) even though the create-form's own checkbox label has a typo
 *    ("Special Assitance") — the two are independent strings in the source.
 *  - Note, Room Number, and Flight Number all render as the BARE value with
 *    no label/prefix (e.g. "R777", not "Room: R777").
 *  - Booking ID renders as "Booking: #TMS-{id}".
 */
const rc = getRiderConfig();
const org = rc.orgs.futureBookingOnly;

test.describe(`Future Booking — Rider Details Verification ${RIDER_TAGS.FUTURE} ${RIDER_TAGS.CREATES_RIDE} ${RIDER_TAGS.REGRESSION}`, () => {
  test.beforeEach(async () => {
    test.skip(!isOrgEnabled('futureBookingOnly'), 'Future Booking org not configured for this environment — set trackingId/stops in rider-config.ts');
    test.skip(!canCreateRides(), 'Ride creation disabled on this environment');
  });

  test.afterEach(async ({ page }) => {
    await page.waitForTimeout(RIDER_TIMEOUTS.RIDE_COOLDOWN);
  });

  /** Verify that every rider detail entered at booking time (name, guest count, phone, special assistance, note, room, flight) is displayed correctly on the tracking page after ride creation. */
  test('@sanity FB_RD_001: Every filled-in field is displayed correctly on the tracking page', async ({
    page, selectLocationPage, dateTimePicker, futureGuestFormSection, confirmationPage,
  }) => {
    const cfg = getOrgConfig('futureBookingOnly');
    const name = `PW Verify ${Date.now().toString(36).slice(-4)}`;
    const phone = cfg.phone.number;
    const room = `R${Math.floor(100 + Math.random() * 900)}`;
    const flight = `FL${Math.floor(1000 + Math.random() * 9000)}`;
    const note = `Verification note ${Date.now().toString(36).slice(-4)}`;
    const riders = 2;

    await selectLocationPage.goto(cfg.trackingId);
    await selectLocationPage.selectBothStops(cfg.stops.pickup, cfg.stops.dropoff);
    await dateTimePicker.acceptDefaultSlot();
    await selectLocationPage.clickConfirm();
    await futureGuestFormSection.waitForFormVisible();

    await futureGuestFormSection.selectCountryCode(cfg.phone.countryCode);
    await futureGuestFormSection.fillName(name);
    await futureGuestFormSection.fillPhone(phone);
    await futureGuestFormSection.selectRiders(riders);
    await futureGuestFormSection.toggleSpecialAssistance();
    await futureGuestFormSection.fillNotes(note);
    await futureGuestFormSection.fillFlight(flight);
    await futureGuestFormSection.fillRoom(room);

    await futureGuestFormSection.submitAndAwaitTracking();
    await confirmationPage.scrollRiderDetailsIntoView();

    const cardText = await confirmationPage.getRiderDetailsFullText();

    // Booking ID present in the expected format.
    expect(cardText).toMatch(/Booking: #TMS-\d+/);
    // Name + guest count.
    expect(cardText).toContain(`${name} (${riders} Guests)`);
    // Phone, prefixed with the dial code.
    expect(cardText).toContain(`+91 ${phone}`);
    // Special Assistance — correctly spelled on this screen (unlike the
    // create-form's own checkbox label, which has a typo).
    expect(cardText).toContain('Special Assistance');
    // Note to driver — bare text, no label.
    expect(cardText).toContain(note);
    // Room number — bare value, no label.
    expect(cardText).toContain(room);
    // Flight number — bare value, no label.
    expect(cardText).toContain(flight);

    // Pickup/drop-off stop names render as headings in a separate section.
    await expect(page.getByRole('heading', { name: cfg.stops.pickup })).toBeVisible();
    await expect(page.getByRole('heading', { name: cfg.stops.dropoff })).toBeVisible();
  });

  /** Verify that optional fields left empty at booking time (special assistance, note, flight number) do not render on the tracking page's rider-details card. */
  test('FB_RD_002: Optional fields left empty are correctly absent from the tracking page', async ({
    confirmationPage, selectLocationPage, dateTimePicker, futureGuestFormSection,
  }) => {
    const cfg = getOrgConfig('futureBookingOnly');

    await selectLocationPage.goto(cfg.trackingId);
    await selectLocationPage.selectBothStops(cfg.stops.pickup, cfg.stops.dropoff);
    await dateTimePicker.acceptDefaultSlot();
    await selectLocationPage.clickConfirm();
    await futureGuestFormSection.waitForFormVisible();

    // fillRequiredFields() fills only the mandatory fields (name, phone,
    // riders, room — room is mandatory on ODFB) — special assistance, note,
    // and flight are deliberately left untouched.
    await futureGuestFormSection.fillRequiredFields();
    await futureGuestFormSection.submitAndAwaitTracking();
    await confirmationPage.scrollRiderDetailsIntoView();

    const cardText = await confirmationPage.getRiderDetailsFullText();
    expect(cardText).not.toContain('Special Assistance');
  });
});
