/**
 * Driver API Client — dispatch-lifecycle suite
 *
 * Thin wrapper over Playwright's APIRequestContext for the TMS Driver API. This
 * is a SEPARATE surface from the rider API: it lives behind a Basic-auth gateway
 * and every authenticated call needs a per-driver Bearer JWT obtained via /login.
 *
 * Two-layer auth (see swagger securitySchemes):
 *   1. BasicAuth  — gates the pre-login endpoints (/login). Gateway credential.
 *   2. BearerAuth — the JWT /login returns; gates every dispatch action.
 *
 * Usage:
 *   const client = await DriverApiClient.login(request, driverApiConfig, driver);
 *   const id = await client.findDispatchIdByRiderName('PW_Rider_ab12');
 *   await client.assignDriver(id, assigneeDriverId);
 *   await client.dispatchAction(id, DISPATCH_ACTION.CANCEL, 'E2E cleanup');
 */

import type { APIRequestContext } from '@playwright/test';
import type { DriverAccount, DriverApiConfig } from '../../types';
import { DISPATCH_ACTION } from '../../constants';

/** Result of POST /assign-request. */
export interface AssignResult {
  ok: boolean;
  code: number;
  message: string;
  successCount: number;
  failedCount: number;
}

/** Result of POST /dispatch-action (complete / cancel). */
export interface ActionResult {
  ok: boolean;
  code: number;
  message: string;
}

/** A pickup/dropoff row from POST /arrived-stop. */
export interface ArrivedStopRow {
  id: number;
  name: string;
  total_passengers: number;
  action: number;
}

/** A single request row from GET /requests → response.allRequests[]. */
export interface DispatchRequestRow {
  id: number;
  name: string;
  pickupName: string;
  dropoffName: string;
  status: number;
  count: number;
  phone: string;
}

/** Shape of GET /requests → response.summary. */
interface RequestsResponse {
  code: number;
  message: string;
  response: {
    summary: { count: number };
    allRequests: DispatchRequestRow[];
  };
}

/** Device fields required by /login. Stable automation-device constants. */
const AUTOMATION_DEVICE = {
  device_id: 'pw-e2e-dispatch-lifecycle',
  device_type: '1',
  platform: '1',
  model: 'Playwright-Automation',
  version: '1.0',
  device_token: 'pw-e2e-token',
  device_mac: '00:00:00:00:00:00',
  device_ip_address: '127.0.0.1',
} as const;

export class DriverApiClient {
  private constructor(
    private readonly request: APIRequestContext,
    private readonly baseUrl: string,
    private readonly token: string,
    readonly driver: DriverAccount,
  ) {}

  /** The base64 `Basic <...>` header value for the gateway. */
  private static basicHeader(cfg: DriverApiConfig): string {
    const raw = `${cfg.basicAuth.username}:${cfg.basicAuth.password}`;
    return `Basic ${Buffer.from(raw).toString('base64')}`;
  }

  /**
   * Authenticate as `driver` and return a ready client. Sends the Basic gateway
   * header + driver credentials to /login and captures the returned JWT.
   */
  static async login(
    request: APIRequestContext,
    cfg: DriverApiConfig,
    driver: DriverAccount,
  ): Promise<DriverApiClient> {
    const res = await request.post(`${cfg.baseUrl}/login`, {
      headers: {
        Authorization: DriverApiClient.basicHeader(cfg),
        'Content-Type': 'application/json',
      },
      data: {
        phone_no: driver.phone,
        isd_code: driver.isdCode,
        passcode: driver.passcode,
        ...AUTOMATION_DEVICE,
      },
    });
    const body = await res.json();
    if (res.status() !== 200 || !body?.token) {
      throw new Error(
        `Driver login failed for ${driver.label} (${driver.phone}): ` +
          `HTTP ${res.status()} — ${JSON.stringify(body)}`,
      );
    }
    return new DriverApiClient(request, cfg.baseUrl, body.token, driver);
  }

  /** Authenticated request options with the Bearer token attached. */
  private authOptions(data?: Record<string, unknown>) {
    return {
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      ...(data ? { data } : {}),
    };
  }

  /** GET /requests — the self-serve queue. Returns the raw rows. */
  async getRequests(): Promise<DispatchRequestRow[]> {
    const res = await this.request.get(`${this.baseUrl}/requests`, this.authOptions());
    const body = (await res.json()) as RequestsResponse;
    if (res.status() !== 200) {
      throw new Error(`GET /requests failed: HTTP ${res.status()} — ${JSON.stringify(body)}`);
    }
    return body.response?.allRequests ?? [];
  }

  /**
   * Locate a dispatch by the exact (unique) rider name the UI-create produced.
   * Returns the row, or null if it hasn't appeared in the queue yet.
   */
  async findDispatchByRiderName(riderName: string): Promise<DispatchRequestRow | null> {
    const rows = await this.getRequests();
    return rows.find((r) => r.name === riderName) ?? null;
  }

  /**
   * Poll the queue until the UI-created dispatch shows up (there's a short delay
   * between the rider submitting and it landing in the driver queue).
   */
  async waitForDispatchByRiderName(
    riderName: string,
    { timeoutMs = 30_000, intervalMs = 2_000 }: { timeoutMs?: number; intervalMs?: number } = {},
  ): Promise<DispatchRequestRow> {
    const deadline = Date.now() + timeoutMs;
    let last: DispatchRequestRow | null = null;
    while (Date.now() < deadline) {
      last = await this.findDispatchByRiderName(riderName);
      if (last) return last;
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new Error(
      `Dispatch for rider "${riderName}" never appeared in the driver queue within ${timeoutMs}ms`,
    );
  }

  /**
   * POST /drivers-for-dispatch — the assignee's display name + shuttle name, as
   * the API reports them. Call BEFORE assigning (the dispatch must still be in
   * the queue). Used to assert the rider tracking UI shows the right driver in
   * real time, without hardcoding env-specific names.
   */
  async getAssignableDriver(
    dispatchId: number,
    driverId: number,
  ): Promise<{ id: number; name: string; shuttleName: string | null } | null> {
    const res = await this.request.post(
      `${this.baseUrl}/drivers-for-dispatch`,
      this.authOptions({ dispatch: dispatchId }),
    );
    const body = await res.json();
    const drivers: Array<{ id: number; name: string; shuttle?: { name?: string } }> =
      body?.response?.drivers ?? [];
    const d = drivers.find((x) => x.id === driverId) ?? drivers[0];
    if (!d) return null;
    return { id: d.id, name: d.name, shuttleName: d.shuttle?.name ?? null };
  }

  /** True while `dispatchId` is still in the unassigned self-serve queue. */
  async isDispatchInQueue(dispatchId: number): Promise<boolean> {
    const rows = await this.getRequests();
    return rows.some((r) => r.id === dispatchId);
  }

  /**
   * POST /assign-request — assign `driverId` to `dispatchId`. Success is
   * `successCount >= 1 && failedCount === 0` (the API returns 200 either way).
   */
  async assignDriver(dispatchId: number, driverId: number): Promise<AssignResult> {
    const res = await this.request.post(
      `${this.baseUrl}/assign-request`,
      this.authOptions({ requests: [{ dispatch: dispatchId, driver: driverId }] }),
    );
    const body = await res.json();
    const r = body?.response ?? {};
    const successCount = r.successCount ?? 0;
    const failedCount = r.failedCount ?? 0;
    return {
      ok: res.status() === 200 && successCount >= 1 && failedCount === 0,
      code: body?.code ?? res.status(),
      message: body?.message ?? '',
      successCount,
      failedCount,
    };
  }

  /**
   * POST /dispatch-action — mark a dispatch complete (action 1) or cancel it
   * (action 2). `message` is the reason string the API requires. The API returns
   * a human-readable message ("Dispatch completed/canceled successfully").
   */
  async dispatchAction(dispatchId: number, action: number, message: string): Promise<ActionResult> {
    const res = await this.request.post(
      `${this.baseUrl}/dispatch-action`,
      this.authOptions({ dispatch: dispatchId, action, message }),
    );
    const body = await res.json();
    return {
      ok: res.status() === 200,
      code: body?.code ?? res.status(),
      message: body?.message ?? '',
    };
  }

  /**
   * POST /proceed — advance the LOGGED-IN driver's trip to the next stop. For an
   * on-demand ASAP dispatch this doubles as "start trip": the first /proceed
   * after assignment flips the trip to started (see getTripStarted) and moves the
   * rider UI off "Waiting for the driver to start the trip"; a further /proceed
   * per remaining stop drives pickup → dropoff → "Trip Ended". There is no
   * dedicated on-demand start-trip endpoint (/start-trip is Fixed-Route only).
   */
  async proceed(): Promise<ActionResult> {
    const res = await this.request.post(`${this.baseUrl}/proceed`, this.authOptions({}));
    const body = await res.json();
    return {
      ok: res.status() === 200,
      code: body?.code ?? res.status(),
      message: body?.message ?? '',
    };
  }

  /**
   * GET /dashboard → dispatches.trip_started (0 = not started, 1 = started). The
   * reliable signal that the LOGGED-IN driver's assigned trip has begun.
   */
  async getTripStarted(): Promise<number> {
    const res = await this.request.get(`${this.baseUrl}/dashboard`, this.authOptions());
    const body = await res.json();
    return body?.response?.dispatches?.trip_started ?? 0;
  }

  /** POST /mark-arrived — mark the LOGGED-IN driver as arrived at the next stop. */
  async markArrived(): Promise<ActionResult> {
    const res = await this.request.post(`${this.baseUrl}/mark-arrived`, this.authOptions({}));
    const body = await res.json();
    return { ok: res.status() === 200, code: body?.code ?? res.status(), message: body?.message ?? '' };
  }

  /**
   * POST /arrived-stop — passengers to pick up / drop off at the given stop
   * (keyindex). Each row carries an `action` flag (0 = pending). A dispatch moves
   * from `pickups` to `dropoffs` once it's been picked up.
   */
  async getArrivedStop(keyindex: number): Promise<{ pickups: ArrivedStopRow[]; dropoffs: ArrivedStopRow[] }> {
    const res = await this.request.post(
      `${this.baseUrl}/arrived-stop`,
      this.authOptions({ keyindex }),
    );
    const body = await res.json();
    const r = body?.response ?? {};
    return { pickups: r.pickups?.list ?? [], dropoffs: r.dropoffs?.list ?? [] };
  }

  /**
   * POST /update-single-dispatch with status:1 — mark an individual dispatch as
   * PICKED UP at its pickup stop (default index 0). This is the granular
   * per-passenger pickup; it also starts the trip (see getTripStarted) and moves
   * the dispatch from the stop's pickup list to its dropoff list.
   */
  async pickup(dispatchId: number, stopIndex = 0): Promise<ActionResult> {
    const res = await this.request.post(
      `${this.baseUrl}/update-single-dispatch`,
      this.authOptions({ index: stopIndex, dispatches: [{ id: dispatchId, status: 1 }] }),
    );
    const body = await res.json();
    return { ok: res.status() === 200, code: body?.code ?? res.status(), message: body?.message ?? '' };
  }

  /**
   * Best-effort teardown: cancel a dispatch so a half-finished scenario never
   * leaves an active ride/assignment in the (shared) database. Swallows errors
   * (a dispatch already in a terminal state returns 400 — expected, ignore).
   */
  async safeCancel(dispatchId: number, message = 'E2E teardown'): Promise<void> {
    try {
      await this.dispatchAction(dispatchId, DISPATCH_ACTION.CANCEL, message);
    } catch {
      // Teardown is best-effort — don't mask the real test failure.
    }
  }
}
