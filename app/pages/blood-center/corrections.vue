<template>
  <div class="corrections">
    <header class="corrections__header">
      <div>
        <p class="corrections__eyebrow">Blood Center Portal / Quality</p>
        <h1 class="corrections__title">Corrections</h1>
        <p class="corrections__subtitle">
          A saved record is never changed directly. Whoever entered it asks for a correction; the department's approver
          or the Center Admin decides, and an approved correction is applied under the same rules as the original.
        </p>
      </div>
    </header>

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

      <select v-model="statusFilter" class="status-filter" aria-label="Status" @change="load">
        <option value="pending">Pending</option>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
        <option value="">All</option>
      </select>
    </div>

    <p v-if="error" class="alert alert--error" role="alert">{{ error }}</p>
    <p v-else-if="notice" class="alert alert--notice" role="status">{{ notice }}</p>

    <p v-if="loading" class="empty">Loading…</p>
    <p v-else-if="!items.length" class="empty">
      {{ scope === 'review' ? 'Nothing is waiting for your decision.' : 'You have not requested any corrections.' }}
    </p>

    <ul v-else class="list">
      <li v-for="item in items" :key="item.id" class="item">
        <div class="item__head">
          <div>
            <p class="item__title">{{ item.subject_label }} · Donation #{{ item.donation_id }}</p>
            <p class="item__meta">
              <template v-if="item.donation_barcode">Barcode <span class="mono">{{ item.donation_barcode }}</span> · </template>
              Requested by {{ item.requested_by || '—' }} · {{ formatDate(item.requested_at) }}
            </p>
          </div>
          <span class="pill" :class="`pill--${item.status}`">{{ statusLabel(item.status) }}</span>
        </div>

        <p class="item__reason">“{{ item.reason }}”</p>

        <table v-if="item.changed_fields.length" class="diff">
          <thead>
            <tr><th>Field</th><th>Saved</th><th>Corrected</th></tr>
          </thead>
          <tbody>
            <tr v-for="field in item.changed_fields" :key="field">
              <td>{{ field.replace(/_/g, ' ') }}</td>
              <td class="diff__before">{{ display(item.previous?.[field]) }}</td>
              <td class="diff__after">{{ display(item.changes?.[field]) }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else class="item__meta">No field differs from the saved record.</p>

        <p v-if="item.reviewed_by" class="item__meta">
          {{ item.status === 'approved' ? 'Approved' : 'Rejected' }} by {{ item.reviewed_by }} · {{ formatDate(item.reviewed_at) }}
          <template v-if="item.review_note"> — “{{ item.review_note }}”</template>
        </p>

        <div v-if="item.can_decide" class="item__decide">
          <label class="field">
            <span class="field__label">Note <span class="field__optional">required to reject</span></span>
            <textarea v-model="notes[item.id]" class="field__input" rows="2" maxlength="1000" />
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
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup>
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

function statusLabel(status) {
  return STATUS[status] ?? status
}

function display(value) {
  if (value === null || value === undefined || value === '') return '—'
  if (Array.isArray(value)) return value.map((row) => (typeof row === 'object' ? Object.values(row).join(' / ') : row)).join('; ')
  if (typeof value === 'object') return JSON.stringify(value)

  return String(value)
}

function formatDate(value) {
  if (!value) return '—'

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
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
  max-width: 1152px;
  margin: 0 auto;
  padding: 24px 32px 40px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  color: var(--rb-text-primary);
}

.corrections__eyebrow {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--rb-primary-text);
}

.corrections__title {
  margin: 0.2rem 0;
  font-size: 1.5rem;
}

.corrections__subtitle {
  margin: 0;
  max-width: 72ch;
  font-size: 0.88rem;
  color: var(--rb-text-secondary);
}

.tabs {
  display: flex;
  gap: 0.4rem;
  align-items: center;
  flex-wrap: wrap;
  border-bottom: 1px solid var(--rb-border);
}

.tab {
  padding: 0.55rem 0.9rem;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--rb-text-secondary);
  font-weight: 600;
  cursor: pointer;
}

.tab--on {
  border-bottom-color: var(--rb-primary);
  color: var(--rb-text-primary);
}

.tab__badge {
  margin-left: 0.3rem;
  padding: 0 0.4rem;
  border-radius: 999px;
  background: rgba(var(--rb-warning-rgb), 0.18);
  color: var(--rb-warning-text);
  font-size: 0.72rem;
}

.status-filter {
  margin-left: auto;
  padding: 0.35rem 0.6rem;
  border: 1px solid var(--rb-border);
  border-radius: 8px;
  background: var(--rb-surface);
  color: var(--rb-text-primary);
}

.alert {
  margin: 0;
  padding: 0.6rem 0.8rem;
  border-radius: 10px;
  font-size: 0.86rem;
}

.alert--error {
  background: rgba(var(--rb-accent-rgb), 0.12);
  color: var(--rb-accent-text);
}

.alert--notice {
  background: rgba(var(--rb-success-rgb), 0.12);
  color: var(--rb-success-text);
}

.empty {
  margin: 0;
  color: var(--rb-text-secondary);
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.item {
  padding: 1rem 1.1rem;
  border: 1px solid var(--rb-border);
  border-radius: 14px;
  background: var(--rb-surface);
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.item__head {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
}

.item__title {
  margin: 0;
  font-weight: 700;
}

.item__meta {
  margin: 0.15rem 0 0;
  font-size: 0.8rem;
  color: var(--rb-text-secondary);
}

.item__reason {
  margin: 0;
  font-size: 0.88rem;
  font-style: italic;
}

.diff {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}

.diff th {
  text-align: left;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--rb-text-secondary);
  padding: 0 0.5rem 0.35rem 0;
  border-bottom: 1px solid var(--rb-border);
}

.diff td {
  padding: 0.35rem 0.5rem 0.35rem 0;
  border-bottom: 1px solid var(--rb-border);
  text-transform: none;
}

.diff td:first-child {
  text-transform: capitalize;
  font-weight: 600;
}

.diff__before {
  color: var(--rb-text-secondary);
  text-decoration: line-through;
}

.diff__after {
  font-weight: 600;
}

.item__decide {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px dashed var(--rb-border);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.field__label {
  font-size: 0.8rem;
  font-weight: 600;
}

.field__optional {
  font-weight: 400;
  color: var(--rb-text-secondary);
}

.field__input {
  padding: 0.5rem 0.65rem;
  border: 1px solid var(--rb-border);
  border-radius: 8px;
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  font: inherit;
}

.actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.btn {
  padding: 0.5rem 0.95rem;
  border: 1px solid var(--rb-border);
  border-radius: 8px;
  background: transparent;
  color: var(--rb-text-primary);
  font-weight: 600;
  font-size: 0.84rem;
  cursor: pointer;
}

.btn--primary {
  border-color: transparent;
  background: var(--rb-primary);
  color: #fff;
}

.btn--danger {
  border-color: transparent;
  background: rgba(var(--rb-accent-rgb), 0.14);
  color: var(--rb-accent-text);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pill {
  padding: 0.15rem 0.6rem;
  border-radius: 999px;
  font-size: 0.74rem;
  font-weight: 600;
  white-space: nowrap;
}

.pill--pending { background: rgba(var(--rb-warning-rgb), 0.16); color: var(--rb-warning-text); }
.pill--approved { background: rgba(var(--rb-success-rgb), 0.14); color: var(--rb-success-text); }
.pill--rejected { background: rgba(var(--rb-accent-rgb), 0.14); color: var(--rb-accent-text); }

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

@media (max-width: 640px) {
  .corrections {
    padding: 16px;
  }
}
</style>
