<template>
  <!--
    When the centre takes bookings: the Donor Portal and the counter build
    their time slots from this (GET/PUT /blood-center/booking-schedule). The
    centre's Admin and its Medical Receptionist keep it (booking.configure).
  -->
  <section class="bk" aria-labelledby="bk-title">
    <!-- Its own heading, unless the page around it already gives one. -->
    <div v-if="!embedded">
      <h2 id="bk-title" class="bk__title">Booking schedule</h2>
    </div>

    <p v-if="loading" class="bk__hint">Loading the schedule…</p>
    <p v-else-if="loadError" class="bk__error" role="alert">
      {{ loadError }} <button type="button" class="bk-link" @click="load">Retry</button>
    </p>

    <form v-else-if="draft" class="bk__form" @submit.prevent="save">
      <!-- Taking bookings at all -->
      <label class="bk-switch-row">
        <span>
          <span class="bk-label">Taking bookings</span>
          <span class="bk-help">Off closes the centre to new bookings in the Donor Portal. Bookings already made stay.</span>
        </span>
        <span class="toggle">
          <input v-model="draft.is_accepting_donations" type="checkbox">
          <span class="toggle__track" />
        </span>
      </label>

      <!-- Open days -->
      <fieldset class="bk-field">
        <legend class="bk-label">Open days</legend>
        <div class="days" role="group" aria-label="Open days">
          <button
            v-for="(d, i) in DAYS"
            :key="d"
            type="button"
            class="day"
            :class="{ 'day--on': draft.open_days.includes(i) }"
            :aria-pressed="draft.open_days.includes(i)"
            @click="toggleDay(i)"
          >
            {{ d }}
          </button>
        </div>
      </fieldset>

      <!-- Hours, slot length, places -->
      <div class="bk-grid">
        <div class="bk-field">
          <label class="bk-label" for="bk-start">First slot</label>
          <SelectField id="bk-start" v-model="draft.slots_start_at" :options="timeOptions" />
        </div>
        <div class="bk-field">
          <label class="bk-label" for="bk-end">Last slot</label>
          <SelectField id="bk-end" v-model="draft.slots_end_at" :options="endOptions" :invalid="draft.slots_end_at <= draft.slots_start_at" />
        </div>
        <div class="bk-field">
          <label class="bk-label" for="bk-interval">Each slot</label>
          <SelectField id="bk-interval" v-model="draft.slot_interval_minutes" :options="intervalOptions" />
        </div>
        <div class="bk-field">
          <label class="bk-label" for="bk-capacity">Donors a slot</label>
          <input id="bk-capacity" v-model.number="draft.slot_capacity" type="number" min="1" max="50" class="bk-input">
        </div>
      </div>

      <!-- What donors will see -->
      <p class="bk-preview">
        <AssetIcon name="calendar" :size="15" />
        <span>
          <strong>{{ slotsPerDay }} slots a day</strong>, from {{ fmtTime(draft.slots_start_at) }} to {{ fmtTime(draft.slots_end_at) }},
          up to <strong>{{ slotsPerDay * (draft.slot_capacity || 0) }} donors a day</strong>
          on {{ openDaysLabel }}.
        </span>
      </p>

      <!-- Closed dates -->
      <div class="bk-field">
        <span class="bk-label">Closed dates</span>
        <span class="bk-help">Holidays and other days the centre takes no bookings, even on an open day.</span>
        <ul v-if="draft.closed_dates.length" class="closed">
          <li v-for="(c, i) in draft.closed_dates" :key="c.date" class="closed__item">
            <span class="closed__date">{{ fmtDate(c.date) }}</span>
            <span class="closed__reason">{{ c.reason || 'Closed' }}</span>
            <button type="button" class="bk-icon-btn" :aria-label="`Remove ${fmtDate(c.date)}`" @click="draft.closed_dates.splice(i, 1)">
              <AssetIcon name="x" :size="15" />
            </button>
          </li>
        </ul>
        <div class="closed__add">
          <DatePicker v-model="newClosed.date" :min="today" placeholder="Pick a date" class="closed__picker" />
          <input v-model="newClosed.reason" type="text" maxlength="120" class="bk-input" placeholder="Reason, e.g. Holiday">
          <button type="button" class="bk-btn" :disabled="!newClosed.date || hasClosed(newClosed.date)" @click="addClosed">
            <AssetIcon name="circle-plus" :size="15" /> Add
          </button>
        </div>
      </div>

      <p v-if="saveError" class="bk__error" role="alert">{{ saveError }}</p>

      <div class="bk-actions">
        <button type="submit" class="bk-btn bk-btn--primary" :disabled="saving || !dirty || !valid">
          {{ saving ? 'Saving…' : 'Save schedule' }}
        </button>
        <button v-if="dirty" type="button" class="bk-btn" :disabled="saving" @click="reset">Discard changes</button>
        <span v-if="!dirty && saved" class="bk-saved"><AssetIcon name="check-circle" :size="14" /> Saved</span>
      </div>
    </form>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import DatePicker from '~/components/common/DatePicker.vue'
import SelectField from '~/components/common/SelectField.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'

defineProps({
  /** Inside a section that already titles it (Settings, Booking). */
  embedded: { type: Boolean, default: false },
})

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const LONG_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const loading = ref(true)
const loadError = ref('')
const saving = ref(false)
const saveError = ref('')
const saved = ref(false)
const original = ref(null)
const draft = ref(null)
const intervals = ref([10, 15, 20, 30, 45, 60])
const newClosed = reactive({ date: '', reason: '' })

const pad = n => String(n).padStart(2, '0')
const now = new Date()
const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`

const copy = d => JSON.parse(JSON.stringify(d))
function adopt(data) {
  const picked = {
    open_days: [...data.open_days],
    slots_start_at: data.slots_start_at,
    slots_end_at: data.slots_end_at,
    slot_interval_minutes: data.slot_interval_minutes,
    slot_capacity: data.slot_capacity,
    is_accepting_donations: data.is_accepting_donations,
    closed_dates: data.closed_dates.map(c => ({ date: c.date, reason: c.reason || null })),
  }
  original.value = copy(picked)
  draft.value = copy(picked)
  if (data.intervals?.length) intervals.value = data.intervals
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const res = await bloodCenterService.bookingSchedule()
    adopt(res.data)
  } catch (err) {
    loadError.value = err?.message || 'The booking schedule could not be loaded.'
  } finally {
    loading.value = false
  }
}
onMounted(load)

async function save() {
  saving.value = true
  saveError.value = ''
  try {
    const res = await bloodCenterService.updateBookingSchedule(draft.value)
    adopt(res.data)
    saved.value = true
  } catch (err) {
    const first = err?.errors ? Object.values(err.errors)[0]?.[0] : null
    saveError.value = first || err?.message || 'The schedule could not be saved.'
  } finally {
    saving.value = false
  }
}

function reset() {
  draft.value = copy(original.value)
  saveError.value = ''
}

function toggleDay(i) {
  const days = draft.value.open_days
  draft.value.open_days = days.includes(i) ? days.filter(d => d !== i) : [...days, i].sort((a, b) => a - b)
  saved.value = false
}

const hasClosed = date => draft.value?.closed_dates.some(c => c.date === date)
function addClosed() {
  if (!newClosed.date || hasClosed(newClosed.date)) return
  draft.value.closed_dates = [...draft.value.closed_dates, { date: newClosed.date, reason: newClosed.reason.trim() || null }]
    .sort((a, b) => a.date.localeCompare(b.date))
  newClosed.date = ''
  newClosed.reason = ''
  saved.value = false
}

const dirty = computed(() => draft.value && JSON.stringify(draft.value) !== JSON.stringify(original.value))
const valid = computed(() => draft.value
  && draft.value.open_days.length > 0
  && draft.value.slots_end_at > draft.value.slots_start_at
  && draft.value.slot_capacity >= 1 && draft.value.slot_capacity <= 50)

const minutes = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
const fmtTime = t => {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`
}
const fmtDate = d => new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })

// Every half hour from 5 AM to 9 PM.
const timeOptions = computed(() => {
  const out = []
  for (let m = 5 * 60; m <= 21 * 60; m += 30) {
    const t = `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
    out.push({ value: t, label: fmtTime(t) })
  }
  return out
})
const endOptions = computed(() => timeOptions.value.filter(o => o.value > (draft.value?.slots_start_at || '00:00')))
const intervalOptions = computed(() => intervals.value.map(n => ({ value: n, label: n === 60 ? '1 hour' : `${n} minutes` })))

// The last slot starts at the end time, as the server counts it.
const slotsPerDay = computed(() => {
  if (!draft.value || draft.value.slots_end_at <= draft.value.slots_start_at) return 0
  return Math.floor((minutes(draft.value.slots_end_at) - minutes(draft.value.slots_start_at)) / draft.value.slot_interval_minutes) + 1
})
const openDaysLabel = computed(() => {
  const days = draft.value?.open_days ?? []
  if (days.length === 7) return 'every day'
  if (!days.length) return 'no days'
  const contiguous = days.every((d, i) => i === 0 || d === days[i - 1] + 1)
  return contiguous && days.length > 2
    ? `${LONG_DAYS[days[0]]} to ${LONG_DAYS[days[days.length - 1]]}`
    : days.map(d => DAYS[d]).join(', ')
})
</script>

<style scoped>
.bk {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 1rem;
  padding: 1.25rem;
  border: 1px solid var(--rb-border);
  border-radius: 14px;
  background: var(--rb-surface);
}
.bk__title { margin: 0; font-size: 14px; font-weight: 700; color: var(--rb-text-primary); }
.bk__hint { margin: 0.25rem 0 0; max-width: 68ch; font-size: 13.5px; line-height: 1.5; color: var(--rb-text-secondary); }
.bk__error { margin: 0; font-size: 13px; color: var(--rb-accent-text, #C62828); }
.bk__form { display: flex; flex-direction: column; gap: 1.1rem; }

.bk-field { display: flex; flex-direction: column; gap: 6px; margin: 0; padding: 0; border: 0; min-width: 0; }
.bk-label { font-size: 12.5px; font-weight: 600; color: var(--rb-text-primary); }
.bk-help { font-size: 12px; color: var(--rb-text-secondary); }
.bk-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }

.bk .bk-input {
  width: 100%;
  height: 42px;
  padding: 0 12px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  background: var(--rb-surface);
  font: inherit;
  font-size: 13.5px;
  color: var(--rb-text-primary);
}
.bk .bk-input:focus { outline: none; border-color: var(--rb-primary); box-shadow: var(--rb-focus-ring); }

.bk-switch-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 14px; border-radius: 12px; background: rgba(var(--rb-primary-rgb), 0.04); cursor: pointer; }
.bk-switch-row > span:first-child { display: flex; flex-direction: column; gap: 2px; }
.toggle { position: relative; flex-shrink: 0; width: 42px; height: 24px; }
.toggle input { position: absolute; inset: 0; z-index: 1; margin: 0; opacity: 0; cursor: pointer; }
.toggle__track { position: absolute; inset: 0; border-radius: 999px; background: var(--rb-border-strong); transition: background 0.15s ease; }
.toggle__track::after { content: ''; position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2); transition: transform 0.15s ease; }
.toggle input:checked + .toggle__track { background: var(--rb-primary); }
.toggle input:checked + .toggle__track::after { transform: translateX(18px); }
.toggle input:focus-visible + .toggle__track { outline: 2px solid var(--rb-primary); outline-offset: 2px; }

.days { display: flex; flex-wrap: wrap; gap: 8px; }
.day {
  min-width: 56px;
  height: 38px;
  padding: 0 12px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  background: var(--rb-surface);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  color: var(--rb-text-secondary);
  cursor: pointer;
}
.day:hover { border-color: rgba(var(--rb-primary-rgb), 0.45); }
.day--on { border-color: var(--rb-primary); background: var(--rb-primary); color: #fff; }
.day:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; }

.bk-preview {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  padding: 10px 14px;
  border-radius: 12px;
  background: rgba(var(--rb-primary-rgb), 0.06);
  font-size: 13px;
  line-height: 1.5;
  color: var(--rb-text-secondary);
}
.bk-preview > :first-child { flex: none; margin-top: 2px; color: var(--rb-primary); }
.bk-preview strong { color: var(--rb-text-primary); }

.closed { display: flex; flex-direction: column; margin: 4px 0 0; padding: 0; border: 1px solid var(--rb-border); border-radius: 12px; list-style: none; }
.closed__item { display: grid; grid-template-columns: 170px minmax(0, 1fr) auto; align-items: center; gap: 12px; padding: 8px 8px 8px 14px; font-size: 13px; }
.closed__item + .closed__item { border-top: 1px solid var(--rb-border); }
.closed__date { font-weight: 600; color: var(--rb-text-primary); }
.closed__reason { color: var(--rb-text-secondary); }
.closed__add { display: grid; grid-template-columns: 200px minmax(0, 1fr) auto; gap: 8px; margin-top: 4px; }

.bk-icon-btn { display: grid; place-items: center; width: 30px; height: 30px; border: 0; border-radius: 8px; background: transparent; color: var(--rb-text-secondary); cursor: pointer; }
.bk-icon-btn:hover { background: rgba(211, 47, 47, 0.08); color: #C62828; }

.bk-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; }
.bk-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 42px;
  padding: 0 1rem;
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  background: var(--rb-surface);
  font: inherit;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--rb-text-primary);
  cursor: pointer;
  white-space: nowrap;
}
.bk-btn:hover:not(:disabled) { background: var(--rb-surface-hover); }
.bk-btn:disabled { opacity: 0.55; cursor: not-allowed; }
.bk-btn--primary { background: var(--rb-primary); border-color: var(--rb-primary); color: #fff; }
.bk-btn--primary:disabled { opacity: 1; background: var(--rb-surface-hover); border-color: var(--rb-border-strong); color: var(--rb-text-muted); }
.bk-saved { display: inline-flex; align-items: center; gap: 5px; font-size: 12.5px; font-weight: 600; color: var(--rb-success-text, #15803D); }
.bk-link { padding: 0; border: 0; background: none; font: inherit; font-weight: 600; color: var(--rb-primary-text); cursor: pointer; }

@media (prefers-reduced-motion: reduce) {
  .toggle__track, .toggle__track::after { transition: none; }
}
</style>
