import { test, expect } from '../../../fixtures/test-fixtures';
import { getRiderConfig } from '../../../utils/rider-config';
import { RIDER_TAGS } from '../../../constants';

/**
 * "Have a Booking?" — landing-page entry point (phone number only).
 *
 * The rider-app's own landing page ("/") links "Have a Booking?" straight to
 * plain `/sign-in` — no `showFlight` query param, so the component
 * (src/components/web/signIn/signIn.js on the `staging` branch — this
 * feature does not exist on `main`) renders no tabs at all, just the phone
 * form. This is a real, general-purpose rider feature (not Future-Booking-
 * specific), but is exercised here against ODFB's flow for consistency with
 * the rest of this suite.
 *
 * The phone submit path calls a REAL `findMyBookings` API and, on a match,
 * triggers a REAL OTP send + navigation to /otp — tests stop there rather
 * than entering the OTP (no way to receive the SMS in this environment).
 *
 * NEG_HB_002 uses a fixed, deliberately unregistered phone number
 * (7418529630) to reliably hit the "no active booking" (API code 204) path.
 * It must stay unregistered — never use it as a `phone` override when
 * creating a ride anywhere else in this suite.
 */
const rc = getRiderConfig();

test.describe(`Have a Booking — Landing Page (Phone) ${RIDER_TAGS.UI_ONLY} ${RIDER_TAGS.SAFE} ${RIDER_TAGS.REGRESSION}`, () => {
  /** Verify that the "Have a Booking?" link is visible on the landing page and navigates to /sign-in. */
  test('@smoke HB_001: "Have a Booking?" link on the landing page navigates to /sign-in', async ({ page }) => {
    await page.goto(rc.urls.ride, { waitUntil: 'domcontentloaded' });
    const link = page.getByRole('link', { name: 'Have a Booking?' });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '/sign-in');
    await link.click();
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  test.describe('Phone lookup form', () => {
    test.beforeEach(async ({ signInPage }) => {
      await signInPage.goto();
      // Fresh sessions default to United States (+1), not India (+91) — this
      // suite's phone test data is India-formatted, so select it explicitly
      // rather than relying on a cookie from a prior test/run.
      await signInPage.selectCountryCode('India');
    });

    /** Verify that no Phone/Flight tabs render on the plain landing-page /sign-in (phone-only). */
    test('HB_002: No Phone/Flight tabs render without the showFlight query param', async ({ signInPage }) => {
      await expect(signInPage.phoneTabLabel).not.toBeVisible();
      await expect(signInPage.flightTabLabel).not.toBeVisible();
      await expect(signInPage.phoneInput).toBeVisible();
    });

    /** Verify that "Next" stays disabled while the phone field is empty. */
    test('@smoke HB_003: "Next" is disabled with an empty phone number', async ({ signInPage }) => {
      await expect(signInPage.nextButton).toBeDisabled();
    });

    /** Verify that entering invalid/script-like characters shows "Please enter a valid phone number." */
    test('@negative HB_004: Invalid characters in the phone field show a validation error', async ({ signInPage }) => {
      await signInPage.fillPhone('8676913831');
      await signInPage.fillPhone('<script>');
      await expect.poll(() => signInPage.getPhoneErrorText()).toBe('Please enter a valid phone number.');
    });

    /** Verify that a phone number longer than the country's expected length shows "Phone must be {N} digits". */
    test('@negative HB_005: A too-long phone number shows the digit-count validation error', async ({ signInPage }) => {
      await signInPage.fillPhone('86769138311');
      await expect.poll(() => signInPage.getPhoneErrorText()).toBe('Phone must be 10 digits');
      await expect(signInPage.nextButton).toBeDisabled();
    });

    /** Verify that submitting a valid but unregistered phone number shows "No active booking found." with a "Create a booking" link. */
    test('@negative HB_006: An unregistered phone number shows "No active booking found."', async ({ signInPage }) => {
      await signInPage.fillPhone('7418529630');
      await expect(signInPage.nextButton).toBeEnabled();
      await signInPage.clickNext();
      await expect.poll(() => signInPage.getPhoneErrorText(), { timeout: 15_000 })
        .toContain('No active booking found.');
      await expect(signInPage.createBookingLink).toBeVisible();
    });

    /** Verify that clicking "Create a booking" navigates to the marketing site's tracking-code landing page. */
    test('HB_016: "Create a booking" link navigates to the tracking-code landing page', async ({ signInPage, page }) => {
      await signInPage.fillPhone('7418529630');
      await signInPage.clickNext();
      await expect(signInPage.createBookingLink).toBeVisible({ timeout: 15_000 });

      // Live-verified (2026-08-21): a plain <Link href={SITE_CONfIG.WEB_URL}>
      // with no onClick handler — a bare cross-domain navigation, no API call
      // behind it. rc.urls.base IS that WEB_URL for the active environment.
      await expect(signInPage.createBookingLink).toHaveAttribute(
        'href', new RegExp(`^${rc.urls.base.replace(/\./g, '\\.')}/?$`)
      );

      await signInPage.createBookingLink.click();
      await expect(page).toHaveURL(new RegExp(`^${rc.urls.base.replace(/\./g, '\\.')}/?$`), { timeout: 15_000 });
      // Lands back on the "Enter Tracking Code" screen, ready to start a
      // fresh booking — the natural next step after "no booking found".
      await expect(page.getByRole('textbox', { name: 'Enter Tracking Code' })).toBeVisible();
    });

    /** Verify that submitting a registered phone number triggers a real OTP send and navigates to /otp. */
    test('@sanity HB_007: A registered phone number triggers a real OTP and navigates to /otp', async ({ signInPage, page }) => {
      const org = rc.orgs.futureBookingOnly;
      await signInPage.fillPhone(org.phone.number);
      await expect(signInPage.nextButton).toBeEnabled();
      await signInPage.clickNext();
      // Stop here — do not attempt to read/enter the OTP, there is no way to
      // receive the real SMS in this environment.
      await expect(page).toHaveURL(/\/otp$/, { timeout: 15_000 });
    });
  });
});
