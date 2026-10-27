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
      <!-- Laid out as the Corrections page reads it (2026-10-27). -->
      <header class="dialog__head">
        <span class="kind-icon" :class="`kind--${kind.tone}`" aria-hidden="true"><AssetIcon :name="kind.icon" :size="20" /></span>
        <div class="dialog__heading">
          <h2 id="correction-title" class="dialog__title">Request a correction</h2>
          <p class="dialog__sub">To the saved {{ label }}</p>
        </div>
        <button type="button" class="icon-btn" aria-label="Close" :disabled="busy" @click="$emit('close')">
          <AssetIcon name="x" :size="16" />
        </button>
      </header>

      <!-- Where it goes: straight in for the head, or to the head first. -->
      <div class="route" :class="{ 'route--head': isHead }">
        <AssetIcon :name="isHead ? 'bolt' : 'user-check'" :size="16" class="route__icon" />
        <p v-if="isHead" class="route__text">
          The {{ label }} is already saved, so it is not changed directly. As the department head, your correction needs
          no other approval: it is <strong>applied as soon as you send it</strong>, and kept with your reason.
        </p>
        <p v-else class="route__text">
          The {{ label }} is already saved, so it is not changed directly. Your corrected values go to
          <strong>{{ approverText }}</strong> to approve. Nothing changes until they do.
        </p>
      </div>

      <section v-if="previous" class="changes" aria-label="Changes">
        <p class="section-label">{{ changedFields.length === 1 ? '1 change' : `${changedFields.length} changes` }}</p>
        <ul v-if="changedFields.length" class="diff">
          <li v-for="field in changedFields" :key="field" class="diff__row">
            <span class="diff__field">{{ humanise(field) }}</span>
            <span class="diff__values">
              <span class="val val--before" :class="{ 'val--none': display(previous?.[field]) === '—' }">
                <span class="sr-only">Saved: </span>{{ display(previous?.[field]) === '—' ? 'empty' : display(previous?.[field]) }}
              </span>
              <AssetIcon name="arrow-right" :size="13" class="diff__arrow" aria-hidden="true" />
              <span class="val val--after" :class="{ 'val--none': display(changes[field]) === '—' }">
                <span class="sr-only">Corrected: </span>{{ display(changes[field]) === '—' ? 'empty' : display(changes[field]) }}
              </span>
            </span>
          </li>
        </ul>
        <p v-else class="dialog__hint">
          <AssetIcon name="info" :size="14" />
          Nothing differs from what is saved yet — change the form first.
        </p>
      </section>

      <label class="field">
        <span class="field__label">What was entered wrongly, and why</span>
        <textarea
          v-model="reason"
          class="field__input"
          rows="3"
          maxlength="1000"
          placeholder="e.g. Typed 450 mL instead of 405 mL; the bag label reads 405."
        />
        <span class="field__count" aria-hidden="true">{{ reason.length }} / 1000</span>
      </label>

      <p v-if="error" class="dialog__error" role="alert">
        <AssetIcon name="circle-alert" :size="15" />
        {{ error }}
      </p>

      <div class="dialog__actions">
        <button type="button" class="btn" :disabled="busy" @click="$emit('close')">Cancel</button>
        <button type="button" class="btn btn--primary" :disabled="busy || !reason.trim()" @click="submit">
          <AssetIcon :name="isHead ? 'check' : 'send'" :size="15" />
          {{ busy ? 'Sending…' : (isHead ? 'Apply correction' : 'Send for approval') }}
        </button>
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
import { correctionKind } from '~/utils/correctionKinds'

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
const kind = computed(() => correctionKind(props.subject))

const head = computed(() => HEADS[SUBJECTS[props.subject]?.department] ?? null)

// The head's own correction needs nobody else's approval; the server applies
// it as it is filed.
// The head's role may be any of theirs, not only the main one.
const isHead = computed(() => Boolean(head.value) && (user.value?.staff_roles ?? []).includes(head.value.role))

const approverText = computed(() => head.value?.title ?? "the department's head")

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
  verification_pending: 'This reactive result is waiting for the Laboratory Supervisor, who verifies it or returns it for re-entry.',
  not_your_record: 'Your role does not file corrections to this record.',
  nothing_to_correct: 'Nothing is saved yet — record it directly instead.',
  unit_not_editable: 'This unit can no longer be edited. An expired unit takes a new expiry date only.',
  unit_not_found: 'That unit was not found.',
  allocation_not_found: 'That dispatch record was not found.',
  payment_not_found: 'That payment was not found.',
  not_dispatched: 'Only a unit that has been dispatched has a dispatch record to correct.',
  billing_void: 'This invoice has been voided, so its payments can no longer be corrected.',
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
.dialog-backdrop { position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; padding: 16px; background: var(--rb-overlay); }
.dialog {
  width: min(560px, 100%); max-height: calc(100dvh - 32px); overflow: auto;
  display: flex; flex-direction: column; gap: 16px; padding: 20px 22px;
  border: 1px solid var(--rb-border); border-radius: 18px; background: var(--rb-surface); color: var(--rb-text-primary);
  box-shadow: 0 24px 60px -12px rgba(var(--rb-shadow-rgb), .35); outline: none;
}

.dialog__head { display: flex; align-items: flex-start; gap: 12px; }
.dialog__heading { flex: 1; min-width: 0; }
.dialog__title { margin: 2px 0 0; font-size: 17px; font-weight: 800; }
.dialog__sub { margin: 2px 0 0; font-size: 13px; color: var(--rb-text-secondary); }
.icon-btn { display: grid; place-items: center; flex: none; width: 32px; height: 32px; border: 0; border-radius: 9px; background: transparent; color: var(--rb-text-secondary); cursor: pointer; }
.icon-btn:hover:not(:disabled) { background: var(--rb-surface-hover); color: var(--rb-text-primary); }

.kind-icon { display: grid; place-items: center; flex: none; width: 44px; height: 44px; border-radius: 13px; }
.kind--red { background: rgba(var(--rb-accent-rgb), .1); color: var(--rb-accent-text); }
.kind--purple { background: rgba(var(--rb-purple-rgb, 124, 58, 237), .1); color: rgb(var(--rb-purple-rgb, 124, 58, 237)); }
.kind--blue { background: rgba(var(--rb-primary-rgb), .1); color: var(--rb-primary-text); }
.kind--green { background: rgba(var(--rb-success-rgb), .12); color: var(--rb-success-text); }
.kind--amber { background: rgba(var(--rb-warning-rgb), .14); color: var(--rb-warning-text); }

/* Where it goes. */
.route { display: flex; gap: 10px; padding: 12px 14px; border: 1px solid rgba(var(--rb-primary-rgb), .2); border-radius: 12px; background: rgba(var(--rb-primary-rgb), .05); }
.route--head { border-color: rgba(var(--rb-success-rgb), .25); background: rgba(var(--rb-success-rgb), .07); }
.route__icon { flex: none; margin-top: 2px; color: var(--rb-primary-text); }
.route--head .route__icon { color: var(--rb-success-text); }
.route__text { margin: 0; font-size: 13px; line-height: 1.55; color: var(--rb-text-secondary); }
.route__text strong { color: var(--rb-text-primary); }

/* Saved → corrected, as on the Corrections page. */
.changes { display: flex; flex-direction: column; gap: 8px; }
.section-label { margin: 0; font-size: 12px; font-weight: 700; color: var(--rb-text-secondary); }
.diff { display: flex; flex-direction: column; margin: 0; padding: 0; list-style: none; border: 1px solid var(--rb-border); border-radius: 12px; }
.diff__row { display: grid; grid-template-columns: minmax(100px, 150px) minmax(0, 1fr); align-items: center; gap: 10px; padding: 10px 12px; border-top: 1px solid var(--rb-border); }
.diff__row:first-child { border-top: 0; }
.diff__field { font-size: 13px; font-weight: 600; text-transform: capitalize; color: var(--rb-text-secondary); }
.diff__values { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; min-width: 0; }
.val { padding: 3px 9px; border-radius: 8px; font-size: 13px; overflow-wrap: anywhere; }
.val--before { background: rgba(var(--rb-accent-rgb), .07); color: var(--rb-accent-text); text-decoration: line-through; text-decoration-color: rgba(var(--rb-accent-rgb), .5); }
.val--after { background: rgba(var(--rb-success-rgb), .1); font-weight: 700; color: var(--rb-success-text); }
.val--none, .val--none.val--before { background: var(--rb-surface-alt); font-style: italic; font-weight: 500; color: var(--rb-text-muted); text-decoration: none; }
.diff__arrow { flex: none; color: var(--rb-text-muted); }
.dialog__hint { display: flex; align-items: center; gap: 8px; margin: 0; padding: 10px 12px; border-radius: 10px; background: rgba(var(--rb-warning-rgb), .1); font-size: 13px; color: var(--rb-warning-text); }

.field { position: relative; display: flex; flex-direction: column; gap: 6px; }
.field__label { font-size: 13px; font-weight: 600; }
.field__input { padding: 10px 12px 22px; border: 1px solid var(--rb-border-strong); border-radius: 10px; background: var(--rb-surface); color: var(--rb-text-primary); font: inherit; font-size: 13.5px; resize: vertical; }
.field__input::placeholder { color: var(--rb-placeholder); }
.field__input:focus { outline: none; border-color: var(--rb-primary); box-shadow: var(--rb-focus-ring); }
.field__count { position: absolute; right: 12px; bottom: 7px; font-size: 11px; color: var(--rb-text-muted); pointer-events: none; }

.dialog__error { display: flex; align-items: flex-start; gap: 8px; margin: 0; padding: 10px 12px; border-radius: 10px; background: rgba(var(--rb-accent-rgb), .08); color: var(--rb-accent-text); font-size: 13px; }
.dialog__error :deep(svg) { flex: none; margin-top: 1px; }

.dialog__actions { display: flex; justify-content: flex-end; gap: 8px; padding-top: 14px; border-top: 1px solid var(--rb-border); }
.btn { display: inline-flex; align-items: center; gap: 7px; height: 40px; padding: 0 16px; border: 1px solid var(--rb-border-strong); border-radius: 10px; background: var(--rb-surface); color: var(--rb-text-primary); font: inherit; font-size: 13.5px; font-weight: 700; cursor: pointer; }
.btn:hover:not(:disabled) { background: var(--rb-surface-hover); }
.btn--primary { border-color: transparent; background: var(--rb-primary); color: #fff; }
.btn--primary:hover:not(:disabled) { background: var(--rb-primary-hover, #0D47A1); }
.btn:disabled { opacity: .5; cursor: not-allowed; }
.btn:focus-visible, .icon-btn:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
</style>
