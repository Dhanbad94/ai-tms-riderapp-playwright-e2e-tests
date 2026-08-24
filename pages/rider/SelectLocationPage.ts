import { Page, Locator, expect } from '@playwright/test';
import { RIDER_TIMEOUTS } from '../../constants';
import { getRiderConfig } from '../../utils/rider-config';
import { waitForElementStable } from '../../helpers/wait-strategies';

/**
 * Page Object for the Select Location screen (/a/{orgId}/location).
 */
export class SelectLocationPage {
  readonly page: Page;
  readonly pickupInput: Locator;
  readonly dropoffInput: Locator;
  readonly confirmButton: Locator;
  readonly useCurrentLocationBtn: Locator;
  readonly viewOnMapBtn: Locator;
  readonly viewStopListBtn: Locator;
  readonly mapListToggle: Locator;
  readonly backButton: Locator;
  readonly pageHeader: Locator;
  readonly dateTimeHeading: Locator;
  readonly goBackDialogHeading: Locator;
  readonly goBackConfirmBtn: Locator;
  readonly goBackCancelBtn: Locator;
  readonly notFoundMessage: Locator;
  readonly ridersDropdown: Locator;
  readonly ridersLabel: Locator;
  readonly mapThemeButton: Locator;
  readonly mapThemeDialogHeading: Locator;
  readonly mapThemeCloseButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pickupInput = page.getByPlaceholder('Pick-up from?');
    this.dropoffInput = page.getByPlaceholder('Where to?');
    // Anchored — an unanchored 'Next' also matches the MUI date-picker
    // calendar's own "Next month" arrow whenever it's open (confirmed live
    // on Future Booking: caused a 2-element strict-mode violation).
    this.confirmButton = page.getByRole('button', { name: /^(Confirm Location|Next)$/i });
    this.useCurrentLocationBtn = page.getByText(/Use Current Location|Use Closest Stop/i);
    // The location screen now DEFAULTS to the map view (MapTiler) with a single
    // toggle that flips label by state: "View Stop List" while the map shows,
    // "View on map" once the stop list shows. viewOnMapBtn is the list→map
    // control; viewStopListBtn is the map→list control; mapListToggle matches
    // whichever is currently rendered (state-agnostic presence check).
    this.viewOnMapBtn = page.getByText('View on map');
    this.viewStopListBtn = page.getByText('View Stop List');
    this.mapListToggle = page.getByText(/View Stop List|View on map/);
    this.backButton = page.locator('button').filter({ has: page.locator('img[alt="back"]') }).first();
    this.pageHeader = page.getByRole('heading', { level: 2 });
    // NOTE: the literal "Pick-up Date & Time" heading text does not exist
    // anywhere in the deployed app (confirmed live via direct DOM query on
    // Future Booking — 0 matches) despite appearing in the guestForm.js
    // source reviewed for this suite; likely a stale/mismatched source
    // version. Using the Pick-up Date input's presence instead, which is
    // live-verified and — unlike the phantom heading — actually renders only
    // when Future Booking is on, keeping verifyDateTimePickerAbsent()
    // meaningful for ASAP too (it previously always trivially passed).
    this.dateTimeHeading = page.getByPlaceholder('Pick-up Date');
    this.goBackDialogHeading = page.getByRole('heading', { name: /Go Back/i });
    this.goBackConfirmBtn = page.getByRole('button', { name: /Go Back/i });
    this.goBackCancelBtn = page.getByRole('button', { name: /Cancel/i });
    this.notFoundMessage = page.getByText(/not found in the defined service area/i);
    this.ridersDropdown = page.locator('#demo-simple-select');
    this.ridersLabel = page.getByText(/No\. of Riders/i);
    // Two icon buttons share this CSS-module class next to the map — no
    // aria-label/testid on either (stopsCard.js:248-269), so position is the
    // only way to distinguish them: index 0 opens Map Theme, index 1 is the
    // "use my location" crosshair (live-verified on staging/ODFB 2026-08-21;
    // clicking index 1 triggered a location-permission spinner, not a theme
    // dialog). If the app ever reorders these, this locator breaks loudly
    // (mapThemeDialogHeading won't appear) rather than silently.
    this.mapThemeButton = page.locator('button[class*="stopsCard_btn"]').first();
    this.mapThemeDialogHeading = page.getByRole('heading', { name: 'Map Theme' }).first();
    this.mapThemeCloseButton = page.getByRole('button', { name: 'close' }).first();
  }

  async goto(orgId?: string) {
    const config = getRiderConfig();
    const id = orgId || config.orgs.asapOnly.trackingId;
    const url = `${config.urls.ride}/a/${id.toLowerCase()}/location`;

    // Navigation to the shared staging org occasionally exceeds the default
    // timeout under parallel load (the server is slow to respond, not down).
    // Retry once on failure — loading a URL is idempotent, so this only costs
    // time on a genuinely slow first attempt.
    const MAX_NAV_ATTEMPTS = 2;
    for (let attempt = 0; attempt < MAX_NAV_ATTEMPTS; attempt++) {
      try {
        await this.page.goto(url, { waitUntil: 'domcontentloaded' });
        break;
      } catch (err) {
        if (attempt === MAX_NAV_ATTEMPTS - 1) throw err;
      }
    }
    await this.pickupInput.waitFor({ state: 'visible', timeout: RIDER_TIMEOUTS.FORM_LOAD });
  }

  async getHeaderText(): Promise<string> {
    return (await this.pageHeader.textContent()) ?? '';
  }

  async getConfirmButtonText(): Promise<string> {
    return (await this.confirmButton.textContent()) ?? '';
  }

  /**
   * Click the input and poll for the stop list to render. Returns true if the
   * list appeared, false if it stalled after MAX_OPEN_ATTEMPTS clicks.
   */
  private async tryOpenStopList(input: Locator): Promise<boolean> {
    const visibleHeadings = this.page.locator('h4:visible');
    const MAX_OPEN_ATTEMPTS = 3;
    for (let attempt = 0; attempt < MAX_OPEN_ATTEMPTS; attempt++) {
      await input.click();
      try {
        await expect
          .poll(async () => visibleHeadings.count(), { timeout: RIDER_TIMEOUTS.STOP_LIST })
          .toBeGreaterThan(0);
        return true;
      } catch {
        // Panel didn't open this attempt — loop and re-click.
      }
    }
    return false;
  }

  /**
   * Open a stop-list panel and select a stop by name.
   *
   * Resilient against the stop-list render race: clicking the input occasionally
   * lands before the list is wired up (or the list re-renders and detaches the
   * heading node). We retry opening the panel a few times, and re-query the
   * specific heading immediately before clicking to avoid stale-node detach.
   *
   * The stop list is API-driven, so a failed/slow initial fetch under parallel
   * load leaves the panel permanently empty — re-clicking never recovers it
   * because clicking does not re-trigger the fetch. When `canReload` is set we
   * reload the page (re-firing the stops request) and retry. Reload is only
   * safe before any stop is chosen; a reload would clear an already-selected
   * pickup, so it's enabled for pickup selection only.
   */
  private async openStopListAndSelect(input: Locator, stopName: string, opts: { canReload?: boolean } = {}) {
    let opened = await this.tryOpenStopList(input);

    if (!opened && opts.canReload) {
      await this.page.reload({ waitUntil: 'domcontentloaded' });
      await this.pickupInput.waitFor({ state: 'visible', timeout: RIDER_TIMEOUTS.FORM_LOAD });
      opened = await this.tryOpenStopList(input);
    }

    if (!opened) {
      throw new Error(`Stop list never rendered for "${stopName}" (canReload=${!!opts.canReload})`);
    }

    // Re-query the heading right before clicking to avoid acting on a stale node
    // from a list re-render.
    const heading = this.page.getByRole('heading', { level: 4, name: stopName }).first();
    await heading.waitFor({ timeout: RIDER_TIMEOUTS.STOP_LIST });
    // Click heading with force to bypass the parent container issue.
    await heading.click({ force: true });
    await expect(input).not.toHaveValue('', { timeout: RIDER_TIMEOUTS.STOP_LIST });
  }

  /** Select a pickup stop — clicks the stop container, waits for input value */
  async selectPickupStop(stopName: string) {
    // Reload-recover here: pickup is the first selection, so a page reload to
    // re-fetch a stalled stop list is safe (nothing to lose yet).
    await this.openStopListAndSelect(this.pickupInput, stopName, { canReload: true });
  }

  /** Select a dropoff stop — clicks the stop container, waits for input value */
  async selectDropoffStop(stopName: string) {
    // No reload here — the stops are already loaded from the pickup interaction,
    // and a reload would discard the selected pickup.
    await this.openStopListAndSelect(this.dropoffInput, stopName);
  }

  async selectBothStops(pickupName: string, dropoffName: string) {
    await this.selectPickupStop(pickupName);
    await this.selectDropoffStop(dropoffName);
  }

  /** Click "Confirm Location" / "Next". Selects riders if dropdown is inline. */
  async clickConfirm() {
    if (await this.ridersDropdown.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await this.ridersDropdown.scrollIntoViewIfNeeded();
      // MUI Select: click({ force: true }) to bypass fixed-position overlay
      await this.ridersDropdown.evaluate((el) => el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
      await this.page.getByRole('option').first().waitFor({ timeout: RIDER_TIMEOUTS.STOP_LIST });
      await this.page.getByRole('option').first().click();
      await this.page.getByRole('option').first().waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});
      // The riders MUI menu leaves an (invisible) modal backdrop mounted for a
      // beat after the option is chosen; it intercepts pointer events over the
      // whole page, so a Next/Confirm click lands on the backdrop instead of the
      // button. Wait for it to unmount before clicking.
      await this.page.locator('.MuiBackdrop-root').first()
        .waitFor({ state: 'detached', timeout: 5_000 }).catch(() => {});
    }
    try {
      await this.confirmButton.click();
    } catch {
      // Fallback if a lingering overlay still intercepts the hit-test: dispatch
      // the click directly on the DOM node so React's onClick fires regardless.
      await this.confirmButton.evaluate((el) => (el as HTMLElement).click());
    }
  }

  async verifyDateTimePickerAbsent() {
    await expect(this.dateTimeHeading).not.toBeVisible();
  }

  async verifyDateTimePickerPresent() {
    await expect(this.dateTimeHeading).toBeVisible();
  }

  async clickBack() {
    await this.backButton.click();
  }

  async confirmGoBack() {
    await waitForElementStable(this.goBackDialogHeading);
    await this.goBackConfirmBtn.click();
  }

  async cancelGoBack() {
    await this.goBackCancelBtn.click();
  }

  /**
   * Select random compatible pickup and dropoff stops from the visible list.
   * Ensures pickup ≠ dropoff. Returns the selected names for assertion.
   */
  async selectRandomStops(): Promise<{ pickup: string; dropoff: string }> {
    // Get all visible stop names for pickup
    await this.pickupInput.click();
    const pickupStops = await this.getVisibleStopNames();
    if (pickupStops.length < 2) throw new Error(`Need at least 2 stops, found ${pickupStops.length}`);

    // Pick a random pickup
    const pickupIdx = Math.floor(Math.random() * pickupStops.length);
    const pickupName: string = pickupStops[pickupIdx] ?? pickupStops[0]!;
    await this.selectPickupStop(pickupName);

    // Get available dropoff stops (pickup is filtered out)
    await this.dropoffInput.click();
    const dropoffStops = await this.getVisibleStopNames();
    const validDropoffs = dropoffStops.filter(s => s !== pickupName);
    if (validDropoffs.length === 0) throw new Error(`No valid dropoff stops after selecting ${pickupName}`);

    const dropoffIdx = Math.floor(Math.random() * validDropoffs.length);
    const dropoffName: string = validDropoffs[dropoffIdx] ?? validDropoffs[0]!;
    await this.selectDropoffStop(dropoffName);

    return { pickup: pickupName, dropoff: dropoffName };
  }

  /**
   * Try selectStopViaMapMarker() against a shuffled list of candidate stop
   * names, moving on to the next candidate if one fails outright rather than
   * throwing immediately. Needed because a subset of stops sit tightly
   * clustered on the map (live-confirmed: the "Door 2/3/4 - Bus/Shuttle Ctr"
   * stops all resolve to the same O'Hare-area coordinates, and one of them
   * shows an "08" cluster badge on its marker) — clicking one of THOSE
   * markers doesn't reliably land the carousel on that exact stop's card
   * within a normal wait, even though the card genuinely exists in the DOM
   * once the carousel is dumped by hand. Same "retry with a different
   * candidate" shape as DateTimePicker.ensureBookableSlot()/
   * pickRandomSlotViaGridView() use for their own real, live-observed races.
   */
  private async selectStopViaMapMarkerFromCandidates(candidates: string[], maxAttempts = 5): Promise<string> {
    const shuffled = [...candidates].sort(() => Math.random() - 0.5).slice(0, maxAttempts);
    let lastError: unknown;
    for (let i = 0; i < shuffled.length; i++) {
      const name = shuffled[i]!;
      // Fail fast on retry attempts (4s) rather than the full 10s — with up
      // to 5 candidates, waiting the full timeout on each would risk the
      // overall test timeout. Only the LAST candidate gets the full wait, on
      // the theory that if every other candidate has already failed fast,
      // it's worth genuinely waiting once rather than giving up early too.
      const isLast = i === shuffled.length - 1;
      try {
        await this.selectStopViaMapMarker(name, isLast ? RIDER_TIMEOUTS.STOP_LIST : 4_000);
        return name;
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError ?? new Error(`Could not select any of ${shuffled.length} candidate stops via map marker.`);
  }

  /**
   * Same as selectRandomStops(), but commits both picks via their map-marker
   * "set as pickup"/"set as drop-off" cards instead of the text stop list —
   * exercises the marker-click path with genuinely randomized stops rather
   * than a fixed pair.
   *
   * Live-diagnosed race: the drop-off list can still momentarily include the
   * just-selected pickup stop if read immediately after selectStopViaMapMarker()
   * returns — the exclusion re-render lags a beat behind the click resolving.
   * getVisibleStopNames() is polled until the pickup name actually drops out
   * before a dropoff candidate pool is built.
   */
  async selectRandomStopsViaMapMarkers(): Promise<{ pickup: string; dropoff: string }> {
    await this.pickupInput.click();
    const pickupStops = await this.getVisibleStopNames();
    if (pickupStops.length < 2) throw new Error(`Need at least 2 stops, found ${pickupStops.length}`);
    const pickupName = await this.selectStopViaMapMarkerFromCandidates(pickupStops);

    await this.dropoffInput.click();
    let dropoffStops = await this.getVisibleStopNames();
    const deadline = Date.now() + RIDER_TIMEOUTS.STOP_LIST;
    while (dropoffStops.includes(pickupName) && Date.now() < deadline) {
      await this.page.waitForTimeout(200);
      await this.dropoffInput.click();
      dropoffStops = await this.getVisibleStopNames();
    }
    const validDropoffs = dropoffStops.filter(s => s !== pickupName);
    if (validDropoffs.length === 0) throw new Error(`No valid dropoff stops after selecting ${pickupName}`);
    const dropoffName = await this.selectStopViaMapMarkerFromCandidates(validDropoffs);

    return { pickup: pickupName, dropoff: dropoffName };
  }

  async getVisibleStopNames(): Promise<string[]> {
    const names: string[] = [];
    const visibleH4 = this.page.locator('h4:visible');
    const count = await visibleH4.count();
    for (let i = 0; i < count; i++) {
      const text = await visibleH4.nth(i).textContent();
      if (text) names.push(text.trim());
    }
    return names;
  }

  /** Search stops by typing in the pickup input */
  async searchPickupStops(query: string) {
    await this.pickupInput.click();
    await this.pickupInput.fill(query);
  }

  /** Search stops by typing in the dropoff input */
  async searchDropoffStops(query: string) {
    await this.dropoffInput.click();
    await this.dropoffInput.fill(query);
  }

  /** Clear search text from the focused input */
  async clearSearch() {
    const clearIcon = this.page.locator('img[alt="clear"]').first();
    if (await clearIcon.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await clearIcon.click();
    }
  }

  /** Click "View on map" to switch to map view */
  async clickViewOnMap() {
    await this.viewOnMapBtn.click();
  }

  /**
   * Ensure the text stop list is showing. The screen defaults to the map view,
   * so the list (h4 stop headings) isn't rendered until "View Stop List" is
   * clicked. No-op when the list is already showing (toggle absent).
   */
  async showStopList() {
    if (await this.viewStopListBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await this.viewStopListBtn.click();
      await this.page.locator('h4:visible').first()
        .waitFor({ state: 'visible', timeout: RIDER_TIMEOUTS.STOP_LIST }).catch(() => {});
    }
  }

  /** Click "Use Current Location" / "Use Closest Stop" */
  async clickUseCurrentLocation() {
    await this.useCurrentLocationBtn.click();
  }

  /** Check if the location permission dialog is visible */
  async isLocationPermissionDialogVisible(): Promise<boolean> {
    const dialog = this.page.getByText(/View your location|location on Map/i);
    return await dialog.isVisible({ timeout: 3_000 }).catch(() => false);
  }

  /** Click "Allow" on the location permission dialog */
  async allowLocationPermission() {
    await this.page.getByRole('button', { name: /Allow/i }).click();
  }

  /** Click "Not Now" on the location permission dialog */
  async denyLocationPermission() {
    await this.page.getByRole('button', { name: /Not Now/i }).click();
  }

  /** Check if the location denied modal is visible */
  async isLocationDeniedModalVisible(): Promise<boolean> {
    const denied = this.page.getByText(/location.*denied|enable.*location|browser.*settings/i);
    return await denied.isVisible({ timeout: 3_000 }).catch(() => false);
  }

  /**
   * Check if the map container is visible (after "View on map" or stop
   * selection). The map is MapTiler/OpenStreetMap on this app (confirmed
   * live — MapTiler attribution links render on the location page), not
   * Google Maps, so it exposes an accessible `role="region" name="Map"`
   * rather than Google's `.gm-style` class (that locator is ASAP-specific
   * and does not apply here).
   */
  async isMapVisible(): Promise<boolean> {
    return await this.page.getByRole('region', { name: 'Map' }).isVisible({ timeout: 5_000 }).catch(() => false);
  }

  /**
   * Select a stop by clicking its marker pin directly on the map, rather
   * than from the text stop list. This is a two-step flow, live-verified on
   * staging/ODFB 2026-08-21: clicking a marker opens a swipeable carousel of
   * cards (one per stop, NOT just the one clicked) each with a "set as
   * pickup"/"set as drop-off" button — the button's label follows which
   * input (pickup/dropoff) was last focused, not which is empty, so the
   * correct input must already be focused before calling this. Clicking the
   * marker itself does not commit a selection.
   *
   * Map view is only shown by default before any stop is picked. After a
   * pickup is committed (by any method — list, search, or marker), the view
   * switches to the drop-off stop LIST, hiding the markers — "View on map"
   * must be clicked to bring them back before a second marker-based
   * selection (live-verified). This is a no-op when the map is already
   * showing, so it's always safe to call before a marker click.
   *
   * The carousel renders twice in the DOM (same dual-render quirk seen
   * elsewhere in this app's modals) — scoping to the first matching card
   * avoids acting on the duplicate.
   *
   * Markers that sit close together geographically can visually overlap
   * (MapLibre GL markers, `maplibregl-marker` divs) — a random stop's marker
   * can have a neighboring marker's div intercepting its click area, and the
   * map can also re-center/re-render mid-click (element detaches). Live
   * -confirmed with the real stop layout. `force: true` plus a short retry
   * loop mirrors DateTimePicker.selectDateByDay()'s handling of the same
   * class of overlay-intercept/detach issue.
   */
  async selectStopViaMapMarker(stopName: string, buttonTimeout: number = RIDER_TIMEOUTS.STOP_LIST) {
    const marker = this.page.locator(`img[alt="${stopName}"]`).first();
    if (!(await marker.isVisible({ timeout: 2_000 }).catch(() => false))) {
      // Switch to the map only when we're actually in the stop-list view — the
      // "View on map" control is then visible. On the default map view (e.g. the
      // first selection) that control exists but is hidden (the app keeps both
      // toggle labels mounted) and the markers are merely still loading, so
      // clicking it would land on a hidden element; just wait for the marker.
      if (await this.viewOnMapBtn.isVisible().catch(() => false)) {
        await this.viewOnMapBtn.click();
      }
      await marker.waitFor({ state: 'visible', timeout: RIDER_TIMEOUTS.STOP_LIST });
    }
    const MAX_ATTEMPTS = 3;
    let lastError: unknown;
    let clicked = false;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        await marker.click({ force: true, timeout: RIDER_TIMEOUTS.STOP_LIST });
        clicked = true;
        break;
      } catch (err) {
        lastError = err;
      }
    }
    if (!clicked) throw lastError;
    // Find the button by walking UP from the specific heading to its nearest
    // ancestor div that also contains a button, rather than filtering `div`
    // elements broadly by "has this heading somewhere AND has a button
    // somewhere" — that broader filter can match a big outer carousel-track
    // wrapper (which "has" both, via two DIFFERENT descendant cards) instead
    // of the one specific card, especially for stops whose card lands early
    // in DOM order (live-confirmed: intermittent 10s timeouts for specific
    // stops — "Door 4", "Door 2" — consistent with matching the wrong,
    // button-less-for-this-stop ancestor).
    const heading = this.page.getByRole('heading', { name: stopName, exact: true, level: 3 }).first();
    const card = heading.locator('xpath=ancestor::div[.//button][1]');
    await card.getByRole('button', { name: /^set as (pickup|drop-off)$/ }).click({ force: true, timeout: buttonTimeout });
  }

  /** Open the "Map Theme" dialog via the (unlabeled, position-based) theme icon button. */
  async openMapTheme() {
    await this.mapThemeButton.click();
    await expect(this.mapThemeDialogHeading).toBeVisible({ timeout: RIDER_TIMEOUTS.STOP_LIST });
    // The dialog's swatch images are lazy-loaded (mapTheme.js) and the dual
    // -render settles a beat after the heading itself becomes visible —
    // clicking a swatch immediately intermittently misses (live-confirmed:
    // identical click logic that reliably works with human-paced tool calls
    // failed when run back-to-back at automation speed). One MUI_DROPDOWN
    // -length wait absorbs that settle time before any swatch is clicked.
    await this.page.waitForTimeout(RIDER_TIMEOUTS.MUI_DROPDOWN);
  }

  /**
   * Select a map theme by its exact label ("Classic" | "Silver" | "Satellite").
   * The dialog dual-renders (same quirk as the carousel above), and which of
   * the two DOM instances is actually wired to React state isn't fixed by
   * position — a plain Playwright click and a `force: true` synthetic click
   * on the first match were each observed to sometimes land on the inert
   * duplicate (cookie stayed unset). A real DOM `.click()` dispatched via
   * evaluate() on EVERY matching swatch (both instances) reliably works
   * under Desktop Chrome (this project's device) — the inert one is a
   * harmless no-op, the real one commits the change regardless of position.
   * Tile-provider rendering itself can't be asserted from the DOM, so
   * callers should verify via getMapThemeCookieValue() instead (the app
   * persists the choice to a `mapTheme` cookie).
   */
  async selectMapTheme(themeName: 'Classic' | 'Silver' | 'Satellite') {
    await this.page.evaluate((label) => {
      const boxes = [...document.querySelectorAll('[class*="mapBox"]')];
      boxes.filter(b => b.textContent?.trim() === label).forEach(b => (b as HTMLElement).click());
    }, themeName);
  }

  /** Close the Map Theme dialog — same dual-render click quirk as selectMapTheme(), same evaluate()-based fix. */
  async closeMapTheme() {
    await this.page.evaluate(() => {
      document.querySelectorAll('button[aria-label="close"]').forEach(b => (b as HTMLElement).click());
    });
  }

  /** Current `mapTheme` cookie value ("1" = Classic, "2" = Silver, "3" = Satellite), or null if unset. */
  async getMapThemeCookieValue(): Promise<string | null> {
    const cookies = await this.page.context().cookies();
    return cookies.find(c => c.name === 'mapTheme')?.value ?? null;
  }
}
