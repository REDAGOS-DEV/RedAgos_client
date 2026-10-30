<template>
  <div class="list-page">
    <div class="list-inner">
      <PageHeader title="Request Days">
        <template #subtitle>The days you send each blood center your weekly request. A weekly request can only be sent on one of them, once a day.</template>
      </PageHeader>

      <div v-if="loadError" class="banner banner--error" role="alert">
        <AssetIcon name="circle-alert" :size="16" />
        <p class="banner__text">{{ loadError }}</p>
        <button type="button" class="btn-link" @click="refresh">Retry</button>
      </div>

      <section class="panel" aria-labelledby="centres-title">
        <h2 id="centres-title" class="sr-only">Blood centers and their request days</h2>

        <!-- The donors page's toolbar (project owner, 2026-10-30). -->
        <div class="toolbar">
          <div class="toolbar__filters">
            <label class="search">
              <AssetIcon name="search" :size="15" class="search__icon" />
              <input
                v-model="search"
                type="search"
                class="search__input"
                placeholder="Search blood center"
                aria-label="Search blood centers by name or address"
              >
            </label>
          </div>

          <div class="toolbar__actions">
            <span v-if="updatedAt" class="updated" :title="`List loaded at ${updatedAtLabel}`">
              <AssetIcon name="clock" :size="13" />
              Updated {{ updatedAtLabel }}
            </span>

            <button
              type="button"
              class="btn-outline btn-outline--squeeze"
              :disabled="refreshing"
              aria-label="Refresh the list"
              :title="updatedAt ? `Refresh · updated ${updatedAtLabel}` : 'Refresh'"
              @click="refresh"
            >
              <AssetIcon name="refresh-cw" :size="14" :class="{ spin: refreshing }" />
              <span class="btn-text">Refresh</span>
            </button>

            <button
              v-if="canManage"
              type="button"
              class="btn-primary"
              :disabled="!unscheduled.length"
              :title="unscheduled.length ? 'Add a blood center and its request days' : 'Every eligible center has request days'"
              @click="openAdd"
            >
              <AssetIcon name="plus" :size="15" />
              Add Center
            </button>
          </div>
        </div>

        <div class="table-wrap" :class="{ 'table-wrap--busy': refreshing && schedules.length }">
          <table class="list-table">
            <caption class="sr-only">Each blood center you restock from, and its request days</caption>
            <thead>
              <tr>
                <th scope="col">Blood center</th>
                <th scope="col">Request days</th>
                <th scope="col">Changed</th>
                <th v-if="canManage" scope="col" class="c-actions">Actions</th>
              </tr>
            </thead>

            <tbody v-if="loading">
              <tr v-for="n in 3" :key="'skr-' + n">
                <td :colspan="columnCount"><span class="skeleton skeleton--line" /></td>
              </tr>
            </tbody>

            <tbody v-else-if="!visible.length">
              <tr>
                <td :colspan="columnCount" class="empty-cell">
                  <div class="empty-state">
                    <span class="empty-state__icon"><AssetIcon :name="search.trim() ? 'search-x' : 'calendar'" :size="20" /></span>
                    <p class="empty-state__title">{{ search.trim() ? 'No blood center matches' : 'No request days yet' }}</p>
                    <p class="empty-state__text">
                      {{ search.trim()
                        ? 'Try another name or address.'
                        : 'Add the blood center you restock from and the days you send it your weekly request — Monday, Wednesday and Friday, for example.' }}
                    </p>
                    <button v-if="search.trim()" type="button" class="btn-outline" @click="search = ''">Clear search</button>
                    <button v-else-if="canManage && unscheduled.length" type="button" class="btn-primary" @click="openAdd">
                      <AssetIcon name="plus" :size="15" />
                      Add Center
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>

            <tbody v-else>
              <tr v-for="schedule in pageItems" :key="schedule.id" class="list-row">
                <td>
                  <div class="cell">
                    <span class="cell__main">{{ schedule.target_facility?.name || 'Blood center' }}</span>
                    <span v-if="schedule.target_facility?.address" class="cell__sub">{{ schedule.target_facility.address }}</span>
                  </div>
                </td>
                <td>
                  <div class="days" :aria-label="`Request days: ${schedule.days_label}`">
                    <span
                      v-for="day in WEEKDAYS"
                      :key="day"
                      class="day-chip"
                      :class="{ 'day-chip--on': schedule.days_of_week.includes(day) }"
                      aria-hidden="true"
                    >{{ WEEKDAY_LABELS[day] }}</span>
                  </div>
                </td>
                <td>
                  <div class="cell">
                    <span class="nowrap">{{ schedule.updated_at ? formatDate(schedule.updated_at) : '—' }}</span>
                    <span v-if="schedule.updated_by" class="cell__sub">by {{ schedule.updated_by }}</span>
                  </div>
                </td>
                <td v-if="canManage" class="c-actions">
                  <div class="row-actions">
                    <button
                      type="button"
                      class="icon-btn"
                      :aria-label="`Edit the request days for ${schedule.target_facility?.name}`"
                      title="Edit days"
                      @click="openEdit(schedule)"
                    >
                      <AssetIcon name="pencil" :size="15" />
                    </button>
                    <button
                      type="button"
                      class="icon-btn icon-btn--danger"
                      :aria-label="`Remove ${schedule.target_facility?.name}`"
                      title="Remove center"
                      @click="askRemove(schedule)"
                    >
                      <AssetIcon name="trash-2" :size="15" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <ListPager :page="page" :last-page="lastPage" :from="from" :to="to" :total="total" @go="go" />
      </section>
    </div>

    <!-- ADD / EDIT: one dialog, the center chosen only when adding -->
    <div v-if="dialog" class="dialog-backdrop" @click.self="closeDialog">
      <form
        class="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="days-dialog-title"
        v-focus-trap
        @dialog-escape="closeDialog"
        @submit.prevent="saveDialog"
      >
        <h2 id="days-dialog-title" class="dialog__title">
          <AssetIcon :name="dialog.mode === 'add' ? 'plus' : 'calendar'" :size="17" />
          {{ dialog.mode === 'add' ? 'Add a blood center' : `Request days for ${dialog.name}` }}
        </h2>

        <div v-if="dialog.mode === 'add'" class="field">
          <span class="field__label">Blood center</span>
          <SelectField
            v-model="dialog.target"
            :options="unscheduled.map((facility) => ({ value: facility.id, label: facility.name }))"
            placeholder="Choose a blood center…"
            aria-label="Blood center"
            :disabled="saving"
          />
        </div>

        <div class="field">
          <span class="field__label">Request days</span>
          <HospitalWeekdayPicker v-model="dialog.days" :label="dialog.mode === 'add' ? 'Request days for the new center' : `Request days for ${dialog.name}`" :disabled="saving" />
        </div>

        <p v-if="dialogError" class="dialog__error" role="alert">{{ dialogError }}</p>

        <div class="dialog__actions">
          <button type="button" class="btn-outline" :disabled="saving" @click="closeDialog">Cancel</button>
          <button type="submit" class="btn-primary" :disabled="saving || !dialog.days.length || (dialog.mode === 'add' && !dialog.target)">
            {{ saving ? 'Saving…' : dialog.mode === 'add' ? 'Add Center' : 'Save Days' }}
          </button>
        </div>
      </form>
    </div>

    <!-- REMOVE: confirmed here rather than in the browser's own box -->
    <div v-if="removing" class="dialog-backdrop" @click.self="closeRemove">
      <div
        class="dialog dialog--sm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="remove-title"
        aria-describedby="remove-desc"
        v-focus-trap
        @dialog-escape="closeRemove"
      >
        <h2 id="remove-title" class="dialog__title">
          <AssetIcon name="trash-2" :size="17" />
          Remove {{ removing.target_facility?.name }}?
        </h2>
        <p id="remove-desc" class="dialog__text">You stop keeping request days for it. Weekly requests already sent are untouched.</p>
        <p v-if="removeError" class="dialog__error" role="alert">{{ removeError }}</p>
        <div class="dialog__actions">
          <button type="button" class="btn-outline" :disabled="saving" @click="closeRemove">Cancel</button>
          <button type="button" class="btn-primary btn-primary--danger" :disabled="saving" @click="confirmRemove">
            {{ saving ? 'Removing…' : 'Remove Center' }}
          </button>
        </div>
      </div>
    </div>

    <Transition name="toast">
      <div v-if="toast" class="toast" role="status">{{ toast }}</div>
    </Transition>
  </div>
</template>

<script setup>
import PageHeader from '~/components/ui/PageHeader.vue'
/**
 * The blood bank's request days: which weekdays it sends each blood center its
 * weekly request. Moved off the Weekly Request page onto its own (project
 * owner, 2026-10-30); that page keeps today's status per center. Laid out as
 * the centre's Donor Management list, same day.
 *
 * Every role reads them; Requesting Staff and the Head keep them
 * (hospital.schedules.manage). A change takes effect at once.
 */
import AssetIcon from '~/components/common/AssetIcon.vue'
import ListPager from '~/components/common/ListPager.vue'
import HospitalWeekdayPicker from '~/components/Hospital/WeekdayPicker.vue'
import SelectField from '~/components/common/SelectField.vue'
import { hospitalService } from '~/api/hospital/HospitalService'
import { useListPager } from '~/composables/useListPager'
import { RECEIVING_REFUSAL_MESSAGES, WEEKDAY_LABELS, WEEKDAYS } from '~/types/receiving'

definePageMeta({ middleware: ['auth', 'hospital-portal'], layout: 'hospitaldashboard', requires: 'hospital.requests.view' })

useHead({ title: 'Request Days · RedAgos' })

const { can } = useUser()
const canManage = computed(() => can('hospital.schedules.manage'))
const columnCount = computed(() => (canManage.value ? 4 : 3))

const schedules = ref([])
const loading = ref(true)
const refreshing = ref(false)
const loadError = ref('')
const updatedAt = ref(null)

const facilities = ref([])

const search = ref('')

const visible = computed(() => {
  const term = search.value.trim().toLowerCase()
  if (!term) return schedules.value

  return schedules.value.filter((schedule) => [schedule.target_facility?.name, schedule.target_facility?.address]
    .some((value) => String(value || '').toLowerCase().includes(term)))
})

const { page, total, lastPage, from, to, pageItems, go } = useListPager(visible)

/** Eligible centers the blood bank keeps no request days with yet. */
const unscheduled = computed(() => {
  const scheduled = new Set(schedules.value.map((schedule) => schedule.target_facility?.id))

  return facilities.value.filter((facility) => !scheduled.has(facility.id))
})

const updatedAtLabel = computed(() => (updatedAt.value
  ? updatedAt.value.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  : ''))

const toast = ref('')
let toastTimer = null

onMounted(() => {
  loadSchedules()
  loadFacilities()
})

onUnmounted(() => clearTimeout(toastTimer))

async function loadSchedules() {
  loadError.value = ''

  try {
    schedules.value = (await hospitalService.replenishmentSchedules())?.schedules ?? []
    updatedAt.value = new Date()
  } catch (err) {
    loadError.value = err?.message || 'Could not load your request days.'
  } finally {
    loading.value = false
  }
}

async function loadFacilities() {
  try {
    facilities.value = (await hospitalService.eligibleFacilities())?.facilities ?? []
  } catch {
    // Adding a center needs the list; the rest of the page does not.
  }
}

async function refresh() {
  refreshing.value = true

  try {
    await Promise.all([loadSchedules(), loadFacilities()])
  } finally {
    refreshing.value = false
  }
}

/* ADD / EDIT */
const dialog = ref(null)
const dialogError = ref('')
const saving = ref(false)

function openAdd() {
  dialog.value = { mode: 'add', target: null, name: '', days: [] }
  dialogError.value = ''
}

function openEdit(schedule) {
  dialog.value = {
    mode: 'edit',
    target: schedule.target_facility?.id,
    name: schedule.target_facility?.name || 'this blood center',
    days: [...schedule.days_of_week],
  }
  dialogError.value = ''
}

function closeDialog() {
  if (saving.value) return
  dialog.value = null
}

async function saveDialog() {
  if (!dialog.value?.target || !dialog.value.days.length) return

  saving.value = true
  dialogError.value = ''

  try {
    const response = await hospitalService.saveReplenishmentSchedule(dialog.value.target, dialog.value.days)
    dialog.value = null
    showToast(response?.message || 'Request days saved.')
    await loadSchedules()
  } catch (err) {
    dialogError.value = firstError(err) || 'Those request days could not be saved.'
  } finally {
    saving.value = false
  }
}

/* REMOVE */
const removing = ref(null)
const removeError = ref('')

function askRemove(schedule) {
  removing.value = schedule
  removeError.value = ''
}

function closeRemove() {
  if (saving.value) return
  removing.value = null
}

async function confirmRemove() {
  const schedule = removing.value
  if (!schedule) return

  saving.value = true
  removeError.value = ''

  try {
    const response = await hospitalService.deleteReplenishmentSchedule(schedule.target_facility.id)
    removing.value = null
    showToast(response?.message || 'Request days removed.')
    await loadSchedules()
  } catch (err) {
    removeError.value = RECEIVING_REFUSAL_MESSAGES[err?.data?.code] || err?.message || 'That center could not be removed.'
  } finally {
    saving.value = false
  }
}

function firstError(err) {
  const first = Object.values(err?.errors ?? {})[0]

  return (Array.isArray(first) ? first[0] : first) || err?.message || ''
}

function showToast(message) {
  toast.value = message
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 4000)
}

/** An ISO timestamp as a date: "Oct 28, 2026". */
function formatDate(value) {
  const date = new Date(value)

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
</script>

<!-- The list: the blood centre's Donor Management structure (project owner, 2026-10-30). -->
<style scoped src="~/assets/css/list-ui.css"></style>

<style scoped>
.days { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
.day-chip {
  min-width: 38px; padding: 3px 0; text-align: center; border-radius: 7px;
  font-size: 11.5px; font-weight: 600; color: var(--rb-text-secondary); background: var(--rb-surface-alt);
}
.day-chip--on { background: rgba(var(--rb-primary-rgb), 0.12); color: var(--rb-primary-text); }

.btn-primary--danger { background: var(--rb-accent); border-color: var(--rb-accent); }
.btn-primary--danger:hover:not(:disabled) { background: color-mix(in srgb, var(--rb-accent) 88%, #000); }

/* ---------- Dialogs ---------- */
.dialog-backdrop {
  position: fixed; inset: 0; z-index: 320;
  display: grid; place-items: center; padding: 16px;
  background: var(--rb-overlay);
}
.dialog {
  width: min(520px, 100%);
  max-height: calc(100vh - 32px); overflow: auto;
  display: flex; flex-direction: column; gap: 14px;
  padding: 20px; border-radius: 14px;
  background: var(--rb-surface); border: 1px solid var(--rb-border);
  color: var(--rb-text-primary);
}
.dialog--sm { width: min(440px, 100%); }
.dialog:focus { outline: none; }
.dialog__title { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 16px; font-weight: 700; }
.dialog__text { margin: 0; font-size: 13.5px; line-height: 1.5; color: var(--rb-text-secondary); }
.dialog__error { margin: 0; font-size: 12.5px; color: var(--rb-accent-text); }
.dialog__actions { display: flex; justify-content: flex-end; gap: 10px; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field__label { font-size: 12.5px; font-weight: 600; color: var(--rb-text-primary); }

.toast {
  position: fixed; right: 20px; bottom: 20px; z-index: 330; max-width: min(420px, calc(100vw - 40px));
  padding: 11px 16px; border-radius: 10px; background: var(--rb-text-primary); color: var(--rb-surface);
  font-size: 13px; font-weight: 600;
}
.toast-enter-active, .toast-leave-active { transition: opacity .2s ease, transform .2s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(6px); }

@media (prefers-reduced-motion: reduce) {
  .toast-enter-active, .toast-leave-active { transition: none; }
}

@media (max-width: 520px) {
  .dialog__actions { flex-direction: column-reverse; }
  .dialog__actions > * { width: 100%; }
}
</style>
