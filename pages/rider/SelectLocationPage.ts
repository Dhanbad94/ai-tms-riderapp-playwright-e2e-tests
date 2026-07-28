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
  readonly backButton: Locator;
  readonly pageHeader: Locator;
  readonly dateTimeHeading: Locator;
  readonly goBackDialogHeading: Locator;
  readonly goBackConfirmBtn: Locator;
  readonly goBackCancelBtn: Locator;
  readonly notFoundMessage: Locator;
  readonly ridersDropdown: Locator;
  readonly ridersLabel: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pickupInput = page.getByPlaceholder('Pick-up from?');
    this.dropoffInput = page.getByPlaceholder('Where to?');
    this.confirmButton = page.getByRole('button', { name: /Confirm Location|Next/i });
    this.useCurrentLocationBtn = page.getByText(/Use Current Location|Use Closest Stop/i);
    this.viewOnMapBtn = page.getByText('View on map');
    this.backButton = page.locator('button').filter({ has: page.locator('img[alt="back"]') }).first();
    this.pageHeader = page.getByRole('heading', { level: 2 });
    this.dateTimeHeading = page.getByText('Pick-up Date & Time');
    this.goBackDialogHeading = page.getByRole('heading', { name: /Go Back/i });
    this.goBackConfirmBtn = page.getByRole('button', { name: /Go Back/i });
    this.goBackCancelBtn = page.getByRole('button', { name: /Cancel/i });
    this.notFoundMessage = page.getByText(/not found in the defined service area/i);
    this.ridersDropdown = page.locator('#demo-simple-select');
    this.ridersLabel = page.getByText(/No\. of Riders/i);
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
    }
    await this.confirmButton.click();
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

  /** Check if map container is visible (after "View on map" or stop selection) */
  async isMapVisible(): Promise<boolean> {
    return await this.page.locator('.gm-style').isVisible({ timeout: 5_000 }).catch(() => false);
  }
}
