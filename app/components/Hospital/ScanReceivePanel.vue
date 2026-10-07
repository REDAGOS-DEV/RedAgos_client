<template>
  <section class="receive" aria-labelledby="receive-title">
    <header class="receive__head">
      <div>
        <h2 id="receive-title" class="receive__title">
          <AssetIcon name="scan-line" :size="16" />
          Receive this delivery
        </h2>
        <p class="receive__hint">
          Scan each bag's barcode as it comes off the truck, or type its number. Only the bags you scan or tick are
          confirmed — a bag that did not arrive stays awaiting receipt.
        </p>
      </div>
      <span class="receive__count" aria-live="polite">{{ scanned.size }} of {{ bags.length }} scanned</span>
    </header>

    <form class="receive__scan" @submit.prevent="scan">
      <label for="receive-scan" class="sr-only">Bag number</label>
      <input
        id="receive-scan"
        ref="scanInput"
        v-model="entry"
        type="text"
        class="receive__input mono"
        placeholder="Scan or type a bag number"
        autocomplete="off"
        spellcheck="false"
        autocapitalize="characters"
        maxlength="50"
        :disabled="busy"
      >
      <button type="submit" class="btn" :disabled="busy || !entry.trim()">Add</button>
    </form>

    <p v-if="feedback" class="receive__feedback" :class="`receive__feedback--${feedback.tone}`" role="status">
      <AssetIcon :name="feedback.tone === 'success' ? 'circle-check-big' : 'triangle-alert'" :size="14" />
      {{ feedback.text }}
    </p>

    <div class="table-wrap">
      <table class="receive__table">
        <thead>
          <tr>
            <th scope="col" class="pick">
              <input
                type="checkbox"
                :checked="allTicked"
                :disabled="busy"
                aria-label="Tick every bag on this delivery"
                @change="toggleAll"
              >
            </th>
            <th scope="col">Bag</th>
            <th scope="col">Type</th>
            <th scope="col">Component</th>
            <th scope="col">Expiry</th>
            <th scope="col">Dispatched</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="bag in bags" :key="bag.allocation_id" :class="{ 'row--on': scanned.has(bag.allocation_id) }">
            <td class="pick">
              <input
                type="checkbox"
                :checked="scanned.has(bag.allocation_id)"
                :disabled="busy"
                :aria-label="`Received bag ${bag.unit_id}`"
                @change="toggle(bag.allocation_id)"
              >
            </td>
            <td class="mono">{{ bag.unit_id }}</td>
            <td><span class="type-pill">{{ bag.blood_type || '—' }}</span></td>
            <td>{{ bag.component || '—' }}</td>
            <td>{{ bag.expiry_date || '—' }}</td>
            <td>{{ bag.released_at ? formatDateTime(bag.released_at) : '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <footer class="receive__actions">
      <button type="button" class="btn btn--primary" :disabled="busy || !scanned.size" @click="confirm">
        {{ busy ? 'Confirming…' : `Confirm receipt of ${scanned.size} bag${scanned.size === 1 ? '' : 's'}` }}
      </button>
      <button v-if="scanned.size" type="button" class="btn" :disabled="busy" @click="clear">Clear</button>
    </footer>
  </section>
</template>

<script setup>
/**
 * Confirming a weekly delivery bag by bag, by barcode.
 *
 * RedAgos bags carry the donation barcode sticker, so a keyboard-wedge scanner
 * types each bag's number into the field and presses Enter. A bag on the
 * delivery is ticked; one already ticked is said so; one not on the delivery
 * is flagged — it was not dispatched for this weekly request. A bag whose
 * barcode will not scan can be ticked by hand.
 *
 * Emits the ticked allocation ids; the page confirms them per blood request,
 * since receipt is recorded on each.
 */
import AssetIcon from '~/components/common/AssetIcon.vue'
import { matchScannedBag } from '~/utils/receiving'

const props = defineProps({
  /** Bags dispatched and not yet received: { allocation_id, request_id, unit_id, blood_type, component, expiry_date, released_at }. */
  bags: { type: Array, required: true },
  busy: { type: Boolean, default: false },
})

const emit = defineEmits(['confirm'])

const entry = ref('')
const scanned = ref(new Set())
const feedback = ref(null)
const scanInput = ref(null)

const allTicked = computed(() => props.bags.length > 0 && props.bags.every((bag) => scanned.value.has(bag.allocation_id)))

// A bag received elsewhere, or a reload after confirming, leaves the list;
// a tick on a bag no longer listed must not be sent.
watch(() => props.bags, (bags) => {
  const listed = new Set(bags.map((bag) => bag.allocation_id))
  scanned.value = new Set([...scanned.value].filter((id) => listed.has(id)))
})

onMounted(() => scanInput.value?.focus())

function scan() {
  const result = matchScannedBag(props.bags, scanned.value, entry.value)
  entry.value = ''

  if (result.kind === 'empty') return

  if (result.kind === 'unknown') {
    feedback.value = { tone: 'danger', text: `${result.unit_id} is not on this delivery. Set the bag aside and check it with the blood center.` }
  } else if (result.kind === 'already_scanned') {
    feedback.value = { tone: 'warning', text: `${result.bag.unit_id} is already ticked.` }
  } else {
    scanned.value = new Set([...scanned.value, result.bag.allocation_id])
    feedback.value = { tone: 'success', text: `${result.bag.unit_id} ticked.` }
  }

  scanInput.value?.focus()
}

function toggle(allocationId) {
  const next = new Set(scanned.value)

  if (next.has(allocationId)) next.delete(allocationId)
  else next.add(allocationId)

  scanned.value = next
}

function toggleAll() {
  scanned.value = allTicked.value ? new Set() : new Set(props.bags.map((bag) => bag.allocation_id))
}

function clear() {
  scanned.value = new Set()
  feedback.value = null
}

function confirm() {
  emit('confirm', new Set(scanned.value))
}

function formatDateTime(value) {
  const date = new Date(value)

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

defineExpose({ clear })
</script>

<style scoped>
.receive {
  display: flex; flex-direction: column; gap: 12px; padding: 16px;
  background: var(--rb-surface); border: 1px solid rgba(var(--rb-primary-rgb), 0.35); border-radius: 14px;
}
.receive__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.receive__title { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 15px; font-weight: 700; color: var(--rb-text-primary); }
.receive__hint { margin: 4px 0 0; font-size: 12.5px; color: var(--rb-text-secondary); max-width: 68ch; }
.receive__count {
  font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 999px;
  background: rgba(var(--rb-primary-rgb), 0.1); color: var(--rb-primary-text); font-variant-numeric: tabular-nums;
}

.receive__scan { display: flex; gap: 8px; max-width: 460px; }
.receive__input {
  flex: 1; min-width: 0; padding: 10px 12px; border-radius: 10px; font-size: 14px; letter-spacing: 0.02em;
  border: 1px solid var(--rb-border-strong); background: var(--rb-surface-alt); color: var(--rb-text-primary);
}
.receive__input:focus { outline: none; border-color: var(--rb-primary); background: var(--rb-surface); }

.receive__feedback { display: flex; align-items: center; gap: 6px; margin: 0; font-size: 12.5px; font-weight: 600; }
.receive__feedback--success { color: var(--rb-success-text); }
.receive__feedback--warning { color: var(--rb-warning-text); }
.receive__feedback--danger { color: var(--rb-accent-text); }

.table-wrap { overflow-x: auto; border: 1px solid var(--rb-border); border-radius: 10px; }
.receive__table { width: 100%; border-collapse: collapse; font-size: 13px; }
.receive__table thead th {
  text-align: left; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;
  color: var(--rb-text-secondary); padding: 9px 12px; background: var(--rb-surface-alt); white-space: nowrap;
}
.receive__table tbody td { padding: 10px 12px; border-top: 1px solid var(--rb-surface-alt); color: var(--rb-text-primary); white-space: nowrap; }
.row--on td { background: rgba(var(--rb-success-rgb), 0.07); }
.row--on td:first-child { box-shadow: inset 3px 0 0 var(--rb-success); }
.pick { width: 36px; }

.receive__actions { display: flex; gap: 10px; flex-wrap: wrap; }

.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.type-pill { display: inline-flex; font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 999px; background: rgba(var(--rb-accent-rgb), 0.08); color: var(--rb-accent-text); }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); border: 0; }

.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 7px;
  padding: 9px 16px; font-size: 13px; font-weight: 600; font-family: inherit;
  border-radius: 9px; cursor: pointer; white-space: nowrap;
  background: var(--rb-surface); color: var(--rb-text-primary); border: 1px solid var(--rb-border-strong);
}
.btn:hover:not(:disabled) { background: var(--rb-surface-hover); }
.btn--primary { background: var(--rb-primary); color: #fff; border-color: var(--rb-primary); }
.btn--primary:hover:not(:disabled) { background: #10509c; }
.btn:disabled { opacity: .55; cursor: not-allowed; }

@media (max-width: 720px) {
  .receive__scan { max-width: none; }
  .receive__actions > * { flex: 1; }
}
</style>
