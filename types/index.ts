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
  orgs: Record<OnDemandMode, OrgModeConfig>;
}
