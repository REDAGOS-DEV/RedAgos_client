<template>
  <div class="requests-page">
    <div class="page-inner">
      <!-- Page header -->
      <PageHeader title="Patient Request" :subtitle="hospitalPageSubtitle('patientRequests', can)">
        <template #actions>
          <!-- A patient's need is raised here; restocking the shelf is the weekly request. -->
          <NuxtLink to="/hospital/receiving/weekly" class="ui-btn" title="To restock your blood bank, send your weekly request">
            <AssetIcon name="calendar-check" :size="15" />
            Weekly Request
          </NuxtLink>
          <button v-if="canCreate" type="button" class="ui-btn ui-btn--primary" @click="openNewRequest">
            <AssetIcon name="plus" :size="15" />
            New Request
          </button>
        </template>
      </PageHeader>

      <!-- Summary figures -->
      <StatStrip variant="panel">
        <StatItem :loading="loading" pressable :pressed="filters.status === CARD_STATUSES.pending" @click="toggleStatus(CARD_STATUSES.pending)" label="Pending" :value="animatedCounts.pending" icon="clock" tone="warning">
          <template #hint>
            Awaiting Blood Center review
            <span v-if="trends.pending.hasData" class="stat-trend" :class="trends.pending.up ? 'up' : 'down'">
              <AssetIcon :name="trends.pending.up ? 'trending-up' : 'trending-down'" :size="11" />
              {{ trends.pending.label }}
            </span>
          </template>
        </StatItem>
        <StatItem :loading="loading" pressable :pressed="filters.status === CARD_STATUSES.approved" @click="toggleStatus(CARD_STATUSES.approved)" label="Processing" :value="animatedCounts.approved" icon="check-circle" tone="success">
          <template #hint>
            Units tagged by the blood center
            <span v-if="trends.approved.hasData" class="stat-trend" :class="trends.approved.up ? 'up' : 'down'">
              <AssetIcon :name="trends.approved.up ? 'trending-up' : 'trending-down'" :size="11" />
              {{ trends.approved.label }}
            </span>
          </template>
        </StatItem>
        <StatItem :loading="loading" pressable :pressed="filters.status === CARD_STATUSES.ready" @click="toggleStatus(CARD_STATUSES.ready)" label="Partially fulfilled" :value="animatedCounts.ready" icon="package-check" tone="purple">
          <template #hint>
            Some units still to come
            <span v-if="trends.ready.hasData" class="stat-trend" :class="trends.ready.up ? 'up' : 'down'">
              <AssetIcon :name="trends.ready.up ? 'trending-up' : 'trending-down'" :size="11" />
              {{ trends.ready.label }}
            </span>
          </template>
        </StatItem>
        <StatItem :loading="loading" pressable :pressed="filters.status === CARD_STATUSES.completed" @click="toggleStatus(CARD_STATUSES.completed)" label="Fulfilled" :value="animatedCounts.completed" icon="clipboard-check" tone="primary">
          <template #hint>
            Every requested unit released
            <span v-if="trends.completed.hasData" class="stat-trend" :class="trends.completed.up ? 'up' : 'down'">
              <AssetIcon :name="trends.completed.up ? 'trending-up' : 'trending-down'" :size="11" />
              {{ trends.completed.label }}
            </span>
          </template>
        </StatItem>
      </StatStrip>

      <!-- Restocking the blood bank is not requested here: it is the weekly request. -->
      <!-- The list, as the centre's Donor Management draws it (project owner, 2026-10-30). -->
      <div v-if="loadError" class="banner banner--error" role="alert">
        <AssetIcon name="circle-alert" :size="16" />
        <p class="banner__text">Your requests could not be loaded.</p>
        <button type="button" class="btn-link" @click="refresh">Retry</button>
      </div>

      <section class="panel fade-in" style="--delay:100ms" aria-labelledby="requests-title">
        <h2 id="requests-title" class="sr-only">Your patient transfusion requests</h2>

        <div class="toolbar">
          <div class="toolbar__filters">
            <label class="search">
              <AssetIcon name="search" :size="15" class="search__icon" />
              <input
                v-model="searchQuery"
                type="search"
                class="search__input"
                placeholder="Search patient or reference"
                aria-label="Search requests by patient, reference number, blood type or component"
              >
            </label>
            <DateRangeFilter v-model:from="filters.dateFrom" v-model:to="filters.dateTo" aria-label="Requested between" />
            <SelectField v-model="filters.status" class="sel-filter" size="sm" aria-label="Filter by status"
              :options="[{ value: '', label: 'All statuses' }, ...Object.entries(statusMap).map(([k, v]) => ({ value: k, label: v.label }))]" />
            <SelectField v-model="filters.priority" class="sel-filter" size="sm" aria-label="Filter by priority"
              :options="[{ value: '', label: 'All priorities' }, ...Object.entries(priorityMap).map(([k, v]) => ({ value: k, label: v.label }))]" />
            <SelectField v-model="filters.component" class="sel-filter" size="sm" aria-label="Filter by component"
              :options="[{ value: '', label: 'All components' }, ...components.map((c) => ({ value: c, label: c }))]" />
          </div>

          <div class="toolbar__actions">
            <span v-if="updatedAt" class="updated" :title="`List loaded at ${updatedAtLabel}`">
              <AssetIcon name="clock" :size="13" />
              Updated {{ updatedAtLabel }}
            </span>

            <button
              type="button"
              class="btn-outline btn-outline--squeeze"
              :disabled="!filteredRequests.length"
              title="Export the listed requests (CSV)"
              @click="exportCsv"
            >
              <AssetIcon name="download" :size="14" />
              <span class="btn-text">Export</span>
            </button>

            <button
              type="button"
              class="btn-outline btn-outline--squeeze"
              :disabled="refreshing"
              aria-label="Refresh the list"
              :title="updatedAt ? `Refresh · updated ${updatedAtLabel}` : 'Refresh'"
              @click="refresh"
            >
              <AssetIcon name="refresh-cw" :size="14" :class="{ spin: refreshing }" />
              <span class="btn-text">Refresh</span>
            </button>

          </div>
        </div>

        <!-- What waits on this blood bank, one click away; only what has something. -->
        <div v-if="hasQuickFilters || hasActiveFilters" class="quick-filters">
          <span v-if="hasQuickFilters" class="quick-filters__label">Waiting on you</span>
          <button
            v-if="waitingCounts.receive"
            type="button"
            class="quick quick--action"
            :class="{ 'quick--on': filters.waiting === 'receive' }"
            :aria-pressed="filters.waiting === 'receive'"
            title="Show only requests with units dispatched to you and not yet received"
            @click="toggleWaiting('receive')"
          >
            <span class="quick__dot" aria-hidden="true" />
            Awaiting receipt
            <span class="quick__count">{{ waitingCounts.receive }}</span>
          </button>
          <button
            v-if="waitingCounts.allocate"
            type="button"
            class="quick"
            :class="{ 'quick--on': filters.waiting === 'allocate' }"
            :aria-pressed="filters.waiting === 'allocate'"
            @click="toggleWaiting('allocate')"
          >
            <AssetIcon name="building-2" :size="14" />
            Needs a facility
            <span class="quick__count">{{ waitingCounts.allocate }}</span>
          </button>
          <button
            v-if="waitingCounts.stat"
            type="button"
            class="quick quick--stat"
            :class="{ 'quick--on': filters.priority === 'emergency' }"
            :aria-pressed="filters.priority === 'emergency'"
            @click="filters.priority = filters.priority === 'emergency' ? '' : 'emergency'"
          >
            <AssetIcon name="triangle-alert" :size="14" />
            STAT, still open
            <span class="quick__count">{{ waitingCounts.stat }}</span>
          </button>
          <button v-if="hasActiveFilters" type="button" class="quick-clear" @click="resetFilters">
            <AssetIcon name="x" :size="13" />
            Clear filters
          </button>
        </div>

        <div class="table-wrap" :class="{ 'table-wrap--busy': refreshing && allRequests.length }">
          <table class="list-table req-table">
            <caption class="sr-only">Your patient transfusion requests, open STAT requests first, then newest first</caption>
            <thead>
              <tr>
                <th scope="col" class="c-ref">Reference</th>
                <th scope="col" class="c-patient">Patient</th>
                <th scope="col" class="c-need">Needed</th>
                <th scope="col" class="c-date">Requested</th>
                <th scope="col" class="c-progress">Progress</th>
                <th scope="col" class="c-actions" :style="{ width: `${actionsWidth}px` }">Actions</th>
              </tr>
            </thead>

            <tbody v-if="loading">
              <SkeletonRows :columns="6" :rows="6" />
            </tbody>

            <tbody v-else-if="!pageItems.length">
              <tr>
                <td colspan="6" class="empty-cell">
                  <div class="empty-state">
                    <span class="empty-state__icon"><AssetIcon :name="hasActiveFilters ? 'search-x' : 'droplets'" :size="20" /></span>
                    <p class="empty-state__title">{{ hasActiveFilters ? 'No requests match' : 'No blood requests yet' }}</p>
                    <p class="empty-state__text">
                      {{ hasActiveFilters
                        ? 'Try another reference, type or component, or clear the filters.'
                        : 'Requests you raise for your patients appear here, with what each blood center supplied.' }}
                    </p>
                    <button v-if="hasActiveFilters" type="button" class="btn-outline" @click="resetFilters">Clear filters</button>
                  </div>
                </td>
              </tr>
            </tbody>

            <tbody v-else>
              <tr v-for="req in pageItems" :key="req.id" class="list-row list-row--link" :class="{ 'list-row--stat': isOpenStat(req) }" @click="openDrawer(req)">
                <td>
                  <!-- One line: the number, then STAT. An open STAT also marks the row's edge. -->
                  <div class="cell">
                    <div class="ref">
                      <button type="button" class="code code-btn" :title="`Quick view of ${req.reference_number}`" @click="openDrawer(req)">{{ req.reference_number }}</button>
                      <span v-if="req.priority === 'emergency'" class="tag tag--stat">STAT</span>
                    </div>
                    <span v-if="req.needs_allocation" class="tag tag--alert" title="Some units have not been asked of any facility">{{ req.unallocated }} unallocated</span>
                  </div>
                </td>
                <td>
                  <div class="cell">
                    <span class="cell__main">{{ req.patient || 'Not recorded' }}</span>
                    <!-- How it came in, beside what it is for, instead of a tag under the reference. -->
                    <span v-if="req.purpose || req.is_walk_in" class="cell__sub">
                      {{ req.purpose }}<template v-if="req.purpose && req.is_walk_in"> · </template><span
                        v-if="req.is_walk_in"
                        title="Brought to the blood center by a watcher and confirmed by your blood bank by phone"
                      >Walk-in</span>
                    </span>
                  </div>
                </td>
                <td>
                  <div class="need">
                    <span v-if="req.blood_type" class="blood">{{ req.blood_type }}</span>
                    <span v-else class="muted">—</span>
                    <div class="cell">
                      <span class="cell__main">{{ req.component || '—' }}</span>
                      <span class="cell__sub">{{ req.units }} unit{{ req.units === 1 ? '' : 's' }}</span>
                    </div>
                  </div>
                </td>
                <td class="nowrap">{{ formatDate(req.request_date) }}</td>
                <td>
                  <!-- The step by name; the bar shows where it sits among the four. -->
                  <div class="progress" :aria-label="`Progress: ${progressLabel(req)}. ${rowProgress(req).text}`">
                    <span class="badge" :class="badgeClass(rowProgress(req).tone)" aria-hidden="true">
                      <span class="badge__dot" />
                      {{ rowProgress(req).text }}
                    </span>
                    <span class="progress__track">
                      <span class="progress__bar" aria-hidden="true">
                        <span
                          v-for="(step, i) in progressSteps"
                          :key="step"
                          class="progress__step"
                          :title="`${step}${rowStepIndex(req) > i ? ' — done' : rowStepIndex(req) === i ? ' — now' : ''}`"
                          :class="{
                            'progress__step--done': rowStepIndex(req) > i,
                            'progress__step--current': rowStepIndex(req) === i && !isHalted(req.status),
                            'progress__step--action': rowStepIndex(req) === i && req.awaiting_receipt > 0,
                            'progress__step--halted': isHalted(req.status)
                          }"
                        />
                      </span>
                      <!-- How long it has sat at this step, so a stuck request shows. -->
                      <time
                        v-if="rowStepTime(req)"
                        class="progress__time"
                        :class="{ 'progress__time--stale': isStale(req) }"
                        :datetime="rowStepTime(req).at"
                        :title="`${rowStepTime(req).label} ${formatDate(rowStepTime(req).at, true)}`"
                      >{{ sinceStep(rowStepTime(req).at) }}</time>
                    </span>
                  </div>
                </td>
                <td class="c-actions">
                  <div class="row-actions" @click.stop>
                    <!-- Dispatched or picked up: the whole delivery into Stock Intake from here (project owner, 2026-10-30). -->
                    <button
                      v-if="canReceive && req.awaiting_receipt"
                      type="button"
                      class="btn-primary btn-receive"
                      :aria-label="`Receive ${req.awaiting_receipt} unit${req.awaiting_receipt === 1 ? '' : 's'} for ${req.reference_number}`"
                      @click="receiving = req"
                    >
                      <AssetIcon name="package-check" :size="14" />
                      Receive
                    </button>
                    <button type="button" class="icon-btn" :aria-label="`Quick view of ${req.reference_number}`" title="Quick view" @click="openDrawer(req)">
                      <AssetIcon name="eye" :size="15" />
                    </button>
                    <button type="button" class="icon-btn" :aria-label="`Full details and fulfilment of ${req.reference_number}`" title="Full details & fulfilment" @click="viewDetails(req)">
                      <AssetIcon name="file-text" :size="15" />
                    </button>
                    <button type="button" class="icon-btn" :aria-label="`Track ${req.reference_number}`" title="Track request" @click="trackRequest(req)">
                      <AssetIcon name="route" :size="15" />
                    </button>
                    <button
                      v-if="canCancel(req)"
                      type="button"
                      class="icon-btn icon-btn--danger"
                      :aria-label="`Cancel ${req.reference_number}`"
                      title="Cancel request"
                      @click="askCancel(req)"
                    >
                      <AssetIcon name="circle-x" :size="15" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <ListPager :page="page" :last-page="lastPage" :from="from" :to="to" :total="total" @go="go" />
      </section>
    </div>

    <!-- CANCEL: confirmed here rather than in the browser's own box -->
    <div v-if="cancelling" class="confirm-backdrop" @click.self="cancelling = null">
      <div
        class="confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cancel-title"
        aria-describedby="cancel-desc"
        v-focus-trap
        @dialog-escape="cancelling = null"
      >
        <h2 id="cancel-title" class="confirm__title">
          <AssetIcon name="circle-x" :size="17" />
          Cancel {{ cancelling.reference_number }}?
        </h2>
        <p id="cancel-desc" class="confirm__text">The blood centers stop working on it. This cannot be undone.</p>
        <div class="confirm__actions">
          <button type="button" class="btn-outline" @click="cancelling = null">Keep request</button>
          <button type="button" class="btn-primary btn-primary--danger" @click="confirmCancel">Cancel Request</button>
        </div>
      </div>
    </div>

    <HospitalReceiveDeliveryDialog
      v-if="receiving"
      kind="transfusion"
      :request-id="receiving.id"
      :reference="receiving.reference_number"
      @received="refresh"
      @close="receiving = null"
    />

    <!-- Quick view, in the middle of the screen (2026-11-01). -->
    <CenterModal
      v-if="drawerOpen && selectedRequest"
      :title="selectedRequest.reference_number"
      eyebrow="Request details"
      @close="closeDrawer"
    >
      <!-- Who, what and how urgent at a glance (2026-11-26). -->
      <template #meta>
        <span v-if="selectedRequest.blood_type" class="blood qv-blood">{{ selectedRequest.blood_type }}</span>
        <span v-if="selectedRequest.priority === 'emergency'" class="tag tag--stat">STAT</span>
        <span class="qv-patient">{{ selectedRequest.patient || 'Patient not recorded' }}</span>
      </template>

      <div class="quick-view">
        <!-- Units at the door come first: this blood bank's turn. -->
        <div v-if="!isHalted(selectedRequest.status) && selectedRequest.awaiting_receipt" class="qv-callout" role="status">
          <AssetIcon name="truck" :size="18" />
          <p class="qv-callout__text">
            <strong>{{ selectedRequest.awaiting_receipt }} unit{{ selectedRequest.awaiting_receipt === 1 ? '' : 's' }} dispatched</strong>{{
              selectedRequest.step_times?.released ? ` ${sinceStep(selectedRequest.step_times.released)}` : ''
            }}, not yet received.
          </p>
        </div>

        <div class="drawer__status-row">
          <StatusBadge :tone="rowProgress(selectedRequest).tone">{{ rowProgress(selectedRequest).text }}</StatusBadge>
        </div>

        <div class="drawer__timeline-section">
          <h3 class="drawer__section-title">Progress</h3>
          <HospitalTransfusionStepper
            :request="{ ...selectedRequest.raw, status: selectedRequest.status }"
            :times="selectedRequest.step_times ?? {}"
            :now="now"
          />
        </div>

        <div class="qv-main">
          <!-- How much has come: received, on the way, still to come. -->
          <div v-if="!isHalted(selectedRequest.status)" class="qv-meter">
            <p class="qv-meter__figures">
              <strong>{{ fulfilmentOf(selectedRequest).released }} of {{ fulfilmentOf(selectedRequest).required }}</strong> released
              · <strong>{{ fulfilmentOf(selectedRequest).received }}</strong> received
            </p>
            <span class="qv-meter__bar" aria-hidden="true">
              <span class="qv-meter__fill qv-meter__fill--received" :style="{ width: `${fulfilmentOf(selectedRequest).receivedPct}%` }" />
              <span class="qv-meter__fill qv-meter__fill--way" :style="{ width: `${fulfilmentOf(selectedRequest).onTheWayPct}%` }" />
            </span>
          </div>

          <section class="qv-group" aria-labelledby="qv-need">
            <h3 id="qv-need" class="qv-group__title">Need</h3>
            <dl class="drawer__grid">
              <div class="drawer__field"><dt>Blood Type</dt><dd>{{ selectedRequest.blood_type || '—' }}</dd></div>
              <div class="drawer__field"><dt>Blood Component</dt><dd>{{ selectedRequest.component }}</dd></div>
              <div class="drawer__field">
                <dt>{{ selectedRequest.kind === 'transfusion' ? 'Units Required' : 'Units Requested' }}</dt>
                <dd>{{ selectedRequest.units }}</dd>
              </div>
              <div v-if="selectedRequest.kind === 'transfusion'" class="drawer__field">
                <dt>Unallocated</dt>
                <dd :class="{ 'qv-warn': selectedRequest.unallocated > 0 }">{{ selectedRequest.unallocated }}</dd>
              </div>
            </dl>
          </section>

          <section class="qv-group" aria-labelledby="qv-patient">
            <h3 id="qv-patient" class="qv-group__title">Patient</h3>
            <dl class="drawer__grid">
              <div class="drawer__field"><dt>Patient</dt><dd>{{ selectedRequest.patient || 'Not recorded' }}</dd></div>
              <div class="drawer__field"><dt>Source</dt><dd>{{ selectedRequest.source_label }}</dd></div>
              <div v-if="selectedRequest.reason" class="drawer__field drawer__field--full">
                <dt>Reason</dt>
                <dd>{{ selectedRequest.reason }}</dd>
              </div>
            </dl>
          </section>

          <section class="qv-group" aria-labelledby="qv-request">
            <h3 id="qv-request" class="qv-group__title">Request</h3>
            <dl class="drawer__grid">
              <div class="drawer__field"><dt>Hospital Name</dt><dd>{{ selectedRequest.hospital_name }}</dd></div>
              <div class="drawer__field">
                <dt>{{ selectedRequest.kind === 'transfusion' ? 'Facilities asked' : 'Blood Center' }}</dt>
                <dd>{{ selectedRequest.centre_name || '—' }}</dd>
              </div>
              <div class="drawer__field"><dt>Requested By</dt><dd>{{ selectedRequest.requested_by || '—' }}</dd></div>
              <div class="drawer__field"><dt>Date Submitted</dt><dd>{{ formatDate(selectedRequest.request_date, true) }}</dd></div>
              <div v-if="selectedRequest.raw?.needed_by" class="drawer__field">
                <dt>Needed by</dt>
                <dd>{{ formatDate(new Date(selectedRequest.raw.needed_by), true) }}</dd>
              </div>
            </dl>
          </section>
        </div>
      </div>

      <template #actions>
          <button
            v-if="canReceive && selectedRequest.awaiting_receipt && !isHalted(selectedRequest.status)"
            type="button"
            class="ui-btn ui-btn--primary"
            @click="receiveFrom(selectedRequest)"
          >
            <AssetIcon name="package-check" :size="15" /> Receive
          </button>
          <button
            type="button"
            class="ui-btn"
            :class="{ 'ui-btn--primary': !(canReceive && selectedRequest.awaiting_receipt) }"
            @click="viewDetails(selectedRequest)"
          >
            <AssetIcon name="file-text" :size="15" /> Full Details
          </button>
          <button v-if="canCancel(selectedRequest)" type="button" class="ui-btn ui-btn--danger" @click="askCancel(selectedRequest)">
            <AssetIcon name="circle-x" :size="15" /> Cancel Request
          </button>
      </template>
    </CenterModal>

    <!-- Full Details and Track, in the same place. -->
    <CenterModal
      v-if="detailsFor"
      :title="detailsFor.reference_number"
      eyebrow="Full details and fulfilment"
      size="lg"
      @close="detailsFor = null"
    >
      <template #meta>
        <span v-if="detailsFor.blood_type" class="blood qv-blood">{{ detailsFor.blood_type }}</span>
        <span v-if="detailsFor.priority === 'emergency'" class="tag tag--stat">STAT</span>
        <span class="qv-patient">{{ detailsFor.patient || 'Patient not recorded' }}</span>
        <StatusBadge :tone="rowProgress(detailsFor).tone">{{ rowProgress(detailsFor).text }}</StatusBadge>
      </template>
      <HospitalTransfusionRequestDetail
        :request-id="detailsFor.id"
        embedded
        :can-receive="canReceive"
        @changed="refresh"
        @receive="receiveFrom(detailsFor)"
      />
    </CenterModal>

    <HospitalTransfusionTrackDialog
      v-if="trackingFor"
      :request-id="trackingFor.id"
      :reference="trackingFor.reference_number"
      @close="trackingFor = null"
      @details="openDetailsFromTrack"
    />
  </div>
</template>

<script setup>
import SkeletonRows from '~/components/ui/SkeletonRows.vue'
import CenterModal from '~/components/ui/CenterModal.vue'
import HospitalTransfusionRequestDetail from '~/components/Hospital/TransfusionRequestDetail.vue'
import HospitalTransfusionTrackDialog from '~/components/Hospital/TransfusionTrackDialog.vue'
import PageHeader from '~/components/ui/PageHeader.vue'
import StatStrip from '~/components/ui/StatStrip.vue'
import StatItem from '~/components/ui/StatItem.vue'
import StatusBadge from '~/components/ui/StatusBadge.vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import ListPager from '~/components/common/ListPager.vue'
import DateRangeFilter from '~/components/common/DateRangeFilter.vue'
import { useListPager } from '~/composables/useListPager'
import { badgeClass } from '~/utils/listBadge'
import { componentSummary, requestStatusLabel } from '~/types/bloodRequest'
import { ref, reactive, computed, onMounted, onUnmounted, onActivated, onDeactivated, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { hospitalService } from '~/api/hospital/HospitalService'
import { canCancelTransfusion, transfusionProgressLabel } from '~/utils/transfusionSourcing'
import SelectField from '~/components/common/SelectField.vue'
import HospitalReceiveDeliveryDialog from '~/components/Hospital/ReceiveDeliveryDialog.vue'
import { hospitalPageSubtitle } from '~/utils/hospitalPageSubtitles'
import { onPageReturn } from '~/composables/useKeptAlive'
import HospitalTransfusionStepper from '~/components/Hospital/TransfusionStepper.vue'
import { TRANSFUSION_STEPS, isHaltedStatus, sinceShort, transfusionStepIndex } from '~/utils/transfusionSteps'

definePageMeta({ middleware: ['auth', 'hospital-portal'], layout: 'hospitaldashboard', requires: 'hospital.requests.view', keepalive: true })

const router = useRouter()
const route = useRoute()
const loading = ref(true)
const refreshing = ref(false)
const updatedAt = ref(null)

const { can } = useUser()
// Raising a request is Requesting Staff's and the Head's; the form's page needs it too.
const canCreate = computed(() => can('hospital.requests.manage'))
// Receiving is confirmed by whoever holds that ability; the server checks it too.
const canReceive = computed(() => can('hospital.receipt.confirm'))
// The row whose delivery is being received, in ReceiveDeliveryDialog.
const receiving = ref(null)

/*
 * A patient's need is a Patient Transfusion Request, possibly split across
 * several centres. Restocking the blood bank is the weekly request, which
 * lives under Receiving, so it is not listed here.
 */
const kind = ref('transfusion')

// ---------- Reference data ----------
const components =['Packed RBC', 'Whole Blood', 'Fresh Frozen Plasma', 'Platelet Concentrate', 'Cryoprecipitate']

/*
 * Keyed on the six statuses the API actually sends. This map used to carry
 * approved / ready / completed, which the schema has never had, and lacked
 * partial and fulfilled — so `statusMap[req.status].bg` threw on the first
 * partly or fully supplied request and took the whole list down with it.
 */
// Each status as a StatusBadge tone, so the colours match every staff page.
const statusMap = {
  pending: { label: 'Pending', tone: 'warning' },
  processing: { label: 'Processing', tone: 'info' },
  partial: { label: 'Partially Fulfilled', tone: 'purple' },
  fulfilled: { label: 'Fulfilled', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
}

const FALLBACK_STYLE = { label: '—', tone: 'neutral' }

// The API speaks routine / emergency; the DOH form prints ROUTINE and STAT.
const priorityMap = {
  routine: { label: 'Routine', tone: 'info' },
  emergency: { label: 'STAT', tone: 'danger' },
}

function statusOf(status) {
  return statusMap[status] ?? { ...FALLBACK_STYLE, label: status ?? '—' }
}

function priorityOf(priority) {
  return priorityMap[priority] ?? priorityMap.routine
}

// The four steps, shared with the quick view and full details (utils/transfusionSteps).
const progressSteps = TRANSFUSION_STEPS
const isHalted = isHaltedStatus
/** The step a row is on; progressSteps.length once nothing is left to do. */
function rowStepIndex(req) {
  // The row's own status: a cancel shows at once, before the server answers.
  return transfusionStepIndex({ ...req.raw, status: req.status })
}
function progressLabel(req) {
  if (isHalted(req.status)) return statusOf(req.status).label
  const i = rowStepIndex(req)
  return i >= progressSteps.length ? 'Complete' : `Step ${i + 1} of ${progressSteps.length}, ${progressSteps[i]}`
}
/**
 * When the row reached the step it is on (step_times, from the list API), or
 * when it finished or stopped. Awaiting receipt dates from the release.
 */
function rowStepTime(req) {
  const times = req.step_times ?? {}
  const pick = (label, at) => (at ? { label, at } : null)
  if (req.status === 'cancelled') return pick('Cancelled', req.raw?.cancelled_at)
  if (req.status === 'rejected') return pick('Rejected', req.raw?.closed_at)
  const i = rowStepIndex(req)
  if (i >= progressSteps.length) return pick('Completed', times.received ?? req.raw?.fulfilled_at ?? req.raw?.closed_at)
  if (i >= 2) return pick('Released', times.released)
  if (i === 1) return pick('Approved', times.approved)
  // Still at Submitted: the Requested column already says when.
  return null
}

/** How long ago, as a span: a date would only repeat the Requested column. */
function sinceStep(iso) {
  return sinceShort(iso, now.value)
}

// Sitting at one step this long reads amber: a STAT after two hours, else a day.
const STALE_MS = { emergency: 2 * 60 * 60 * 1000, routine: 24 * 60 * 60 * 1000 }
function isStale(req) {
  const t = rowStepTime(req)
  if (!t || isHalted(req.status) || rowStepIndex(req) >= progressSteps.length) return false
  return now.value - new Date(t.at).getTime() > (STALE_MS[req.priority] ?? STALE_MS.routine)
}

// "5 min ago" moves on while the page is open.
const now = ref(Date.now())
let clock = null
function startClock() {
  now.value = Date.now()
  clock ??= setInterval(() => { now.value = Date.now() }, 60_000)
}
function stopClock() {
  clearInterval(clock)
  clock = null
}

/** The row's status by name: what happened, or what this blood bank still has to do. */
function rowProgress(req) {
  if (!isHalted(req.status) && req.awaiting_receipt > 0) {
    return { text: `Dispatched · ${req.awaiting_receipt} to receive`, tone: 'warning' }
  }
  if (req.status === 'processing') {
    const approved = req.raw?.totals?.approved ?? 0
    return { text: `Approved · ${approved} of ${req.units} unit${req.units === 1 ? '' : 's'}`, tone: statusOf(req.status).tone }
  }
  return { text: req.status_text, tone: statusOf(req.status).tone }
}
/**
 * The actions column, as wide as the busiest row on this page (2026-11-26):
 * three icons always, Receive and Cancel only where a row shows them, so no
 * room is kept for a button no row has.
 */
const actionsWidth = computed(() => Math.max(...pageItems.value.map((req) => {
  const receive = canReceive.value && req.awaiting_receipt > 0
  const icons = 3 + (canCancel(req) ? 1 : 0)
  const buttons = icons + (receive ? 1 : 0)
  return 26 + icons * 32 + (receive ? 104 : 0) + (buttons - 1) * 6
}), 140))

function canCancel(req) {
  return req.kind === 'transfusion' ? canCancelTransfusion(req.raw) : req.status === 'pending'
}

/** The quick view's fulfilment meter: received, on the way, and the rest of what is required. */
function fulfilmentOf(req) {
  const t = req.raw?.totals ?? {}
  const required = Math.max(t.required ?? 0, 1)
  const received = t.received ?? 0
  const onTheWay = Math.max(0, (t.fulfilled ?? 0) - received)
  return {
    required: t.required ?? 0,
    released: t.fulfilled ?? 0,
    received,
    receivedPct: (received / required) * 100,
    onTheWayPct: (onTheWay / required) * 100,
  }
}

// ---------- Live data ----------
const allRequests = ref([])
const loadError = ref(null)

/** A Patient Transfusion Request, in the row shape the table and drawer read. */
function normalizeTransfusion(r) {
  return {
    id: r.id,
    kind: 'transfusion',
    raw: r,
    reference_number: r.reference_number,
    hospital_name: r.requesting_facility?.name ?? '',
    centre_name: (r.facilities ?? []).join(', '),
    source: r.request_source ?? 'blood_bank_portal',
    source_label: r.source_label ?? 'Blood Bank Portal',
    is_walk_in: Boolean(r.is_walk_in),
    needs_allocation: Boolean(r.is_open && r.needs_allocation),
    unallocated: r.totals?.unallocated ?? 0,
    awaiting_receipt: r.totals?.awaiting_receipt ?? 0,
    status_text: transfusionProgressLabel(r),
    fulfilled: r.totals?.fulfilled ?? 0,
    blood_type: r.blood_type?.code ?? '',
    component: componentSummary({ items: r.lines ?? [] }),
    units: r.totals?.required ?? 0,
    purpose: r.purpose_label ?? '',
    patient: r.patient?.full_name ?? '',
    priority: r.urgency_level ?? 'routine',
    status: r.status,
    request_date: r.request_date ? new Date(r.request_date) : null,
    step_times: r.step_times ?? null,
    requested_by: r.requester_name
      ?? (r.is_walk_in ? `Walk-in — recorded by ${r.recorder_name ?? 'the blood center'}` : (r.recorder_name ? `${r.supplied_by_hospital ? 'Sent' : 'Added'} by ${r.target_facility?.name ?? 'the blood center'}` : '')),
    reason: r.cancellation_reason ?? '',
  }
}

// ---------- Search & filters ----------
// The donors page's toolbar (project owner, 2026-10-30): search, dates, status,
// priority and component. The type is found through the search.
const searchQuery = ref('')
const filters = reactive({
  status: '',
  component: '',
  priority: '',
  // What waits on this blood bank: 'receive' or 'allocate'.
  waiting: '',
  dateFrom: '',
  dateTo: '',
})

const hasActiveFilters = computed(() =>
  Object.values(filters).some(v => v !== '') || searchQuery.value.trim() !== ''
)

function resetFilters() {
  filters.waiting = ''
  filters.status = ''
  filters.component = ''
  filters.priority = ''
  filters.dateFrom = ''
  filters.dateTo = ''
  searchQuery.value = ''
}

// A figure toggles its status on the list; a chip toggles what waits.
function toggleStatus(status) {
  filters.status = filters.status === status ? '' : status
}
function toggleWaiting(kind) {
  filters.waiting = filters.waiting === kind ? '' : kind
}

const isOpenStat = r => r.priority === 'emergency' && !['fulfilled', 'rejected', 'cancelled'].includes(r.status)
const waitingCounts = computed(() => ({
  receive: allRequests.value.filter(r => r.awaiting_receipt > 0).length,
  allocate: allRequests.value.filter(r => r.needs_allocation).length,
  stat: allRequests.value.filter(isOpenStat).length,
}))
const hasQuickFilters = computed(() => Object.values(waitingCounts.value).some(Boolean))

// Open STAT requests first, so an emergency is never pages down; the rest as they came.
const filteredRequests = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  const rows = allRequests.value.filter(r => {
    if (filters.waiting === 'receive' && !(r.awaiting_receipt > 0)) return false
    if (filters.waiting === 'allocate' && !r.needs_allocation) return false
    if (q) {
      const haystack = `${r.reference_number} ${r.patient} ${r.blood_type} ${r.component}`.toLowerCase()
      if (!haystack.includes(q)) return false
    }
    if (filters.status && r.status !== filters.status) return false
    if (filters.component && r.component !== filters.component) return false
    if (filters.priority && r.priority !== filters.priority) return false
    if (filters.dateFrom && r.request_date < new Date(filters.dateFrom)) return false
    if (filters.dateTo && r.request_date > new Date(filters.dateTo + 'T23:59:59')) return false
    return true
  })
  return [...rows.filter(isOpenStat), ...rows.filter(r => !isOpenStat(r))]
})

// ---------- Pagination ----------
const { page, total, lastPage, from, to, pageItems, go } = useListPager(filteredRequests)

// A new search or filter starts from the first page.
watch([searchQuery, () => ({ ...filters })], () => go(1))

// ---------- KPI counts (animated) ----------
// The card keys are historical; each now counts a status the API really sends.
// approved → processing (units tagged), ready → partial, completed → fulfilled.
const CARD_STATUSES = { pending: 'pending', approved: 'processing', ready: 'partial', completed: 'fulfilled' }

const rawCounts = computed(() => ({
  pending: allRequests.value.filter(r => r.status === CARD_STATUSES.pending).length,
  approved: allRequests.value.filter(r => r.status === CARD_STATUSES.approved).length,
  ready: allRequests.value.filter(r => r.status === CARD_STATUSES.ready).length,
  completed: allRequests.value.filter(r => r.status === CARD_STATUSES.completed).length,
}))

const animatedCounts = reactive({ pending: 0, approved: 0, ready: 0, completed: 0 })

// ---------- Trends (computed live gikan sa actual data — walay hardcoded values) ----------
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

function buildTrend(status) {
  const now = new Date()
  const currentStart = new Date(now.getTime() - WEEK_MS)
  const previousStart = new Date(now.getTime() - WEEK_MS * 2)

  const inRange = (start, end) => allRequests.value.filter(r =>
    r.status === status && r.request_date && r.request_date >= start && r.request_date < end
  ).length

  const current = inRange(currentStart, now)
  const previous = inRange(previousStart, currentStart)

  if (previous === 0 && current === 0) {
    return { up: true, label: '', hasData: false }
  }

  let percent
  let up
  if (previous === 0) {
    percent = 100
    up = true
  } else {
    percent = Math.round(((current - previous) / previous) * 100)
    up = percent >= 0
  }

  return {
    up,
    hasData: true,
    label: `${Math.abs(percent)}% this week`,
  }
}

const trends = computed(() => ({
  pending: buildTrend(CARD_STATUSES.pending),
  approved: buildTrend(CARD_STATUSES.approved),
  ready: buildTrend(CARD_STATUSES.ready),
  completed: buildTrend(CARD_STATUSES.completed),
}))

function animateCounter(key, endValue, duration = 800) {
  const start = 0
  const startTime = performance.now()
  function tick(now) {
    const progress = Math.min((now - startTime) / duration, 1)
    const eased = 1 - Math.pow(1 - progress, 3)
    animatedCounts[key] = Math.round(start + (endValue - start) * eased)
    if (progress < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

// ---------- Drawer ----------
const detailsFor = ref(null)
const trackingFor = ref(null)
function openDetailsFromTrack() {
  detailsFor.value = trackingFor.value
  trackingFor.value = null
}

const drawerOpen = ref(false)
const selectedRequest = ref(null)
function openDrawer(req) {
  selectedRequest.value = req
  drawerOpen.value = true
}
function closeDrawer() {
  drawerOpen.value = false
}
/** Receive from a dialog: the dialog gives way to ReceiveDeliveryDialog. */
function receiveFrom(req) {
  drawerOpen.value = false
  detailsFor.value = null
  receiving.value = req
}

// ---------- Row / global actions ----------
function openNewRequest() {
  router.push('/hospital/bloodrequests/newrequest')
}
function trackRequest(req) {
  drawerOpen.value = false
  if (req.kind === 'transfusion') {
    trackingFor.value = req
    return
  }
  // The page is /hospital/trackrequests; the hyphenated path this pushed to
  // has never existed, so "Track Request" landed on a 404.
  router.push(`/hospital/trackrequests?ref=${req.reference_number}`)
}
function viewDetails(req) {
  drawerOpen.value = false
  if (req.kind === 'transfusion') {
    detailsFor.value = req
    return
  }
  router.push(req.kind === 'transfusion' ? `/hospital/transfusion-requests/${req.id}` : `/hospital/bloodrequests/${req.id}`)
}

// A row's cancel is one click away, so it asks first, in the page's own dialog.
const cancelling = ref(null)
function askCancel(req) {
  cancelling.value = req
}
function confirmCancel() {
  const req = cancelling.value
  cancelling.value = null
  if (req) cancelRequest(req)
}

async function cancelRequest(req) {
  const previousStatus = req.status
  const previousText = req.status_text
  req.status = 'cancelled' // optimistic update
  req.status_text = statusOf('cancelled').label
  if (selectedRequest.value?.id === req.id) drawerOpen.value = false
  try {
    if (req.kind === 'transfusion') {
      const response = await hospitalService.cancelTransfusionRequest(req.id)
      if (response?.request) Object.assign(req, normalizeTransfusion(response.request))
    } else {
      await hospitalService.cancelRequest(req.id)
    }
  } catch (err) {
    console.error('Failed to cancel request:', err)
    req.status = previousStatus // rollback on failure
    req.status_text = previousText
  }
}
function exportCsv() {
  const rows = [
    ['Reference', 'Date', 'Source', 'Blood Type', 'Component', 'Units', 'Fulfilled', 'Priority', 'Status'],
    ...filteredRequests.value.map(r => [
      r.reference_number, formatDate(r.request_date), r.source_label, r.blood_type, r.component,
      r.units, r.fulfilled, priorityOf(r.priority).label, r.status_text,
    ]),
  ]
  const csv = rows.map(row => row.map(v => `"${v}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'blood-requests.csv'
  link.click()
  URL.revokeObjectURL(url)
}

// ---------- Utils ----------
function formatDate(date, withTime = false) {
  if (!date) return '—'
  const d = new Date(date)
  const opts = { year: 'numeric', month: 'short', day: 'numeric' }
  if (withTime) { opts.hour = '2-digit'; opts.minute = '2-digit' }
  return d.toLocaleDateString('en-PH', opts)
}

function handleGlobalKeydown(e) {
  // The cancel and receive dialogs close on their own Escape.
  if (e.key === 'Escape' && drawerOpen.value && !cancelling.value && !receiving.value) closeDrawer()
}

const updatedAtLabel = computed(() => (updatedAt.value
  ? updatedAt.value.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  : ''))

/** Reload the list in place, without the page's first-load skeleton. */
async function refresh() {
  refreshing.value = true
  try {
    await loadRequests({ quiet: true })
  } finally {
    refreshing.value = false
  }
}

async function loadRequests({ quiet = false } = {}) {
  if (!quiet) loading.value = true
  loadError.value = null
  try {
    // Filtered and paged here on the client, so take the most one page may
    // hold rather than the API's default of fifteen.
    const res = await hospitalService.listTransfusionRequests({ per_page: 100 })
    allRequests.value = (res?.data ?? []).map(normalizeTransfusion)
    updatedAt.value = new Date()
  } catch (err) {
    console.error('Failed to load blood requests:', err)
    loadError.value = err
    if (!quiet) allRequests.value = []
  } finally {
    loading.value = false
    requestAnimationFrame(() => {
      const c = rawCounts.value
      animateCounter('pending', c.pending)
      animateCounter('approved', c.approved)
      animateCounter('ready', c.ready)
      animateCounter('completed', c.completed)
    })
  }
}

onMounted(() => {
  loadRequests()
  window.addEventListener('keydown', handleGlobalKeydown)
  startClock()
})
onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
  stopClock()
})

// Kept alive: away, Escape belongs to the page on screen and the clock
// stops; back, the list reloads in place.
onDeactivated(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
  stopClock()
})
onActivated(() => {
  window.addEventListener('keydown', handleGlobalKeydown)
  startClock()
})
onPageReturn(refresh)
</script>

<!-- The list: the blood centre's Donor Management structure (project owner, 2026-10-30). -->
<style scoped src="~/assets/css/list-ui.css"></style>

<style scoped>
.requests-page {
  --primary: var(--rb-primary);
  --surface: var(--rb-surface);
  --border: var(--rb-border);
  --text-primary: var(--rb-text-primary);
  --text-secondary: var(--rb-text-secondary);
  --text-muted: var(--rb-text-muted);
  --danger: var(--rb-accent);
  --success: var(--rb-success);
  font-family: var(--rb-font-sans);
  max-width: var(--rb-content-max, 1600px);
  background: var(--rb-page-bg);
  margin: 0 auto;
  padding: 24px var(--rb-gutter, 24px) 40px;
}

.page-inner { display: flex; flex-direction: column; gap: 16px; }

/* First-load skeleton */
.skeleton {
  background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 37%, var(--rb-skeleton-a) 63%);
  background-size: 400% 100%;
  border-radius: 18px;
  animation: shimmer 1.4s ease infinite;
}
.skeleton--title { height: 60px; max-width: 420px; }
.skeleton--search { height: 48px; }
.skeleton--card { height: 140px; }
.skeleton--panel { border-radius: 18px; }
@keyframes shimmer { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }
.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }

.fade-in { animation: fadeInUp 0.4s ease both; animation-delay: var(--delay, 0ms); }
@keyframes fadeInUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@media (prefers-reduced-motion: reduce) { .fade-in, .skeleton { animation: none !important; } }


/* The reference opens the quick view, as the eye does. */
.code-btn { align-self: flex-start; padding: 0; border: 0; background: none; cursor: pointer; }
.code-btn:hover { text-decoration: underline; }
.code-btn:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); border-radius: 4px; }

/* Receive: the row's one call to action, while units are on their way. */
.btn-receive { color: var(--rb-primary-text); border-color: rgba(var(--rb-primary-rgb), 0.45); background: rgba(var(--rb-primary-rgb), 0.06); }
.btn-receive:hover:not(:disabled) { background: rgba(var(--rb-primary-rgb), 0.12); }

.step-dots { display: inline-flex; align-items: center; gap: 3px; }
.step-dot { width: 7px; height: 7px; border-radius: 999px; background: var(--rb-border-strong); transition: background 0.2s ease, transform 0.2s ease; }
.step-dot--done { background: var(--success); }
.step-dot--current { background: var(--primary); transform: scale(1.3); }
.step-dot--halted { background: var(--danger); }

/* ---------- Cancel confirmation ---------- */
.confirm-backdrop {
  position: fixed; inset: 0; z-index: 320;
  display: grid; place-items: center; padding: 16px;
  background: var(--rb-overlay);
}
.confirm {
  width: min(440px, 100%);
  display: flex; flex-direction: column; gap: 12px;
  padding: 20px; border-radius: 14px;
  background: var(--rb-surface); border: 1px solid var(--rb-border);
  color: var(--rb-text-primary);
}
.confirm:focus { outline: none; }
.confirm__title { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 16px; font-weight: 700; }
.confirm__text { margin: 0; font-size: 13.5px; line-height: 1.5; color: var(--rb-text-secondary); }
.confirm__actions { display: flex; justify-content: flex-end; gap: 10px; }
.btn-primary--danger { background: var(--rb-accent); border-color: var(--rb-accent); }
.btn-primary--danger:hover:not(:disabled) { background: color-mix(in srgb, var(--rb-accent) 88%, #000); }

/* ---------- Drawer ---------- */
.drawer__status-row { display: flex; gap: 8px; flex-wrap: wrap; }

.drawer__grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 0; }
.drawer__field { display: flex; flex-direction: column; gap: 3px; }
.drawer__field--full { grid-column: 1 / -1; }
.drawer__field dt { font-size: 12px; font-weight: 600; color: var(--text-secondary); margin: 0; }
.drawer__field dd { font-size: 14px; font-weight: 500; color: var(--text-primary); margin: 0; line-height: 1.45; }

.drawer__section-title { font-size: 13.5px; font-weight: 700; color: var(--text-primary); margin: 0 0 14px; }



/* Responsive */
@media (max-width: 1024px) {
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 640px) {
  .requests-page { padding: 20px 16px 32px; }
  .stats-grid { grid-template-columns: 1fr; }
  .drawer { width: 100vw; }
  .confirm__actions { flex-direction: column-reverse; }
  .confirm__actions > * { width: 100%; }
}

/* The trend under a figure, beside its note. */
.stat-trend {
  display: flex; width: fit-content; align-items: center; gap: 3px; margin-top: 6px;
  font-size: 11px; font-weight: 700; padding: 1px 7px; border-radius: 999px;
}
.stat-trend.up { color: var(--rb-success-text); background: rgba(var(--rb-success-rgb), 0.1); }
.stat-trend.down { color: var(--rb-accent-text); background: rgba(var(--rb-accent-rgb), 0.09); }

/* What waits, one click away (2026-11-01). */
.quick-filters { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 12px 16px; border-bottom: 1px solid var(--rb-border); }
.stat-trend { white-space: nowrap; }
:deep(.si__hint) { flex-wrap: wrap; }
.quick {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 10px 0 12px;
  border: 1px solid var(--rb-border);
  border-radius: 999px;
  background: var(--rb-surface);
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--rb-text-secondary);
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}
.quick:hover { border-color: rgba(var(--rb-primary-rgb), 0.45); color: var(--rb-text-primary); }
.quick:focus-visible, .quick-clear:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; }
.quick__count { min-width: 20px; padding: 1px 6px; border-radius: 999px; background: var(--rb-surface-alt); font-size: 11.5px; font-weight: 700; text-align: center; color: var(--rb-text-primary); }
.quick--on { border-color: rgba(var(--rb-primary-rgb), 0.55); background: rgba(var(--rb-primary-rgb), 0.08); color: var(--rb-primary-text); }
.quick--on .quick__count { background: var(--rb-primary); color: #FFFFFF; }
.quick-filters__label { font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--rb-text-muted); }
/* Units at the door: the same amber as "Dispatched" in the Progress column. */
.quick__dot { width: 7px; height: 7px; border-radius: 999px; background: var(--rb-warning); flex-shrink: 0; }
.quick--action .quick__count { background: rgba(var(--rb-warning-rgb), 0.14); color: var(--rb-warning-text); }
.quick--action:hover { border-color: rgba(var(--rb-warning-rgb), 0.55); }
.quick--action.quick--on { border-color: rgba(var(--rb-warning-rgb), 0.6); background: rgba(var(--rb-warning-rgb), 0.08); color: var(--rb-warning-text); }
.quick--action.quick--on .quick__count { background: var(--rb-warning); color: #FFFFFF; }
.quick--stat { color: var(--rb-accent-text); }
.quick--stat.quick--on { border-color: rgba(var(--rb-accent-rgb), 0.55); background: rgba(var(--rb-accent-rgb), 0.08); color: var(--rb-accent-text); }
.quick--stat.quick--on .quick__count { background: var(--rb-accent); }
.quick-clear { display: inline-flex; align-items: center; gap: 4px; margin-left: auto; border: 0; border-radius: 6px; background: none; font: inherit; font-size: 12.5px; font-weight: 600; color: var(--rb-primary-text); cursor: pointer; }

/* Column widths (2026-11-26): each a share of the table with a floor its
   content fits in, so spare room spreads across the row instead of pooling
   before the actions; the patient takes what is left. */
.req-table { table-layout: fixed; }
.req-table .c-ref { width: max(150px, 13%); }
.req-table .c-need { width: max(200px, 19%); }
.req-table .c-date { width: max(120px, 11%); }
.req-table .c-progress { width: max(250px, 23%); }
.req-table tbody td { overflow: hidden; }

/* The row: who, what, how far. */
.tag--stat { margin: 0; border-color: transparent; background: var(--rb-accent); font-weight: 700; color: #FFFFFF; }
.ref { display: flex; align-items: center; gap: 6px; }
.ref .code-btn { align-self: auto; }
/* An open STAT: a red edge on the row, seen while scanning without a taller row. */
.list-row--stat td:first-child { box-shadow: inset 3px 0 0 var(--rb-accent); }

.need { display: flex; align-items: center; gap: 10px; min-width: 0; }
/* One width for every type, so the component names line up down the column. */
.need .blood {
  flex-shrink: 0;
  width: 42px;
  min-width: 0;
  padding: 2px 0;
  border-color: rgba(var(--rb-accent-rgb), 0.35);
  background: rgba(var(--rb-accent-rgb), 0.07);
  color: var(--rb-accent-text);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.need > .muted { width: 42px; flex-shrink: 0; text-align: center; }

.progress { display: inline-flex; flex-direction: column; align-items: flex-start; gap: 7px; }
.progress__track { display: inline-flex; align-items: center; gap: 8px; }
.progress__bar { display: grid; grid-template-columns: repeat(4, 22px); gap: 3px; }
.progress__time { font-size: 11px; color: var(--rb-text-muted); white-space: nowrap; font-variant-numeric: tabular-nums; }
.progress__time--stale { font-weight: 600; color: var(--rb-warning-text); }
.progress__step { height: 4px; border-radius: 999px; background-color: var(--rb-border); }
.progress__step--done { background-color: var(--rb-success); }
.progress__step--current { background-color: var(--rb-primary); }
.progress__step--action { background-color: var(--rb-warning); }
.progress__step--halted { background-color: var(--rb-border-hover); }

/* Quick view: its fields beside its timeline. */
/* The dialog sits on the body, outside .requests-page and the tokens it sets. */
.quick-view {
  --primary: var(--rb-primary);
  --surface: var(--rb-surface);
  --border: var(--rb-border);
  --text-primary: var(--rb-text-primary);
  --text-secondary: var(--rb-text-secondary);
  --text-muted: var(--rb-text-muted);
  --danger: var(--rb-accent);
  --success: var(--rb-success);
  display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 16px 28px;
}
.quick-view .qv-callout, .quick-view .drawer__status-row { grid-column: 1 / -1; }
.quick-view .drawer__timeline-section { grid-column: 1; min-width: 190px; padding-right: 24px; border-right: 1px solid var(--rb-border); }
.quick-view .qv-main { grid-column: 2; display: flex; flex-direction: column; gap: 14px; min-width: 0; }
@media (max-width: 640px) {
  .quick-view { grid-template-columns: minmax(0, 1fr); }
  .quick-view .qv-main, .quick-view .drawer__timeline-section { grid-column: 1; border-right: 0; padding-right: 0; }
}

/* Header: type, STAT and patient beside the reference. */
.qv-blood { width: 42px; min-width: 0; padding: 2px 0; border-color: rgba(var(--rb-accent-rgb), 0.35); background: rgba(var(--rb-accent-rgb), 0.07); color: var(--rb-accent-text); }
.qv-patient { font-size: 13.5px; font-weight: 600; color: var(--rb-text-primary); }

/* Amber: units at the door, the same tone as "Dispatched" in the list. */
.qv-callout {
  display: flex; align-items: center; gap: 10px;
  padding: 11px 14px; border-radius: 10px;
  border: 1px solid rgba(var(--rb-warning-rgb), 0.4);
  background: rgba(var(--rb-warning-rgb), 0.1);
  color: var(--rb-warning-text);
}
.qv-callout__text { margin: 0; font-size: 13px; line-height: 1.45; }

.qv-meter { display: flex; flex-direction: column; gap: 7px; padding: 12px 14px; border-radius: 10px; background: var(--rb-surface-alt); }
.qv-meter__figures { margin: 0; font-size: 13px; color: var(--rb-text-secondary); }
.qv-meter__figures strong { color: var(--rb-text-primary); }
.qv-meter__bar { display: flex; height: 6px; border-radius: 999px; overflow: hidden; background: var(--rb-border); }
.qv-meter__fill { height: 100%; transition: width 0.3s ease; }
.qv-meter__fill--received { background: var(--rb-success); }
.qv-meter__fill--way { background: var(--rb-warning); }

.qv-group { display: flex; flex-direction: column; gap: 10px; padding-top: 14px; border-top: 1px solid var(--rb-border); }
.qv-group__title { margin: 0; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--rb-text-muted); }
.qv-group .drawer__grid { gap: 12px 16px; }
.qv-group .drawer__field dt { font-size: 11.5px; font-weight: 500; color: var(--rb-text-muted); }
.qv-warn { color: var(--rb-warning-text) !important; font-weight: 700 !important; }
@media (prefers-reduced-motion: reduce) { .qv-meter__fill { transition: none; } }
</style>
