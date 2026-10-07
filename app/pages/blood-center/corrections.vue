<template>
  <div class="corrections">
    <header class="corrections__header">
      <h1 class="corrections__title">Corrections</h1>
      <p class="corrections__subtitle">
        Saved records are never edited directly. Whoever entered a record requests a correction, and the department's
        approver or the Center Admin decides. An approved correction is applied under the same rules as the original.
      </p>
    </header>

    <div class="toolbar">
      <div class="tabs" role="tablist" aria-label="Corrections">
        <button
          v-if="canApprove"
          type="button"
          role="tab"
          class="tab"
          :class="{ 'tab--on': scope === 'review' }"
          :aria-selected="scope === 'review'"
          @click="switchScope('review')"
        >
          To review
          <span v-if="pendingReview" class="tab__badge">{{ pendingReview }}</span>
        </button>
        <button
          type="button"
          role="tab"
          class="tab"
          :class="{ 'tab--on': scope === 'mine' }"
          :aria-selected="scope === 'mine'"
          @click="switchScope('mine')"
        >
          My requests
        </button>
      </div>

      <!-- Status as chips: the current choice is visible without opening anything. -->
      <div class="chips" role="group" aria-label="Status">
        <button
          v-for="option in STATUS_FILTERS"
          :key="option.value"
          type="button"
          class="chip"
          :class="{ 'chip--on': statusFilter === option.value }"
          :aria-pressed="statusFilter === option.value"
          @click="setStatus(option.value)"
        >
          {{ option.label }}
        </button>
      </div>
    </div>

    <div v-if="error" class="alert alert--error" role="alert">
      <AssetIcon name="circle-alert" :size="16" />
      <span>{{ error }}</span>
    </div>
    <div v-else-if="notice" class="alert alert--notice" role="status">
      <AssetIcon name="circle-check-big" :size="16" />
      <span>{{ notice }}</span>
    </div>

    <!-- Loading: cards shaped like the real ones -->
    <ul v-if="loading" class="list" aria-busy="true">
      <li v-for="n in 3" :key="n" class="item item--skeleton">
        <span class="skeleton skeleton--title" />
        <span class="skeleton skeleton--line" />
        <span class="skeleton skeleton--block" />
      </li>
    </ul>

    <div v-else-if="!items.length" class="empty">
      <span class="empty__icon">
        <AssetIcon :name="scope === 'review' ? 'circle-check-big' : 'pencil'" :size="20" />
      </span>
      <p class="empty__title">{{ emptyCopy.title }}</p>
      <p class="empty__text">{{ emptyCopy.text }}</p>
    </div>

    <ul v-else class="list">
      <li v-for="item in items" :key="item.id" class="item" :class="`item--${item.status}`">
        <div class="item__head">
          <div class="item__heading">
            <p class="item__title">{{ item.subject_label }} <span class="item__ref">Donation #{{ item.donation_id }}</span></p>
            <p class="item__meta">
              <template v-if="item.donation_barcode">Barcode <span class="mono">{{ item.donation_barcode }}</span> · </template>
              Requested by {{ item.requested_by || 'Unknown' }} · {{ formatDate(item.requested_at) }}
            </p>
          </div>
          <span class="pill" :class="`pill--${item.status}`">{{ statusLabel(item.status) }}</span>
        </div>

        <div class="reason">
          <p class="reason__label">Reason</p>
          <p class="reason__text">{{ item.reason }}</p>
        </div>

        <div v-if="item.changed_fields.length" class="diff" role="table" aria-label="Changes">
          <div class="diff__row diff__row--head" role="row">
            <span role="columnheader">Field</span>
            <span role="columnheader">Saved</span>
            <span aria-hidden="true" />
            <span role="columnheader">Corrected</span>
          </div>
          <div v-for="field in item.changed_fields" :key="field" class="diff__row" role="row">
            <span class="diff__field" role="cell">{{ field.replace(/_/g, ' ') }}</span>
            <span class="diff__before" role="cell">
              <template v-if="isEmpty(item.previous?.[field])"><i class="diff__empty">empty</i></template>
              <template v-else>{{ display(item.previous?.[field]) }}</template>
            </span>
            <AssetIcon name="arrow-right" :size="14" class="diff__arrow" aria-hidden="true" />
            <span class="diff__after" role="cell">
              <template v-if="isEmpty(item.changes?.[field])"><i class="diff__empty">empty</i></template>
              <template v-else>{{ display(item.changes?.[field]) }}</template>
            </span>
          </div>
        </div>
        <p v-else class="item__meta">No field differs from the saved record.</p>

        <p v-if="item.reviewed_by" class="decision">
          <AssetIcon :name="item.status === 'approved' ? 'circle-check-big' : 'circle-x'" :size="14" />
          <span>
            {{ item.status === 'approved' ? 'Approved' : 'Rejected' }} by {{ item.reviewed_by }} · {{ formatDate(item.reviewed_at) }}
            <template v-if="item.review_note"><br><span class="decision__note">Note: {{ item.review_note }}</span></template>
          </span>
        </p>

        <div v-if="item.can_decide" class="item__decide">
          <label class="field">
            <span class="field__label">Note <span class="field__optional">optional to approve, required to reject</span></span>
            <textarea
              v-model="notes[item.id]"
              class="field__input"
              rows="2"
              maxlength="1000"
              placeholder="Why you are approving or rejecting this correction"
            />
          </label>
          <div class="actions">
            <button type="button" class="btn btn--primary" :disabled="busy === item.id" @click="decide(item, 'approve')">
              {{ busy === item.id ? 'Working…' : 'Approve and apply' }}
            </button>
            <button
              type="button"
              class="btn btn--danger"
              :disabled="busy === item.id || !(notes[item.id] || '').trim()"
              @click="decide(item, 'reject')"
            >
              Reject
            </button>
            <span v-if="!(notes[item.id] || '').trim()" class="actions__hint">Add a note to reject.</span>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'

/**
 * Correction requests: the caller's own, and — for a department approver or
 * the Center Admin — those waiting on their decision.
 *
 * The server decides who may decide (`can_decide`): never the requester, and
 * for an approver's own request only the Center Admin. Approving applies the
 * change through the original write, so a request whose record has since been
 * cleared or rejected is refused and stays pending until someone rejects it.
 */

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  requires: 'corrections.request',
})

useHead({ title: 'Corrections · RedAgos' })

const { can } = useUser()
const canApprove = computed(() => can('corrections.approve'))

const scope = ref(canApprove.value ? 'review' : 'mine')
const statusFilter = ref('pending')
const items = ref([])
const loading = ref(false)
const busy = ref(null)
const error = ref(null)
const notice = ref(null)
const notes = reactive({})
const pendingReview = ref(0)

const STATUS = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' }

const STATUS_FILTERS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: '', label: 'All' },
]

function setStatus(value) {
  if (statusFilter.value === value) return
  statusFilter.value = value
  notice.value = null
  load()
}

const emptyCopy = computed(() => {
  const status = statusFilter.value ? STATUS[statusFilter.value].toLowerCase() : ''

  if (scope.value === 'review') {
    return statusFilter.value === 'pending'
      ? { title: 'Nothing is waiting for your decision', text: 'New correction requests from your department will appear here.' }
      : { title: `No ${status} corrections`, text: 'Try another status to see the rest.' }
  }

  return statusFilter.value === 'pending' || !statusFilter.value
    ? { title: 'You have not requested any corrections', text: 'To fix a saved record, open it and choose Request correction. Your request will be listed here.' }
    : { title: `No ${status} requests`, text: 'Try another status to see the rest.' }
})

function isEmpty(value) {
  return value === null || value === undefined || value === '' || (Array.isArray(value) && !value.length)
}

function statusLabel(status) {
  return STATUS[status] ?? status
}

function display(value) {
  if (isEmpty(value)) return ''
  if (Array.isArray(value)) return value.map((row) => (typeof row === 'object' ? Object.values(row).join(' / ') : row)).join('; ')
  if (typeof value === 'object') return JSON.stringify(value)

  return String(value)
}

function formatDate(value) {
  if (!value) return 'unknown date'

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? 'unknown date' : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

async function load() {
  loading.value = true
  error.value = null

  try {
    const params = { scope: scope.value, per_page: 50 }
    if (statusFilter.value) params.status = statusFilter.value

    const response = await bloodCenterService.corrections(params)
    items.value = response?.data ?? []

    if (scope.value === 'review' && statusFilter.value === 'pending') pendingReview.value = response?.total ?? items.value.length
  } catch (err) {
    error.value = err?.message || 'Could not load corrections.'
  } finally {
    loading.value = false
  }
}

function switchScope(next) {
  scope.value = next
  notice.value = null
  load()
}

const REFUSALS = {
  self_approval: 'You cannot decide on your own correction request.',
  not_the_approver: 'This correction is decided by the department approver or the Center Admin.',
  correction_decided: 'This correction has already been decided.',
  results_cleared: 'The record was cleared since this was requested, so it can no longer be corrected. Reject it.',
  results_locked: 'The donation was rejected since this was requested. Reject the correction.',
  run_not_open: 'The serology run has been decided since this was requested. Reject the correction.',
}

async function decide(item, action) {
  busy.value = item.id
  error.value = null
  notice.value = null

  try {
    const note = (notes[item.id] || '').trim()
    const response = action === 'approve'
      ? await bloodCenterService.approveCorrection(item.id, note ? { note } : {})
      : await bloodCenterService.rejectCorrection(item.id, { note })

    notice.value = response?.message ?? null
    await load()
  } catch (err) {
    const errors = err?.data?.errors
    const first = errors && typeof errors === 'object' ? Object.values(errors).flat()[0] : null

    error.value = first || REFUSALS[err?.data?.code] || err?.data?.message || err?.message || 'That could not be done.'
  } finally {
    busy.value = null
  }
}

onMounted(load)
</script>

<style scoped>
.corrections {
  font-family: var(--rb-font-sans);
  max-width: var(--rb-content-max, 1600px);
  margin: 0 auto;
  padding: 24px var(--rb-gutter, 24px) 40px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  color: var(--rb-text-primary);
}

.corrections__title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.corrections__subtitle {
  margin: 4px 0 0;
  max-width: 76ch;
  font-size: 13px;
  line-height: 1.55;
  color: var(--rb-text-secondary);
}

/* Tabs + status chips */
.toolbar {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  border-bottom: 1px solid var(--rb-border-strong);
}

.tabs { display: flex; gap: 4px; }

.tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  margin-bottom: -1px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--rb-text-secondary);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease;
}

.tab:hover { color: var(--rb-text-primary); }

.tab--on {
  border-bottom-color: var(--rb-primary);
  color: var(--rb-primary-text);
}

.tab__badge {
  min-width: 20px;
  padding: 1px 7px;
  border-radius: 999px;
  background: rgba(var(--rb-warning-rgb), 0.16);
  color: var(--rb-warning-text);
  font-size: 11px;
  font-weight: 700;
  text-align: center;
}

.chips { display: flex; gap: 6px; flex-wrap: wrap; padding-bottom: 8px; }

.chip {
  padding: 5px 12px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 999px;
  background: var(--rb-surface);
  color: var(--rb-text-secondary);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.chip:hover { border-color: var(--rb-border-hover); color: var(--rb-text-primary); }

.chip--on {
  border-color: rgba(var(--rb-primary-rgb), 0.35);
  background: rgba(var(--rb-primary-rgb), 0.08);
  color: var(--rb-primary-text);
}

/* Alerts */
.alert {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 11px 14px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
}

.alert--error { background: rgba(var(--rb-accent-rgb), 0.08); color: var(--rb-accent-text); }
.alert--notice { background: rgba(var(--rb-success-rgb), 0.08); color: var(--rb-success-text); }

/* Empty */
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 40px 24px;
  border: 1px dashed var(--rb-border-strong);
  border-radius: 14px;
  background: var(--rb-surface);
  text-align: center;
}

.empty__icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: rgba(var(--rb-primary-rgb), 0.08);
  color: var(--rb-primary-text);
}

.empty__title { margin: 4px 0 0; font-size: 14px; font-weight: 700; }
.empty__text { margin: 0; max-width: 46ch; font-size: 13px; line-height: 1.5; color: var(--rb-text-secondary); }

/* List */
.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.item {
  padding: 16px 18px;
  border: 1px solid var(--rb-border);
  border-radius: 14px;
  background: var(--rb-surface);
  box-shadow: inset 3px 0 0 var(--item-accent, transparent), 0 1px 2px rgba(var(--rb-shadow-rgb), 0.03);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.item--pending { --item-accent: var(--rb-warning); }
.item--approved { --item-accent: var(--rb-success); }
.item--rejected { --item-accent: var(--rb-accent); }

.item__head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.item__heading { min-width: 0; }

.item__title { margin: 0; font-size: 14px; font-weight: 700; }

.item__ref {
  margin-left: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--rb-text-secondary);
}

.item__meta {
  margin: 3px 0 0;
  font-size: 12px;
  color: var(--rb-text-secondary);
}

.reason {
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--rb-surface-alt);
}

.reason__label {
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--rb-text-secondary);
}

.reason__text { margin: 3px 0 0; font-size: 13px; line-height: 1.5; }

/* Saved -> Corrected */
.diff {
  border: 1px solid var(--rb-border);
  border-radius: 10px;
  overflow: hidden;
  font-size: 13px;
}

.diff__row {
  display: grid;
  grid-template-columns: minmax(120px, 1fr) minmax(0, 1.4fr) 20px minmax(0, 1.4fr);
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-top: 1px solid var(--rb-border);
}

.diff__row:first-child { border-top: 0; }

.diff__row--head {
  padding: 7px 12px;
  background: var(--rb-surface-alt);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--rb-text-secondary);
}

.diff__field { font-weight: 600; text-transform: capitalize; }

.diff__before {
  color: var(--rb-text-secondary);
  text-decoration: line-through;
  overflow-wrap: anywhere;
}

.diff__after {
  font-weight: 600;
  color: var(--rb-success-text);
  overflow-wrap: anywhere;
}

.diff__arrow { color: var(--rb-text-secondary); }

.diff__empty {
  font-style: normal;
  font-weight: 500;
  color: var(--rb-text-secondary);
  text-decoration: none;
}

.decision {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 0;
  font-size: 12px;
  color: var(--rb-text-secondary);
}

.decision :deep(svg) { flex-shrink: 0; margin-top: 1px; }
.decision__note { color: var(--rb-text-primary); }

/* Decide */
.item__decide {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 12px;
  border-top: 1px solid var(--rb-border);
}

.field { display: flex; flex-direction: column; gap: 6px; }

.field__label { font-size: 12px; font-weight: 600; }

.field__optional {
  margin-left: 4px;
  font-weight: 500;
  color: var(--rb-text-secondary);
}

.field__input {
  padding: 9px 12px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  font: inherit;
  font-size: 13px;
  resize: vertical;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.field__input::placeholder { color: var(--rb-placeholder); }

.field__input:focus {
  outline: none;
  border-color: var(--rb-primary);
  box-shadow: var(--rb-focus-ring);
}

.actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.actions__hint { font-size: 12px; color: var(--rb-text-secondary); }

.btn {
  display: inline-flex;
  align-items: center;
  padding: 9px 16px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.btn--primary { border-color: transparent; background: var(--rb-primary); color: #fff; }
.btn--primary:hover:not(:disabled) { background: #0D47A1; }

.btn--danger { border-color: rgba(var(--rb-accent-rgb), 0.35); color: var(--rb-accent-text); }
.btn--danger:hover:not(:disabled) { background: rgba(var(--rb-accent-rgb), 0.06); }

.btn:disabled { opacity: 0.5; cursor: not-allowed; }

.btn:focus-visible,
.tab:focus-visible,
.chip:focus-visible {
  outline: 2px solid var(--rb-primary-text);
  outline-offset: 2px;
}

.pill {
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

.pill--pending { background: rgba(var(--rb-warning-rgb), 0.14); color: var(--rb-warning-text); }
.pill--approved { background: rgba(var(--rb-success-rgb), 0.12); color: var(--rb-success-text); }
.pill--rejected { background: rgba(var(--rb-accent-rgb), 0.12); color: var(--rb-accent-text); }

.mono { font-family: var(--rb-font-mono); }

/* Skeleton */
.item--skeleton { gap: 10px; }

.skeleton {
  display: block;
  height: 12px;
  border-radius: 6px;
  background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 37%, var(--rb-skeleton-a) 63%);
  background-size: 400% 100%;
  animation: corrections-shimmer 1.4s ease infinite;
}

.skeleton--title { width: 40%; height: 14px; }
.skeleton--line { width: 65%; }
.skeleton--block { height: 56px; border-radius: 10px; }

@keyframes corrections-shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none; }
}

@media (max-width: 640px) {
  .corrections { padding: 16px; }
  .toolbar { align-items: stretch; }
  .item__head { flex-direction: column-reverse; gap: 8px; }

  /* Each change stacks: field, then saved over corrected */
  .diff__row--head { display: none; }
  .diff__row { grid-template-columns: 1fr; gap: 2px; }
  .diff__arrow { display: none; }
  .diff__before::before { content: 'Saved: '; text-decoration: none; display: inline-block; margin-right: 4px; font-weight: 600; }
  .diff__after::before { content: 'Corrected: '; font-weight: 600; color: var(--rb-text-secondary); margin-right: 4px; }
}
</style>
