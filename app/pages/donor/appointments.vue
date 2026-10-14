<template>
  <div class="appointment-page">
    <!-- Skeleton loading state -->
    <div v-if="loading" class="appointment-page-inner">
      <div class="skeleton skeleton--header" />
      <div class="skeleton skeleton--grid">
        <div class="skeleton skeleton--card" v-for="n in 2" :key="n" />
      </div>
      <div class="skeleton skeleton--panel" />
    </div>

    <div v-else class="appointment-page-inner">
      <div class="header-row">
        <h1 class="page-title">Book a donation</h1>
        <p class="page-subtitle">Pick a blood center and time, or join a mobile blood drive.</p>
      </div>

      <!--
        Ang server mo-reject sa slot nga una sa next eligible date
        (below_min_interval). Gipakita na daan imbes mahibal-an ra inig Confirm.
      -->
      <div v-if="showBookingWizard && eligibleLater" class="eligible-banner" role="status">
        <AssetIcon name="calendar" :size="16" class="eligible-banner__icon" />
        <p class="eligible-banner__text">
          You can donate again from <strong>{{ formatDate(nextEligibleDate) }}</strong>.
          Earlier dates are not available to book.
        </p>
      </div>

      <!-- Your upcoming appointment -->
      <div v-if="appointmentsLoading || appointmentsError || activeAppointments.length"
        class="step-section">
        <h2 class="step-label">Your upcoming appointment</h2>

        <div v-if="appointmentsLoading" class="drive-state">
          <div class="spinner" />
          <p>Loading your appointments...</p>
        </div>

        <div v-else-if="appointmentsError" class="drive-state">
          <p>{{ appointmentsError }}</p>
        </div>

        <div v-else class="my-appointment-list">
          <article v-for="appointment in activeAppointments" :key="appointment.id" class="appt-ticket"
            :class="{ 'appt-ticket--rescheduling': reschedulingId === appointment.id }">
            <!-- Date stub, like the torn-off end of a ticket -->
            <div class="appt-ticket__stub">
              <span class="appt-ticket__dow">{{ dateParts(appointment.date).weekday }}</span>
              <span class="appt-ticket__day">{{ dateParts(appointment.date).day }}</span>
              <span class="appt-ticket__month">{{ dateParts(appointment.date).month }} {{ dateParts(appointment.date).year }}</span>
              <span class="appt-ticket__time">{{ formatTime(appointment.time) }}</span>
            </div>

            <div class="appt-ticket__body">
              <p v-if="reschedulingId === appointment.id" class="appt-ticket__flag">
                <AssetIcon name="calendar" :size="13" /> Rescheduling this appointment
              </p>
              <div class="appt-ticket__top">
                <h3 class="appt-ticket__name">
                  {{ appointment.drive_name || appointment.facility_name || 'Blood center' }}
                </h3>
                <span class="badge" :class="appointmentStatusClass(appointment.status)">
                  {{ appointment.status_label || appointment.status }}
                </span>
              </div>
              <p class="appt-ticket__meta">
                <span>
                  <AssetIcon :name="appointment.appointment_type === 'mobile' ? 'truck' : 'building-2'" :size="13" />
                  {{ appointment.appointment_type === 'mobile' ? 'Mobile blood drive' : 'Walk-in' }}
                </span>
                <span><AssetIcon name="calendar" :size="13" /> {{ formatDate(appointment.date) }}, {{ formatTime(appointment.time) }}</span>
              </p>

              <!--
                Booking no longer requires a health questionnaire, so this is the
                only thing on the donor's own screens that tells them one is due.
                Silent here means a donor arrives at the counter with nothing to
                scan.
              -->
              <div v-if="screeningNotice(appointment)" class="screening-notice"
                :class="`screening-notice--${screeningNotice(appointment).tone}`">
                <p class="screening-notice__text">{{ screeningNotice(appointment).text }}</p>
                <NuxtLink v-if="screeningNotice(appointment).cta" to="/donor/eligibility" class="screening-notice__link">
                  {{ screeningNotice(appointment).cta }}
                </NuxtLink>
              </div>

              <div class="appt-ticket__foot">
                <p class="appt-ticket__note">
                  {{ appointment.can_cancel
                    ? 'You can cancel or reschedule this any time before it starts.'
                    : 'This appointment can no longer be changed.' }}
                </p>
                <div v-if="appointment.can_cancel" class="appt-ticket__actions">
                  <button type="button" class="appt-ticket__cancel"
                    :disabled="appointmentActionId === appointment.id" @click="handleCancel(appointment)">
                    {{ appointmentActionId === appointment.id ? 'Cancelling...' : 'Cancel' }}
                  </button>
                  <button type="button" class="btn-outline appt-ticket__reschedule"
                    :disabled="appointmentActionId === appointment.id || reschedulingId === appointment.id"
                    @click="startReschedule(appointment)">
                    <AssetIcon name="calendar" :size="14" />
                    Reschedule
                  </button>
                </div>
              </div>
            </div>
          </article>
        </div>
          <p v-if="appointmentActionError" class="my-appointment-error">{{ appointmentActionError }}</p>
          <!-- Ang Reschedule kay mogawas ra kung can_cancel (gikan sa server; naka-config ang window) -->
          <p v-if="!showBookingWizard" class="one-booking-note">
            <template v-if="activeAppointments.some(a => a.can_cancel)">
              You can have one upcoming appointment at a time. Use Reschedule if you need a different date or time.
            </template>
            <template v-else>
              You can have one upcoming appointment at a time. If you can no longer make it, please contact the
              blood center directly.
            </template>
          </p>
      </div>

      <!--
        Ang booking wizard. Gitago kung naa nay upcoming appointment (gawas kung
        nag-reschedule): ang server mo-reject sa ikaduha (duplicate_appointment),
        so ayaw na papunon sa donor ang tibuok form para ma-reject ra sa katapusan.
      -->
      <template v-if="showBookingWizard">
      <!-- Reschedule mode: ang wizard sa ubos mao gihapon ang gamiton, PATCH ra
           imbes POST ang i-send sa Confirm. -->
      <div v-if="reschedulingId" class="reschedule-banner">
        <p class="reschedule-banner__text">
          Pick a new slot below, then confirm to move your appointment.
        </p>
        <button type="button" class="btn-outline" @click="cancelReschedule">Keep current</button>
      </div>

      <!--
        Two columns: the choices on the left, and a ticket on the right that
        fills in as the donor picks. On small screens the ticket becomes a bar
        pinned to the bottom.
      -->
      <div class="booking-layout">
        <div class="booking-steps">
          <!-- Type: always visible, so the mobile drive option is never hidden -->
          <div class="type-switch" role="radiogroup" aria-label="How do you want to donate?">
            <button type="button" role="radio" class="type-switch__opt"
              :class="{ 'type-switch__opt--active': appointmentType === 'walkin' }"
              :aria-checked="appointmentType === 'walkin' ? 'true' : 'false'" @click="selectType('walkin')">
              <span class="type-switch__icon"><AssetIcon name="building-2" :size="18" /></span>
              <span class="type-switch__body">
                <span class="type-switch__title">Walk-in at a blood center</span>
                <span class="type-switch__desc">Pick a center and a time slot</span>
              </span>
            </button>
            <button type="button" role="radio" class="type-switch__opt"
              :class="{ 'type-switch__opt--active': appointmentType === 'mobile' }"
              :aria-checked="appointmentType === 'mobile' ? 'true' : 'false'" @click="selectType('mobile')">
              <span class="type-switch__icon"><AssetIcon name="truck" :size="18" /></span>
              <span class="type-switch__body">
                <span class="type-switch__title">Mobile blood drive</span>
                <span class="type-switch__desc">Join a community drive near you</span>
              </span>
            </button>
          </div>

          <!-- Step 1: where -->
          <section class="bstep" :class="{ 'bstep--open': openStep === 'place', 'bstep--done': stepDone.place }">
            <button type="button" class="bstep__head" :aria-expanded="openStep === 'place' ? 'true' : 'false'"
              aria-controls="bstep-place" @click="openStep = 'place'">
              <span class="bstep__num">
                <AssetIcon v-if="stepDone.place && openStep !== 'place'" name="check" :size="13" />
                <template v-else>1</template>
              </span>
              <span class="bstep__titles">
                <span class="bstep__title">{{ appointmentType === 'walkin' ? 'Choose a blood center' : 'Choose a blood drive' }}</span>
                <span v-if="openStep !== 'place' && placeSummary" class="bstep__summary">{{ placeSummary }}</span>
              </span>
              <span v-if="openStep !== 'place' && stepDone.place" class="bstep__change">Change</span>
            </button>

            <div v-show="openStep === 'place'" id="bstep-place" class="bstep__body">
              <!-- Walk-in: centers -->
              <template v-if="appointmentType === 'walkin'">
                <div v-if="centersLoading" class="list-skeleton" aria-busy="true" aria-label="Loading blood centers">
                  <span v-for="n in 3" :key="n" class="slot-skeleton" />
                </div>

                <div v-else-if="centersError" class="drive-state">
                  <p>{{ centersError }}</p>
                  <button type="button" class="btn-outline" @click="fetchBloodCenters">Try again</button>
                </div>

                <div v-else-if="bloodCenters.length" class="choice-list" role="radiogroup" aria-label="Blood centers">
                  <button v-for="center in bloodCenters" :key="center.id" type="button" role="radio" class="choice"
                    :class="{ 'choice--active': selectedCenterId === center.id }"
                    :aria-checked="selectedCenterId === center.id ? 'true' : 'false'" @click="pickCenter(center.id)">
                    <span class="choice__icon"><AssetIcon name="building-2" :size="16" /></span>
                    <span class="choice__body">
                      <span class="choice__name">{{ center.name }}</span>
                      <span class="choice__meta">
                        <span><AssetIcon name="map-pin" :size="12" /> {{ center.location }}</span>
                        <span><AssetIcon name="clock" :size="12" /> {{ center.hours }}</span>
                      </span>
                    </span>
                    <span class="radio" :class="{ 'radio--active': selectedCenterId === center.id }" />
                  </button>
                </div>

                <div v-else class="drive-state">
                  <p>No blood centers available</p>
                  <p class="drive-state__sub">No centers are accepting donations right now. Please check back later.</p>
                </div>
              </template>

              <!-- Mobile: drives -->
              <template v-else>
                <div v-if="drivesLoading" class="list-skeleton" aria-busy="true" aria-label="Loading blood drives">
                  <span v-for="n in 3" :key="n" class="slot-skeleton" />
                </div>

                <div v-else-if="drivesError" class="drive-state">
                  <p>{{ drivesError }}</p>
                  <button type="button" class="btn-outline" @click="fetchBloodDrives">Try again</button>
                </div>

                <div v-else-if="bloodDrives.length" class="choice-list" role="radiogroup" aria-label="Blood drives">
                  <button v-for="drive in bloodDrives" :key="drive.id" type="button" role="radio" class="choice choice--drive"
                    :class="{ 'choice--active': selectedDriveId === drive.id }"
                    :aria-checked="selectedDriveId === drive.id ? 'true' : 'false'"
                    :disabled="driveSlotsLeft(drive) === 0 || driveTooEarly(drive)"
                    @click="pickDrive(drive.id)">
                    <span class="choice__date">
                      <span class="choice__date-month">{{ dateParts(drive.date).month }}</span>
                      <span class="choice__date-day">{{ dateParts(drive.date).day }}</span>
                    </span>
                    <span class="choice__body">
                      <span class="choice__top">
                        <span class="choice__name">{{ drive.name }}</span>
                        <span class="badge" :class="driveStatusClass(drive)">{{ drive.status }}</span>
                      </span>
                      <span class="choice__meta">
                        <span><AssetIcon name="map-pin" :size="12" /> {{ drive.location }}</span>
                      </span>
                      <span class="progress-track">
                        <span class="progress-fill" :class="driveProgressClass(drive)"
                          :style="{ width: driveProgressPct(drive) + '%' }" />
                      </span>
                      <span class="choice__foot">
                        <span>{{ drive.registered }} registered</span>
                        <span>{{ driveSlotsLeft(drive) }} slots left</span>
                      </span>
                      <span v-if="driveTooEarly(drive)" class="drive-card__note">
                        Before your next eligible date ({{ formatDate(nextEligibleDate) }})
                      </span>
                    </span>
                  </button>
                </div>

                <div v-else class="drive-state">
                  <AssetIcon name="truck" :size="32" class="drive-state__icon" />
                  <p>No blood drives posted yet.</p>
                  <p class="drive-state__sub">Check back later once a blood center schedules one near you.</p>
                </div>
              </template>
            </div>
          </section>

          <!-- Step 2 (walk-in only): when -->
          <section v-if="appointmentType === 'walkin'" class="bstep"
            :class="{ 'bstep--open': openStep === 'time', 'bstep--done': stepDone.time, 'bstep--locked': !stepDone.place }">
            <button type="button" class="bstep__head" :disabled="!stepDone.place"
              :aria-expanded="openStep === 'time' ? 'true' : 'false'" aria-controls="bstep-time" @click="openStep = 'time'">
              <span class="bstep__num">
                <AssetIcon v-if="stepDone.time && openStep !== 'time'" name="check" :size="13" />
                <template v-else>2</template>
              </span>
              <span class="bstep__titles">
                <span class="bstep__title">Pick a date and time</span>
                <span v-if="!stepDone.place" class="bstep__summary">Choose a blood center first</span>
                <span v-else-if="openStep !== 'time' && stepDone.time" class="bstep__summary">
                  {{ formattedSelectedDate }} · {{ formatTime(selectedTimeSlot) }}
                </span>
              </span>
              <span v-if="openStep !== 'time' && stepDone.time" class="bstep__change">Change</span>
            </button>

            <div v-show="openStep === 'time'" id="bstep-time" class="bstep__body">
              <div class="date-head">
                <p class="form-label" id="date-chips-label">Date</p>
                <div class="date-other">
                  <label for="other-date">Later date</label>
                  <DatePicker
                    id="other-date"
                    v-model="selectedDate"
                    :min="minBookingDate"
                    size="sm"
                    placeholder="Pick a later date"
                    class="date-other__picker"
                    :class="{ 'date-other__picker--active': !selectedIsChip }"
                  />
                </div>
              </div>
              <!-- Sunod 14 ka adlaw isip chips; ang "Later date" para sa mas layo -->
              <div class="date-chips" role="radiogroup" aria-labelledby="date-chips-label">
                <button
                  v-for="chip in dateChips"
                  :key="chip.value"
                  type="button"
                  role="radio"
                  class="date-chip"
                  :class="{ 'date-chip--active': selectedDate === chip.value }"
                  :aria-checked="selectedDate === chip.value ? 'true' : 'false'"
                  @click="selectedDate = chip.value"
                >
                  <span class="date-chip__dow">{{ chip.weekday }}</span>
                  <span class="date-chip__day">{{ chip.day }}</span>
                  <span class="date-chip__month">{{ chip.month }}</span>
                </button>
              </div>

              <p class="slots-heading">Available times · {{ formattedSelectedDate }}</p>

              <div v-if="slotsLoading" class="slots-grid" aria-busy="true" aria-label="Loading time slots">
                <span v-for="n in 8" :key="n" class="slot-skeleton" />
              </div>

              <div v-else-if="slotsError" class="drive-state">
                <p>{{ slotsError }}</p>
                <button type="button" class="btn-outline" @click="fetchTimeSlots">Try again</button>
              </div>

              <div v-else-if="timeSlots.length" class="slot-groups">
                <div v-for="group in slotGroups" :key="group.label" class="slot-group">
                  <p v-if="slotGroups.length > 1" class="slot-group__label">
                    {{ group.label }}
                  </p>
                  <div class="slots-grid">
                    <button v-for="slot in group.slots" :key="slot.time" type="button" class="slot-btn"
                      :class="{ 'slot-btn--active': selectedTimeSlot === slot.time, 'slot-btn--full': slot.available === 0 }"
                      :disabled="slot.available === 0" :aria-pressed="selectedTimeSlot === slot.time ? 'true' : 'false'"
                      @click="selectedTimeSlot = slot.time">
                      <span class="slot-btn__time">{{ formatTime(slot.time) }}</span>
                      <span class="slot-btn__avail">{{ slot.available === 0 ? 'Full' : `${slot.available} left` }}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div v-else class="drive-state drive-state--flat">
                <AssetIcon name="calendar" :size="28" class="drive-state__icon" />
                <p>No time slots set for this date.</p>
                <p class="drive-state__sub">This blood center hasn't opened slots for {{ formattedSelectedDate }} yet. Try another date.</p>
              </div>
            </div>
          </section>
        </div>

        <!-- The ticket: what the donor has picked so far, and Confirm -->
        <aside class="ticket" :class="{ 'ticket--ready': canContinue }" aria-label="Your booking">
          <div class="ticket__head">
            <p class="ticket__eyebrow">{{ reschedulingId ? 'New slot' : 'Your booking' }}</p>
            <p class="ticket__type">
              <AssetIcon :name="appointmentType === 'walkin' ? 'building-2' : 'truck'" :size="14" />
              {{ appointmentType === 'walkin' ? 'Walk-in' : 'Mobile blood drive' }}
            </p>
          </div>

          <dl class="ticket__rows" aria-live="polite">
            <div class="ticket__row">
              <dt>Where</dt>
              <dd v-if="locationLabel !== '-'">
                {{ locationLabel }}
                <span class="ticket__sub">{{ appointmentType === 'walkin' ? selectedCenter?.location : selectedDrive?.location }}</span>
              </dd>
              <dd v-else class="ticket__empty">Not chosen yet</dd>
            </div>
            <div class="ticket__row ticket__row--pair">
              <div>
                <dt>Date</dt>
                <dd v-if="appointmentType === 'walkin' || selectedDrive">{{ summaryDateLabel }}</dd>
                <dd v-else class="ticket__empty">-</dd>
              </div>
              <div v-if="appointmentType === 'walkin'">
                <dt>Time</dt>
                <dd v-if="selectedTimeSlot">{{ formatTime(selectedTimeSlot) }}</dd>
                <dd v-else class="ticket__empty">-</dd>
              </div>
            </div>
          </dl>

          <div class="ticket__tear" aria-hidden="true" />

          <div class="ticket__tips">
            <p class="ticket__tips-title">Before you go</p>
            <ul>
              <li><AssetIcon name="id-card" :size="14" /> Bring a valid ID</li>
              <li><AssetIcon name="moon" :size="14" /> Get a good night's sleep</li>
              <li><AssetIcon name="droplets" :size="14" /> Drink plenty of water</li>
              <li><AssetIcon name="clipboard-check" :size="14" /> Answer the health questionnaire the day before</li>
            </ul>
          </div>

          <div class="ticket__foot">
            <p class="ticket__hint" aria-live="polite">
              <template v-if="canContinue">
                <span class="ticket__hint-text ticket__hint-text--full">{{ selectionSummary }}</span>
                <span class="ticket__hint-text ticket__hint-text--short">{{ shortSummary }}</span>
              </template>
              <template v-else>{{ selectionHint }}</template>
            </p>
            <button type="button" class="btn-primary ticket__btn" :disabled="!canContinue" @click="openSummary">
              {{ reschedulingId ? 'Review new slot' : 'Review booking' }}
              <AssetIcon name="arrow-right" :size="15" />
            </button>
          </div>
        </aside>
      </div>
      </template>
    </div>

    <!-- Booking summary modal -->
    <div v-if="showSummary" class="modal-overlay" @click.self="closeSummary">
      <div class="modal-card modal-card--summary" role="dialog" aria-modal="true" aria-labelledby="summary-title"
        v-focus-trap @dialog-escape="closeSummary">
        <div class="summary-head">
          <div>
            <h3 id="summary-title" class="modal-title summary-head__title">
              {{ reschedulingId ? 'Review your new slot' : 'Review your booking' }}
            </h3>
            <p class="summary-head__sub">Check the details before you confirm.</p>
          </div>
          <button type="button" class="summary-close" aria-label="Close" :disabled="confirming" @click="closeSummary">
            <AssetIcon name="x" :size="18" />
          </button>
        </div>

        <dl class="summary-card">
          <div class="summary-item">
            <dt><AssetIcon :name="appointmentType === 'walkin' ? 'building-2' : 'truck'" :size="15" /> Location</dt>
            <dd>
              {{ locationLabel }}
              <span class="summary-item__sub">{{ typeLabel }}</span>
            </dd>
          </div>
          <div class="summary-item">
            <dt><AssetIcon name="calendar" :size="15" /> Date</dt>
            <dd>{{ summaryDateLabel }}</dd>
          </div>
          <div v-if="appointmentType === 'walkin'" class="summary-item">
            <dt><AssetIcon name="clock" :size="15" /> Time</dt>
            <dd>{{ formatTime(selectedTimeSlot) }}</dd>
          </div>
        </dl>

        <!--
          Ang error kay naay kaugalingong sunod nga lakang. Ang mga dili na
          molampos kung i-retry (duplicate, interval, ...) kay dili na
          magpakita og Confirm nga button.
        -->
        <div v-if="confirmError" class="confirm-error" role="alert">
          <AssetIcon name="circle-alert" :size="16" class="confirm-error__icon" />
          <span>{{ confirmError }}</span>
        </div>

        <div class="summary-actions">
          <template v-if="confirmErrorCode === 'duplicate_appointment'">
            <button type="button" class="btn-outline" @click="closeSummary">Close</button>
            <button type="button" class="btn-primary" @click="goToMyAppointment">View my appointment</button>
          </template>
          <template v-else-if="confirmErrorCode === 'slot_unavailable' || confirmErrorCode === 'drive_full'">
            <button type="button" class="btn-outline" @click="closeSummary">Close</button>
            <button type="button" class="btn-primary" @click="chooseAnother">
              {{ confirmErrorCode === 'drive_full' ? 'Choose another drive' : 'Choose another time' }}
            </button>
          </template>
          <template v-else-if="confirmBlocked">
            <button type="button" class="btn-primary" @click="closeSummary">Close</button>
          </template>
          <template v-else>
            <button type="button" class="btn-outline" :disabled="confirming" @click="closeSummary">Back</button>
            <button type="button" class="btn-primary" :disabled="confirming" @click="handleConfirm">
              <span>{{ confirming ? 'Confirming...' : (reschedulingId ? 'Confirm new slot' : 'Confirm booking') }}</span>
              <AssetIcon v-if="!confirming" name="arrow-right" :size="16" />
            </button>
          </template>
        </div>

        <p class="modal-note">You can cancel or reschedule any time before your appointment.</p>
      </div>
    </div>

    <!-- Cancel dialog (imbes window.confirm) -->
    <div v-if="cancelTarget" class="modal-overlay" @click.self="closeCancelDialog">
      <div class="modal-card" role="alertdialog" aria-modal="true" aria-labelledby="cancel-title"
        aria-describedby="cancel-desc" v-focus-trap @dialog-escape="closeCancelDialog">
        <h3 id="cancel-title" class="modal-title">Cancel this appointment?</h3>
        <p id="cancel-desc" class="cancel-desc">
          {{ cancelTarget.drive_name || cancelTarget.facility_name || 'Blood center' }},
          {{ formatDate(cancelTarget.date) }} at {{ formatTime(cancelTarget.time) }}.
          You will need to book again if you change your mind.
        </p>
        <p v-if="appointmentActionError" class="confirm-error">{{ appointmentActionError }}</p>
        <div class="confirm-actions">
          <button type="button" class="btn-outline" :disabled="appointmentActionId !== null" @click="closeCancelDialog">
            Keep it
          </button>
          <button type="button" class="btn-danger" :disabled="appointmentActionId !== null" @click="confirmCancel">
            {{ appointmentActionId !== null ? 'Cancelling...' : 'Cancel appointment' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Confirmation modal -->
    <div v-if="showConfirmation" class="modal-overlay">
      <div class="modal-card modal-card--confirm" role="dialog" aria-modal="true" aria-labelledby="confirm-title"
        v-focus-trap @dialog-escape="showConfirmation = false">
        <div class="confirm-icon">
          <AssetIcon name="check" :size="22" class="confirm-icon__svg" />
        </div>
        <h3 id="confirm-title" class="modal-title modal-title--center">{{ wasRescheduled ? "Appointment Updated!" : "Appointment Confirmed!" }}</h3>
        <p class="modal-sub">
          {{ wasRescheduled ? "Your appointment has been updated." : "Your appointment has been booked, and the details are on their way to your email." }}
          {{ bookedScreening.hint }}
        </p>
        <div class="summary-list">
          <div class="summary-row"><span>Location</span><span>{{ bookedLocationLabel }}</span></div>
          <div class="summary-row"><span>Date &amp; Time</span><span>{{ bookedDateTimeLabel }}</span></div>
          <div class="summary-row">
            <span>Health questionnaire</span>
            <span :class="`summary-value--${bookedScreening.tone}`">{{ bookedScreening.label }}</span>
          </div>
        </div>
        <div class="confirm-actions">
          <button v-if="bookedScreening.cta" type="button" class="btn-outline" @click="goEligibility">
            {{ bookedScreening.cta }}
          </button>
          <button v-else type="button" class="btn-outline" @click="viewQr">View QR Code</button>
          <button type="button" class="btn-primary" @click="goDashboard">Go to Dashboard</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({
  middleware: 'auth',
  layout: 'donordashboard',
  keepalive: true,
})

import AssetIcon from '~/components/common/AssetIcon.vue'
import DatePicker from '~/components/common/DatePicker.vue'
import { bookingCatalogService } from '~/api/booking-catalog/BookingCatalogService'
import { donorService } from '~/api/donor/DonorService'


const router = useRouter()

// Page-level loading state: shows the skeleton on first mount while we
// fetch whatever's needed before the form is interactive.
const loading = ref(true)

const appointmentType = ref('walkin')
const selectedCenterId = ref(null)
const selectedDriveId = ref(null)
// Ang date input kailangan og YYYY-MM-DD base sa LOCAL na oras. Dili
// pwde ang toISOString() — UTC man to, so sa UTC+8 mag-off og isa ka
// adlaw kung sayo pa sa buntag.
function toDateInputValue(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const todayValue = toDateInputValue(new Date())
const selectedDate = ref(todayValue)

const selectedTimeSlot = ref(null)

const showSummary = ref(false)
const showConfirmation = ref(false)
const confirming = ref(false)
const confirmError = ref('')
// Ang `code` sa napakyas nga booking, para mapili ang sunod nga lakang sa modal.
const confirmErrorCode = ref('')
const bookedAppointment = ref(null)
const reschedulingId = ref(null)
const wasRescheduled = ref(false)
const appointmentActionId = ref(null)
const appointmentActionError = ref('')

// Walay oras ang mobile drives sa database — date-only ang event_date. Pero
// required ang time_slot para sa duha ka type, so gamiton ni: mao ra gyud sad
// ang default sa server sa resolveSlot().
const MOBILE_DRIVE_TIME = '09:00'


// Which step card is open. Only one at a time; the others show a summary.
const openStep = ref('place')

// Open the first step that still needs an answer for the current type.
function openFirstPending() {
  if (appointmentType.value === 'walkin') openStep.value = selectedCenterId.value ? 'time' : 'place'
  else openStep.value = selectedDriveId.value ? null : 'place'
}

function selectType(type) {
  appointmentType.value = type
  selectedTimeSlot.value = null
  openFirstPending()
}

// Picking a place moves the donor straight on to the next step.
function pickCenter(id) {
  selectedCenterId.value = id
  openStep.value = 'time'
}

function pickDrive(id) {
  selectedDriveId.value = id
  openStep.value = null
}


const bloodCenters = ref([])
const centersLoading = ref(false)
const centersError = ref('')

async function fetchBloodCenters() {
  centersLoading.value = true
  centersError.value = ''
  try {
    // GET /api/blood-centers
    // Response: [{ id, name, location, hours, status }]
    // Ang server mo-filter na sa accepting-donations nga centers, so ang
    // status kanunay "Open today".
    const data = await bookingCatalogService.bloodCenters()
    bloodCenters.value = data ?? []
  } catch (err) {
    console.error('Failed to load blood centers:', err)
    centersError.value = 'Could not load blood centers. Please try again.'
    bloodCenters.value = []
  } finally {
    centersLoading.value = false
  }
}


// Backend contract: GET /api/time-slots?center_id=&date=
// The blood center configures its own slot schedule and capacity per day
// donors only ever see whatever the center has actually set for that date.
// Response fields: [{ time, available, total }]
const timeSlots = ref([])
const slotsLoading = ref(false)
const slotsError = ref('')

async function fetchTimeSlots() {
  if (!selectedCenterId.value || !selectedDate.value) {
    timeSlots.value = []
    return
  }
  slotsLoading.value = true
  slotsError.value = ''
  try {
    // GET /api/time-slots?center_id=&date=
    // Response: [{ time, available, total }]. Ang `available` kay slot_capacity
    // sa center minus ang na-book na; ang mga past nga oras kay 0 dayon, ang
    // server na ang mo-compute — dili ni angay sundogon sa client.
    const data = await bookingCatalogService.timeSlots({
      center_id: selectedCenterId.value,
      date: selectedDate.value,
    })
    timeSlots.value = data ?? []
  } catch (err) {
    console.error('Failed to load time slots:', err)
    slotsError.value = err?.message || 'Could not load time slots. Please try again.'
    timeSlots.value = []

  } finally {
    slotsLoading.value = false
  }
}

// Refetch whenever the donor is on the walk-in flow and changes center or date;
// also reset the picked slot since it may no longer apply.
watch([selectedCenterId, selectedDate], () => {
  selectedTimeSlot.value = null
  if (appointmentType.value === 'walkin') fetchTimeSlots()
})

watch(appointmentType, (type) => {
  if (type === 'walkin') fetchTimeSlots()
})

// Gi-keepalive ni nga page, so dili ma-unmount ang component kung mo-navigate
// ang donor palayo — mabuhi ang state ug ang gi-fill na nga form. Ang bayad
// ana kay mahimong stale ang data, maong mo-refresh ta sa background matag
// balik: walay skeleton, kay naa na may sulod nga makita.
//
// Mo-fire sad ang onActivated dayon human sa unang onMounted, maong gi-guard
// ni sa loadedOnce aron dili doble ang unang fetch.
let loadedOnce = false

async function load({ silent = false } = {}) {
  if (!silent) loading.value = true
  try {
    await Promise.allSettled([fetchBloodCenters(), fetchAppointments(), fetchNextEligible()])
    if (appointmentType.value === 'walkin') {
      await fetchTimeSlots().catch(err => console.error(err))
    }
    loadedOnce = true
  } catch (err) {
    console.error('Unexpected error during load:', err)
  } finally {
    loading.value = false
  }
}

onMounted(() => load())
onActivated(() => {
  if (loadedOnce) load({ silent: true })
})


// Ang mo-return ra kay ang mga drive nga gi-post gyud sa blood center, ug
// upcoming pa (event_date >= today), na-order by date.
// Response: [{ id, name, location, date, registered, total_slots, status }]
// status: 'Full' | 'Open' | 'Upcoming' — capitalized, ug walay 'closed'.
// Walay `time` field: ang event_date kay date-only sa database.
const bloodDrives = ref([])
const drivesLoading = ref(false)
const drivesError = ref('')

async function fetchBloodDrives() {
  drivesLoading.value = true
  drivesError.value = ''
  try {
    // GET /api/blood-drives
    // Ang `registered` kay live count sa active nga appointments.
    const data = await bookingCatalogService.bloodDrives()
    bloodDrives.value = data ?? []
  } catch (err) {
    console.error('Failed to load blood drives:', err)
    drivesError.value = err?.message || 'Could not load blood drives. Please try again.'
    bloodDrives.value = []
  } finally {
    drivesLoading.value = false
  }
}


function driveSlotsLeft(drive) {
  return Math.max((drive.total_slots ?? 0) - (drive.registered ?? 0), 0)
}

function driveProgressPct(drive) {
  if (!drive.total_slots) return 0
  return Math.round(((drive.registered ?? 0) / drive.total_slots) * 100)
}

// Ang server na ang mo-compute sa status ('Full' | 'Open' | 'Upcoming'), so
// mapping ra ni sa CSS class. Ang pag-recompute diri kay mao gyud ang hinungdan
// nga nag-drift ang duha ka logic — capitalized diay ang gipadala sa server.
const DRIVE_STATUS_CLASS = {
  Full: 'badge--full',
  Upcoming: 'badge--info',
  Open: 'badge--success',
}

const DRIVE_PROGRESS_CLASS = {
  Full: 'progress-fill--full',
  Upcoming: 'progress-fill--blue',
  Open: 'progress-fill--green',
}

function driveStatusClass(drive) {
  return DRIVE_STATUS_CLASS[drive.status] || 'badge--info'
}

function driveProgressClass(drive) {
  return DRIVE_PROGRESS_CLASS[drive.status] || 'progress-fill--blue'
}

// Fetch drives as soon as the donor switches to the "mobile drive" flow,
let drivesFetched = false
watch(appointmentType, (type) => {
  if (type === 'mobile' && !drivesFetched) {
    drivesFetched = true
    fetchBloodDrives()
  }
})

// "13:30" (H:i gikan sa server) -> "1:30 PM". Display ra; ang payload kay H:i gihapon.
function formatTime(value) {
  if (!value) return '-'
  const [h, m] = String(value).split(':').map(Number)
  if (Number.isNaN(h)) return value
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:${String(m || 0).padStart(2, '0')} ${suffix}`
}

function formatDate(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const myAppointments = ref([])
const appointmentsLoading = ref(false)
const appointmentsError = ref('')

const ACTIVE_APPOINTMENT_STATUSES = ['scheduled', 'confirmed']

// Gikan sa GET /api/donors/eligibility. Ang server mo-reject sa slot nga una
// niini (below_min_interval), so gamiton ra sa client para dili na ipili.
const nextEligibleDate = ref(null)

async function fetchNextEligible() {
  try {
    const status = await donorService.eligibilityStatus()
    nextEligibleDate.value = status?.next_eligible_date ?? null
  } catch (err) {
    // Informational ra: kung mapakyas, ang server gihapon ang mo-guard.
    console.error('Failed to load eligibility status:', err)
  }
}

const eligibleLater = computed(() => !!nextEligibleDate.value && nextEligibleDate.value > todayValue)

const minBookingDate = computed(() => (eligibleLater.value ? nextEligibleDate.value : todayValue))

// Kung ang pinili nga petsa kay una sa min (e.g. bag-o lang na-load ang
// eligibility), i-abante ngadto sa min.
watch(minBookingDate, (min) => {
  if (selectedDate.value < min) selectedDate.value = min
})

function driveTooEarly(drive) {
  return eligibleLater.value && String(drive.date ?? '').slice(0, 10) < nextEligibleDate.value
}

const APPOINTMENT_STATUS_CLASS = {
  scheduled: 'badge--info',
  confirmed: 'badge--success',
}

function appointmentStatusClass(status) {
  return APPOINTMENT_STATUS_CLASS[status] || 'badge--info'
}

async function fetchAppointments() {
  appointmentsLoading.value = true
  appointmentsError.value = ''
  try {
    // GET /api/donors/appointments
    // Response: [{ id, appointment_datetime, date, time, status, appointment_type,
    //              facility_name, drive_name, can_cancel }]
    // Tanan appointment ang mo-return — bisan cancelled ug completed — newest
    // first. Walay filter param, so client na ang mo-pili.
    const data = await donorService.appointments()
    myAppointments.value = data ?? []
  } catch (err) {
    console.error('Failed to load appointments:', err)
    appointmentsError.value = err?.message || 'Could not load your appointments. Please try again.'
    myAppointments.value = []
  } finally {
    appointmentsLoading.value = false
  }
}

// Booking page ni, so ang aktibo ug umaabot ra ang gipakita — ang past ug
// cancelled kay para sa history, dili diri. Soonest first, dili newest.
const activeAppointments = computed(() =>
  myAppointments.value
    .filter(appointment =>
      ACTIVE_APPOINTMENT_STATUSES.includes(appointment.status)
      && new Date(appointment.appointment_datetime) >= new Date()
    )
    .sort((a, b) => new Date(a.appointment_datetime) - new Date(b.appointment_datetime))
)


const formattedSelectedDate = computed(() => formatDate(selectedDate.value))

// Sunod 14 ka adlaw gikan sa unang ma-book nga petsa. Local time, dili UTC.
const DATE_CHIP_COUNT = 14
const dateChips = computed(() => {
  const [y, m, d] = minBookingDate.value.split('-').map(Number)
  const start = new Date(y, m - 1, d)
  return Array.from({ length: DATE_CHIP_COUNT }, (_, i) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    const value = toDateInputValue(date)
    return {
      value,
      weekday: value === todayValue ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short' }),
      day: date.getDate(),
      month: date.toLocaleDateString('en-US', { month: 'short' }),
    }
  })
})

const selectedIsChip = computed(() => dateChips.value.some(chip => chip.value === selectedDate.value))

// Morning (una sa 12:00) ug Afternoon. Ang `time` kay H:i gikan sa server.
const slotGroups = computed(() => {
  const morning = timeSlots.value.filter(slot => Number(String(slot.time).split(':')[0]) < 12)
  const afternoon = timeSlots.value.filter(slot => Number(String(slot.time).split(':')[0]) >= 12)
  return [
    { label: 'Morning', slots: morning },
    { label: 'Afternoon', slots: afternoon },
  ].filter(group => group.slots.length)
})

// Usa ra ka upcoming appointment matag donor (duplicate_appointment sa server).
// Kung na-load ang lista ug naa nay usa, ang wizard kay para ra sa reschedule.
// Kung napakyas ang pag-load, ipakita gihapon ang wizard: ang server gihapon
// ang mo-guard.
const showBookingWizard = computed(() =>
  reschedulingId.value !== null
  || !!appointmentsError.value
  || activeAppointments.value.length === 0
)

const selectedDrive = computed(() => bloodDrives.value.find(d => d.id === selectedDriveId.value) || null)
const selectedCenter = computed(() => bloodCenters.value.find(c => c.id === selectedCenterId.value) || null)

// Which steps are complete, for the check marks on the step numbers.
const stepDone = computed(() => ({
  type: !!appointmentType.value,
  place: appointmentType.value === 'mobile' ? !!selectedDriveId.value : !!selectedCenterId.value,
  time: !!(selectedDate.value && selectedTimeSlot.value),
}))

const canContinue = computed(() => {
  if (appointmentType.value === 'walkin') {
    return !!(selectedCenterId.value && selectedDate.value && selectedTimeSlot.value)
  }
  if (appointmentType.value === 'mobile') {
    return !!selectedDriveId.value
  }
  return false
})

// Para sa sticky bar: unsa na ang napili, o unsa pa ang kulang.
const selectionSummary = computed(() => {
  if (appointmentType.value === 'walkin') {
    if (!selectedCenter.value) return ''
    const parts = [selectedCenter.value.name, formattedSelectedDate.value]
    if (selectedTimeSlot.value) parts.push(formatTime(selectedTimeSlot.value))
    return parts.join(' · ')
  }
  if (!selectedDrive.value) return ''
  return `${selectedDrive.value.name} · ${formatDate(selectedDrive.value.date)}`
})

// Shown on the collapsed "where" step.
const placeSummary = computed(() =>
  appointmentType.value === 'walkin'
    ? selectedCenter.value?.name || ''
    : selectedDrive.value ? `${selectedDrive.value.name} · ${formatDate(selectedDrive.value.date)}` : ''
)

// "2026-10-18" -> { weekday: 'Sun', month: 'Oct', day: 18, year: 2026 } for
// the date tiles. Parsed as local time, not UTC.
function dateParts(value) {
  const [y, m, d] = String(value ?? '').slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return { weekday: '', month: '-', day: '', year: '' }
  const date = new Date(y, m - 1, d)
  return {
    weekday: date.toLocaleDateString('en-US', { weekday: 'short' }),
    month: date.toLocaleDateString('en-US', { month: 'short' }),
    day: d,
    year: y,
  }
}

// The bar on narrow phones has room for the when, not the where.
const shortSummary = computed(() =>
  appointmentType.value === 'walkin'
    ? `${dateParts(selectedDate.value).month} ${dateParts(selectedDate.value).day} · ${formatTime(selectedTimeSlot.value)}`
    : `${dateParts(selectedDrive.value?.date).month} ${dateParts(selectedDrive.value?.date).day}`
)

// What is still missing, one thing at a time (short enough for the mobile bar).
const selectionHint = computed(() => {
  if (appointmentType.value === 'mobile') return 'Choose a blood drive.'
  return selectedCenterId.value ? 'Pick a time slot.' : 'Choose a blood center.'
})

const typeLabel = computed(() => appointmentType.value === 'walkin' ? 'Walk-in at blood center' : 'Register for mobile drive')

const locationLabel = computed(() => {
  if (appointmentType.value === 'walkin') return selectedCenter.value?.name || '-'
  return selectedDrive.value?.name || '-'
})

const summaryDateLabel = computed(() => {
  if (appointmentType.value === 'walkin') return formattedSelectedDate.value
  return formatDate(selectedDrive.value?.date)
})

const confirmDateTimeLabel = computed(() => {
  if (appointmentType.value === 'walkin') return `${formattedSelectedDate.value} - ${formatTime(selectedTimeSlot.value)}`
  // Walay oras ang mobile drives — date ra ang naa sa event_date, so ang
  // dangling "- —" gikuha na.
  return formatDate(selectedDrive.value?.date)
})

// Ang gipakita sa confirmation modal kay gikan sa 201 response, dili sa local
// nga pinili — para sa mobile, ang server na ang mo-resolve sa oras.
const bookedLocationLabel = computed(() =>
  bookedAppointment.value?.drive_name
    || bookedAppointment.value?.facility_name
    || locationLabel.value
)

const bookedDateTimeLabel = computed(() => {
  const booked = bookedAppointment.value
  if (!booked) return confirmDateTimeLabel.value
  return `${formatDate(booked.date)} - ${formatTime(booked.time)}`
})

// Ang tinuod nga kahimtang sa questionnaire para sa bag-ong booking, gikan sa
// 201 response. Kaniadto hardcoded og "QR code: Valid", bisan ang booking kay
// dili na manginahanglan og questionnaire, so ang bag-ong donor walay QR pa.
const bookedScreening = computed(() => {
  const booked = bookedAppointment.value
  switch (booked?.screening_status) {
    case 'answered':
      return { label: 'Done', tone: 'success', hint: 'Bring your QR code when you arrive.', cta: null }
    case 'due':
    case 'missed':
      return {
        label: 'Due now',
        tone: 'warning',
        hint: 'Answer your health questionnaire now so your visit starts with a scan.',
        cta: 'Answer questionnaire',
      }
    case 'not_due':
      return {
        label: `Opens ${formatDate(booked.screening_window_opens_on)}`,
        tone: 'muted',
        hint: "You'll answer a short health questionnaire the day before. We'll email you a reminder.",
        cta: null,
      }
    default:
      return { label: '-', tone: 'muted', hint: '', cta: null }
  }
})


/**
 * What to tell the donor about the questionnaire for one booking.
 *
 * Returns null when there is nothing to say -- an answered questionnaire needs
 * no banner, and neither does a booking that no longer holds its slot.
 */
function screeningNotice(appointment) {
  switch (appointment.screening_status) {
    case 'not_due':
      return {
        tone: 'info',
        text: `Your health questionnaire opens on ${formatDate(appointment.screening_window_opens_on)}, the day before this appointment. We'll email you a reminder.`,
        cta: null,
      }
    case 'due':
      return {
        tone: 'warn',
        text: 'Your health questionnaire is open. Complete it now so your visit starts with a scan rather than a form.',
        cta: 'Answer it now',
      }
    case 'missed':
      return {
        tone: 'warn',
        text: 'You have not completed your health questionnaire. You can still fill it in at the centre, but doing it now will be quicker.',
        cta: 'Answer it now',
      }
    default:
      // 'answered', or a booking that is no longer active.
      return null
  }
}

function bookingErrorMessage(err) {
  const code = err?.data?.code

  switch (code) {
    case 'email_unverified':
      return 'Please verify your email address before booking an appointment.'
    // No screening code here any more: booking does not require a
    // questionnaire. The donor answers it the day before, and
    // ScreeningWindowOpen reminds them when it falls due.
    case 'below_min_interval':
      return err?.data?.next_eligible_date
        ? `You cannot donate again until ${formatDate(err.data.next_eligible_date)}.`
        : err?.message
    case 'duplicate_appointment':
      return 'You already have an upcoming appointment. Cancel or reschedule it first.'
    case 'slot_unavailable':
      return 'That time slot has just been taken. Please choose another.'
    case 'drive_full':
      return 'This blood drive is fully booked. Please choose another.'
    case 'appointment_not_active':
      return 'This appointment can no longer be changed.'
    case 'cancellation_window_passed':
      return err?.message || 'This appointment is too close to its start time to change.'
    default:
      return err?.message || 'Could not confirm your appointment. Please try again.'
  }
}

// Mga error nga dili molampos bisan i-retry ang parehas nga pinili.
const BLOCKING_BOOKING_CODES = ['duplicate_appointment', 'below_min_interval', 'appointment_not_active', 'email_unverified', 'cancellation_window_passed']
const confirmBlocked = computed(() => BLOCKING_BOOKING_CODES.includes(confirmErrorCode.value))

async function handleConfirm() {
  confirming.value = true
  confirmError.value = ''
  confirmErrorCode.value = ''

  try {
    // POST /api/donors/appointments
    // Body: { type, center_id?, drive_id?, date?, time_slot }
    // Response 201: { id, appointment_datetime, date, time, status,
    //                 appointment_type, facility_name, drive_name, can_cancel }
    const payload = {
      type: appointmentType.value,
      time_slot: appointmentType.value === 'walkin' ? selectedTimeSlot.value : MOBILE_DRIVE_TIME,
    }

    if (appointmentType.value === 'walkin') {
      payload.center_id = selectedCenterId.value
      payload.date = selectedDate.value
    } else {
      payload.drive_id = selectedDriveId.value
    }

    // Parehas ra ang payload sa book ug sa reschedule — parehas sila og
    // StoreAppointmentRequest sa server.
    bookedAppointment.value = reschedulingId.value
      ? await donorService.rescheduleAppointment(reschedulingId.value, payload)
      : await donorService.bookAppointment(payload)

    // I-refresh aron makita dayon ang bag-ong appointment sa listahan sa luyo.
    await fetchAppointments()

    // Sulod ra sa success path — dili na sama sa una nga mo-show ang confirmation
    // bisan na-reject ang booking.
    wasRescheduled.value = reschedulingId.value !== null
    reschedulingId.value = null
    showSummary.value = false
    showConfirmation.value = true

  } catch (err) {
    console.error('Failed to confirm appointment:', err)
    confirmError.value = bookingErrorMessage(err)
    confirmErrorCode.value = err?.data?.code || ''

    // Stale ang page (e.g. na-book sa laing tab): i-refresh ang lista aron
    // makita na ang appointment ug matago ang wizard.
    if (confirmErrorCode.value === 'duplicate_appointment') {
      fetchAppointments()
    }
  } finally {
    confirming.value = false
  }
}

function closeSummary() {
  if (confirming.value) return
  showSummary.value = false
}

function goToMyAppointment() {
  showSummary.value = false
  if (import.meta.client) window.scrollTo({ top: 0, behavior: 'smooth' })
}

// Nakuha na sa uban ang slot o napuno ang drive: kuhaa ang bag-ong lista ug
// papilia pag-usab.
function chooseAnother() {
  showSummary.value = false
  if (appointmentType.value === 'walkin') {
    selectedTimeSlot.value = null
    openStep.value = 'time'
    fetchTimeSlots()
  } else {
    selectedDriveId.value = null
    openStep.value = 'place'
    fetchBloodDrives()
  }
}

function openSummary() {
  confirmError.value = ''
  confirmErrorCode.value = ''
  showSummary.value = true
}

function startReschedule(appointment) {
  appointmentActionError.value = ''
  reschedulingId.value = appointment.id

  // I-preset ang wizard sa type sa existing nga appointment aron dili magsugod
  // ang donor og blangko.
  appointmentType.value = appointment.appointment_type === 'mobile' ? 'mobile' : 'walkin'
  selectedTimeSlot.value = null
  openFirstPending()

  if (import.meta.client) {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

function cancelReschedule() {
  reschedulingId.value = null
  confirmError.value = ''
}

// Ang appointment nga gipangutana sa cancel dialog.
const cancelTarget = ref(null)

function handleCancel(appointment) {
  appointmentActionError.value = ''
  cancelTarget.value = appointment
}

function closeCancelDialog() {
  if (appointmentActionId.value !== null) return
  cancelTarget.value = null
}

async function confirmCancel() {
  const appointment = cancelTarget.value
  if (!appointment) return

  appointmentActionId.value = appointment.id
  appointmentActionError.value = ''

  try {
    // DELETE /api/donors/appointments/{id}
    // Dili ni mo-delete sa row — mo-set ra og status = 'cancelled', ug mo-return
    // sa updated nga appointment.
    await donorService.cancelAppointment(appointment.id)

    // Kung gi-reschedule pa diay ni, i-undo ang mode.
    if (reschedulingId.value === appointment.id) {
      reschedulingId.value = null
    }

    await fetchAppointments()
    cancelTarget.value = null
  } catch (err) {
    console.error('Failed to cancel appointment:', err)
    appointmentActionError.value = bookingErrorMessage(err)
  } finally {
    appointmentActionId.value = null
  }
}

function goEligibility() {
  router.push('/donor/eligibility')
}

function viewQr() {
  router.push('/donor/qrcode')
}

function goDashboard() {
  router.push('/donor/dashboard')
}
</script>

<style scoped>
.appointment-page {
  --primary: var(--rb-primary);
  --primary-dark: var(--rb-primary-hover);
  --accent: #d32f2f;
  --success: #2e7d32;
  --warning: #f57c00;
  --text-primary: #1f2937;
  --text-secondary: #9ca3af;
  --border: #eef0f3;
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px 32px 60px;
  background: var(--rb-page-bg);
  transition: background-color 0.2s ease;
}

.confirm-error {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0 0 16px;
  padding: 12px 14px;
  border-radius: 10px;
  background: #FEF3F2;
  border: 1px solid #FECDCA;
  font-size: var(--rb-fs-small);
  font-weight: 500;
  line-height: 1.5;
  color: #7A271A;
}

.confirm-error__icon {
  flex: none;
  margin-top: 1px;
  color: #B42318;
}

/* Booking summary modal */
.modal-card.modal-card--summary {
  max-width: 440px;
  padding: 22px 22px 18px;
  gap: 0;
}

.summary-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.summary-head .summary-head__title {
  margin: 0;
}

.summary-head__sub {
  margin: 2px 0 0;
  font-size: var(--rb-fs-small);
  color: var(--text-secondary);
}

.summary-close {
  display: inline-flex;
  flex: none;
  width: 34px;
  height: 34px;
  align-items: center;
  justify-content: center;
  margin: -6px -8px 0 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.summary-close:hover:not(:disabled) {
  background: #f3f4f6;
  color: var(--text-primary);
}

.summary-close:focus-visible {
  outline: 2px solid var(--rb-primary);
  outline-offset: 2px;
}

.summary-card {
  display: flex;
  flex-direction: column;
  margin: 0 0 16px;
  padding: 4px 16px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: #f8fafc;
}

.summary-item {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr);
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
}

.summary-item:last-child {
  border-bottom: none;
}

.summary-item dt {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--rb-fs-small);
  color: var(--text-secondary);
}

.summary-item dd {
  margin: 0;
  font-size: var(--rb-fs-body);
  font-weight: 700;
  line-height: 1.4;
  color: var(--text-primary);
  text-align: right;
}

.summary-item__sub {
  display: block;
  margin-top: 2px;
  font-size: var(--rb-fs-caption);
  font-weight: 500;
  color: var(--text-secondary);
}

.summary-actions {
  display: flex;
  gap: 10px;
}

.summary-actions .btn-outline,
.summary-actions .btn-primary {
  flex: 1;
  padding: 12px 14px;
  white-space: nowrap;
}

.summary-actions .btn-outline {
  flex: 0 0 auto;
  min-width: 96px;
}

.summary-actions .btn-primary:only-child {
  flex: 1;
}

.my-appointment-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-width: 820px;
}

/* Upcoming appointment: a white card led by a date tile. The ticket look is
   kept for the booking summary only, so it stays special there. */
.appt-ticket {
  display: flex;
  gap: 18px;
  padding: 18px;
  border: 1px solid var(--border);
  border-radius: 20px;
  background: white;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.appt-ticket--rescheduling {
  border-color: var(--rb-primary);
  box-shadow: 0 0 0 3px rgba(var(--rb-primary-rgb), 0.12);
}

.appt-ticket__stub {
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: center;
  align-self: flex-start;
  gap: 1px;
  width: 92px;
  padding: 12px 8px;
  border-radius: 16px;
  background: rgba(var(--rb-primary-rgb), 0.08);
  color: var(--rb-primary-text);
  text-align: center;
}

.appt-ticket__dow,
.appt-ticket__month {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.appt-ticket__day {
  font-family: var(--rb-font-sans);
  font-size: 30px;
  font-weight: 800;
  line-height: 1.05;
}

.appt-ticket__time {
  margin-top: 6px;
  padding: 3px 8px;
  border-radius: 999px;
  background: white;
  font-size: var(--rb-fs-caption);
  font-weight: 700;
}

.appt-ticket__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.appt-ticket__flag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: var(--rb-fs-caption);
  font-weight: 700;
  color: var(--rb-primary-text);
}

.appt-ticket__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.appt-ticket__name {
  margin: 0;
  font-family: var(--rb-font-sans);
  font-size: var(--rb-fs-section);
  font-weight: 700;
  line-height: 1.35;
  color: var(--text-primary);
}

.appt-ticket__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  margin: 0;
  font-size: var(--rb-fs-small);
  color: var(--text-secondary);
}

.appt-ticket__meta > span { display: inline-flex; align-items: center; gap: 6px; }

.appt-ticket .screening-notice { margin-top: 2px; border-radius: 12px; }

.appt-ticket__foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px 16px;
  margin-top: 4px;
}

.appt-ticket__note {
  flex: 1 1 14rem;
  margin: 0;
  font-size: var(--rb-fs-caption);
  line-height: 1.5;
  color: var(--text-secondary);
}

.appt-ticket__actions { display: flex; flex: none; gap: 8px; }

.appt-ticket__reschedule {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid rgba(var(--rb-primary-rgb), 0.4) !important;
  border-radius: 999px !important;
  background: transparent !important;
  color: var(--rb-primary-text) !important;
}
.appt-ticket__reschedule:hover:not(:disabled) { background: rgba(var(--rb-primary-rgb), 0.07) !important; }

.appt-ticket__cancel {
  padding: 9px 16px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: #C62828;
  font-size: var(--rb-fs-small);
  font-weight: 700;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.appt-ticket__cancel:hover:not(:disabled) { background: rgba(198, 40, 40, 0.08); }
.appt-ticket__cancel:disabled { opacity: 0.55; cursor: not-allowed; }
.appt-ticket__cancel:focus-visible { outline: 2px solid #C62828; outline-offset: 2px; }

/* Phones: the date tile becomes a strip across the top */
@media (max-width: 560px) {
  .appt-ticket { flex-direction: column; gap: 14px; padding: 14px; }

  .appt-ticket__stub {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: baseline;
    align-self: stretch;
    gap: 2px 8px;
    width: auto;
    padding: 10px 14px;
    text-align: left;
  }

  .appt-ticket__day { font-size: 22px; }
  .appt-ticket__time { margin: 0 0 0 auto; align-self: center; }
  .appt-ticket__actions { width: 100%; }
  .appt-ticket__actions > * { flex: 1; justify-content: center; }
}

.my-appointment-error {
  margin: 12px 0 0;
  font-size: var(--rb-fs-small);
  line-height: 1.5;
  color: var(--accent);
}

.reschedule-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 10px;
  background: #EFF4FB;
  border: 1px solid #D6E4F5;
}

.reschedule-banner__text {
  margin: 0;
  font-size: var(--rb-fs-small);
  font-weight: 400;
  line-height: 1.55;
  color: #475569;
}

.appointment-page-inner {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.header-row {
  display: flex;
  flex-direction: column;
}

.page-title {
  font-size: var(--rb-fs-title);
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--text-primary);
  margin: 0;
}

.page-subtitle {
  font-size: var(--rb-fs-small);
  color: var(--text-secondary);
  margin: 3px 0 0;
}

@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none !important; }
}

/* Skeleton loading */
.skeleton {
  background: linear-gradient(90deg, #eef1f5 25%, #f6f8fa 37%, #eef1f5 63%);
  background-size: 400% 100%;
  border-radius: 14px;
  animation: shimmer 1.4s ease infinite;
}

.skeleton--header { height: 52px; max-width: 340px; }
.skeleton--grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.skeleton--card { height: 84px; border-radius: 12px; }
.skeleton--panel { height: 220px; border-radius: 14px; }

@keyframes shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}

.step-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.step-label {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: var(--rb-fs-section);
  font-weight: 700;
  letter-spacing: 0.01em;
  color: var(--text-primary);
  margin: 0;
}


.radio {
  width: 20px;
  height: 20px;
  border-radius: 999px;
  border: 2px solid #d1d5db;
  flex-shrink: 0;
  position: relative;
  transition: border-color 0.15s ease;
}

.radio--active {
  border-color: var(--primary);
}

.radio--active::after {
  content: '';
  position: absolute;
  inset: 3px;
  border-radius: 999px;
  background: var(--primary);
}

.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: var(--rb-fs-caption);
  font-weight: 700;
  width: fit-content;
}

.badge--success {
  background: #eaf6ea;
  color: var(--success);
}

.badge--info {
  background: #dbeafe;
  color: #1e40af;
}

.badge--full {
  background: #f3f4f6;
  color: var(--text-secondary);
}

/* Date & time panel */
.panel {
  background: white;
  border-radius: 18px;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04);
  border: 1px solid var(--border);
  overflow: hidden;
}

.form-body {
  padding: 22px;
}

.form-label {
  display: block;
  font-size: var(--rb-fs-caption);
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.form-input {
  width: 100%;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  font-size: var(--rb-fs-body);
  color: var(--text-primary);
  background: white;
  transition: border-color 0.15s ease;
}

.form-input:focus {
  outline: none;
  border-color: var(--primary);
}

.form-input--lg {
  padding: 12px 14px;
  font-weight: 700;
}

.slots-heading {
  font-size: var(--rb-fs-body);
  font-weight: 700;
  color: var(--text-primary);
  margin: 22px 0 12px;
}

.slots-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
  gap: 10px;
}

.slot-skeleton {
  height: 54px;
  border-radius: 12px;
  background: linear-gradient(90deg, var(--rb-skeleton-a, #EEF1F5) 25%, var(--rb-skeleton-b, #F6F8FA) 50%, var(--rb-skeleton-a, #EEF1F5) 75%);
  background-size: 200% 100%;
  animation: slot-shimmer 1.2s ease-in-out infinite;
}
@keyframes slot-shimmer { to { background-position: -200% 0; } }
@media (prefers-reduced-motion: reduce) { .slot-skeleton { animation: none; } }

.slot-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 8px;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  background: white;
  cursor: pointer;
  transition: all 0.15s ease;
}

.slot-btn:hover:not(:disabled):not(.slot-btn--active) {
  border-color: #b9d3ef;
  background: #f7fafd;
}

.slot-btn--active {
  background: #eaf3fc;
  border-color: var(--primary);
}

.slot-btn--full {
  background: transparent;
  border-style: dashed;
  color: var(--text-secondary);
  cursor: not-allowed;
  opacity: 0.6;
}

.slot-btn__time {
  font-size: var(--rb-fs-body);
  font-weight: 700;
  color: var(--text-primary);
}

.slot-btn--full .slot-btn__time {
  color: var(--text-secondary);
}

.slot-btn__avail {
  font-size: var(--rb-fs-caption);
  color: var(--text-secondary);
}

/* Drive cards */
.drive-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.drive-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  text-align: left;
  background: white;
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 18px 20px;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
  transition: border-color 0.15s ease, background 0.15s ease;
}

.drive-card:hover:not(:disabled) {
  border-color: #d9e2ee;
}

.drive-card--active {
  background: #eaf3fc;
  border-color: var(--primary);
}

.drive-card:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.drive-card__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.drive-card__name {
  font-size: var(--rb-fs-body);
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.drive-card__meta {
  font-size: var(--rb-fs-small);
  color: var(--text-secondary);
  margin: 2px 0 0;
}

.progress-track {
  width: 100%;
  height: 6px;
  border-radius: 999px;
  background: #e5e7eb;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.3s ease;
}

.progress-fill--blue {
  background: var(--primary);
}

.progress-fill--green {
  background: var(--success);
}

.progress-fill--full {
  background: #d1d5db;
}

.drive-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 40px 20px;
  text-align: center;
  color: var(--text-secondary);
  font-size: var(--rb-fs-small);
  background: white;
  border: 1px solid var(--border);
  border-radius: 14px;
}

.drive-state__sub {
  font-size: var(--rb-fs-caption);
  color: var(--text-secondary);
  margin: -4px 0 0;
}

.drive-card__bottom {
  display: flex;
  justify-content: space-between;
  font-size: var(--rb-fs-caption);
  color: var(--text-secondary);
}

/* Date chips */
.date-chips {
  display: flex;
  gap: 8px;
  margin: 0 -20px;
  padding: 2px 20px 6px;
  scroll-padding-inline: 20px;
  overflow-x: auto;
  scroll-snap-type: x proximity;
  scrollbar-width: thin;
}

.date-chip {
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  width: 64px;
  padding: 10px 0;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: white;
  cursor: pointer;
  scroll-snap-align: start;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.date-chip:hover:not(.date-chip--active) {
  border-color: #b9d3ef;
}

.date-chip--active {
  border-color: var(--primary);
  background: #eaf3fc;
}

.date-chip__dow,
.date-chip__month {
  font-size: var(--rb-fs-caption);
  font-weight: 600;
  color: var(--text-secondary);
}

.date-chip__day {
  font-size: 18px;
  font-weight: 700;
  line-height: 1.2;
  color: var(--text-primary);
}

.date-chip--active .date-chip__dow,
.date-chip--active .date-chip__month,
.date-chip--active .date-chip__day {
  color: var(--primary);
}

.date-chip:focus-visible {
  outline: 2px solid var(--rb-primary);
  outline-offset: 2px;
}

.date-other {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: var(--rb-fs-small);
  font-weight: 600;
  color: var(--text-secondary);
}

.date-other__picker { width: 220px; }

/* A date picked here (not one of the chips) gets the theme border. */
.date-other__picker--active { --dp-border: var(--rb-primary); }

/* Time slot groups */
.slot-groups {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.slot-group__label {
  margin: 0 0 8px;
  font-size: var(--rb-fs-caption);
  font-weight: 600;
  color: var(--text-secondary);
}

/* Cancel dialog */
.cancel-desc {
  margin: 0 0 16px;
  font-size: var(--rb-fs-small);
  line-height: 1.55;
  color: var(--text-secondary);
}

.btn-danger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 11px 12px;
  border: none;
  border-radius: 10px;
  background: #c62828;
  color: white;
  font-size: var(--rb-fs-body);
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s ease;
}

.btn-danger:hover:not(:disabled) {
  background: #b71c1c;
}

.btn-danger:disabled,
.btn-outline:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.btn-danger:focus-visible {
  outline: 2px solid #c62828;
  outline-offset: 2px;
}

.confirm-actions .btn-danger {
  flex: 1;
}

/* Buttons */
.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 13px 26px;
  border-radius: 10px;
  font-size: var(--rb-fs-body);
  font-weight: 700;
  color: white;
  background: var(--primary);
  border: none;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.92;
}

.btn-primary:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn-block {
  width: 100%;
}

.btn-outline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 12px 24px;
  border-radius: 10px;
  font-size: var(--rb-fs-body);
  font-weight: 700;
  color: var(--text-primary);
  background: #f3f4f6;
  border: none;
  cursor: pointer;
  transition: background 0.15s ease;
}

.btn-outline:hover {
  background: #e5e7eb;
}

/* Modals */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 100;
}

.modal-card {
  background: white;
  border-radius: 14px;
  padding: 26px;
  width: 100%;
  max-width: 380px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  box-shadow: 0 8px 28px rgba(15, 23, 42, 0.16);
}

.modal-title {
  font-size: var(--rb-fs-section);
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 12px;
}

.modal-title--center {
  text-align: center;
}

.modal-sub {
  font-size: var(--rb-fs-small);
  color: var(--text-secondary);
  text-align: center;
  margin: 0 0 16px;
  line-height: 1.5;
}

.summary-list {
  display: flex;
  flex-direction: column;
  width: 100%;
  margin-bottom: 18px;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 9px 0;
  border-bottom: 1px solid #f3f4f6;
  font-size: var(--rb-fs-small);
  color: var(--text-secondary);
}

.summary-row span:last-child {
  font-weight: 700;
  color: var(--text-primary);
}

.summary-row:last-child {
  border-bottom: none;
}

.summary-row .summary-value--success { color: var(--success); }
.summary-row .summary-value--warning { color: #B45309; }
.summary-row .summary-value--muted { color: var(--text-secondary); }

/* Next eligible date banner */
.eligible-banner {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 10px;
  background: #EFF4FB;
  border: 1px solid #D6E4F5;
}

.eligible-banner__icon {
  flex: none;
  margin-top: 1px;
  color: var(--primary);
}

.eligible-banner__text {
  margin: 0;
  font-size: var(--rb-fs-small);
  line-height: 1.55;
  color: #334155;
}

.one-booking-note {
  margin: 4px 0 0;
  font-size: var(--rb-fs-small);
  line-height: 1.5;
  color: var(--text-secondary);
}

.drive-card__note {
  display: block;
  margin: 2px 0 0;
  font-size: var(--rb-fs-caption);
  font-weight: 600;
  color: #B45309;
}

.drive-state__icon {
  color: var(--text-secondary);
  opacity: 0.6;
}

.modal-note {
  font-size: var(--rb-fs-caption);
  color: var(--text-secondary);
  text-align: center;
  margin: 4px 0 0;
  line-height: 1.5;
}

.modal-card--confirm {
  align-items: center;
  text-align: center;
}

.confirm-icon {
  width: 48px;
  height: 48px;
  border-radius: 999px;
  background: var(--success);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 12px;
  flex-shrink: 0;
}

.confirm-icon__svg {
  color: white;
}

.confirm-actions {
  display: flex;
  gap: 10px;
  width: 100%;
  margin-top: 4px;
}

.confirm-actions .btn-outline,
.confirm-actions .btn-primary {
  flex: 1;
  padding: 11px 12px;
}

@media (max-width: 900px) {
  .slots-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .appointment-page {
    padding: 16px 16px 40px;
  }
}

/* ============ Booking layout: steps + ticket ============ */
.booking-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 24px;
  align-items: start;
}

.booking-steps {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

/* Type: two options in one segmented card */
.type-switch {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  padding: 6px;
  border: 1px solid var(--border);
  border-radius: 20px;
  background: white;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.type-switch__opt {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid transparent;
  border-radius: 15px;
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.type-switch__opt:hover:not(.type-switch__opt--active) { background: #f8fafc; }

.type-switch__opt--active {
  background: rgba(var(--rb-primary-rgb), 0.07);
  border-color: rgba(var(--rb-primary-rgb), 0.45);
}

.type-switch__opt:focus-visible,
.bstep__head:focus-visible,
.choice:focus-visible,
.slot-btn:focus-visible {
  outline: 2px solid var(--rb-primary);
  outline-offset: 2px;
}

.type-switch__icon {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background: rgba(var(--rb-primary-rgb), 0.1);
  color: var(--rb-primary-text);
  transition: background-color 0.15s ease, color 0.15s ease;
}

.type-switch__opt--active .type-switch__icon {
  background: var(--rb-primary);
  color: #fff;
}

.type-switch__body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.type-switch__title { font-size: var(--rb-fs-body); font-weight: 700; color: var(--text-primary); }
.type-switch__desc { font-size: var(--rb-fs-caption); color: var(--text-secondary); }

/* Step cards: one open at a time, the rest show what was picked */
.bstep {
  border: 1px solid var(--border);
  border-radius: 20px;
  background: white;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  transition: box-shadow 0.2s ease, border-color 0.2s ease;
}

.bstep--open {
  border-color: rgba(var(--rb-primary-rgb), 0.3);
  box-shadow: 0 18px 40px -28px rgba(15, 23, 42, 0.35);
}

.bstep__head {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 16px 20px;
  border: none;
  border-radius: 20px;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.bstep--open .bstep__head { cursor: default; }
.bstep__head:disabled { cursor: not-allowed; }

.bstep__num {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #eef2f6;
  color: var(--text-secondary);
  font-size: var(--rb-fs-caption);
  font-weight: 800;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.bstep--open .bstep__num,
.bstep--done .bstep__num {
  background: var(--rb-primary);
  color: #fff;
}

.bstep__titles { display: flex; flex: 1; flex-direction: column; gap: 2px; min-width: 0; }

.bstep__title {
  font-family: var(--rb-font-sans);
  font-size: var(--rb-fs-section);
  font-weight: 700;
  color: var(--text-primary);
}

.bstep--locked .bstep__title { color: var(--text-secondary); }

.bstep__summary {
  overflow: hidden;
  font-size: var(--rb-fs-small);
  color: var(--text-secondary);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.bstep__change {
  flex: none;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: var(--rb-fs-small);
  font-weight: 600;
  color: var(--rb-primary-text);
  transition: background-color 0.15s ease;
}

.bstep__head:hover .bstep__change { background: rgba(var(--rb-primary-rgb), 0.08); }

.bstep__body { padding: 2px 20px 20px; }

/* Center and drive choices */
.choice-list { display: flex; flex-direction: column; gap: 10px; }
.list-skeleton { display: grid; gap: 10px; }

.choice {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 14px 16px;
  border: 1px solid #e6eaf0;
  border-radius: 16px;
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.choice:hover:not(:disabled):not(.choice--active) { border-color: rgba(var(--rb-primary-rgb), 0.35); background: #fafcfe; }

.choice--active {
  border-color: var(--rb-primary);
  background: rgba(var(--rb-primary-rgb), 0.06);
}

.choice:disabled { opacity: 0.55; cursor: not-allowed; }

.choice__icon {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background: rgba(var(--rb-primary-rgb), 0.1);
  color: var(--rb-primary-text);
}

.choice__body { display: flex; flex: 1; flex-direction: column; gap: 5px; min-width: 0; }
.choice__top { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.choice__name { font-size: var(--rb-fs-body); font-weight: 700; color: var(--text-primary); line-height: 1.35; }

.choice__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  font-size: var(--rb-fs-caption);
  color: var(--text-secondary);
}

.choice__meta > span { display: inline-flex; align-items: center; gap: 5px; }

.choice--drive { align-items: flex-start; }
.choice--drive .progress-track { display: block; margin-top: 4px; }
.choice--drive .progress-fill { display: block; }

.choice__foot {
  display: flex;
  justify-content: space-between;
  font-size: var(--rb-fs-caption);
  color: var(--text-secondary);
}

/* Calendar-page tile for a drive's date */
.choice__date {
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: center;
  width: 50px;
  padding: 6px 0 7px;
  border-radius: 12px;
  background: rgba(var(--rb-primary-rgb), 0.1);
  color: var(--rb-primary-text);
}

.choice__date-month { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
.choice__date-day { font-size: 20px; font-weight: 800; line-height: 1.1; }

/* Date row */
.date-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  margin-bottom: 8px;
}

.date-head .form-label { margin: 0; }

.drive-state--flat {
  border-style: dashed;
  background: transparent;
}

/* ── The ticket ── */
.ticket {
  position: sticky;
  top: 88px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  border-radius: 22px;
  background: white;
  box-shadow: 0 24px 48px -32px rgba(15, 23, 42, 0.45);
}

.ticket__head {
  padding: 18px 20px 16px;
  border-radius: 21px 21px 0 0;
  background: linear-gradient(135deg, var(--rb-grad-from, #E3F2FD), var(--rb-grad-to, #BBDEFB));
  color: #0F172A;
}

.ticket__eyebrow {
  margin: 0;
  font-size: var(--rb-fs-caption);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.7;
}

.ticket__type {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 4px 0 0;
  font-family: var(--rb-font-sans);
  font-size: var(--rb-fs-section);
  font-weight: 700;
}

.ticket__rows {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin: 0;
  padding: 18px 20px;
}

.ticket__row dt,
.ticket__row--pair dt {
  margin-bottom: 3px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.ticket__row dd {
  margin: 0;
  font-size: var(--rb-fs-body);
  font-weight: 700;
  line-height: 1.4;
  color: var(--text-primary);
}

.ticket__row--pair { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

.ticket__sub {
  display: block;
  font-size: var(--rb-fs-caption);
  font-weight: 500;
  color: var(--text-secondary);
}

.ticket__row dd.ticket__empty { font-weight: 500; color: #94A3B8; }

/* Perforation with two notches cut out of the card's sides */
.ticket__tear {
  position: relative;
  margin: 0 20px;
  border-top: 2px dashed var(--border);
}

.ticket__tear::before,
.ticket__tear::after {
  content: '';
  position: absolute;
  top: -11px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--rb-page-bg, #F5F7FA);
  box-shadow: inset 0 0 0 1px var(--border);
}

.ticket__tear::before { left: -31px; clip-path: inset(0 0 0 50%); }
.ticket__tear::after { right: -31px; clip-path: inset(0 50% 0 0); }

.ticket__tips { padding: 16px 20px 6px; }

.ticket__tips-title {
  margin: 0 0 10px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.ticket__tips ul { display: flex; flex-direction: column; gap: 9px; margin: 0; padding: 0; list-style: none; }

.ticket__tips li {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  font-size: var(--rb-fs-small);
  line-height: 1.4;
  color: #475569;
}

.ticket__tips li :deep(svg) { flex: none; margin-top: 2px; color: var(--rb-primary-text); }

.ticket__foot { padding: 14px 20px 20px; }

.ticket__hint {
  margin: 0 0 10px;
  font-size: var(--rb-fs-small);
  line-height: 1.4;
  color: var(--text-secondary);
}

.ticket__hint-text {
  display: block;
  overflow: hidden;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.ticket__hint-text--short { display: none; }
@media (max-width: 420px) {
  .ticket__hint-text--full { display: none; }
  .ticket__hint-text--short { display: block; }
}

.ticket__btn {
  width: 100%;
  justify-content: center;
  border-radius: 999px !important;
}

@media (prefers-reduced-motion: reduce) {
  .bstep, .bstep__num, .choice, .type-switch__opt, .type-switch__icon { transition: none; }
}

/* Below 1100px the ticket turns into a bar that sticks to the bottom. */
@media (max-width: 1100px) {
  /* minmax(0, ...) so the one-line drive name in the bar can't widen the page. */
  .booking-layout { grid-template-columns: minmax(0, 1fr); }

  .ticket {
    top: auto;
    bottom: 16px;
    z-index: 20;
    flex-direction: row;
    border-color: rgba(255, 255, 255, 0.8);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.8);
    -webkit-backdrop-filter: blur(18px) saturate(170%);
    backdrop-filter: blur(18px) saturate(170%);
    box-shadow: 0 16px 36px -18px rgba(15, 23, 42, 0.4);
  }

  .ticket__head, .ticket__rows, .ticket__tear, .ticket__tips { display: none; }

  .ticket__foot {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 12px;
    min-width: 0;
    padding: 8px 8px 8px 20px;
  }

  .ticket__hint { flex: 1; min-width: 0; margin: 0; }
  .ticket__btn { width: auto; flex: none; }
}

@media (prefers-reduced-transparency: reduce) and (max-width: 1100px) {
  .ticket { background: rgba(255, 255, 255, 0.97); }
}

@media (max-width: 560px) {
  .type-switch { grid-template-columns: 1fr; }
  .bstep__head { padding: 14px 16px; }
  .bstep__body { padding: 2px 16px 16px; }
  .date-chips { margin: 0 -16px; padding: 2px 16px 6px; scroll-padding-inline: 16px; }
  .ticket { bottom: 12px; }
  .ticket__foot { padding-left: 16px; }
  .choice { gap: 12px; padding: 12px; }
  /* Badge goes under the name; side by side it spills out of the card. */
  .choice__top { flex-direction: column; gap: 4px; }
  .choice__date { width: 44px; }
  .choice__foot { flex-wrap: wrap; gap: 2px 10px; }
  .ticket__hint { font-size: var(--rb-fs-caption); }
}

/* ============ Dark mode ============ */
/*
 * Tanan naka-anchor sa .appointment-page. `:global(…)` mogawas sa scope
 * system, so ang `:global(.dark .form-input)` kaniadto kay mo-match sa
 * .form-input sa TANANG page human ma-load ni nga stylesheet (mao ang hinungdan
 * sa ngitngit nga inputs sa profile). Ang mga modal diri kay sulod sa
 * .appointment-page (walay Teleport), so ok ra ang anchor.
 */
:global(.dark .appointment-page) {
  --text-primary: #F1F5F9;
  --text-secondary: #94A3B8;
  --border: #334155;
  background: #0F172A;
}

:global(.dark .appointment-page .drive-card),
:global(.dark .appointment-page .drive-state),
:global(.dark .appointment-page .panel),
:global(.dark .appointment-page .slot-btn),
:global(.dark .appointment-page .modal-card) {
  background: #1E293B;
  border-color: #334155;
}

:global(.dark .appointment-page .confirm-error) {
  background: rgba(240, 68, 56, 0.10);
  border-color: rgba(240, 68, 56, 0.28);
  color: #FECDCA;
}
:global(.dark .appointment-page .confirm-error__icon) { color: #F97066; }
:global(.dark .appointment-page .summary-card) {
  background: #172033;
  border-color: #334155;
}
:global(.dark .appointment-page .summary-item) { border-bottom-color: #334155; }
:global(.dark .appointment-page .summary-close:hover:not(:disabled)) { background: #263449; }

:global(.dark .appointment-page .drive-card--active),
:global(.dark .appointment-page .slot-btn--active) {
  background: color-mix(in srgb, var(--rb-primary-text) 14%, transparent);
}




:global(.dark .appointment-page .form-input) {
  background: #0F172A;
  border-color: #334155;
  color: #F1F5F9;
}

:global(.dark .appointment-page .slot-btn--full) { background: #263449; }
:global(.dark .appointment-page .slot-btn:hover:not(:disabled):not(.slot-btn--active)) { background: #263449; border-color: #3f5878; }

:global(.dark .appointment-page .badge--success) { background: rgba(102,187,106,0.16); }
:global(.dark .appointment-page .badge--info) { background: color-mix(in srgb, var(--rb-primary-text) 16%, transparent); color: var(--rb-primary-text); }
:global(.dark .appointment-page .badge--full) { background: #263449; }

:global(.dark .appointment-page .reschedule-banner) {
  background: color-mix(in srgb, var(--rb-primary-text) 10%, transparent);
  border-color: color-mix(in srgb, var(--rb-primary-text) 24%, transparent);
}

:global(.dark .appointment-page .reschedule-banner__text) { color: #CBD5E1; }


:global(.dark .appointment-page .progress-track) { background: #334155; }
:global(.dark .appointment-page .progress-fill--full) { background: #475569; }

:global(.dark .appointment-page .btn-outline) {
  background: #263449;
  color: #E2E8F0;
}
:global(.dark .appointment-page .btn-outline:hover) { background: #334155; }

:global(.dark .appointment-page .summary-row) { border-color: #263449; }

/* background-image, not the `background` shorthand: the shorthand resets
   background-size to `auto`, which collapses the 400%-wide gradient to the
   element width and leaves the shimmer keyframes with zero travel. */
:global(.dark .appointment-page .skeleton) {
  background-image: linear-gradient(90deg, #1E293B 25%, #263449 37%, #1E293B 63%);
}

:global(.dark .appointment-page .date-chip) {
  background: #1E293B;
  border-color: #334155;
}
:global(.dark .appointment-page .date-chip:hover:not(.date-chip--active)) { border-color: #3f5878; }
:global(.dark .appointment-page .date-chip--active) {
  background: color-mix(in srgb, var(--rb-primary-text) 14%, transparent);
  border-color: var(--rb-primary-text);
}
:global(.dark .appointment-page .date-chip--active .date-chip__dow),
:global(.dark .appointment-page .date-chip--active .date-chip__month),
:global(.dark .appointment-page .date-chip--active .date-chip__day) { color: var(--rb-primary-text); }
:global(.dark .appointment-page .slot-btn--full) { background: transparent; }
:global(.dark .appointment-page .eligible-banner) {
  background: color-mix(in srgb, var(--rb-primary-text) 10%, transparent);
  border-color: color-mix(in srgb, var(--rb-primary-text) 24%, transparent);
}
:global(.dark .appointment-page .eligible-banner__icon),
:global(.dark .appointment-page .appt-ticket__flag) { color: var(--rb-primary-text); }
:global(.dark .appointment-page .eligible-banner__text) { color: #CBD5E1; }
:global(.dark .appointment-page .drive-card__note),
:global(.dark .appointment-page .summary-row .summary-value--warning) { color: #FFB74D; }
:global(.dark .appointment-page .screening-notice--info) {
  background: color-mix(in srgb, var(--rb-primary-text) 10%, transparent);
  border-color: color-mix(in srgb, var(--rb-primary-text) 24%, transparent);
  color: var(--rb-primary-text);
}
:global(.dark .appointment-page .screening-notice--warn) {
  background: rgba(245, 158, 11, 0.10);
  border-color: rgba(245, 158, 11, 0.30);
  color: #FCD34D;
}

.btn-primary:focus-visible,
.btn-outline:focus-visible,
.slot-btn:focus-visible {
  outline: 2px solid var(--rb-primary);
  outline-offset: 2px;
}

/* --- Questionnaire notice on an appointment card --- */

.screening-notice {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid transparent;
  font-size: var(--rb-fs-small);
  line-height: 1.5;
}

.screening-notice--info {
  background: #eff6ff;
  border-color: #dbeafe;
  color: #1e40af;
}

.screening-notice--warn {
  background: #fffbeb;
  border-color: #fde68a;
  color: #92400e;
}

.screening-notice__text { margin: 0; flex: 1 1 16rem; }

.screening-notice__link {
  flex: none;
  font-weight: 700;
  color: inherit;
  text-decoration: underline;
}


/* Booking steps + ticket, dark */
:global(.dark .appointment-page .type-switch),
:global(.dark .appointment-page .bstep),
:global(.dark .appointment-page .ticket) {
  background: #1E293B;
  border-color: #334155;
}
:global(.dark .appointment-page .type-switch__opt:hover:not(.type-switch__opt--active)) { background: #263449; }
:global(.dark .appointment-page .type-switch__opt--active),
:global(.dark .appointment-page .choice--active) {
  background: color-mix(in srgb, var(--rb-primary-text) 12%, transparent);
  border-color: var(--rb-primary-text);
}
:global(.dark .appointment-page .type-switch__icon),
:global(.dark .appointment-page .choice__icon),
:global(.dark .appointment-page .choice__date) { background: color-mix(in srgb, var(--rb-primary-text) 16%, transparent); }
:global(.dark .appointment-page .type-switch__opt--active .type-switch__icon) { background: var(--rb-primary); color: #fff; }
:global(.dark .appointment-page .bstep__num) { background: #263449; }
:global(.dark .appointment-page .bstep--open .bstep__num),
:global(.dark .appointment-page .bstep--done .bstep__num) { background: var(--rb-primary); }
:global(.dark .appointment-page .choice) { border-color: #334155; }
:global(.dark .appointment-page .choice:hover:not(:disabled):not(.choice--active)) { background: #263449; border-color: #3f5878; }
:global(.dark .appointment-page .ticket__head) {
  background: linear-gradient(135deg, color-mix(in srgb, var(--rb-primary) 45%, #1E293B), color-mix(in srgb, var(--rb-primary) 18%, #1E293B));
  color: #F1F5F9;
}
:global(.dark .appointment-page .ticket__tear::before),
:global(.dark .appointment-page .ticket__tear::after) { background: #0F172A; }
:global(.dark .appointment-page .ticket__tips li) { color: #CBD5E1; }
:global(.dark .appointment-page .ticket__row dd.ticket__empty) { color: #64748B; }
@media (max-width: 1100px) {
  :global(.dark .appointment-page .ticket) {
    background: rgba(30, 41, 59, 0.8);
    border-color: rgba(255, 255, 255, 0.08);
  }
}

/* Upcoming appointment ticket, dark */
:global(.dark .appointment-page .appt-ticket) { background: #1E293B; border-color: #334155; }
:global(.dark .appointment-page .appt-ticket__stub) { background: color-mix(in srgb, var(--rb-primary-text) 14%, transparent); }
:global(.dark .appointment-page .appt-ticket__time) { background: rgba(15, 23, 42, 0.5); }
:global(.dark .appointment-page .appt-ticket--rescheduling) {
  border-color: var(--rb-primary-text);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--rb-primary-text) 18%, transparent);
}
:global(.dark .appointment-page .appt-ticket__cancel) { color: #EF9A9A; }
:global(.dark .appointment-page .appt-ticket__cancel:hover:not(:disabled)) { background: rgba(239, 83, 80, 0.16); }
</style>
