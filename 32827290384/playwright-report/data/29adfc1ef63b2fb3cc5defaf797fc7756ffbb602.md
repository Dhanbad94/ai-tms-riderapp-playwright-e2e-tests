# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: asap-only/asap-confirmation.spec.ts >> ASAP Only — Confirmation Page @asap @creates-ride @regression >> Map area present
- Location: tests/on-demand/asap-only/asap-confirmation.spec.ts:75:7

# Error details

```
Error: expect(received).toBeGreaterThan(expected)

Expected: > 0
Received:   0
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e5]:
    - generic [ref=e7]:
      - generic [ref=e8]:
        - generic:
          - region "Map" [ref=e9]
          - generic "Map marker" [ref=e10]:
            - img "Pick-up" [ref=e11]
          - generic "Map marker" [ref=e12]:
            - generic [ref=e15]: Pick-up
          - generic "Map marker" [ref=e16]:
            - img "Drop-off" [ref=e17]
          - generic "Map marker" [ref=e18]:
            - generic [ref=e21]: Drop-off
        - group [ref=e22]:
          - generic [ref=e23]:
            - link "© MapTiler" [ref=e24] [cursor=pointer]:
              - /url: https://www.maptiler.com/copyright/
            - link "© OpenStreetMap contributors" [ref=e25] [cursor=pointer]:
              - /url: https://www.openstreetmap.org/copyright
      - generic [ref=e27]:
        - button [ref=e28] [cursor=pointer]:
          - img [ref=e29]
        - button [ref=e32] [cursor=pointer]:
          - img [ref=e33]
    - generic [ref=e41]:
      - generic [ref=e43]:
        - heading "Finding Driver" [level=3] [ref=e44]
        - paragraph [ref=e45]: Driver will Accept Request at a safe stop.
      - generic [ref=e47]:
        - generic [ref=e48]:
          - img "icon" [ref=e50]
          - paragraph [ref=e51]: PW_Rider_b7c1 (3 Guests)
        - generic [ref=e52]:
          - img "icon" [ref=e54]
          - paragraph [ref=e55]: +91 8676913831
      - generic [ref=e57]:
        - generic [ref=e58]:
          - img "shuttle" [ref=e60]
          - heading "--" [level=5] [ref=e61]
        - generic [ref=e62]:
          - generic [ref=e63]: Not Assigned
          - img "driver" [ref=e65]
      - generic [ref=e67]:
        - link "phone Call Operator" [ref=e68] [cursor=pointer]:
          - /url: tel:+91 86978 69786
          - img "phone" [ref=e70]
          - generic [ref=e71]: Call Operator
        - generic [ref=e72] [cursor=pointer]:
          - img "cancel" [ref=e74]
          - generic [ref=e75]: Cancel Ride
  - alert [ref=e77]: TrackMyShuttle | Rider App
```

# Test source

```ts
  1   | import { test, expect } from '../../../fixtures/test-fixtures';
  2   | import { getOrgConfig, canCreateRides, getRiderConfig } from '../../../utils/rider-config';
  3   | import { RIDER_TAGS, RIDER_TIMEOUTS } from '../../../constants';
  4   | import { SelectLocationPage } from '../../../pages/rider/SelectLocationPage';
  5   | import { GuestFormSection } from '../../../pages/rider/GuestFormSection';
  6   | 
  7   | const org = getOrgConfig('asapOnly');
  8   | const { stops } = org;
  9   | 
  10  | /** Submit a ride and return the ride code from the redirect URL */
  11  | async function submitRideAndGetCode(page: import('@playwright/test').Page): Promise<string> {
  12  |   const lp = new SelectLocationPage(page);
  13  |   const gf = new GuestFormSection(page);
  14  |   await lp.goto(org.trackingId);
  15  |   await lp.selectBothStops(stops.pickup, stops.dropoff);
  16  |   await lp.clickConfirm();
  17  |   await gf.waitForFormVisible();
  18  |   await gf.fillRequiredFields();
  19  |   await gf.submitAndAwaitTracking();
  20  |   // Dismiss any dev error overlay
  21  |   const closeBtn = page.locator('[aria-label="Close"], button:has-text("×")').first();
  22  |   if (await closeBtn.isVisible({ timeout: 2_000 }).catch(() => false)) await closeBtn.click();
  23  |   await page.getByRole("heading").first().waitFor({ state: "visible", timeout: 15_000 });
  24  |   const match = page.url().match(/\/j\/([^/]+)\/s/);
  25  |   if (!match || !match[1]) throw new Error(`Failed to extract ride code from URL: ${page.url()}`);
  26  |   return match[1];
  27  | }
  28  | 
  29  | test.describe(`ASAP Only — Confirmation Page ${RIDER_TAGS.ASAP} ${RIDER_TAGS.CREATES_RIDE} ${RIDER_TAGS.REGRESSION}`, () => {
  30  |   test.beforeEach(async () => {
  31  |     test.skip(!canCreateRides(), 'Ride creation disabled on this environment');
  32  |   });
  33  | 
  34  |   // Throttle between tests so successive ride submissions don't trip staging's rate limiter.
  35  |   test.afterEach(async ({ page }) => {
  36  |     await page.waitForTimeout(RIDER_TIMEOUTS.RIDE_COOLDOWN);
  37  |   });
  38  | 
  39  |   test('@sanity ASAP_032: Shows status text, not TrackingCard', async ({ page }) => {
  40  |     await submitRideAndGetCode(page);
  41  |     const status = page.getByText(/Request Submitted|Finding Driver|Driver Assigned/i);
  42  |     await expect(status.first()).toBeVisible({ timeout: RIDER_TIMEOUTS.CONFIRMATION });
  43  |     await expect(page.getByText('View All Bookings')).not.toBeVisible();
  44  |   });
  45  | 
  46  |   // ASAP_033: In ASAP-only mode, pickup/dropoff names are intentionally NOT displayed
  47  |   // on the confirmation page. This is correct app behavior — not a bug.
  48  |   test('ASAP_033: Pickup and dropoff names are NOT shown in ASAP mode', async ({ page }) => {
  49  |     test.skip(getRiderConfig().name === 'staging', 'Skipped on staging for now — runs on preproduction/production');
  50  |     await submitRideAndGetCode(page);
  51  |     // In ASAP mode, the PickupDropoff header is hidden — verify absence
  52  |     const pickupVisible = await page.getByText(stops.pickup).first().isVisible().catch(() => false);
  53  |     const dropoffVisible = await page.getByText(stops.dropoff).first().isVisible().catch(() => false);
  54  |     expect(pickupVisible).toBe(false);
  55  |     expect(dropoffVisible).toBe(false);
  56  |   });
  57  | 
  58  |   test('ASAP_034: Shows ride status message', async ({ page }) => {
  59  |     await submitRideAndGetCode(page);
  60  |     const status = page.getByText(/Request Submitted|Finding Driver|Driver Assigned|Driver on the way/i);
  61  |     await expect(status.first()).toBeVisible({ timeout: RIDER_TIMEOUTS.CONFIRMATION });
  62  |   });
  63  | 
  64  |   test('ASAP_035: Page has status heading elements', async ({ page }) => {
  65  |     await submitRideAndGetCode(page);
  66  |     const headings = page.getByRole('heading');
  67  |     expect(await headings.count()).toBeGreaterThan(0);
  68  |   });
  69  | 
  70  |   test('TrackingCard "View All Bookings" NOT visible', async ({ page }) => {
  71  |     await submitRideAndGetCode(page);
  72  |     await expect(page.getByText('View All Bookings')).not.toBeVisible();
  73  |   });
  74  | 
  75  |   test('Map area present', async ({ page }) => {
  76  |     await submitRideAndGetCode(page);
  77  |     const mapEl = page.locator('.gm-style');
> 78  |     expect(await mapEl.count()).toBeGreaterThan(0);
      |                                 ^ Error: expect(received).toBeGreaterThan(expected)
  79  |   });
  80  | 
  81  |   test('Call Operator or Cancel Ride visible', async ({ page }) => {
  82  |     await submitRideAndGetCode(page);
  83  |     const callOp = await page.getByText(/Call Operator/i).isVisible().catch(() => false);
  84  |     const cancel = await page.getByText(/Cancel Ride/i).isVisible().catch(() => false);
  85  |     expect(callOp || cancel).toBe(true);
  86  |   });
  87  | 
  88  |   test('ASAP_040: Client-side fetch includes ride code', async ({ page }) => {
  89  |     let rideDetailsUrl = '';
  90  |     page.on('request', (req) => { if (req.url().includes('ride-details')) rideDetailsUrl = req.url(); });
  91  |     const code = await submitRideAndGetCode(page);
  92  | 
  93  |     if (rideDetailsUrl) expect(rideDetailsUrl).toContain(code);
  94  |   });
  95  | 
  96  |   test('No critical JavaScript errors', async ({ page }) => {
  97  |     const errors: string[] = [];
  98  |     page.on('pageerror', (err) => errors.push(err.message));
  99  |     await submitRideAndGetCode(page);
  100 |     const critical = errors.filter(e =>
  101 |       !e.includes('gmp-internal') && !e.includes('google') && !e.includes('Maps') && !e.includes('getPhone')
  102 |     );
  103 |     expect(critical).toHaveLength(0);
  104 |   });
  105 | 
  106 |   test('Confirmation page renders content', async ({ page }) => {
  107 |     await submitRideAndGetCode(page);
  108 |     const body = await page.locator('body').textContent();
  109 |     expect(body?.length).toBeGreaterThan(50);
  110 |   });
  111 | 
  112 |   test('Progress animation or status card visible', async ({ page }) => {
  113 |     await submitRideAndGetCode(page);
  114 |     const el = page.locator('[class*="progressAnimation"], [class*="ProgressAnimation"], h2, h3');
  115 |     expect(await el.count()).toBeGreaterThan(0);
  116 |   });
  117 | 
  118 |   // ASAP_049: After submitting, the tracking screen shows a rider-details card
  119 |   // (name + guest count, phone, room, flight). On mobile it sits below the fold,
  120 |   // so we scroll it into view first — mirroring the manual verification step.
  121 |   test('ASAP_049: Rider details visible on tracking screen after submit', async ({ page, confirmationPage }) => {
  122 |     test.skip(getRiderConfig().name === 'staging', 'Skipped on staging for now — runs on preproduction/production');
  123 |     const lp = new SelectLocationPage(page);
  124 |     const gf = new GuestFormSection(page);
  125 |     await lp.goto(org.trackingId);
  126 |     await lp.selectBothStops(stops.pickup, stops.dropoff);
  127 |     await lp.clickConfirm();
  128 |     await gf.waitForFormVisible();
  129 |     const details = await gf.fillRequiredFields({ riders: 1 });
  130 |     await gf.fillFlight('UA789');
  131 |     await gf.fillRoom('R101');
  132 |     await gf.submitAndAwaitTracking();
  133 | 
  134 |     await confirmationPage.scrollRiderDetailsIntoView();
  135 |     const card = confirmationPage.riderDetailsCard;
  136 |     await expect(card).toBeVisible();
  137 |     await expect(card.getByText(details.name)).toBeVisible();
  138 |     await expect(card.getByText(/1 Guests/i)).toBeVisible();
  139 |     await expect(card.getByText(details.phone)).toBeVisible();
  140 |     await expect(card.getByText('UA789')).toBeVisible();
  141 |     await expect(card.getByText('R101')).toBeVisible();
  142 |   });
  143 | });
  144 | 
```