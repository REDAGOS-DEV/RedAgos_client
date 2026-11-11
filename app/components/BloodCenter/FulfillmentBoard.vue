<template>
  <div class="fx-page">
    <div class="fx-inner">

      <!-- Request Fulfillment (invoice still owing) or For Dispatch (cleared), 2026-10-31. -->
      <PageHeader
        :title="forDispatch ? 'For Dispatch' : 'Request Fulfillment'"
        :subtitle="forDispatch
          ? 'Paid or otherwise cleared: dispatch the units, then the hospital confirms they arrived.'
          : 'Requests sent from Issue whose invoice still has a balance. Once it is settled or its payment is deferred, they move to For Dispatch.'"
      >
        <template #actions>
          <NuxtLink :to="forDispatch ? '/blood-center/fulfillment' : '/blood-center/dispatch'" class="ui-btn">
            <AssetIcon :name="forDispatch ? 'receipt' : 'truck'" :size="16" />
            {{ forDispatch ? 'Request Fulfillment' : 'For Dispatch' }}
          </NuxtLink>
          <button class="ui-btn" :disabled="loading" @click="load">
            <AssetIcon name="refresh-cw" :size="16" :class="{ spinning: loading }" />
            Refresh
          </button>
        </template>
      </PageHeader>

      <div v-if="error" class="banner banner--error">
        <AssetIcon name="triangle-alert" :size="16" />
        <span>{{ error }}</span>
        <button class="ui-btn ui-btn--sm" @click="load">Retry</button>
      </div>

      <!-- TABS (For Dispatch only); each card counts its own units by state. -->
      <div v-if="forDispatch" class="tabbar fade-in" style="--delay:40ms">
        <div class="tabs" role="tablist" aria-label="Dispatch queue">
          <button
            v-for="tab in tabs"
            :key="tab.value"
            type="button"
            role="tab"
            class="tab"
            :class="{ 'tab--on': activeTab === tab.value }"
            :aria-selected="activeTab === tab.value"
            @click="activeTab = tab.value"
          >
            {{ tab.label }}
            <span v-if="activeTab === tab.value && !loading" class="tab__count">{{ requests.length }}</span>
          </button>
        </div>

      </div>

      <!--
        What to do first (project owner, 2026-11-11): one search, a few
        filters each with how many it holds, and the order to work them in.
        Most urgent first by default: STAT, then the soonest needed, then the
        units closest to expiry, then whoever has waited longest.
      -->
      <div v-if="!loading && requests.length" class="fx-tools fade-in" style="--delay:60ms">
        <label class="fx-search">
          <AssetIcon name="search" :size="15" class="fx-search__icon" />
          <input
            v-model="search"
            type="search"
            class="fx-search__input"
            placeholder="Search reference or hospital…"
            aria-label="Search by reference or hospital"
          >
        </label>
        <div class="fx-chips" role="group" aria-label="Show">
          <button
            v-for="f in filterChips"
            :key="f.key"
            type="button"
            class="fx-chip"
            :class="[`fx-chip--${f.tone}`, { 'fx-chip--on': show === f.key, 'fx-chip--zero': !f.count }]"
            :aria-pressed="show === f.key"
            @click="show = show === f.key ? 'all' : f.key"
          >
            {{ f.label }}
            <span class="fx-chip__count">{{ f.count }}</span>
          </button>
        </div>
        <div class="fx-sort">
          <span class="fx-sort__label">Group</span>
          <SelectField v-model="groupBy" class="fx-sort__sel fx-sort__sel--group" size="sm" aria-label="Group requests by" :options="GROUPINGS" />
          <span class="fx-sort__label">Sort</span>
          <SelectField v-model="sortBy" class="fx-sort__sel" size="sm" aria-label="Sort requests" :options="SORTS" />
        </div>
      </div>

      <!-- LIST -->
      <div v-if="loading" class="card">
        <div class="skeleton-wrap">
          <SkeletonList :rows="3" />
        </div>
      </div>

      <div v-else-if="requests.length === 0" class="card">
        <EmptyState
          v-if="!forDispatch"
          icon="receipt"
          title="No invoice waiting on payment"
          description="A request sent from Issue stays here until its invoice is settled or its payment is deferred. Those are on For Dispatch."
        />
        <EmptyState
          v-else
          :icon="activeTab === 'awaiting_release' ? 'truck' : 'inbox'"
          :title="activeTab === 'awaiting_release' ? 'Nothing cleared to dispatch' : 'Nothing awaiting confirmation'"
          :description="activeTab === 'awaiting_release'
            ? 'Requests appear here once their invoice is paid, subsidised or billed by statement, or its payment is deferred, and replenishment orders once they are confirmed.'
            : 'Units you dispatch appear here until the hospital confirms they arrived.'"
        />
      </div>

      <div v-else-if="!shown.length" class="card">
        <EmptyState
          icon="search-x"
          title="No requests match"
          description="Try another reference or hospital, or show every request."
        >
          <button type="button" class="ui-btn ui-btn--sm" @click="clearFilters">Show all</button>
        </EmptyState>
      </div>

      <div v-else class="request-groups">
        <section v-for="group in groups" :key="group.key" class="fx-group" :aria-label="group.label || 'Requests'">
          <!-- A group's head: what it holds and how many; it folds away. -->
          <button
            v-if="group.label"
            type="button"
            class="fx-group__head"
            :aria-expanded="!folded.has(group.key)"
            @click="toggleGroup(group.key)"
          >
            <AssetIcon :name="folded.has(group.key) ? 'chevron-right' : 'chevron-down'" :size="15" class="fx-group__chev" />
            <span class="fx-group__dot" :class="`fx-group__dot--${group.tone}`" aria-hidden="true" />
            <span class="fx-group__title">{{ group.label }}</span>
            <span class="fx-group__count">{{ group.items.length }}</span>
            <span v-if="group.hint" class="fx-group__hint">{{ group.hint }}</span>
          </button>

      <div v-show="!folded.has(group.key)" class="request-list">
        <article
          v-for="request in group.items"
          :id="`request-${request.id}`"
          :key="request.id"
          class="card request-card fade-in"
          :class="{ 'request-card--stat': request.is_emergency, 'request-card--focus': request.id === focusId }"
        >
          <header class="request-head">
            <div>
              <div class="request-title">
                <span class="mono">{{ request.reference_number }}</span>
                <span v-if="request.id === nextUpId" class="tag tag--next">
                  <AssetIcon name="flag" :size="11" />
                  Next up
                </span>
                <span v-if="request.is_emergency" class="tag tag--stat">STAT</span>
                <span v-if="request.is_walk_in" class="tag tag--walk-in">Walk-in</span>
                <span
                  v-if="request.weekly_request"
                  class="tag tag--weekly"
                  title="The hospital's weekly request: dispatched in one delivery, and whatever is not supplied is closed"
                >Weekly · {{ request.weekly_request.reference_number }}</span>
                <span class="status" :class="`status--${request.status}`">{{ requestStatusLabel(request) }}</span>
              </div>
              <p class="request-sub">
                <span class="request-facility">{{ request.requesting_facility?.name || 'Hospital not recorded' }}</span>
                <span v-for="code in (bloodTypeCodes(request).length ? bloodTypeCodes(request) : ['?'])" :key="code" class="blood-pill">{{ code }}</span>
                <span>
                  {{ request.quantity }} unit{{ request.quantity === 1 ? '' : 's' }} requested<template v-if="request.committed_quantity != null">, {{ request.committed_quantity }} committed</template>
                </span>
              </p>
              <!-- When it came in, and when it is needed: the reasons for its place in the list. -->
              <p class="request-when">
                <span v-if="request.request_date" class="when">
                  <AssetIcon name="clock" :size="13" />
                  Received {{ formatWhen(request.request_date) }}<template v-if="waitingFor(request)"> · waiting {{ waitingFor(request) }}</template>
                </span>
                <span v-if="neededBy(request)" class="when" :class="{ 'when--soon': isSoon(neededBy(request)) }">
                  <AssetIcon name="calendar" :size="13" />
                  Needed by {{ formatWhen(neededBy(request)) }}
                </span>
                <span v-if="expiringCount(request)" class="when when--soon">
                  <AssetIcon name="triangle-alert" :size="13" />
                  {{ expiringCount(request) }} unit{{ expiringCount(request) === 1 ? '' : 's' }} expiring within 7 days
                </span>
              </p>
              <!-- A replenishment order's hand-over, as the center confirmed it (project owner, 2026-10-29). -->
              <p v-if="request.supply_plan" class="handover">
                <AssetIcon :name="request.supply_plan.handover_method === 'delivery' ? 'truck' : 'hospital'" :size="14" />
                <strong>{{ request.supply_plan.handover_method === 'delivery' ? 'Deliver' : 'Pick-up' }} · {{ handoverWhen(request.supply_plan.scheduled_at) }}</strong>
                <span v-if="request.supply_plan.handover_address">{{ request.supply_plan.handover_method === 'delivery' ? 'to' : 'at' }} {{ request.supply_plan.handover_address }}</span>
              </p>
            </div>

            <!-- Tagged, released, received: the three states a unit goes through, each in its colour. -->
            <div class="request-counts">
              <!-- Only a patient's request is tagged; an order's units are picked as it goes. -->
              <span v-if="!isOrder(request)" class="count count--allocated">
                <span class="dot dot--allocated" />
                <strong>{{ Math.max(0, (request.allocated_count ?? 0) - (request.fulfilled_quantity ?? 0)) }}</strong> tagged
              </span>
              <span class="count count--released">
                <span class="dot dot--released" />
                <strong>{{ request.fulfilled_quantity ?? 0 }}</strong> released
              </span>
              <span class="count count--received" title="Receipt is confirmed by the hospital, not here.">
                <span class="dot dot--received" />
                <strong>{{ request.received_count }}</strong> received
              </span>
            </div>
          </header>

          <!-- What was asked for beside what has been provided, per component. -->
          <RequestFulfilmentTable v-if="request.detail" :request="request.detail" class="request-fulfilment" />
          <div v-else-if="request.items?.length" class="lines">
            <span v-for="item in request.items" :key="item.id" class="line-chip">
              {{ requestLineLabel(request, item) }} &times;{{ item.quantity }}
            </span>
          </div>

          <!-- BILLING GATE -->
          <div
            v-if="activeTab === 'awaiting_release'"
            class="gate"
            :class="gateFor(request).ok ? 'gate--ok' : 'gate--blocked'"
          >
            <AssetIcon :name="gateFor(request).ok ? 'check' : 'octagon-alert'" :size="15" />
            <span>{{ gateFor(request).message }}</span>
            <!-- Issuance only sees the release gate. Billing now owns every
                 subsidy decision and checks its centrally scheduled dates. -->
            <NuxtLink v-if="!gateFor(request).ok && can('billing.record_payment')" to="/blood-center/billing" class="gate-link">
              Go to Billing
            </NuxtLink>
            <button
              v-if="gateFor(request).canDefer"
              type="button"
              class="ui-btn ui-btn--sm gate-action"
              :disabled="busyId === request.id"
              @click="openDefer(request)"
            >
              Issue with Deferred Payment
            </button>
          </div>

          <!-- UNITS -->
          <div class="units">
            <div v-if="request.loadingUnits" class="skeleton skeleton--row" />

            <table v-else-if="request.allocations?.length" class="units-table">
              <thead>
                <tr>
                  <th v-if="activeTab === 'awaiting_release' && !isOrder(request)" scope="col" class="pick">
                    <input
                      type="checkbox"
                      :checked="allSelected(request)"
                      :aria-label="`Select every tagged unit on ${request.reference_number}`"
                      @change="toggleAll(request)"
                    >
                  </th>
                  <th scope="col">Unit</th>
                  <th scope="col">Component</th>
                  <th scope="col">Expires</th>
                  <th scope="col">Storage</th>
                  <th scope="col">State</th>
                  <th v-if="hasReleased(request)" scope="col">Dispatched</th>
                  <th v-if="hasReleased(request) && canCorrectDispatch" scope="col"><span class="sr-only">Correct</span></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="allocation in request.allocations" :key="allocation.id">
                  <td v-if="activeTab === 'awaiting_release' && !isOrder(request)" class="pick">
                    <input
                      v-if="allocation.status === 'allocated'"
                      type="checkbox"
                      :checked="isSelected(request, allocation.id)"
                      :aria-label="`Select unit ${allocation.unit_id}`"
                      @change="toggleUnit(request, allocation.id)"
                    >
                  </td>
                  <td class="mono">{{ allocation.unit_id }}</td>
                  <td>{{ componentFor(request, allocation) }}</td>
                  <td :class="{ expiring: isExpiringSoon(allocation.expiry_date) }">
                    {{ allocation.expiry_date || 'Not set' }}
                  </td>
                  <td :class="{ muted: !allocation.storage_location }">{{ allocation.storage_location || 'Not set' }}</td>
                  <td>
                    <span class="alloc" :class="`alloc--${allocation.status}`">
                      <span class="dot" :class="`dot--${allocation.received_at ? 'received' : allocation.status}`" />
                      {{ allocation.received_at ? 'Received' : allocation.status_label }}
                    </span>
                  </td>
                  <td v-if="hasReleased(request)" :class="{ muted: allocation.status !== 'released' }">
                    <template v-if="allocation.status === 'released'">
                      {{ formatWhen(allocation.released_at) }}
                      <span v-if="allocation.handed_to" class="handed-to">to {{ allocation.handed_to }}</span>
                    </template>
                    <template v-else>—</template>
                  </td>
                  <td v-if="hasReleased(request) && canCorrectDispatch">
                    <button
                      v-if="allocation.status === 'released'"
                      type="button"
                      class="ui-btn ui-btn--sm"
                      :aria-label="`Request a correction to the dispatch record of unit ${allocation.unit_id}`"
                      @click="openCorrect(request, allocation)"
                    >
                      Correct
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>

            <p v-else class="units-empty">{{ isOrder(request) ? 'Nothing is held for this order. Pick its units as you dispatch it.' : 'No units are tagged for this request.' }}</p>
          </div>

          <!-- ACTIONS -->
          <!-- A confirmed replenishment order: nothing to return, the bags are picked as it goes. -->
          <footer v-if="activeTab === 'awaiting_release' && isOrder(request)" class="request-actions">
            <span class="selection-note">
              {{ request.outstanding_quantity }} unit{{ request.outstanding_quantity === 1 ? '' : 's' }} to send
            </span>
            <button
              class="ui-btn ui-btn--primary ui-btn--sm"
              :disabled="busyId === request.id || !request.outstanding_quantity"
              @click="openOrderDispatch(request)"
            >
              <AssetIcon v-if="busyId !== request.id" name="truck" :size="14" />
              {{ busyId === request.id ? 'Working…' : 'Pick Units & Dispatch' }}
            </button>
          </footer>

          <footer v-else-if="activeTab === 'awaiting_release'" class="request-actions">
            <span class="selection-note">
              {{ selectedCount(request) > 0
                ? `${selectedCount(request)} unit(s) selected`
                : 'Nothing selected — Dispatch sends every tagged unit.' }}
            </span>
            <button
              class="ui-btn ui-btn--sm"
              :disabled="busyId === request.id || taggedCount(request) === 0"
              @click="openReturn(request)"
            >
              Return to Stock
            </button>
            <button
              class="ui-btn ui-btn--primary ui-btn--sm"
              :disabled="busyId === request.id || taggedCount(request) === 0 || !gateFor(request).ok"
              @click="openDispatch(request)"
            >
              <AssetIcon v-if="busyId !== request.id" name="truck" :size="14" />
              {{ busyId === request.id ? 'Working…' : 'Dispatch' }}
            </button>
          </footer>

          <footer v-else class="request-actions">
            <span class="selection-note">
              <AssetIcon name="clock" :size="13" />
              Waiting on {{ request.requesting_facility?.name || 'the hospital' }} to confirm receipt.
            </span>
          </footer>
        </article>
      </div>
        </section>
      </div>
    </div>

    <!-- DISPATCH CONFIRM -->
    <Teleport to="body" :disabled="pageHidden">
      <div v-if="dispatchFor" class="modal-overlay" @click.self="closeDispatch">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="dispatch-title">
          <h2 id="dispatch-title" class="modal-title">Dispatch Units</h2>
          <p class="modal-sub">{{ dispatchFor.reference_number }} · {{ dispatchFor.requesting_facility?.name }}</p>

          <ul class="modal-units">
            <li v-for="unit in dispatchUnits" :key="unit.id" class="mono">
              {{ unit.unit_id }}<span class="unit-expiry"> · expires {{ unit.expiry_date || 'date not set' }}</span>
            </li>
          </ul>

          <div class="field">
            <label for="handed-to" class="field-label">
              {{ handedToLabel(dispatchFor) }}
              <span v-if="!dispatchFor.is_walk_in" class="field-optional">optional</span>
            </label>
            <input
              id="handed-to"
              v-model.trim="handedTo"
              type="text"
              class="input"
              maxlength="150"
              :placeholder="handedToPlaceholder(dispatchFor)"
            >
          </div>

          <p v-if="actionError" class="field-error field-error--block">{{ actionError }}</p>

          <div class="modal-actions">
            <button class="ui-btn" :disabled="busyId" @click="closeDispatch">Cancel</button>
            <button class="ui-btn ui-btn--primary" :disabled="busyId" @click="confirmDispatch">
              {{ busyId ? 'Dispatching…' : 'Dispatch' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- DISPATCH A REPLENISHMENT ORDER: the bags are picked and recorded as it goes (project owner, 2026-11-07). -->
    <Teleport to="body" :disabled="pageHidden">
      <UnitPickerDialog
        v-if="orderFor"
        ref="orderPickerRef"
        dispatch
        :request="{ id: orderFor.id, code: orderFor.reference_number }"
        :busy="Boolean(busyId)"
        :error="actionError"
        :unit-errors="orderUnitErrors"
        @close="closeOrderDispatch"
        @confirm="confirmOrderDispatch"
      >
        <template #details="{ picked }">
          <p v-if="orderFor.weekly_request" class="modal-warning modal-warning--flush" role="note">
            <strong>Weekly request {{ orderFor.weekly_request.reference_number }}</strong> goes out in one delivery.
            <template v-if="orderFor.unclaimed_quantity > picked">
              The {{ orderFor.unclaimed_quantity - picked }} unit(s) not picked will be
              closed as not supplied — the hospital's next request day replaces them.
            </template>
            <template v-else>Everything requested is picked, so nothing will be closed.</template>
          </p>

          <p v-if="orderFor.supply_plan" class="modal-desc modal-desc--flush">
            Confirmed for <strong>{{ orderFor.supply_plan.handover_method === 'delivery' ? 'delivery' : 'pick-up' }}
              on {{ handoverWhen(orderFor.supply_plan.scheduled_at) }}</strong><template v-if="orderFor.supply_plan.handover_address">,
              {{ orderFor.supply_plan.handover_method === 'delivery' ? 'to' : 'at' }} {{ orderFor.supply_plan.handover_address }}</template>.
          </p>

          <div class="field field--flush">
            <label for="order-handed-to" class="field-label">
              {{ handedToLabel(orderFor) }}
              <span class="field-optional">optional</span>
            </label>
            <input
              id="order-handed-to"
              v-model.trim="handedTo"
              type="text"
              class="input"
              maxlength="150"
              :disabled="Boolean(busyId)"
              :placeholder="handedToPlaceholder(orderFor)"
            >
          </div>
        </template>
      </UnitPickerDialog>
    </Teleport>

    <!-- DEFERRED PAYMENT -->
    <Teleport to="body" :disabled="pageHidden">
      <div v-if="deferFor" class="modal-overlay" @click.self="closeDefer">
        <div
          v-focus-trap
          class="modal"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="defer-title"
          @dialog-escape="closeDefer"
        >
          <h2 id="defer-title" class="modal-title">Issue with Deferred Payment</h2>
          <p class="modal-sub">{{ deferFor.reference_number }} · {{ deferFor.requesting_facility?.name }}</p>

          <p class="modal-warning" role="note">
            The units can be dispatched unpaid. <strong>{{ owedOn(deferFor) }}</strong> stays on the invoice for later settlement.
          </p>

          <p v-if="actionError" class="field-error field-error--block">{{ actionError }}</p>

          <div class="modal-actions">
            <button class="ui-btn" :disabled="busyId" @click="closeDefer">Cancel</button>
            <button class="ui-btn ui-btn--primary" :disabled="busyId" @click="confirmDefer">
              {{ busyId ? 'Deferring…' : 'Defer Payment' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- CORRECT A DISPATCH RECORD. Steps aside while the request is reviewed: its overlay sits above the dialog's. -->
    <Teleport to="body" :disabled="pageHidden">
      <div v-if="correctFor && !dispatchCorrection" class="modal-overlay" @click.self="closeCorrect">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="correct-title">
          <h2 id="correct-title" class="modal-title">Correct Dispatch Record</h2>
          <p class="modal-sub">
            <span class="mono">{{ correctFor.allocation.unit_id }}</span> · {{ correctFor.request.reference_number }}
          </p>

          <div class="field">
            <label for="corrected-released-at" class="field-label">Left at</label>
            <DateTimeField id="corrected-released-at" v-model="correctForm.releasedAt" />
          </div>

          <div class="field">
            <label for="corrected-handed-to" class="field-label">
              Handed to <span class="field-optional">optional</span>
            </label>
            <input id="corrected-handed-to" v-model.trim="correctForm.handedTo" type="text" class="input" maxlength="150">
          </div>

          <p v-if="correctError" class="field-error field-error--block">{{ correctError }}</p>

          <div class="modal-actions">
            <button class="ui-btn" @click="closeCorrect">Cancel</button>
            <button class="ui-btn ui-btn--primary" @click="reviewCorrection">Review correction</button>
          </div>
        </div>
      </div>
    </Teleport>

    <BloodCenterCorrectionRequestDialog
      v-if="dispatchCorrection"
      subject="dispatch"
      :target-id="dispatchCorrection.allocationId"
      :changes="dispatchCorrection.changes"
      :previous="dispatchCorrection.previous"
      @close="dispatchCorrection = null"
      @submitted="onDispatchCorrectionSent"
    />

    <!-- RETURN TO STOCK -->
    <Teleport to="body" :disabled="pageHidden">
      <div v-if="returnFor" class="modal-overlay" @click.self="closeReturn">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="return-title">
          <h2 id="return-title" class="modal-title">Return Units to Stock</h2>
          <p class="modal-sub">{{ returnFor.reference_number }} · {{ returnFor.requesting_facility?.name }}</p>

          <div class="field">
            <label for="return-reason" class="field-label">Reason <span class="req">*</span></label>
            <input
              id="return-reason"
              v-model.trim="returnReason"
              type="text"
              class="input"
              maxlength="255"
              placeholder="Why are these units being released?"
            >
          </div>

          <p v-if="actionError" class="field-error field-error--block">{{ actionError }}</p>

          <div class="modal-actions">
            <button class="ui-btn" :disabled="busyId" @click="closeReturn">Cancel</button>
            <button class="ui-btn ui-btn--primary" :disabled="busyId || !returnReason" @click="confirmReturn">
              {{ busyId ? 'Returning…' : 'Return to Stock' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import SkeletonList from '~/components/ui/SkeletonList.vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import RequestFulfilmentTable from '~/components/common/RequestFulfilmentTable.vue'
import BloodCenterCorrectionRequestDialog from '~/components/BloodCenter/CorrectionRequestDialog.vue'
import UnitPickerDialog from '~/components/BloodCenter/UnitPickerDialog.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import { bloodTypeCodes, handoverWhen, requestLineLabel, requestStatusLabel } from '~/types/bloodRequest'
import { pesos } from '~/utils/billing'
import DateTimeField from '~/components/common/DateTimeField.vue'
import PageHeader from '~/components/ui/PageHeader.vue'
import EmptyState from '~/components/ui/EmptyState.vue'
import SelectField from '~/components/common/SelectField.vue'
import { onPageReturn, usePageHidden } from '~/composables/useKeptAlive'
import { createLatest, useLiveRefresh } from '~/composables/useLiveRefresh'

/*
 * The fulfilment board (2026-10-31), shared by two pages split on the invoice:
 * Request Fulfillment (pages/blood-center/fulfillment.vue), requests with units
 * tagged whose invoice still has a balance, and For Dispatch
 * (pages/blood-center/dispatch.vue), the ones cleared to go out and then those
 * waiting on the hospital's confirmation. `view` picks the page.
 *
 * A confirmed replenishment order holds nothing (project owner, 2026-11-07): it
 * waits on For Dispatch, and its bags are picked and recorded as it goes.
 */
const props = defineProps({
  view: { type: String, default: 'fulfillment', validator: v => ['fulfillment', 'dispatch'].includes(v) },
})
const forDispatch = computed(() => props.view === 'dispatch')

/*
 * This page used to drive an eight-stage pipeline — Preparing, Quality Check,
 * Ready for Dispatch, Dispatched, Delivered, Completed — against a mocked
 * $fetch and, with mocks off, against `/blood-center/fulfillment*` routes that
 * do not exist. None of those stages is in the schema.
 *
 * What the schema has is three states on each allocation: `allocated` when a
 * bag is held, `released` when it is issued, and a `received_at` stamp the
 * requesting hospital sets. This page works that model and nothing else.
 */

const requests = ref([])
const loading = ref(true)
const error = ref('')
const busyId = ref(null)
const actionError = ref('')
const activeTab = ref('awaiting_release')

const tabs = [
  { value: 'awaiting_release', label: 'Awaiting Dispatch' },
  { value: 'awaiting_receipt', label: 'Awaiting Confirmation' },
]

/* TOASTS */
const { notify: toast } = useToast()

// ?request=ID: the request its Issue button sent here, marked and scrolled to.
const route = useRoute()
const focusId = computed(() => {
  const id = Number(route.query.request)
  return Number.isInteger(id) && id > 0 ? id : null
})

watch(activeTab, () => load())

/** What each list asks the server for: the invoice decides the page. */
function queueFilters() {
  if (!forDispatch.value) return { awaiting_release: 1, release_cleared: 0 }
  return activeTab.value === 'awaiting_release' ? { awaiting_release: 1, release_cleared: 1 } : { awaiting_receipt: 1 }
}

/**
 * The request Issue sent here: marked on this list or, when its invoice is
 * already cleared, opened on For Dispatch instead.
 */
async function showFocused() {
  const id = focusId.value
  if (!id) return
  if (requests.value.some(r => r.id === id)) {
    await nextTick()
    document.getElementById(`request-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    return
  }
  if (!forDispatch.value) {
    const billing = await bloodCenterService.billingForRequest(id).catch(() => null)
    if (billing?.billing?.clears_release) await navigateTo({ path: '/blood-center/dispatch', query: { request: id } }, { replace: true })
  }
}

/**
 * `quiet` is the return to this page: the queue is rebuilt out of sight and
 * swapped in whole, over the one on screen, with no skeleton. A quiet failure
 * keeps what is on screen.
 */
// Newest reply wins: a load started before a tab change or an action never
// overwrites what they loaded.
const listLatest = createLatest()

// Each request as the list last gave it, to tell which rows the background
// refresh needs to expand again.
const lastSeen = new Map()

function blankRow(raw) {
  lastSeen.set(raw.id, JSON.stringify(raw))

  return { ...raw, allocations: [], selected: [], loadingUnits: true, billing: null, detail: null }
}

async function load(options = {}) {
  // Read, not destructured: an event or watch handing its own value in may hand in null.
  const quiet = options?.quiet === true
  const ticket = listLatest.begin()
  if (!quiet) loading.value = true
  error.value = ''

  try {
    const response = await bloodCenterService.incomingRequests({ ...queueFilters(), per_page: 25 })
    if (!listLatest.isCurrent(ticket)) return

    const rows = (response?.data ?? []).map(blankRow)

    if (!quiet) requests.value = rows

    // The queue projection counts holds but does not carry the bags. Each row
    // is filled in from the review endpoint, which does — and which also
    // returns the statement the release gate reads.
    await Promise.all((quiet ? rows : requests.value).map(loadUnits))

    if (quiet && listLatest.isCurrent(ticket)) requests.value = rows
  } catch (err) {
    if (!listLatest.isCurrent(ticket)) return
    error.value = err?.message || 'Could not load the dispatch queue.'
    if (!quiet) requests.value = []
  } finally {
    if (listLatest.isCurrent(ticket)) loading.value = false
  }
  showFocused()
}

/**
 * The background refresh: the list alone, and the bags and statement only of
 * the requests that changed or are new. A request that reads as it did keeps
 * its row, units picked included, so the refresh costs one request when
 * nothing moved. Nothing is shown as loading, and a failure keeps the queue
 * on screen.
 */
async function refreshQuietly() {
  const ticket = listLatest.begin()

  try {
    const response = await bloodCenterService.incomingRequests({ ...queueFilters(), per_page: 25 })
    if (!listLatest.isCurrent(ticket)) return

    const kept = new Map(requests.value.map((row) => [row.id, row]))
    const expand = []
    const rows = (response?.data ?? []).map((raw) => {
      const row = kept.get(raw.id)
      if (row && lastSeen.get(raw.id) === JSON.stringify(raw)) return row

      const fresh = blankRow(raw)
      expand.push(fresh)

      return fresh
    })

    await Promise.all(expand.map(loadUnits))
    if (listLatest.isCurrent(ticket)) requests.value = rows
  } catch {
    // A missed refresh is retried by the next one.
  }
}

async function loadUnits(request) {
  try {
    const [review, billing] = await Promise.all([
      bloodCenterService.reviewRequest(request.id),
      bloodCenterService.billingForRequest(request.id).catch(() => null),
    ])

    request.allocations = review?.request?.allocations ?? []
    // The detail projection carries every line's fulfilment figures and, for a
    // walk-in, the watcher the units are likely to be handed to.
    request.detail = review?.request ?? null
    request.billing = billing?.billing ?? null
  } catch {
    // One row failing to expand must not blank the queue; the card still shows
    // its counts and says nothing is loaded.
    request.allocations = []
  } finally {
    request.loadingUnits = false
  }
}

/** What is still owed on a request's invoice, as it reads on screen. */
function owedOn(request) {
  return pesos(Number(request.billing?.total_amount ?? 0) - Number(request.billing?.collected ?? 0))
}

/**
 * Whether this request's statement clears its units for release.
 *
 * The server refuses the dispatch itself — this only explains the refusal
 * before somebody clicks into it. `canDefer` is the decision taken here: a
 * walk-in must be settled first, anything else may go now and be settled
 * afterwards (project owner, 2026-11-07).
 */
function gateFor(request) {
  const billing = request.billing

  // Its invoice is raised as it goes, and never waits on a payment here.
  if (!billing && isOrder(request)) {
    return { ok: true, message: 'Replenishment order, billed to the hospital by invoice when it is dispatched. Cleared for release.' }
  }

  if (!billing) {
    return { ok: false, message: 'No invoice has been raised for this request yet.' }
  }

  if (billing.is_payment_deferred) {
    return { ok: true, message: `Payment deferred. ${owedOn(request)} stays on the invoice for later settlement. Cleared for release.` }
  }

  if (billing.clears_release) {
    let message = 'Invoice settled. Cleared for release.'

    if (billing.is_statement_only) {
      // A weekly order is billed to the hospital by invoice only and never
      // waits on a payment in RedAgos (owner decision, 2026-10-10).
      message = 'Weekly order, billed to the hospital by invoice only. Cleared for release.'
    } else if (billing.is_subsidised) {
      message = 'Met by the government subsidy. Cleared for release.'
    }

    return { ok: true, message }
  }

  if (request.is_walk_in) {
    return { ok: false, message: `${owedOn(request)} outstanding. A walk-in must be fully settled before its units are issued.` }
  }

  return {
    ok: false,
    canDefer: true,
    message: `${owedOn(request)} outstanding. Settle it first, or issue now with deferred payment.`,
  }
}

/* FIND, FILTER AND ORDER (project owner, 2026-11-11), on the queue as loaded */
const search = ref('')
const show = ref('all')
const sortBy = ref('urgent')

const groupBy = ref('priority')
// Groups folded away, by key; open again on another grouping.
const folded = ref(new Set())
watch(groupBy, () => { folded.value = new Set() })

function toggleGroup(key) {
  const next = new Set(folded.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  folded.value = next
}

const GROUPINGS = [
  { value: 'priority', label: 'Priority' },
  { value: 'status', label: 'Status' },
  { value: 'handover', label: 'Hand-over' },
  { value: 'type', label: 'Request type' },
  { value: 'hospital', label: 'Hospital' },
  { value: 'none', label: 'No grouping' },
]

const SORTS = [
  { value: 'urgent', label: 'Most urgent first' },
  { value: 'status', label: 'Status' },
  { value: 'needed', label: 'Needed soonest' },
  { value: 'expiry', label: 'Units expiring first' },
  { value: 'oldest', label: 'Waiting longest' },
  { value: 'newest', label: 'Newest first' },
]

const time = (iso) => (iso ? new Date(iso).getTime() : NaN)
const orLast = (value) => (Number.isNaN(value) ? Infinity : value)

/** When the hospital needs it: the time it set, or a confirmed order's hand-over. */
function neededBy(request) {
  return request.transfusion_request?.needed_by ?? request.supply_plan?.scheduled_at ?? null
}

/** Within the next 24 hours, or already past. */
function isSoon(iso) {
  const at = time(iso)
  return !Number.isNaN(at) && at - Date.now() <= 86_400_000
}

function isToday(iso) {
  const at = iso ? new Date(iso) : null
  return Boolean(at) && at.toDateString() === new Date().toDateString()
}

/** Due today, or already past due. */
function dueToday(iso) {
  return isToday(iso) || (Boolean(iso) && time(iso) < Date.now())
}

/** The soonest expiry among the bags still held for it. */
function earliestExpiry(request) {
  const dates = taggedUnits(request).map((a) => time(a.expiry_date)).filter((d) => !Number.isNaN(d))
  return dates.length ? Math.min(...dates) : Infinity
}

function expiringCount(request) {
  return taggedUnits(request).filter((a) => isExpiringSoon(a.expiry_date)).length
}

function waitingFor(request) {
  const at = time(request.request_date)
  if (Number.isNaN(at)) return ''
  const minutes = Math.max(0, Math.floor((Date.now() - at) / 60000))
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  return hours < 48 ? `${hours} h` : `${Math.floor(hours / 24)} days`
}

const FILTERS = [
  { key: 'stat', label: 'STAT', tone: 'crit', test: (r) => r.is_emergency },
  { key: 'today', label: 'Needed today', tone: 'warn', test: (r) => dueToday(neededBy(r)) },
  { key: 'expiring', label: 'Expiring units', tone: 'warn', test: (r) => expiringCount(r) > 0 },
  { key: 'walk_in', label: 'Walk-in', tone: 'info', test: (r) => r.is_walk_in },
  { key: 'orders', label: 'Replenishment', tone: 'info', test: (r) => isOrder(r), dispatchOnly: true },
]

const searched = computed(() => {
  const term = search.value.trim().toLowerCase()
  if (!term) return requests.value
  return requests.value.filter((r) => [r.reference_number, r.requesting_facility?.name, r.weekly_request?.reference_number]
    .some((text) => String(text ?? '').toLowerCase().includes(term)))
})

const filterChips = computed(() => [
  { key: 'all', label: 'All', tone: 'neutral', count: searched.value.length },
  ...FILTERS.filter((f) => !f.dispatchOnly || forDispatch.value)
    .map((f) => ({ ...f, count: searched.value.filter(f.test).length })),
])

const ORDERS = {
  urgent: (a, b) => Number(Boolean(b.is_emergency)) - Number(Boolean(a.is_emergency))
    || orLast(time(neededBy(a))) - orLast(time(neededBy(b)))
    || earliestExpiry(a) - earliestExpiry(b)
    || orLast(time(a.request_date)) - orLast(time(b.request_date)),
  needed: (a, b) => orLast(time(neededBy(a))) - orLast(time(neededBy(b))) || ORDERS.urgent(a, b),
  expiry: (a, b) => earliestExpiry(a) - earliestExpiry(b) || ORDERS.urgent(a, b),
  status: (a, b) => statusRank(a) - statusRank(b) || ORDERS.urgent(a, b),
  oldest: (a, b) => orLast(time(a.request_date)) - orLast(time(b.request_date)),
  newest: (a, b) => orLast(-time(a.request_date)) - orLast(-time(b.request_date)),
}

const shown = computed(() => {
  const filter = FILTERS.find((f) => f.key === show.value)
  const list = filter ? searched.value.filter(filter.test) : [...searched.value]
  return list.sort(ORDERS[sortBy.value] ?? ORDERS.urgent)
})

/* GROUPS: each grouping names its groups in the order they are worked. */
const STATUS_ORDER = ['pending', 'processing', 'partial', 'fulfilled', 'rejected', 'cancelled']

function statusRank(request) {
  const at = STATUS_ORDER.indexOf(request.status)
  return at === -1 ? STATUS_ORDER.length : at
}

/** Who takes the units, as the dispatcher plans the day around it. */
function handoverKind(request) {
  if (request.is_walk_in) return 'walk_in'
  return request.supply_plan?.handover_method ?? 'unset'
}

const GROUP_DEFS = {
  priority: {
    of: (r) => (r.is_emergency ? 'stat' : dueToday(neededBy(r)) ? 'today' : neededBy(r) ? 'scheduled' : 'routine'),
    groups: [
      { key: 'stat', label: 'STAT', tone: 'crit', hint: 'Send these first' },
      { key: 'today', label: 'Needed today', tone: 'warn', hint: 'Due within the day' },
      { key: 'scheduled', label: 'Scheduled', tone: 'info', hint: 'A later hand-over' },
      { key: 'routine', label: 'Routine', tone: 'neutral', hint: '' },
    ],
  },
  status: {
    of: (r) => r.status ?? 'other',
    groups: () => STATUS_ORDER.concat('other').map((key) => ({
      key,
      label: key === 'other' ? 'Other' : requestStatusLabel({ status: key, is_open: true }),
      tone: { pending: 'warn', processing: 'info', partial: 'info', fulfilled: 'ok', rejected: 'crit' }[key] ?? 'neutral',
    })),
  },
  handover: {
    of: handoverKind,
    groups: [
      { key: 'walk_in', label: 'Watcher collects', tone: 'info', hint: 'Walk-ins, handed over at the counter' },
      { key: 'pickup', label: 'Hospital picks up', tone: 'info', hint: '' },
      { key: 'delivery', label: 'We deliver', tone: 'ok', hint: '' },
      { key: 'unset', label: 'Hand-over not set', tone: 'neutral', hint: '' },
    ],
  },
  type: {
    of: (r) => (r.weekly_request ? 'weekly' : isOrder(r) ? 'order' : 'patient'),
    groups: [
      { key: 'patient', label: 'Patient requests', tone: 'crit', hint: '' },
      { key: 'order', label: 'Replenishment orders', tone: 'info', hint: '' },
      { key: 'weekly', label: 'Weekly requests', tone: 'neutral', hint: 'One delivery each' },
    ],
  },
}

const groups = computed(() => {
  const list = shown.value
  if (groupBy.value === 'none') return [{ key: 'all', label: '', items: list }]

  if (groupBy.value === 'hospital') {
    const byName = new Map()
    for (const r of list) {
      const name = r.requesting_facility?.name || 'Hospital not recorded'
      if (!byName.has(name)) byName.set(name, [])
      byName.get(name).push(r)
    }
    // The hospital whose most urgent request leads, first.
    return [...byName.entries()].map(([name, items]) => ({ key: `h:${name}`, label: name, tone: 'neutral', items }))
  }

  const def = GROUP_DEFS[groupBy.value] ?? GROUP_DEFS.priority
  const named = typeof def.groups === 'function' ? def.groups() : def.groups
  return named
    .map((g) => ({ ...g, items: list.filter((r) => def.of(r) === g.key) }))
    .filter((g) => g.items.length)
})

// The one to start on: the most urgent of what is shown, whatever the grouping.
const nextUpId = computed(() => {
  if (shown.value.length < 2) return null
  return [...shown.value].sort(ORDERS.urgent)[0]?.id ?? null
})

function clearFilters() {
  search.value = ''
  show.value = 'all'
}

/** A replenishment order: nothing is tagged for it, its units are picked at dispatch. */
function isOrder(request) {
  return request.request_purpose === 'replenishment'
}

function taggedUnits(request) {
  return (request.allocations ?? []).filter((a) => a.status === 'allocated')
}

function taggedCount(request) {
  return taggedUnits(request).length
}

function componentFor(request, allocation) {
  const item = (request.items ?? []).find((i) => i.id === allocation.request_item_id)
  return item ? requestLineLabel(request, item) : '—'
}

/** Flags a bag close enough to expiry that a dispatcher should notice. */
function isExpiringSoon(expiry) {
  if (!expiry) return false
  const days = (new Date(expiry) - Date.now()) / 86_400_000
  return days <= 7
}

/* SELECTION */
function isSelected(request, allocationId) {
  return request.selected.includes(allocationId)
}

function selectedCount(request) {
  return request.selected.length
}

function toggleUnit(request, allocationId) {
  request.selected = isSelected(request, allocationId)
    ? request.selected.filter((id) => id !== allocationId)
    : [...request.selected, allocationId]
}

function allSelected(request) {
  const tagged = taggedUnits(request)
  return tagged.length > 0 && tagged.every((a) => isSelected(request, a.id))
}

function toggleAll(request) {
  request.selected = allSelected(request) ? [] : taggedUnits(request).map((a) => a.id)
}

/* DISPATCH */
const dispatchFor = ref(null)

const dispatchUnits = computed(() => {
  if (!dispatchFor.value) return []
  const tagged = taggedUnits(dispatchFor.value)
  // No selection means every tagged unit, which is what the API does with an
  // omitted allocation_ids.
  return dispatchFor.value.selected.length
    ? tagged.filter((a) => dispatchFor.value.selected.includes(a.id))
    : tagged
})

const dispatchCount = computed(() => dispatchUnits.value.length)

const handedTo = ref('')

function openDispatch(request) {
  actionError.value = ''
  handedTo.value = request.detail?.walk_in?.representative?.name ?? ''
  dispatchFor.value = request
}

function closeDispatch() {
  if (busyId.value) return
  dispatchFor.value = null
}

/*
 * Who the units leave with depends on how the order was confirmed: the
 * hospital's own staff on a pick-up, this centre's driver or courier on a
 * delivery, the watcher on a walk-in.
 */
function handedToLabel(request) {
  if (request.is_walk_in) return 'Handed to'
  if (request.supply_plan?.handover_method === 'pickup') return 'Collected by'
  if (request.supply_plan?.handover_method === 'delivery') return 'Driver or courier'
  return 'Handed to'
}

function handedToPlaceholder(request) {
  if (request.is_walk_in) return 'The watcher collecting the units'
  if (request.supply_plan?.handover_method === 'pickup') return "The hospital's staff member collecting the order"
  if (request.supply_plan?.handover_method === 'delivery') return 'Who is taking the order to the hospital'
  return 'Who is taking the units: courier or transport'
}

async function confirmDispatch() {
  const request = dispatchFor.value
  if (!request) return

  busyId.value = request.id
  actionError.value = ''

  try {
    const ids = request.selected.length ? request.selected : undefined
    const response = await bloodCenterService.releaseRequest(request.id, ids, handedTo.value || null)

    toastDispatched(request, response, dispatchCount.value)
    dispatchFor.value = null
    await load()
  } catch (err) {
    actionError.value = err?.message || 'Those units could not be dispatched.'
  } finally {
    busyId.value = null
  }
}

function toastDispatched(request, response, fallbackCount) {
  const issued = response?.released_units?.length ?? fallbackCount
  const closedShort = (response?.closed_short ?? []).reduce((sum, line) => sum + (line.quantity ?? 0), 0)
  toast(
    'Units Dispatched',
    'success',
    `${issued} unit(s) issued to ${request.requesting_facility?.name || 'the hospital'}${response?.status_label ? ` — ${response.status_label}` : ''}.`
      + (closedShort ? ` ${closedShort} unit(s) not supplied were closed.` : ''),
  )
}

/* DISPATCH A REPLENISHMENT ORDER */
const orderFor = ref(null)
const orderPickerRef = ref(null)
// Unit id → why the server would not send it, shown against its row.
const orderUnitErrors = ref({})

function openOrderDispatch(request) {
  actionError.value = ''
  orderUnitErrors.value = {}
  handedTo.value = ''
  orderFor.value = request
}

function closeOrderDispatch() {
  if (busyId.value) return
  orderFor.value = null
}

/** Send exactly the units picked; on a refusal, say which unit and why, and reload what is left. */
async function confirmOrderDispatch(unitIds) {
  const request = orderFor.value
  if (!request || !unitIds?.length) return

  busyId.value = request.id
  actionError.value = ''
  orderUnitErrors.value = {}

  try {
    const response = await bloodCenterService.dispatchOrder(request.id, unitIds, handedTo.value || null)

    toastDispatched(request, response, unitIds.length)
    orderFor.value = null
    await load()
  } catch (err) {
    const byUnit = {}

    for (const [key, messages] of Object.entries(err?.data?.errors ?? {})) {
      const index = Number(key.split('.')[1])
      if (key.startsWith('unit_ids.') && unitIds[index]) byUnit[unitIds[index]] = [messages].flat()[0]
    }

    orderUnitErrors.value = byUnit
    actionError.value = Object.keys(byUnit).length
      ? 'Some of the units picked could not be sent; nothing was dispatched. Change the pick and try again.'
      : err?.message || 'Those units could not be dispatched.'
    orderPickerRef.value?.reload()
  } finally {
    busyId.value = null
  }
}

/* DEFERRED PAYMENT */
const deferFor = ref(null)

function openDefer(request) {
  actionError.value = ''
  deferFor.value = request
}

function closeDefer() {
  if (busyId.value) return
  deferFor.value = null
}

// The request moves to For Dispatch, so that is where staff land, ready to send it.
async function confirmDefer() {
  const request = deferFor.value
  if (!request) return

  busyId.value = request.id
  actionError.value = ''

  try {
    const response = await bloodCenterService.deferPayment(request.id)
    toast('Payment Deferred', 'success', response?.message ?? 'The units can be dispatched.')
    deferFor.value = null
    await navigateTo({ path: '/blood-center/dispatch', query: { request: request.id } })
  } catch (err) {
    actionError.value = err?.message || 'The payment could not be deferred.'
  } finally {
    busyId.value = null
  }
}

/* CORRECT A DISPATCH RECORD */
const { can, canFile } = useUser()
const canCorrectDispatch = computed(() => can('corrections.request') && canFile('dispatch'))

function hasReleased(request) {
  return (request.allocations ?? []).some((a) => a.status === 'released')
}

function formatWhen(iso) {
  return iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'
}

// datetime-local wants the local wall time, to the minute.
function toLocalInput(iso) {
  if (!iso) return ''

  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')

  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const correctFor = ref(null)
const correctForm = reactive({ releasedAt: '', handedTo: '' })
const correctError = ref('')
const dispatchCorrection = ref(null)

function openCorrect(request, allocation) {
  correctError.value = ''
  correctForm.releasedAt = toLocalInput(allocation.released_at)
  correctForm.handedTo = allocation.handed_to ?? ''
  correctFor.value = { request, allocation }
}

function closeCorrect() {
  correctFor.value = null
}

// Only what differs goes to the dialog. The time is compared to the minute the
// form can show, so an untouched time is not sent back with its seconds lost.
function reviewCorrection() {
  const { allocation } = correctFor.value
  const changes = {}

  if (correctForm.releasedAt && correctForm.releasedAt !== toLocalInput(allocation.released_at)) {
    changes.released_at = new Date(correctForm.releasedAt).toISOString()
  }

  if ((correctForm.handedTo.trim() || null) !== (allocation.handed_to || null)) {
    changes.handed_to = correctForm.handedTo.trim() || null
  }

  if (!Object.keys(changes).length) {
    correctError.value = 'Nothing has changed yet.'
    return
  }

  correctError.value = ''
  dispatchCorrection.value = {
    allocationId: allocation.id,
    changes,
    previous: {
      released_at: allocation.released_at ? new Date(allocation.released_at).toISOString() : null,
      handed_to: allocation.handed_to || null,
    },
  }
}

async function onDispatchCorrectionSent(response) {
  dispatchCorrection.value = null
  correctFor.value = null

  // The Inventory Control Officer's own correction is applied at once.
  if (response?.data?.status === 'approved') {
    toast('Correction Applied', 'success', response?.message ?? 'The dispatch record is corrected.')
    await load()
    return
  }

  toast('Correction Requested', 'success', response?.message ?? 'It is applied once it is approved.')
}

/* RETURN TO STOCK */
const returnFor = ref(null)
const returnReason = ref('')

const returnCount = computed(() => {
  if (!returnFor.value) return 0
  return returnFor.value.selected.length || taggedCount(returnFor.value)
})

function openReturn(request) {
  actionError.value = ''
  returnReason.value = ''
  returnFor.value = request
}

function closeReturn() {
  if (busyId.value) return
  returnFor.value = null
}

async function confirmReturn() {
  const request = returnFor.value
  if (!request || !returnReason.value) return

  busyId.value = request.id
  actionError.value = ''

  try {
    const ids = request.selected.length ? request.selected : undefined
    await bloodCenterService.releaseHolds(request.id, returnReason.value, ids)

    toast('Units Returned', 'info', `${returnCount.value} unit(s) are available to other requests again.`)
    returnFor.value = null
    await load()
  } catch (err) {
    actionError.value = err?.message || 'Those units could not be returned.'
  } finally {
    busyId.value = null
  }
}

onMounted(load)

// Kept alive (fulfillment.vue, dispatch.vue): back here, the queue reloads
// quietly, and an Issue button's ?request= is marked again.
onPageReturn(() => load({ quiet: true }))
const pageHidden = usePageHidden()

/*
 * Kept current while it is open: every 30 seconds while this page and the tab
 * are in view, and when the tab comes back. Paused while anything is in hand:
 * an action running, a dialog open, or units ticked on any request, which a
 * refresh must not undo. The list route is unthrottled and writes no audit
 * entry on a read; neither do the review and statement reads of a changed row.
 */
useLiveRefresh(refreshQuietly, {
  intervalMs: 30_000,
  pauseWhen: () => busyId.value !== null
    || dispatchFor.value !== null
    || orderFor.value !== null
    || deferFor.value !== null
    || correctFor.value !== null
    || dispatchCorrection.value !== null
    || returnFor.value !== null
    || requests.value.some((row) => row.selected?.length > 0),
})
</script>

<style scoped>
/* Tokens come from app/assets/css/main.css. */
.fx-page { background: var(--rb-page-bg); font-family: var(--rb-font-sans); padding: 24px var(--rb-gutter, 24px) 40px; }
.fx-inner { max-width: var(--rb-content-max, 1600px); margin: 0 auto; }

/* The shared PageHeader, with the space below it the old header kept. */
.fx-inner > .ph { margin-bottom: 16px; }

/* tabs */
/* Find, filter and order: one row above the requests. */
.fx-tools {
  display: flex; align-items: center; flex-wrap: wrap; gap: 10px 14px; margin-bottom: 14px; padding: 12px 14px;
  border: 1px solid var(--rb-border); border-radius: 14px; background: var(--rb-surface);
}
.fx-search { position: relative; flex: 0 1 280px; min-width: 200px; }
.fx-search__icon { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--rb-text-secondary); pointer-events: none; }
.fx-search__input {
  width: 100%; height: 36px; padding: 0 12px 0 34px; border: 1px solid var(--rb-border-strong); border-radius: 10px;
  background: var(--rb-surface); color: var(--rb-text-primary); font: inherit; font-size: 13px;
}
.fx-search__input::placeholder { color: var(--rb-placeholder); }
.fx-search__input:focus { outline: none; border-color: var(--rb-primary); box-shadow: var(--rb-focus-ring); }
.fx-chips { display: flex; flex-wrap: wrap; gap: 6px; flex: 1 1 auto; }
.fx-chip {
  --tone: var(--rb-text-secondary);
  display: inline-flex; align-items: center; gap: 7px; height: 32px; padding: 0 6px 0 12px; border: 1px solid var(--rb-border);
  border-radius: 999px; background: var(--rb-surface); color: var(--rb-text-secondary); font: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer;
  transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease;
}
.fx-chip:hover { color: var(--rb-text-primary); border-color: var(--rb-border-strong); }
.fx-chip:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }
.fx-chip__count {
  min-width: 22px; padding: 0 7px; border-radius: 999px; background: var(--rb-surface-alt); color: var(--rb-text-primary);
  font-size: 11px; font-weight: 700; line-height: 20px; text-align: center; font-variant-numeric: tabular-nums;
}
.fx-chip--crit { --tone: var(--rb-accent); }
.fx-chip--warn { --tone: var(--rb-warning); }
.fx-chip--info { --tone: var(--rb-primary); }
.fx-chip--crit:not(.fx-chip--zero) .fx-chip__count { background: rgba(var(--rb-accent-rgb), 0.12); color: var(--rb-accent-text); }
.fx-chip--zero { color: var(--rb-text-muted); }
.fx-chip--zero .fx-chip__count { color: var(--rb-text-muted); }
.fx-chip--on { border-color: var(--rb-primary); background: rgba(var(--rb-primary-rgb), 0.08); color: var(--rb-primary-text); }
.fx-chip--on .fx-chip__count { background: var(--rb-primary); color: #fff; }
.fx-sort { display: inline-flex; align-items: center; gap: 8px; margin-left: auto; }
.fx-sort__label { font-size: 12px; font-weight: 600; color: var(--rb-text-secondary); }
.fx-sort__sel { width: 190px; }
.fx-sort__sel--group { width: 160px; }
.fx-sort__label + .fx-sort__sel + .fx-sort__label { margin-left: 6px; }

/* Groups: a quiet head over its cards, folding away. */
.request-groups { display: flex; flex-direction: column; gap: 18px; }
.fx-group { display: flex; flex-direction: column; gap: 10px; }
.fx-group__head {
  display: flex; align-items: center; gap: 8px; width: 100%; padding: 4px 2px; border: 0; background: none;
  color: var(--rb-text-primary); font: inherit; text-align: left; cursor: pointer;
}
.fx-group__head:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); border-radius: 8px; }
.fx-group__chev { color: var(--rb-text-secondary); flex-shrink: 0; }
.fx-group__dot { width: 8px; height: 8px; border-radius: 50%; background: var(--rb-text-muted); flex-shrink: 0; }
.fx-group__dot--crit { background: var(--rb-accent); }
.fx-group__dot--warn { background: var(--rb-warning); }
.fx-group__dot--info { background: var(--rb-primary); }
.fx-group__dot--ok { background: var(--rb-success); }
.fx-group__title { font-size: 14px; font-weight: 700; }
.fx-group__count {
  min-width: 22px; padding: 0 7px; border-radius: 999px; background: var(--rb-surface-alt); border: 1px solid var(--rb-border);
  font-size: 11.5px; font-weight: 700; line-height: 20px; text-align: center; font-variant-numeric: tabular-nums;
}
.fx-group__hint { font-size: 12px; color: var(--rb-text-secondary); }

/* Why a request sits where it does. */
.request-when { display: flex; flex-wrap: wrap; gap: 4px 16px; margin: 6px 0 0; font-size: 12px; color: var(--rb-text-secondary); }
.when { display: inline-flex; align-items: center; gap: 5px; }
.when--soon { color: var(--rb-warning-text); font-weight: 600; }
.tag--next {
  display: inline-flex; align-items: center; gap: 3px;
  background: rgba(var(--rb-primary-rgb), 0.1); color: var(--rb-primary-text);
}

.tabbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
.tabs { display: inline-flex; padding: 4px; gap: 4px; border-radius: 12px; border: 1px solid var(--rb-border); background: var(--rb-surface); }
.tab {
  display: inline-flex; align-items: center; gap: 8px; padding: 7px 14px; border: 0; border-radius: 9px;
  background: transparent; color: var(--rb-text-secondary); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer;
}
.tab:hover { color: var(--rb-text-primary); }
.tab--on { background: var(--rb-primary); color: #fff; }
.tab:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: 2px; }
.tab__count { min-width: 20px; padding: 0 7px; border-radius: 999px; background: #fff; color: var(--rb-primary); font-size: 11px; font-weight: 700; line-height: 18px; text-align: center; }

.dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.dot--allocated { background: var(--rb-warning); }
.dot--released { background: var(--rb-primary); }
.dot--received { background: var(--rb-success); }
.dot--cancelled { background: var(--rb-text-muted); }

.banner { display: flex; align-items: center; gap: 9px; padding: 11px 14px; border-radius: 10px; font-size: 13px; margin-bottom: 14px; }
.banner--error { background: rgba(var(--rb-accent-rgb), .08); color: var(--rb-accent-text); border: 1px solid rgba(var(--rb-accent-rgb), .25); }

.pills { display: flex; gap: 7px; margin-bottom: 14px; }
.pill {
  padding: 8px 15px; font-size: 12.5px; font-weight: 600; cursor: pointer;
  color: var(--rb-text-secondary); background: var(--rb-surface);
  border: 1px solid var(--rb-border-strong); border-radius: 999px;
}
.pill--on { border-color: var(--rb-primary); background: rgba(var(--rb-primary-rgb), .07); color: var(--rb-primary-text); }

.card { background: var(--rb-surface); border: 1px solid var(--rb-border); border-radius: 14px; }
.request-list { display: flex; flex-direction: column; gap: 14px; }
.request-card { padding: 16px 18px; box-shadow: 0 1px 2px rgba(var(--rb-shadow-rgb), 0.03); }
.request-card--stat { border-color: rgba(var(--rb-accent-rgb), 0.35); }

.request-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; }
.request-title { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.request-sub { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 12.5px; color: var(--rb-text-secondary); margin: 5px 0 0; }
.request-facility { font-weight: 600; color: var(--rb-text-primary); }
.request-counts { display: flex; gap: 6px; font-size: 12px; color: var(--rb-text-secondary); }
.count { display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 8px; border: 1px solid var(--rb-border); background: var(--rb-surface-alt); }
.count strong { font-size: 14px; color: var(--rb-text-primary); font-variant-numeric: tabular-nums; }

.mono { font-family: var(--rb-font-mono); font-size: 12.5px; font-weight: 600; }
.tag { padding: 1px 6px; border-radius: 5px; font-size: 10px; font-weight: 700; }
.tag--stat { background: var(--rb-accent); color: #fff; }
.tag--walk-in { background: rgba(var(--rb-purple-rgb), .12); color: var(--rb-purple-text); }
.tag--weekly { background: rgba(var(--rb-primary-rgb), .12); color: var(--rb-primary-text); }
/* A replenishment order's confirmed hand-over. */
.handover { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin: 6px 0 0; font-size: 12.5px; color: var(--rb-text-secondary); }
.handover strong { color: var(--rb-primary-text); font-weight: 700; }
.handover :deep(.asset-icon) { color: var(--rb-primary-text); }
.modal-warning {
  font-size: 12.5px; line-height: 1.5; margin: 0 0 14px; padding: 10px 12px; border-radius: 9px;
  background: rgba(var(--rb-warning-rgb), .12); color: var(--rb-warning-text); border: 1px solid rgba(var(--rb-warning-rgb), .3);
}
.request-fulfilment { margin-top: 12px; }
.blood-pill {
  display: inline-block; padding: 1px 7px; border-radius: 6px; font-weight: 700; font-size: 11.5px;
  background: rgba(var(--rb-accent-rgb), .1); color: var(--rb-accent-text);
}
.status { padding: 2px 9px; border-radius: 999px; font-size: 11px; font-weight: 600; }
.status--processing { background: rgba(var(--rb-primary-rgb), .1); color: var(--rb-primary-text); }
.status--partial { background: rgba(var(--rb-warning-rgb), .12); color: var(--rb-warning-text); }
.status--fulfilled { background: rgba(var(--rb-success-rgb), .12); color: var(--rb-success-text); }

.lines { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px; }
.line-chip {
  font-size: 11.5px; padding: 3px 9px; border-radius: 6px;
  background: var(--rb-surface-alt); color: var(--rb-text-secondary);
  border: 1px solid var(--rb-border);
}

.gate {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  margin-top: 12px; padding: 9px 12px; border-radius: 9px; font-size: 12.5px;
}
.gate--ok { background: rgba(var(--rb-success-rgb), .08); color: var(--rb-success-text); border: 1px solid rgba(var(--rb-success-rgb), .2); }
.gate--blocked { background: rgba(var(--rb-accent-rgb), .07); color: var(--rb-accent-text); border: 1px solid rgba(var(--rb-accent-rgb), .22); }
.gate-link { margin-left: auto; font-weight: 700; color: inherit; text-decoration: underline; }
.gate-action { margin-left: auto; }
.gate-link + .gate-action { margin-left: 4px; }

.units { margin-top: 12px; }
.units-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.units-table th {
  text-align: left; font-size: 10.5px; font-weight: 700; letter-spacing: .4px; text-transform: uppercase;
  color: var(--rb-text-secondary); padding: 0 10px 6px; border-bottom: 1px solid var(--rb-border-strong);
}
.units-table td { padding: 8px 10px; border-bottom: 1px solid var(--rb-border); color: var(--rb-text-primary); }
.units-table td.muted { color: var(--rb-text-secondary); }
.handed-to { display: block; font-size: 11.5px; color: var(--rb-text-secondary); }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
.units-table tr:last-child td { border-bottom: none; }
.units-table .pick { width: 30px; }
.units-empty { font-size: 12.5px; color: var(--rb-text-muted); margin: 0; }
.expiring { color: var(--rb-warning-text); font-weight: 600; }

.alloc { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 600; }
.alloc--allocated { color: var(--rb-warning-text); }
.alloc--released { color: var(--rb-primary-text); }
.alloc--cancelled { color: var(--rb-text-muted); }

.request-actions { display: flex; align-items: center; gap: 9px; margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--rb-border); flex-wrap: wrap; }
.selection-note { flex: 1; display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--rb-text-secondary); min-width: 180px; }

.empty { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 40px 20px; color: var(--rb-text-secondary); }
.empty__icon { width: 44px; height: 44px; border-radius: 12px; display: grid; place-items: center; background: rgba(var(--rb-primary-rgb), 0.08); color: var(--rb-primary-text); }
.empty h3 { font-size: 15px; color: var(--rb-text-primary); margin: 10px 0 4px; }
.empty p { font-size: 13px; margin: 0; }

.skeleton-wrap { padding: 16px; }
.skeleton {
  border-radius: 7px; margin-bottom: 10px;
  background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 50%, var(--rb-skeleton-a) 75%);
  background-size: 200% 100%; animation: shimmer 1.4s infinite;
}
.skeleton--row { height: 36px; }
@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }

.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  height: 38px; padding: 0 16px; font-size: 13px; font-weight: 700; font-family: inherit;
  border-radius: 10px; cursor: pointer; white-space: nowrap; transition: background-color .15s ease, border-color .15s ease;
}
.btn:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: 2px; }
.btn-primary { background: var(--rb-primary); color: #fff; border: 1px solid var(--rb-primary); }
.btn-primary:hover:not(:disabled) { background: #0D47A1; }
.btn-outline { background: var(--rb-surface); color: var(--rb-text-primary); border: 1px solid var(--rb-border-strong); }
.btn-outline:hover:not(:disabled) { background: var(--rb-surface-hover); }
.btn:disabled { opacity: .55; cursor: not-allowed; }
.btn-sm { height: 34px; padding: 0 14px; font-size: 12.5px; }

.modal-overlay {
  position: fixed; inset: 0; z-index: 90; background: var(--rb-overlay);
  display: flex; align-items: center; justify-content: center; padding: 20px;
}
.modal {
  width: 100%; max-width: 440px; background: var(--rb-surface);
  border-radius: 15px; padding: 22px; font-family: var(--rb-font-sans);
  max-height: 90vh; overflow-y: auto;
}
.modal-title { font-size: 17px; font-weight: 700; color: var(--rb-text-primary); margin: 0 0 3px; }
.modal-sub { font-size: 12.5px; color: var(--rb-text-secondary); margin: 0 0 14px; }
.modal-desc { font-size: 13px; color: var(--rb-text-secondary); margin: 0 0 14px; }
/* Beside the pick, in the unit picker's own body. */
.modal-warning--flush, .modal-desc--flush, .field--flush { margin: 0; }
.modal-units { list-style: none; margin: 0 0 14px; padding: 10px 12px; border: 1px solid var(--rb-border); border-radius: 9px; max-height: 160px; overflow-y: auto; }
.modal-units li { padding: 2px 0; color: var(--rb-text-primary); }
.unit-expiry { font-family: var(--rb-font-sans); font-weight: 400; color: var(--rb-text-secondary); }
.modal-actions { display: flex; justify-content: flex-end; gap: 9px; margin-top: 16px; }

.field { display: flex; flex-direction: column; gap: 5px; margin-bottom: 12px; }
.field-label { font-size: 12.5px; font-weight: 600; color: var(--rb-text-primary); }
.field-optional { font-weight: 400; color: var(--rb-text-secondary); }
.req { color: var(--rb-accent-text); }
.input {
  width: 100%; padding: 9px 11px; font-size: 13.5px; font-family: inherit;
  color: var(--rb-text-primary); background: var(--rb-surface);
  border: 1px solid var(--rb-border-strong); border-radius: 9px;
}
.input:focus { outline: none; border-color: var(--rb-primary); box-shadow: 0 0 0 3px rgba(var(--rb-primary-rgb), .12); }
.field-error { font-size: 11.5px; color: var(--rb-accent-text); margin: 0; }
.field-error--block { margin: 4px 0 0; }

.toast-stack { position: fixed; top: 18px; right: 18px; z-index: 120; display: flex; flex-direction: column; gap: 8px; }
.toast { background: var(--rb-surface); border: 1px solid var(--rb-border-strong); border-left-width: 3px; border-radius: 10px; padding: 11px 15px; min-width: 250px; }
.toast--success { border-left-color: var(--rb-success); }
.toast--danger { border-left-color: var(--rb-accent); }
.toast--info { border-left-color: var(--rb-primary); }
.toast-title { font-size: 13px; font-weight: 600; color: var(--rb-text-primary); }
.toast-message { font-size: 12px; color: var(--rb-text-secondary); margin-top: 2px; }
.toast-enter-active, .toast-leave-active { transition: opacity .25s, transform .25s; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateX(14px); }

.spinning { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg) } }

.fade-in { animation: fade-in .3s ease both; animation-delay: var(--delay, 0ms); }
@keyframes fade-in { from { opacity: 0; transform: translateY(5px) } to { opacity: 1; transform: none } }

@media (prefers-reduced-motion: reduce) {
  .fade-in, .skeleton, .spinning { animation: none; }
}

@media (max-width: 760px) {
  .fx-page { padding: 16px 16px 32px; }
  .units-table { font-size: 11.5px; }
  .units-table th, .units-table td { padding: 6px 6px; }
  .request-actions { flex-direction: column; align-items: stretch; }
}

/* Cards in the shared SectionCard's shape (2026-10-15). */
.card { border-radius: var(--rb-radius-lg); box-shadow: var(--rb-shadow-sm); }

/* The request its Issue button sent here. */
.request-card--focus { border-color: rgba(var(--rb-primary-rgb), 0.55); box-shadow: 0 0 0 3px rgba(var(--rb-primary-rgb), 0.14), var(--rb-shadow-sm); scroll-margin-top: 88px; }
</style>
