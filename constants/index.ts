/**
 * Centralized constants for TMS E2E tests
 */

// ============================================================================
// Timeout Constants (in milliseconds)
// ============================================================================

export const TIMEOUTS = {
  /** Default action timeout (clicks, fills, etc.) */
  ACTION: 10000,
  /** Navigation timeout */
  NAVIGATION: 30000,
  /** Assertion/expect timeout */
  EXPECT: 10000,
  /** Page load timeout */
  PAGE_LOAD: 30000,
  /** Short wait for animations */
  SHORT: 500,
  /** Medium wait for async operations */
  MEDIUM: 2000,
  /** Long wait for slow operations */
  LONG: 5000,
  /** API request timeout */
  API: 15000,
} as const;

// ============================================================================
// Viewport Constants
// ============================================================================

export const VIEWPORTS = {
  DESKTOP: { width: 1280, height: 720 },
  DESKTOP_LARGE: { width: 1920, height: 1080 },
  TABLET: { width: 768, height: 1024 },
  MOBILE: { width: 375, height: 667 },
  MOBILE_LARGE: { width: 414, height: 896 },
} as const;

// ============================================================================
// URL Paths (Admin App)
// ============================================================================

export const PATHS = {
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
  PROFILE: '/profile',
  SETTINGS: '/settings',
  ACTIVATE_ACCOUNT: '/activate',
  FORGOT_PASSWORD: '/recover-account',
  LOGOUT: '/logout',
} as const;

// ============================================================================
// Rider Web App Constants
// ============================================================================

export const RIDER_TIMEOUTS = {
  /** Wait for stop list to render after click */
  STOP_LIST: 10_000,
  /** Wait for form to appear after confirm */
  FORM_LOAD: 15_000,
  /** Wait for page redirect after ride submission. Bumped 30→60s for CI staging latency. */
  RIDE_SUBMIT: 60_000,
  /** Cooldown after creating a ride to respect staging rate limits. */
  RIDE_COOLDOWN: 3_000,
  /** Wait for confirmation page elements */
  CONFIRMATION: 15_000,
  /** MUI dropdown animation */
  MUI_DROPDOWN: 500,
  /** Stop selection settle time */
  STOP_SELECT: 1_000,
} as const;

export const RIDER_PATHS = {
  HOME: '/',
  WELCOME: (orgId: string) => `/a/${orgId}`,
  LOCATION: (orgId: string) => `/a/${orgId}/location`,
  TRACKING: (rideCode: string) => `/j/${rideCode}/s`,
  BOOKING: (bookingId: string) => `/b/${bookingId}`,
} as const;

export const RIDER_TAGS = {
  // Mode tags
  ASAP: '@asap',
  FUTURE: '@future',
  BOTH: '@both',
  FR: '@fr',
  // Behavior tags
  CREATES_RIDE: '@creates-ride',
  UI_ONLY: '@ui-only',
  PAYLOAD: '@payload',
  DISPATCH_LIFECYCLE: '@dispatch-lifecycle',   // Driver-API dispatch lifecycle (assign→complete/cancel)
  // Environment/execution tags
  SMOKE: '@smoke',
  REGRESSION: '@regression',
  SANITY: '@sanity',
  SAFE: '@safe',             // Safe for production (no ride creation)
  PROD: '@prod',             // Curated ride-free set run against production on a cron
  NEGATIVE: '@negative',     // Negative / error-path test cases
} as const;

// ============================================================================
// Driver API — Dispatch Lifecycle
// ============================================================================

/**
 * Action codes for POST /dispatch-action (driver API).
 * From the swagger: "1 for complete and 2 for cancellation".
 */
export const DISPATCH_ACTION = {
  COMPLETE: 1,
  CANCEL: 2,
} as const;

/**
 * Status codes as they appear in GET /requests → allRequests[].status (the
 * self-serve queue). status:1 = "waiting on driver" (queued, unassigned) — the
 * only value we assert on, since it's what the queue listing reports.
 *
 * NOTE: the /dispatch-status endpoint's `dispatch.status` field uses a DIFFERENT,
 * unreliable vocabulary (observed to stay 1 after a successful assign and read 3
 * after a successful cancel), so lifecycle transitions are verified via the
 * action responses (assign successCount / dispatch-action message) + the
 * dispatch leaving the queue, NOT via /dispatch-status.
 */
export const DISPATCH_STATUS = {
  WAITING_ON_DRIVER: 1,   // queued, unassigned (as reported by /requests)
} as const;
