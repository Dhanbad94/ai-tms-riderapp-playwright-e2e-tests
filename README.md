# TMS Rider Web App — E2E Tests

Playwright + TypeScript end-to-end tests for the TrackMyShuttle **Rider Web App**, plus a
**driver dispatch-lifecycle** suite that drives the Driver API and validates the rider
tracking screen in real time.

## Quick Start

```bash
npm install
npx playwright install --with-deps chromium

# Run the full desktop suite on staging
./run-tests -e staging -u all --bc

# Smoke tests only
./run-tests -e staging --tag @smoke --bc

# Generate the custom dashboard report
npm run report:dashboard
```

## Environments

| Env | Ride creation | What runs there |
|---|---|---|
| **staging** | ✅ allowed | Everything — full regression, incl. `@creates-ride` specs |
| **preproduction** | ⛔ blocked* | `@ui-only` + `@prod` (ride-free), plus the driver dispatch-lifecycle suite |
| **production** | ⛔ blocked* | Same ride-free set as preproduction + one create-and-cancel smoke + dispatch lifecycle |

\* Preproduction and production **share one database**, so bulk ride creation is disabled
(`canCreateRides: false`). Only two deliberate, self-cleaning exceptions run there: the single
create-and-cancel smoke (`allowCancelSmoke`) and the dispatch-lifecycle suite (`allowDispatchLifecycle`),
each of which drives every ride it creates to a terminal state.

## Test Structure

```
tests/on-demand/asap-only/
│  # UI-only / safe (no real rides) ──────────────────────────
├── asap-location.spec.ts            @ui-only @safe
├── asap-location-advanced.spec.ts   @ui-only @safe
├── asap-form.spec.ts                @ui-only @safe   (incl. Flight/Room fields)
├── asap-validation.spec.ts          @ui-only @safe
├── asap-api-payload.spec.ts         @payload @safe   (mocked POST — no real ride)
│  # Creates real rides (staging only) ────────────────────────
├── asap-confirmation.spec.ts        @creates-ride
├── asap-cancellation.spec.ts        @creates-ride    (+ @prod create-and-cancel smoke)
├── asap-feedback.spec.ts            @creates-ride
├── asap-e2e.spec.ts                 @creates-ride
│  # Driver API — dispatch lifecycle (preprod + production) ───
└── asap-dispatch-lifecycle.spec.ts  @dispatch-lifecycle
```

**≈169 tests** collected on the desktop projects (varies per environment as gated tests skip).

## Driver Dispatch Lifecycle

`asap-dispatch-lifecycle.spec.ts` exercises the **driver side** of an ASAP ride end-to-end
against the TMS **Driver API** (`utils/api/driver-client.ts`), correlating each step back to
the rider's tracking screen:

| # | Scenario |
|---|---|
| DISPATCH_001 | create → assign driver → **complete** |
| DISPATCH_002 | create → assign driver → **cancel** |
| DISPATCH_003 | driver assignment updates the rider tracking UI **in real time** |
| DISPATCH_004 | full journey: submitted → assigned → **start** → complete (UI at each screen) |
| DISPATCH_005 | full journey with **granular pick-up** → drop-off → complete |

Gated by `canRunDispatchLifecycle()` (enabled on preproduction; opt-in on production). Uses two
dedicated test drivers and self-cleans every dispatch, so nothing is left active on the shared DB.

## Run Commands

```bash
# By environment
./run-tests -e staging -f asap --bc
./run-tests -e preproduction --tag "@ui-only|@prod" --bc
./run-tests -e production --tag @safe --bc            # production: ride-free only

# By tag
./run-tests -e staging --tag @smoke --bc
./run-tests -e staging --tag @regression --bc
./run-tests -e preproduction --tag @dispatch-lifecycle --bc

# By spec file
./run-tests -e staging -f asap-location --bc
./run-tests -e staging -f asap-cancellation --bc

# Devices
./run-tests -e staging -f asap --bc                   # Desktop Chrome (default)
./run-tests -e staging -f asap --bm                   # Mobile Chrome (Pixel 7)
./run-tests -e staging -f asap --bs                   # Mobile Safari (iPhone 14)
./run-tests -e staging -f asap --ba                   # All devices

# Options
./run-tests -e staging -f asap --bc --headed          # Visible browser
./run-tests -e staging -f asap --bc --workers 1       # Sequential
./run-tests -e staging -f asap --bc --debug           # Playwright Inspector
```

## Tags

| Tag | Description | ~Count (desktop) |
|---|---|---|
| `@smoke` | Critical happy paths | 16 |
| `@sanity` | Post-deploy checks | 9 |
| `@regression` | Full coverage | 163 |
| `@safe` | No ride creation — safe for production | 94 |
| `@ui-only` | UI verification only | 77 |
| `@creates-ride` | Creates real rides (staging) | 69 |
| `@payload` | API payload verification (mocked) | 12 |
| `@prod` | Curated ride-free set + cancel smoke run on the production cron | 4 |
| `@dispatch-lifecycle` | Driver-API dispatch lifecycle (preprod + prod) | 5 |

## Projects

| Project | Device | Purpose |
|---|---|---|
| `rider-chromium` | Desktop Chrome | UI / safe specs, fully parallel |
| `rider-creates-ride` | Desktop Chrome | Ride-creating + dispatch specs, serialized (`workers: 1`) to respect rate limits and the shared DB |
| `rider-mobile-chrome` | Pixel 7 | Mobile Chrome |
| `rider-mobile-safari` | iPhone 14 | Mobile Safari (WebKit) |

## Reports

- **Playwright HTML report:** `npm run report`
- **Custom dashboard:** `npm run report:dashboard` → `dashboard-report.html`
- **JUnit XML:** `results.xml`
- **JSON:** `test-results.json`

The dashboard **pass rate is computed over executed tests only** — skipped tests are excluded
(they didn't run) and flaky tests count as passes (they passed on retry):
`passRate = (passed + flaky) / (passed + failed + flaky)`. Total and Skipped are still shown
separately, so intentional skips are visible but don't distort the health percentage.

## Environment Configuration

All environment-specific data lives in **`utils/rider-config.ts`**:
- Rider web app URLs, org codes, stops, and phone numbers per environment
- `driverApi` block (base URL, Basic-auth gateway, test drivers) for the dispatch suite
- Safety flags: `canCreateRides`, `allowCancelSmoke`, `allowDispatchLifecycle`

No `.env` file is required. The only runtime env vars are `ENV` / `CI` (set on the command line
or by CI). The driver-API Basic gateway credentials have in-config defaults and can optionally be
overridden via `PREPROD_DRIVER_BASIC_USER` / `PREPROD_DRIVER_BASIC_PASS`.

## CI/CD

GitHub Actions workflows in `.github/workflows/`:

| Workflow | Trigger | Runs |
|---|---|---|
| `playwright.yml` | push / PR / manual | PR validation |
| `rider-staging.yml` | Mon–Fri 06:00 (smoke) · Tue/Thu 08:00 (regression) · manual | staging |
| `rider-preproduction.yml` | Mon–Fri 06:30 · manual | preproduction — `@ui-only \| @prod` |
| `rider-production.yml` | Mon–Fri 07:00 · manual | production — `@ui-only \| @prod` |

Each run posts a **Slack** summary (total / passed / failed / flaky / duration) with a **View Report
Results** button linking to the custom dashboard published to **GitHub Pages** (per-run URL).

## GitHub Secrets

```
SLACK_WEBHOOK_URL              # optional — Slack notifications
GITHUB_TOKEN                   # provided automatically (Pages publish)
PREPROD_DRIVER_BASIC_USER      # optional — override driver-API gateway user
PREPROD_DRIVER_BASIC_PASS      # optional — override driver-API gateway password
```
