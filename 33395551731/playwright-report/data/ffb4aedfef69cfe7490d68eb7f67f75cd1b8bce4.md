# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: future-booking-only/future-api-payload.spec.ts >> Future Booking — API Payload Verification @future @payload @regression @safe >> FB_039: Verify that a booking with a randomly picked date and time still produces a booking object with the chosen time
- Location: tests/on-demand/future-booking-only/future-api-payload.spec.ts:116:7

# Error details

```
Error: No bookable date found among 5 random candidates (all sold out or errored).
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e5]:
    - generic [ref=e6]:
      - generic [ref=e7]:
        - button "back" [ref=e8] [cursor=pointer]:
          - img "back" [ref=e9]
        - heading "Confirm Location & Time" [level=2] [ref=e10]
      - generic [ref=e12]:
        - generic [ref=e13]:
          - img "pickup" [ref=e20]
          - generic [ref=e21]:
            - textbox "Pick-up from?" [ref=e22]: Airport (ORD)
            - img "clear" [ref=e24] [cursor=pointer]
        - generic [ref=e25]:
          - img "dropoff" [ref=e27]
          - generic [ref=e28]:
            - textbox "Where to?" [ref=e29]: Terminal 5E
            - img "clear" [ref=e31] [cursor=pointer]
    - generic [ref=e33]:
      - generic [ref=e34]:
        - generic [ref=e35]:
          - generic:
            - region "Map" [ref=e36]
            - generic "Map marker" [ref=e37]:
              - img "Pick-up" [ref=e39]
            - generic "Map marker" [ref=e40]:
              - generic [ref=e41]: Pick-up
            - generic "Map marker" [ref=e42]:
              - img "Drop-off" [ref=e44]
            - generic "Map marker" [ref=e45]:
              - generic [ref=e46]: Drop-off
          - group [ref=e47]:
            - generic [ref=e48]:
              - link "© MapTiler" [ref=e49] [cursor=pointer]:
                - /url: https://www.maptiler.com/copyright/
              - link "© OpenStreetMap contributors" [ref=e50] [cursor=pointer]:
                - /url: https://www.openstreetmap.org/copyright
        - generic [ref=e52]:
          - button [ref=e53] [cursor=pointer]:
            - img [ref=e54]
          - button [ref=e57] [cursor=pointer]:
            - img [ref=e58]
      - generic [ref=e61]:
        - generic [ref=e63]:
          - generic [ref=e67]:
            - textbox "Pick-up Date" [ref=e68]: Today
            - img [ref=e70]
            - group
          - generic [ref=e73]:
            - textbox "Pick-up Time" [ref=e75]
            - img "clock" [ref=e77]
        - generic [ref=e81]:
          - generic:
            - text: No. of Riders
            - subscript: "*"
          - generic [ref=e82]:
            - combobox "No. of Riders *" [ref=e83] [cursor=pointer]
            - textbox
            - img
            - group:
              - generic: No. of Riders *
        - button "Next" [disabled] [ref=e88]
  - alert [ref=e90]
  - dialog [ref=e91]:
    - generic [ref=e95]:
      - generic [ref=e96]:
        - generic [ref=e97] [cursor=pointer]:
          - generic [ref=e99]: August 2026
          - button "calendar view is open, switch to year view" [ref=e100]:
            - img [ref=e101]
        - generic [ref=e103]:
          - button "Previous month" [disabled]:
            - img
          - button "Next month" [ref=e105] [cursor=pointer]:
            - img [ref=e106]
      - grid "August 2026" [ref=e110]:
        - row "Sunday Monday Tuesday Wednesday Thursday Friday Saturday" [ref=e111]:
          - columnheader "Sunday" [ref=e112]: S
          - columnheader "Monday" [ref=e113]: M
          - columnheader "Tuesday" [ref=e114]: T
          - columnheader "Wednesday" [ref=e115]: W
          - columnheader "Thursday" [ref=e116]: T
          - columnheader "Friday" [ref=e117]: F
          - columnheader "Saturday" [ref=e118]: S
        - rowgroup [ref=e119]:
          - row "1" [ref=e120]:
            - gridcell
            - gridcell
            - gridcell
            - gridcell
            - gridcell
            - gridcell
            - gridcell "1" [disabled]
          - row "2 3 4 5 6 7 8" [ref=e121]:
            - gridcell "2" [disabled]
            - gridcell "3" [disabled]
            - gridcell "4" [disabled]
            - gridcell "5" [disabled]
            - gridcell "6" [disabled]
            - gridcell "7" [disabled]
            - gridcell "8" [disabled]
          - row "9 10 11 12 13 14 15" [ref=e122]:
            - gridcell "9" [disabled]
            - gridcell "10" [disabled]
            - gridcell "11" [disabled]
            - gridcell "12" [disabled]
            - gridcell "13" [disabled]
            - gridcell "14" [disabled]
            - gridcell "15" [disabled]
          - row "16 17 18 19 20 21 22" [ref=e123]:
            - gridcell "16" [disabled]
            - gridcell "17" [disabled]
            - gridcell "18" [disabled]
            - gridcell "19" [disabled]
            - gridcell "20" [disabled]
            - gridcell "21" [disabled]
            - gridcell "22" [disabled]
          - row "23 24 25 26 27 28 29" [ref=e124]:
            - gridcell "23" [disabled]
            - gridcell "24" [disabled]
            - gridcell "25" [disabled]
            - gridcell "26" [disabled]
            - gridcell "27" [disabled]
            - gridcell "28" [disabled]
            - gridcell "29" [disabled]
          - row "30 31" [ref=e125]:
            - gridcell "30" [disabled]
            - gridcell "31" [selected] [ref=e126] [cursor=pointer]: "31"
            - gridcell
            - gridcell
            - gridcell
            - gridcell
            - gridcell
```

# Test source

```ts
  310 |     for (const label of remaining) {
  311 |       await this.selectGridSlot(label);
  312 |       await this.clickSetPickupTime();
  313 |       const confirmed = await this.timeInput.inputValue().catch(() => '');
  314 |       if (confirmed === label) return label;
  315 |       // Rejected — the modal stays open with a lead-time error; try the next chip.
  316 |       const stillOpen = await this.timeModalHeading.isVisible({ timeout: 1_000 }).catch(() => false);
  317 |       if (!stillOpen) await this.openTimeModal();
  318 |       await this.switchToGridView();
  319 |     }
  320 |     throw new Error(`Could not confirm any of ${remaining.length} randomly-tried Grid View slots (all rejected, likely lead-time expiry).`);
  321 |   }
  322 | 
  323 |   /** Full happy-path: open the modal, pick a time, confirm it. */
  324 |   async pickTime(time: { hour: string; minute: string; period: 'AM' | 'PM' }) {
  325 |     await this.openTimeModal();
  326 |     await this.selectTime(time);
  327 |     await this.clickSetPickupTime();
  328 |   }
  329 | 
  330 |   /**
  331 |    * Ensure the Pick-up Time field is fillable before proceeding. The date
  332 |    * guestForm.js auto-selects on load (today, if available) can run out of
  333 |    * remaining seats over the course of a test session — confirmed live: every
  334 |    * ride this suite creates consumes one seat from its slot, and once a
  335 |    * whole day is exhausted the Pick-up Time input is left `disabled` with no
  336 |    * slots to pick. Tries a handful of other available dates (shuffled) when
  337 |    * that happens, since under heavy test-session load more than one nearby
  338 |    * date can be sold out — not just today.
  339 |    */
  340 |   async ensureBookableSlot(maxAttempts = 5) {
  341 |     if (!(await this.isTimeInputDisabled())) return;
  342 | 
  343 |     await this.openDatePicker();
  344 |     const enabledDays = await this.waitForEnabledDayNumbers();
  345 |     const candidates = [...enabledDays].sort(() => Math.random() - 0.5).slice(0, maxAttempts);
  346 | 
  347 |     for (const day of candidates) {
  348 |       await this.openDatePicker();
  349 |       await this.selectDateByDay(day);
  350 |       try {
  351 |         await expect(this.timeInput).toBeEnabled({ timeout: RIDER_TIMEOUTS.SLOTS_LOAD });
  352 |         return;
  353 |       } catch {
  354 |         // This date is also sold out — loop tries the next candidate.
  355 |       }
  356 |     }
  357 |     throw new Error(`No bookable slot found among ${candidates.length} candidate dates (all sold out or errored).`);
  358 |   }
  359 | 
  360 |   /**
  361 |    * Accept whichever slot is pre-selected when the modal opens. guestForm.js
  362 |    * seeds pickerValue from the first slot returned by /slots on fetch
  363 |    * (fetchTimeSlots: `setPickerValue({hour: firstSlot.hour, ...})`), so simply
  364 |    * confirming without changing the columns books the earliest available slot
  365 |    * for the currently-selected date. The building block every future-booking
  366 |    * spec that needs to reach the guest form uses to get past the date/time step.
  367 |    */
  368 |   async acceptDefaultSlot() {
  369 |     await this.ensureBookableSlot();
  370 |     await this.openTimeModal();
  371 |     await this.clickSetPickupTime();
  372 |   }
  373 | 
  374 |   /**
  375 |    * Pick a random org-available date, then a random VALID time slot on that
  376 |    * date (via Grid View, whose chips are one-per-slot, so no combination can
  377 |    * be invalid), and confirm it. Returns what was picked so callers can
  378 |    * assert against it downstream.
  379 |    *
  380 |    * Retries across a handful of shuffled candidate dates (same reasoning as
  381 |    * ensureBookableSlot()) since a randomly-picked date can turn out to be
  382 |    * fully booked under heavy test-session load.
  383 |    *
  384 |    * IMPORTANT: does NOT pick hour/minute/period independently from the
  385 |    * scroll-wheel List View columns — confirmed live that this can silently
  386 |    * fail. The minute column is filtered per selected hour (filteredMinutes()
  387 |    * in guestForm.js), so an hour and a minute chosen independently of each
  388 |    * other can land on a combination no real slot has; handleSetPickUpTime()
  389 |    * then just sets a validation error and leaves Pick-up Time empty, with no
  390 |    * thrown exception to catch. Grid View sidesteps this entirely since each
  391 |    * chip already IS a real, selectable slot.
  392 |    */
  393 |   async selectRandomDateAndTime(maxAttempts = 5): Promise<{ day: string; label: string }> {
  394 |     await this.openDatePicker();
  395 |     const enabledDays = await this.waitForEnabledDayNumbers();
  396 |     const candidates = [...enabledDays].sort(() => Math.random() - 0.5).slice(0, maxAttempts);
  397 | 
  398 |     let day: string | undefined;
  399 |     for (const candidate of candidates) {
  400 |       await this.openDatePicker();
  401 |       await this.selectDateByDay(candidate);
  402 |       try {
  403 |         await expect(this.timeInput).toBeEnabled({ timeout: RIDER_TIMEOUTS.SLOTS_LOAD });
  404 |         day = candidate;
  405 |         break;
  406 |       } catch {
  407 |         // Sold out — try the next candidate date.
  408 |       }
  409 |     }
> 410 |     if (!day) throw new Error(`No bookable date found among ${candidates.length} random candidates (all sold out or errored).`);
      |                     ^ Error: No bookable date found among 5 random candidates (all sold out or errored).
  411 | 
  412 |     const label = await this.pickRandomSlotViaGridView();
  413 |     return { day, label };
  414 |   }
  415 | 
  416 |   /** Text of the in-modal lead-time/earliest-slot validation error, if shown. */
  417 |   async getTimeExpiredErrorText(): Promise<string | null> {
  418 |     if (!(await this.timeExpiredError.isVisible({ timeout: 2_000 }).catch(() => false))) return null;
  419 |     return (await this.timeExpiredError.textContent())?.trim() ?? null;
  420 |   }
  421 | 
  422 |   /** Text of the section-level inline error banner (no dates/slots available, etc.), if shown. */
  423 |   async getInlineErrorText(): Promise<string | null> {
  424 |     if (!(await this.inlineErrorBanner.first().isVisible({ timeout: 2_000 }).catch(() => false))) return null;
  425 |     return (await this.inlineErrorBanner.first().textContent())?.trim() ?? null;
  426 |   }
  427 | }
  428 | 
```