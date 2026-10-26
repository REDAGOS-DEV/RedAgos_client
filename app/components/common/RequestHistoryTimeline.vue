<template>
  <div class="history">
    <div v-if="loading" class="history__loading" aria-busy="true">
      <div v-for="n in 3" :key="n" class="history__skeleton" />
    </div>

    <p v-else-if="error" class="history__error" role="alert">{{ error }}</p>

    <p v-else-if="!events.length" class="history__empty">Nothing has been recorded for this request yet.</p>

    <ol v-else class="history__list">
      <li v-for="event in events" :key="event.id" class="history__item">
        <span class="history__dot" :class="`tone--${toneFor(event)}`" aria-hidden="true">
          <AssetIcon :name="iconFor(event)" :size="12" />
        </span>

        <div class="history__body">
          <div class="history__head">
            <span class="history__title">{{ event.event_label }}</span>
            <span v-if="showAllocation && event.allocation" class="history__tag history__tag--allocation">
              <NuxtLink v-if="allocationLinkBase" :to="`${allocationLinkBase}${event.allocation.id}`">{{ event.allocation.reference_number }}</NuxtLink>
              <template v-else>{{ event.allocation.reference_number }}</template>
              <template v-if="event.allocation.facility"> · {{ event.allocation.facility }}</template>
            </span>
            <span v-if="event.item?.component" class="history__tag">{{ lineName(event, event.item) }}</span>
            <span
              v-if="event.to_status && event.to_status !== event.from_status"
              class="history__transition"
            >
              <template v-if="event.from_status">{{ statusLabel(event.from_status) }} → </template>{{ event.to_status_label || statusLabel(event.to_status) }}
            </span>
          </div>

          <p class="history__meta">
            {{ formatDateTime(event.created_at) }}
            <template v-if="event.actor"> · {{ event.actor.name }}</template>
            <template v-else> · System</template>
            <template v-if="event.actor_facility"> · {{ event.actor_facility.name }}</template>
            <template v-if="event.unit_count"> · {{ event.unit_count }} unit{{ event.unit_count === 1 ? '' : 's' }}</template>
          </p>

          <p v-if="event.note" class="history__note">{{ event.note }}</p>

          <p v-if="event.related_request" class="history__related">
            <AssetIcon name="link" :size="12" />
            <NuxtLink v-if="relatedLink(event)" :to="relatedLink(event)">{{ event.related_request.reference_number }}</NuxtLink>
            <span v-else class="mono">{{ event.related_request.reference_number }}</span>
            <template v-if="event.related_request.facility"> · {{ event.related_request.facility }}</template>
          </p>

          <details v-if="event.lines?.length" class="history__lines">
            <summary>Fulfilment at this point</summary>
            <table>
              <thead>
                <tr>
                  <th scope="col">Component</th>
                  <th scope="col" class="num">{{ isRequirementSnapshot(event) ? 'Required' : 'Requested' }}</th>
                  <th v-if="isRequirementSnapshot(event)" scope="col" class="num">Approved</th>
                  <th scope="col" class="num">Fulfilled</th>
                  <th scope="col" class="num">Remaining</th>
                  <th v-if="isRequirementSnapshot(event)" scope="col" class="num">Unallocated</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="line in event.lines" :key="line.request_item_id ?? line.transfusion_request_item_id">
                  <td>{{ line.component ? lineName(event, line) : '—' }}</td>
                  <td class="num">{{ line.required ?? line.requested }}</td>
                  <td v-if="isRequirementSnapshot(event)" class="num">{{ line.approved ?? 0 }}</td>
                  <td class="num">{{ line.fulfilled }}</td>
                  <td class="num">{{ line.remaining }}</td>
                  <td v-if="isRequirementSnapshot(event)" class="num">{{ line.unallocated ?? 0 }}</td>
                  <td>{{ line.status_label || line.status }}</td>
                </tr>
              </tbody>
            </table>
          </details>
        </div>
      </li>
    </ol>
  </div>
</template>

<script setup>
/**
 * A request's history, as the API recorded it.
 *
 * Every event carries who did it, from which facility, the status it moved
 * between, and a snapshot of every line at that moment — so the fulfilment of
 * a request can be read back as it stood at each step rather than guessed from
 * timestamps.
 *
 * A Patient Transfusion Request's timeline holds its own events — created,
 * more facilities asked, a component closed, cancelled — beside every event
 * of every facility allocation; `showAllocation` tags each of the latter with
 * the allocation and centre it happened to.
 */

import AssetIcon from '~/components/common/AssetIcon.vue'
import { REQUEST_STATUS_LABELS } from '~/types/bloodRequest'

const props = defineProps({
  events: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  /** Where a related request opens, e.g. '/hospital/bloodrequests/'. Omit for plain text. */
  linkBase: { type: String, default: '' },
  /** Tag each event with the facility allocation it happened to — on a Patient Transfusion Request. */
  showAllocation: { type: Boolean, default: false },
  /** Where an allocation opens, e.g. '/hospital/bloodrequests/'. Omit for plain text. */
  allocationLinkBase: { type: String, default: '' },
})

const ICONS = {
  submitted: 'send',
  walk_in_recorded: 'phone',
  transfusion_created: 'clipboard-plus',
  allocations_added: 'route',
  allocation_withdrawn: 'refresh-cw',
  requirement_closed: 'circle-x',
  transfusion_cancelled: 'x',
  allocated: 'archive',
  holds_returned: 'refresh-cw',
  hold_expired: 'clock',
  released: 'truck',
  receipt_confirmed: 'check-circle',
  line_closed: 'circle-x',
  rejected: 'circle-x',
  cancelled: 'x',
}

const TONES = {
  rejected: 'danger',
  cancelled: 'muted',
  line_closed: 'muted',
  hold_expired: 'warning',
  holds_returned: 'warning',
  allocation_withdrawn: 'warning',
  released: 'success',
  receipt_confirmed: 'success',
  allocations_added: 'info',
  transfusion_created: 'progress',
  requirement_closed: 'muted',
  transfusion_cancelled: 'muted',
  walk_in_recorded: 'progress',
}

/** A requirement-level snapshot carries what the patient needs, not what one centre was asked. */
function isRequirementSnapshot(event) {
  return event.lines?.[0]?.required !== undefined
}

/**
 * Name a line as the event recorded it, with its blood type when the lines differ.
 *
 * Only a weekly request's lines differ in type — "A+ Cryoprecipitate" beside
 * "AB+ Cryoprecipitate" — so any other request reads exactly as before.
 */
function lineName(event, line) {
  const types = new Set((event.lines ?? []).map((snapshot) => snapshot.blood_type).filter(Boolean))

  return types.size > 1 && line.blood_type ? `${line.blood_type} ${line.component}` : line.component
}

function iconFor(event) {
  return ICONS[event.event] ?? 'activity'
}

function toneFor(event) {
  return TONES[event.event] ?? 'info'
}

function statusLabel(status) {
  return REQUEST_STATUS_LABELS[status] ?? status
}

function relatedLink(event) {
  return props.linkBase && event.related_request?.id ? `${props.linkBase}${event.related_request.id}` : ''
}

function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>

<style scoped>
.history__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.history__item {
  position: relative;
  display: grid;
  grid-template-columns: 24px 1fr;
  gap: 0.7rem;
  padding-bottom: 1rem;
}

.history__item:not(:last-child)::before {
  content: '';
  position: absolute;
  left: 11px;
  top: 26px;
  bottom: 2px;
  width: 2px;
  background: var(--rb-border);
}

.history__dot {
  width: 24px;
  height: 24px;
  border-radius: 999px;
  display: grid;
  place-items: center;
}

.history__body {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.history__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
}

.history__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--rb-text-primary);
}

.history__tag,
.history__transition {
  padding: 0.05rem 0.45rem;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 600;
  background: var(--rb-surface-alt);
  color: var(--rb-text-secondary);
}

.history__tag--allocation {
  font-family: var(--rb-font-mono);
  font-weight: 500;
}

.history__tag--allocation a {
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.history__meta,
.history__note,
.history__related,
.history__empty,
.history__error {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.45;
  color: var(--rb-text-secondary);
}

.history__note {
  color: var(--rb-text-primary);
}

.history__related {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}

.history__related a {
  color: var(--rb-primary-text);
  font-weight: 600;
}

.history__error {
  color: var(--rb-accent-text);
}

.history__lines {
  margin-top: 0.25rem;
  font-size: 12px;
}

.history__lines summary {
  cursor: pointer;
  color: var(--rb-primary-text);
  font-weight: 600;
}

.history__lines table {
  margin-top: 0.4rem;
  border-collapse: collapse;
  width: 100%;
  max-width: 34rem;
}

.history__lines th,
.history__lines td {
  padding: 0.3rem 0.5rem;
  text-align: left;
  border-bottom: 1px solid var(--rb-border);
  color: var(--rb-text-primary);
}

.history__lines th {
  color: var(--rb-text-secondary);
  font-weight: 600;
}

.num {
  text-align: right !important;
  font-variant-numeric: tabular-nums;
}

.mono {
  font-family: var(--rb-font-mono);
}

.history__loading {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.history__skeleton {
  height: 42px;
  border-radius: 8px;
  background: linear-gradient(90deg, var(--rb-skeleton-a), var(--rb-skeleton-b), var(--rb-skeleton-a));
  background-size: 200% 100%;
  animation: history-shimmer 1.4s ease-in-out infinite;
}

@keyframes history-shimmer {
  from { background-position: 200% 0; }
  to { background-position: -200% 0; }
}

@media (prefers-reduced-motion: reduce) {
  .history__skeleton { animation: none; }
}

.tone--success { background: rgba(var(--rb-success-rgb), 0.16); color: var(--rb-success-text); }
.tone--warning { background: rgba(var(--rb-warning-rgb), 0.18); color: var(--rb-warning-text); }
.tone--danger { background: rgba(var(--rb-accent-rgb), 0.14); color: var(--rb-accent-text); }
.tone--info { background: rgba(var(--rb-primary-rgb), 0.14); color: var(--rb-primary-text); }
.tone--progress { background: rgba(var(--rb-purple-rgb), 0.14); color: var(--rb-purple-text); }
.tone--muted { background: var(--rb-surface-alt); color: var(--rb-text-secondary); }
</style>
