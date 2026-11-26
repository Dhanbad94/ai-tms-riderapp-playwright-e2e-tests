# Test suite conventions

How tests in this repo are structured and written. Read this before authoring
or fixing a test (see `docs/QA_AGENT_PROMPT.md`, Step 4). Everything here is
derived from the existing code — follow the patterns already in the suite.

Last updated: 2026-11-26.

## Repo layout

| Path | What lives there |
|---|---|
| `tests/on-demand/asap-only/` | ASAP booking specs (org `ODASAP`) |
| `tests/on-demand/future-booking-only/` | Future Booking specs (org `ODFB`) |
| `tests/on-demand/platform/` | Cross-cutting platform specs (e.g. env config-drift guard) |
| `pages/rider/` | Page Objects, one per screen/section, plus `index.ts` barrel |
| `fixtures/test-fixtures.ts` | Custom `test`/`expect` that auto-instantiate the page objects |
| `utils/rider-config.ts` | Environments, URLs, test orgs, and the env/mode accessors |
| `constants/index.ts` | `TAGS`/`RIDER_TAGS`, `TIMEOUTS`, `RIDER_TIMEOUTS` |
| `helpers/` | `wait-strategies.ts`, `generate-report.ts`, `parse-stats.py` |
| `run-tests` | Bash wrapper around `playwright test` (env/feature/tag/device flags) |
| `playwright.config.ts` | `testDir: ./tests/on-demand`, projects, timeouts, reporters |
| `app-map.yaml` | Feature → URLs → app code → tests → tags (impact map) |

`testDir` is `./tests/on-demand`, so a new spec must live under it to be picked up.

## Running tests

Prefer the `./run-tests` wrapper; `npm` scripts are shortcuts.

```bash
./run-tests -e staging --tag @smoke --bc            # desktop Chrome, smoke
./run-tests -e staging --tag @regression --bc --workers 1   # serial (ride-creating)
./run-tests -e preproduction -f future --bc         # one feature area
./run-tests -e staging -f asap-location --bc        # one spec
```

- `-e` env: `staging | preproduction | production` · `-f` feature/file · `--tag` grep tag
- Devices: `--bc` desktop Chrome (default), `--bm` Pixel 7, `--bs` iPhone 14, `--ba` all
- Projects (`playwright.config.ts`): `rider-chromium` (UI/safe, parallel), `rider-creates-ride` (ride-creating specs, `workers:1`), `rider-mobile-chrome`, `rider-mobile-safari`.

## Environments & orgs — never hardcode

All environment/org data comes from `utils/rider-config.ts`. Do not hardcode URLs,
hostnames, org IDs or stop names in a spec.

- `getRiderConfig()` → active env (`name`, `urls.{ride,base,api}`, `canCreateRides`, …). Selected by the `ENV` var.
- `getOrgConfig('asapOnly' | 'futureBookingOnly')` → stops, phone, maxRiders for the mode.
- `canCreateRides()` / `canRunCancelSmoke()` → gate ride-creating behaviour (see Test data).

Target the app via config: `page.goto(rc.urls.ride)`, API intercepts via `rc.urls.api`.

Two active test orgs: **`ODASAP`** (ASAP) and **`ODFB`** (Future Booking). Ride
creation is allowed on **staging only**; preproduction shares prod's DB and
production is off-limits — `@creates-ride` specs auto-skip there via `canCreateRides()`.

## Test structure & naming

- **One spec per feature/screen**, named `<mode>-<feature>.spec.ts` (`asap-location.spec.ts`, `future-time-picker.spec.ts`).
- **`test.describe`** titles carry the suite-level tags; the **mode/behaviour tags** go here.
- **Test titles start with a stable ID** `PREFIX_NNN` and a human sentence, e.g.
  `test('@smoke ASAP_015: pickup field accepts a known stop', …)`.
  Prefixes group by area (`ASAP_`, `FB_`, `LOC_`, `TP_`, `HB_`, `DRV_`, …); negative
  cases use a `NEG_` prefix. IDs are stable references — don't renumber existing ones.
- Per-test tags (like `@smoke`) go at the **start of the test title**; suite tags go in the describe title.

```ts
import { test, expect } from '../../../fixtures/test-fixtures';
import { getRiderConfig, getOrgConfig, canCreateRides } from '../../../utils/rider-config';
import { RIDER_TAGS } from '../../../constants';

const rc = getRiderConfig();

test.describe(`ASAP — Location ${RIDER_TAGS.UI_ONLY} ${RIDER_TAGS.SANITY}`, () => {
  test('@smoke LOC_001: ...', async ({ selectLocationPage }) => { /* ... */ });
});
```

## Tags

Use the `RIDER_TAGS` map in `constants/index.ts` — never type a bare string. Current tags:

- **Mode:** `@asap` `@future` `@both` `@fr`
- **Behaviour:** `@creates-ride` `@ui-only` `@payload` `@dispatch-lifecycle` `@negative`
- **Execution:** `@smoke` `@regression` `@sanity` `@safe` `@prod`

Meaning that matters for CI:
- `@creates-ride` — submits a real ride; runs on staging only, serialized (`rider-creates-ride` project / `--workers 1`).
- `@ui-only` / `@safe` / `@prod` — ride-free; safe for production. The production workflow runs `--tag "@ui-only|@prod"`.
- `@smoke` — the fast staging gate; `@regression` — the full staging run.

CI tag selection lives in `.github/workflows/*.yml`; tag a new test so it lands in the right runs.

## Page Object Model

One class per screen/section in `pages/rider/`, exported from `pages/rider/index.ts`
and wired into `fixtures/test-fixtures.ts`.

- Constructor takes `page: Page`; declare `readonly` `Locator`s and build them in the constructor.
- Expose **action** methods (`selectPickup(...)`) and **assertion/state** helpers (`verifyDateTimePickerAbsent()`); keep raw locators inside the object.
- Use the timeout constants from `constants`, and the `helpers/wait-strategies.ts`
  helpers (e.g. `waitForElementStable`) instead of ad-hoc waits.
- Specs get page objects from the fixtures by name — don't `new` them in a spec:

```ts
test('...', async ({ selectLocationPage, guestFormSection }) => { ... });
```

## Locator strategy

The rider app currently exposes **no `data-testid`** attributes, so the suite
relies on accessible/role and text locators. Prefer, in order:

1. `getByRole(role, { name })` — anchor the name with a regex where a loose match
   could collide (e.g. `/^(Confirm Location|Next)$/i` — an unanchored "Next" also
   matched the date-picker's "Next month" arrow).
2. `getByPlaceholder(...)` / `getByLabel(...)` — for form inputs.
3. `getByText(...)` — last resort for labels.

Conventions proven in this suite:
- **Use case-insensitive regexes** for UI labels that churn — the Oct-2026 redesign
  re-cased controls (`View on map` → `View On Map`); `/view on map/i` survives both.
- **Avoid** positional XPath, `nth()` by index, and auto-generated classes. (There is
  a single legacy `xpath=` locator; don't add more.)
- When a source-derived selector doesn't exist live, verify against the running app
  and pick a live-verified locator — the page objects document several such cases
  inline; keep that habit.

## Waiting, timeouts, assertions

- No magic numbers — use `RIDER_TIMEOUTS` / `TIMEOUTS` from `constants` (e.g.
  `RIDE_SUBMIT`, `FORM_LOAD`, `DATE_PICKER`). Add a new named constant rather than inlining.
- Prefer Playwright web-first assertions (`await expect(locator).toBeVisible()`); they auto-retry.
- Give assertions a **message** when the failure wouldn't be self-explanatory:
  `expect(liveApi, 'runtimeConfig.API_ENDPOINT should be set').toBeTruthy()`.

## Test data & isolation

- Each test is self-contained and **order-independent** — no test may depend on another's state.
- Create data through the UI/API only; **never** write to a database.
- Gate ride creation: wrap ride-submitting steps in `canCreateRides()` /
  `canRunCancelSmoke()` and `test.skip(...)` with a clear reason when not allowed, so
  the spec is green-by-skip on preproduction/production rather than failing.
- Respect rate limits: ride-creating specs run serialized; use `RIDE_COOLDOWN` between submissions.
- Never weaken or delete an existing assertion to make a test pass — explain in the PR instead.

## Reporting

- Playwright emits `results.xml` (JUnit) and `test-results.json`; `helpers/parse-stats.py`
  derives the ASAP/Future split and totals for CI, and `helpers/generate-report.ts`
  builds the dashboard. Don't hand-edit those outputs.

## Adding a test — checklist

1. Put it under the right `tests/on-demand/<mode>/` folder; name it `<mode>-<feature>.spec.ts`.
2. Reuse page objects from the fixtures; extend a page object only to add a missing locator/action.
3. Tag it (mode + behaviour + execution) using `RIDER_TAGS`; give each test a `PREFIX_NNN` ID.
4. Use config accessors and timeout constants — no hardcoded URLs or magic waits.
5. Gate ride creation; keep the test self-contained and order-independent.
6. Run it 3× green before raising the PR.
7. **Update `app-map.yaml`** with the new feature/test.
