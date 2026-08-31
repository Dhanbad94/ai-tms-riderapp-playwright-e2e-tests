import { test, expect } from '../../../fixtures/test-fixtures';
import { getOrgConfig, isOrgEnabled } from '../../../utils/rider-config';
import { RIDER_TAGS } from '../../../constants';

/**
 * Future Booking — Advanced Location Selection.
 *
 * Mirrors asap-location-advanced.spec.ts's search/random-stop/map coverage
 * for Future Booking, plus two features that file doesn't cover at all: map
 * -marker click-to-select and the map-theme switcher. All mechanics below
 * are live-verified against staging/ODFB on 2026-08-21 (source alone was
 * misleading here — this app's map is MapTiler/OpenStreetMap, not the
 * Google Maps `@react-google-maps/api` components the `staging` branch
 * source uses, yet the marker-click → carousel → "set as pickup" flow and
 * the Map Theme dialog both work exactly as that source describes).
 *
 * Kept UI-only/safe (no ride creation) — the random-stops-via-map-marker +
 * full ride creation test lives in future-e2e.spec.ts instead, alongside
 * the suite's other randomized-flow ride-creation tests.
 */
const org = getOrgConfig('futureBookingOnly');
const { stops } = org;

test.describe(`Future Booking — Stop Search ${RIDER_TAGS.FUTURE} ${RIDER_TAGS.UI_ONLY} ${RIDER_TAGS.REGRESSION} ${RIDER_TAGS.SAFE}`, () => {
  test.beforeEach(async ({ selectLocationPage }) => {
    test.skip(!isOrgEnabled('futureBookingOnly'), 'Future Booking org not configured for this environment — set trackingId/stops in rider-config.ts');
    await selectLocationPage.goto(org.trackingId);
  });

  /** Verify that searching pickup stops by a partial name returns matching results. */
  test('@smoke SEARCH_001: Verify that searching pickup stops by a partial name returns matching results', async ({ selectLocationPage }) => {
    await selectLocationPage.searchPickupStops(stops.searchKeyword);
    const results = await selectLocationPage.getVisibleStopNames();
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(name => name.toLowerCase().includes(stops.searchKeyword.toLowerCase()))).toBe(true);
  });

  /** Verify that searching drop-off stops by a partial name returns matching results. */
  test('SEARCH_002: Verify that searching drop-off stops by a partial name returns matching results', async ({ selectLocationPage }) => {
    await selectLocationPage.selectPickupStop(stops.pickup);
    await selectLocationPage.searchDropoffStops(stops.searchKeyword);
    const results = await selectLocationPage.getVisibleStopNames();
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(name => name.toLowerCase().includes(stops.searchKeyword.toLowerCase()))).toBe(true);
  });

  /** Verify that a search with no matches shows "Location not found in the defined service area." */
  test('@negative SEARCH_003: Verify that a search with no matches shows the location not found message', async ({ selectLocationPage }) => {
    await selectLocationPage.searchPickupStops('zzz_nonexistent_xyz');
    // 10s (not 5s): the screen defaults to the map view, so the search first
    // switches to the list and then debounces before the empty-state renders —
    // the tighter window flaked under parallel load.
    await expect(selectLocationPage.notFoundMessage).toBeVisible({ timeout: 10_000 });
  });

  /** Verify that clearing the search box restores the full, unfiltered stop list. */
  test('SEARCH_004: Verify that clearing the search box restores the full stop list', async ({ selectLocationPage }) => {
    await selectLocationPage.pickupInput.click();
    const allStops = await selectLocationPage.getVisibleStopNames();
    const initialCount = allStops.length;

    await selectLocationPage.searchPickupStops(stops.searchKeyword);
    const filteredStops = await selectLocationPage.getVisibleStopNames();
    expect(filteredStops.length).toBeLessThan(initialCount);

    await selectLocationPage.clearSearch();
    await selectLocationPage.pickupInput.click();
    const restoredStops = await selectLocationPage.getVisibleStopNames();
    expect(restoredStops.length).toBe(initialCount);
  });

  /** Verify that stop search is case-insensitive. */
  test('SEARCH_005: Verify that stop search returns the same results regardless of letter case', async ({ selectLocationPage }) => {
    await selectLocationPage.searchPickupStops(stops.searchKeyword.toUpperCase());
    const upper = await selectLocationPage.getVisibleStopNames();

    await selectLocationPage.clearSearch();
    await selectLocationPage.searchPickupStops(stops.searchKeyword.toLowerCase());
    const lower = await selectLocationPage.getVisibleStopNames();

    expect(upper.length).toBe(lower.length);
    expect(upper.length).toBeGreaterThan(0);
  });

  /** Verify that a randomly chosen result from a filtered search list can be selected as the pickup stop. */
  test('@sanity SEARCH_006: Verify that a random result from a filtered search can be selected as the pickup stop', async ({ selectLocationPage }) => {
    await selectLocationPage.searchPickupStops(stops.searchKeyword);
    const results = await selectLocationPage.getVisibleStopNames();
    expect(results.length).toBeGreaterThan(0);
    const randomResult = results[Math.floor(Math.random() * results.length)]!;
    await selectLocationPage.selectPickupStop(randomResult);
    await expect(selectLocationPage.pickupInput).toHaveValue(randomResult);
  });

  /** Verify that a single-character search still returns results. */
  test('SEARCH_007: Verify that searching by a single character still returns results', async ({ selectLocationPage }) => {
    await selectLocationPage.searchPickupStops('t');
    const results = await selectLocationPage.getVisibleStopNames();
    expect(results.length).toBeGreaterThan(0);
  });
});

test.describe(`Future Booking — Random Stop Selection ${RIDER_TAGS.FUTURE} ${RIDER_TAGS.UI_ONLY} ${RIDER_TAGS.REGRESSION} ${RIDER_TAGS.SAFE}`, () => {
  test.beforeEach(async ({ selectLocationPage }) => {
    test.skip(!isOrgEnabled('futureBookingOnly'), 'Future Booking org not configured for this environment — set trackingId/stops in rider-config.ts');
    await selectLocationPage.goto(org.trackingId);
  });

  /** Verify that random pickup and drop-off stops can be selected from the full listing, and are never the same stop. */
  test('@smoke RANDOM_001: Verify that random pickup and drop-off stops can be selected from the listing and are never the same stop', async ({ selectLocationPage }) => {
    const { pickup, dropoff } = await selectLocationPage.selectRandomStops();
    expect(pickup).toBeTruthy();
    expect(dropoff).toBeTruthy();
    expect(pickup).not.toBe(dropoff);
    await expect(selectLocationPage.pickupInput).toHaveValue(pickup);
    await expect(selectLocationPage.dropoffInput).toHaveValue(dropoff);
  });

  /** Verify that repeated random selections vary across runs rather than always picking the same pair. */
  test('RANDOM_002: Verify that repeated random selections vary rather than always picking the same pair', async ({ selectLocationPage, page }) => {
    const seen = new Set<string>();
    for (let i = 0; i < 4; i++) {
      await selectLocationPage.goto(org.trackingId);
      const { pickup, dropoff } = await selectLocationPage.selectRandomStops();
      seen.add(`${pickup}|${dropoff}`);
    }
    // With 8 stops (56 ordered pairs), 4 draws landing on the exact same pair
    // every time would be a ~1-in-175,000 coincidence — effectively proves
    // the picks are genuinely randomized rather than deterministic.
    expect(seen.size).toBeGreaterThan(1);
  });

  /** Verify that the full stop listing is available to pick a random pickup from. */
  test('RANDOM_003: Verify that the full stop listing is available when choosing a pickup', async ({ selectLocationPage }) => {
    await selectLocationPage.pickupInput.click();
    const stopNames = await selectLocationPage.getVisibleStopNames();
    expect(stopNames.length).toBeGreaterThanOrEqual(5);
  });

  /** Verify that the selected pickup stop is filtered out of the drop-off list. */
  test('RANDOM_004: Verify that the chosen pickup stop is removed from the drop-off list', async ({ selectLocationPage }) => {
    await selectLocationPage.pickupInput.click();
    const allPickupStops = await selectLocationPage.getVisibleStopNames();
    await selectLocationPage.selectPickupStop(stops.pickup);

    await selectLocationPage.dropoffInput.click();
    const dropoffStops = await selectLocationPage.getVisibleStopNames();
    expect(dropoffStops).not.toContain(stops.pickup);
    expect(dropoffStops.length).toBeLessThan(allPickupStops.length);
  });

  /** Verify that random pickup and drop-off stops can be selected via their map-marker pins rather than the text stop list. */
  test('@sanity RANDOM_005: Verify that random pickup and drop-off stops can be selected using their map markers', async ({ selectLocationPage }) => {
    const { pickup, dropoff } = await selectLocationPage.selectRandomStopsViaMapMarkers();
    expect(pickup).toBeTruthy();
    expect(dropoff).toBeTruthy();
    expect(pickup).not.toBe(dropoff);
    await expect(selectLocationPage.pickupInput).toHaveValue(pickup);
    await expect(selectLocationPage.dropoffInput).toHaveValue(dropoff);
  });
});

test.describe(`Future Booking — Map Marker Selection ${RIDER_TAGS.FUTURE} ${RIDER_TAGS.UI_ONLY} ${RIDER_TAGS.REGRESSION} ${RIDER_TAGS.SAFE}`, () => {
  test.beforeEach(async ({ selectLocationPage }) => {
    test.skip(!isOrgEnabled('futureBookingOnly'), 'Future Booking org not configured for this environment — set trackingId/stops in rider-config.ts');
    await selectLocationPage.goto(org.trackingId);
  });

  /** Verify that clicking a stop's marker pin on the map opens a card offering to set it as pickup or drop-off. */
  test('@smoke MAPPIN_001: Verify that clicking a stop map marker opens a card offering to set it as pickup or drop-off', async ({ selectLocationPage, page }) => {
    await page.locator(`img[alt="${stops.dropoff}"]`).first().click();
    const card = page
      .locator('div')
      .filter({ has: page.getByRole('heading', { name: stops.dropoff, exact: true, level: 3 }) })
      .filter({ has: page.getByRole('button', { name: /^set as (pickup|drop-off)$/ }) })
      .first();
    await expect(card).toBeVisible();
  });

  /** Verify that selecting a stop via its map marker sets it as the pickup location. */
  test('@sanity MAPPIN_002: Verify that selecting a stop via its map marker sets it as the pickup location', async ({ selectLocationPage }) => {
    await selectLocationPage.pickupInput.click();
    await selectLocationPage.selectStopViaMapMarker(stops.dropoff);
    await expect(selectLocationPage.pickupInput).toHaveValue(stops.dropoff);
  });

  /** Verify that selecting a stop via its map marker sets it as the drop-off location once pickup is already chosen. */
  test('MAPPIN_003: Verify that selecting a stop via its map marker sets it as the drop-off after pickup is chosen', async ({ selectLocationPage }) => {
    await selectLocationPage.selectPickupStop(stops.pickup);
    await selectLocationPage.dropoffInput.click();
    await selectLocationPage.selectStopViaMapMarker(stops.dropoff);
    await expect(selectLocationPage.dropoffInput).toHaveValue(stops.dropoff);
  });
});

test.describe(`Future Booking — Map Theme ${RIDER_TAGS.FUTURE} ${RIDER_TAGS.UI_ONLY} ${RIDER_TAGS.REGRESSION} ${RIDER_TAGS.SAFE}`, () => {
  test.beforeEach(async ({ selectLocationPage }) => {
    test.skip(!isOrgEnabled('futureBookingOnly'), 'Future Booking org not configured for this environment — set trackingId/stops in rider-config.ts');
    await selectLocationPage.goto(org.trackingId);
  });

  /** Verify that the Map Theme dialog opens with Classic, Silver, and Satellite options. */
  test('@smoke THEME_001: Verify that the Map Theme dialog opens with Classic, Silver, and Satellite options', async ({ selectLocationPage, page }) => {
    await selectLocationPage.openMapTheme();
    await expect(page.getByRole('heading', { name: 'Classic' }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Silver' }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Satellite' }).first()).toBeVisible();
  });

  /** Verify that selecting the Silver theme updates the persisted mapTheme cookie to "2". */
  test('@sanity THEME_002: Verify that selecting the Silver map theme saves it as the persisted map theme preference', async ({ selectLocationPage }) => {
    await selectLocationPage.openMapTheme();
    await selectLocationPage.selectMapTheme('Silver');
    await expect.poll(() => selectLocationPage.getMapThemeCookieValue()).toBe('2');
  });

  /** Verify that selecting the Satellite theme updates the persisted mapTheme cookie to "3". */
  test('THEME_003: Verify that selecting the Satellite map theme saves it as the persisted map theme preference', async ({ selectLocationPage }) => {
    await selectLocationPage.openMapTheme();
    await selectLocationPage.selectMapTheme('Satellite');
    await expect.poll(() => selectLocationPage.getMapThemeCookieValue()).toBe('3');
  });

  /** Verify that selecting the Classic theme updates the persisted mapTheme cookie to "1". */
  test('THEME_004: Verify that selecting the Classic map theme saves it as the persisted map theme preference', async ({ selectLocationPage }) => {
    await selectLocationPage.openMapTheme();
    await selectLocationPage.selectMapTheme('Classic');
    await expect.poll(() => selectLocationPage.getMapThemeCookieValue()).toBe('1');
  });

  /** Verify that closing the Map Theme dialog dismisses it. */
  test('THEME_005: Verify that closing the Map Theme dialog dismisses it', async ({ selectLocationPage }) => {
    await selectLocationPage.openMapTheme();
    await selectLocationPage.closeMapTheme();
    await expect(selectLocationPage.mapThemeDialogHeading).not.toBeVisible();
  });
});

test.describe(`Future Booking — Go Back Confirmation ${RIDER_TAGS.FUTURE} ${RIDER_TAGS.UI_ONLY} ${RIDER_TAGS.REGRESSION} ${RIDER_TAGS.SAFE}`, () => {
  test.beforeEach(async ({ selectLocationPage }) => {
    test.skip(!isOrgEnabled('futureBookingOnly'), 'Future Booking org not configured for this environment — set trackingId/stops in rider-config.ts');
    await selectLocationPage.goto(org.trackingId);
    await selectLocationPage.selectPickupStop(stops.pickup);
  });

  /** Verify that the "Go Back?" alert shows the exact heading and warning message. */
  test('@smoke GOBACK_001: Verify that the "Go Back?" alert shows the correct heading and warning message', async ({ selectLocationPage, page }) => {
    await selectLocationPage.clickBack();
    await expect(selectLocationPage.goBackDialogHeading).toHaveText('Go Back?');
    await expect(page.getByText('Your entered details will be lost.')).toBeVisible();
  });

  /** Verify that clicking "Cancel" on the "Go Back?" alert dismisses it and keeps the current selection. */
  test('GOBACK_002: Verify that choosing Cancel on the "Go Back?" alert dismisses it and keeps the current selection', async ({ selectLocationPage }) => {
    await selectLocationPage.clickBack();
    await selectLocationPage.cancelGoBack();
    await expect(selectLocationPage.goBackDialogHeading).not.toBeVisible();
    await expect(selectLocationPage.pickupInput).toHaveValue(stops.pickup);
  });

  /** Verify that confirming "Go Back" navigates away from the location page, discarding the in-progress selection. */
  test('@sanity GOBACK_003: Verify that confirming Go Back leaves the location page and discards the in-progress selection', async ({ selectLocationPage, page }) => {
    await selectLocationPage.clickBack();
    await selectLocationPage.confirmGoBack();
    // Live-verified: navigates cross-domain to the org Welcome screen on the
    // marketing site (php-staging.trackmyshuttle.com/a/{orgCode}) — leaving
    // the rider-app location page (and its in-progress selection) entirely.
    await expect(page).not.toHaveURL(/\/location$/, { timeout: 15_000 });
  });
});
