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
          <button class="ui-btn" :disabled="!showingNetwork && loading" @click="refreshShown">
            <AssetIcon name="refresh-cw" :size="16" :class="{ spinning: !showingNetwork && loading }" />
            Refresh
          </button>
        </template>
      </PageHeader>

      <!--
        Request Fulfillment's two lists (project owner, 2026-11-19): its own
        queue of invoices still owing, and every hospital's Blood Requests,
        whoever holds the shares.
      -->
      <div v-if="!forDispatch" class="tabbar fade-in" style="--delay:40ms">
        <div class="tabs" role="tablist" aria-label="Request Fulfillment">
          <button
            v-for="tab in FULFILMENT_TABS"
            :key="tab.value"
            type="button"
            role="tab"
            class="tab"
            :class="{ 'tab--on': fulfilmentTab === tab.value }"
            :aria-selected="fulfilmentTab === tab.value"
            @click="selectFulfilmentTab(tab.value)"
          >
            {{ tab.label }}
            <span v-if="fulfilmentTab === tab.value && tabCount(tab.value) !== null" class="tab__count">{{ tabCount(tab.value) }}</span>
          </button>
        </div>
      </div>

      <NetworkBloodRequests v-if="showingNetwork" ref="networkList" @loaded="networkTotal = $event" />

      <template v-else>
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
        <div class="fx-tools__row">
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
        <div class="fx-sort">
          <label class="fx-sort__field">
            <span class="fx-sort__label">Group by</span>
            <SelectField v-model="groupBy" class="fx-sort__sel fx-sort__sel--group" size="sm" aria-label="Group requests by" :options="GROUPINGS" />
          </label>
          <label class="fx-sort__field">
            <span class="fx-sort__label">Sort by</span>
            <SelectField v-model="sortBy" class="fx-sort__sel" size="sm" aria-label="Sort requests" :options="SORTS" />
          </label>
        </div>
        </div>
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

      <!--
        One row a request, one plain value a column, like the other lists
        (project owner, 2026-11-27). The eye shows the request; the row or Open
        opens it, where its units are picked, returned and dispatched.
      -->
      <div v-else class="card fx-table-card fade-in" style="--delay:80ms">
        <div class="fx-table-wrap">
          <table class="fx-table">
            <caption class="sr-only">{{ forDispatch ? (awaitingRelease ? 'Requests cleared to dispatch' : 'Requests waiting on the hospital to confirm receipt') : 'Requests whose invoice still has a balance' }}</caption>
            <thead>
              <tr>
                <th scope="col">Request</th>
                <th scope="col">Received</th>
                <th scope="col">Hospital</th>
                <th scope="col">Blood Type</th>
                <th scope="col" class="num">Requested</th>
                <template v-if="awaitingRelease">
                  <th scope="col" class="num">Tagged</th>
                  <th scope="col">First Expiry</th>
                  <th scope="col">Needed By</th>
                  <th scope="col">Payment</th>
                </template>
                <template v-else>
                  <th scope="col" class="num">Dispatched</th>
                  <th scope="col" class="num">Confirmed</th>
                </template>
                <th scope="col">Status</th>
                <th scope="col" class="end"><span class="sr-only">Actions</span></th>
              </tr>
            </thead>

            <tbody v-for="group in groups" :key="group.key">
              <!-- A group's head: what it holds and how many; it folds away. -->
              <tr v-if="group.label" class="fx-group-row">
                <th :colspan="columnCount" scope="colgroup">
                  <button
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
                </th>
              </tr>

              <template v-if="!folded.has(group.key)">
                <tr
                  v-for="request in group.items"
                  :id="`request-${request.id}`"
                  :key="request.id"
                  class="fx-row"
                  :class="{ 'fx-row--stat': request.is_emergency, 'fx-row--focus': request.id === focusId }"
                  tabindex="0"
                  :aria-label="`Open ${request.reference_number}`"
                  @click="openRequest(request)"
                  @keydown.enter.self="openRequest(request)"
                >
                  <td class="mono nowrap">{{ request.reference_number }}</td>
                  <td class="nowrap">{{ formatWhen(request.request_date) }}</td>
                  <td>{{ request.requesting_facility?.name || 'Not recorded' }}</td>
                  <td class="nowrap">{{ bloodTypeCodes(request).join(', ') || '—' }}</td>
                  <td class="num">{{ request.quantity }}</td>
                  <template v-if="awaitingRelease">
                    <td class="num">{{ isOrder(request) ? '—' : taggedCount(request) }}</td>
                    <td class="nowrap">{{ firstExpiry(request) || '—' }}</td>
                    <td class="nowrap">{{ neededBy(request) ? formatWhen(neededBy(request)) : '—' }}</td>
                    <td class="nowrap">{{ paymentLabel(request) }}</td>
                  </template>
                  <template v-else>
                    <td class="num">{{ request.fulfilled_quantity ?? 0 }}</td>
                    <td class="num">{{ request.received_count ?? 0 }}</td>
                  </template>
                  <td class="nowrap">{{ requestStatusLabel(request) }}</td>
                  <td class="end nowrap">
                    <RowViewButton :label="`View ${request.reference_number}`" @view="viewRequest(request)" />
                    <button type="button" class="fx-open" :aria-label="`Open ${request.reference_number}`" @click.stop="openRequest(request)">
                      Open
                      <AssetIcon name="arrow-right" :size="14" />
                    </button>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>
      </template>
    </div>

    <!--
      A request opened from its row: what its card used to hold (project owner,
      2026-11-27). It steps aside while one of its own dialogs is open, and is
      back when that one is cancelled.
    -->
    <CenterModal
      :open="Boolean(opened) && !stepping"
      :title="opened?.reference_number || 'Request'"
      :eyebrow="opened ? requestKind(opened) : ''"
      size="lg"
      @close="closeRequest"
    >
      <template v-if="opened" #meta>
        <span>{{ opened.requesting_facility?.name || 'Hospital not recorded' }}</span>
        <span aria-hidden="true">·</span>
        <span>{{ bloodTypeCodes(opened).join(', ') || 'Blood type not recorded' }}</span>
        <span aria-hidden="true">·</span>
        <span>{{ opened.quantity }} unit{{ opened.quantity === 1 ? '' : 's' }} requested<template v-if="opened.committed_quantity != null">, {{ opened.committed_quantity }} committed</template></span>
        <span aria-hidden="true">·</span>
        <span>{{ requestStatusLabel(opened) }}</span>
      </template>

      <div v-if="opened" class="rq">
        <!-- A replenishment order's hand-over, as the center confirmed it (project owner, 2026-10-29). -->
        <p v-if="opened.supply_plan" class="handover">
          <AssetIcon :name="opened.supply_plan.handover_method === 'delivery' ? 'truck' : 'hospital'" :size="14" />
          <strong>{{ opened.supply_plan.handover_method === 'delivery' ? 'Deliver' : 'Pick-up' }} · {{ handoverWhen(opened.supply_plan.scheduled_at) }}</strong>
          <span v-if="opened.supply_plan.handover_address">{{ opened.supply_plan.handover_method === 'delivery' ? 'to' : 'at' }} {{ opened.supply_plan.handover_address }}</span>
        </p>

        <!-- What was asked for beside what has been provided, per component. -->
        <RequestFulfilmentTable v-if="opened.detail" :request="opened.detail" />
        <div v-else-if="opened.items?.length" class="lines">
          <span v-for="item in opened.items" :key="item.id" class="line-chip">
            {{ requestLineLabel(opened, item) }} &times;{{ item.quantity }}
          </span>
        </div>

        <!-- BILLING GATE -->
        <div
          v-if="awaitingRelease"
          class="gate"
          :class="gateFor(opened).ok ? 'gate--ok' : 'gate--blocked'"
        >
          <AssetIcon :name="gateFor(opened).ok ? 'check' : 'octagon-alert'" :size="15" />
          <span>{{ gateFor(opened).message }}</span>
          <!-- Issuance only sees the release gate. Billing now owns every
               subsidy decision and checks its centrally scheduled dates. -->
          <NuxtLink v-if="!gateFor(opened).ok && can('billing.record_payment')" to="/blood-center/billing" class="gate-link">
            Go to Billing
          </NuxtLink>
          <button
            v-if="gateFor(opened).canDefer"
            type="button"
            class="ui-btn ui-btn--sm gate-action"
            :disabled="busyId === opened.id"
            @click="openDefer(opened)"
          >
            Issue with Deferred Payment
          </button>
        </div>

        <!-- UNITS -->
        <div class="units">
          <div v-if="opened.loadingUnits" class="skeleton skeleton--row" />

          <table v-else-if="opened.allocations?.length" class="units-table">
            <thead>
              <tr>
                <th v-if="awaitingRelease && !isOrder(opened)" scope="col" class="pick">
                  <input
                    type="checkbox"
                    :checked="allSelected(opened)"
                    :aria-label="`Select every tagged unit on ${opened.reference_number}`"
                    @change="toggleAll(opened)"
                  >
                </th>
                <th scope="col">Unit</th>
                <th scope="col">Component</th>
                <th scope="col">Expires</th>
                <th scope="col">Storage</th>
                <th scope="col">State</th>
                <th v-if="hasReleased(opened)" scope="col">Dispatched</th>
                <th v-if="hasReleased(opened) && canCorrectDispatch" scope="col"><span class="sr-only">Correct</span></th>
                <th scope="col" class="view-col"><span class="sr-only">View</span></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="allocation in opened.allocations" :key="allocation.id">
                <td v-if="awaitingRelease && !isOrder(opened)" class="pick">
                  <input
                    v-if="allocation.status === 'allocated'"
                    type="checkbox"
                    :checked="isSelected(opened, allocation.id)"
                    :aria-label="`Select unit ${allocation.unit_id}`"
                    @change="toggleUnit(opened, allocation.id)"
                  >
                </td>
                <td class="mono">{{ allocation.unit_id }}</td>
                <td>{{ componentFor(opened, allocation) }}</td>
                <td :class="{ expiring: isExpiringSoon(allocation.expiry_date) }">
                  {{ allocation.expiry_date || 'Not set' }}
                </td>
                <td :class="{ muted: !allocation.storage_location }">{{ allocation.storage_location || 'Not set' }}</td>
                <!-- One plain value a column (project owner, 2026-11-27); the eye shows the rest. -->
                <td>{{ allocation.received_at ? 'Received' : allocation.status_label }}</td>
                <td v-if="hasReleased(opened)">{{ allocation.status === 'released' ? formatWhen(allocation.released_at) : '—' }}</td>
                <td v-if="hasReleased(opened) && canCorrectDispatch">
                  <button
                    v-if="allocation.status === 'released'"
                    type="button"
                    class="ui-btn ui-btn--sm"
                    :aria-label="`Request a correction to the dispatch record of unit ${allocation.unit_id}`"
                    @click="openCorrect(opened, allocation)"
                  >
                    Correct
                  </button>
                </td>
                <td class="view-col">
                  <RowViewButton :label="`View unit ${allocation.unit_id}`" @view="viewUnit(opened, allocation)" />
                </td>
              </tr>
            </tbody>
          </table>

          <p v-else class="units-empty">{{ isOrder(opened) ? 'Nothing is held for this order. Pick its units as you dispatch it.' : 'No units are tagged for this request.' }}</p>
        </div>
      </div>

      <template #actions>
        <template v-if="opened">
          <!-- A confirmed replenishment order: nothing to return, the bags are picked as it goes. -->
          <template v-if="awaitingRelease && isOrder(opened)">
            <span class="selection-note">
              {{ opened.outstanding_quantity }} unit{{ opened.outstanding_quantity === 1 ? '' : 's' }} to send
            </span>
            <button
              class="ui-btn ui-btn--primary"
              :disabled="busyId === opened.id || !opened.outstanding_quantity"
              @click="openOrderDispatch(opened)"
            >
              <AssetIcon v-if="busyId !== opened.id" name="truck" :size="15" />
              {{ busyId === opened.id ? 'Working…' : 'Pick Units & Dispatch' }}
            </button>
          </template>

          <template v-else-if="awaitingRelease">
            <span class="selection-note">
              {{ selectedCount(opened) > 0
                ? `${selectedCount(opened)} unit(s) selected`
                : 'Nothing selected — Dispatch sends every tagged unit.' }}
            </span>
            <button
              class="ui-btn"
              :disabled="busyId === opened.id || taggedCount(opened) === 0"
              @click="openReturn(opened)"
            >
              Return to Stock
            </button>
            <button
              class="ui-btn ui-btn--primary"
              :disabled="busyId === opened.id || taggedCount(opened) === 0 || !gateFor(opened).ok"
              @click="openDispatch(opened)"
            >
              <AssetIcon v-if="busyId !== opened.id" name="truck" :size="15" />
              {{ busyId === opened.id ? 'Working…' : 'Dispatch' }}
            </button>
          </template>

          <template v-else>
            <!-- Receipt is confirmed by the hospital, not here. -->
            <span class="selection-note">
              <AssetIcon name="clock" :size="13" />
              {{ opened.requesting_facility?.name || 'The hospital' }} confirmed {{ opened.received_count ?? 0 }} of {{ opened.fulfilled_quantity ?? 0 }}.
            </span>
            <button type="button" class="ui-btn" @click="closeRequest">Close</button>
          </template>
        </template>
      </template>
    </CenterModal>

    <!-- Everything about a request, read only, from its row's eye. -->
    <RecordDialog :open="Boolean(viewingRequest)" :title="viewingRequest?.title || 'Request'" eyebrow="Request" :sections="viewingRequest?.sections || []" @close="viewingRequest = null">
      <template #actions>
        <button type="button" class="ui-btn ui-btn--primary" @click="openViewed">Open</button>
      </template>
    </RecordDialog>

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

    <!-- Everything about a unit on a request, read only. -->
    <RecordDialog :open="Boolean(viewing)" :title="viewing?.title || 'Unit'" eyebrow="Unit" :sections="viewing?.sections || []" @close="viewing = null" />
  </div>
</template>

<script setup>
import SkeletonList from '~/components/ui/SkeletonList.vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import RequestFulfilmentTable from '~/components/common/RequestFulfilmentTable.vue'
import BloodCenterCorrectionRequestDialog from '~/components/BloodCenter/CorrectionRequestDialog.vue'
import UnitPickerDialog from '~/components/BloodCenter/UnitPickerDialog.vue'
import NetworkBloodRequests from '~/components/BloodCenter/NetworkBloodRequests.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import { bloodTypeCodes, handoverWhen, requestLineLabel, requestStatusLabel } from '~/types/bloodRequest'
import { pesos } from '~/utils/billing'
import DateTimeField from '~/components/common/DateTimeField.vue'
import PageHeader from '~/components/ui/PageHeader.vue'
import EmptyState from '~/components/ui/EmptyState.vue'
import RecordDialog from '~/components/ui/RecordDialog.vue'
import CenterModal from '~/components/ui/CenterModal.vue'
import RowViewButton from '~/components/ui/RowViewButton.vue'
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

// Request Fulfillment and For Dispatch's first tab: units still to go out.
const awaitingRelease = computed(() => activeTab.value === 'awaiting_release')
const columnCount = computed(() => (awaitingRelease.value ? 11 : 9))

/* TOASTS */
const { notify: toast } = useToast()

// ?request=ID: the request its Issue button sent here, marked and scrolled to.
const route = useRoute()
const focusId = computed(() => {
  const id = Number(route.query.request)
  return Number.isInteger(id) && id > 0 ? id : null
})

watch(activeTab, () => load())

/*
 * Request Fulfillment's tabs (project owner, 2026-11-19): the queue of
 * invoices still owing, and every hospital's Blood Requests. The second is
 * kept in the address (?tab=all) so a link or a reload lands on it.
 */
const FULFILMENT_TABS = [
  { value: 'owing', label: 'Awaiting Payment' },
  { value: 'all', label: 'All Blood Requests' },
]
const router = useRouter()
const fulfilmentTab = ref(route.query.tab === 'all' ? 'all' : 'owing')
const showingNetwork = computed(() => !forDispatch.value && fulfilmentTab.value === 'all')
const networkList = ref(null)
const networkTotal = ref(null)

function selectFulfilmentTab(value) {
  if (fulfilmentTab.value === value) return
  fulfilmentTab.value = value
  router.replace({ query: { ...route.query, tab: value === 'all' ? 'all' : undefined } })
  // Back on the queue, it reloads: it was left alone while the other tab showed.
  if (value === 'owing') load({ quiet: true })
}

function tabCount(value) {
  if (value === 'all') return networkTotal.value
  return loading.value ? null : requests.value.length
}

function refreshShown() {
  if (showingNetwork.value) networkList.value?.refresh()
  else load()
}

/** What each list asks the server for: the invoice decides the page. */
function queueFilters() {
  if (!forDispatch.value) return { awaiting_release: 1, release_cleared: 0 }
  return activeTab.value === 'awaiting_release' ? { awaiting_release: 1, release_cleared: 1 } : { awaiting_receipt: 1 }
}

/**
 * The request Issue sent here: marked on this list or, when its invoice is
 * already cleared, opened on For Dispatch instead.
 */
// Opened once for each time a link names it, not again on every reload.
let autoOpened = null
watch(focusId, () => { autoOpened = null })

async function showFocused() {
  const id = focusId.value
  if (!id) return
  if (requests.value.some(r => r.id === id)) {
    await nextTick()
    document.getElementById(`request-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    if (autoOpened !== id) {
      autoOpened = id
      openedId.value = id
    }
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
    openedId.value = null
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
    openedId.value = null
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
    openedId.value = null
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

/*
 * THE OPENED REQUEST (project owner, 2026-11-27): the list is one row a
 * request, and the row opens it in a dialog where its units are picked,
 * returned and dispatched. Held by id, so a reload shows the request as it now
 * reads, and closes the dialog once it has left this list.
 */
const openedId = ref(null)
const opened = computed(() => (openedId.value === null ? null : requests.value.find((r) => r.id === openedId.value) ?? null))

// One of the request's own dialogs is open over it: the request steps aside.
const stepping = computed(() => dispatchFor.value !== null
  || orderFor.value !== null
  || deferFor.value !== null
  || correctFor.value !== null
  || dispatchCorrection.value !== null
  || returnFor.value !== null)

function openRequest(request) {
  if (busyId.value) return
  actionError.value = ''
  openedId.value = request.id
}

function closeRequest() {
  if (busyId.value) return
  openedId.value = null
}

/** What sort of request it is, over its reference in the dialogs. */
function requestKind(request) {
  if (request.weekly_request) return `Weekly request ${request.weekly_request.reference_number}`
  if (isOrder(request)) return 'Replenishment order'
  const kind = request.is_walk_in ? 'Walk-in request' : 'Patient request'
  return request.is_emergency ? `STAT · ${kind}` : kind
}

/** The invoice in one plain value, for the Payment column. */
function paymentLabel(request) {
  const billing = request.billing
  if (!billing) return isOrder(request) ? 'Billed at dispatch' : 'No invoice'
  if (billing.is_payment_deferred) return 'Deferred'
  if (billing.clears_release) {
    if (billing.is_statement_only) return 'Invoice only'
    if (billing.is_subsidised) return 'Subsidised'
    return 'Settled'
  }
  return `${owedOn(request)} owing`
}

/** The soonest expiry among the bags still held for it, as the units table shows dates. */
function firstExpiry(request) {
  const dates = taggedUnits(request).map((a) => a.expiry_date).filter(Boolean).sort()
  return dates[0] ?? ''
}

/* VIEW: a request's eye, read only, with Open to work it */
const viewingRequest = ref(null)

function viewRequest(request) {
  const plan = request.supply_plan
  const delivery = plan?.handover_method === 'delivery'

  viewingRequest.value = {
    id: request.id,
    title: request.reference_number || 'Request',
    sections: [
      { title: 'Request', rows: [
        { label: 'Reference', value: request.reference_number, mono: true },
        { label: 'Type', value: requestKind(request) },
        { label: 'Hospital', value: request.requesting_facility?.name },
        { label: 'Blood type', value: bloodTypeCodes(request).join(', ') },
        { label: 'Urgency', value: request.urgency_label },
        { label: 'Status', value: requestStatusLabel(request) },
      ] },
      { title: 'Timing', rows: [
        { label: 'Received', value: request.request_date ? formatWhen(request.request_date) : '' },
        { label: 'Waiting', value: waitingFor(request) },
        { label: 'Needed by', value: neededBy(request) ? formatWhen(neededBy(request)) : '' },
        { label: 'Hand-over', value: plan ? `${delivery ? 'Deliver' : 'Pick-up'} · ${handoverWhen(plan.scheduled_at)}` : '' },
        { label: delivery ? 'Deliver to' : 'Pick-up at', value: plan?.handover_address },
      ] },
      { title: 'Units', rows: [
        { label: 'Requested', value: request.quantity },
        { label: 'Committed', value: request.committed_quantity },
        { label: 'Tagged', value: isOrder(request) ? '' : taggedCount(request) },
        { label: 'First expiry', value: firstExpiry(request) },
        { label: 'Expiring within 7 days', value: expiringCount(request) || '' },
        { label: 'Dispatched', value: request.fulfilled_quantity },
        { label: 'Confirmed by the hospital', value: request.received_count },
      ] },
      { title: 'Payment', rows: [
        { label: 'Payment', value: paymentLabel(request) },
        { label: 'Release', value: gateFor(request).message, wide: true },
      ] },
    ],
  }
}

function openViewed() {
  const id = viewingRequest.value?.id
  viewingRequest.value = null
  if (id != null) openedId.value = id
}

/* VIEW: a unit's eye opens everything the units table leaves out (project owner, 2026-11-27) */
const viewing = ref(null)
function viewUnit(request, allocation) {
  viewing.value = {
    title: allocation.unit_id || 'Unit',
    sections: [
      { title: 'Unit', rows: [
        { label: 'Unit ID', value: allocation.unit_id, mono: true },
        { label: 'Component', value: componentFor(request, allocation) },
        { label: 'Expires', value: allocation.expiry_date || 'Not set' },
        { label: 'Storage', value: allocation.storage_location || 'Not set' },
        { label: 'State', value: allocation.received_at ? 'Received' : allocation.status_label },
      ] },
      { title: 'Movement', rows: [
        { label: 'Tagged', value: allocation.allocated_at ? formatWhen(allocation.allocated_at) : '' },
        { label: 'Dispatched', value: allocation.released_at ? formatWhen(allocation.released_at) : '' },
        { label: 'Handed to', value: allocation.handed_to },
        { label: 'Received by the hospital', value: allocation.received_at ? formatWhen(allocation.received_at) : '' },
      ] },
      { title: 'Request', rows: [
        { label: 'Reference', value: request.reference_number, mono: true },
        { label: 'Hospital', value: request.requesting_facility?.name },
      ] },
    ],
  }
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
// quietly, and an Issue button's ?request= is marked again. A link naming a
// tab (?tab=all) opens that one; the Blood Requests list reloads itself.
onPageReturn(() => {
  // A link back naming a request opens it again.
  autoOpened = null
  if (!forDispatch.value) fulfilmentTab.value = route.query.tab === 'all' ? 'all' : 'owing'
  if (showingNetwork.value) return
  return load({ quiet: true })
})
const pageHidden = usePageHidden()

/*
 * A unit's view opens over its request, and closing it unlocks the page's
 * scroll (each dialog keeps its own lock). Locked again after it, while the
 * request is still open.
 */
watch(() => viewing.value, (now) => {
  if (!now && opened.value && !stepping.value && !pageHidden.value) document.body.style.overflow = 'hidden'
}, { flush: 'post' })

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
    || showingNetwork.value
    || dispatchFor.value !== null
    || orderFor.value !== null
    || deferFor.value !== null
    || correctFor.value !== null
    || dispatchCorrection.value !== null
    || returnFor.value !== null
    || openedId.value !== null
    || viewingRequest.value !== null
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

/* Groups: a quiet head row over its requests, folding away. */
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

.mono { font-family: var(--rb-font-mono); font-size: 12.5px; font-weight: 600; }
/* A replenishment order's confirmed hand-over. */
.handover { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin: 0; font-size: 12.5px; color: var(--rb-text-secondary); }
.handover strong { color: var(--rb-primary-text); font-weight: 700; }
.handover :deep(.asset-icon) { color: var(--rb-primary-text); }
.modal-warning {
  font-size: 12.5px; line-height: 1.5; margin: 0 0 14px; padding: 10px 12px; border-radius: 9px;
  background: rgba(var(--rb-warning-rgb), .12); color: var(--rb-warning-text); border: 1px solid rgba(var(--rb-warning-rgb), .3);
}

.lines { display: flex; gap: 6px; flex-wrap: wrap; }
.line-chip {
  font-size: 11.5px; padding: 3px 9px; border-radius: 6px;
  background: var(--rb-surface-alt); color: var(--rb-text-secondary);
  border: 1px solid var(--rb-border);
}

.gate {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  padding: 9px 12px; border-radius: 9px; font-size: 12.5px;
}
.gate--ok { background: rgba(var(--rb-success-rgb), .08); color: var(--rb-success-text); border: 1px solid rgba(var(--rb-success-rgb), .2); }
.gate--blocked { background: rgba(var(--rb-accent-rgb), .07); color: var(--rb-accent-text); border: 1px solid rgba(var(--rb-accent-rgb), .22); }
.gate-link { margin-left: auto; font-weight: 700; color: inherit; text-decoration: underline; }
.gate-action { margin-left: auto; }
.gate-link + .gate-action { margin-left: 4px; }

.units-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.units-table th {
  text-align: left; font-size: 10.5px; font-weight: 700; letter-spacing: .4px; text-transform: uppercase;
  color: var(--rb-text-secondary); padding: 0 10px 6px; border-bottom: 1px solid var(--rb-border-strong);
}
.units-table td { padding: 8px 10px; border-bottom: 1px solid var(--rb-border); color: var(--rb-text-primary); }
.units-table td.muted { color: var(--rb-text-secondary); }
.units-table .view-col { width: 1%; padding-block: 4px; text-align: right; white-space: nowrap; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
.units-table tr:last-child td { border-bottom: none; }
.units-table .pick { width: 30px; }
.units-empty { font-size: 12.5px; color: var(--rb-text-muted); margin: 0; }
.expiring { color: var(--rb-warning-text); font-weight: 600; }


/* The request dialog's footer: what will happen, left of its buttons. */
.selection-note { flex: 1; display: inline-flex; align-items: center; gap: 6px; margin-right: auto; font-size: 12.5px; color: var(--rb-text-secondary); min-width: 180px; }

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
}

/* Cards in the shared SectionCard's shape (2026-10-15). */
.card { border-radius: var(--rb-radius-lg); box-shadow: var(--rb-shadow-sm); }


/* ---------- The toolbar in two rows (2026-11-11) ---------- */
.fx-tools { display: flex; flex-direction: column; align-items: stretch; flex-wrap: nowrap; gap: 0; padding: 0; overflow: hidden; }
.fx-tools__row { display: flex; align-items: center; gap: 12px; padding: 12px 14px; }
.fx-tools .fx-search { flex: 1 1 auto; max-width: 440px; }
.fx-tools .fx-sort { gap: 12px; margin-left: auto; }
.fx-sort__field { display: inline-flex; align-items: center; gap: 8px; }
.fx-sort__label { white-space: nowrap; }
.fx-tools .fx-chips { flex: none; gap: 8px; padding: 10px 14px; border-top: 1px solid var(--rb-border); background: var(--rb-surface-alt); }
.fx-tools .fx-chip { height: 30px; background: var(--rb-surface); }
.fx-tools .fx-chip--on { background: rgba(var(--rb-primary-rgb), 0.08); }

/*
 * The list (project owner, 2026-11-27): one row a request, one plain value a
 * column, like Incoming Requests and Stock Intake. Groups are head rows.
 */
.fx-table-card { overflow: hidden; }
.fx-table-wrap { overflow-x: auto; }
.fx-table { width: 100%; min-width: 980px; border-collapse: collapse; font-size: 13px; }
.fx-table thead th {
  padding: 10px 14px; background: var(--rb-surface-alt); border-bottom: 1px solid var(--rb-border); text-align: left;
  font-size: 10.5px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--rb-text-secondary); white-space: nowrap;
}
.fx-table tbody td { padding: 12px 14px; border-bottom: 1px solid var(--rb-border); color: var(--rb-text-primary); vertical-align: middle; }
.fx-table th:first-child, .fx-table td:first-child { padding-left: 20px; }
.fx-table th:last-child, .fx-table td:last-child { padding-right: 20px; }
.fx-table tbody:last-child tr:last-child td { border-bottom: 0; }
.fx-table .num { text-align: right; font-variant-numeric: tabular-nums; }
.fx-table .end { text-align: right; }
.fx-table .nowrap { white-space: nowrap; }
.fx-table td.end > * { vertical-align: middle; }
.fx-table td.end > * + * { margin-left: 6px; }

.fx-group-row th { padding: 8px 14px 8px 18px; background: var(--rb-surface); border-bottom: 1px solid var(--rb-border); text-align: left; }
.fx-table tbody + tbody .fx-group-row th { border-top: 1px solid var(--rb-border); }

.fx-row { cursor: pointer; transition: background 0.12s ease; }
.fx-row:hover { background: var(--rb-surface-hover); }
.fx-row:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: -2px; }
/* STAT, as Incoming Requests marks it: a tint, not a chip. */
.fx-row--stat td { background: rgba(var(--rb-accent-rgb), 0.04); }
.fx-row--stat:hover td { background: rgba(var(--rb-accent-rgb), 0.07); }
/* The request its Issue button sent here. */
.fx-row--focus td { background: rgba(var(--rb-primary-rgb), 0.07); }
.fx-row { scroll-margin-top: 88px; }

.fx-open {
  display: inline-flex; align-items: center; gap: 5px; height: 30px; padding: 0 10px; border-radius: 8px;
  border: 1px solid rgba(var(--rb-primary-rgb), 0.45); background: rgba(var(--rb-primary-rgb), 0.06);
  color: var(--rb-primary-text); font: inherit; font-size: 12px; font-weight: 700; white-space: nowrap; cursor: pointer;
  transition: background 0.12s ease;
}
.fx-open:hover, .fx-row:hover .fx-open { background: rgba(var(--rb-primary-rgb), 0.12); }
.fx-open:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }

/* The opened request: what its card held, top to bottom. */
.rq { display: flex; flex-direction: column; gap: 14px; }

@media (prefers-reduced-motion: reduce) {
  .fx-row, .fx-open { transition: none; }
}
</style>
