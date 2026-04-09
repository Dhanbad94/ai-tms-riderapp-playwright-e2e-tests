import { Page } from '@playwright/test';
import { SelectLocationPage } from './SelectLocationPage';
import { GuestFormSection } from './GuestFormSection';
import { getRiderConfig } from '../../utils/rider-config';
import type { OnDemandMode } from '../../types';

/**
 * Composite Page Object — orchestrates the full booking flow:
 * Location Selection → Guest Form → Submission
 */
export class BookingFormPage {
  readonly page: Page;
  readonly locationPage: SelectLocationPage;
  readonly guestForm: GuestFormSection;

  constructor(page: Page) {
    this.page = page;
    this.locationPage = new SelectLocationPage(page);
    this.guestForm = new GuestFormSection(page);
  }

  /** Navigate to location page using env config */
  async goto(mode: OnDemandMode = 'asapOnly') {
    const config = getRiderConfig();
    const orgId = config.orgs[mode].trackingId;
    await this.locationPage.goto(orgId);
  }

  /** Complete the full booking flow with default or custom data */
  async fillBookingDetails(data: {
    pickup?: string;
    dropoff?: string;
    name?: string;
    phone?: string;
  } = {}) {
    const config = getRiderConfig();
    const org = config.orgs.asapOnly;

    const pickup = data.pickup || org.stops.pickup;
    const dropoff = data.dropoff || org.stops.dropoff;
    const name = data.name || 'PW Test Rider';
    const phone = data.phone || org.phone.number;

    await this.locationPage.selectBothStops(pickup, dropoff);
    await this.locationPage.clickConfirm();
    await this.guestForm.waitForFormVisible();
    await this.guestForm.fillRequiredFields({ name, phone });
  }

  async submitBooking() {
    await this.guestForm.requestRideButton.scrollIntoViewIfNeeded();
    await this.guestForm.submitForm();
  }
}
