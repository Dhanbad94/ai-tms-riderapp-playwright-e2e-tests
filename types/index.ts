/**
 * Centralized TypeScript type definitions for TMS E2E tests
 */

// ============================================================================
// Environment Types
// ============================================================================

export type Environment = 'staging' | 'preproduction' | 'production';

// ============================================================================
// Rider Web App Types
// ============================================================================

/** On Demand operation mode */
export type OnDemandMode = 'asapOnly' | 'futureBookingOnly' | 'asapAndFuture' | 'fixedRoute';

/** Stop configuration for an org */
export interface StopConfig {
  pickup: string;
  dropoff: string;
  searchKeyword: string;
  altPickup: string;
  altDropoff: string;
}

/** Phone configuration for an org */
export interface PhoneConfig {
  countryCode: string;
  number: string;
}

/** Complete configuration for a single org/mode combination */
export interface OrgModeConfig {
  trackingId: string;
  enabled: boolean;
  stops: StopConfig;
  phone: PhoneConfig;
  maxRiders: number;
}

/** URL set for rider web app per environment */
export interface RiderUrls {
  base: string;
  ride: string;
  api: string;
}

/**
 * A driver login used by the dispatch-lifecycle suite. `driverId` is the numeric
 * id the API returns inside the login JWT (`result.driver_id`) and the value
 * `/assign-request` expects — cached here so we don't have to decode the token.
 */
export interface DriverAccount {
  label: string;
  phone: string;
  isdCode: string;
  passcode: string;
  driverId: number;
}

/**
 * Driver API configuration for the dispatch-lifecycle suite. The driver API is a
 * separate surface from the rider API (different host + Basic-auth gateway).
 * `basicAuth` gates the pre-login endpoints; the per-driver JWT gates the rest.
 */
export interface DriverApiConfig {
  baseUrl: string;
  basicAuth: { username: string; password: string };
  /** [0] = the driver we log in as (the assigner), [1] = the driver we assign to. */
  drivers: DriverAccount[];
}

/** Full rider environment configuration */
export interface RiderEnvironmentConfig {
  name: Environment;
  urls: RiderUrls;
  canCreateRides: boolean;
  /**
   * Explicit opt-in for the single create-and-cancel smoke test. Lets that one
   * test create (then immediately cancel) a ride even where canCreateRides is
   * false (production) — without unblocking the rest of the @creates-ride suite.
   */
  allowCancelSmoke?: boolean;
  /**
   * Explicit opt-in for the driver dispatch-lifecycle suite (UI-create → assign
   * driver → complete/cancel via the driver API). Like allowCancelSmoke, this
   * lets that suite create a transient ride even where canCreateRides is false;
   * each scenario self-cleans to a terminal state. Requires `driverApi` to be set.
   */
  allowDispatchLifecycle?: boolean;
  /** Driver API config — only present on envs where the dispatch suite can run. */
  driverApi?: DriverApiConfig;
  orgs: Record<OnDemandMode, OrgModeConfig>;
}
