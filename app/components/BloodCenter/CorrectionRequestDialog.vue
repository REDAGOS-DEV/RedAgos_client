<template>
  <div class="dialog-backdrop" @click.self="$emit('close')">
    <div
      ref="dialogRef"
      class="dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="correction-title"
      tabindex="-1"
      @keydown.esc="$emit('close')"
    >
      <h2 id="correction-title" class="dialog__title">
        <AssetIcon name="pencil" :size="17" />
        Request a correction
      </h2>

      <p class="dialog__body">
        The {{ label }} is already saved, so it is not changed directly. Your corrected values go to
        <strong>{{ approverText }}</strong> to approve. Nothing changes until they do.
      </p>

      <ul v-if="changedFields.length" class="diff">
        <li v-for="field in changedFields" :key="field">
          <span class="diff__field">{{ humanise(field) }}</span>
          <span class="diff__before">{{ display(previous?.[field]) }}</span>
          <AssetIcon name="arrow-right" :size="12" />
          <span class="diff__after">{{ display(changes[field]) }}</span>
        </li>
      </ul>
      <p v-else-if="previous" class="dialog__hint">Nothing differs from what is saved yet — change the form first.</p>

      <label class="field">
        <span class="field__label">What was entered wrongly, and why</span>
        <textarea v-model="reason" class="field__input" rows="3" maxlength="1000" />
      </label>

      <p v-if="error" class="dialog__error" role="alert">{{ error }}</p>

      <div class="dialog__actions">
        <button type="button" class="btn btn--primary" :disabled="busy || !reason.trim()" @click="submit">
          {{ busy ? 'Sending…' : 'Send for approval' }}
        </button>
        <button type="button" class="btn" :disabled="busy" @click="$emit('close')">Cancel</button>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * Ask for a saved record to be corrected.
 *
 * The page builds `changes` exactly as it would build the original save, so the
 * server can validate them against the same rules. `previous` is only for the
 * before-and-after shown here; the server takes its own snapshot.
 *
 * A donation's records are identified by `donationId` and sent with their
 * subject. The records Issuance and Billing keep are identified by `targetId`
 * — a unit's bag number, an allocation's id or a payment's id — and each has
 * its own route, which fixes the subject.
 */

import AssetIcon from '~/components/common/AssetIcon.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'

const props = defineProps({
  donationId: { type: Number, default: null },
  targetId: { type: [String, Number], default: null },
  subject: { type: String, required: true },
  changes: { type: Object, required: true },
  previous: { type: Object, default: null },
})

const emit = defineEmits(['close', 'submitted'])

const { user } = useUser()

// Each subject's name and department. Mirrors the server's CorrectionSubject.
const SUBJECTS = {
  screening: { label: 'screening', department: 'collection' },
  collection: { label: 'collection record', department: 'collection' },
  immunohematology: { label: 'blood typing', department: 'testing' },
  serology: { label: 'serology panel', department: 'testing' },
  components: { label: 'component breakdown', department: 'processing' },
  unit_details: { label: 'unit details', department: 'issuance' },
  dispatch: { label: 'dispatch record', department: 'issuance' },
  payment: { label: 'payment', department: 'billing' },
}

// Every department's head approves its corrections. Mirrors the server's
// Department::correctionApprover().
const HEADS = {
  collection: { role: 'screening_physician', title: 'the Donor Screening Physician' },
  processing: { role: 'component_technologist', title: 'the Component Laboratory Medical Technologist' },
  testing: { role: 'lab_supervisor', title: 'the Laboratory Supervisor' },
  issuance: { role: 'inventory_control_officer', title: 'the Inventory Control Officer' },
  billing: { role: 'billing_supervisor', title: 'the Billing Supervisor' },
}

const label = computed(() => SUBJECTS[props.subject]?.label ?? 'record')

// A head's own request goes to the Center Admin, never to a colleague.
const approverText = computed(() => {
  const head = HEADS[SUBJECTS[props.subject]?.department]

  if (!head || user.value?.staff_role === head.role) return 'the Center Admin'

  return `${head.title} or the Center Admin`
})

const changedFields = computed(() => {
  if (!props.previous) return []

  return Object.keys(props.changes).filter((field) => JSON.stringify(props.changes[field] ?? null) !== JSON.stringify(props.previous[field] ?? null))
})

const reason = ref('')
const busy = ref(false)
const error = ref(null)
const dialogRef = ref(null)

onMounted(() => nextTick(() => dialogRef.value?.focus()))

function humanise(field) {
  return field.replace(/_/g, ' ')
}

function display(value) {
  if (value === null || value === undefined || value === '') return '—'
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? '' : 's'}`
  if (typeof value === 'object') return JSON.stringify(value)

  return String(value)
}

const REFUSALS = {
  correction_pending: 'A correction to this record is already waiting for a decision.',
  results_cleared: 'This result has already been cleared and can no longer be corrected.',
  not_correctable: 'A reactive result can never be corrected.',
  not_your_record: 'Your role does not file corrections to this record.',
  nothing_to_correct: 'Nothing is saved yet — record it directly instead.',
  unit_not_editable: 'This unit can no longer be edited. An expired unit takes a new expiry date only.',
  unit_not_found: 'That unit was not found.',
  allocation_not_found: 'That dispatch record was not found.',
  payment_not_found: 'That payment was not found.',
  not_dispatched: 'Only a unit that has been dispatched has a dispatch record to correct.',
  billing_void: 'This statement has been voided, so its payments can no longer be corrected.',
}

/**
 * File the correction through the route its subject belongs to.
 */
function file(payload) {
  switch (props.subject) {
    case 'unit_details':
      return bloodCenterService.requestUnitCorrection(String(props.targetId), payload)
    case 'dispatch':
      return bloodCenterService.requestDispatchCorrection(Number(props.targetId), payload)
    case 'payment':
      return bloodCenterService.requestPaymentCorrection(Number(props.targetId), payload)
    default:
      return bloodCenterService.requestCorrection(props.donationId, { subject: props.subject, ...payload })
  }
}

async function submit() {
  busy.value = true
  error.value = null

  try {
    const response = await file({
      reason: reason.value.trim(),
      changes: props.changes,
    })

    emit('submitted', response)
  } catch (err) {
    const errors = err?.data?.errors
    const first = errors && typeof errors === 'object' ? Object.values(errors).flat()[0] : null

    error.value = first || REFUSALS[err?.data?.code] || err?.message || 'The request could not be sent.'
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: 16px;
  background: var(--rb-overlay);
}

.dialog {
  width: min(520px, 100%);
  max-height: calc(100vh - 32px);
  overflow: auto;
  padding: 1.25rem 1.35rem;
  border-radius: 14px;
  border: 1px solid var(--rb-border);
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  outline: none;
}

.dialog__title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  font-size: 16px;
}

.dialog__body,
.dialog__hint {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--rb-text-secondary);
}

.diff {
  list-style: none;
  margin: 0;
  padding: 0.6rem 0.75rem;
  border-radius: 10px;
  background: var(--rb-surface-alt);
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 13px;
}

.diff li {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex-wrap: wrap;
}

.diff__field {
  min-width: 9rem;
  font-weight: 600;
  text-transform: capitalize;
}

.diff__before {
  color: var(--rb-text-secondary);
  text-decoration: line-through;
}

.diff__after {
  font-weight: 600;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.field__label {
  font-size: 13px;
  font-weight: 600;
}

.field__input {
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--rb-border);
  border-radius: 8px;
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  font: inherit;
}

.dialog__error {
  margin: 0;
  padding: 0.5rem 0.7rem;
  border-radius: 8px;
  background: rgba(var(--rb-accent-rgb), 0.12);
  color: var(--rb-accent-text);
  font-size: 13px;
}

.dialog__actions {
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
  font-size: 13.5px;
  cursor: pointer;
}

.btn--primary {
  border-color: transparent;
  background: var(--rb-primary);
  color: #fff;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
