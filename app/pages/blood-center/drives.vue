<template>
  <div class="drives-page">
    <div class="drives-inner">
      <!-- Header -->
      <PageHeader title="Blood Donation Drives">
        <template #actions>
          <button type="button" class="ui-btn ui-btn--primary" @click="openCreateModal">
            <AssetIcon name="plus" :size="15" />
            Create drive
          </button>
        </template>
      </PageHeader>

      <!-- The month, day by day: a dot for each drive in its state's colour.
           Picking a day lists that day's drives, whatever their state. -->
      <section class="cal" aria-label="Drives by date">
        <header class="cal__head">
          <div class="cal__nav">
            <button type="button" class="icon-btn" aria-label="Previous month" @click="shiftMonth(-1)">
              <AssetIcon name="chevron-left" :size="15" />
            </button>
            <h2 class="cal__title">{{ monthLabel }}</h2>
            <button type="button" class="icon-btn" aria-label="Next month" @click="shiftMonth(1)">
              <AssetIcon name="chevron-right" :size="15" />
            </button>
            <button v-if="!onThisMonth" type="button" class="ui-btn ui-btn--sm" @click="goThisMonth">This month</button>
          </div>
          <!-- The month on show, in numbers: they follow the arrows. -->
          <p class="cal__figs" aria-live="polite">
            <span><strong>{{ loading ? '–' : monthFigures.drives }}</strong> {{ monthFigures.drives === 1 ? 'drive' : 'drives' }}</span>
            <span><strong>{{ loading ? '–' : monthFigures.booked }}</strong> booked</span>
            <span v-if="monthFigures.units !== null"><strong>{{ loading ? '–' : monthFigures.units }}</strong> {{ monthFigures.units === 1 ? 'unit' : 'units' }} collected in {{ monthOnly }}</span>
          </p>
        </header>

        <div class="cal__strip">
          <button
            v-for="day in monthDays"
            :key="day.iso"
            type="button"
            class="cal__day"
            :class="{
              'cal__day--today': day.iso === todayIso,
              'cal__day--on': day.iso === selectedDate,
              'cal__day--has': day.drives.length,
              'cal__day--weekend': day.weekend,
            }"
            :aria-pressed="day.iso === selectedDate"
            :aria-label="dayLabel(day)"
            :title="day.drives.map((d) => d.name).join('\n') || undefined"
            @click="pickDate(day.iso)"
          >
            <span class="cal__wd">{{ day.wd }}</span>
            <span class="cal__num">{{ day.n }}</span>
            <span class="cal__dots" aria-hidden="true">
              <span v-for="d in day.drives.slice(0, 3)" :key="d.id" class="cal__dot" :class="`cal__dot--${calTone(d)}`" />
            </span>
          </button>
        </div>

        <footer class="cal__legend">
          <span aria-hidden="true"><span class="cal__dot cal__dot--held" /> Held</span>
          <span aria-hidden="true"><span class="cal__dot cal__dot--ahead" /> Upcoming</span>
          <span aria-hidden="true"><span class="cal__dot cal__dot--draft" /> Draft</span>
          <span aria-hidden="true"><span class="cal__dot cal__dot--cancelled" /> Cancelled</span>
          <span v-if="monthHasDrives || loading" class="cal__legend-hint">Pick a day to see its drives</span>
          <!-- The empty strip already says "none this month"; only the way out is worded. -->
          <button v-else-if="nearestMonth" type="button" class="cal__jump cal__legend-hint" @click="monthCursor = nearestMonth.key">
            {{ nearestMonth.label }} has {{ nearestMonth.count }} {{ nearestMonth.count === 1 ? 'drive' : 'drives' }}
            <AssetIcon name="arrow-right" :size="12" />
          </button>
        </footer>
      </section>

      <!-- Drive list -->
      <section class="panel">
        <div class="panel-header">
          <div class="panel-header__lead">
            <h2 class="panel-title">Drives</h2>
            <label v-if="drives.length" class="search">
              <AssetIcon name="search" :size="15" class="search__icon" />
              <input
                v-model="search"
                type="search"
                class="search__input"
                placeholder="Search drive / venue / staff…"
                aria-label="Search drives by name, venue or assigned staff"
              >
            </label>
            <button v-if="selectedDate" type="button" class="date-chip" :aria-label="`Show all drives, not only ${longDate(selectedDate)}`" @click="selectedDate = ''">
              <AssetIcon name="calendar" :size="13" />
              {{ shortDay(selectedDate) }}
              <AssetIcon name="x" :size="13" />
            </button>
          </div>

          <div class="seg" role="tablist" aria-label="Show drives">
            <button
              v-for="tab in DRIVE_TABS"
              :key="tab.value"
              type="button"
              role="tab"
              class="seg__btn"
              :class="{ 'seg__btn--on': !selectedDate && view === tab.value }"
              :aria-selected="!selectedDate && view === tab.value"
              @click="view = tab.value; selectedDate = ''"
            >
              {{ tab.label }}
              <span class="seg__count">{{ countFor(tab.value) }}</span>
            </button>
          </div>
        </div>

        <SkeletonList v-if="loading" class="drives-skeleton" :rows="5" />
        <div v-else-if="loadError" class="empty-state" role="alert">
          <span class="empty-state__icon empty-state__icon--error"><AssetIcon name="circle-alert" :size="20" /></span>
          <p class="empty-state__title">Could not load the drives</p>
          <p class="empty-state__text">{{ loadError }}</p>
          <button type="button" class="ui-btn" @click="loadDrives">Try again</button>
        </div>

        <div v-else-if="!drives.length" class="empty-state">
          <span class="empty-state__icon"><AssetIcon name="truck" :size="20" /></span>
          <p class="empty-state__title">No drives yet</p>
          <p class="empty-state__text">Schedule a drive and donors can register for it in the donor portal.</p>
          <button type="button" class="ui-btn ui-btn--primary" @click="openCreateModal">
            <AssetIcon name="plus" :size="15" />
            Create drive
          </button>
        </div>

        <div v-else-if="!visibleDrives.length && selectedDate && !search.trim()" class="empty-state">
          <span class="empty-state__icon"><AssetIcon name="calendar" :size="20" /></span>
          <p class="empty-state__title">No drives that day</p>
          <p class="empty-state__text">Pick a day with a dot on the strip.</p>
          <button type="button" class="ui-btn" @click="selectedDate = ''">Show all drives</button>
        </div>

        <div v-else-if="!visibleDrives.length && search.trim()" class="empty-state">
          <span class="empty-state__icon"><AssetIcon name="search-x" :size="20" /></span>
          <p class="empty-state__title">No drives match</p>
          <p class="empty-state__text">Try another name, venue or staff member, or another tab.</p>
          <button type="button" class="ui-btn" @click="search = ''">Clear search</button>
        </div>

        <div v-else-if="!visibleDrives.length" class="empty-state">
          <span class="empty-state__icon"><AssetIcon name="calendar" :size="20" /></span>
          <p class="empty-state__title">{{ EMPTY_TAB[view].title }}</p>
          <p class="empty-state__text">{{ EMPTY_TAB[view].text }}</p>
          <!-- The last drive held, so an empty Upcoming still says where things stand. -->
          <p v-if="view === 'upcoming' && lastDrive" class="empty-state__last">
            Last drive: <strong>{{ lastDrive.name }}</strong>, {{ formatShortDate(lastDrive.event_date) }} · {{ bookedCount(lastDrive.registered_count) }}
          </p>
          <!-- Create drive sits in the header; here, the way to the drives that exist. -->
          <div v-if="view === 'upcoming' && countFor('completed')" class="empty-state__actions">
            <button type="button" class="ui-btn" @click="view = 'completed'">
              View completed ({{ countFor('completed') }})
            </button>
          </div>
        </div>

        <p v-if="actionError" class="form-error list-error" role="alert">{{ actionError }}</p>

        <ul v-if="visibleDrives.length && !loadError" class="drive-list">
          <li
            v-for="drive in visibleDrives"
            :key="drive.id"
            class="drive"
            :class="{ 'drive--done': drive.status === 'Completed' || drive.status === 'Cancelled', 'drive--today': drive.status === 'Open' }"
            tabindex="0"
            :aria-label="`Open ${drive.name}`"
            @click="detail = drive"
            @keydown.enter.self="detail = drive"
          >
            <!-- Calendar block: the date is what a drive is planned around. -->
            <div class="drive__date" aria-hidden="true">
              <span class="drive__month">{{ dateParts(drive.event_date).month }}</span>
              <span class="drive__day">{{ dateParts(drive.event_date).day }}</span>
              <span class="drive__weekday">{{ dateParts(drive.event_date).weekday }}</span>
            </div>

            <div class="drive__body">
              <div class="drive__title-row">
                <p class="drive__title">{{ drive.name }}</p>
                <span class="badge" :class="`badge--${statusTone(drive)}`">
                  <span class="badge__dot" aria-hidden="true" />
                  {{ driveStatusLabel(drive) }}
                </span>
                <span v-if="registrationClosed(drive)" class="badge badge--warn">
                  <span class="badge__dot" aria-hidden="true" />
                  Registration closed
                </span>
              </div>

              <p class="drive__facts">
                <span class="drive__fact">
                  <AssetIcon name="map-pin" :size="13" />
                  {{ drive.location }}
                </span>
                <span v-if="drive.start_time && drive.end_time" class="drive__fact">
                  <AssetIcon name="clock" :size="13" />
                  {{ timeLabel(drive.start_time) }} to {{ timeLabel(drive.end_time) }}
                </span>
                <span v-if="drive.assigned_staff" class="drive__fact">
                  <AssetIcon name="users" :size="13" />
                  {{ drive.assigned_staff }}
                </span>
              </p>

              <p v-if="drive.status === 'Cancelled'" class="drive__note drive__note--cancelled">
                Cancelled{{ drive.cancellation_reason ? `: ${drive.cancellation_reason}` : '' }}
              </p>
              <p v-else-if="drive.announcement" class="drive__note">{{ drive.announcement }}</p>
            </div>

            <!-- Registrations against capacity -->
            <div class="drive__fill">
              <p class="drive__fill-head">
                <strong>{{ drive.registered_count ?? 0 }}</strong>
                <span>{{ drive.capacity ? `of ${drive.capacity} booked` : 'booked' }}</span>
              </p>
              <!-- A bar only against a limit: with none, an empty track would read as "nobody yet". -->
              <div v-if="drive.capacity" class="progress-track">
                <div
                  class="progress-fill"
                  :class="`progress-fill--${fillLevel(drive)}`"
                  :style="{ width: `${Math.min(fillPercent(drive), 100)}%` }"
                />
              </div>
              <p class="drive__fill-foot">
                {{ drive.capacity ? `${Math.min(fillPercent(drive), 100)}% full` : 'No capacity limit' }}<template v-if="drive.expected_participants"> · expected {{ drive.expected_participants }}</template>
              </p>
            </div>

            <!-- What the drive's state allows (utils/drives driveActions); the server decides.
                 The state's next step in words; Edit and Cancel as icons, as on Donations. -->
            <div class="drive__actions" @click.stop>
              <button
                v-if="driveActions(drive).publish"
                type="button"
                class="ui-btn ui-btn--sm ui-btn--primary"
                @click="openPublishDialog(drive)"
              >
                <AssetIcon name="send" :size="13" />
                Publish
              </button>
              <button
                v-if="driveActions(drive).closeRegistration"
                type="button"
                class="ui-btn ui-btn--sm"
                :disabled="busyId === drive.id"
                title="Stop new bookings; the ones held stand"
                @click="setRegistration(drive, false)"
              >
                <AssetIcon name="lock" :size="13" />
                Close registration
              </button>
              <button
                v-if="driveActions(drive).reopenRegistration"
                type="button"
                class="ui-btn ui-btn--sm"
                :disabled="busyId === drive.id"
                @click="setRegistration(drive, true)"
              >
                <AssetIcon name="unlock" :size="13" />
                Reopen registration
              </button>
              <!-- A drive held on paper: type its records in once they are back. -->
              <NuxtLink
                v-if="canRecordPaper && (drive.status === 'Completed' || drive.status === 'Open')"
                :to="`/blood-center/paper-records?drive=${drive.id}`"
                class="ui-btn ui-btn--sm"
                title="Enter paper records"
              >
                <AssetIcon name="file-text" :size="13" />
                Paper records
              </NuxtLink>
              <button
                v-if="driveActions(drive).edit"
                type="button"
                class="icon-btn"
                :aria-label="`Edit ${drive.name}`"
                title="Edit"
                @click="openEditModal(drive)"
              >
                <AssetIcon name="pencil" :size="15" />
              </button>
              <button
                v-if="driveActions(drive).cancel"
                type="button"
                class="icon-btn icon-btn--danger"
                :aria-label="`Cancel ${drive.name}`"
                title="Cancel this drive"
                @click="openCancelDialog(drive)"
              >
                <AssetIcon name="x" :size="15" />
              </button>
            </div>
          </li>
        </ul>
      </section>
    </div>

    <!-- ============ DRIVE RECORD ============ -->
    <CenterModal v-if="detail" :title="detail.name" eyebrow="Blood donation drive" size="md" @close="detail = null">
      <template #meta>
        <span class="badge" :class="`badge--${statusTone(detail)}`">
          <span class="badge__dot" aria-hidden="true" />
          {{ driveStatusLabel(detail) }}
        </span>
        <span v-if="registrationClosed(detail)" class="badge badge--warn">
          <span class="badge__dot" aria-hidden="true" />
          Registration closed
        </span>
      </template>

      <div class="dd">
        <div class="dd-when" :class="{ 'drive--today': detail.status === 'Open' }">
          <div class="drive__date" aria-hidden="true">
            <span class="drive__month">{{ dateParts(detail.event_date).month }}</span>
            <span class="drive__day">{{ dateParts(detail.event_date).day }}</span>
            <span class="drive__weekday">{{ dateParts(detail.event_date).weekday }}</span>
          </div>
          <div class="dd-when__text">
            <p class="dd-when__date">{{ longDate(detail.event_date) }}</p>
            <p class="dd-when__sub">
              <template v-if="detail.start_time && detail.end_time">{{ timeLabel(detail.start_time) }} to {{ timeLabel(detail.end_time) }} · </template>{{ daysAway(detail.event_date) }}
            </p>
          </div>
        </div>

        <section aria-labelledby="dd-bookings">
          <h3 id="dd-bookings" class="dd-section__title">Bookings</h3>
          <p class="drive__fill-head">
            <strong>{{ detail.registered_count ?? 0 }}</strong>
            <span>{{ detail.capacity ? `of ${detail.capacity} booked` : 'booked' }}</span>
          </p>
          <div v-if="detail.capacity" class="progress-track">
            <div class="progress-fill" :class="`progress-fill--${fillLevel(detail)}`" :style="{ width: `${Math.min(fillPercent(detail), 100)}%` }" />
          </div>
          <p class="drive__fill-foot">
            {{ detail.capacity ? `${Math.min(fillPercent(detail), 100)}% full` : 'No capacity limit' }}<template v-if="detail.expected_participants"> · expected {{ detail.expected_participants }}</template>
          </p>
        </section>

        <dl class="facts">
          <div class="fact fact--full">
            <dt>Venue</dt>
            <dd>{{ detail.location || '—' }}</dd>
          </div>
          <div class="fact">
            <dt>Assigned staff</dt>
            <dd>{{ detail.assigned_staff || 'Not assigned' }}</dd>
          </div>
          <div class="fact">
            <dt>Registration</dt>
            <dd>
              {{ registrationState(detail) }}
              <span v-if="detail.registration_closed_at" class="fact__sub">Closed {{ formatShortDate(detail.registration_closed_at) }}</span>
            </dd>
          </div>
        </dl>

        <section v-if="detail.status === 'Cancelled' || detail.announcement" aria-labelledby="dd-note">
          <h3 id="dd-note" class="dd-section__title">{{ detail.status === 'Cancelled' ? 'Why it was cancelled' : 'Message for donors' }}</h3>
          <p class="dd-note" :class="{ 'dd-note--cancelled': detail.status === 'Cancelled' }">
            {{ detail.status === 'Cancelled' ? (detail.cancellation_reason || 'No reason given.') : detail.announcement }}
          </p>
        </section>

        <section aria-labelledby="dd-history">
          <h3 id="dd-history" class="dd-section__title">History</h3>
          <ol class="timeline">
            <li v-for="step in driveSteps(detail)" :key="step.key" class="tl" :class="`tl--${step.state}`">
              <span class="tl__dot" aria-hidden="true">
                <AssetIcon v-if="step.state === 'done'" name="check" :size="11" />
                <AssetIcon v-else-if="step.state === 'stop'" name="x" :size="11" />
              </span>
              <div class="tl__body">
                <p class="tl__label">{{ step.label }}</p>
                <p v-if="step.detail" class="tl__detail">{{ step.detail }}</p>
              </div>
            </li>
          </ol>
        </section>
      </div>

      <template #actions>
        <button type="button" class="ui-btn" @click="detail = null">Close</button>
        <button v-if="driveActions(detail).edit" type="button" class="ui-btn" @click="editFromDetail">
          <AssetIcon name="pencil" :size="14" />
          Edit
        </button>
        <NuxtLink
          v-if="canRecordPaper && (detail.status === 'Completed' || detail.status === 'Open')"
          :to="`/blood-center/paper-records?drive=${detail.id}`"
          class="ui-btn"
        >
          <AssetIcon name="file-text" :size="14" />
          Paper records
        </NuxtLink>
        <button v-if="driveActions(detail).publish" type="button" class="ui-btn ui-btn--primary" @click="publishFromDetail">
          <AssetIcon name="send" :size="14" />
          Publish
        </button>
      </template>
    </CenterModal>

    <!-- Create drive modal -->
    <Transition name="modal">
      <div v-if="showCreateModal" class="modal-overlay" @click.self="closeCreateModal">
        <div v-focus-trap class="modal-card" role="dialog" aria-modal="true" aria-labelledby="create-drive-title" @dialog-escape="closeCreateModal">
          <div class="modal-card__header">
            <div>
              <h2 id="create-drive-title" class="modal-card__title">{{ editingDrive ? 'Edit drive' : 'Create drive' }}</h2>
            </div>
            <button type="button" class="modal-card__close" aria-label="Close" @click="closeCreateModal">
              <AssetIcon name="x" :size="18" />
            </button>
          </div>

          <form class="modal-form" @submit.prevent="handleCreateDrive">
            <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>

            <div class="form-group">
              <label class="form-label" for="drive-name">Drive name</label>
              <input id="drive-name" v-model="driveForm.name" type="text" class="form-input" placeholder="e.g. UM Matina Bloodletting Drive" maxlength="150" required>
            </div>

            <div class="form-group">
              <label class="form-label" for="drive-venue">Venue</label>
              <input id="drive-venue" v-model="driveForm.location" type="text" class="form-input" placeholder="Venue name and address" maxlength="150" required>
            </div>

            <div class="form-group">
              <label class="form-label" for="drive-date">Date</label>
              <DatePicker id="drive-date" v-model="driveForm.event_date" :min="todayIso" :disabled="scheduleLocked" />
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="drive-start">Starts</label>
                <input id="drive-start" v-model="driveForm.start_time" type="time" class="form-input" required :disabled="scheduleLocked">
              </div>
              <div class="form-group">
                <label class="form-label" for="drive-end">Ends</label>
                <input id="drive-end" v-model="driveForm.end_time" type="time" class="form-input" required :disabled="scheduleLocked">
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="drive-expected">Expected participants <span class="form-optional">optional</span></label>
                <input id="drive-expected" v-model="driveForm.expected_participants" type="number" min="1" inputmode="numeric" class="form-input" placeholder="e.g. 120">
              </div>
              <div class="form-group">
                <label class="form-label" for="drive-capacity">Registration capacity <span class="form-optional">optional</span></label>
                <input
                  id="drive-capacity"
                  v-model="driveForm.max_capacity"
                  type="number"
                  :min="editingDrive?.registered_count || 1"
                  inputmode="numeric"
                  class="form-input"
                  placeholder="No limit"
                >
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="drive-staff">Assigned staff <span class="form-optional">optional</span></label>
              <input id="drive-staff" v-model="driveForm.assigned_staff" type="text" class="form-input" placeholder="Who will run the drive">
            </div>

            <div class="form-group">
              <label class="form-label" for="drive-note">Message for donors <span class="form-optional">optional</span></label>
              <textarea id="drive-note" v-model="driveForm.announcement" class="form-textarea" rows="3" placeholder="e.g. Bring a valid ID and eat before donating." />
            </div>

            <label v-if="!editingDrive" class="form-check">
              <input v-model="driveForm.publish" type="checkbox">
              <span>Publish to donors now</span>
            </label>

            <div class="modal-actions">
              <button type="button" class="ui-btn" @click="closeCreateModal">Discard</button>
              <button type="submit" class="ui-btn ui-btn--primary" :disabled="submitting">
                {{ submitLabel }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>

    <!-- Cancel drive -->
    <Transition name="modal">
      <div v-if="cancelTarget" class="modal-overlay" @click.self="closeCancelDialog">
        <div
          v-focus-trap
          class="modal-card modal-card--narrow"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="cancel-drive-title"
          @dialog-escape="closeCancelDialog"
        >
          <div class="modal-card__header">
            <div>
              <h2 id="cancel-drive-title" class="modal-card__title">Cancel this drive?</h2>
              <p class="modal-card__subtitle">
                {{ cancelTarget.name }} &middot; {{ dateParts(cancelTarget.event_date).weekday }},
                {{ dateParts(cancelTarget.event_date).month }} {{ dateParts(cancelTarget.event_date).day }}
              </p>
            </div>
            <button type="button" class="modal-card__close" aria-label="Close" @click="closeCancelDialog">
              <AssetIcon name="x" :size="18" />
            </button>
          </div>

          <div class="modal-form">
            <p v-if="cancelError" class="form-error" role="alert">{{ cancelError }}</p>

            <div class="cancel-impact">
              <AssetIcon name="circle-alert" :size="16" />
              <p>
                <strong>{{ bookedLabel(cancelTarget.registered_count) }}</strong>
                booked. Their bookings are cancelled with the drive, and each donor is notified with the reason.
              </p>
            </div>

            <div class="form-group">
              <label class="form-label" for="cancel-reason">Reason</label>
              <textarea
                id="cancel-reason"
                v-model="cancelReason"
                class="form-textarea"
                rows="3"
                maxlength="255"
                placeholder="e.g. Venue unavailable because of the weather advisory"
              />
            </div>

            <div class="modal-actions">
              <button type="button" class="ui-btn" @click="closeCancelDialog">Keep drive</button>
              <button
                type="button"
                class="ui-btn ui-btn--danger"
                :disabled="cancelling || !cancelReason.trim()"
                @click="confirmCancel"
              >
                {{ cancelling ? 'Cancelling…' : 'Cancel drive' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Publish drive -->
    <Transition name="modal">
      <div v-if="publishTarget" class="modal-overlay" @click.self="closePublishDialog">
        <div
          v-focus-trap
          class="modal-card modal-card--narrow"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="publish-drive-title"
          @dialog-escape="closePublishDialog"
        >
          <div class="modal-card__header">
            <div>
              <h2 id="publish-drive-title" class="modal-card__title">Publish this drive?</h2>
              <p class="modal-card__subtitle">
                {{ publishTarget.name }} &middot; {{ dateParts(publishTarget.event_date).weekday }},
                {{ dateParts(publishTarget.event_date).month }} {{ dateParts(publishTarget.event_date).day }}
              </p>
            </div>
            <button type="button" class="modal-card__close" aria-label="Close" @click="closePublishDialog">
              <AssetIcon name="x" :size="18" />
            </button>
          </div>

          <div class="modal-form">
            <p v-if="publishError" class="form-error" role="alert">{{ publishError }}</p>

            <p class="form-notice">
              <AssetIcon name="info" :size="14" />
              <span>Donors see it in the portal and can book it, and the centre's donors are notified.</span>
            </p>

            <div class="modal-actions">
              <button type="button" class="ui-btn" @click="closePublishDialog">Not yet</button>
              <button type="button" class="ui-btn ui-btn--primary" :disabled="publishing" @click="confirmPublish">
                {{ publishing ? 'Publishing…' : 'Publish' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import SkeletonList from '~/components/ui/SkeletonList.vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import { ref, reactive, computed, onMounted } from 'vue'

import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import DatePicker from '~/components/common/DatePicker.vue'
import PageHeader from '~/components/ui/PageHeader.vue'
import CenterModal from '~/components/ui/CenterModal.vue'
import { formatShortDate } from '~/utils/donorRecords'
import {
  DRIVE_TABS,
  blankDriveForm,
  driveActions,
  driveFormFrom,
  drivePayload,
  driveStatusLabel,
  driveTab,
  drivesFor,
  registrationClosed,
} from '~/utils/drives'
import { onPageReturn } from '~/composables/useKeptAlive'

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  requires: 'drives.manage',
  keepalive: true,
})

const { can } = useUser()
const canRecordPaper = computed(() => can('donations.record_paper'))

const loading = ref(true)
const submitting = ref(false)
const showCreateModal = ref(false)
const loadError = ref('')
// A row action (registration open/close) that failed, shown above the list.
const actionError = ref('')
// The drive whose row action is in flight.
const busyId = ref(null)

// Ang mga key dinhi kay pareho gyud sa mga column sa `mobile_events`, dili ang
// UI labels ('venue', 'capacity'). Usa ra ka vocabulary sa tibuok wire, so
// walay translation layer nga pwede mag-drift sa server.
const driveForm = reactive(blankDriveForm())

const formError = ref('')

const todayIso = computed(() => new Date().toISOString().slice(0, 10))

function resetDriveForm() {
  Object.assign(driveForm, blankDriveForm())
  formError.value = ''
}

// The drive being edited, or null when the modal creates one.
const editingDrive = ref(null)

// Naay naka-book: ang petsa ug oras dili na mausab (server: drive_schedule_locked).
const scheduleLocked = computed(() => Boolean(editingDrive.value) && driveActions(editingDrive.value).scheduleLocked)

const submitLabel = computed(() => {
  if (editingDrive.value) return submitting.value ? 'Saving…' : 'Save changes'
  if (submitting.value) return 'Creating…'
  return driveForm.publish ? 'Create and publish' : 'Save as draft'
})

function openCreateModal() {
  editingDrive.value = null
  resetDriveForm()
  showCreateModal.value = true
}

/** The same form, filled with the drive's current values. */
function openEditModal(drive) {
  editingDrive.value = drive
  formError.value = ''
  Object.assign(driveForm, driveFormFrom(drive))
  showCreateModal.value = true
}

function closeCreateModal() {
  showCreateModal.value = false
  editingDrive.value = null
  resetDriveForm()
}

async function handleCreateDrive() {
  if (!driveForm.event_date) {
    formError.value = 'Choose the date of the drive.'
    return
  }

  submitting.value = true
  formError.value = ''
  try {
    // Ang facility_id ug created_by kay gikan sa token, dili sa payload.
    if (editingDrive.value) {
      await bloodCenterService.updateDrive(editingDrive.value.id, drivePayload(driveForm, false))
    } else {
      await bloodCenterService.createDrive(drivePayload(driveForm, true))
      view.value = 'upcoming'
    }
    closeCreateModal()
    // Reload, so the headline figures follow the change too.
    await loadDrives()
  } catch (err) {
    // Ang BaseService nagbutang sa message sa server sa `err.message` ug sa
    // per-field nga 422 sa `err.errors`. Ipakita gyud — kaniadto console ra ni,
    // mao nga ang "Save Changes" morag walay gibuhat.
    formError.value = firstFieldError(err) || err?.message || 'Could not save this drive. Please try again.'
  } finally {
    submitting.value = false
  }
}

// Cancel dialog
const cancelTarget = ref(null)
const cancelReason = ref('')
const cancelError = ref('')
const cancelling = ref(false)

function openCancelDialog(drive) {
  cancelTarget.value = drive
  cancelReason.value = ''
  cancelError.value = ''
}

function closeCancelDialog() {
  if (cancelling.value) return
  cancelTarget.value = null
  cancelReason.value = ''
  cancelError.value = ''
}

async function confirmCancel() {
  if (!cancelTarget.value || !cancelReason.value.trim()) return
  cancelling.value = true
  cancelError.value = ''
  try {
    await bloodCenterService.cancelDrive(cancelTarget.value.id, cancelReason.value.trim())
    cancelling.value = false
    closeCancelDialog()
    await loadDrives()
  } catch (err) {
    // E.g. 409 drive_in_progress: someone is already checked in at the drive.
    cancelError.value = firstFieldError(err) || err?.message || 'Could not cancel this drive. Please try again.'
  } finally {
    cancelling.value = false
  }
}

// Publish dialog: publishing tells the centre's donors, so it is asked first.
const publishTarget = ref(null)
const publishError = ref('')
const publishing = ref(false)

function openPublishDialog(drive) {
  publishTarget.value = drive
  publishError.value = ''
}

function closePublishDialog() {
  if (publishing.value) return
  publishTarget.value = null
  publishError.value = ''
}

async function confirmPublish() {
  if (!publishTarget.value) return
  publishing.value = true
  publishError.value = ''
  try {
    await bloodCenterService.publishDrive(publishTarget.value.id)
    publishing.value = false
    closePublishDialog()
    await loadDrives()
  } catch (err) {
    publishError.value = err?.message || 'Could not publish this drive. Please try again.'
  } finally {
    publishing.value = false
  }
}

/** Close or reopen registration. The bookings already held stand either way. */
async function setRegistration(drive, open) {
  busyId.value = drive.id
  actionError.value = ''
  try {
    await bloodCenterService.setDriveRegistration(drive.id, open)
    await loadDrives()
  } catch (err) {
    actionError.value = err?.message || 'Could not change registration for this drive. Please try again.'
  } finally {
    busyId.value = null
  }
}

// Ang una nga field error mao ang labing tino nga rason sa 422; ang top-level
// nga message sa Laravel kay generic ra ("The given data was invalid.").
function firstFieldError(err) {
  const errors = err?.errors
  if (!errors) return ''
  const first = Object.values(errors)[0]
  return Array.isArray(first) ? first[0] : first
}

/** "1 donor is" / "3 donors are", for the booked count. */
function bookedLabel(count) {
  const n = count ?? 0
  return n === 1 ? '1 donor is' : `${n} donors are`
}

// All values start empty/zero — populated only from the API response.
const upcomingDrivesCount = ref(0)
const totalRegistered = ref(0)
const unitsCollectedMonth = ref(0)
// Bags drawn at drives per month ("YYYY-MM" => count), or null from an older server.
const unitsByMonth = ref(null)
const drives = ref([])
// drive shape: {
//   id, name, facility_name, location, event_date, start_time, end_time,
//   capacity (hard limit, null = none), expected_participants (estimate),
//   registered_count (active bookings), assigned_staff, announcement,
//   status: 'Draft' | 'Upcoming' | 'Open' | 'Full' | 'Completed' | 'Cancelled',
//   published_at, registration_open, registration_closed_at,
//   cancelled_at, cancellation_reason,
//   donor_preview: []   // always empty for now: no endpoint lists a drive's donors
// }

/* ---------- display: which drives, and how each reads ---------- */

const view = ref('upcoming')

const EMPTY_TAB = {
  upcoming: { title: 'No upcoming drives', text: 'Create one to open registrations for donors.' },
  completed: { title: 'No completed drives', text: 'Drives move here once their date has passed.' },
  cancelled: { title: 'No cancelled drives', text: 'Cancelled drives are kept here.' },
  all: { title: 'No drives', text: '' },
}

function countFor(value) {
  if (value === 'all') return drives.value.length
  return drives.value.filter((d) => driveTab(d) === value).length
}

const search = ref('')

// The tab's drives, narrowed by the search (name, venue or staff).
const visibleDrives = computed(() => {
  const term = search.value.trim().toLowerCase()
  // A picked day lists every drive on it, whatever its state.
  const list = selectedDate.value
    ? drives.value.filter((d) => String(d.event_date).slice(0, 10) === selectedDate.value)
    : drivesFor(drives.value, view.value)
  if (!term) return list
  return list.filter((d) => [d.name, d.location, d.assigned_staff].some((v) => String(v ?? '').toLowerCase().includes(term)))
})

/** The drive whose record is open. */
const detail = ref(null)

function editFromDetail() {
  const drive = detail.value
  detail.value = null
  openEditModal(drive)
}

function publishFromDetail() {
  const drive = detail.value
  detail.value = null
  openPublishDialog(drive)
}

/** The most recent drive held, for the empty Upcoming tab. */
const lastDrive = computed(() => drivesFor(drives.value, 'completed')[0] ?? null)

/** "1 donor booked" / "3 donors booked". */
function bookedCount(count) {
  const n = count ?? 0
  return `${n} donor${n === 1 ? '' : 's'} booked`
}

/* ---------- the month strip ---------- */

// The first of the month on show, as "YYYY-MM".
const monthCursor = ref(todayIso.value.slice(0, 7))
// A day picked on the strip ("YYYY-MM-DD"), or '' for the tabs' lists.
const selectedDate = ref('')

const onThisMonth = computed(() => monthCursor.value === todayIso.value.slice(0, 7))

const monthLabel = computed(() =>
  new Date(`${monthCursor.value}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
)

function shiftMonth(step) {
  const [y, m] = monthCursor.value.split('-').map(Number)
  const d = new Date(y, m - 1 + step, 1)
  monthCursor.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function goThisMonth() {
  monthCursor.value = todayIso.value.slice(0, 7)
}

// Every day of the month with the drives held (or planned) on it.
const monthDays = computed(() => {
  const [y, m] = monthCursor.value.split('-').map(Number)
  const count = new Date(y, m, 0).getDate()
  const byDate = {}
  for (const d of drives.value) (byDate[String(d.event_date).slice(0, 10)] ??= []).push(d)
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(y, m - 1, i + 1)
    const iso = `${monthCursor.value}-${String(i + 1).padStart(2, '0')}`
    return {
      iso,
      n: i + 1,
      wd: date.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2),
      weekend: date.getDay() === 0 || date.getDay() === 6,
      drives: byDate[iso] ?? [],
    }
  })
})

const monthOnly = computed(() => new Date(`${monthCursor.value}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'long' }))

// The month on show: its drives (a cancelled one is not a drive held), the
// donors booked on them, and the bags drawn at drives that month. An older
// server sends this month's units only, so other months then leave units out.
const monthFigures = computed(() => {
  const inMonth = drives.value.filter((d) => String(d.event_date).slice(0, 7) === monthCursor.value && d.status !== 'Cancelled')
  let units = null
  if (unitsByMonth.value) units = unitsByMonth.value[monthCursor.value] ?? 0
  else if (onThisMonth.value) units = unitsCollectedMonth.value
  return {
    drives: inMonth.length,
    booked: inMonth.reduce((sum, d) => sum + (d.registered_count ?? 0), 0),
    units,
  }
})

const monthHasDrives = computed(() => monthDays.value.some((day) => day.drives.length))

// With none on show, the closest month that has drives: the next one ahead
// first, else the latest before.
const nearestMonth = computed(() => {
  const counts = {}
  for (const d of drives.value) {
    const key = String(d.event_date).slice(0, 7)
    counts[key] = (counts[key] ?? 0) + 1
  }
  const keys = Object.keys(counts).sort()
  const key = keys.find((k) => k > monthCursor.value) ?? [...keys].reverse().find((k) => k < monthCursor.value)
  if (!key) return null
  const label = new Date(`${key}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  return { key, label, count: counts[key] }
})

/** The dot's colour: held, still ahead, a draft, or cancelled. */
function calTone(drive) {
  if (drive.status === 'Cancelled') return 'cancelled'
  if (drive.status === 'Completed') return 'held'
  if (drive.status === 'Draft') return 'draft'
  return 'ahead'
}

function pickDate(iso) {
  selectedDate.value = selectedDate.value === iso ? '' : iso
}

/** "Tue, 10 Nov 2026". */
function shortDay(iso) {
  const d = new Date(`${iso}T00:00:00`)
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

function dayLabel(day) {
  const n = day.drives.length
  return `${longDate(day.iso)}: ${n ? `${n} drive${n === 1 ? '' : 's'}` : 'no drives'}`
}

/** "Tuesday, 10 November 2026". */
function longDate(value) {
  const d = new Date(`${String(value).slice(0, 10)}T00:00:00`)
  if (Number.isNaN(d.getTime())) return String(value ?? '')
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

/** Whole days from today: "Today", "In 4 days", "26 days ago". */
function daysAway(value) {
  const day = new Date(`${String(value).slice(0, 10)}T00:00:00`)
  const today = new Date(`${todayIso.value}T00:00:00`)
  const n = Math.round((day - today) / 86400000)
  if (Number.isNaN(n)) return ''
  if (n === 0) return 'Today'
  if (n === 1) return 'Tomorrow'
  if (n === -1) return 'Yesterday'
  return n > 0 ? `In ${n} days` : `${-n} days ago`
}

function registrationState(drive) {
  if (drive.status === 'Draft') return 'Not open: the drive is a draft'
  if (drive.status === 'Cancelled') return 'Closed with the drive'
  if (drive.status === 'Completed') return 'Ended with the drive'
  if (drive.status === 'Full') return 'Full: no places left'
  return drive.registration_open ? 'Open to donors' : 'Closed to new bookings'
}

/**
 * The drive's life so far, from what the record holds: published (or still a
 * draft), registration closed, then held, cancelled or still ahead.
 */
function driveSteps(drive) {
  const steps = [
    drive.published_at
      ? { key: 'published', state: 'done', label: 'Published to donors', detail: formatShortDate(drive.published_at) }
      : { key: 'published', state: drive.status === 'Cancelled' ? 'skipped' : 'pending', label: 'Draft: not published yet', detail: 'Donors cannot see or book it.' },
  ]
  if (drive.registration_closed_at && drive.status !== 'Cancelled') {
    steps.push({ key: 'closed', state: 'done', label: 'Registration closed', detail: `${formatShortDate(drive.registration_closed_at)}. Bookings already held stand.` })
  }
  if (drive.status === 'Cancelled') {
    steps.push({ key: 'end', state: 'stop', label: 'Cancelled', detail: drive.cancelled_at ? formatShortDate(drive.cancelled_at) : '' })
  } else if (drive.status === 'Completed') {
    steps.push({ key: 'end', state: 'done', label: 'Drive held', detail: `${formatShortDate(drive.event_date)} · ${bookedCount(drive.registered_count)}` })
  } else {
    steps.push({ key: 'end', state: 'pending', label: drive.status === 'Open' ? 'Running today' : 'Drive day', detail: `${formatShortDate(drive.event_date)} · ${daysAway(drive.event_date)}` })
  }
  return steps
}




function dateParts(value) {
  const d = new Date(`${String(value).slice(0, 10)}T00:00:00`)
  if (Number.isNaN(d.getTime())) return { month: '', day: '—', weekday: '' }
  return {
    month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    day: d.getDate(),
    weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
  }
}

// Ang TIME nga column mo-balik ug 'HH:MM:SS'. "13:30:00" -> "1:30 PM"
function timeLabel(value) {
  const [h, m] = String(value).split(':').map(Number)
  if (Number.isNaN(h)) return String(value)
  return `${h % 12 || 12}:${String(m || 0).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

// The dot's colour: today's drive green, a full one red, a draft or past one grey.
const STATUS_TONES = { Draft: 'neutral', Upcoming: 'info', Open: 'ok', Full: 'crit', Completed: 'neutral', Cancelled: 'crit' }

function statusTone(drive) {
  return STATUS_TONES[drive.status] ?? 'neutral'
}

function fillPercent(drive) {
  if (!drive.capacity) return 0
  return Math.round(((drive.registered_count ?? 0) / drive.capacity) * 100)
}

// The same three levels as the appointment slots: open, filling up, full.
function fillLevel(drive) {
  const pct = fillPercent(drive)
  if (pct >= 100) return 'full'
  if (pct >= 75) return 'busy'
  return 'open'
}

async function loadDrives() {
  loadError.value = ''
  try {
    // GET /api/blood-center/drives — facility-scoped, apil ang mga nahuman ug na-cancel.
    // { upcoming_drives_count, total_registered, units_collected_month (drives only), drives: [...] }
    const data = await bloodCenterService.drives()
    upcomingDrivesCount.value = data.upcoming_drives_count ?? 0
    totalRegistered.value = data.total_registered ?? 0
    unitsCollectedMonth.value = data.units_collected_month ?? 0
    // PHP sends an empty map as []; no key at all means an older server.
    const byMonth = data.units_collected_by_month
    unitsByMonth.value = byMonth == null ? null : (Array.isArray(byMonth) ? {} : byMonth)
    drives.value = data.drives ?? []
  } catch (err) {
    // Ipakita ang kapakyasan imbes mo-render ug empty state: managlahi ang
    // "walay drive pa" ug "wala ma-load ang mga drive".
    loadError.value = err?.message || 'Could not load mobile drives. Please try again.'
    drives.value = []
  } finally {
    loading.value = false
  }
}

onMounted(loadDrives)
// Kept alive: back here, the drives reload in place (`loading` covers the first visit only).
onPageReturn(loadDrives)
</script>

<style scoped>
.drives-page {
  font-family: var(--rb-font-sans);
  color: var(--rb-text-primary);
  max-width: var(--rb-content-max, 1600px);
  background: var(--rb-page-bg);
  margin: 0 auto;
  padding: 24px var(--rb-gutter, 24px) 40px;
}

.drives-inner {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* ---------- Skeletons (the same page skeleton as Inventory) ---------- */
.skeleton {
  background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 37%, var(--rb-skeleton-a) 63%);
  background-size: 400% 100%;
  border-radius: 14px;
  animation: shimmer 1.4s ease infinite;
}

.skeleton-head { display: flex; flex-direction: column; gap: 8px; }
.skeleton--header { height: 28px; max-width: 220px; border-radius: 8px; }
.skeleton--sub { height: 14px; max-width: 320px; border-radius: 6px; }
.skeleton--card { height: 108px; }

@keyframes shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}

/* ---------- Header ---------- */
.header-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.page-title { font-size: 20px; font-weight: 700; letter-spacing: -0.02em; color: var(--rb-text-primary); margin: 0; }
.page-subtitle { font-size: 13px; color: var(--rb-text-secondary); margin: 3px 0 0; }

/* ---------- Buttons (as on Inventory) ---------- */
.btn-primary,
.btn-outline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  height: 38px;
  padding: 0 16px;
  border-radius: 10px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.2;
  white-space: nowrap;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s ease, border-color 0.15s ease, opacity 0.15s ease;
}

.btn-primary {
  color: #fff;
  background: var(--rb-primary);
  border: none;
  box-shadow: 0 1px 2px rgba(var(--rb-shadow-rgb), 0.06);
}

.btn-primary:hover:not(:disabled) { background: color-mix(in srgb, var(--rb-primary) 88%, #000); }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

.btn-outline {
  color: var(--rb-text-primary);
  background: var(--rb-surface);
  border: 1px solid var(--rb-border-strong);
}

.btn-outline:hover { background: var(--rb-surface-hover); border-color: var(--rb-border-hover); }


.btn-danger {
  display: inline-flex;
  align-items: center;
  height: 38px;
  padding: 0 16px;
  border-radius: 10px;
  border: none;
  background: var(--rb-accent);
  color: #fff;
  font-family: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.btn-danger:disabled { opacity: 0.5; cursor: not-allowed; }


.btn-primary:focus-visible,
.btn-outline:focus-visible,
.btn-danger:focus-visible,
.seg__btn:focus-visible {
  outline: none;
  box-shadow: var(--rb-focus-ring);
}

/* ---------- KPI cards (as on Inventory) ---------- */
.stats-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.stat-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  background: var(--rb-surface);
  border: 1px solid var(--rb-border);
  border-radius: 14px;
  box-shadow: 0 1px 2px rgba(var(--rb-shadow-rgb), 0.03);
}

.stat-card__top { display: flex; align-items: center; justify-content: space-between; }
.stat-card__label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--rb-text-secondary); margin: 0; }
.stat-card__badge { width: 26px; height: 26px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.stat-card__badge--primary { background: rgba(var(--rb-primary-rgb), 0.08); color: var(--rb-primary-text); }
.stat-card__badge--purple { background: rgba(var(--rb-purple-rgb), 0.08); color: var(--rb-purple-text); }
.stat-card__badge--success { background: rgba(var(--rb-success-rgb), 0.08); color: var(--rb-success-text); }
.stat-card__value { font-size: 24px; font-weight: 800; color: var(--rb-text-primary); margin: 0; line-height: 1; font-variant-numeric: tabular-nums; }
.stat-chip { display: inline-flex; align-items: center; align-self: flex-start; font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 999px; background: var(--rb-surface-alt); color: var(--rb-text-secondary); }

/* ---------- Panel ---------- */
.panel {
  background: var(--rb-surface);
  border: 1px solid var(--rb-border);
  border-radius: 14px;
  box-shadow: 0 1px 2px rgba(var(--rb-shadow-rgb), 0.03);
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px;
  border-bottom: 1px solid var(--rb-border);
}

.panel-title { font-weight: 700; font-size: 14px; color: var(--rb-text-primary); margin: 0; }

/* Segmented view switch */
.seg {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  border-radius: 10px;
  background: var(--rb-surface-alt);
  border: 1px solid var(--rb-border);
}

.seg__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 12px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--rb-text-secondary);
  cursor: pointer;
}

.seg__btn:hover { color: var(--rb-text-primary); }

.seg__btn--on {
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  box-shadow: 0 1px 2px rgba(var(--rb-shadow-rgb), 0.08);
}

.seg__count {
  min-width: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--rb-border);
  font-size: 11px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.seg__btn--on .seg__count { background: rgba(var(--rb-primary-rgb), 0.1); color: var(--rb-primary-text); }

/* ---------- Drive rows ---------- */
.drive-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.drive {
  display: grid;
  grid-template-columns: 60px minmax(0, 1fr) 210px 340px;
  align-items: center;
  gap: 20px;
  padding: 16px 18px;
  transition: background 0.15s ease;
}

.drive + .drive { border-top: 1px solid var(--rb-border); }
.drive:hover { background: rgba(var(--rb-primary-rgb), 0.04); }

.drive__date {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 60px;
  height: 64px;
  border: 1px solid var(--rb-border);
  border-radius: 12px;
  background: var(--rb-surface-alt);
}

.drive__month {
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--rb-primary-text);
}

.drive__day {
  margin: 1px 0;
  font-size: 21px;
  font-weight: 800;
  line-height: 1;
  color: var(--rb-text-primary);
  font-variant-numeric: tabular-nums;
}

.drive__weekday {
  font-size: 10.5px;
  font-weight: 600;
  color: var(--rb-text-secondary);
}

/* Today's drive is the one to act on. */
.drive--today .drive__date { border-color: var(--rb-primary); background: var(--rb-primary); }
.drive--today .drive__month,
.drive--today .drive__day,
.drive--today .drive__weekday { color: #fff; }
.drive--done .drive__month { color: var(--rb-text-muted); }
.drive--done .drive__title,
.drive--done .drive__day { color: var(--rb-text-secondary); }

.drive__body { min-width: 0; }

.drive__title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.drive__title {
  margin: 0;
  font-size: 14.5px;
  font-weight: 700;
  color: var(--rb-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.drive__facts {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  margin: 6px 0 0;
  min-width: 0;
}

.drive__fact {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  font-size: 12.5px;
  color: var(--rb-text-secondary);
}
.drive__fact :deep(.asset-icon) { flex-shrink: 0; color: var(--rb-text-muted); }

.drive__note {
  margin: 8px 0 0;
  padding: 6px 10px;
  border-radius: 8px;
  background: var(--rb-surface-alt);
  font-size: 12.5px;
  line-height: 1.45;
  color: var(--rb-text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Status: the colour lives on the dot, never on the badge's fill. */
.badge {
  --tone: var(--rb-text-muted);
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 6px;
  padding: 2px 9px;
  border-radius: 999px;
  border: 1px solid var(--rb-border);
  background: var(--rb-surface);
  font-size: 11.5px;
  font-weight: 600;
  line-height: 1.5;
  color: var(--rb-text-primary);
  white-space: nowrap;
}
.badge__dot { width: 6px; height: 6px; border-radius: 999px; background: var(--tone); flex-shrink: 0; }
.badge--info { --tone: var(--rb-primary); }
.badge--ok { --tone: var(--rb-success); }
.badge--warn { --tone: var(--rb-warning); }
.badge--crit { --tone: var(--rb-accent); }
.badge--neutral { --tone: var(--rb-text-muted); color: var(--rb-text-secondary); }

/* Registrations */
.drive__fill-head {
  display: flex;
  align-items: baseline;
  gap: 5px;
  margin: 0 0 6px;
  font-size: 12px;
  color: var(--rb-text-secondary);
}

.drive__fill-head strong {
  font-size: 16px;
  font-weight: 800;
  color: var(--rb-text-primary);
  font-variant-numeric: tabular-nums;
}

.progress-track {
  height: 5px;
  border-radius: 999px;
  background: var(--rb-border-strong);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.4s ease;
}

.progress-fill--open { background: var(--rb-success); }
.progress-fill--busy { background: var(--rb-warning); }
.progress-fill--full { background: var(--rb-accent); }

.drive__fill-foot {
  margin: 5px 0 0;
  font-size: 11.5px;
  color: var(--rb-text-secondary);
  font-variant-numeric: tabular-nums;
}

.drive__actions {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
}
.drive__actions .ui-btn { flex-shrink: 0; white-space: nowrap; }

.drive__note--cancelled {
  background: rgba(var(--rb-accent-rgb), 0.06);
  color: var(--rb-accent-text);
}

.list-error { margin: 12px 18px 0; }

/* ---------- Empty states ---------- */
.empty-state {
  padding: 48px 24px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.empty-state__icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  margin-bottom: 6px;
  border-radius: 12px;
  background: var(--rb-surface-alt);
  border: 1px solid var(--rb-border);
  color: var(--rb-text-secondary);
}

.empty-state__icon--error { color: var(--rb-accent-text); }
.empty-state__title { margin: 0; font-size: 14px; font-weight: 700; color: var(--rb-text-primary); }
.empty-state__text { margin: 0 0 8px; max-width: 44ch; font-size: 13px; line-height: 1.5; color: var(--rb-text-secondary); }

/* ---------- Modal ---------- */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--rb-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 100;
}

.modal-card {
  background: var(--rb-surface);
  border-radius: 16px;
  width: 100%;
  max-width: 520px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 8px 28px rgba(var(--rb-shadow-rgb), 0.28);
}

.modal-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 20px;
  border-bottom: 1px solid var(--rb-border);
}

.modal-card__title { font-size: 16px; font-weight: 700; color: var(--rb-text-primary); margin: 0; }
.modal-card__subtitle { margin: 3px 0 0; font-size: 12.5px; color: var(--rb-text-secondary); }

.modal-card__close {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--rb-text-secondary);
  padding: 4px;
  display: flex;
  border-radius: 8px;
}

.modal-card__close:hover { color: var(--rb-text-primary); background: var(--rb-surface-hover); }

.modal-form {
  padding: 18px 20px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--rb-text-primary);
}

/* A calm note (what publishing does), not an error. */
.form-notice {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--rb-border);
  background: var(--rb-surface-alt);
  font-size: 12.5px;
  line-height: 1.45;
  color: var(--rb-text-secondary);
}

.form-notice :deep(svg) { flex-shrink: 0; margin-top: 1px; }

.cancel-impact {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px;
  border-radius: 10px;
  border: 1px solid rgba(var(--rb-accent-rgb), 0.25);
  background: rgba(var(--rb-accent-rgb), 0.05);
  color: var(--rb-accent-text);
}

.cancel-impact p {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--rb-text-primary);
}

.cancel-impact :deep(svg) { flex-shrink: 0; margin-top: 2px; }

.modal-card--narrow { max-width: 440px; }

.form-optional { margin-left: 4px; font-weight: 500; color: var(--rb-text-secondary); }

.form-error {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid rgba(var(--rb-accent-rgb), 0.35);
  border-radius: 8px;
  background: rgba(var(--rb-accent-rgb), 0.08);
  color: var(--rb-accent-text);
  font-size: 13px;
  line-height: 1.45;
}

/*
 * Anchored on the page root on purpose. Several other portals ship
 * `:global(.dark .form-input) { … }` — an unscoped rule at (0,2,0) that ties
 * with a plain scoped `.form-input[data-v-...]`, so which one won came down to
 * chunk load order. The page-root ancestor takes these to (0,3,0) and settles
 * it, without this page having to hardcode a dark palette of its own.
 */
.drives-page .form-input,
.drives-page .form-textarea {
  width: 100%;
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  padding: 9px 12px;
  font-size: 13px;
  color: var(--rb-text-primary);
  background: var(--rb-surface);
  font-family: inherit;
  transition: border-color 0.15s ease;
}

.drives-page .form-input:focus,
.drives-page .form-textarea:focus {
  outline: none;
  border-color: var(--rb-primary);
  box-shadow: var(--rb-focus-ring);
}

.drives-page .form-input::placeholder,
.drives-page .form-textarea::placeholder {
  color: var(--rb-placeholder);
}

.drives-page .form-textarea {
  resize: vertical;
  min-height: 72px;
}

.drives-page .form-input:disabled {
  background: var(--rb-surface-alt);
  color: var(--rb-text-secondary);
  cursor: not-allowed;
}

.form-check {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--rb-text-primary);
  cursor: pointer;
}

.form-check input { width: 16px; height: 16px; accent-color: var(--rb-primary); }

.modal-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 4px;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none !important; }
}
.drives-skeleton { padding: 16px 20px; }

/* ---------- Dialog shell, as the system's CenterModal draws it ---------- */
.modal-overlay { background: rgba(15, 23, 42, 0.5); }
.modal-card { border-radius: 18px; box-shadow: 0 28px 70px -24px rgba(15, 23, 42, 0.55); }
.modal-card__header { align-items: center; padding: 18px 24px 16px; }
.modal-card__title { font-size: 20px; font-weight: 800; letter-spacing: -0.01em; }
.modal-card__subtitle { margin-top: 4px; font-size: 13px; }
.modal-card__close {
  display: grid; flex-shrink: 0; place-items: center; width: 36px; height: 36px; padding: 0;
  border: 1px solid var(--rb-border-strong); border-radius: 10px;
  background: var(--rb-surface); color: var(--rb-text-secondary);
}
.modal-card__close:hover { color: var(--rb-text-primary); background: var(--rb-surface-hover); }
.modal-form { padding: 20px 24px 24px; }

.icon-btn {
  display: grid; flex-shrink: 0; place-items: center; width: 30px; height: 30px; padding: 0; border-radius: 8px;
  border: 1px solid var(--rb-border-strong); background: var(--rb-surface); color: var(--rb-text-secondary);
  cursor: pointer; transition: background 0.12s ease, color 0.12s ease, border-color 0.12s ease;
}
.icon-btn:hover:not(:disabled) { color: var(--rb-primary-text); border-color: rgba(var(--rb-primary-rgb), 0.45); background: var(--rb-surface-hover); }
.icon-btn:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }
.icon-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.icon-btn--danger:hover:not(:disabled) { color: var(--rb-accent-text); border-color: rgba(var(--rb-accent-rgb), 0.45); background: rgba(var(--rb-accent-rgb), 0.06); }

/* ---------- Panel header: title with its search ---------- */
.panel-header__lead { display: flex; align-items: center; gap: 16px; min-width: 0; flex: 1 1 auto; }
.search { position: relative; flex: 0 1 300px; min-width: 180px; }
.search__icon { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--rb-text-muted); pointer-events: none; }
.search__input {
  width: 100%; height: 36px; padding: 0 12px 0 34px; border: 1px solid var(--rb-border-strong); border-radius: 10px;
  background: var(--rb-surface); font-family: inherit; font-size: 13px; color: var(--rb-text-primary);
}
.search__input::placeholder { color: var(--rb-placeholder); }
.search__input:focus { outline: none; border-color: var(--rb-primary); box-shadow: var(--rb-focus-ring); }

/* ---------- Empty tab ---------- */
.empty-state__last { margin: 6px 0 0; font-size: 12.5px; color: var(--rb-text-secondary); }
.empty-state__last strong { color: var(--rb-text-primary); font-weight: 600; }
.empty-state__actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-top: 12px; }

/* ---------- Rows open the record ---------- */
.drive { cursor: pointer; }
.drive:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: -2px; }

/* ---------- Drive record ---------- */
.dd { display: flex; flex-direction: column; gap: 18px; }
.dd-when { display: flex; align-items: center; gap: 14px; padding: 14px; border: 1px solid var(--rb-border); border-radius: 12px; background: var(--rb-surface-alt); }
.dd-when .drive__date { background: var(--rb-surface); }
.dd-when.drive--today .drive__date { background: var(--rb-primary); }
.dd-when__text { min-width: 0; }
.dd-when__date { margin: 0; font-size: 16px; font-weight: 700; }
.dd-when__sub { margin: 3px 0 0; font-size: 12.5px; color: var(--rb-text-secondary); }
.dd-section__title { margin: 0 0 8px; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--rb-text-secondary); }
.dd-note { margin: 0; padding: 12px 14px; border-radius: 10px; background: var(--rb-surface-alt); font-size: 13px; line-height: 1.55; white-space: pre-line; overflow-wrap: anywhere; }
.dd-note--cancelled { background: rgba(var(--rb-accent-rgb), 0.06); color: var(--rb-accent-text); }
.facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 18px; margin: 0; padding-top: 16px; border-top: 1px solid var(--rb-border); }
.fact { min-width: 0; }
.fact--full { grid-column: 1 / -1; }
.fact dt { margin: 0 0 3px; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--rb-text-secondary); }
.fact dd { margin: 0; font-size: 13px; font-weight: 600; overflow-wrap: anywhere; }
.fact__sub { display: block; font-size: 11.5px; font-weight: 500; color: var(--rb-text-secondary); }

/* The drive's history as a short line of steps, as on Donations. */
.timeline { margin: 0; padding: 0; list-style: none; }
.tl { position: relative; display: flex; gap: 12px; padding-bottom: 14px; }
.tl:last-child { padding-bottom: 0; }
.tl:not(:last-child)::before { content: ''; position: absolute; left: 10px; top: 24px; bottom: 2px; width: 2px; border-radius: 2px; background: var(--rb-border); }
.tl__dot {
  position: relative; display: grid; flex-shrink: 0; place-items: center; width: 22px; height: 22px; border-radius: 50%;
  border: 2px solid var(--rb-border-strong); background: var(--rb-surface); color: #fff;
}
.tl--done .tl__dot { border-color: var(--rb-success); background: var(--rb-success); }
.tl--stop .tl__dot { border-color: var(--rb-accent); background: var(--rb-accent); }
.tl--pending .tl__dot { border-style: dashed; }
.tl--skipped { opacity: 0.6; }
.tl__body { min-width: 0; padding-top: 1px; }
.tl__label { margin: 0; font-size: 13.5px; font-weight: 700; }
.tl--pending .tl__label, .tl--skipped .tl__label { color: var(--rb-text-secondary); }
.tl__detail { margin: 2px 0 0; font-size: 12.5px; color: var(--rb-text-secondary); overflow-wrap: anywhere; }

/* ---------- The month strip ---------- */
.cal {
  border: 1px solid var(--rb-border);
  border-radius: 16px;
  background: var(--rb-surface);
  box-shadow: 0 1px 2px rgba(var(--rb-shadow-rgb), 0.03);
}
.cal__head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px 20px; padding: 14px 18px 10px; }
.cal__nav { display: flex; align-items: center; gap: 8px; }
.cal__title { min-width: 150px; margin: 0; font-size: 15px; font-weight: 700; text-align: center; }
.cal__figs { display: flex; flex-wrap: wrap; gap: 4px 18px; margin: 0; font-size: 12.5px; color: var(--rb-text-secondary); }
.cal__figs strong { margin-right: 3px; font-size: 14px; font-weight: 800; color: var(--rb-text-primary); font-variant-numeric: tabular-nums; }

.cal__strip { display: grid; grid-auto-columns: minmax(30px, 1fr); grid-auto-flow: column; gap: 4px; padding: 4px 14px 10px; overflow-x: auto; }
.cal__day {
  display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 30px; padding: 6px 0 7px;
  border: 1px solid transparent; border-radius: 10px; background: none; font: inherit; color: var(--rb-text-primary);
  cursor: pointer; transition: background 0.12s ease, border-color 0.12s ease;
}
.cal__day:hover { background: rgba(var(--rb-primary-rgb), 0.06); }
.cal__day:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }
.cal__wd { font-size: 10px; font-weight: 600; letter-spacing: 0.02em; color: var(--rb-text-muted); }
.cal__day--weekend .cal__wd { color: var(--rb-accent-text); opacity: 0.75; }
.cal__num { font-size: 13.5px; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--rb-text-secondary); }
.cal__day--has .cal__num { font-weight: 800; color: var(--rb-text-primary); }
.cal__day--today { border-color: rgba(var(--rb-primary-rgb), 0.5); }
.cal__day--today .cal__num { color: var(--rb-primary-text); }
.cal__day--on, .cal__day--on:hover { border-color: var(--rb-primary); background: var(--rb-primary); }
.cal__day--on .cal__wd, .cal__day--on .cal__num { color: #fff; opacity: 1; }
.cal__dots { display: flex; gap: 2px; height: 6px; }
.cal__dot { display: inline-block; width: 6px; height: 6px; border-radius: 999px; }
.cal__dot--held { background: var(--rb-success); }
.cal__dot--ahead { background: var(--rb-primary); }
.cal__dot--draft { background: var(--rb-text-muted); }
.cal__dot--cancelled { background: var(--rb-accent); }
.cal__day--on .cal__dot { box-shadow: 0 0 0 1.5px #fff; }

.cal__legend { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 16px; padding: 10px 18px; border-top: 1px solid var(--rb-border); font-size: 11.5px; color: var(--rb-text-secondary); }
.cal__legend > span { display: inline-flex; align-items: center; gap: 6px; }
.cal__legend-hint { margin-left: auto; color: var(--rb-text-muted); }
.cal__jump { display: inline-flex; align-items: center; gap: 4px; padding: 0; border: 0; background: none; font: inherit; font-weight: 700; color: var(--rb-primary-text); cursor: pointer; }
.cal__jump:hover { text-decoration: underline; }
.cal__jump:focus-visible { outline: none; border-radius: 4px; box-shadow: var(--rb-focus-ring); }

/* The picked day, beside the search; its x shows every drive again. */
.date-chip {
  display: inline-flex; flex-shrink: 0; align-items: center; gap: 6px; height: 32px; padding: 0 10px; border-radius: 999px;
  border: 1px solid rgba(var(--rb-primary-rgb), 0.45); background: rgba(var(--rb-primary-rgb), 0.08);
  color: var(--rb-primary-text); font: inherit; font-size: 12.5px; font-weight: 700; cursor: pointer; white-space: nowrap;
}
.date-chip:hover { background: rgba(var(--rb-primary-rgb), 0.14); }
.date-chip:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }
</style>
