<template>
  <div class="rcv-page">
    <div class="rcv-inner">
      <header class="page-header">
        <div>
          <NuxtLink to="/hospital/receiving/weekly" class="back-link">
            <AssetIcon name="arrow-left" :size="14" />
            Weekly Request
          </NuxtLink>
          <h1 class="page-title">New weekly request</h1>
          <p class="page-subtitle">
            Ask a blood center for this week's restock. It supplies what it can — you may be sent all, part or none of
            what you ask for — and only the units you actually receive are added to your inventory.
          </p>
        </div>
      </header>

      <div v-if="loading" class="panel list-state" aria-busy="true">
        <div class="skeleton" style="width:50%" />
        <div class="skeleton" style="width:80%" />
        <div class="skeleton" style="width:65%" />
      </div>

      <div v-else-if="loadError" class="banner banner--error" role="alert">
        <AssetIcon name="triangle-alert" :size="16" />
        <span>{{ loadError }}</span>
      </div>

      <!-- Nothing due: say when it next is. A patient who needs blood sooner is a Patient Transfusion Request. -->
      <section v-else-if="!dueCentres.length" class="panel empty-state">
        <AssetIcon name="calendar" :size="36" />
        <p class="empty-state__title">No weekly request is due today</p>
        <p class="empty-state__desc">
          <template v-if="!schedules.length">Set your request days first, on the Weekly Request page.</template>
          <template v-else>
            A weekly request can only be sent on one of your request days, once a day.
            <span v-for="entry in schedules" :key="entry.schedule.id" class="next-line">
              {{ entry.schedule.target_facility?.name }}:
              {{ entry.sent_today ? `sent today (${entry.sent_today.reference_number})` : `next on ${formatDay(entry.next_request_day)}` }}
            </span>
          </template>
        </p>
        <div class="empty-state__actions">
          <NuxtLink to="/hospital/receiving/weekly" class="btn">Back to Weekly Request</NuxtLink>
          <NuxtLink to="/hospital/bloodrequests/newrequest" class="btn">New patient transfusion request</NuxtLink>
        </div>
      </section>

      <template v-else>
        <section class="panel panel--pad">
          <div class="form-row">
            <div class="field">
              <label for="wr-date" class="field-label">Request date</label>
              <input id="wr-date" type="text" class="input" :value="formatDay(status.as_of)" readonly aria-readonly="true">
            </div>

            <div class="field field--grow">
              <label for="wr-centre" class="field-label">Blood center <span class="req">*</span></label>
              <select
                id="wr-centre"
                v-model.number="target"
                class="input"
                :class="{ 'input--error': errors.target }"
              >
                <option :value="null">Select a blood center…</option>
                <option v-for="entry in dueCentres" :key="entry.schedule.target_facility.id" :value="entry.schedule.target_facility.id">
                  {{ entry.schedule.target_facility.name }} — request days {{ entry.schedule.days_label }}
                </option>
              </select>
              <p v-if="errors.target" class="field-error">{{ errors.target }}</p>
            </div>
          </div>
        </section>

        <section class="panel">
          <div class="panel__head">
            <div>
              <h2 class="panel__title">Blood you need</h2>
              <p class="panel__hint">
                One line per component and blood type. The center may supply less than you ask for; requested and
                supplied are kept separately.
              </p>
            </div>
          </div>

          <div class="lines">
            <div class="lines__row lines__row--head" aria-hidden="true">
              <span class="lines__col-component">Blood component</span>
              <span class="lines__col-type">Blood type</span>
              <span class="lines__col-units">Number of units</span>
              <span class="lines__col-action" />
            </div>

            <div v-for="(line, index) in lines" :key="line.key" class="lines__row">
              <div class="lines__col-component">
                <label :for="`wr-c-${line.key}`" class="sr-only">Blood component, line {{ index + 1 }}</label>
                <select
                  :id="`wr-c-${line.key}`"
                  v-model.number="line.component_id"
                  class="input"
                  :class="{ 'input--error': lineErrors[index]?.component_id }"
                >
                  <option :value="null">Select a component…</option>
                  <option v-for="component in components" :key="component.id" :value="component.id">{{ component.name }}</option>
                </select>
                <p v-if="lineErrors[index]?.component_id" class="field-error">{{ lineErrors[index].component_id }}</p>
              </div>

              <div class="lines__col-type">
                <label :for="`wr-t-${line.key}`" class="sr-only">Blood type, line {{ index + 1 }}</label>
                <select
                  :id="`wr-t-${line.key}`"
                  v-model.number="line.blood_type_id"
                  class="input"
                  :class="{ 'input--error': lineErrors[index]?.blood_type_id }"
                >
                  <option :value="null">Select…</option>
                  <option v-for="type in bloodTypes" :key="type.id" :value="type.id">{{ type.code }}</option>
                </select>
                <p v-if="lineErrors[index]?.blood_type_id" class="field-error">{{ lineErrors[index].blood_type_id }}</p>
              </div>

              <div class="lines__col-units">
                <label :for="`wr-q-${line.key}`" class="sr-only">Number of units, line {{ index + 1 }}</label>
                <input
                  :id="`wr-q-${line.key}`"
                  v-model.number="line.quantity"
                  type="number"
                  inputmode="numeric"
                  min="1"
                  max="100"
                  class="input input--num"
                  :class="{ 'input--error': lineErrors[index]?.quantity }"
                >
                <p v-if="lineErrors[index]?.quantity" class="field-error">{{ lineErrors[index].quantity }}</p>
              </div>

              <div class="lines__col-action">
                <button
                  type="button"
                  class="icon-btn"
                  :disabled="lines.length === 1"
                  :aria-label="`Remove line ${index + 1}`"
                  @click="removeLine(index)"
                >
                  <AssetIcon name="x" :size="14" />
                </button>
              </div>
            </div>
          </div>

          <div class="lines__foot">
            <button type="button" class="btn btn--sm" :disabled="lines.length >= 80" @click="addLine">
              <AssetIcon name="plus" :size="13" />
              Add line
            </button>
            <span class="lines__total">{{ totalUnits }} unit{{ totalUnits === 1 ? '' : 's' }} requested</span>
          </div>
        </section>

        <div v-if="submitError" class="banner banner--error" role="alert">
          <AssetIcon name="triangle-alert" :size="16" />
          <span>{{ submitError }}</span>
        </div>

        <div class="form-actions">
          <NuxtLink to="/hospital/receiving/weekly" class="btn">Cancel</NuxtLink>
          <button type="button" class="btn btn--primary" :disabled="submitting" @click="submit">
            <AssetIcon name="send" :size="14" />
            {{ submitting ? 'Sending…' : 'Send weekly request' }}
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
/**
 * Sending a blood center this week's restock.
 *
 * Only on a request day, once per center per day — the API enforces both and
 * this page only offers the centers it would accept. Lines of component, blood
 * type and units; there is no indication, because a weekly request restocks the
 * shelves and has no patient to certify one for. The API writes it as one
 * replenishment request per blood type under a WR- reference, and the center
 * supplies what it can.
 */
import AssetIcon from '~/components/common/AssetIcon.vue'
import { hospitalService } from '~/api/hospital/HospitalService'
import { RECEIVING_REFUSAL_MESSAGES } from '~/types/receiving'

definePageMeta({ middleware: ['auth', 'hospital-portal'], layout: 'hospitaldashboard' })

const route = useRoute()

const loading = ref(true)
const loadError = ref('')
const submitting = ref(false)
const submitError = ref('')

const status = ref(null)
const bloodTypes = ref([])
const components = ref([])

const target = ref(null)
const lines = ref([])
const lineErrors = ref([])
const errors = reactive({ target: '' })

let lineKey = 0

const schedules = computed(() => status.value?.schedules ?? [])
const dueCentres = computed(() => schedules.value.filter((entry) => entry.due_today && entry.schedule.target_facility))
const totalUnits = computed(() => lines.value.reduce((sum, line) => sum + Math.max(0, Number(line.quantity) || 0), 0))

onMounted(async () => {
  try {
    const [weekly, reference] = await Promise.all([hospitalService.weeklyStatus(), hospitalService.referenceData()])

    status.value = weekly
    bloodTypes.value = reference?.blood_types ?? []
    components.value = reference?.components ?? []

    const requested = Number(route.query.target)
    const due = dueCentres.value.map((entry) => entry.schedule.target_facility.id)
    target.value = due.includes(requested) ? requested : due.length === 1 ? due[0] : null

    lines.value = [emptyLine()]
  } catch (err) {
    loadError.value = err?.message || 'Could not load the form. Please try again.'
  } finally {
    loading.value = false
  }
})

function emptyLine() {
  return { key: ++lineKey, component_id: null, blood_type_id: null, quantity: null }
}

function addLine() {
  lines.value.push(emptyLine())
}

function removeLine(index) {
  lines.value.splice(index, 1)
  lineErrors.value = []
}

/** Check what the API would refuse, so staff are told beside the field. */
function validate() {
  errors.target = target.value ? '' : 'Choose the blood center this request is for.'
  const seen = new Set()

  lineErrors.value = lines.value.map((line) => {
    const lineError = {}
    const quantity = Number(line.quantity)

    if (!line.component_id) lineError.component_id = 'Select the component.'
    if (!line.blood_type_id) lineError.blood_type_id = 'Select the blood type.'
    if (!Number.isInteger(quantity) || quantity < 1) lineError.quantity = 'Enter at least 1 unit.'
    else if (quantity > 100) lineError.quantity = 'At most 100 units a line.'

    const key = `${line.blood_type_id}|${line.component_id}`
    if (line.component_id && line.blood_type_id && seen.has(key)) lineError.component_id = 'Already on this request.'
    seen.add(key)

    return lineError
  })

  return !errors.target && lineErrors.value.every((lineError) => !Object.keys(lineError).length)
}

async function submit() {
  submitError.value = ''

  if (!validate()) {
    submitError.value = 'Check the highlighted fields.'
    return
  }

  submitting.value = true

  try {
    const response = await hospitalService.createWeeklyRequest({
      target_facility_id: target.value,
      lines: lines.value.map((line) => ({
        component_id: line.component_id,
        blood_type_id: line.blood_type_id,
        quantity: Number(line.quantity),
      })),
    })

    await navigateTo(`/hospital/receiving/weekly/${response.weekly_request.id}?sent=1`)
  } catch (err) {
    if (err?.status === 422) {
      mapFieldErrors(err?.errors ?? {})
      submitError.value = firstError(err) || 'Check the highlighted fields.'
    } else {
      // A refusal explains itself: not a request day, already sent today.
      submitError.value = err?.data?.message || RECEIVING_REFUSAL_MESSAGES[err?.data?.code] || err?.message || 'The weekly request could not be sent.'
    }
  } finally {
    submitting.value = false
  }
}

/** Put the API's `lines.N.field` errors back on line N. */
function mapFieldErrors(fieldErrors) {
  lineErrors.value = lines.value.map(() => ({}))

  for (const [key, messages] of Object.entries(fieldErrors)) {
    const message = Array.isArray(messages) ? messages[0] : messages
    const match = key.match(/^lines\.(\d+)\.(\w+)$/)

    if (key === 'target_facility_id') errors.target = message
    if (match && lineErrors.value[Number(match[1])]) lineErrors.value[Number(match[1])][match[2]] = message
  }
}

function firstError(err) {
  const first = Object.values(err?.errors ?? {})[0]

  return (Array.isArray(first) ? first[0] : first) || err?.message || ''
}

function formatDay(value) {
  if (!value) return '—'
  const date = new Date(`${value}T00:00:00`)

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' })
}
</script>

<style scoped>
/* Tokens come from app/assets/css/main.css; nothing is redeclared here. */
.rcv-page { min-height: 100%; background: var(--rb-page-bg); font-family: var(--rb-font-sans); padding: 20px; }
.rcv-inner { max-width: 1000px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }

.back-link { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 600; color: var(--rb-primary-text); text-decoration: none; margin-bottom: 6px; }
.back-link:hover { text-decoration: underline; }
.page-title { font-size: 24px; font-weight: 700; color: var(--rb-text-primary); margin: 0; }
.page-subtitle { font-size: 13.5px; color: var(--rb-text-secondary); margin: 4px 0 0; max-width: 76ch; }

.banner { display: flex; align-items: center; gap: 8px; margin: 0; padding: 11px 14px; border-radius: 10px; font-size: 13px; }
.banner--error { background: rgba(var(--rb-accent-rgb), 0.08); color: var(--rb-accent-text); border: 1px solid rgba(var(--rb-accent-rgb), 0.25); }

.panel {
  background: var(--rb-surface); border: 1px solid var(--rb-border); border-radius: 14px;
  box-shadow: 0 1px 2px rgba(var(--rb-shadow-rgb), 0.03); overflow: hidden;
}
.panel--pad { padding: 16px; }
.panel__head { padding: 16px 16px 8px; }
.panel__title { margin: 0; font-size: 15px; font-weight: 700; color: var(--rb-text-primary); }
.panel__hint { margin: 3px 0 0; font-size: 12.5px; color: var(--rb-text-secondary); max-width: 80ch; }

/* Every label sits above its control, in one column of the same width as the control. */
.form-row { display: flex; gap: 14px; flex-wrap: wrap; align-items: flex-start; }
.field { display: flex; flex-direction: column; gap: 6px; min-width: 200px; }
.field--grow { flex: 1; min-width: 260px; }
.field-label { font-size: 12px; font-weight: 600; color: var(--rb-text-primary); line-height: 1.2; }
.req { color: var(--rb-accent-text); }

.input {
  width: 100%; height: 38px; padding: 0 10px; font-size: 13px; font-family: inherit; border-radius: 9px;
  border: 1px solid var(--rb-border-strong); background: var(--rb-surface-alt); color: var(--rb-text-primary);
}
.input[readonly] { color: var(--rb-text-secondary); cursor: default; }
.input:focus { outline: none; border-color: var(--rb-primary); background: var(--rb-surface); }
.input--error { border-color: var(--rb-accent); }
.input--num { font-variant-numeric: tabular-nums; }

/* Headings and controls share one three-column grid, so each heading sits over its own control. */
.lines { display: flex; flex-direction: column; padding: 4px 16px 0; }
.lines__row {
  display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr) 36px;
  gap: 12px; align-items: start; padding: 8px 0;
}
.lines__row--head {
  font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;
  color: var(--rb-text-secondary); padding-bottom: 4px;
}
.lines__row + .lines__row:not(.lines__row--head) { border-top: 1px solid var(--rb-surface-alt); }
.lines__col-action { display: grid; place-items: center; height: 38px; }
.lines__foot { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 10px 16px 16px; }
.lines__total { font-size: 12.5px; font-weight: 600; color: var(--rb-text-secondary); }

.icon-btn {
  display: grid; place-items: center; width: 32px; height: 32px; border-radius: 8px; cursor: pointer;
  background: none; border: 1px solid transparent; color: var(--rb-text-secondary);
}
.icon-btn:hover:not(:disabled) { border-color: var(--rb-border-strong); color: var(--rb-accent-text); }
.icon-btn:disabled { opacity: 0.35; cursor: not-allowed; }

.field-error { margin: 4px 0 0; font-size: 12px; color: var(--rb-accent-text); white-space: normal; }
.form-actions { display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap; }

.list-state { padding: 18px 16px; }
.empty-state { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 36px 16px; text-align: center; color: var(--rb-border-strong); }
.empty-state__title { margin: 6px 0 0; font-size: 15px; font-weight: 700; color: var(--rb-text-primary); }
.empty-state__desc { margin: 0; font-size: 13px; color: var(--rb-text-secondary); max-width: 56ch; }
.empty-state__actions { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; margin-top: 10px; }
.next-line { display: block; margin-top: 4px; color: var(--rb-text-primary); font-weight: 600; }

.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); border: 0; }

.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 7px;
  padding: 9px 16px; font-size: 13px; font-weight: 600; font-family: inherit; text-decoration: none;
  border-radius: 9px; cursor: pointer; white-space: nowrap;
  background: var(--rb-surface); color: var(--rb-text-primary); border: 1px solid var(--rb-border-strong);
}
.btn:hover:not(:disabled) { background: var(--rb-surface-hover); }
.btn--sm { padding: 6px 11px; font-size: 12px; border-radius: 8px; }
.btn--primary { background: var(--rb-primary); color: #fff; border-color: var(--rb-primary); }
.btn--primary:hover:not(:disabled) { background: #10509c; }
.btn:disabled { opacity: .55; cursor: not-allowed; }

.skeleton {
  height: 13px; border-radius: 6px; margin-bottom: 10px;
  background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 50%, var(--rb-skeleton-a) 75%);
  background-size: 200% 100%; animation: shimmer 1.4s infinite;
}
@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }

@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none; }
}

@media (max-width: 720px) {
  .rcv-page { padding: 14px; }
  .field, .field--grow { min-width: 0; width: 100%; }
  /* The headings are dropped and each control is labelled instead on a narrow screen. */
  .lines__row--head { display: none; }
  .lines__row { grid-template-columns: 1fr 1fr 36px; }
  .lines__col-component { grid-column: 1 / -1; }
  .form-actions > .btn { flex: 1; }
}
</style>
