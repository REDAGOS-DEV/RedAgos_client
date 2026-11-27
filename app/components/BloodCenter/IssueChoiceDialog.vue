<template>
  <div class="issue-overlay" @click.self="emitClose">
    <div
      v-focus-trap
      class="issue"
      role="dialog"
      aria-modal="true"
      aria-labelledby="issue-title"
      @dialog-escape="emitClose"
    >
      <div class="issue__header">
        <h2 id="issue-title" class="issue__title">
          <AssetIcon name="send" :size="17" />
          Issue — <span class="mono">{{ request.code }}</span>
        </h2>
        <button type="button" class="issue__close" aria-label="Close" :disabled="busy" @click="emitClose">
          <AssetIcon name="x" :size="18" />
        </button>
      </div>

      <div class="issue__body">
        <p class="issue__who">{{ [request.hospital, request.patient].filter(Boolean).join(' · ') }}</p>

        <div class="choices" role="radiogroup" aria-label="How this request is paid">
          <label class="choice" :class="{ 'choice--on': choice === 'billing' }">
            <input v-model="choice" type="radio" name="issue-choice" value="billing" class="sr-only" :disabled="busy">
            <AssetIcon name="philippine-peso" :size="18" class="choice__icon" />
            <span class="choice__label">Pay at Billing</span>
            <span class="choice__figure">{{ pesos(due) }}</span>
          </label>

          <label
            v-if="canSubsidise"
            class="choice"
            :class="{ 'choice--on': choice === 'direct', 'choice--off': discountName }"
          >
            <input
              v-model="choice"
              type="radio"
              name="issue-choice"
              value="direct"
              class="sr-only"
              :disabled="busy || Boolean(discountName)"
            >
            <AssetIcon name="badge-check" :size="18" class="choice__icon" />
            <span class="choice__label">Issue Directly</span>
            <span class="choice__figure">{{ pesos(0) }}</span>
            <span class="choice__tag">Government Subsidised</span>
          </label>
        </div>

        <!-- One discount per bill: the subsidy waits for Billing to take it off. -->
        <p v-if="canSubsidise && discountName" class="notice" role="note">
          <AssetIcon name="circle-alert" :size="14" />
          <span>Issue Directly: the {{ discountName }} discount is on this bill. Billing removes it first.</span>
        </p>

        <p v-if="choice === 'direct'" class="issue__what" role="note">
          <strong>{{ pesos(subtotal) }}</strong> is waived and recorded as government subsidised on {{ request.hospital || "the hospital" }}'s invoice.
        </p>

        <p v-if="error" class="notice notice--error" role="alert">
          <AssetIcon name="circle-alert" :size="14" />
          <span>{{ error }}</span>
        </p>
      </div>

      <div class="issue__footer">
        <button type="button" class="btn" :disabled="busy" @click="emitClose">Cancel</button>
        <button type="button" class="btn btn--primary" :disabled="busy || !choice" @click="confirm">
          <template v-if="busy">Issuing…</template>
          <template v-else-if="choice === 'direct'">Issue Directly</template>
          <template v-else-if="choice === 'billing'">Pay at Billing</template>
          <template v-else>Continue</template>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * Issue asks how a patient's request is paid (project owner, 2026-11-27).
 *
 * Pay at Billing: the watcher settles the bill at the Billing Counter, where it
 * has waited since its units were tagged. Nothing is recorded here; the request
 * stays on Request Fulfillment until the bill is paid, then moves to For
 * Dispatch.
 *
 * Issue Directly: nothing payable. The whole bill is met by the government
 * subsidy (billing.subsidise, Issuance's since 2026-11-27), which records it on
 * the hospital's invoice as Government Subsidised and clears the units, and the
 * request opens on For Dispatch. A subsidy can still be taken off before a
 * unit leaves, from the invoice.
 *
 * The page opens this only for a bill still owing; one already cleared goes
 * straight to For Dispatch.
 */

import { computed, ref } from 'vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import { pesos } from '~/utils/billing'

const props = defineProps({
  /** The list's view of the request: id, code, hospital, patient. */
  request: { type: Object, required: true },
  /** Its bill, as GET /blood-center/billings/{id} returns it. */
  billing: { type: Object, required: true },
})

const emit = defineEmits(['close'])

const { can } = useUser()
const { notify: toast } = useToast()

const canSubsidise = computed(() => can('billing.subsidise'))

// Nothing chosen to start with: a subsidy is a decision, not a default.
const choice = ref('')
const busy = ref(false)
const error = ref('')

const due = computed(() => Number(props.billing.outstanding ?? (Number(props.billing.total_amount ?? 0) - Number(props.billing.collected ?? 0))))
// What the lines come to, the figure the subsidy waives.
const subtotal = computed(() => Number(props.billing.subtotal ?? props.billing.total_amount ?? 0))
const discountName = computed(() => props.billing.discount?.name ?? '')

function emitClose() {
  if (busy.value) return
  emit('close')
}

async function confirm() {
  if (busy.value || !choice.value) return
  error.value = ''

  if (choice.value === 'billing') {
    toast('Pay at Billing', 'info', `${props.request.code}: ${pesos(due.value)} to settle at the Billing Counter.`)
    emit('close')
    await navigateTo({ path: '/blood-center/fulfillment', query: { request: props.request.id } })
    return
  }

  busy.value = true

  try {
    const response = await bloodCenterService.applySubsidy(props.request.id, 'Issued directly at Issuance.')
    toast('Issued Directly', 'success', response?.message ?? 'Recorded as government subsidised.')
    busy.value = false
    emit('close')
    await navigateTo({ path: '/blood-center/dispatch', query: { request: props.request.id } })
  } catch (err) {
    error.value = err?.message || 'The government subsidy could not be applied.'
    busy.value = false
  }
}
</script>

<style scoped>
.issue-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: var(--rb-overlay);
}

.issue {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 480px;
  max-height: calc(100vh - 40px);
  background: var(--rb-surface);
  border: 1px solid var(--rb-border);
  border-radius: 16px;
  box-shadow: 0 12px 32px rgba(var(--rb-shadow-rgb), 0.28);
  color: var(--rb-text-primary);
  font-family: var(--rb-font-sans);
}

.issue:focus { outline: none; }

.issue__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--rb-border);
}

.issue__title { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 15.5px; font-weight: 700; }
.issue__title :deep(.asset-icon) { color: var(--rb-text-secondary); }

.issue__close {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 30px;
  height: 30px;
  border: 1px solid var(--rb-border);
  border-radius: 8px;
  background: none;
  color: var(--rb-text-secondary);
  cursor: pointer;
}

.issue__close:hover:not(:disabled) { color: var(--rb-text-primary); background: var(--rb-surface-hover); }

.issue__body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px 20px;
  overflow-y: auto;
  min-height: 0;
}

.issue__who { margin: 0; font-size: 13px; font-weight: 600; color: var(--rb-text-secondary); }

/* Two answers as cards, each with what it leaves to pay. */
.choices { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }

.choice {
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-areas:
    "icon label"
    "icon figure"
    "icon tag";
  align-items: center;
  column-gap: 10px;
  row-gap: 2px;
  padding: 14px 12px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 12px;
  cursor: pointer;
}

.choice:hover { border-color: var(--rb-border-hover); }
.choice--on { border-color: var(--rb-primary); background: rgba(var(--rb-primary-rgb), 0.06); box-shadow: inset 0 0 0 1px var(--rb-primary); }
.choice:focus-within { box-shadow: var(--rb-focus-ring); }
.choice--off { opacity: 0.55; cursor: not-allowed; }
.choice--off:hover { border-color: var(--rb-border-strong); }

.choice__icon { grid-area: icon; align-self: start; margin-top: 1px; color: var(--rb-text-secondary); }
.choice--on .choice__icon { color: var(--rb-primary-text); }
.choice__label { grid-area: label; font-size: 13.5px; font-weight: 700; }
.choice__figure { grid-area: figure; font-size: 18px; font-weight: 700; font-variant-numeric: tabular-nums; }
.choice__tag { grid-area: tag; font-size: 11.5px; font-weight: 600; color: var(--rb-success-text); }

.issue__what { margin: 0; font-size: 12.5px; line-height: 1.5; color: var(--rb-text-secondary); }
.issue__what strong { color: var(--rb-text-primary); font-variant-numeric: tabular-nums; }

.notice {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  padding: 10px 12px;
  border: 1px solid var(--rb-border);
  border-radius: 10px;
  background: var(--rb-surface-alt);
  font-size: 12.5px;
  line-height: 1.5;
}

.notice :deep(.asset-icon) { flex-shrink: 0; margin-top: 2px; color: var(--rb-warning-text); }
.notice--error { border-color: rgba(var(--rb-accent-rgb), 0.35); }
.notice--error :deep(.asset-icon) { color: var(--rb-accent-text); }

.issue__footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid var(--rb-border);
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  height: 36px;
  padding: 0 14px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}

.btn:hover:not(:disabled) { background: var(--rb-surface-hover); border-color: var(--rb-border-hover); }
.btn:disabled { opacity: 0.55; cursor: not-allowed; }
.btn--primary { background: var(--rb-primary); border-color: var(--rb-primary); color: #fff; }
.btn--primary:hover:not(:disabled) { background: color-mix(in srgb, var(--rb-primary) 88%, #000); border-color: var(--rb-primary); }

.btn:focus-visible,
.issue__close:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }

.mono { font-family: var(--rb-font-mono); }

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

@media (max-width: 520px) {
  .issue-overlay { padding: 10px; align-items: flex-end; }
  .issue { max-height: calc(100vh - 20px); }
  .choices { grid-template-columns: 1fr; }
}
</style>
