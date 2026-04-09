import { test as base } from '@playwright/test';

import { SelectLocationPage } from '../pages/rider/SelectLocationPage';
import { GuestFormSection } from '../pages/rider/GuestFormSection';
import { ConfirmationPage } from '../pages/rider/ConfirmationPage';
import { BookingFormPage } from '../pages/rider/BookingFormPage';
import { CancellationDialog } from '../pages/rider/CancellationDialog';
import { FeedbackModal } from '../pages/rider/FeedbackModal';

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
}

export const test = base.extend<TMSFixtures>({
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
});

export { expect } from '@playwright/test';
