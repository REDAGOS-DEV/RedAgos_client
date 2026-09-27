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
            <span v-if="event.item?.component" class="history__tag">{{ event.item.component }}</span>
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
                  <th scope="col" class="num">Requested</th>
                  <th scope="col" class="num">Fulfilled</th>
                  <th scope="col" class="num">Remaining</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="line in event.lines" :key="line.request_item_id">
                  <td>{{ line.component || '—' }}</td>
                  <td class="num">{{ line.requested }}</td>
                  <td class="num">{{ line.fulfilled }}</td>
                  <td class="num">{{ line.remaining }}</td>
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
 */

import AssetIcon from '~/components/common/AssetIcon.vue'
import { REQUEST_STATUS_LABELS } from '~/types/bloodRequest'

const props = defineProps({
  events: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  /** Where a related request opens, e.g. '/hospital/bloodrequests/'. Omit for plain text. */
  linkBase: { type: String, default: '' },
})

const ICONS = {
  submitted: 'send',
  walk_in_recorded: 'phone',
  follow_up_created: 'route',
  remainder_forwarded: 'route',
  follow_up_withdrawn: 'refresh-cw',
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
  follow_up_withdrawn: 'warning',
  released: 'success',
  receipt_confirmed: 'success',
  remainder_forwarded: 'info',
  follow_up_created: 'info',
  walk_in_recorded: 'progress',
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
  font-size: 0.86rem;
  font-weight: 600;
  color: var(--rb-text-primary);
}

.history__tag,
.history__transition {
  padding: 0.05rem 0.45rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 600;
  background: var(--rb-surface-alt);
  color: var(--rb-text-secondary);
}

.history__meta,
.history__note,
.history__related,
.history__empty,
.history__error {
  margin: 0;
  font-size: 0.78rem;
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
  font-size: 0.76rem;
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
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
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
