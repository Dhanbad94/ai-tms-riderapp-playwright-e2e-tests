/**
 * Rider Web App — Environment Configuration
 *
 * Provides per-environment URLs, org codes, stop names, phone numbers,
 * and safety flags for the rider web app E2E tests.
 *
 * Usage:
 *   import { getRiderConfig } from '../utils/rider-config';
 *   const config = getRiderConfig();
 *   const { trackingId, stops, phone } = config.orgs.asapOnly;
 */

import type {
  RiderEnvironmentConfig,
  OrgModeConfig,
  OnDemandMode,
} from '../types';

// ============================================================================
// Default org mode placeholder — used for modes not yet configured
// ============================================================================

const PLACEHOLDER_ORG: OrgModeConfig = {
  trackingId: 'CHANGE_ME',
  enabled: false,
  stops: {
    pickup: '',
    dropoff: '',
    searchKeyword: '',
    altPickup: '',
    altDropoff: '',
  },
  phone: {
    countryCode: 'India',
    number: '8676913831',
  },
  maxRiders: 10,
};

// ============================================================================
// Staging Configuration — FULLY CONFIGURED
// ============================================================================

const STAGING: RiderEnvironmentConfig = {
  name: 'staging',
  urls: {
    base: 'https://staging.trackmyshuttle.com',
    ride: 'https://ride-stag.trackmyshuttle.com',
    api: 'https://riderapp-stag.trackmyshuttle.com',
  },
  canCreateRides: true,
  orgs: {
    asapOnly: {
      trackingId: 'ODASAP',
      enabled: true,
      stops: {
        pickup: 'Automated OD ASAP',
        dropoff: 'Terminal 5E',
        searchKeyword: 'Terminal',
        altPickup: 'Mannheim Rd',
        altDropoff: 'Terminal 3 10000',
      },
      phone: {
        countryCode: 'India',
        number: '8676913831',
      },
      maxRiders: 10,
    },
    futureBookingOnly: { ...PLACEHOLDER_ORG },
    asapAndFuture: { ...PLACEHOLDER_ORG },
    fixedRoute: { ...PLACEHOLDER_ORG },
  },
};

// ============================================================================
// Pre-production Configuration — URLs set, orgs as placeholders
// ============================================================================

const PREPRODUCTION: RiderEnvironmentConfig = {
  name: 'preproduction',
  urls: {
    base: 'https://preproduction.trackmyshuttle.com',
    ride: 'https://ride-preprod.trackmyshuttle.com',
    api: 'https://riderapp-stage.trackmyshuttle.com',
  },
  canCreateRides: true,
  orgs: {
    asapOnly: { ...PLACEHOLDER_ORG },
    futureBookingOnly: { ...PLACEHOLDER_ORG },
    asapAndFuture: { ...PLACEHOLDER_ORG },
    fixedRoute: { ...PLACEHOLDER_ORG },
  },
};

// ============================================================================
// Production Configuration — RIDE CREATION BLOCKED
// ============================================================================

const PRODUCTION: RiderEnvironmentConfig = {
  name: 'production',
  urls: {
    base: 'https://trackmyshuttle.com',
    ride: 'https://ride.trackmyshuttle.com',
    api: 'https://riderapp.trackmyshuttle.com',
  },
  canCreateRides: false,
  orgs: {
    asapOnly: { ...PLACEHOLDER_ORG },
    futureBookingOnly: { ...PLACEHOLDER_ORG },
    asapAndFuture: { ...PLACEHOLDER_ORG },
    fixedRoute: { ...PLACEHOLDER_ORG },
  },
};

// ============================================================================
// Config Map & Accessor
// ============================================================================

const RIDER_CONFIGS: Record<string, RiderEnvironmentConfig> = {
  staging: STAGING,
  preproduction: PREPRODUCTION,
  production: PRODUCTION,
};

/**
 * Get the rider web app configuration for the current environment.
 * Reads from ENV variable, defaults to 'staging'.
 */
export function getRiderConfig(): RiderEnvironmentConfig {
  const env = (process.env.ENV || 'staging').toLowerCase();

  const config = RIDER_CONFIGS[env];
  if (!config) {
    console.warn(`Unknown environment '${env}', defaulting to staging`);
    return STAGING;
  }
  return config;
}

/**
 * Get the org mode configuration for the active environment.
 * Throws if the mode is not enabled.
 */
export function getOrgConfig(mode: OnDemandMode): OrgModeConfig {
  const config = getRiderConfig();
  const org = config.orgs[mode];

  if (!org.enabled) {
    throw new Error(
      `Mode '${mode}' is not enabled for environment '${config.name}'. ` +
      `Set enabled=true and configure trackingId/stops in rider-config.ts`
    );
  }

  return org;
}

/**
 * Check if ride creation is allowed in the current environment.
 * Used as a safety guard before tests that submit real rides.
 */
export function canCreateRides(): boolean {
  return getRiderConfig().canCreateRides;
}

export { STAGING, PREPRODUCTION, PRODUCTION, RIDER_CONFIGS };
