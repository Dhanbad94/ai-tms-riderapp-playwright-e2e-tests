import { test as base } from '@playwright/test';

import { SelectLocationPage } from '../pages/rider/SelectLocationPage';
import { GuestFormSection } from '../pages/rider/GuestFormSection';
import { ConfirmationPage } from '../pages/rider/ConfirmationPage';
import { BookingFormPage } from '../pages/rider/BookingFormPage';
import { CancellationDialog } from '../pages/rider/CancellationDialog';
import { FeedbackModal } from '../pages/rider/FeedbackModal';
import { DateTimePicker } from '../pages/rider/DateTimePicker';
import { FutureGuestFormSection } from '../pages/rider/FutureGuestFormSection';
import { SignInPage } from '../pages/rider/SignInPage';
import { RIDER_TAGS } from '../constants';

/**
 * MapTiler serves the tiles/style for the MapLibre map on the location screen.
 * Headless Chromium draws that WebGL map in software, which makes every action
 * on the page ~1s slower. Measured on staging (2026-11-27): the Future Booking
 * setup took 14-15s with the map, 8-9s with MapTiler blocked. Blocking Google
 * Maps gave no gain and its script is needed elsewhere, so it is left alone.
 */
const MAPTILER = /\/\/api\.maptiler\.com\//;

/**
 * Custom test fixtures — auto-instantiate rider page objects for each test.
 */
export interface TMSFixtures {
  selectLocationPage: SelectLocationPage;
  guestFormSection: GuestFormSection;
  confirmationPage: ConfirmationPage;
  bookingFormPage: BookingFormPage;
  cancellationDialog: CancellationDialog;
  feedbackModal: FeedbackModal;
  /** Future Booking — Pick-up Date & Time section (guestForm.js). */
  dateTimePicker: DateTimePicker;
  /** Future Booking — "Enter Ride Details" form (adds Rider Type + org-configurable Room/Flight). */
  futureGuestFormSection: FutureGuestFormSection;
  /** "Have a booking?" phone/flight lookup page (/sign-in). */
  signInPage: SignInPage;
  /** Auto fixture: blocks MapTiler unless the test is tagged @map (or RENDER_MAPS=1). */
  blockMapTiles: void;
}

export const test = base.extend<TMSFixtures>({
  blockMapTiles: [
    async ({ page }, use, testInfo) => {
      // Tests that check the map itself carry @map (on the test or its describe).
      const renderMaps = testInfo.tags.includes(RIDER_TAGS.MAP) || process.env.RENDER_MAPS === '1';
      if (!renderMaps) {
        await page.route(MAPTILER, (route) => route.abort());
      }
      await use();
    },
    { auto: true },
  ],
  selectLocationPage: async ({ page }, use) => {
    await use(new SelectLocationPage(page));
  },
  guestFormSection: async ({ page }, use) => {
    await use(new GuestFormSection(page));
  },
  confirmationPage: async ({ page }, use) => {
    await use(new ConfirmationPage(page));
  },
  bookingFormPage: async ({ page }, use) => {
    await use(new BookingFormPage(page));
  },
  cancellationDialog: async ({ page }, use) => {
    await use(new CancellationDialog(page));
  },
  feedbackModal: async ({ page }, use) => {
    await use(new FeedbackModal(page));
  },
  dateTimePicker: async ({ page }, use) => {
    await use(new DateTimePicker(page));
  },
  futureGuestFormSection: async ({ page }, use) => {
    await use(new FutureGuestFormSection(page));
  },
  signInPage: async ({ page }, use) => {
    await use(new SignInPage(page));
  },
});

export { expect } from '@playwright/test';
