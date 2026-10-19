<template>
  <div class="page scope-blood-center-bloodrequests">
    <!-- TOASTS -->
    <div class="toast-stack">
      <transition-group name="toast">
        <div v-for="t in toasts" :key="t.id" class="toast" :class="`toast--${t.variant}`">
          <div class="toast-title">{{ t.title }}</div>
          <div v-if="t.message" class="toast-message">{{ t.message }}</div>
        </div>
      </transition-group>
    </div>

    <!-- HEADER -->
    <header class="header-row">
      <div>
        <h1 class="page-title">Incoming Requests</h1>
        <p class="page-subtitle">{{ listSummary }}</p>
      </div>
    </header>

    <!-- ERROR / RETRY BANNER -->
    <div v-if="error" class="banner banner--error" role="alert">
      <AssetIcon name="circle-alert" :size="16" />
      <p class="banner__text">Couldn't load incoming requests. {{ error?.message || error || 'Please try again.' }}</p>
      <button type="button" class="btn-link" @click="loadRequests(meta.current_page)">Retry</button>
    </div>

    <!--
      A patient's transfusion and a hospital restocking its own shelves are
      different work, so they are listed apart (project owner, 2026-10-19).
      Each tab counts what is still open in it.
    -->
    <div class="tabs" role="tablist" aria-label="Request type">
      <button
        v-for="tab in PURPOSE_TABS"
        :key="tab.value"
        type="button"
        role="tab"
        class="tab"
        :class="{ 'tab--on': purposeTab === tab.value }"
        :aria-selected="purposeTab === tab.value"
        @click="selectTab(tab.value)"
      >
        <AssetIcon :name="tab.icon" :size="14" />
        {{ tab.label }}
        <span v-if="openCount(tab.value)" class="tab__count" :title="`${openCount(tab.value)} open`">{{ openCount(tab.value) }}</span>
      </button>
    </div>

    <!--
      The list, laid out after the owner's mock-up (2026-10-19): one search,
      the dates, the status, then the list's own actions; a table with a row's
      actions on it; a pager. Built like the Donations list.
    -->
    <section class="panel">
      <div class="toolbar">
        <div class="toolbar__filters">
          <label class="search">
            <AssetIcon name="search" :size="15" class="search__icon" />
            <input
              v-model="searchQuery"
              type="search"
              class="search__input"
              :placeholder="isPatientTab ? 'Search patient / hospital…' : 'Search hospital / request ID…'"
              :aria-label="isPatientTab ? 'Search by patient, hospital or request ID' : 'Search by hospital or request ID'"
              @input="onSearchInput"
            >
          </label>
          <DateRangeFilter v-model:from="fromDate" v-model:to="toDate" aria-label="Requested between" @change="loadRequests()" />
          <select v-model="statusFilter" class="select" aria-label="Filter by status" @change="loadRequests()">
            <option value="">All statuses</option>
            <option v-for="opt in STATUS_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </div>

        <div class="toolbar__actions">
          <span v-if="lastUpdatedAt" class="updated">
            <AssetIcon name="clock" :size="13" />
            Updated {{ lastUpdatedLabel }}
          </span>
          <button type="button" class="btn btn-outline" :disabled="exporting || !meta.total" @click="handleExportAll">
            <AssetIcon name="download" :size="14" />
            {{ exporting ? 'Exporting…' : 'Export' }}
          </button>
          <button type="button" class="btn btn-outline" :disabled="loading" @click="handleRefresh">
            <AssetIcon name="refresh-cw" :size="14" :class="{ spinning: loading }" />
            Refresh
          </button>
          <!--
            A watcher who came here instead of the hospital blood bank, recorded
            on the hospital's behalf. No phone confirmation is taken since
            2026-10-19 (project owner).
          -->
          <!-- A walk-in is always for a patient, so only on that tab. -->
          <button v-if="canRecord && isPatientTab" type="button" class="btn btn-primary" title="Record a walk-in request a watcher brought" @click="showWalkIn = true">
            <AssetIcon name="plus" :size="15" />
            New Request
          </button>
        </div>
      </div>

      <div class="table-wrap" :class="{ 'table-wrap--busy': loading && rows.length }">
        <table class="req-table">
          <caption class="sr-only">Requests to this center: open ones first, emergencies at the top</caption>
          <thead>
            <tr>
              <th scope="col" class="c-id">ID</th>
              <th scope="col" class="c-date">Date</th>
              <th scope="col" class="c-hospital">Hospital / Requester</th>
              <th v-if="isPatientTab" scope="col" class="c-patient">Patient</th>
              <th v-else scope="col" class="c-patient">Blood Type</th>
              <th scope="col" class="c-component">Component</th>
              <th scope="col" class="c-units" title="Issued of requested">Units</th>
              <th scope="col" class="c-priority">Priority</th>
              <th scope="col" class="c-status">Status</th>
              <th scope="col" class="c-actions">Actions</th>
            </tr>
          </thead>

          <tbody v-if="loading && !rows.length">
            <tr v-for="n in 6" :key="'sk-' + n">
              <td colspan="9"><span class="skeleton skeleton--line" /></td>
            </tr>
          </tbody>

          <tbody v-else-if="!rows.length">
            <tr>
              <td colspan="9" class="empty-cell">
                <div class="empty-state">
                  <span class="empty-state__icon"><AssetIcon :name="hasFilters ? 'search-x' : 'inbox'" :size="20" /></span>
                  <p class="empty-state__title">
                    {{ hasFilters ? 'No requests match' : isPatientTab ? 'No patient requests' : 'No replenishment orders' }}
                  </p>
                  <p class="empty-state__text">
                    {{ hasFilters
                      ? 'Try another search, widen the dates, or pick another status.'
                      : isPatientTab
                        ? 'Requests for a patient, from hospital blood banks or recorded here as walk-ins, appear in this list.'
                        : 'Orders from hospital blood banks restocking their own shelves, weekly ones included, appear in this list.' }}
                  </p>
                  <button v-if="hasFilters" type="button" class="btn btn-outline btn-sm" @click="resetFilters">Clear filters</button>
                </div>
              </td>
            </tr>
          </tbody>

          <tbody v-else>
            <tr v-for="r in rows" :key="r.id" class="req-row" :class="{ 'is-mutating': isMutating(r.id) }">
              <td class="c-id">
                <button type="button" class="code-link" :title="`Review ${r.code}`" @click="openReview(r)">{{ r.code }}</button>
                <span v-if="r.isWalkIn" class="chip" title="Recorded at this blood center from what a watcher brought">Walk-in</span>
                <span
                  v-else-if="r.weeklyReference"
                  class="chip"
                  :title="`Weekly request ${r.weeklyReference}: supply what you can — it is dispatched in one delivery, and whatever is not supplied is closed`"
                >Weekly</span>
                <span v-else-if="r.ptrReference" class="chip" :title="`One facility's share of Patient Transfusion Request ${r.ptrReference}`">Share</span>
              </td>
              <td class="c-date nowrap">
                {{ r.date }}
                <span class="sub">{{ r.time }}</span>
              </td>
              <td class="c-hospital">
                <span class="strong">{{ r.hospital }}</span>
                <span v-if="!r.registered" class="chip" title="Named on a walk-in: no accounts on RedAgos, so it is not notified and cannot follow the request">Not on RedAgos</span>
                <span v-if="r.requestedBy" class="sub">{{ r.requestedBy }}</span>
              </td>
              <td v-if="isPatientTab" class="c-patient">
                <span class="patient">
                  <span class="patient__name" :class="{ muted: !r.patient }">{{ r.patient || r.patientFallback }}</span>
                  <span v-for="code in r.bloodTypes" :key="code" class="blood">{{ code }}</span>
                </span>
              </td>
              <!-- A restocking order names no patient; a weekly one can ask
                   for several blood types. -->
              <td v-else class="c-patient">
                <span class="patient">
                  <span v-for="code in r.bloodTypes" :key="code" class="blood">{{ code }}</span>
                  <span v-if="!r.bloodTypes.length" class="muted">—</span>
                </span>
              </td>
              <!-- One chip per component, by its bag-label code, as the
                   Processed list shows them; the full name is the tooltip. -->
              <td class="c-component" :title="r.component">
                <span class="codes">
                  <span v-for="chip in r.componentChips" :key="chip.key" class="code-chip">{{ chip.code }}</span>
                </span>
              </td>
              <td class="c-units nowrap" :title="`${r.issued} issued of ${r.units} requested${r.held ? `, ${r.held} reserved and waiting to go out` : ''}`">
                {{ r.issued }} / {{ r.units }}
                <span v-if="r.held" class="sub">{{ r.held }} reserved</span>
              </td>
              <td class="c-priority">
                <span class="badge" :class="r.emergency ? 'badge--crit' : 'badge--neutral'">
                  <span class="badge__dot" aria-hidden="true" />
                  {{ r.priority }}
                </span>
              </td>
              <td class="c-status">
                <span class="badge" :class="`badge--${r.tone}`" :title="r.status">
                  <span class="badge__dot" aria-hidden="true" />
                  <span class="badge__text">{{ r.status }}</span>
                </span>
              </td>
              <td class="c-actions">
                <div class="row-actions">
                  <button type="button" class="icon-btn" :aria-label="`Review ${r.code}`" title="Review" @click="openReview(r)">
                    <AssetIcon name="eye" :size="15" />
                  </button>
                  <!-- Reserve stock for what it still needs: approving a new
                       request, or topping up one part held. -->
                  <template v-if="r.canReserve">
                    <button
                      v-if="canAllocate"
                      type="button"
                      class="icon-btn icon-btn--ok"
                      :disabled="isMutating(r.id)"
                      :aria-label="`${r.statusValue === 'pending' ? 'Approve and reserve' : 'Reserve the rest of'} ${r.code}`"
                      :title="r.statusValue === 'pending' ? 'Approve and reserve' : 'Reserve the rest'"
                      @click="requestApprove(r)"
                    >
                      <AssetIcon name="check" :size="15" />
                    </button>
                  </template>
                  <!-- Only while nothing is held or sent: the server refuses
                       a rejection once a unit is claimed. -->
                  <template v-if="r.canReject">
                    <button
                      v-if="canDecide"
                      type="button"
                      class="icon-btn icon-btn--danger"
                      :disabled="isMutating(r.id)"
                      :aria-label="`Reject ${r.code}`"
                      title="Reject"
                      @click="requestReject(r)"
                    >
                      <AssetIcon name="x" :size="15" />
                    </button>
                  </template>
                  <button type="button" class="icon-btn" :aria-label="`Download the request form for ${r.code}`" title="Request form (PDF)" @click="handleExportPdf(r)">
                    <AssetIcon name="file-down" :size="15" />
                  </button>
                  <!-- Issue is dispatch, on Request Fulfillment: open once units
                       are reserved, and says why not before then. -->
                  <template v-if="r.isOpen && canRelease">
                    <NuxtLink v-if="r.held > 0" to="/blood-center/fulfillment" class="btn-issue" :aria-label="`Issue ${r.code}`">
                      <AssetIcon name="send" :size="13" />
                      Issue
                    </NuxtLink>
                    <span v-else class="btn-issue btn-issue--off" role="link" aria-disabled="true" title="Approve and reserve units first">
                      <AssetIcon name="send" :size="13" />
                      Issue
                    </span>
                  </template>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <footer class="pager">
        <span class="pager__info">{{ meta.total }} record(s)</span>
        <div class="pager__btns">
          <button type="button" class="btn btn-outline btn-sm" :disabled="meta.current_page <= 1 || loading" @click="loadRequests(meta.current_page - 1)">
            <AssetIcon name="chevron-left" :size="14" />
            Prev
          </button>
          <span class="pager__page">Page {{ meta.current_page }} / {{ meta.last_page }}</span>
          <button type="button" class="btn btn-outline btn-sm" :disabled="meta.current_page >= meta.last_page || loading" @click="loadRequests(meta.current_page + 1)">
            Next
            <AssetIcon name="chevron-right" :size="14" />
          </button>
        </div>
      </footer>
    </section>

    <!--
      REVIEW: a centred dialog, laid out like Donor Management's profile
      (project owner, 2026-10-19; it was a side drawer). The approve and
      reject confirmations open over it.
    -->
    <Transition name="review">
      <div v-if="drawerOpen" class="review-overlay" @click.self="closeDrawer">
        <div class="review-card" role="dialog" aria-modal="true" aria-labelledby="review-title">
          <div class="review-card__header">
            <h2 id="review-title" class="review-card__title">
              <AssetIcon name="clipboard-check" :size="17" />
              Review Request
            </h2>
            <button type="button" class="review-card__close" aria-label="Close" @click="closeDrawer">
              <AssetIcon name="x" :size="18" />
            </button>
          </div>

          <div class="review-card__body">
            <div v-if="drawerLoading" class="drawer-loading">
              <div v-for="n in 4" :key="n" class="skeleton-row" />
            </div>

            <template v-else-if="activeRequest">
              <!-- Who asked, for what, and where it stands. -->
              <div class="review-hero">
                <div class="review-hero__text">
                  <div class="review-hero__row">
                    <p class="review-hero__code">{{ activeRequest.code }}</p>
                    <span class="badge" :class="activeRequest.emergency ? 'badge--crit' : 'badge--neutral'">
                      <span class="badge__dot" aria-hidden="true" />
                      {{ activeRequest.priority }}
                    </span>
                    <span class="badge" :class="`badge--${activeRequest.tone}`">
                      <span class="badge__dot" aria-hidden="true" />
                      {{ activeRequest.status }}
                    </span>
                    <span
                      v-if="!activeRequest.registered"
                      class="badge badge--neutral"
                      title="Named on a walk-in: no accounts on RedAgos, so it is not notified and cannot follow the request"
                    >
                      <span class="badge__dot" aria-hidden="true" />
                      Not on RedAgos
                    </span>
                  </div>
                  <p class="review-hero__name">{{ activeRequest.hospital }}</p>
                  <p class="review-hero__meta">
                    {{ activeRequest.requestDate }} · {{ activeRequest.sourceLabel }}<template v-if="activeRequest.purpose"> · {{ activeRequest.purpose }}</template>
                  </p>
                </div>
                <div class="review-hero__actions">
                  <button type="button" class="btn btn-outline btn-sm" @click="handleExportPdf(activeRequest)">
                    <AssetIcon name="file-down" :size="13" />
                    Request form
                  </button>
                </div>
              </div>

              <dl class="facts">
                <div class="fact"><dt>Submitted by</dt><dd>{{ activeRequest.requestedBy || 'Not recorded' }}</dd></div>
                <div class="fact"><dt>Needed by</dt><dd>{{ activeRequest.neededBy }}</dd></div>
                <div class="fact">
                  <dt>Units</dt>
                  <dd>
                    {{ activeRequest.issued }} of {{ activeRequest.units }} issued
                    <span v-if="activeRequest.held" class="fact__sub">{{ activeRequest.held }} reserved, waiting to go out</span>
                  </dd>
                </div>
                <div class="fact">
                  <dt>Blood type</dt>
                  <dd class="blood-pills">
                    <span v-for="code in activeRequest.bloodTypes" :key="code" class="blood">{{ code }}</span>
                    <span v-if="!activeRequest.bloodTypes.length">—</span>
                  </dd>
                </div>
                <div class="fact fact--wide">
                  <dt>Patient</dt>
                  <dd>
                    {{ activeRequest.patient || activeRequest.patientFallback }}
                    <span v-if="activeRequest.patientDetails" class="fact__sub">{{ activeRequest.patientDetails }}</span>
                  </dd>
                </div>
                <div class="fact fact--wide"><dt>Component</dt><dd>{{ activeRequest.component }}</dd></div>
                <div class="fact fact--full"><dt>Hospital address</dt><dd>{{ activeRequest.contact || 'Not recorded' }}</dd></div>
                <div v-if="activeRequest.reason" class="fact fact--full"><dt>Rejected because</dt><dd class="fact__notes">{{ activeRequest.reason }}</dd></div>
              </dl>

              <section v-if="activeRequest.raw?.walk_in" class="sub-section">
                <h3 class="sub-section__title">
                  <AssetIcon name="phone" :size="14" />
                  Walk-in
                </h3>
                <WalkInDetailsCard
                  :walk-in="activeRequest.raw.walk_in"
                  :centre-name="activeRequest.raw.target_facility?.name || ''"
                  :recorder-name="activeRequest.raw.recorder_name || ''"
                />
              </section>

              <!--
                The hospital may have split the patient's need across several
                centres. This centre sees its own share against the whole — never
                which other centres were asked.
              -->
              <section v-if="activeRequest.raw?.transfusion_request" class="sub-section">
                <h3 class="sub-section__title">
                  <AssetIcon name="users" :size="14" />
                  Patient Transfusion Request
                </h3>
                <p class="share-note">
                  This request is this center's share of
                  <strong class="mono">{{ activeRequest.raw.transfusion_request.reference_number }}</strong>.
                  The patient needs {{ shareSummary(activeRequest.raw) }} in all; other facilities may be supplying the rest.
                  Approve what you can reserve, or close the rest as unavailable so the hospital can ask elsewhere.
                </p>
                <!-- Once something here is closed as unavailable, the watcher can
                     carry the rest to another centre (project owner, 2026-10-19). -->
                <div v-if="activeRequest.items.some((item) => item.closed_at)" class="share-actions">
                  <button type="button" class="btn btn-outline btn-sm" :disabled="printingSlip" @click="printReferralSlip(activeRequest)">
                    <AssetIcon name="printer" :size="13" />
                    {{ printingSlip ? 'Preparing…' : 'Referral slip for the watcher' }}
                  </button>
                  <span class="share-actions__hint">What is still needed, for the next blood center.</span>
                </div>
              </section>

              <section id="review-availability" class="sub-section">
                <h3 class="sub-section__title">
                  <AssetIcon name="package-search" :size="14" />
                  Inventory Availability
                </h3>
                <!--
                  One row per component. A request can ask for several, each
                  answered from a different shelf, so a single "Requested /
                  Available" pair could only ever describe the first of them.
                -->
                <div v-if="(activeRequest.lines || []).length" class="table-box">
                  <table class="avail-table">
                    <thead>
                      <tr>
                        <th scope="col">Component</th>
                        <th scope="col" class="num">Requested</th>
                        <th scope="col" class="num">Outstanding</th>
                        <th scope="col" class="num">Available</th>
                        <th scope="col">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="line in activeRequest.lines" :key="line.request_item_id">
                        <td>{{ line.component?.name ? requestLineLabel(activeRequest.raw, line) : 'Not recorded' }}</td>
                        <td class="num">{{ line.requested ?? '—' }}</td>
                        <td class="num">{{ line.outstanding }}</td>
                        <td class="num">{{ line.available }}</td>
                        <td>
                          <span class="inv-inline" :class="'inv-' + lineLevel(line)">
                            <AssetIcon :name="inventoryIcon(lineLevel(line))" :size="12" />
                            {{ lineLevel(line) === 'ok'
                              ? 'Can cover'
                              : lineLevel(line) === 'low'
                                ? `Part only (${line.can_cover_now})`
                                : 'No stock' }}
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <p v-else class="sub-section__note">Availability is loading.</p>

                <p class="inventory-status-line" :class="'inv-' + availabilityLevel(activeRequest)">
                  <AssetIcon :name="inventoryIcon(availabilityLevel(activeRequest))" :size="14" />
                  {{ availabilityLevel(activeRequest) === 'ok'
                    ? 'Sufficient Inventory'
                    : availabilityLevel(activeRequest) === 'low'
                      ? 'Partial Inventory — some units can be reserved now'
                      : 'Insufficient Inventory' }}
                </p>

                <p class="inventory-advisory">
                  Advisory at {{ activeRequest.availabilityAsOf || 'this moment' }} — nothing is held until you
                  approve, and allocation re-checks every unit under a lock before reserving.
                </p>
              </section>

              <!--
                Request versus fulfilment, per component. What was asked for is
                never recomputed from what was supplied; a remainder this centre
                cannot supply is closed here with a reason, and may still be
                sourced from another facility by the hospital.
              -->
              <section v-if="activeRequest.raw" class="sub-section">
                <h3 class="sub-section__title">
                  <AssetIcon name="truck" :size="14" />
                  Fulfilment
                </h3>
                <RequestFulfilmentTable
                  :request="activeRequest.raw"
                  :closable="canDecide"
                  close-label="Close as unavailable"
                  :busy-item-id="closingLine ? lineToClose?.id ?? null : null"
                  @close-line="openCloseLine"
                />
              </section>

              <section class="sub-section">
                <h3 class="sub-section__title">
                  <AssetIcon name="history" :size="14" />
                  Request History
                </h3>
                <RequestHistoryTimeline :events="history" :loading="isLoadingHistory" :error="historyError || ''" />
              </section>
            </template>
          </div>

          <div class="review-card__footer">
            <p v-if="activeRequest && !activeRequest.isOpen" class="drawer-closed-note">
              This request is {{ activeRequest.status }} — nothing more can be allocated to it.
            </p>
            <button type="button" class="btn btn-outline" @click="closeDrawer">Close</button>
            <template v-if="activeRequest && activeRequest.isOpen">
              <template v-if="activeRequest.canReject">
                <button v-if="canDecide" class="btn btn-outline btn-outline--danger" :disabled="drawerMutating" @click="requestReject(activeRequest)">
                  Reject Request
                </button>
              </template>
              <!-- Reserving only while something is still needed; once all of
                   it is held, the next step is issuing it. -->
              <template v-if="activeRequest.canReserve">
                <button
                  v-if="availabilityLevel(activeRequest) === 'insufficient'"
                  class="btn btn-outline"
                  @click="handleReviewInventory(activeRequest)"
                >
                  Review Inventory
                </button>
                <button
                  v-else-if="canAllocate"
                  class="btn btn-primary"
                  :disabled="drawerMutating"
                  @click="requestApprove(activeRequest)"
                >
                  {{ drawerMutating ? 'Processing…' : 'Approve & Reserve' }}
                </button>
              </template>
              <NuxtLink v-else-if="activeRequest.held > 0 && canRelease" to="/blood-center/fulfillment" class="btn btn-primary">
                <AssetIcon name="send" :size="14" />
                Issue
              </NuxtLink>
            </template>
          </div>
        </div>
      </div>
    </Transition>

    <!--
      APPROVE AND RESERVE: staff pick the bags (project owner, 2026-10-19).
      The server holds exactly those, or refuses the pick unit by unit.
    -->
    <UnitPickerDialog
      v-if="showApproveModal && requestToApprove"
      ref="pickerRef"
      :request="requestToApprove"
      :busy="approving"
      :error="approveError"
      :unit-errors="unitErrors"
      @close="closeApproveModal"
      @confirm="confirmApprove"
    />

    <!-- REJECTION MODAL -->
    <div v-if="showRejectModal" class="modal-overlay" @click.self="closeRejectModal">
      <div class="modal">
        <h2 class="modal-title">Reject Blood Request?</h2>
        <p class="modal-desc">{{ requestToReject?.id }} — {{ requestToReject?.hospital }}</p>
        <div class="field">
          <label class="field-label">Rejection Reason *</label>
          <select v-model="rejectReason" class="field-select">
            <option value="" disabled>Select a reason</option>
            <option>Insufficient Inventory</option>
            <option>Invalid Request</option>
            <option>Duplicate Request</option>
            <option>Request Cancelled by Hospital</option>
            <option>Other</option>
          </select>
        </div>
        <div class="field">
          <label class="field-label">Additional Notes</label>
          <textarea
            v-model="rejectNotes"
            class="field-textarea"
            rows="3"
            placeholder="Optional context for this rejection"
          />
        </div>
        <div class="modal-actions">
          <button class="btn btn-outline" :disabled="rejecting" @click="closeRejectModal">Cancel</button>
          <button class="btn btn-danger" :disabled="!rejectReason || rejecting" @click="confirmReject">
            {{ rejecting ? 'Rejecting…' : 'Reject Request' }}
          </button>
        </div>
      </div>
    </div>

    <!-- WALK-IN: recorded only after the hospital blood bank confirms by phone -->
    <WalkInRequestDialog
      v-if="showWalkIn"
      @close="showWalkIn = false"
      @created="onWalkInCreated"
      @open-existing="onOpenExisting"
    />

    <!-- WHAT THE WATCHER CARRIES TO THE NEXT CENTRE -->
    <ReferralSlipSheet />

    <!-- CLOSE A LINE THIS CENTRE CANNOT SUPPLY -->
    <CloseLineDialog
      v-if="lineToClose"
      :row="lineToClose"
      side="centre"
      :busy="closingLine"
      :error="closeLineError"
      @close="closeCloseLine"
      @confirm="confirmCloseLine"
    />
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import CloseLineDialog from '~/components/common/CloseLineDialog.vue'
import DateRangeFilter from '~/components/common/DateRangeFilter.vue'
import RequestFulfilmentTable from '~/components/common/RequestFulfilmentTable.vue'
import RequestHistoryTimeline from '~/components/common/RequestHistoryTimeline.vue'
import WalkInDetailsCard from '~/components/common/WalkInDetailsCard.vue'
import WalkInRequestDialog from '~/components/BloodCenter/WalkInRequestDialog.vue'
import UnitPickerDialog from '~/components/BloodCenter/UnitPickerDialog.vue'
import ReferralSlipSheet from '~/components/BloodCenter/ReferralSlipSheet.vue'
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useIncomingRequests } from '~/composables/useIncomingRequests'
import {
  bloodTypeCodes,
  bloodTypeSummary,
  componentSummary,
  hasMixedBloodTypes,
  requestLineLabel,
  requestStatusLabel,
} from '~/types/bloodRequest'
import { formatShortDate } from '~/utils/donorRecords'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'

definePageMeta({ middleware: ['auth', 'department'], layout: 'blood-centerdashboard',
  requires: 'requests.view',
})

// Two abilities split this queue. Reserving units against a request
// (requests.process) is the Inventory Control Officer's; declining or handing
// holds back (requests.approve) is also dispatch's, who never picks units.
// A privilege cap can remove either.
const { can } = useUser()
const canAllocate = computed(() => can('requests.process'))
const canDecide = computed(() => can('requests.approve'))
// Recording a walk-in is Issuance's: the counter a watcher reaches. The
// toolbar renders on the server, which has no signed-in user, so this waits
// for the browser rather than have the server's markup and the client's differ.
const hydrated = ref(false)
const canRecord = computed(() => hydrated.value && can('requests.record'))
// Issuing is dispatch, done on Request Fulfillment.
const canRelease = computed(() => can('requests.release'))

const {
  requests: apiRequests,
  // Read for the tabs' open counts; the composable refreshes it after every action.
  summary,
  selected,
  inventory,
  filters,
  meta,
  history,
  isLoading: loading,
  isLoadingHistory,
  isActing,
  error,
  historyError,
  fetchRequests,
  fetchSummary,
  openRequest,
  fetchHistory,
  allocate,
  reject,
  closeLine,
} = useIncomingRequests()

/* ------------------------------------------------------------------ *
 * API row -> the view model this page's markup was written against.
 * ------------------------------------------------------------------ */

function formatDateTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

/**
 * What the patient needs in all, beside this centre's share of it.
 *
 * "Packed RBC 5 (you are asked for 1)" — so a reviewer reading a share of one
 * unit knows it is part of a larger need being met elsewhere.
 */
function shareSummary(raw) {
  const asked = Object.fromEntries((raw?.items ?? []).map((item) => [item.component?.id, item.quantity]))

  return (raw?.transfusion_request?.required ?? [])
    .map((line) => {
      const name = line.component ?? 'a component'
      const mine = asked[line.component_id]

      return mine ? `${name} ${line.quantity} (you are asked for ${mine})` : `${name} ${line.quantity}`
    })
    .join(', ') || 'more than this request'
}

/**
 * Each component a request asks for once, by its bag-label code, the full
 * name as the fallback. A weekly request repeats a component across blood
 * types, hence the distinct.
 */
function componentChips(items) {
  const seen = new Map()

  for (const item of items) {
    const key = item.component?.id ?? item.component?.name
    if (key === undefined || key === null || seen.has(key)) continue
    seen.set(key, { key, code: item.component?.code || item.component?.name || '—' })
  }

  return seen.size ? [...seen.values()] : [{ key: 'none', code: '—' }]
}

/**
 * Status tones on the list's dot badges. Waiting on a decision is amber,
 * being worked is blue, done is green, refused red, withdrawn grey.
 */
const STATUS_TONES = {
  pending: 'warn',
  processing: 'info',
  partial: 'info',
  fulfilled: 'ok',
  rejected: 'crit',
  cancelled: 'neutral',
}

/**
 * Flatten one request for the table and the drawer.
 *
 * `id` stays the numeric key every API call needs; `code` is the reference
 * number staff actually read. Fields the schema has no answer for — the
 * requesting doctor, their phone, the department — resolve to an em dash
 * rather than being invented, which is the rule this feature has followed
 * throughout.
 */
function mapRequest(r) {
  // allocated_count counts every claiming hold, dispatched ones included;
  // fulfilled_quantity is what has gone out. The difference is what is
  // reserved and waiting to be issued.
  const allocated = r.allocated_count ?? 0
  const issued = r.fulfilled_quantity ?? 0
  const units = r.quantity ?? 0
  const outstanding = r.outstanding_quantity ?? Math.max(0, units - allocated)
  const isOpen = r.is_open !== false

  return {
    id: r.id,
    code: r.reference_number ?? `#${r.id}`,
    date: formatShortDate(r.request_date) || '—',
    time: r.request_date
      ? new Date(r.request_date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      : '',
    hospital: r.requesting_facility?.name ?? '—',
    contact: r.requesting_facility?.address ?? '',
    // False for a hospital a centre named on a walk-in (project owner,
    // 2026-10-19): nobody there is notified.
    registered: r.requesting_facility?.is_registered !== false,
    // The hospital user who submitted it, or — for a walk-in, which nobody at
    // the hospital submitted — who recorded it here.
    requestedBy: r.requester_name
      ?? (r.is_walk_in ? `Walk-in · recorded by ${r.recorder_name ?? 'this center'}` : ''),
    isWalkIn: Boolean(r.is_walk_in),
    ptrReference: r.transfusion_request?.reference_number ?? null,
    weeklyReference: r.weekly_request?.reference_number ?? null,
    sourceLabel: r.source_label ?? 'Blood Bank Portal',
    // A weekly request is one request whose lines can each restock a
    // different blood type, so a row may carry several.
    bloodType: bloodTypeSummary(r),
    bloodTypes: bloodTypeCodes(r),
    mixedTypes: hasMixedBloodTypes(r),
    lineSummary: (r.items ?? []).map((item) => `${requestLineLabel(r, item)} ×${item.quantity}`).join(', '),
    component: componentSummary(r),
    componentChips: componentChips(r.items ?? []),
    units,
    items: r.items ?? [],
    allocated,
    issued,
    held: Math.max(0, allocated - issued),
    outstanding,
    priority: r.is_emergency ? 'Emergency' : 'Routine',
    emergency: Boolean(r.is_emergency),
    status: requestStatusLabel(r),
    tone: STATUS_TONES[r.status] ?? 'neutral',
    // Keyed on the stored value, not the label: "Partially Fulfilled (Closed)"
    // is not a class name.
    statusClass: `status-${r.status ?? 'pending'}`,
    statusValue: r.status,
    isOpen,
    // What the row offers, before the abilities are asked. Reserving needs
    // something still to find; rejecting needs nothing held or sent, which
    // is what the server checks.
    canReserve: isOpen && outstanding > 0,
    canReject: isOpen && allocated === 0,
    // The API shape, for the shared fulfilment and walk-in components.
    raw: r,
    urgency: r.urgency_level,
    purpose: r.purpose_label ?? '',
    patient: r.patient?.full_name ?? '',
    // Age and sex as the form records them, for the review.
    patientDetails: [
      r.patient?.age ? `${r.patient.age} years` : null,
      r.patient?.sex ? r.patient.sex.charAt(0).toUpperCase() + r.patient.sex.slice(1) : null,
    ].filter(Boolean).join(' · '),
    // A restocking order names no patient.
    patientFallback: r.request_purpose === 'replenishment' ? 'Replenishment' : '—',
    requestDate: formatDateTime(r.request_date),
    neededBy: r.is_emergency ? 'Immediate' : 'Routine',
    reason: r.rejection_reason ?? '',
    reference_number: r.reference_number,
  }
}

const rows = computed(() => (apiRequests.value ?? []).map(mapRequest))

/* TOASTS */
const toasts = ref([])
let toastId = 0
function toast(title, variant = 'success', message = '') {
  const id = ++toastId
  toasts.value.push({ id, title, message, variant })
  setTimeout(() => {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }, 3600)
}

/* FILTERS */
// "Open" is every request still being worked; the rest are the statuses the
// API stores.
const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'partial', label: 'Partially Fulfilled' },
  { value: 'fulfilled', label: 'Fulfilled' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
]

/*
 * What a request is for, one tab each (project owner, 2026-10-19): a named
 * patient's transfusion, walk-ins and shares of a Patient Transfusion Request
 * among them, or a hospital blood bank restocking its own shelves, weekly
 * orders among them. The tab is kept in the address as ?type=, so a refresh
 * or a shared link opens the same one.
 */
const PURPOSE_TABS = [
  { value: 'patient_transfusion', label: 'Patient Requests', icon: 'users', query: 'patient' },
  { value: 'replenishment', label: 'Inventory Replenishment', icon: 'package', query: 'replenishment' },
]

const route = useRoute()
const router = useRouter()

const purposeTab = ref(route.query.type === 'replenishment' ? 'replenishment' : 'patient_transfusion')
const isPatientTab = computed(() => purposeTab.value === 'patient_transfusion')

/** What is still open on a tab, from the queue summary. */
function openCount(purpose) {
  return summary.value?.open_by_purpose?.[purpose] ?? 0
}

function selectTab(purpose) {
  if (purposeTab.value === purpose) return
  purposeTab.value = purpose

  const query = PURPOSE_TABS.find((tab) => tab.value === purpose)?.query
  router.replace({ query: { ...route.query, type: query } })
  loadRequests()
}

const searchQuery = ref('')
const statusFilter = ref('')
const fromDate = ref('')
const toDate = ref('')

const hasFilters = computed(() => Boolean(searchQuery.value.trim() || statusFilter.value || fromDate.value || toDate.value))

const listSummary = computed(() => {
  if (hasFilters.value) return `${meta.value.total} request${meta.value.total === 1 ? '' : 's'} match the filters`

  return isPatientTab.value
    ? 'Blood for a named patient, walk-ins included: open ones first, emergencies at the top.'
    : 'Hospital blood banks restocking their own shelves, weekly orders included: open ones first.'
})

const lastUpdatedAt = ref(null)
const lastUpdatedLabel = computed(() => lastUpdatedAt.value?.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) ?? '')

/** The filters as the API takes them, for the list and its export alike. */
function filterParams() {
  const params = { request_purpose: purposeTab.value }
  if (searchQuery.value.trim()) params.search = searchQuery.value.trim()
  if (statusFilter.value === 'open') params.open = 1
  else if (statusFilter.value) params.status = statusFilter.value
  if (fromDate.value) params.from = fromDate.value
  if (toDate.value) params.to = toDate.value
  return params
}

let searchDebounce = null
function onSearchInput() {
  clearTimeout(searchDebounce)
  searchDebounce = setTimeout(() => loadRequests(), 300)
}

/** Push the toolbar into the composable's filter bag, then load a page. */
async function loadRequests(page = 1) {
  const params = filterParams()

  filters.request_purpose = params.request_purpose
  filters.search = params.search
  filters.status = params.status
  filters.open = params.open
  filters.from = params.from
  filters.to = params.to

  await fetchRequests(page)
  lastUpdatedAt.value = new Date()
}

function resetFilters() {
  searchQuery.value = ''
  statusFilter.value = ''
  fromDate.value = ''
  toDate.value = ''
  loadRequests()
}

async function handleRefresh() {
  await Promise.all([loadRequests(meta.value.current_page), fetchSummary()])
}

/**
 * Whether an action is in flight against this row.
 *
 * The composable exposes one `isActing` flag for the whole queue, so the id of
 * the row being acted on is tracked here to keep the spinner on the right one.
 */
const mutatingId = ref(null)
function isMutating(id) {
  return isActing.value && mutatingId.value === id
}

/* EXPORT — the list as CSV, with its filters, every page */
const exporting = ref(false)

async function handleExportAll() {
  exporting.value = true
  try {
    const blob = await bloodCenterService.exportIncomingRequests(filterParams())
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${isPatientTab.value ? 'patient-requests' : 'replenishment-requests'}-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (err) {
    toast('Export Failed', 'danger', err?.message || 'Could not export the requests. Please try again.')
  } finally {
    exporting.value = false
  }
}

/* REVIEW DRAWER */
const drawerOpen = ref(false)
const drawerLoading = ref(false)
const activeRequest = ref(null)

const drawerMutating = computed(() => Boolean(activeRequest.value) && isActing.value)

/**
 * Rebuild the drawer's view of the request from what the composable loaded.
 *
 * Run on open and again whenever an action refreshes `selected`, so closing a
 * line or reserving stock updates the fulfilment table in place rather than
 * leaving the drawer showing the figures from before.
 */
function syncActiveRequest() {
  if (!drawerOpen.value || !selected.value) return

  const lines = inventory.value?.lines ?? []

  activeRequest.value = {
    ...mapRequest(selected.value),
    available: lines.reduce((sum, line) => sum + (line.available ?? 0), 0),
    outstanding: inventory.value?.outstanding ?? 0,
    canFullyCover: inventory.value?.can_fully_cover ?? false,
    availabilityAsOf: inventory.value?.as_of
      ? new Date(inventory.value.as_of).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
      : null,
    lines,
  }
}

watch([selected, inventory], syncActiveRequest)

/**
 * Open one request beside the stock that could fill it, and its history.
 *
 * fetchRequestDetail() never existed; the composable's openRequest() loads
 * `selected` and `inventory` instead. The per-line availability from the
 * review endpoint is folded back in so the drawer can show real coverage.
 */
async function openReview(request) {
  drawerOpen.value = true
  drawerLoading.value = true
  activeRequest.value = request

  try {
    await Promise.all([openRequest(request.id), fetchHistory(request.id)])
    syncActiveRequest()
  } finally {
    drawerLoading.value = false
  }
}

/* CLOSE A LINE — what this centre cannot supply */
const lineToClose = ref(null)
const closingLine = ref(false)
const closeLineError = ref('')

function openCloseLine(row) {
  lineToClose.value = row
  closeLineError.value = ''
}

function closeCloseLine() {
  if (closingLine.value) return
  lineToClose.value = null
}

async function confirmCloseLine(note) {
  if (!activeRequest.value || !lineToClose.value) return

  closingLine.value = true
  closeLineError.value = ''

  try {
    const result = await closeLine(activeRequest.value.id, lineToClose.value.id, note)
    toast(
      'Remaining quantity closed',
      'success',
      // The hospital is notified by the server; a watcher can carry the rest.
      (result?.is_open === false
        ? `${activeRequest.value.code} is now ${result.status_label} and closed.`
        : `The rest of ${lineToClose.value.component} is recorded as unavailable here.`)
        + (activeRequest.value.registered
          ? ' The hospital has been told.'
          : ' The hospital is not on RedAgos, so let the watcher know.')
        + (activeRequest.value.raw?.transfusion_request ? ' Hand the watcher a referral slip from the review.' : ''),
    )
    lineToClose.value = null
  } catch (err) {
    closeLineError.value = err?.message || 'The remaining quantity could not be closed.'
  } finally {
    closingLine.value = false
  }
}

/* REFERRAL SLIP — what the watcher carries when this centre cannot supply it all */
const { printSlip } = useReferralSlip()
const printingSlip = ref(false)

async function printReferralSlip(request) {
  if (!request) return
  printingSlip.value = true

  try {
    const data = await bloodCenterService.referralSlip(request.id)

    if (!data?.still_needed) {
      toast('Nothing still needed elsewhere', 'info', "Every unit of the patient's request is already asked of a facility, so there is nothing for the watcher to carry on.")
      return
    }

    await printSlip(data)
  } catch (err) {
    toast('Could not prepare the slip', 'danger', err?.message || 'Please try again in a moment.')
  } finally {
    printingSlip.value = false
  }
}

/* WALK-IN */
const showWalkIn = ref(false)

async function onWalkInCreated(response) {
  showWalkIn.value = false
  const created = response?.request

  toast(
    'Walk-in request recorded',
    'success',
    created ? `${created.reference_number} is in the queue for ${created.requesting_facility?.name ?? 'the hospital'}.` : '',
  )

  await loadRequests()

  if (created) openReview(mapRequest(created))
}

function onOpenExisting(id) {
  showWalkIn.value = false
  const existing = rows.value.find((r) => r.id === id)

  openReview(existing ?? { id, code: `#${id}`, status: '', statusClass: '', priority: 'Routine' })
}

function closeDrawer() {
  drawerOpen.value = false
  setTimeout(() => (activeRequest.value = null), 250)
}

/** Bring the review's availability table into view. */
function handleReviewInventory() {
  document.getElementById('review-availability')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/**
 * Escape closes the review, unless a dialog over it is open: those close
 * themselves first, so one press never shuts two.
 */
function onKeydown(event) {
  if (event.key !== 'Escape' || !drawerOpen.value) return
  if (showApproveModal.value || showRejectModal.value || lineToClose.value || showWalkIn.value) return
  closeDrawer()
}

/* APPROVAL — staff pick the units to reserve (project owner, 2026-10-19) */
const showApproveModal = ref(false)
const requestToApprove = ref(null)
const approving = ref(false)
const approveError = ref('')
// Unit id → why the server would not hold it, shown against its row.
const unitErrors = ref({})
const pickerRef = ref(null)

/**
 * Open the unit picker for a request.
 *
 * The picker asks the server which units each line may take; nothing is
 * refused up front here. Allocation re-checks every pick under a lock.
 */
function requestApprove(request) {
  if (!request) return
  requestToApprove.value = request
  approveError.value = ''
  unitErrors.value = {}
  showApproveModal.value = true
}

function closeApproveModal() {
  if (approving.value) return
  showApproveModal.value = false
  requestToApprove.value = null
}

/** Hold exactly the units picked; on a refusal, say which unit and why. */
async function confirmApprove(unitIds) {
  if (!requestToApprove.value || !unitIds?.length) return
  approving.value = true
  approveError.value = ''
  unitErrors.value = {}
  mutatingId.value = requestToApprove.value.id

  try {
    // The composable refreshes the list, the counts and an open review.
    const result = await allocate(requestToApprove.value.id, unitIds)
    toast(
      `${unitIds.length} unit${unitIds.length === 1 ? '' : 's'} reserved`,
      'success',
      `${requestToApprove.value.code}: ${result?.message || 'stock has been reserved.'}`,
    )
    showApproveModal.value = false
    requestToApprove.value = null
  } catch (err) {
    // A refusal names each unit it could not take as unit_ids.N; map those
    // back onto the units, and reload the list so a taken unit drops off.
    const errors = err?.data?.errors ?? {}
    const byUnit = {}

    for (const [key, messages] of Object.entries(errors)) {
      const index = Number(key.split('.')[1])
      if (key.startsWith('unit_ids.') && unitIds[index]) byUnit[unitIds[index]] = [messages].flat()[0]
    }

    unitErrors.value = byUnit
    approveError.value = Object.keys(byUnit).length
      ? 'Some of the units picked could not be reserved; nothing was held. Change the pick and try again.'
      : err?.message || 'The units could not be reserved. Please try again in a moment.'
    pickerRef.value?.reload()
  } finally {
    approving.value = false
    mutatingId.value = null
  }
}

/* REJECTION — confirmation modal with required reason*/
const showRejectModal = ref(false)
const requestToReject = ref(null)
const rejectReason = ref('')
const rejectNotes = ref('')
const rejecting = ref(false)

function requestReject(request) {
  if (!request) return
  requestToReject.value = request
  rejectReason.value = ''
  rejectNotes.value = ''
  showRejectModal.value = true
}

function closeRejectModal() {
  if (rejecting.value) return
  showRejectModal.value = false
  requestToReject.value = null
}

async function confirmReject() {
  if (!requestToReject.value || !rejectReason.value) return
  rejecting.value = true
  mutatingId.value = requestToReject.value.id

  // The API takes one reason string and shows it to the requester, so the
  // optional notes are appended rather than dropped.
  const reason = [rejectReason.value, rejectNotes.value].filter(Boolean).join(' — ')

  try {
    await reject(requestToReject.value.id, reason)
    toast('Request Rejected', 'danger', 'The request has been marked as rejected.')
    showRejectModal.value = false
    requestToReject.value = null
    closeDrawer()
    await loadRequests(meta.value.current_page)
  } catch (err) {
    toast('Unable to Reject Request', 'danger', err?.message || 'Please try again in a moment.')
  } finally {
    rejecting.value = false
    mutatingId.value = null
  }
}

/**
 * Download this incoming request as the DOH Blood Request Form (Adult).
 *
 * Byte-identical to the copy the requesting hospital prints — both portals
 * call the same server-side renderer.
 */
async function handleExportPdf(request) {
  try {
    const blob = await bloodCenterService.downloadRequestForm(request.id)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `BRF-${request.reference_number ?? request.id}.pdf`
    link.click()
    URL.revokeObjectURL(url)
  } catch (err) {
    console.error('Failed to download request form:', err)
    toast('Export Failed', 'danger', err?.message || 'Could not download the request form.')
  }
}

/* INVENTORY HELPERS */
/*
 * Coverage and availability are two different questions. Coverage is how much
 * stock is already held FOR the request; the list's Units column shows it.
 * Availability is how much issuable stock is on the shelf, which only the
 * review endpoint knows, per component; the drawer reads it here.
 *
 * They were briefly the same function, which is why a request for one unit
 * with one unit available still read "Insufficient Inventory": nothing had
 * been reserved yet, and coverage was being asked an availability question.
 */

/**
 * Whether the shelf can answer what is still outstanding.
 *
 * Measured against `outstanding` rather than the full request: units already
 * held are not needed from stock again, so judging against the original figure
 * would call a part-reserved request short when it is not.
 */
function availabilityLevel(request) {
  if (!request) return 'insufficient'

  const available = request.available ?? 0
  const needed = request.outstanding ?? request.units ?? 0

  if (needed <= 0) return 'ok'
  if (available >= needed) return 'ok'
  if (available > 0) return 'low'
  return 'insufficient'
}

/** Per-component availability, as the review endpoint reports it. */
function lineLevel(line) {
  if (!line) return 'insufficient'
  if (line.can_fully_cover) return 'ok'
  if ((line.available ?? 0) > 0) return 'low'
  return 'insufficient'
}

function inventoryIcon(level) {
  return { ok: 'check', low: 'triangle-alert', insufficient: 'x' }[level] || 'check'
}

/* INITIAL LOAD */
onMounted(() => {
  hydrated.value = true
  window.addEventListener('keydown', onKeydown)
  handleRefresh()
})

onBeforeUnmount(() => {
  clearTimeout(searchDebounce)
  window.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
/* TOKENS */
.page {
  /*
   * The list itself is drawn with the app's --rb-* tokens, like the other
   * list pages, so it follows the theme on its own. These page tokens serve
   * the review drawer and the dialogs. The `-fill` tokens are the surfaces
   * that carry white text, so they stay deep in both themes; the plain names
   * are the colours used AS text and icons, and those lift in the dark block
   * below.
   */
  --primary: #1565c0;
  --primary-fill: #1565c0;
  --primary-fill-hover: #0d47a1;
  --bg: #F7F8FA;
  --card: #ffffff;
  --border: #e5eaf0;
  --text: #1e293b;
  --text-secondary: #64748b;
  --success: #2e7d32;
  --success-fill: #2e7d32;
  /* amber-500 is 2.1:1 on the pale tint it sits on; amber-700 reads. The
     fill keeps the brighter value — nothing writes on it. */
  --warning: #b45309;
  --warning-fill: #f59e0b;
  --danger: #d32f2f;
  --danger-fill: #d32f2f;
  --info: #2563eb;
  --info-fill: #2563eb;
  --purple: #7c3aed;
  --radius: 14px;

  background: var(--rb-page-bg);
  color: var(--rb-text-primary);
  font-family: var(--rb-font-sans);
  /* Same column as every other blood-centre page, so a user moving between
     them does not see the content jump width and the gutters change. */
  max-width: var(--rb-content-max, 1600px);
  margin: 0 auto;
  padding: 24px var(--rb-gutter, 24px) 40px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* TOASTS */
.toast-stack {
  position: fixed; top: 20px; right: 20px; z-index: 300;
  display: flex; flex-direction: column; gap: 8px; max-width: 320px;
}
.toast {
  padding: 12px 16px; border-radius: 12px; color: #fff;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
}
.toast-title { font-size: 13px; font-weight: 600; }
.toast-message { font-size: 12.5px; font-weight: 400; line-height: 1.55; margin-top: 2px; }
.toast--success { background: var(--success-fill); }
.toast--danger { background: var(--danger-fill); }
.toast--warning { background: #B45309; }
.toast--info { background: var(--info-fill); }
.toast-enter-active, .toast-leave-active { transition: all 0.25s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateX(20px); }

/* HEADER */
.header-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.page-title { font-size: 20px; font-weight: 700; letter-spacing: -0.02em; margin: 0; }
.page-subtitle { font-size: 13px; color: var(--rb-text-secondary); margin: 3px 0 0; max-width: 80ch; }

/* BUTTONS: the list pages' set, shared by the toolbar, the drawer and the dialogs. */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  height: 36px;
  padding: 0 14px;
  border: 1px solid transparent;
  border-radius: 10px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
  text-decoration: none;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s ease, border-color 0.15s ease, opacity 0.15s ease;
}

.btn-sm { height: 30px; padding: 0 10px; font-size: 12px; border-radius: 8px; gap: 4px; }
.btn-primary { color: #fff; background: var(--rb-primary); border-color: var(--rb-primary); }
.btn-primary:hover:not(:disabled) { background: color-mix(in srgb, var(--rb-primary) 88%, #000); }
.btn-outline { color: var(--rb-text-primary); background: var(--rb-surface); border-color: var(--rb-border-strong); }
.btn-outline:hover:not(:disabled) { background: var(--rb-surface-hover); border-color: var(--rb-border-hover); }
.btn-danger { color: #fff; background: var(--rb-accent); border-color: var(--rb-accent); }
.btn-danger:hover:not(:disabled) { background: color-mix(in srgb, var(--rb-accent) 88%, #000); }
.btn:disabled { opacity: 0.55; cursor: not-allowed; }

.btn-link {
  background: none;
  border: none;
  padding: 0;
  color: var(--rb-primary-text);
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.btn-link:hover { text-decoration: underline; }

.btn:focus-visible,
.btn-link:focus-visible,
.icon-btn:focus-visible,
.code-link:focus-visible,
.btn-issue:focus-visible {
  outline: none;
  box-shadow: var(--rb-focus-ring);
}

.icon-btn {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  border: 1px solid var(--rb-border-strong);
  border-radius: 8px;
  background: var(--rb-surface);
  color: var(--rb-text-secondary);
  text-decoration: none;
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease, border-color 0.12s ease;
}

.icon-btn:hover:not(:disabled) { color: var(--rb-primary-text); border-color: rgba(var(--rb-primary-rgb), 0.45); background: var(--rb-surface-hover); }
.icon-btn--ok:hover:not(:disabled) { color: var(--rb-success-text); border-color: rgba(var(--rb-success-rgb), 0.45); }
.icon-btn--danger:hover:not(:disabled) { color: var(--rb-accent-text); border-color: rgba(var(--rb-accent-rgb), 0.45); }
.icon-btn:disabled { opacity: 0.35; cursor: not-allowed; }

.spinning { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* BANNER */
.banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid var(--rb-border);
  background: var(--rb-surface);
  font-size: 13px;
}

.banner > :deep(.asset-icon) { flex-shrink: 0; }
.banner__text { flex: 1; margin: 0; line-height: 1.45; }
.banner--error { border-color: rgba(var(--rb-accent-rgb), 0.35); }
.banner--error > :deep(.asset-icon) { color: var(--rb-accent-text); }

/* TABS: Fulfillment's segmented bar, one tab per kind of request. */
.tabs {
  display: inline-flex;
  align-self: flex-start;
  flex-wrap: wrap;
  gap: 4px;
  padding: 4px;
  border: 1px solid var(--rb-border);
  border-radius: 12px;
  background: var(--rb-surface);
}

.tab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 14px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: var(--rb-text-secondary);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.tab:hover { color: var(--rb-text-primary); }
.tab--on { background: var(--rb-primary); color: #fff; }
.tab--on:hover { color: #fff; }
.tab:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }

.tab__count {
  min-width: 20px;
  padding: 0 7px;
  border-radius: 999px;
  background: var(--rb-surface-alt);
  color: var(--rb-text-primary);
  font-size: 11px;
  font-weight: 700;
  line-height: 18px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.tab--on .tab__count { background: #fff; color: var(--rb-primary); }

/* PANEL AND TOOLBAR */
.panel {
  container-type: inline-size;
  background: var(--rb-surface);
  border: 1px solid var(--rb-border);
  border-radius: 14px;
  box-shadow: 0 1px 2px rgba(var(--rb-shadow-rgb), 0.03);
  overflow: hidden;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 16px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--rb-border);
}

.toolbar__filters,
.toolbar__actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.toolbar__filters { flex: 1 1 auto; min-width: 0; }
.toolbar__actions { justify-content: flex-end; margin-left: auto; }

.updated {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-right: 4px;
  font-size: 12px;
  color: var(--rb-text-secondary);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

/* A small basis, so the filters and buttons share one line until the list
   is narrow; the search is what gives way. */
.search { position: relative; flex: 1 1 200px; min-width: 170px; max-width: 300px; }

.search__icon {
  position: absolute;
  left: 11px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--rb-text-secondary);
  pointer-events: none;
}

.search__input,
.select {
  height: 36px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  background-color: var(--rb-surface);
  font-family: inherit;
  font-size: 13px;
  color: var(--rb-text-primary);
}

.search__input { width: 100%; padding: 0 12px 0 34px; }

/* As wide as the chosen option, not the longest one (where supported). */
.select {
  field-sizing: content;
  padding: 0 30px 0 12px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2394a3b8' stroke-width='1.5' fill='none' fill-rule='evenodd'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 10px 6px;
  appearance: none;
  cursor: pointer;
}

.search__input::placeholder { color: var(--rb-placeholder); }

.search__input:focus,
.select:focus { outline: none; border-color: var(--rb-primary); box-shadow: var(--rb-focus-ring); }

/* TABLE */
.table-wrap { position: relative; overflow-x: auto; transition: opacity 0.15s ease; }
.table-wrap--busy { opacity: 0.55; }

.req-table { width: 100%; min-width: 760px; table-layout: fixed; border-collapse: collapse; font-size: 13px; }

.req-table thead th {
  padding: 10px;
  background: var(--rb-surface-alt);
  border-bottom: 1px solid var(--rb-border);
  text-align: left;
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--rb-text-secondary);
  white-space: nowrap;
}

.req-table tbody td {
  padding: 11px 10px;
  border-bottom: 1px solid var(--rb-border);
  vertical-align: middle;
  overflow: hidden;
}

.req-table th:first-child,
.req-table td:first-child { padding-left: 16px; }

.req-table th:last-child,
.req-table td:last-child { padding-right: 16px; }

.req-table tbody tr:last-child td { border-bottom: 0; }
.req-row { transition: background 0.12s ease, opacity 0.12s ease; }
.req-row:hover { background: var(--rb-surface-hover); }
.req-row.is-mutating { opacity: 0.6; pointer-events: none; }

.c-id { width: 132px; }
.c-date { width: 106px; }
.c-component { width: 128px; }
.c-units { width: 86px; }
.c-priority { width: 112px; }
.c-status { width: 156px; }
.c-actions { width: 226px; }

/* Narrow panels keep who asked, for whom, how much and where it stands. */
@container (max-width: 1199px) {
  .c-component { display: none; }
}

@container (max-width: 999px) {
  .c-date { display: none; }
}

/* The reference opens the review, like the eye. */
.code-link {
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: none;
  font-family: var(--rb-font-mono);
  font-size: 12.5px;
  font-weight: 700;
  color: var(--rb-primary-text);
  white-space: nowrap;
  cursor: pointer;
}

.code-link:hover { text-decoration: underline; text-underline-offset: 3px; }

/* Where a request came from, when it is not the portal. */
.chip {
  display: inline-block;
  margin-top: 3px;
  padding: 0 6px;
  border-radius: 999px;
  border: 1px solid var(--rb-border-strong);
  font-size: 10.5px;
  font-weight: 600;
  line-height: 1.6;
  color: var(--rb-text-secondary);
  white-space: nowrap;
}

.strong { display: block; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sub { display: block; margin-top: 2px; font-size: 11.5px; color: var(--rb-text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.muted { color: var(--rb-text-secondary); }
.nowrap { white-space: nowrap; }

.codes { display: flex; flex-wrap: wrap; gap: 4px; }

.code-chip {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 6px;
  border: 1px solid var(--rb-border);
  background: var(--rb-surface-alt);
  font-family: var(--rb-font-mono);
  font-size: 11px;
  font-weight: 600;
  color: var(--rb-text-primary);
  white-space: nowrap;
}

.patient { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 6px; min-width: 0; }
.patient__name { font-weight: 700; text-transform: capitalize; overflow-wrap: anywhere; }
.patient__name.muted { font-weight: 500; text-transform: none; }

.blood {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 30px;
  padding: 1px 7px;
  border-radius: 999px;
  border: 1px solid var(--rb-border-strong);
  background: var(--rb-surface-alt);
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

/* Priority and status: the colour lives on the dot, never on the badge's fill. */
.badge {
  --tone: var(--rb-text-muted);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  padding: 2px 9px;
  border-radius: 999px;
  border: 1px solid var(--rb-border);
  background: var(--rb-surface);
  font-size: 11.5px;
  font-weight: 600;
  line-height: 1.5;
  white-space: nowrap;
}

.badge__dot { width: 6px; height: 6px; border-radius: 999px; background: var(--tone); flex-shrink: 0; }
.badge__text { overflow: hidden; text-overflow: ellipsis; }
.badge--info { --tone: var(--rb-primary); }
.badge--ok { --tone: var(--rb-success); }
.badge--warn { --tone: var(--rb-warning); }
.badge--crit { --tone: var(--rb-accent); }
.badge--neutral { --tone: var(--rb-text-muted); color: var(--rb-text-secondary); }

.row-actions { display: flex; align-items: center; gap: 6px; }

/* Issue: the one solid action in a row, because it sends blood out. */
.btn-issue {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 30px;
  padding: 0 10px;
  border-radius: 8px;
  background: var(--rb-primary);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
  transition: background 0.15s ease;
}

.btn-issue:hover { background: color-mix(in srgb, var(--rb-primary) 88%, #000); }

/* Shown, so the column reads the same on every open row, but not offered. */
.btn-issue--off {
  background: var(--rb-surface-alt);
  border: 1px solid var(--rb-border);
  color: var(--rb-text-muted);
  cursor: not-allowed;
}

.btn-issue--off:hover { background: var(--rb-surface-alt); }

/* EMPTY AND LOADING */
.empty-cell { padding: 0 !important; }
.empty-state { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 48px 24px; text-align: center; }

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

.empty-state__title { margin: 0; font-size: 14px; font-weight: 700; }
.empty-state__text { margin: 0 0 8px; max-width: 46ch; font-size: 13px; line-height: 1.5; color: var(--rb-text-secondary); }

.skeleton {
  display: block;
  background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 37%, var(--rb-skeleton-a) 63%);
  background-size: 400% 100%;
  animation: shimmer 1.4s ease infinite;
}

.skeleton--line { height: 16px; width: 100%; border-radius: 6px; }

/* PAGER */
.pager {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 14px;
  padding: 12px 16px;
  border-top: 1px solid var(--rb-border);
  font-size: 12.5px;
  color: var(--rb-text-secondary);
}

.pager__btns { display: flex; align-items: center; gap: 8px; }
.pager__page { font-variant-numeric: tabular-nums; }

/* REVIEW DRAWER: request details, availability, fulfilment, history */
.mono { font-family: var(--rb-font-mono); font-size: 12px; color: var(--text-secondary); }
.blood-pills { display: inline-flex; flex-wrap: wrap; gap: 4px; }
.blood-pill { display: inline-flex; align-items: center; justify-content: center; min-width: 34px; padding: 3px 8px; border-radius: 8px; background: #fdecea; color: var(--danger); font-weight: 700; font-size: 12px; }

.inv-inline { display: inline-flex; align-items: center; gap: 4px; }
.inv-ok { color: var(--success); background: #e8f5e9; }
.inv-low { color: var(--warning); background: #fef3e0; }
.inv-insufficient { color: var(--danger); background: #fdecea; }
.inventory-status-line { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; margin: 10px 0 0; padding: 6px 10px; border-radius: 8px; }
.inventory-status-line.inv-ok { background: #e8f5e9; }
.inventory-status-line.inv-low { background: #fef3e0; }
.inventory-status-line.inv-insufficient { background: #fdecea; }

.priority-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 999px; }
.priority-routine { background: #eef2f7; color: var(--text-secondary); }
.priority-urgent { background: #fef3e0; color: var(--warning); }
.priority-emergency { background: #fdecea; color: var(--danger); }

.status-badge { font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 999px; }
/* The statuses the API sends, keyed on the stored value. */
.status-pending { background: #eef2f7; color: var(--text-secondary); }
.status-processing { background: #e8f0fc; color: var(--info); }
.status-partial { background: #fef3c7; color: var(--warning); }
.status-fulfilled { background: #e8f5e9; color: var(--success); }
.status-rejected { background: #fdecea; color: var(--danger); }
.status-cancelled { background: #eef2f7; color: var(--text-secondary); }

.share-note { margin: 0; font-size: 13px; line-height: 1.55; color: var(--text-secondary); }
.share-note .mono { font-size: 12.5px; color: var(--text); }
.share-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 10px; }
.share-actions__hint { font-size: 12px; color: var(--rb-text-secondary); }

.drawer-closed-note {
  margin: 0;
  flex: 1;
  font-size: 13px;
  color: var(--text-secondary);
}

.drawer-loading { padding: 20px; display: flex; flex-direction: column; gap: 12px; }
.skeleton-row { height: 44px; border-radius: 10px; background: linear-gradient(90deg, #eef2f7 25%, #f7f9fc 37%, #eef2f7 63%); background-size: 400% 100%; animation: shimmer 1.4s infinite; }
@keyframes shimmer { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }

/* The review dialog, built like Donor Management's profile. Under the
   approve and reject confirmations (z-index 100), which open over it. */
.review-overlay {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: var(--rb-overlay);
}

.review-card {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 860px;
  max-height: calc(100vh - 40px);
  background: var(--rb-surface);
  border: 1px solid var(--rb-border);
  border-radius: 16px;
  box-shadow: 0 12px 32px rgba(var(--rb-shadow-rgb), 0.28);
  color: var(--rb-text-primary);
}

.review-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--rb-border);
  flex-shrink: 0;
}

.review-card__title { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 15.5px; font-weight: 700; }
.review-card__title :deep(.asset-icon) { color: var(--rb-text-secondary); }

.review-card__close {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 1px solid var(--rb-border);
  border-radius: 8px;
  background: none;
  color: var(--rb-text-secondary);
  cursor: pointer;
}

.review-card__close:hover { color: var(--rb-text-primary); background: var(--rb-surface-hover); }
.review-card__close:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }

.review-card__body {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 18px 20px;
  overflow-y: auto;
  min-height: 0;
}

.review-card__footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid var(--rb-border);
  flex-shrink: 0;
}

.review-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--rb-border);
}

.review-hero__text { min-width: 0; }
.review-hero__row { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.review-hero__code { margin: 0; font-family: var(--rb-font-mono); font-size: 13px; font-weight: 700; color: var(--rb-text-secondary); }
.review-hero__name { margin: 6px 0 0; font-size: 18px; font-weight: 700; letter-spacing: -0.01em; }
.review-hero__meta { margin: 3px 0 0; font-size: 12.5px; color: var(--rb-text-secondary); }
.review-hero__actions { display: flex; gap: 8px; flex-shrink: 0; }

.facts {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px 18px;
  margin: 0;
}

.fact { min-width: 0; }
.fact--wide { grid-column: span 2; }
.fact--full { grid-column: 1 / -1; }

.fact dt {
  margin: 0 0 3px;
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--rb-text-secondary);
}

.fact dd { margin: 0; font-size: 13px; font-weight: 600; overflow-wrap: anywhere; }
.fact__sub { display: block; margin-top: 1px; font-size: 11.5px; font-weight: 500; color: var(--rb-text-secondary); }
.fact__notes { font-weight: 500; white-space: pre-line; }

.sub-section { display: flex; flex-direction: column; gap: 8px; }

.sub-section__title {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0;
  font-size: 13px;
  font-weight: 700;
}

.sub-section__title :deep(.asset-icon) { color: var(--rb-text-secondary); }
.sub-section__note { margin: 0; font-size: 12.5px; line-height: 1.5; color: var(--rb-text-secondary); }

.table-box { position: relative; overflow-x: auto; padding: 8px 4px 2px; border: 1px solid var(--rb-border); border-radius: 10px; }

/* Rejecting, a decision: outlined, red only on hover. */
.btn-outline--danger:hover:not(:disabled) { color: var(--rb-accent-text); border-color: rgba(var(--rb-accent-rgb), 0.45); }

/* Per-component availability in the review drawer. */
.avail-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12.5px;
  margin-bottom: 10px;
}
.avail-table th {
  text-align: left;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: .4px;
  text-transform: uppercase;
  color: var(--rb-text-secondary);
  padding: 0 8px 6px;
  border-bottom: 1px solid var(--rb-border-strong);
}
.avail-table td {
  padding: 7px 8px;
  border-bottom: 1px solid var(--rb-border);
  color: var(--rb-text-primary);
}
.avail-table tr:last-child td { border-bottom: none; }
.avail-table .num { text-align: right; }

.inventory-advisory {
  font-size: 11.5px;
  color: var(--rb-text-secondary);
  margin: 6px 0 12px;
}

/* MODALS */
.modal-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.5); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 16px; }
.modal { background: var(--card); color: var(--text); border-radius: var(--radius); padding: 24px; width: 100%; max-width: 440px; box-shadow: 0 8px 28px rgba(15, 23, 42, 0.18); }
.modal-title { font-size: 16px; font-weight: 700; margin: 0 0 4px; }
.modal-desc { font-size: 13px; color: var(--text-secondary); margin: 0 0 16px; }
.modal-summary { background: var(--bg); border-radius: 12px; padding: 12px 14px; margin-bottom: 14px; display: flex; flex-direction: column; gap: 8px; }
.modal-row { display: flex; justify-content: space-between; align-items: center; font-size: 13px; gap: 12px; }
.modal-row span { color: var(--text-secondary); }
.modal-row strong { text-align: right; }
.modal-actions { display: flex; gap: 10px; margin-top: 18px; }
.modal-actions .btn { flex: 1; }

.field { margin-bottom: 14px; }
.field-label { font-size: 12px; font-weight: 600; display: block; margin-bottom: 6px; }
.field-select, .field-textarea {
  width: 100%; padding: 9px 12px; border-radius: 10px; border: 1px solid var(--border);
  background: var(--bg); color: var(--text); font-size: 13px; font-family: inherit;
}
.field-textarea { resize: vertical; }

/* TRANSITIONS */
.review-enter-active, .review-leave-active { transition: opacity 0.18s ease; }
.review-enter-from, .review-leave-to { opacity: 0; }

/* RESPONSIVE */
@media (max-width: 640px) {
  .page { padding: 20px 16px 32px; }
  .facts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .review-hero { flex-direction: column; }
  .review-overlay { padding: 10px; align-items: flex-end; }
  .review-card { max-height: calc(100vh - 20px); }
  .review-card__footer { flex-wrap: wrap; }
  .toolbar__actions { margin-left: 0; justify-content: flex-start; }
  .search { max-width: none; }
}

@media (prefers-reduced-motion: reduce) {
  .req-row, .spinning, .skeleton, .skeleton-row { transition: none !important; animation: none !important; }
}

/*
 * DARK MODE, for the drawer and the dialogs; the list follows the app's
 * --rb-* tokens by itself. Two rules about the selectors here, both learned
 * the hard way:
 *
 *  - `:global(.dark) .selector` does NOT work — this toolchain drops the
 *    descendant half and emits a bare `.dark { … }`, putting the declaration
 *    on <html>.
 *  - `:global(.dark .selector)` works but is fully global, so it must be
 *    anchored on the page's scope class.
 */
:global(.dark .scope-blood-center-bloodrequests) {
  --bg: #0F172A; --card: #171e2c; --border: #2a3447; --text: #e2e8f0; --text-secondary: #94a3b8;
  /* Only the text family lifts; the -fill tokens keep their deep values so
     white-on-fill buttons and toasts stay legible. */
  --primary: #64b5f6; --success: #66bb6a; --warning: #fbbf24;
  --danger: #f87171; --info: #60a5fa; --purple: #a78bfa;
  --primary-fill-hover: #1976d2;
}
:global(.dark .scope-blood-center-bloodrequests .blood-pill) { background: #3a1f22; }
:global(.dark .scope-blood-center-bloodrequests .inv-ok) { background: #16301c; }
:global(.dark .scope-blood-center-bloodrequests .inv-low) { background: #3a2c10; }
:global(.dark .scope-blood-center-bloodrequests .inv-insufficient) { background: #3a1f22; }
:global(.dark .scope-blood-center-bloodrequests .inventory-status-line.inv-ok) { background: #16301c; }
:global(.dark .scope-blood-center-bloodrequests .inventory-status-line.inv-low) { background: #3a2c10; }
:global(.dark .scope-blood-center-bloodrequests .inventory-status-line.inv-insufficient) { background: #3a1f22; }
:global(.dark .scope-blood-center-bloodrequests .priority-routine) { background: #1e2635; }
:global(.dark .scope-blood-center-bloodrequests .priority-emergency) { background: #3a1f22; }
:global(.dark .scope-blood-center-bloodrequests .status-pending) { background: #1e2635; }
:global(.dark .scope-blood-center-bloodrequests .status-processing) { background: #16223a; }
:global(.dark .scope-blood-center-bloodrequests .status-partial) { background: #3a2e12; }
:global(.dark .scope-blood-center-bloodrequests .status-fulfilled) { background: #16301c; }
:global(.dark .scope-blood-center-bloodrequests .status-rejected) { background: #3a1f22; }
:global(.dark .scope-blood-center-bloodrequests .status-cancelled) { background: #1e2635; }
:global(.dark .scope-blood-center-bloodrequests .skeleton-row) { background: linear-gradient(90deg, #1c2536 25%, #212b3f 37%, #1c2536 63%); background-size: 400% 100%; }
:global(.dark .scope-blood-center-bloodrequests .modal-summary),
:global(.dark .scope-blood-center-bloodrequests .field-select),
:global(.dark .scope-blood-center-bloodrequests .field-textarea) { background: #1c2536; }
:global(.dark .scope-blood-center-bloodrequests .modal) { box-shadow: 0 8px 24px rgba(0,0,0,0.4); }
</style>