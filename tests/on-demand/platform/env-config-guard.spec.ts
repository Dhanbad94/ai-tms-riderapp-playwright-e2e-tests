import { test, expect } from '../../../fixtures/test-fixtures';
import { getRiderConfig } from '../../../utils/rider-config';
import { RIDER_TAGS } from '../../../constants';

/**
 * Environment config-drift guard.
 *
 * Rider-Web (the deployed Next.js app) ships its live configuration inside the
 * page as `__NEXT_DATA__.runtimeConfig` (publicRuntimeConfig). The deploy
 * pipeline injects NO env vars (the K8s manifest and CodeDeploy `docker run`
 * both pass nothing), so the running config is whatever was baked into the
 * image at build time — and the repo's committed `.env*` files are stale and
 * identical across environments (all point at staging). That is a latent
 * footgun: a build made without the out-of-band override would silently ship
 * one environment's config to another — e.g. STAGING config onto PRODUCTION.
 *
 * This guard catches exactly that. It reads the deployed app's live
 * `runtimeConfig` and asserts its hosts match THIS environment's known hosts
 * (from `rider-config.ts`, the suite's own source of truth). If production ever
 * starts serving staging's API/web hosts (or vice-versa), these tests go red.
 *
 * Read-only and ride-free: it only loads the public landing page, so it is safe
 * to run on production. Verified green on 2026-11-26 — staging serves staging
 * hosts, production serves production hosts.
 *
 * Full audit of the underlying Rider-Web config issue is tracked for the app
 * owners in the TMS Roadmap Bug Room ("Rider-Web: committed .env* ...").
 */
const rc = getRiderConfig();

/** Host (incl. port if any) of a URL, for an exact, scheme-agnostic comparison.
 *  Accepts `string | undefined` (runtimeConfig fields are optionally present
 *  under noUncheckedIndexedAccess) and fails loudly if a required URL is missing. */
function host(url: string | undefined): string {
  if (!url) throw new Error(`Expected a URL to compare hosts, but got ${JSON.stringify(url)}`);
  return new URL(url).host;
}

/** Pull `runtimeConfig` out of the deployed page's `__NEXT_DATA__` blob. */
async function readRuntimeConfig(page: import('@playwright/test').Page): Promise<Record<string, string>> {
  await page.goto(rc.urls.ride, { waitUntil: 'domcontentloaded' });
  const raw = await page.locator('#__NEXT_DATA__').textContent();
  expect(raw, '__NEXT_DATA__ script should be present on the rider landing page').toBeTruthy();
  const data = JSON.parse(raw as string);
  const runtimeConfig = data?.runtimeConfig;
  expect(
    runtimeConfig && typeof runtimeConfig === 'object',
    'runtimeConfig (publicRuntimeConfig) should be embedded in __NEXT_DATA__',
  ).toBeTruthy();
  return runtimeConfig as Record<string, string>;
}

test.describe(`Environment config-drift guard ${RIDER_TAGS.UI_ONLY} ${RIDER_TAGS.SAFE} ${RIDER_TAGS.SANITY} ${RIDER_TAGS.REGRESSION} ${RIDER_TAGS.PROD}`, () => {
  test(`@smoke CFG_001: deployed rider API host matches the ${rc.name} environment`, async ({ page }) => {
    const runtimeConfig = await readRuntimeConfig(page);
    const liveApi = runtimeConfig.API_ENDPOINT;
    expect(liveApi, 'runtimeConfig.API_ENDPOINT should be set').toBeTruthy();
    // The deployed app's rider API host must be THIS environment's rider API
    // host. A mismatch means the build shipped another environment's config.
    expect(
      host(liveApi),
      `Config drift: ${rc.name} is serving API host "${host(liveApi)}" but should serve "${host(rc.urls.api)}". ` +
        `The deployed build is configured for a different environment.`,
    ).toBe(host(rc.urls.api));
  });

  test(`CFG_002: deployed web URL host matches the ${rc.name} environment`, async ({ page }) => {
    const runtimeConfig = await readRuntimeConfig(page);
    const liveWeb = runtimeConfig.WEB_URL;
    expect(liveWeb, 'runtimeConfig.WEB_URL should be set').toBeTruthy();
    expect(
      host(liveWeb),
      `Config drift: ${rc.name} is serving web host "${host(liveWeb)}" but should serve "${host(rc.urls.base)}". ` +
        `The deployed build is configured for a different environment.`,
    ).toBe(host(rc.urls.base));
  });

  test(`CFG_003: ${rc.name} does not serve a foreign environment's hosts`, async ({ page }) => {
    const runtimeConfig = await readRuntimeConfig(page);
    // Belt-and-braces: no config value may reference an environment other than
    // this one. Tokens that unambiguously belong to the *other* environments.
    const foreignTokens: Record<string, string[]> = {
      production: ['staging', 'stag', 'preprod', 'php-'],
      staging: ['preprod', 'api.trackmyshuttle.com', 'ride.trackmyshuttle.com'],
      preproduction: ['staging', 'rider-staging', 'php-staging'],
    };
    const tokens = foreignTokens[rc.name] ?? [];
    const configHostBlob = [
      runtimeConfig.API_ENDPOINT,
      runtimeConfig.API_ENDPOINT_FUTURE,
      runtimeConfig.API_ENDPOINT_FR,
      runtimeConfig.WEB_URL,
      runtimeConfig.SOCKET_URL,
      runtimeConfig.RIDEAPP_SOCKET_URL,
    ]
      .filter(Boolean)
      .map((u) => host(u))
      .join(' ');
    for (const token of tokens) {
      expect(
        configHostBlob.includes(token),
        `Config drift: ${rc.name} config references foreign-environment token "${token}" in its hosts (${configHostBlob}).`,
      ).toBe(false);
    }
  });
});
