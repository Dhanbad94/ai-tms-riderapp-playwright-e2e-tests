# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: future-booking-only/future-location-advanced.spec.ts >> Future Booking — Map Marker Selection @future @ui-only @regression @safe >> @smoke MAPPIN_001: Verify that clicking a stop map marker opens a card offering to set it as pickup or drop-off
- Location: tests/on-demand/future-booking-only/future-location-advanced.spec.ts:170:7

# Error details

```
TimeoutError: locator.click: Timeout 10000ms exceeded.
Call log:
  - waiting for locator('img[alt="Terminal 5E"]').first()
    - locator resolved to <img alt="Terminal 5E" title="Terminal 5E" src="/assets/images/marker.svg"/>
  - attempting click action
    - waiting for element to be visible, enabled and stable
    - element is not stable
  - retrying click action
    - waiting for element to be visible, enabled and stable
  - element was detached from the DOM, retrying
    - locator resolved to <img alt="Terminal 5E" title="Terminal 5E" src="/assets/images/marker.svg"/>
  - attempting click action
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
  2 × element was detached from the DOM, retrying
      - locator resolved to <img alt="Terminal 5E" title="Terminal 5E" src="/assets/images/marker.svg"/>
    - attempting click action
      - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - performing click action

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e5]:
    - generic [ref=e6]:
      - generic [ref=e7]:
        - button "back" [ref=e8] [cursor=pointer]:
          - img "back" [ref=e9]
        - heading "Select Location" [level=2] [ref=e10]
      - generic [ref=e12]:
        - generic [ref=e13]:
          - img "pickup" [ref=e20]
          - textbox "Pick-up from?" [ref=e22]
        - generic [ref=e23]:
          - img "dropoff" [ref=e25]
          - textbox "Where to?" [ref=e27]
      - generic [ref=e28]:
        - generic [ref=e29] [cursor=pointer]:
          - img [ref=e30]
          - generic [ref=e33]: View Stop List
        - generic [ref=e34] [cursor=pointer]:
          - img [ref=e35]
          - text: Use Current Location
    - generic [ref=e39]:
      - generic [ref=e40]:
        - generic:
          - region "Map" [ref=e41]
          - generic "Map marker" [ref=e42]:
            - img "Automated OD Future Booking" [ref=e44] [cursor=pointer]
          - generic "Map marker" [ref=e45]:
            - img "Terminal 5E" [ref=e47] [cursor=pointer]
          - generic "Map marker" [ref=e48]:
            - generic [ref=e49]:
              - img "Duplicate Stop" [ref=e50] [cursor=pointer]
              - generic: "08"
          - generic "Map marker" [ref=e51]:
            - img "Door 4 - Bus/Shuttle Ctr" [ref=e53] [cursor=pointer]
          - generic "Map marker" [ref=e54]:
            - img "Door 3 - Bus/Shuttle Ctr" [ref=e56] [cursor=pointer]
          - generic "Map marker" [ref=e57]:
            - img "Door 2 - Bus/Shuttle Ctr" [ref=e59] [cursor=pointer]
          - generic "Map marker" [ref=e60]:
            - img "Airport (ORD)" [ref=e62] [cursor=pointer]
          - generic "Map marker" [ref=e63]:
            - img "10000 W O'Hare Ave" [ref=e65] [cursor=pointer]
          - generic "Map marker"
        - group [ref=e66]:
          - generic [ref=e67]:
            - link "© MapTiler" [ref=e68] [cursor=pointer]:
              - /url: https://www.maptiler.com/copyright/
            - link "© OpenStreetMap contributors" [ref=e69] [cursor=pointer]:
              - /url: https://www.openstreetmap.org/copyright
      - generic [ref=e71]:
        - generic [ref=e73]:
          - button [ref=e74] [cursor=pointer]:
            - img [ref=e75]
          - button [ref=e78] [cursor=pointer]:
            - img [ref=e79]
        - generic [ref=e83]:
          - generic [ref=e87]:
            - generic [ref=e88]:
              - heading [level=3] [ref=e89]: Airport (ORD)
              - paragraph [ref=e90]: Chicago O'Hare International Airport (ORD), 10000 W O'Hare Ave, Chicago, IL 60666, USA
            - button [ref=e92] [cursor=pointer]: set as pickup
          - generic [ref=e96]:
            - generic [ref=e97]:
              - heading [level=3] [ref=e98]: 10000 W O'Hare Ave
              - paragraph [ref=e99]: Chicago O'Hare International Airport, 10000 W O'Hare Ave, Chicago, IL 60666, USA
            - button [ref=e101] [cursor=pointer]: set as pickup
          - generic [ref=e105]:
            - generic [ref=e106]:
              - heading [level=3] [ref=e107]: Automated OD Future Booking
              - paragraph [ref=e108]: 811 East Grand Avenue, Bensenville, Illinois, 60106, United States
            - button [ref=e110] [cursor=pointer]: set as pickup
          - generic [ref=e114]:
            - generic [ref=e115]:
              - heading "Terminal 5E" [level=3] [ref=e116]
              - paragraph [ref=e117]: 10000 Bessie Coleman Dr, Chicago, IL 60666, USA
            - button "set as pickup" [ref=e119] [cursor=pointer]
          - generic [ref=e123]:
            - generic [ref=e124]:
              - heading [level=3] [ref=e125]: Duplicate Stop
              - paragraph [ref=e126]: Terminal 2, Chicago, IL 60666, USA
            - button [ref=e128] [cursor=pointer]: set as pickup
          - generic [ref=e132]:
            - generic [ref=e133]:
              - heading [level=3] [ref=e134]: Door 4 - Bus/Shuttle Ctr
              - paragraph [ref=e135]: O'Hare, Chicago, IL 60666, USA
            - button [ref=e137] [cursor=pointer]: set as pickup
          - generic [ref=e141]:
            - generic [ref=e142]:
              - heading [level=3] [ref=e143]: Door 3 - Bus/Shuttle Ctr
              - paragraph [ref=e144]: O'Hare International Airport - Bus Shuttle Center Door 4, Chicago, IL 60666, USA
            - button [ref=e146] [cursor=pointer]: set as pickup
          - generic [ref=e150]:
            - generic [ref=e151]:
              - heading [level=3] [ref=e152]: Door 2 - Bus/Shuttle Ctr
              - paragraph [ref=e153]: O'Hare, Chicago, IL 60666, USA
            - button [ref=e155] [cursor=pointer]: set as pickup
          - generic [ref=e159]:
            - generic [ref=e160]:
              - heading [level=3] [ref=e161]: Airport (ORD)
              - paragraph [ref=e162]: Chicago O'Hare International Airport (ORD), 10000 W O'Hare Ave, Chicago, IL 60666, USA
            - button [ref=e164] [cursor=pointer]: set as pickup
          - generic [ref=e168]:
            - generic [ref=e169]:
              - heading [level=3] [ref=e170]: 10000 W O'Hare Ave
              - paragraph [ref=e171]: Chicago O'Hare International Airport, 10000 W O'Hare Ave, Chicago, IL 60666, USA
            - button [ref=e173] [cursor=pointer]: set as pickup
          - generic [ref=e177]:
            - generic [ref=e178]:
              - heading [level=3] [ref=e179]: Automated OD Future Booking
              - paragraph [ref=e180]: 811 East Grand Avenue, Bensenville, Illinois, 60106, United States
            - button [ref=e182] [cursor=pointer]: set as pickup
          - generic [ref=e186]:
            - generic [ref=e187]:
              - heading [level=3] [ref=e188]: Terminal 5E
              - paragraph [ref=e189]: 10000 Bessie Coleman Dr, Chicago, IL 60666, USA
            - button [ref=e191] [cursor=pointer]: set as pickup
          - generic [ref=e195]:
            - generic [ref=e196]:
              - heading [level=3] [ref=e197]: Duplicate Stop
              - paragraph [ref=e198]: Terminal 2, Chicago, IL 60666, USA
            - button [ref=e200] [cursor=pointer]: set as pickup
          - generic [ref=e204]:
            - generic [ref=e205]:
              - heading [level=3] [ref=e206]: Door 4 - Bus/Shuttle Ctr
              - paragraph [ref=e207]: O'Hare, Chicago, IL 60666, USA
            - button [ref=e209] [cursor=pointer]: set as pickup
          - generic [ref=e213]:
            - generic [ref=e214]:
              - heading [level=3] [ref=e215]: Door 3 - Bus/Shuttle Ctr
              - paragraph [ref=e216]: O'Hare International Airport - Bus Shuttle Center Door 4, Chicago, IL 60666, USA
            - button [ref=e218] [cursor=pointer]: set as pickup
          - generic [ref=e222]:
            - generic [ref=e223]:
              - heading [level=3] [ref=e224]: Door 2 - Bus/Shuttle Ctr
              - paragraph [ref=e225]: O'Hare, Chicago, IL 60666, USA
            - button [ref=e227] [cursor=pointer]: set as pickup
          - generic [ref=e231]:
            - generic [ref=e232]:
              - heading [level=3] [ref=e233]: Airport (ORD)
              - paragraph [ref=e234]: Chicago O'Hare International Airport (ORD), 10000 W O'Hare Ave, Chicago, IL 60666, USA
            - button [ref=e236] [cursor=pointer]: set as pickup
          - generic [ref=e240]:
            - generic [ref=e241]:
              - heading [level=3] [ref=e242]: 10000 W O'Hare Ave
              - paragraph [ref=e243]: Chicago O'Hare International Airport, 10000 W O'Hare Ave, Chicago, IL 60666, USA
            - button [ref=e245] [cursor=pointer]: set as pickup
  - alert [ref=e247]
```

# Test source

```ts
  71  | 
  72  |   /** Verify that stop search is case-insensitive. */
  73  |   test('SEARCH_005: Verify that stop search returns the same results regardless of letter case', async ({ selectLocationPage }) => {
  74  |     await selectLocationPage.searchPickupStops(stops.searchKeyword.toUpperCase());
  75  |     const upper = await selectLocationPage.getVisibleStopNames();
  76  | 
  77  |     await selectLocationPage.clearSearch();
  78  |     await selectLocationPage.searchPickupStops(stops.searchKeyword.toLowerCase());
  79  |     const lower = await selectLocationPage.getVisibleStopNames();
  80  | 
  81  |     expect(upper.length).toBe(lower.length);
  82  |     expect(upper.length).toBeGreaterThan(0);
  83  |   });
  84  | 
  85  |   /** Verify that a randomly chosen result from a filtered search list can be selected as the pickup stop. */
  86  |   test('@sanity SEARCH_006: Verify that a random result from a filtered search can be selected as the pickup stop', async ({ selectLocationPage }) => {
  87  |     await selectLocationPage.searchPickupStops(stops.searchKeyword);
  88  |     const results = await selectLocationPage.getVisibleStopNames();
  89  |     expect(results.length).toBeGreaterThan(0);
  90  |     const randomResult = results[Math.floor(Math.random() * results.length)]!;
  91  |     await selectLocationPage.selectPickupStop(randomResult);
  92  |     await expect(selectLocationPage.pickupInput).toHaveValue(randomResult);
  93  |   });
  94  | 
  95  |   /** Verify that a single-character search still returns results. */
  96  |   test('SEARCH_007: Verify that searching by a single character still returns results', async ({ selectLocationPage }) => {
  97  |     await selectLocationPage.searchPickupStops('t');
  98  |     const results = await selectLocationPage.getVisibleStopNames();
  99  |     expect(results.length).toBeGreaterThan(0);
  100 |   });
  101 | });
  102 | 
  103 | test.describe(`Future Booking — Random Stop Selection ${RIDER_TAGS.FUTURE} ${RIDER_TAGS.UI_ONLY} ${RIDER_TAGS.REGRESSION} ${RIDER_TAGS.SAFE}`, () => {
  104 |   test.beforeEach(async ({ selectLocationPage }) => {
  105 |     test.skip(!isOrgEnabled('futureBookingOnly'), 'Future Booking org not configured for this environment — set trackingId/stops in rider-config.ts');
  106 |     await selectLocationPage.goto(org.trackingId);
  107 |   });
  108 | 
  109 |   /** Verify that random pickup and drop-off stops can be selected from the full listing, and are never the same stop. */
  110 |   test('@smoke RANDOM_001: Verify that random pickup and drop-off stops can be selected from the listing and are never the same stop', async ({ selectLocationPage }) => {
  111 |     const { pickup, dropoff } = await selectLocationPage.selectRandomStops();
  112 |     expect(pickup).toBeTruthy();
  113 |     expect(dropoff).toBeTruthy();
  114 |     expect(pickup).not.toBe(dropoff);
  115 |     await expect(selectLocationPage.pickupInput).toHaveValue(pickup);
  116 |     await expect(selectLocationPage.dropoffInput).toHaveValue(dropoff);
  117 |   });
  118 | 
  119 |   /** Verify that repeated random selections vary across runs rather than always picking the same pair. */
  120 |   test('RANDOM_002: Verify that repeated random selections vary rather than always picking the same pair', async ({ selectLocationPage, page }) => {
  121 |     const seen = new Set<string>();
  122 |     for (let i = 0; i < 4; i++) {
  123 |       await selectLocationPage.goto(org.trackingId);
  124 |       const { pickup, dropoff } = await selectLocationPage.selectRandomStops();
  125 |       seen.add(`${pickup}|${dropoff}`);
  126 |     }
  127 |     // With 8 stops (56 ordered pairs), 4 draws landing on the exact same pair
  128 |     // every time would be a ~1-in-175,000 coincidence — effectively proves
  129 |     // the picks are genuinely randomized rather than deterministic.
  130 |     expect(seen.size).toBeGreaterThan(1);
  131 |   });
  132 | 
  133 |   /** Verify that the full stop listing is available to pick a random pickup from. */
  134 |   test('RANDOM_003: Verify that the full stop listing is available when choosing a pickup', async ({ selectLocationPage }) => {
  135 |     await selectLocationPage.pickupInput.click();
  136 |     const stopNames = await selectLocationPage.getVisibleStopNames();
  137 |     expect(stopNames.length).toBeGreaterThanOrEqual(5);
  138 |   });
  139 | 
  140 |   /** Verify that the selected pickup stop is filtered out of the drop-off list. */
  141 |   test('RANDOM_004: Verify that the chosen pickup stop is removed from the drop-off list', async ({ selectLocationPage }) => {
  142 |     await selectLocationPage.pickupInput.click();
  143 |     const allPickupStops = await selectLocationPage.getVisibleStopNames();
  144 |     await selectLocationPage.selectPickupStop(stops.pickup);
  145 | 
  146 |     await selectLocationPage.dropoffInput.click();
  147 |     const dropoffStops = await selectLocationPage.getVisibleStopNames();
  148 |     expect(dropoffStops).not.toContain(stops.pickup);
  149 |     expect(dropoffStops.length).toBeLessThan(allPickupStops.length);
  150 |   });
  151 | 
  152 |   /** Verify that random pickup and drop-off stops can be selected via their map-marker pins rather than the text stop list. */
  153 |   test('@sanity RANDOM_005: Verify that random pickup and drop-off stops can be selected using their map markers', async ({ selectLocationPage }) => {
  154 |     const { pickup, dropoff } = await selectLocationPage.selectRandomStopsViaMapMarkers();
  155 |     expect(pickup).toBeTruthy();
  156 |     expect(dropoff).toBeTruthy();
  157 |     expect(pickup).not.toBe(dropoff);
  158 |     await expect(selectLocationPage.pickupInput).toHaveValue(pickup);
  159 |     await expect(selectLocationPage.dropoffInput).toHaveValue(dropoff);
  160 |   });
  161 | });
  162 | 
  163 | test.describe(`Future Booking — Map Marker Selection ${RIDER_TAGS.FUTURE} ${RIDER_TAGS.UI_ONLY} ${RIDER_TAGS.REGRESSION} ${RIDER_TAGS.SAFE}`, () => {
  164 |   test.beforeEach(async ({ selectLocationPage }) => {
  165 |     test.skip(!isOrgEnabled('futureBookingOnly'), 'Future Booking org not configured for this environment — set trackingId/stops in rider-config.ts');
  166 |     await selectLocationPage.goto(org.trackingId);
  167 |   });
  168 | 
  169 |   /** Verify that clicking a stop's marker pin on the map opens a card offering to set it as pickup or drop-off. */
  170 |   test('@smoke MAPPIN_001: Verify that clicking a stop map marker opens a card offering to set it as pickup or drop-off', async ({ selectLocationPage, page }) => {
> 171 |     await page.locator(`img[alt="${stops.dropoff}"]`).first().click();
      |                                                               ^ TimeoutError: locator.click: Timeout 10000ms exceeded.
  172 |     const card = page
  173 |       .locator('div')
  174 |       .filter({ has: page.getByRole('heading', { name: stops.dropoff, exact: true, level: 3 }) })
  175 |       .filter({ has: page.getByRole('button', { name: /^set as (pickup|drop-off)$/ }) })
  176 |       .first();
  177 |     await expect(card).toBeVisible();
  178 |   });
  179 | 
  180 |   /** Verify that selecting a stop via its map marker sets it as the pickup location. */
  181 |   test('@sanity MAPPIN_002: Verify that selecting a stop via its map marker sets it as the pickup location', async ({ selectLocationPage }) => {
  182 |     await selectLocationPage.pickupInput.click();
  183 |     await selectLocationPage.selectStopViaMapMarker(stops.dropoff);
  184 |     await expect(selectLocationPage.pickupInput).toHaveValue(stops.dropoff);
  185 |   });
  186 | 
  187 |   /** Verify that selecting a stop via its map marker sets it as the drop-off location once pickup is already chosen. */
  188 |   test('MAPPIN_003: Verify that selecting a stop via its map marker sets it as the drop-off after pickup is chosen', async ({ selectLocationPage }) => {
  189 |     await selectLocationPage.selectPickupStop(stops.pickup);
  190 |     await selectLocationPage.dropoffInput.click();
  191 |     await selectLocationPage.selectStopViaMapMarker(stops.dropoff);
  192 |     await expect(selectLocationPage.dropoffInput).toHaveValue(stops.dropoff);
  193 |   });
  194 | });
  195 | 
  196 | test.describe(`Future Booking — Map Theme ${RIDER_TAGS.FUTURE} ${RIDER_TAGS.UI_ONLY} ${RIDER_TAGS.REGRESSION} ${RIDER_TAGS.SAFE}`, () => {
  197 |   test.beforeEach(async ({ selectLocationPage }) => {
  198 |     test.skip(!isOrgEnabled('futureBookingOnly'), 'Future Booking org not configured for this environment — set trackingId/stops in rider-config.ts');
  199 |     await selectLocationPage.goto(org.trackingId);
  200 |   });
  201 | 
  202 |   /** Verify that the Map Theme dialog opens with Classic, Silver, and Satellite options. */
  203 |   test('@smoke THEME_001: Verify that the Map Theme dialog opens with Classic, Silver, and Satellite options', async ({ selectLocationPage, page }) => {
  204 |     await selectLocationPage.openMapTheme();
  205 |     await expect(page.getByRole('heading', { name: 'Classic' }).first()).toBeVisible();
  206 |     await expect(page.getByRole('heading', { name: 'Silver' }).first()).toBeVisible();
  207 |     await expect(page.getByRole('heading', { name: 'Satellite' }).first()).toBeVisible();
  208 |   });
  209 | 
  210 |   /** Verify that selecting the Silver theme updates the persisted mapTheme cookie to "2". */
  211 |   test('@sanity THEME_002: Verify that selecting the Silver map theme saves it as the persisted map theme preference', async ({ selectLocationPage }) => {
  212 |     await selectLocationPage.openMapTheme();
  213 |     await selectLocationPage.selectMapTheme('Silver');
  214 |     await expect.poll(() => selectLocationPage.getMapThemeCookieValue()).toBe('2');
  215 |   });
  216 | 
  217 |   /** Verify that selecting the Satellite theme updates the persisted mapTheme cookie to "3". */
  218 |   test('THEME_003: Verify that selecting the Satellite map theme saves it as the persisted map theme preference', async ({ selectLocationPage }) => {
  219 |     await selectLocationPage.openMapTheme();
  220 |     await selectLocationPage.selectMapTheme('Satellite');
  221 |     await expect.poll(() => selectLocationPage.getMapThemeCookieValue()).toBe('3');
  222 |   });
  223 | 
  224 |   /** Verify that selecting the Classic theme updates the persisted mapTheme cookie to "1". */
  225 |   test('THEME_004: Verify that selecting the Classic map theme saves it as the persisted map theme preference', async ({ selectLocationPage }) => {
  226 |     await selectLocationPage.openMapTheme();
  227 |     await selectLocationPage.selectMapTheme('Classic');
  228 |     await expect.poll(() => selectLocationPage.getMapThemeCookieValue()).toBe('1');
  229 |   });
  230 | 
  231 |   /** Verify that closing the Map Theme dialog dismisses it. */
  232 |   test('THEME_005: Verify that closing the Map Theme dialog dismisses it', async ({ selectLocationPage }) => {
  233 |     await selectLocationPage.openMapTheme();
  234 |     await selectLocationPage.closeMapTheme();
  235 |     await expect(selectLocationPage.mapThemeDialogHeading).not.toBeVisible();
  236 |   });
  237 | });
  238 | 
  239 | test.describe(`Future Booking — Go Back Confirmation ${RIDER_TAGS.FUTURE} ${RIDER_TAGS.UI_ONLY} ${RIDER_TAGS.REGRESSION} ${RIDER_TAGS.SAFE}`, () => {
  240 |   test.beforeEach(async ({ selectLocationPage }) => {
  241 |     test.skip(!isOrgEnabled('futureBookingOnly'), 'Future Booking org not configured for this environment — set trackingId/stops in rider-config.ts');
  242 |     await selectLocationPage.goto(org.trackingId);
  243 |     await selectLocationPage.selectPickupStop(stops.pickup);
  244 |   });
  245 | 
  246 |   /** Verify that the "Go Back?" alert shows the exact heading and warning message. */
  247 |   test('@smoke GOBACK_001: Verify that the "Go Back?" alert shows the correct heading and warning message', async ({ selectLocationPage, page }) => {
  248 |     await selectLocationPage.clickBack();
  249 |     await expect(selectLocationPage.goBackDialogHeading).toHaveText('Go Back?');
  250 |     await expect(page.getByText('Your entered details will be lost.')).toBeVisible();
  251 |   });
  252 | 
  253 |   /** Verify that clicking "Cancel" on the "Go Back?" alert dismisses it and keeps the current selection. */
  254 |   test('GOBACK_002: Verify that choosing Cancel on the "Go Back?" alert dismisses it and keeps the current selection', async ({ selectLocationPage }) => {
  255 |     await selectLocationPage.clickBack();
  256 |     await selectLocationPage.cancelGoBack();
  257 |     await expect(selectLocationPage.goBackDialogHeading).not.toBeVisible();
  258 |     await expect(selectLocationPage.pickupInput).toHaveValue(stops.pickup);
  259 |   });
  260 | 
  261 |   /** Verify that confirming "Go Back" navigates away from the location page, discarding the in-progress selection. */
  262 |   test('@sanity GOBACK_003: Verify that confirming Go Back leaves the location page and discards the in-progress selection', async ({ selectLocationPage, page }) => {
  263 |     await selectLocationPage.clickBack();
  264 |     await selectLocationPage.confirmGoBack();
  265 |     // Live-verified: navigates cross-domain to the org Welcome screen on the
  266 |     // marketing site (php-staging.trackmyshuttle.com/a/{orgCode}) — leaving
  267 |     // the rider-app location page (and its in-progress selection) entirely.
  268 |     await expect(page).not.toHaveURL(/\/location$/, { timeout: 15_000 });
  269 |   });
  270 | });
  271 | 
```