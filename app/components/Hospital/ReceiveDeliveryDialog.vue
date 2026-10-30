<template>
  <div class="dialog-backdrop" @click.self="!busy && $emit('close')">
    <div
      class="dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="receive-delivery-title"
      v-focus-trap
      @dialog-escape="!busy && $emit('close')"
    >
      <h2 id="receive-delivery-title" class="dialog__title">
        <AssetIcon name="package-check" :size="17" />
        Receive {{ reference }}
      </h2>

      <div v-if="loading" class="dialog__loading" aria-busy="true">
        <span class="skeleton" style="width:60%" />
        <span class="skeleton" />
        <span class="skeleton" style="width:80%" />
      </div>

      <template v-else-if="loadError">
        <p class="dialog__error" role="alert">{{ loadError }}</p>
        <div class="dialog__actions">
          <button type="button" class="btn btn--primary" @click="load">Try again</button>
          <button type="button" class="btn" @click="$emit('close')">Close</button>
        </div>
      </template>

      <!-- After receiving: where the bags went, and the way there. -->
      <template v-else-if="done">
        <p v-if="done.received" class="dialog__done" role="status">
          <AssetIcon name="circle-check-big" :size="16" />
          {{ unitsLabel(done.received) }} received. {{ done.received === 1 ? 'It waits' : 'They wait' }} at Stock Intake for a storage location.
        </p>
        <p v-for="failure in done.failures" :key="failure" class="dialog__error" role="alert">{{ failure }}</p>
        <div class="dialog__actions">
          <NuxtLink v-if="done.received && canStockIn" to="/hospital/stock-intake" class="btn btn--primary">
            <AssetIcon name="package-check" :size="14" />
            Go to Stock Intake
          </NuxtLink>
          <button type="button" class="btn" @click="$emit('close')">Done</button>
        </div>
      </template>

      <template v-else-if="!bags.length">
        <p class="dialog__text">Nothing on {{ reference }} is waiting to be received. It may have been received already.</p>
        <div class="dialog__actions">
          <button type="button" class="btn" @click="$emit('close')">Close</button>
        </div>
      </template>

      <template v-else>
        <p class="dialog__text">
          {{ unitsLabel(bags.length) }} dispatched by {{ centres.join(', ') || 'the blood center' }}.
          Receiving {{ bags.length === 1 ? 'it puts it' : 'them puts them' }} in Stock Intake.
        </p>

        <div class="table-wrap">
          <table class="bags">
            <caption class="sr-only">Units to receive</caption>
            <thead>
              <tr>
                <th scope="col">Bag</th>
                <th scope="col">Type</th>
                <th scope="col">Component</th>
                <th scope="col">Expiry</th>
                <th v-if="centres.length > 1" scope="col">From</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="bag in bags" :key="bag.allocation_id">
                <td class="mono">{{ bag.unit_id }}</td>
                <td><span class="type-pill">{{ bag.blood_type || '—' }}</span></td>
                <td>{{ bag.component || '—' }}</td>
                <td>{{ bag.expiry_date || '—' }}</td>
                <td v-if="centres.length > 1">{{ bag.centre || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Receiving here takes the whole delivery; a bag that did not come is scanned off on the request. -->
        <p class="dialog__hint">
          Only some arrived? <NuxtLink :to="partialPath" class="dialog__link">Open the request</NuxtLink> and scan the ones you have.
        </p>

        <div class="dialog__actions">
          <button type="button" class="btn btn--primary" :disabled="busy" @click="receive">
            <AssetIcon name="package-check" :size="14" />
            {{ busy ? 'Receiving…' : `Receive ${unitsLabel(bags.length)}` }}
          </button>
          <button type="button" class="btn" :disabled="busy" @click="$emit('close')">Cancel</button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
/**
 * Receive a whole delivery from a list row (project owner, 2026-10-30).
 *
 * Once a center dispatches, or the blood bank picks up, the receiving staff
 * no longer open the request and tick every bag: the row's Receive lists what
 * is on its way and takes it all in one go, into Stock Intake. The request's
 * own page keeps the bag-by-bag scan for a delivery that came short.
 *
 * Receipt is recorded on each blood request, so a patient's request shared
 * across centers, or a weekly request split by blood type, is confirmed one
 * call per request, as the weekly request's page does.
 */
import { computed, onMounted, ref } from 'vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import { hospitalService } from '~/api/hospital/HospitalService'
import { RECEIVING_REFUSAL_MESSAGES } from '~/types/receiving'
import { awaitingBagsFor, receiptsByRequest } from '~/utils/receiving'

const props = defineProps({
  /** 'transfusion' for a patient's blood request, 'weekly' for a weekly request. */
  kind: { type: String, required: true },
  requestId: { type: [Number, String], required: true },
  reference: { type: String, default: '' },
})

const emit = defineEmits(['received', 'close'])

const { can } = useUser()
const canStockIn = computed(() => can('hospital.inventory.stock_in'))

const requests = ref([])
const loading = ref(true)
const loadError = ref('')
const busy = ref(false)
const done = ref(null)

const bags = computed(() => awaitingBagsFor(requests.value))
const centres = computed(() => [...new Set(bags.value.map((bag) => bag.centre).filter(Boolean))])

/** Where a short delivery is received bag by bag: the share's own page when one center sent it all. */
const partialPath = computed(() => {
  if (props.kind === 'weekly') return `/hospital/receiving/weekly/${props.requestId}`

  const shares = [...new Set(bags.value.map((bag) => bag.request_id))]

  return shares.length === 1 ? `/hospital/bloodrequests/${shares[0]}` : `/hospital/transfusion-requests/${props.requestId}`
})

onMounted(load)

async function load() {
  loading.value = true
  loadError.value = ''

  try {
    requests.value = props.kind === 'weekly'
      ? (await hospitalService.showWeeklyRequest(props.requestId)).weekly_request?.requests ?? []
      : (await hospitalService.showTransfusionRequest(props.requestId)).request?.allocations ?? []
  } catch (err) {
    loadError.value = RECEIVING_REFUSAL_MESSAGES[err?.data?.code] || err?.message || 'The units on their way could not be loaded.'
  } finally {
    loading.value = false
  }
}

/**
 * Confirm every listed bag, one call per blood request. One refused (a
 * colleague received it a moment ago) does not stop the others.
 */
async function receive() {
  busy.value = true

  let received = 0
  const failures = []
  const everyBag = new Set(bags.value.map((bag) => bag.allocation_id))

  for (const [requestId, allocationIds] of receiptsByRequest(bags.value, everyBag)) {
    try {
      const response = await hospitalService.confirmReceipt(requestId, allocationIds)
      received += response?.awaiting_stock_in ?? response?.stocked_count ?? allocationIds.length
    } catch (err) {
      const reference = requests.value.find((request) => request.id === requestId)?.reference_number
      failures.push(`${reference || 'A request'}: ${RECEIVING_REFUSAL_MESSAGES[err?.data?.code] || err?.message || 'could not be received.'}`)
    }
  }

  busy.value = false
  done.value = { received, failures }

  if (received) emit('received', received)
}

function unitsLabel(count) {
  return `${count} unit${count === 1 ? '' : 's'}`
}
</script>

<style scoped>
/* Tokens come from app/assets/css/main.css; nothing is redeclared here. */
.dialog-backdrop {
  position: fixed; inset: 0; z-index: 320;
  display: grid; place-items: center; padding: 16px;
  background: var(--rb-overlay);
}
.dialog {
  width: min(640px, 100%);
  max-height: calc(100vh - 32px); overflow: auto;
  display: flex; flex-direction: column; gap: 14px;
  padding: 20px; border-radius: 14px;
  background: var(--rb-surface); border: 1px solid var(--rb-border);
  color: var(--rb-text-primary); font-family: var(--rb-font-sans);
}
.dialog:focus { outline: none; }
.dialog__title { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 16px; font-weight: 700; }
.dialog__text { margin: 0; font-size: 13.5px; line-height: 1.5; color: var(--rb-text-secondary); }
.dialog__hint { margin: 0; font-size: 12.5px; color: var(--rb-text-secondary); }
.dialog__link { color: var(--rb-primary-text); font-weight: 600; }
.dialog__error { margin: 0; font-size: 12.5px; color: var(--rb-accent-text); }
.dialog__done { display: flex; align-items: flex-start; gap: 8px; margin: 0; font-size: 13.5px; font-weight: 600; line-height: 1.5; color: var(--rb-success-text); }
.dialog__done :deep(svg) { flex-shrink: 0; margin-top: 2px; }
.dialog__actions { display: flex; gap: 10px; }

.dialog__loading { display: flex; flex-direction: column; gap: 10px; }
.skeleton {
  display: block; height: 14px; border-radius: 6px;
  background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 37%, var(--rb-skeleton-a) 63%);
  background-size: 400% 100%;
  animation: shimmer 1.4s ease infinite;
}
@keyframes shimmer { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }
@media (prefers-reduced-motion: reduce) { .skeleton { animation: none; } }

.table-wrap { overflow-x: auto; border: 1px solid var(--rb-border); border-radius: 10px; }
.bags { width: 100%; border-collapse: collapse; font-size: 13px; }
.bags thead th {
  text-align: left; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;
  color: var(--rb-text-secondary); padding: 9px 12px; background: var(--rb-surface-alt); white-space: nowrap;
}
.bags tbody td { padding: 10px 12px; border-top: 1px solid var(--rb-surface-alt); color: var(--rb-text-primary); white-space: nowrap; }

.mono { font-family: var(--rb-font-mono); }
.type-pill { display: inline-flex; font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 999px; background: rgba(var(--rb-accent-rgb), 0.08); color: var(--rb-accent-text); }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); border: 0; }

.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 7px;
  padding: 9px 16px; font-size: 13px; font-weight: 600; font-family: inherit;
  border-radius: 9px; cursor: pointer; white-space: nowrap; text-decoration: none;
  background: var(--rb-surface); color: var(--rb-text-primary); border: 1px solid var(--rb-border-strong);
}
.btn:hover:not(:disabled) { background: var(--rb-surface-hover); }
.btn--primary { background: var(--rb-primary); color: #fff; border-color: var(--rb-primary); }
.btn--primary:hover:not(:disabled) { background: var(--rb-primary-hover); }
.btn:disabled { opacity: .55; cursor: not-allowed; }

@media (max-width: 560px) {
  .dialog__actions { flex-direction: column-reverse; }
  .dialog__actions > * { width: 100%; }
}
</style>
