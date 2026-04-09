# ai-tms-riderapp-playwright-e2e-tests
This is end to end riderapp automated tests repo.
# TMS Rider Web App — E2E Tests

Playwright + TypeScript end-to-end tests for the TrackMyShuttle Rider Web Application.

## Quick Start

```bash
npm install
npx playwright install chromium

# Run all rider tests (staging)
./run-tests -e staging -u all --bc

# Run smoke tests only
./run-tests -e staging --tag @smoke --bc

# Generate dashboard report
npm run report:dashboard
```

## Test Structure

```
tests/on-demand/asap-only/
├── asap-location.spec.ts      19 tests  @ui-only @safe
├── asap-form.spec.ts          23 tests  @ui-only @safe
├── asap-validation.spec.ts    16 tests  @ui-only @safe
├── asap-api-payload.spec.ts   10 tests  @payload @safe
├── asap-confirmation.spec.ts  11 tests  @creates-ride
├── asap-cancellation.spec.ts  27 tests  @creates-ride
├── asap-feedback.spec.ts      20 tests  @creates-ride
└── asap-e2e.spec.ts            9 tests  @creates-ride
                               ─────────
                               135 total
```

## Run Commands

```bash
# By environment
./run-tests -e staging -f asap --bc
./run-tests -e preproduction -f asap --bc
./run-tests -e production --tag @safe --bc   # Production: safe tests only

# By tag
./run-tests -e staging --tag @smoke --bc     # 20 tests, ~2 min
./run-tests -e staging --tag @sanity --bc    # 9 tests, ~1 min
./run-tests -e staging --tag @regression --bc # All 135, ~10 min
./run-tests -e staging --tag @safe --bc      # 67 tests, ~3 min

# By spec file
./run-tests -e staging -f asap-location --bc
./run-tests -e staging -f asap-cancellation --bc

# Options
./run-tests -e staging -f asap --bc --headed      # Visible browser
./run-tests -e staging -f asap --bc --workers 1    # Sequential
./run-tests -e staging -f asap --bc --debug        # Playwright Inspector
```

## Tags

| Tag | Description | Tests |
|---|---|---|
| `@smoke` | Critical happy paths | 20 |
| `@sanity` | Post-deploy checks | 9 |
| `@regression` | Full coverage | 135 |
| `@safe` | No ride creation — safe for production | 67 |
| `@ui-only` | UI verification only | 57 |
| `@creates-ride` | Creates real rides on staging | 67 |
| `@payload` | API payload verification | 10 |

## Reports

- **Playwright HTML Report:** `npm run report`
- **Custom Dashboard:** `npm run report:dashboard`
- **JUnit XML:** `results.xml`
- **JSON:** `test-results.json`

## Environment Configuration

All environment-specific data (URLs, org codes, stops, phone numbers) is in:
- `utils/rider-config.ts` — Rider web app config per environment
- `utils/test-data.ts` — Admin app credentials (from env vars)

## CI/CD

- GitHub Actions workflows in `.github/workflows/`
- `rider-staging.yml` — Scheduled smoke (daily) + regression (Tue/Thu)
- Slack notifications via `SLACK_WEBHOOK_URL` secret

## GitHub Secrets Required

```
STAGING_MANAGER_EMAIL
STAGING_MANAGER_PASSWORD
SLACK_WEBHOOK_URL (optional)
```
