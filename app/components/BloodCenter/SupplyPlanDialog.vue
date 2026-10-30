<template>
  <div class="plan-overlay" @click.self="emitClose">
    <div
      v-focus-trap
      class="plan"
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-title"
      @dialog-escape="emitClose"
    >
      <div class="plan__header">
        <h2 id="plan-title" class="plan__title">
          <AssetIcon name="truck" :size="17" />
          {{ existing ? 'Edit Supply Plan' : 'Confirm Order' }} — <span class="mono">{{ request.code }}</span>
        </h2>
        <button type="button" class="plan__close" aria-label="Close" :disabled="busy" @click="emitClose">
          <AssetIcon name="x" :size="18" />
        </button>
      </div>

      <form id="supply-plan-form" class="plan__body" novalidate @submit.prevent="submit">
        <!-- WHAT: one figure per line, from what is held up to what was asked. -->
        <section class="block" aria-labelledby="plan-units-title">
          <div class="block__head">
            <h3 id="plan-units-title" class="block__title">What you will supply</h3>
            <div class="block__tools">
              <button type="button" class="btn btn--sm" :disabled="busy" @click="fillFromShelf">Match the shelf</button>
              <button type="button" class="btn btn--sm" :disabled="busy" @click="fillRequested">All requested</button>
            </div>
          </div>

          <div class="table-box">
            <table class="units">
              <caption class="sr-only">Units requested, on the shelf, and to be supplied, per line</caption>
              <thead>
                <tr>
                  <th scope="col">Component</th>
                  <th scope="col" class="num">Requested</th>
                  <th scope="col" class="num">On shelf</th>
                  <th scope="col" class="c-qty">Will supply</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="line in rows" :key="line.id" :class="{ 'row--closed': line.closed }">
                  <th scope="row" class="c-name">
                    <span class="blood">{{ line.bloodType }}</span>
                    {{ line.component }}
                    <span v-if="line.held" class="sub">{{ line.held }} already reserved</span>
                  </th>
                  <td class="num">{{ line.requested }}</td>
                  <td class="num" :class="{ short: !line.closed && line.shelf < line.requested }">{{ line.closed ? '—' : line.shelf }}</td>
                  <td class="c-qty">
                    <span v-if="line.closed" class="muted">Closed</span>
                    <template v-else>
                      <div class="qty" :class="{ 'qty--error': lineError(line) }">
                        <button
                          type="button"
                          class="qty__step"
                          :aria-label="`One fewer ${line.component}`"
                          :disabled="busy || committed[line.id] <= line.held"
                          @click="step(line, -1)"
                        >&minus;</button>
                        <input
                          :id="`commit-${line.id}`"
                          v-model.number="committed[line.id]"
                          type="number"
                          inputmode="numeric"
                          class="qty__input"
                          :min="line.held"
                          :max="line.requested"
                          :disabled="busy"
                          :aria-label="`${line.bloodType} ${line.component}: units you will supply, of ${line.requested}`"
                          :aria-invalid="Boolean(lineError(line))"
                        >
                        <button
                          type="button"
                          class="qty__step"
                          :aria-label="`One more ${line.component}`"
                          :disabled="busy || committed[line.id] >= line.requested"
                          @click="step(line, 1)"
                        >+</button>
                      </div>
                      <span v-if="lineError(line)" class="field-error" role="alert">{{ lineError(line) }}</span>
                    </template>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p class="block__note" :class="{ 'block__note--warn': totalCommitted < totalRequested }">
            <AssetIcon :name="totalCommitted < totalRequested ? 'info' : 'check-circle'" :size="13" />
            <span>
              <strong>{{ totalCommitted }} of {{ totalRequested }}</strong> unit{{ totalRequested === 1 ? '' : 's' }}.
              <template v-if="totalCommitted < totalRequested">
                The rest is closed as not supplied when the order is dispatched; the hospital's next request day replaces it.
              </template>
              <template v-else>Everything asked for.</template>
            </span>
          </p>
          <p v-if="errors.lines" class="field-error field-error--block" role="alert">{{ errors.lines }}</p>
        </section>

        <!-- HOW AND WHEN -->
        <section class="block" aria-labelledby="plan-handover-title">
          <h3 id="plan-handover-title" class="block__title">Hand-over</h3>

          <div class="methods" role="radiogroup" aria-label="How the order reaches the hospital">
            <label v-for="option in METHODS" :key="option.value" class="method" :class="{ 'method--on': method === option.value }">
              <input v-model="method" type="radio" name="handover-method" :value="option.value" class="sr-only" :disabled="busy">
              <AssetIcon :name="option.icon" :size="18" class="method__icon" />
              <span class="method__label">{{ option.label }}</span>
            </label>
          </div>

          <div class="grid">
            <div class="field">
              <label for="plan-when" class="field-label">
                {{ method === 'delivery' ? 'Delivered on' : 'Ready for pick-up on' }} <span class="req">*</span>
              </label>
              <DateTimeField
                id="plan-when"
                v-model="scheduledAt"
                :min="minDateTime"
                :invalid="Boolean(errors.scheduled_at)"
                :disabled="busy"
                size="sm"
              />
              <span v-if="errors.scheduled_at" class="field-error" role="alert">{{ errors.scheduled_at }}</span>
            </div>

            <div class="field">
              <label for="plan-address" class="field-label">
                {{ method === 'delivery' ? 'Deliver to' : 'Pick-up point' }}
                <span v-if="method === 'delivery'" class="req">*</span>
                <span v-else class="field-optional">optional</span>
              </label>
              <input
                id="plan-address"
                v-model="address"
                type="text"
                class="input"
                maxlength="255"
                :disabled="busy"
                :aria-invalid="Boolean(errors.handover_address)"
                :placeholder="method === 'delivery' ? 'The hospital blood bank\'s address' : 'e.g. Issuance counter, ground floor'"
              >
              <span v-if="errors.handover_address" class="field-error" role="alert">{{ errors.handover_address }}</span>
            </div>

            <div class="field">
              <label for="plan-contact" class="field-label">Contact at this center <span class="field-optional">optional</span></label>
              <input id="plan-contact" v-model="contactName" type="text" class="input" maxlength="150" :disabled="busy" placeholder="Who the hospital calls">
              <span v-if="errors.contact_name" class="field-error" role="alert">{{ errors.contact_name }}</span>
            </div>

            <div class="field">
              <label for="plan-phone" class="field-label">Contact number <span class="field-optional">optional</span></label>
              <input
                id="plan-phone"
                v-model="contactPhone"
                type="tel"
                class="input"
                maxlength="30"
                :disabled="busy"
                :aria-invalid="Boolean(errors.contact_phone)"
                placeholder="e.g. (082) 227-2731"
              >
              <span v-if="errors.contact_phone" class="field-error" role="alert">{{ errors.contact_phone }}</span>
            </div>

            <div class="field field--full">
              <label for="plan-notes" class="field-label">Notes for the hospital <span class="field-optional">optional</span></label>
              <textarea
                id="plan-notes"
                v-model="notes"
                class="input input--area"
                rows="2"
                maxlength="1000"
                :disabled="busy"
                :placeholder="method === 'delivery' ? 'e.g. Have someone at the blood bank to receive and scan the bags.' : 'e.g. Bring a validated transport box and the request slip.'"
              />
            </div>
          </div>
        </section>

        <div v-if="error" class="notice notice--error" role="alert">
          <AssetIcon name="circle-alert" :size="14" />
          <p class="notice__text">{{ error }}</p>
        </div>
      </form>

      <div class="plan__footer">
        <span class="plan__count">{{ footerSummary }}</span>
        <button type="button" class="btn" :disabled="busy" @click="emitClose">Cancel</button>
        <button type="submit" form="supply-plan-form" class="btn btn--primary" :disabled="busy">
          {{ busy ? 'Saving…' : existing ? 'Save Changes' : 'Confirm Order' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * Confirm a replenishment order before anything is reserved for it (project
 * owner, 2026-10-29): "Inventory Replenishment is not the same process like
 * how patient request behave."
 *
 * The centre says how many units of each line it will supply — from what is
 * already reserved up to what was asked — whether the hospital picks the order
 * up or the centre delivers it, when, and who to call. The server judges every
 * figure again under a lock and answers per field; reserving afterwards never
 * takes more of a line than was committed. Whatever is left out is closed as
 * not supplied when the order is dispatched.
 */

import { computed, reactive, ref, watch } from 'vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import DateTimeField from '~/components/common/DateTimeField.vue'

const props = defineProps({
  /** The review's view of the request: code, hospital, contact (its address), raw, and the per-line availability. */
  request: { type: Object, required: true },
  busy: { type: Boolean, default: false },
  error: { type: String, default: '' },
  /** The server's validation errors, keyed as it sends them (lines.0.committed_quantity, scheduled_at…). */
  serverErrors: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['close', 'confirm'])

const METHODS = [
  { value: 'pickup', label: 'Hospital picks up', icon: 'hospital' },
  { value: 'delivery', label: 'We deliver', icon: 'truck' },
]

const { user } = useUser()
const existing = computed(() => props.request.raw?.supply_plan ?? null)

/*
 * One row per line, in the order the order lists them. "On shelf" is what is
 * issuable here now and held for nobody; what is already reserved for this
 * order is counted apart, because a line can never be cut below it.
 */
const rows = computed(() => {
  const availability = new Map((props.request.lines ?? []).map((line) => [line.request_item_id, line]))

  return (props.request.raw?.items ?? []).map((item) => {
    const line = availability.get(item.id) ?? {}
    const held = (line.reserved ?? item.reserved_quantity ?? 0) + (line.fulfilled ?? item.fulfilled_quantity ?? 0)

    return {
      id: item.id,
      component: item.component?.name ?? '—',
      bloodType: item.blood_type?.code || props.request.raw?.blood_type?.code || '—',
      requested: item.quantity,
      shelf: line.available ?? 0,
      held,
      committed: item.committed_quantity,
      closed: Boolean(item.closed_at),
    }
  })
})

const openRows = computed(() => rows.value.filter((line) => !line.closed))

// What each open line will get: the plan's figure, or, on a first plan, as
// much as the shelf can cover.
const committed = reactive({})
for (const line of openRows.value) {
  committed[line.id] = line.committed ?? Math.min(line.requested, line.held + line.shelf)
}

const totalRequested = computed(() => openRows.value.reduce((sum, line) => sum + line.requested, 0))
const totalCommitted = computed(() => openRows.value.reduce((sum, line) => sum + (Number(committed[line.id]) || 0), 0))

function step(line, by) {
  const next = (Number(committed[line.id]) || 0) + by
  committed[line.id] = Math.min(line.requested, Math.max(line.held, next))
}

function fillFromShelf() {
  for (const line of openRows.value) committed[line.id] = Math.min(line.requested, line.held + line.shelf)
}

function fillRequested() {
  for (const line of openRows.value) committed[line.id] = line.requested
}

/* HAND-OVER */
const plan = existing.value
const method = ref(plan?.handover_method ?? 'delivery')

/** 'YYYY-MM-DDTHH:mm' in the browser's zone, as DateTimeField holds it. */
function toLocalInput(value) {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// A first plan suggests tomorrow at nine; the hospital is told whatever is saved.
function tomorrowAtNine() {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  date.setHours(9, 0, 0, 0)
  return toLocalInput(date)
}

const scheduledAt = ref(plan ? toLocalInput(plan.scheduled_at) : tomorrowAtNine())
const minDateTime = computed(() => `${toLocalInput(new Date()).slice(0, 10)}T00:00`)

// The address follows the method until someone types their own: the
// hospital's for a delivery, this centre's for a pick-up.
const defaultAddress = (value) => (value === 'delivery'
  ? props.request.contact || ''
  : user.value?.facility?.address || '')
const address = ref(plan ? plan.handover_address ?? '' : defaultAddress(method.value))

watch(method, (next, previous) => {
  if (!address.value.trim() || address.value === defaultAddress(previous)) address.value = defaultAddress(next)
})

const contactName = ref(plan ? plan.contact_name ?? '' : user.value?.full_name ?? '')
const contactPhone = ref(plan ? plan.contact_phone ?? '' : user.value?.phone ?? '')
const notes = ref(plan?.notes ?? '')

/* ERRORS: this form's own checks first, then the server's per field. */
const localErrors = ref({})

const errors = computed(() => {
  const first = (key) => {
    const value = props.serverErrors?.[key]
    return Array.isArray(value) ? value[0] : value
  }

  return {
    lines: localErrors.value.lines || first('lines'),
    scheduled_at: localErrors.value.scheduled_at || first('scheduled_at'),
    handover_address: localErrors.value.handover_address || first('handover_address'),
    contact_name: first('contact_name'),
    contact_phone: first('contact_phone'),
  }
})

/** A figure outside what the line allows: checked here before anything is sent. */
function rangeError(line) {
  const value = committed[line.id]
  if (value === '' || !Number.isInteger(Number(value))) return 'Enter a whole number.'
  if (value > line.requested) return `No more than the ${line.requested} asked for.`
  if (value < line.held) return `${line.held} already reserved; return some to stock first.`
  return ''
}

/** A line's own error: out of range here, or what the server said of it (lines.N, in the order sent). */
function lineError(line) {
  const local = rangeError(line)
  if (local) return local

  const index = openRows.value.findIndex((row) => row.id === line.id)
  const server = props.serverErrors?.[`lines.${index}.committed_quantity`]
  return Array.isArray(server) ? server[0] : server || ''
}

const footerSummary = computed(() => {
  const what = `${totalCommitted.value} of ${totalRequested.value} unit${totalRequested.value === 1 ? '' : 's'}`
  return `${what} · ${method.value === 'delivery' ? 'delivery' : 'pick-up'}`
})

function validate() {
  const found = {}

  if (totalCommitted.value < 1) found.lines = 'Commit at least one unit. If you can supply none of this order, reject it instead.'
  if (!scheduledAt.value) found.scheduled_at = 'Set when the order is picked up or delivered.'
  else if (scheduledAt.value.slice(0, 10) < minDateTime.value.slice(0, 10)) found.scheduled_at = 'Choose today or a later day.'
  if (method.value === 'delivery' && !address.value.trim()) found.handover_address = 'Enter where the order is delivered to.'

  localErrors.value = found
  return !Object.keys(found).length && !openRows.value.some((line) => rangeError(line))
}

function submit() {
  if (props.busy || !validate()) return

  emit('confirm', {
    handover_method: method.value,
    scheduled_at: new Date(scheduledAt.value).toISOString(),
    handover_address: address.value.trim() || null,
    contact_name: contactName.value.trim() || null,
    contact_phone: contactPhone.value.trim() || null,
    notes: notes.value.trim() || null,
    lines: openRows.value.map((line) => ({ request_item_id: line.id, committed_quantity: Number(committed[line.id]) })),
  })
}

function emitClose() {
  if (props.busy) return
  emit('close')
}
</script>

<style scoped>
.plan-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: var(--rb-overlay);
}

.plan {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 720px;
  max-height: calc(100vh - 40px);
  background: var(--rb-surface);
  border: 1px solid var(--rb-border);
  border-radius: 16px;
  box-shadow: 0 12px 32px rgba(var(--rb-shadow-rgb), 0.28);
  color: var(--rb-text-primary);
  font-family: var(--rb-font-sans);
}

.plan:focus { outline: none; }

.plan__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--rb-border);
}

.plan__title { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 15.5px; font-weight: 700; }
.plan__title :deep(.asset-icon) { color: var(--rb-text-secondary); }

.plan__close {
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

.plan__close:hover:not(:disabled) { color: var(--rb-text-primary); background: var(--rb-surface-hover); }

.plan__body {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 18px 20px;
  overflow-y: auto;
  min-height: 0;
}

.plan__footer {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid var(--rb-border);
}

.plan__count { margin-right: auto; font-size: 12.5px; color: var(--rb-text-secondary); font-variant-numeric: tabular-nums; }

.block { display: flex; flex-direction: column; gap: 10px; }
.block__head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.block__title { margin: 0; font-size: 13.5px; font-weight: 700; }
.block__tools { display: flex; gap: 6px; }

.block__note { display: flex; align-items: flex-start; gap: 6px; margin: 0; font-size: 12.5px; line-height: 1.5; color: var(--rb-text-secondary); }
.block__note strong { color: var(--rb-text-primary); font-variant-numeric: tabular-nums; }
.block__note :deep(.asset-icon) { flex-shrink: 0; margin-top: 2px; color: var(--rb-success-text); }
.block__note--warn :deep(.asset-icon) { color: var(--rb-warning-text); }

.table-box { overflow-x: auto; border: 1px solid var(--rb-border); border-radius: 10px; }
.units { width: 100%; border-collapse: collapse; font-size: 12.5px; }

.units thead th {
  padding: 8px 10px;
  background: var(--rb-surface-alt);
  border-bottom: 1px solid var(--rb-border);
  text-align: left;
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--rb-text-secondary);
  white-space: nowrap;
}

.units tbody th, .units td { padding: 9px 10px; border-bottom: 1px solid var(--rb-border); vertical-align: middle; }
.units tr:last-child th, .units tr:last-child td { border-bottom: 0; }
.units .num { text-align: right; font-variant-numeric: tabular-nums; }
.c-name { text-align: left; font-weight: 600; }
.c-qty { width: 150px; }
.row--closed { color: var(--rb-text-secondary); }
.short { color: var(--rb-warning-text); font-weight: 700; }
.muted { color: var(--rb-text-secondary); }
.sub { display: block; margin-top: 2px; font-size: 11.5px; font-weight: 500; color: var(--rb-text-secondary); }

.blood {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 30px;
  margin-right: 4px;
  padding: 1px 7px;
  border-radius: 999px;
  border: 1px solid var(--rb-border-strong);
  background: var(--rb-surface-alt);
  font-size: 11px;
  font-weight: 700;
}

/* A stepper: the buttons for a tap, the box for typing. */
.qty { display: inline-flex; align-items: stretch; height: 32px; border: 1px solid var(--rb-border-strong); border-radius: 8px; overflow: hidden; }
.qty--error { border-color: var(--rb-accent); }
.qty__step { width: 30px; border: 0; background: var(--rb-surface-alt); color: var(--rb-text-primary); font: inherit; font-size: 15px; font-weight: 700; cursor: pointer; }
.qty__step:hover:not(:disabled) { background: var(--rb-surface-hover); }
.qty__step:disabled { color: var(--rb-text-muted); cursor: not-allowed; }
.qty__input {
  width: 52px;
  border: 0;
  border-inline: 1px solid var(--rb-border);
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  text-align: center;
  font-variant-numeric: tabular-nums;
  -moz-appearance: textfield;
}
.qty__input::-webkit-outer-spin-button, .qty__input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.qty__input:focus { outline: none; background: rgba(var(--rb-primary-rgb), 0.06); }

/* Pick-up or delivery: two choices as cards. */
.methods { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.method {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 12px;
  cursor: pointer;
  transition: border-color 0.12s ease, background 0.12s ease;
}
.method:hover { border-color: var(--rb-border-hover); }
.method--on { border-color: var(--rb-primary); background: rgba(var(--rb-primary-rgb), 0.06); box-shadow: inset 0 0 0 1px var(--rb-primary); }
.method:focus-within { box-shadow: var(--rb-focus-ring); }
.method__icon { flex-shrink: 0; color: var(--rb-text-secondary); }
.method--on .method__icon { color: var(--rb-primary-text); }
.method__label { font-size: 13px; font-weight: 700; }

.grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 14px; }
.field { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.field--full { grid-column: 1 / -1; }
.field-label { font-size: 12px; font-weight: 600; color: var(--rb-text-primary); }
.field-optional { font-weight: 500; color: var(--rb-text-secondary); }
.req { color: var(--rb-accent-text); }

.input {
  width: 100%;
  height: 36px;
  padding: 0 11px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 8px;
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  font: inherit;
  font-size: 13px;
}
.input--area { height: auto; padding: 8px 11px; resize: vertical; line-height: 1.5; }
.input::placeholder { color: var(--rb-placeholder); }
.input:focus { outline: none; border-color: var(--rb-primary); box-shadow: var(--rb-focus-ring); }
.input[aria-invalid='true'] { border-color: var(--rb-accent); }

.field-error { display: block; font-size: 11.5px; color: var(--rb-accent-text); }
.field-error--block { margin: 0; }
.c-qty .field-error { margin-top: 4px; white-space: normal; }

.notice {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  padding: 10px 12px;
  border: 1px solid rgba(var(--rb-accent-rgb), 0.35);
  border-radius: 10px;
  background: var(--rb-surface-alt);
  font-size: 12.5px;
  line-height: 1.5;
}
.notice :deep(.asset-icon) { flex-shrink: 0; margin-top: 2px; color: var(--rb-accent-text); }
.notice__text { margin: 0; }

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
.btn--sm { height: 30px; padding: 0 10px; font-size: 12px; border-radius: 8px; gap: 5px; }
.btn--primary { background: var(--rb-primary); border-color: var(--rb-primary); color: #fff; }
.btn--primary:hover:not(:disabled) { background: color-mix(in srgb, var(--rb-primary) 88%, #000); border-color: var(--rb-primary); }

.mono { font-family: var(--rb-font-mono); }

.btn:focus-visible,
.plan__close:focus-visible,
.qty__step:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }

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

@media (max-width: 640px) {
  .plan-overlay { padding: 10px; align-items: flex-end; }
  .plan { max-height: calc(100vh - 20px); }
  .methods, .grid { grid-template-columns: 1fr; }
  .plan__footer { flex-wrap: wrap; }
  .plan__count { flex-basis: 100%; }
}
</style>
