<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="close">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="qr-title">
        <h2 id="qr-title" class="modal-title">GCash Checkout</h2>
        <p class="modal-sub">{{ heading }}</p>

        <div v-if="loading" class="skeleton skeleton--row" />

        <!-- Nothing open yet -->
        <template v-else-if="!attempt">
          <p v-if="!availability?.available" class="banner banner--warn">
            <AssetIcon name="triangle-alert" :size="15" />
            <span>{{ checkoutUnavailableMessage(availability?.reason) }}</span>
          </p>
          <template v-else>
            <dl class="modal-facts">
              <div><dt>Statement total</dt><dd>{{ pesos(total) }}</dd></div>
              <div><dt>Already collected</dt><dd>{{ pesos(collected) }}</dd></div>
              <div><dt>To be paid by GCash</dt><dd class="owing">{{ pesos(outstanding) }}</dd></div>
            </dl>
            <div class="field">
              <label for="payer-name" class="field-label">Name of the person paying <span class="req">*</span></label>
              <input
                id="payer-name"
                v-model.trim="payerName"
                type="text"
                class="input"
                maxlength="120"
                autocomplete="off"
                placeholder="As the watcher gives it"
              >
              <p class="field-hint">
                Sent to the payment provider as the payer. Nothing from the patient's record is sent.
              </p>
            </div>
          </template>
        </template>

        <!-- A checkout exists -->
        <template v-else>
          <div class="attempt-head">
            <span class="status" :class="`tone--${attemptTone(attempt.status)}`">{{ attempt.status_label }}</span>
            <span class="payment-meta">{{ pesos(attempt.amount) }} · {{ attempt.statement_document_number }}</span>
          </div>

          <div v-if="isAttemptPayable(attempt)" class="qr-block">
            <img v-if="qrDataUrl" :src="qrDataUrl" alt="QR code for the GCash checkout" class="qr">
            <p class="field-hint">
              Ask the payer to scan this with their phone, or send them the link. It expires
              {{ formatWhen(attempt.expires_at) }}.
            </p>
            <div class="link-row">
              <input class="input mono" :value="attempt.checkout_url" readonly aria-label="Checkout link">
              <button class="btn btn-outline btn-sm" type="button" @click="copyLink">Copy</button>
            </div>
            <p class="field-hint">
              This updates by itself when the provider confirms the payment. The payer's phone
              saying "paid" is not a confirmation — wait for this screen.
            </p>
          </div>
          <p v-else-if="attempt.status === 'creating'" class="modal-desc">Opening the checkout with the provider…</p>
          <p v-else-if="attempt.status === 'awaiting_verification'" class="banner banner--warn">
            <AssetIcon name="triangle-alert" :size="15" />
            <span>The provider reports a payment and it is being confirmed. Do not take cash for this statement meanwhile.</span>
          </p>
          <p v-else-if="attempt.status === 'completed'" class="banner banner--ok">
            <AssetIcon name="check" :size="15" />
            <span>Payment confirmed by the provider. Its receipt is under Documents.</span>
          </p>
          <p v-else class="modal-desc">This checkout is closed ({{ attempt.status_label.toLowerCase() }}).</p>

          <p v-if="attempt.review_required" class="banner banner--error">
            <AssetIcon name="triangle-alert" :size="15" />
            <span>{{ reviewReasonMessage(attempt.review_reason) }}</span>
          </p>

          <div v-if="action" class="field">
            <label for="attempt-reason" class="field-label">
              {{ action === 'supersede' ? 'Why is the payment being taken another way?' : 'Why is this checkout being closed?' }}
              <span class="req">*</span>
            </label>
            <input id="attempt-reason" v-model.trim="reason" type="text" class="input" maxlength="255">
          </div>
        </template>

        <p v-if="error" class="field-error field-error--block">{{ error }}</p>

        <div class="modal-actions">
          <button class="btn btn-outline" :disabled="busy" @click="close">Close</button>

          <button
            v-if="!attempt && availability?.available"
            class="btn btn-primary"
            :disabled="busy || payerName.length < 2"
            @click="start"
          >
            {{ busy ? 'Opening…' : 'Open checkout' }}
          </button>

          <template v-if="attempt && action">
            <button class="btn btn-outline" :disabled="busy" @click="action = null">Back</button>
            <button class="btn btn-primary" :disabled="busy || reason.length < 3" @click="confirmAction">
              {{ action === 'supersede' ? 'Supersede checkout' : 'Close checkout' }}
            </button>
          </template>
          <template v-else-if="attempt">
            <button v-if="attempt.status === 'active'" class="btn btn-outline" :disabled="busy" @click="beginAction('supersede')">
              Take payment another way
            </button>
            <template v-if="attempt.review_required && isBillingSupervisor">
              <button class="btn btn-outline" :disabled="busy" @click="reverify">Re-check with provider</button>
              <button class="btn btn-outline" :disabled="busy" @click="beginAction('close')">Close checkout</button>
            </template>
          </template>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
/**
 * A GCash checkout for one patient bill, opened at the counter for the watcher.
 *
 * Shared by the statements page and the counter, so both take GCash the same
 * way. Polls the server, never the provider: only the server's confirmed
 * status says a checkout was paid. A checkout opened during a cash shift
 * belongs to that shift, which the server records; GCash never touches the
 * drawer.
 *
 * Emits `changed` when the bill may have moved — a payment confirmed, a
 * checkout superseded or closed — so the page can reload it, and `notify` for
 * the page's own toasts.
 */
import QRCode from 'qrcode'
import AssetIcon from '~/components/common/AssetIcon.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import {
  attemptTone,
  checkoutUnavailableMessage,
  isAttemptPayable,
  isAttemptSettled,
  pesos,
  reviewReasonMessage,
} from '~/utils/billing'

const props = defineProps({
  requestId: { type: Number, required: true },
  /** What the bill is, as the dialog's subtitle: "RQ-… · Hospital". */
  heading: { type: String, default: '' },
  total: { type: [Number, String], default: 0 },
  collected: { type: [Number, String], default: 0 },
})

const emit = defineEmits(['close', 'changed', 'notify'])

const POLL_MS = 4000

const { user } = useUser()

// Resolving a checkout flagged for review is the Billing Supervisor's or the
// Center Admin's; the server refuses anyone else, this only hides the buttons.
const isBillingSupervisor = computed(() => Boolean(user.value?.is_supervisor) || user.value?.staff_role === 'billing_supervisor')

const availability = ref(null)
const attempt = ref(null)
const loading = ref(true)
const busy = ref(false)
const error = ref('')
const payerName = ref('')
const qrDataUrl = ref('')
const action = ref(null)
const reason = ref('')
let pollTimer = null

const outstanding = computed(() => Math.max(0, Number(props.total ?? 0) - Number(props.collected ?? 0)))

function formatWhen(iso) {
  return iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

function startPolling() {
  stopPolling()

  if (!attempt.value || isAttemptSettled(attempt.value.status)) return

  pollTimer = setInterval(refresh, POLL_MS)
}

async function show(next) {
  const wasSettled = isAttemptSettled(attempt.value?.status)
  attempt.value = next
  qrDataUrl.value = isAttemptPayable(next)
    ? await QRCode.toDataURL(next.checkout_url, { margin: 1, width: 240 })
    : ''

  if (next && isAttemptSettled(next.status)) {
    stopPolling()

    if (!wasSettled && next.status === 'completed') {
      emit('notify', { title: 'GCash Payment Confirmed', variant: 'success', message: 'The statement is updated and the receipt is issued.' })
      emit('changed')
    }
  }
}

async function load() {
  loading.value = true

  try {
    const response = await bloodCenterService.billingForRequest(props.requestId)
    availability.value = response?.checkout ?? null

    if (response?.open_attempt) {
      await show(response.open_attempt)
      startPolling()
    }
  } catch (err) {
    error.value = err?.message || 'Could not load this statement.'
  } finally {
    loading.value = false
  }
}

function close() {
  if (busy.value) return
  stopPolling()
  emit('close')
}

async function start() {
  busy.value = true
  error.value = ''

  try {
    const response = await bloodCenterService.startCheckout(props.requestId, payerName.value)
    await show(response.attempt)
    startPolling()
  } catch (err) {
    error.value = err?.message || 'The checkout could not be opened. Take the payment in cash, or try again.'
  } finally {
    busy.value = false
  }
}

async function refresh() {
  if (!attempt.value) return

  try {
    const response = await bloodCenterService.checkoutAttempts(props.requestId)
    const latest = (response?.attempts ?? []).find((a) => a.id === attempt.value.id)

    if (latest) await show(latest)
  } catch {
    // A missed poll is not an error worth showing; the next one tries again.
  }
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(attempt.value.checkout_url)
    emit('notify', { title: 'Link Copied', variant: 'info' })
  } catch {
    emit('notify', { title: 'Copy Failed', variant: 'danger', message: 'Select the link and copy it by hand.' })
  }
}

function beginAction(next) {
  action.value = next
  reason.value = ''
  error.value = ''
}

async function confirmAction() {
  busy.value = true
  error.value = ''

  try {
    const response = action.value === 'supersede'
      ? await bloodCenterService.supersedeCheckout(props.requestId, attempt.value.id, reason.value)
      : await bloodCenterService.closeCheckout(props.requestId, attempt.value.id, reason.value)

    action.value = null
    await show(response.attempt)
    emit('notify', { title: response.message ?? 'Checkout updated', variant: 'success' })
    emit('changed')
  } catch (err) {
    error.value = err?.message || 'The checkout could not be updated.'
  } finally {
    busy.value = false
  }
}

async function reverify() {
  busy.value = true
  error.value = ''

  try {
    const response = await bloodCenterService.reverifyCheckout(props.requestId, attempt.value.id)
    await show(response.attempt)
    startPolling()
  } catch (err) {
    error.value = err?.message || 'The provider could not be asked again.'
  } finally {
    busy.value = false
  }
}

onMounted(load)
onBeforeUnmount(stopPolling)
</script>

<style scoped>
/* Tokens come from app/assets/css/main.css. */
.modal-overlay {
  position: fixed; inset: 0; z-index: 90; background: var(--rb-overlay);
  display: flex; align-items: center; justify-content: center; padding: 20px;
}
.modal {
  width: 100%; max-width: 460px; background: var(--rb-surface);
  border-radius: 15px; padding: 22px; font-family: var(--rb-font-sans);
  max-height: 90vh; overflow-y: auto;
}
.modal-title { font-size: 17px; font-weight: 700; color: var(--rb-text-primary); margin: 0 0 3px; }
.modal-sub { font-size: 12.5px; color: var(--rb-text-secondary); margin: 0 0 14px; }
.modal-desc { font-size: 13px; color: var(--rb-text-secondary); margin: 0 0 14px; }
.modal-facts { margin: 0 0 16px; border: 1px solid var(--rb-border); border-radius: 10px; padding: 12px 14px; }
.modal-facts > div { display: flex; justify-content: space-between; font-size: 13px; padding: 3px 0; }
.modal-facts dt { color: var(--rb-text-secondary); margin: 0; }
.modal-facts dd { margin: 0; font-weight: 600; color: var(--rb-text-primary); }
.modal-facts .owing { color: var(--rb-accent-text); }
.modal-actions { display: flex; justify-content: flex-end; gap: 9px; margin-top: 18px; flex-wrap: wrap; }

.banner { display: flex; align-items: flex-start; gap: 9px; padding: 11px 14px; border-radius: 10px; font-size: 13px; margin-bottom: 14px; }
.banner--error { background: rgba(var(--rb-accent-rgb), .08); color: var(--rb-accent-text); border: 1px solid rgba(var(--rb-accent-rgb), .25); }
.banner--warn { background: rgba(var(--rb-warning-rgb), .1); color: var(--rb-warning-text); border: 1px solid rgba(var(--rb-warning-rgb), .3); }
.banner--ok { background: rgba(var(--rb-success-rgb), .1); color: var(--rb-success-text); border: 1px solid rgba(var(--rb-success-rgb), .3); }

.field { display: flex; flex-direction: column; gap: 5px; margin-bottom: 14px; }
.field-label { font-size: 12.5px; font-weight: 600; color: var(--rb-text-primary); }
.req { color: var(--rb-accent-text); }
.input {
  width: 100%; padding: 9px 11px; font-size: 13.5px; font-family: inherit;
  color: var(--rb-text-primary); background: var(--rb-surface);
  border: 1px solid var(--rb-border-strong); border-radius: 9px;
}
.input:focus { outline: none; border-color: var(--rb-primary); box-shadow: 0 0 0 3px rgba(var(--rb-primary-rgb), .12); }
.field-error { font-size: 11.5px; color: var(--rb-accent-text); margin: 0; }
.field-error--block { margin: 4px 0 0; }
.field-hint { font-size: 11.5px; color: var(--rb-text-secondary); margin: 0; }
.mono { font-family: var(--rb-font-mono); }

.status { padding: 3px 9px; border-radius: 999px; font-size: 11.5px; font-weight: 600; white-space: nowrap; }
.tone--success { background: rgba(var(--rb-success-rgb), .12); color: var(--rb-success-text); }
.tone--warning { background: rgba(var(--rb-warning-rgb), .12); color: var(--rb-warning-text); }
.tone--danger { background: rgba(var(--rb-accent-rgb), .1); color: var(--rb-accent-text); }
.tone--info { background: rgba(var(--rb-primary-rgb), .08); color: var(--rb-primary-text); }
.tone--muted { background: var(--rb-surface-hover); color: var(--rb-text-muted); }

.attempt-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
.payment-meta { font-size: 12px; color: var(--rb-text-secondary); }
.qr-block { display: flex; flex-direction: column; align-items: center; gap: 10px; margin-bottom: 8px; }
.qr { width: 220px; height: 220px; border: 1px solid var(--rb-border); border-radius: 10px; background: #fff; padding: 8px; }
.link-row { display: flex; gap: 8px; width: 100%; }
.link-row .input { font-size: 12px; }

.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  padding: 8px 15px; font-size: 13px; font-weight: 600; font-family: inherit;
  border-radius: 8px; cursor: pointer; white-space: nowrap;
}
.btn-primary { background: var(--rb-primary); color: #fff; border: 1px solid var(--rb-primary); }
.btn-primary:hover:not(:disabled) { background: #10509c; }
.btn-outline { background: var(--rb-surface); color: var(--rb-text-primary); border: 1px solid var(--rb-border-strong); }
.btn-outline:hover:not(:disabled) { background: var(--rb-surface-hover); }
.btn:disabled { opacity: .55; cursor: not-allowed; }
.btn-sm { padding: 6px 11px; font-size: 12px; }

.skeleton {
  border-radius: 7px; margin-bottom: 10px; height: 38px;
  background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 50%, var(--rb-skeleton-a) 75%);
  background-size: 200% 100%; animation: shimmer 1.4s infinite;
}
@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }

@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none; }
}
</style>
