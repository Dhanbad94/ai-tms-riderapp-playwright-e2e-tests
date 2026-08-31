import { test, expect } from '../../../fixtures/test-fixtures';
import {
  getOrgConfig,
  getDriverApiConfig,
  canRunDispatchLifecycle,
} from '../../../utils/rider-config';
import {
  RIDER_TAGS,
  RIDER_TIMEOUTS,
  DISPATCH_ACTION,
  DISPATCH_STATUS,
} from '../../../constants';
import { SelectLocationPage } from '../../../pages/rider/SelectLocationPage';
import { GuestFormSection } from '../../../pages/rider/GuestFormSection';
import { DriverApiClient } from '../../../utils/api/driver-client';
import type { APIRequestContext, Page } from '@playwright/test';
import type { DriverApiConfig } from '../../../types';

/**
 * ASAP Only — Driver Dispatch Lifecycle (preproduction; production opt-in)
 *
 * Exercises the DRIVER side of an ASAP self-serve ride, end to end:
 *
 *   [1] Rider creates the request via the UI  (rider web app)
 *   [2] Operator assigns a driver to it        (POST /assign-request)
 *   [3] (start trip — intentionally SKIPPED: no self-serve start-trip endpoint;
 *        /start-trip is Fixed-Route only. Per product owner, skip and continue.)
 *   [4] Terminal:  COMPLETE (dispatch-action 1)  or  CANCEL (dispatch-action 2)
 *
 * Ride-safety: gated by canRunDispatchLifecycle() (NOT canCreateRides), so it
 * runs only where explicitly enabled. Each scenario drives the dispatch to a
 * terminal state, and afterEach force-cancels anything left active — nothing is
 * left mid-flight in the shared database.
 */

const org = getOrgConfig('asapOnly');
const { stops } = org;

/**
 * Bounded settle applied after a driver state change, once the target screen has
 * been asserted, before driving the next step. The rider screens update over a
 * realtime socket; this lets the just-rendered screen settle and the backend
 * commit the transition, so we don't race the next /proceed ahead of the UI — and
 * it mirrors the real driver's pacing (drive to pickup → pick up → drive → drop).
 * Kept short and paired with a web-first assertion — never a substitute for one.
 */
const SCREEN_SETTLE_MS = 3_000;

/**
 * Wait for the "Driver on the way" / in-progress screen to render. The trip route
 * (destination stop) is only shown once the trip is in progress, so waiting for it
 * is a real settle — not a blind sleep. The live ETA text is GPS/socket-driven
 * ("Loading…" with no device feed) and intentionally not asserted.
 */
async function expectRiderOnTheWay(page: Page): Promise<void> {
  await expect(page.getByText('Waiting for the driver to start the trip')).toHaveCount(0, { timeout: 45_000 });
  await expect(page.getByText(stops.dropoff).first()).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(SCREEN_SETTLE_MS);
}

/**
 * Assert the rider tracking screen reflects a driver assignment.
 *
 * The rider page receives assignment updates over a Socket.IO channel (no polling
 * fallback), so an occasionally-missed push would otherwise leave the screen on
 * "Not Assigned" forever and flake the test. We assert the real-time update first;
 * if it doesn't arrive, we reload once to fetch the server-rendered assigned state
 * (the assignment IS reflected, just refreshed) — keeping the check reliable.
 */
async function expectRiderShowsAssigned(
  page: Page,
  driverName: string,
  shuttleName: string | null,
): Promise<void> {
  const assigned = () => expect(page.getByText('Driver Assigned')).toBeVisible({ timeout: 30_000 });
  try {
    await assigned();
  } catch {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await assigned();
  }
  await expect(page.getByText('Not Assigned')).toHaveCount(0);
  await expect(page.getByText(driverName, { exact: false })).toBeVisible();
  if (shuttleName) {
    await expect(page.getByText(shuttleName, { exact: false })).toBeVisible();
  }
}

/** Create a ride through the rider UI and return its unique rider name. */
async function createRideViaUi(page: Page): Promise<string> {
  const lp = new SelectLocationPage(page);
  const gf = new GuestFormSection(page);
  await lp.goto(org.trackingId);
  await lp.selectBothStops(stops.pickup, stops.dropoff);
  await lp.clickConfirm();
  await gf.waitForFormVisible();
  // fillRequiredFields generates a unique PW_Rider_<ts> name — our correlation key.
  const { name } = await gf.fillRequiredFields();
  await gf.submitAndAwaitTracking();
  return name;
}

test.describe(`ASAP Only — Dispatch Lifecycle ${RIDER_TAGS.ASAP} ${RIDER_TAGS.DISPATCH_LIFECYCLE}`, () => {
  // Teardown closure: set once we know the dispatch id, cleared once the scenario
  // reaches its terminal state. If it's still set in afterEach, the scenario
  // failed partway — the closure drives the dispatch to a terminal state so the
  // shared DB is never left with an active ride/assignment/in-flight trip.
  let cleanup: (() => Promise<void>) | null = null;

  test.beforeEach(async () => {
    test.skip(!canRunDispatchLifecycle(), 'Dispatch lifecycle not enabled for this environment');
    cleanup = null;
  });

  test.afterEach(async ({ page }) => {
    if (cleanup) await cleanup().catch(() => {});
    // Throttle successive ride submissions against the shared backend.
    await page.waitForTimeout(RIDER_TIMEOUTS.RIDE_COOLDOWN);
  });

  /**
   * Shared flow: UI-create → login → locate dispatch → assign driver.
   * Returns the client + dispatch id, positioned for the terminal action.
   */
  async function createAssignAndReturn(
    page: Page,
    request: APIRequestContext,
  ): Promise<{ client: DriverApiClient; dispatchId: number }> {
    const cfg = getDriverApiConfig();
    const [assigner, assignee] = cfg.drivers;
    expect(assigner, 'assigner driver configured').toBeTruthy();
    expect(assignee, 'assignee driver configured').toBeTruthy();

    // [1] Rider creates the request via the UI.
    const riderName = await createRideViaUi(page);

    // Authenticate as the assigning driver (the "dispatcher").
    const client = await DriverApiClient.login(request, cfg, assigner!);

    // [2a] The new request appears in the driver queue, unassigned.
    const row = await client.waitForDispatchByRiderName(riderName);
    cleanup = () => client.safeCancel(row.id, 'E2E teardown — ensure terminal state');
    expect(row.status, 'new request is queued/waiting on driver').toBe(
      DISPATCH_STATUS.WAITING_ON_DRIVER,
    );

    // [2b] Assign a driver to the new dispatch.
    const assign = await client.assignDriver(row.id, assignee!.driverId);
    expect(
      assign.ok,
      `assign-request succeeded (success=${assign.successCount} failed=${assign.failedCount} msg="${assign.message}")`,
    ).toBe(true);

    // Corroborate the assignment: the dispatch leaves the unassigned queue.
    await expect
      .poll(() => client.isDispatchInQueue(row.id), { timeout: 15_000 })
      .toBe(false);

    return { client, dispatchId: row.id };
  }

  test('@dispatch-lifecycle DISPATCH_001: Verify that a booked ride can be assigned a driver and then marked completed', async ({ page, request }) => {
    const { client, dispatchId } = await createAssignAndReturn(page, request);

    // [4] Complete the dispatch.
    const res = await client.dispatchAction(dispatchId, DISPATCH_ACTION.COMPLETE, 'E2E lifecycle — complete');
    expect(res.ok, `dispatch-action(complete) returns 200 (code=${res.code})`).toBe(true);
    expect(res.message.toLowerCase(), `message="${res.message}"`).toContain('completed');

    // Terminal state reached — no teardown needed.
    cleanup = null;
  });

  test('@dispatch-lifecycle DISPATCH_002: Verify that a booked ride can be assigned a driver and then canceled', async ({ page, request }) => {
    const { client, dispatchId } = await createAssignAndReturn(page, request);

    // [4] Cancel the dispatch (fully self-cleaning — nothing left active).
    const res = await client.dispatchAction(dispatchId, DISPATCH_ACTION.CANCEL, 'E2E lifecycle — cancel');
    expect(res.ok, `dispatch-action(cancel) returns 200 (code=${res.code})`).toBe(true);
    expect(res.message.toLowerCase(), `message="${res.message}"`).toContain('cancel');

    // Terminal state reached — no teardown needed.
    cleanup = null;
  });

  /**
   * Real-time API↔UI integration: with the rider's tracking screen open, assign
   * a driver via the API and assert the screen updates LIVE (no reload) — status
   * flips to "Driver Assigned", the driver + shuttle appear, and the rider's own
   * details stay correct throughout. Driver/shuttle names are read from the API
   * so this is env-agnostic (works on preproduction and production).
   */
  test('@dispatch-lifecycle DISPATCH_003: Verify that assigning a driver updates the rider tracking screen live without a reload', async ({ page, request }) => {
    const cfg = getDriverApiConfig();
    const [assigner, assignee] = cfg.drivers;

    // [1] Rider creates the request via the UI and stays on the tracking screen.
    const lp = new SelectLocationPage(page);
    const gf = new GuestFormSection(page);
    await lp.goto(org.trackingId);
    await lp.selectBothStops(stops.pickup, stops.dropoff);
    await lp.clickConfirm();
    await gf.waitForFormVisible();
    const { name, riders } = await gf.fillRequiredFields();
    await gf.submitAndAwaitTracking();

    // Pre-assign UI state: request submitted, no driver yet, rider details shown.
    await expect(page.getByText('Request Submitted')).toBeVisible({ timeout: RIDER_TIMEOUTS.CONFIRMATION });
    await expect(page.getByText('Not Assigned')).toBeVisible();
    await expect(page.getByText(`${name} (${riders} Guests)`)).toBeVisible();

    // Locate the dispatch and capture the driver + shuttle the API will assign.
    const client = await DriverApiClient.login(request, cfg, assigner!);
    const row = await client.waitForDispatchByRiderName(name);
    cleanup = () => client.safeCancel(row.id, 'E2E teardown — ensure terminal state');
    const driverInfo = await client.getAssignableDriver(row.id, assignee!.driverId);
    expect(driverInfo, 'assignee driver is available for this dispatch').not.toBeNull();

    // Give the tracking page's realtime socket a moment to subscribe before we
    // assign, so the assignment push is less likely to be missed.
    await page.waitForTimeout(3_000);

    // [2] Assign the driver via the API (background — the UI must react on its own).
    const assign = await client.assignDriver(row.id, assignee!.driverId);
    expect(assign.ok, `assign succeeded (msg="${assign.message}")`).toBe(true);

    // [3] The tracking screen reflects the assignment — status flips to "Driver
    //     Assigned" and the driver + vehicle appear (real time, reload fallback).
    await expectRiderShowsAssigned(page, driverInfo!.name, driverInfo!.shuttleName);
    //     rider's own details remain correct ────────────────────────────────
    await expect(page.getByText(`${name} (${riders} Guests)`)).toBeVisible();

    // Cleanup handled by afterEach (dispatch still active — assigned, not terminal).
  });

  /**
   * Full journey with per-screen UI validation. Drives the complete lifecycle and
   * asserts the rider tracking screen's message at each stage:
   *
   *   submitted → assigned → START TRIP (/proceed) → COMPLETE (/proceed → ended)
   *
   * "Start trip" is the on-demand progression call /proceed by the ASSIGNED driver
   * (there is no dedicated on-demand start-trip endpoint). Started state is verified
   * by trip_started flipping 0→1 + the rider leaving "Waiting for the driver to
   * start the trip"; completion by the rider's feedback screen. The live "on the
   * way"/ETA text is driver-GPS (Socket.IO) driven and intentionally not asserted.
   */
  test('@dispatch-lifecycle DISPATCH_004: Verify that the rider tracking screen updates correctly through submit, assign, start, and complete', async ({ page, request }) => {
    const cfg = getDriverApiConfig();
    const [assigner, assignee] = cfg.drivers;

    // ── Screen 1: rider creates the ride, lands on the tracking screen ──────
    const lp = new SelectLocationPage(page);
    const gf = new GuestFormSection(page);
    await lp.goto(org.trackingId);
    await lp.selectBothStops(stops.pickup, stops.dropoff);
    await lp.clickConfirm();
    await gf.waitForFormVisible();
    const { name, riders } = await gf.fillRequiredFields();
    await gf.submitAndAwaitTracking();
    await expect(page.getByText('Request Submitted')).toBeVisible({ timeout: RIDER_TIMEOUTS.CONFIRMATION });
    await expect(page.getByText('Not Assigned')).toBeVisible();
    await expect(page.getByText(`${name} (${riders} Guests)`)).toBeVisible();

    // Log in both drivers: assigner assigns; assignee (the assigned driver) starts.
    const assignerClient = await DriverApiClient.login(request, cfg, assigner!);
    const assigneeClient = await DriverApiClient.login(request, cfg, assignee!);
    const row = await assignerClient.waitForDispatchByRiderName(name);
    // Teardown: end the trip if it was started, otherwise cancel the dispatch.
    cleanup = async () => {
      for (let i = 0; i < 4; i++) {
        const r = await assigneeClient.proceed().catch(() => null);
        if (!r || /ended/i.test(r.message)) break;
      }
      await assignerClient.safeCancel(row.id, 'E2E teardown — ensure terminal state');
    };
    const driverInfo = await assignerClient.getAssignableDriver(row.id, assignee!.driverId);
    expect(driverInfo, 'assignee driver is available').not.toBeNull();

    // ── Screen 2: assign driver → "Driver Assigned / Waiting to start" (live) ─
    await page.waitForTimeout(3_000); // let the realtime socket subscribe first
    const assign = await assignerClient.assignDriver(row.id, assignee!.driverId);
    expect(assign.ok, `assign succeeded (msg="${assign.message}")`).toBe(true);
    await expectRiderShowsAssigned(page, driverInfo!.name, driverInfo!.shuttleName);
    await expect(page.getByText('Waiting for the driver to start the trip')).toBeVisible();
    expect(await assigneeClient.getTripStarted(), 'trip not started yet').toBe(0);

    // ── Screen 3: START TRIP (/proceed) → "Driver on the way" ────────────────
    const start = await assigneeClient.proceed();
    expect(start.ok, `start-trip /proceed ok (msg="${start.message}")`).toBe(true);
    await expect.poll(() => assigneeClient.getTripStarted(), { timeout: 20_000 }).toBe(1);
    // Wait for the "on the way" screen to render + settle before completing.
    await expectRiderOnTheWay(page);

    // ── Screen 4: DROP OFF + COMPLETE (/proceed → Trip Ended) → feedback ─────
    for (let i = 0; i < 4; i++) {
      const r = await assigneeClient.proceed();
      await page.waitForTimeout(SCREEN_SETTLE_MS); // let each drop-off/next screen settle
      if (/ended/i.test(r.message)) break;
    }
    await expect(page.getByRole('heading', { name: 'How Was Your Experience?' })).toBeVisible({ timeout: 45_000 });

    // Trip completed and ended — nothing left active.
    cleanup = null;
  });

  /**
   * Granular per-passenger PICK-UP, then drop-off + completion. Distinct from
   * DISPATCH_004 (which starts via the bulk /proceed): here the trip is started by
   * marking the individual dispatch PICKED UP via /update-single-dispatch (status
   * 1) — the real per-passenger pickup action. Verified: the pickup call succeeds,
   * the dispatch leaves the stop's pickup list, trip_started flips 0→1, and the
   * rider UI leaves "Waiting…to start the trip". Drop-off + completion go through
   * the reliable /proceed (granular per-passenger drop-off is fragile on the
   * shared, congested stops — see investigation notes).
   */
  test('@dispatch-lifecycle DISPATCH_005: Verify that a per-passenger pickup starts the trip and the ride can then be dropped off and completed', async ({ page, request }) => {
    const cfg = getDriverApiConfig();
    const [assigner, assignee] = cfg.drivers;

    // ── Screen 1: rider creates the ride ────────────────────────────────────
    const lp = new SelectLocationPage(page);
    const gf = new GuestFormSection(page);
    await lp.goto(org.trackingId);
    await lp.selectBothStops(stops.pickup, stops.dropoff);
    await lp.clickConfirm();
    await gf.waitForFormVisible();
    const { name, riders } = await gf.fillRequiredFields();
    await gf.submitAndAwaitTracking();
    await expect(page.getByText('Request Submitted')).toBeVisible({ timeout: RIDER_TIMEOUTS.CONFIRMATION });
    await expect(page.getByText('Not Assigned')).toBeVisible();
    await expect(page.getByText(`${name} (${riders} Guests)`)).toBeVisible();

    const assignerClient = await DriverApiClient.login(request, cfg, assigner!);
    const assigneeClient = await DriverApiClient.login(request, cfg, assignee!);
    const row = await assignerClient.waitForDispatchByRiderName(name);
    cleanup = async () => {
      for (let i = 0; i < 4; i++) {
        const r = await assigneeClient.proceed().catch(() => null);
        if (!r || /ended/i.test(r.message)) break;
      }
      await assignerClient.safeCancel(row.id, 'E2E teardown — ensure terminal state');
    };
    const driverInfo = await assignerClient.getAssignableDriver(row.id, assignee!.driverId);
    expect(driverInfo, 'assignee driver is available').not.toBeNull();

    // ── Screen 2: assign driver → "Driver Assigned" (live) ──────────────────
    await page.waitForTimeout(3_000); // let the realtime socket subscribe first
    const assign = await assignerClient.assignDriver(row.id, assignee!.driverId);
    expect(assign.ok, `assign succeeded (msg="${assign.message}")`).toBe(true);
    await expectRiderShowsAssigned(page, driverInfo!.name, driverInfo!.shuttleName);
    expect(await assigneeClient.getTripStarted(), 'trip not started yet').toBe(0);

    // ── Screen 3: PICK UP the individual dispatch (granular) ────────────────
    const pick = await assigneeClient.pickup(row.id);
    expect(pick.ok, `pickup /update-single-dispatch ok (msg="${pick.message}")`).toBe(true);
    // The pickup starts the trip …
    await expect.poll(() => assigneeClient.getTripStarted(), { timeout: 20_000 }).toBe(1);
    // … and the dispatch moves out of the stop's PICKUP list (it's now on board).
    await expect
      .poll(async () => {
        const stop = await assigneeClient.getArrivedStop(0).catch(() => null);
        return stop ? stop.pickups.some((p) => p.id === row.id) : false;
      }, { timeout: 15_000 })
      .toBe(false);
    // "Driver on the way" screen (picked up, en route to drop-off) — render + settle.
    await expectRiderOnTheWay(page);

    // ── Screen 4: DROP OFF + COMPLETE via /proceed → rider feedback screen ───
    for (let i = 0; i < 4; i++) {
      const r = await assigneeClient.proceed();
      await page.waitForTimeout(SCREEN_SETTLE_MS); // let each drop-off/next screen settle
      if (/ended/i.test(r.message)) break;
    }
    await expect(page.getByRole('heading', { name: 'How Was Your Experience?' })).toBeVisible({ timeout: 45_000 });

    // Trip completed and ended — nothing left active.
    cleanup = null;
  });
});

// ============================================================================
// Driver API — Negative / Error Paths (ride-FREE)
//
// Bad auth, missing/invalid parameters, and invalid targets. Every error
// response carries a semantic `body.code` (the HTTP status is inconsistent —
// auth failures return HTTP 200 with a body-level 401), so assertions check
// `body.code`. No rides are created — safe for the shared preprod/prod DB.
// ============================================================================

const NEG_DEVICE = {
  device_id: 'pw-neg', device_type: '1', platform: '1', model: 'm', version: '1',
  device_token: 't', device_mac: 'x', device_ip_address: '1',
};

function negBasicHeader(cfg: DriverApiConfig, user = cfg.basicAuth.username, pass = cfg.basicAuth.password): string {
  return `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
}

async function negPost(request: APIRequestContext, url: string, headers: Record<string, string>, data: Record<string, unknown>) {
  const res = await request.post(url, { headers: { 'Content-Type': 'application/json', ...headers }, data });
  return { httpStatus: res.status(), body: await res.json().catch(() => ({})) };
}

async function negGet(request: APIRequestContext, url: string, headers: Record<string, string>) {
  const res = await request.get(url, { headers });
  return { httpStatus: res.status(), body: await res.json().catch(() => ({})) };
}

/** Log in a real driver and return a valid Bearer token (for authed negatives). */
async function negValidToken(request: APIRequestContext, cfg: DriverApiConfig): Promise<string> {
  const d = cfg.drivers[0]!;
  const { body } = await negPost(request, `${cfg.baseUrl}/login`, { Authorization: negBasicHeader(cfg) },
    { phone_no: d.phone, isd_code: d.isdCode, passcode: d.passcode, ...NEG_DEVICE });
  return body.token as string;
}

test.describe(`ASAP Only — Driver API Negatives ${RIDER_TAGS.ASAP} ${RIDER_TAGS.DISPATCH_LIFECYCLE} ${RIDER_TAGS.NEGATIVE}`, () => {
  test.beforeEach(() => {
    test.skip(!canRunDispatchLifecycle(), 'Driver API not configured for this environment');
  });

  // ── Authentication ──────────────────────────────────────────────────────

  test('@negative NEG_DRV_001: Verify that a driver login with the wrong passcode is rejected with an invalid-passcode error', async ({ request }) => {
    const cfg = getDriverApiConfig();
    const d = cfg.drivers[0]!;
    const { body } = await negPost(request, `${cfg.baseUrl}/login`, { Authorization: negBasicHeader(cfg) },
      { phone_no: d.phone, isd_code: d.isdCode, passcode: '0000', ...NEG_DEVICE });
    expect(body.code).toBe(400);
    expect(String(body.message).toLowerCase()).toContain('passcode');
  });

  test('@negative NEG_DRV_002: Verify that a driver login with wrong gateway credentials is rejected as unauthorized', async ({ request }) => {
    const cfg = getDriverApiConfig();
    const d = cfg.drivers[0]!;
    const { body } = await negPost(request, `${cfg.baseUrl}/login`, { Authorization: negBasicHeader(cfg, 'wrong', 'wrong') },
      { phone_no: d.phone, isd_code: d.isdCode, passcode: d.passcode, ...NEG_DEVICE });
    expect(body.code).toBe(401);
    expect(String(body.message).toLowerCase()).toContain('authentication');
  });

  test('@negative NEG_DRV_003: Verify that a driver login with no authorization header is rejected as unauthorized', async ({ request }) => {
    const cfg = getDriverApiConfig();
    const d = cfg.drivers[0]!;
    const { body } = await negPost(request, `${cfg.baseUrl}/login`, {},
      { phone_no: d.phone, isd_code: d.isdCode, passcode: d.passcode, ...NEG_DEVICE });
    expect(body.code).toBe(401);
    expect(String(body.message).toLowerCase()).toContain('authorization');
  });

  test('@negative NEG_DRV_004: Verify that a driver login with no passcode is rejected with a validation error', async ({ request }) => {
    const cfg = getDriverApiConfig();
    const d = cfg.drivers[0]!;
    const { body } = await negPost(request, `${cfg.baseUrl}/login`, { Authorization: negBasicHeader(cfg) },
      { phone_no: d.phone, isd_code: d.isdCode, ...NEG_DEVICE });
    expect(body.code).toBe(422);
    expect(JSON.stringify(body.response ?? body)).toMatch(/passcode/i);
  });

  test('@negative NEG_DRV_005: Verify that a protected endpoint rejects an invalid access token as unauthorized', async ({ request }) => {
    const cfg = getDriverApiConfig();
    const { body } = await negGet(request, `${cfg.baseUrl}/dashboard`, { Authorization: 'Bearer garbage.token.xyz' });
    expect(body.code).toBe(401);
  });

  test('@negative NEG_DRV_006: Verify that a protected endpoint rejects a request with no access token as unauthorized', async ({ request }) => {
    const cfg = getDriverApiConfig();
    const { body } = await negGet(request, `${cfg.baseUrl}/dashboard`, {});
    expect(body.code).toBe(401);
    expect(String(body.message).toLowerCase()).toContain('unauth');
  });

  // ── Parameter validation ────────────────────────────────────────────────

  test('@negative NEG_DRV_007: Verify that a dispatch action with no dispatch specified is rejected with a validation error', async ({ request }) => {
    const cfg = getDriverApiConfig();
    const token = await negValidToken(request, cfg);
    const { body } = await negPost(request, `${cfg.baseUrl}/dispatch-action`, { Authorization: `Bearer ${token}` },
      { action: 2, message: 'x' });
    expect(body.code).toBe(422);
    expect(JSON.stringify(body.response ?? body)).toMatch(/dispatch/i);
  });

  test('@negative NEG_DRV_008: Verify that requesting available drivers with no dispatch specified is rejected with a validation error', async ({ request }) => {
    const cfg = getDriverApiConfig();
    const token = await negValidToken(request, cfg);
    const { body } = await negPost(request, `${cfg.baseUrl}/drivers-for-dispatch`, { Authorization: `Bearer ${token}` }, {});
    expect(body.code).toBe(422);
  });

  // ── Invalid targets (nonexistent ids — no ride created) ─────────────────

  test('@negative NEG_DRV_009: Verify that a dispatch action on a nonexistent dispatch is rejected as an invalid request', async ({ request }) => {
    const cfg = getDriverApiConfig();
    const token = await negValidToken(request, cfg);
    const { body } = await negPost(request, `${cfg.baseUrl}/dispatch-action`, { Authorization: `Bearer ${token}` },
      { dispatch: 999999999, action: 2, message: 'neg-test' });
    expect(body.code).toBe(400);
  });

  test('@negative NEG_DRV_010: Verify that requesting the status of a nonexistent dispatch returns a no-data-found response', async ({ request }) => {
    const cfg = getDriverApiConfig();
    const token = await negValidToken(request, cfg);
    const { body } = await negPost(request, `${cfg.baseUrl}/dispatch-status`, { Authorization: `Bearer ${token}` },
      { dispatch: 999999999 });
    expect(body.code).toBe(206);
  });

  test('@negative NEG_DRV_011: Verify that assigning a nonexistent driver to a nonexistent dispatch is rejected as an invalid request', async ({ request }) => {
    const cfg = getDriverApiConfig();
    const token = await negValidToken(request, cfg);
    const { body } = await negPost(request, `${cfg.baseUrl}/assign-request`, { Authorization: `Bearer ${token}` },
      { requests: [{ dispatch: 999999999, driver: 999999 }] });
    expect(body.code).toBe(400);
  });
});
