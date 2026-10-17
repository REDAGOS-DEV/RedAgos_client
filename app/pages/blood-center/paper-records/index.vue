<template>
  <div class="paper-page">
    <div v-if="initialLoading" class="paper-inner" aria-busy="true" aria-label="Loading paper records">
      <div class="skeleton-head">
        <div class="skeleton skeleton--header" />
        <div class="skeleton skeleton--sub" />
      </div>
      <div class="skeleton skeleton--panel" />
    </div>

    <div v-else class="paper-inner">
      <header class="header-row">
        <div>
          <NuxtLink to="/blood-center/donations" class="back-link">
            <AssetIcon name="chevron-left" :size="14" />
            Donations
          </NuxtLink>
          <h1 class="page-title">Paper Records</h1>
          <p class="page-subtitle">
            A drive's screening and collection, written on paper and typed in afterwards. One sheet per drive and day.
          </p>
        </div>
        <button type="button" class="btn-primary" @click="openNewSheet()">
          <AssetIcon name="plus" :size="15" />
          New sheet
        </button>
      </header>

      <div v-if="loadError" class="banner banner--error" role="alert">
        <AssetIcon name="circle-alert" :size="16" />
        <p class="banner__text">{{ loadError }}</p>
        <button type="button" class="btn-link" @click="load(pager.page)">Retry</button>
      </div>

      <div v-if="notice" class="banner" :class="`banner--${notice.tone}`" role="status">
        <AssetIcon :name="notice.tone === 'error' ? 'circle-alert' : 'circle-check-big'" :size="16" />
        <p class="banner__text">{{ notice.text }}</p>
        <button type="button" class="btn-link" @click="notice = null">Dismiss</button>
      </div>

      <section class="panel">
        <div class="table-wrap" :class="{ 'table-wrap--busy': loading && sheets.length }">
          <table class="sheet-table">
            <caption class="sr-only">Paper sheets at this centre</caption>
            <thead>
              <tr>
                <th scope="col" class="c-code">Sheet</th>
                <th scope="col" class="c-drive">Drive</th>
                <th scope="col" class="c-date">Date</th>
                <th scope="col" class="c-count">Donors</th>
                <th scope="col" class="c-by">Opened by</th>
                <th scope="col" class="c-actions">Actions</th>
              </tr>
            </thead>

            <tbody v-if="loading && !sheets.length">
              <tr v-for="n in 4" :key="'sk-' + n">
                <td colspan="6"><span class="skeleton skeleton--line" /></td>
              </tr>
            </tbody>

            <tbody v-else-if="!sheets.length">
              <tr>
                <td colspan="6" class="empty-cell">
                  <div class="empty-state">
                    <span class="empty-state__icon"><AssetIcon name="file-text" :size="20" /></span>
                    <p class="empty-state__title">No paper sheets yet</p>
                    <p class="empty-state__text">
                      When a drive works on paper, open a sheet for it here and type each donor in from the forms.
                    </p>
                    <button type="button" class="btn-outline" @click="openNewSheet()">
                      <AssetIcon name="plus" :size="14" />
                      New sheet
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>

            <tbody v-else>
              <tr v-for="sheet in sheets" :key="sheet.id" class="sheet-row">
                <td class="c-code"><span class="code">{{ sheet.code }}</span></td>
                <td class="c-drive">
                  <span class="drive__name">{{ sheet.drive.name }}</span>
                  <span v-if="sheet.drive.location" class="sub">{{ sheet.drive.location }}</span>
                </td>
                <td class="c-date nowrap">
                  {{ formatShortDate(sheet.held_on) }}
                  <span class="sub">from {{ sheet.starts_at }}</span>
                </td>
                <td class="c-count">{{ sheetSummary(sheet.counts) }}</td>
                <td class="c-by">{{ sheet.created_by ?? '—' }}</td>
                <td class="c-actions">
                  <div class="row-actions">
                    <NuxtLink :to="`/blood-center/paper-records/${sheet.id}`" class="btn-outline btn-outline--sm">
                      Open
                      <AssetIcon name="arrow-right" :size="13" />
                    </NuxtLink>
                    <button
                      v-if="canDelete"
                      type="button"
                      class="icon-btn icon-btn--danger"
                      :disabled="!sheet.can.delete"
                      :aria-label="`Remove ${sheet.code}`"
                      :title="sheet.can.delete ? 'Remove this empty sheet' : 'Only an empty sheet can be removed'"
                      @click="askDelete(sheet)"
                    >
                      <AssetIcon name="trash-2" :size="15" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <footer class="pager">
          <span class="pager__info">{{ pager.total }} sheet(s)</span>
          <div class="pager__btns">
            <button type="button" class="btn-outline btn-outline--sm" :disabled="pager.page <= 1 || loading" @click="load(pager.page - 1)">
              <AssetIcon name="chevron-left" :size="14" />
              Prev
            </button>
            <span class="pager__page">Page {{ pager.page }} / {{ pager.lastPage }}</span>
            <button type="button" class="btn-outline btn-outline--sm" :disabled="pager.page >= pager.lastPage || loading" @click="load(pager.page + 1)">
              Next
              <AssetIcon name="chevron-right" :size="14" />
            </button>
          </div>
        </footer>
      </section>
    </div>

    <!-- ============ NEW SHEET ============ -->
    <Transition name="modal">
      <div v-if="form.open" class="modal-overlay" @click.self="closeNewSheet">
        <form class="modal-card" role="dialog" aria-modal="true" aria-labelledby="sheet-title" @submit.prevent="createSheet">
          <div class="modal-card__header">
            <h2 id="sheet-title" class="modal-card__title">
              <AssetIcon name="file-text" :size="17" />
              New paper sheet
            </h2>
            <button type="button" class="modal-card__close" aria-label="Close" @click="closeNewSheet">
              <AssetIcon name="x" :size="18" />
            </button>
          </div>

          <div class="modal-card__body">
            <fieldset class="choice">
              <legend class="form-label">Drive</legend>
              <label class="choice__option">
                <input v-model="form.source" type="radio" value="redagos" :disabled="!drives.length">
                <span>A drive planned in RedAgos</span>
              </label>
              <label class="choice__option">
                <input v-model="form.source" type="radio" value="outside">
                <span>A drive not in RedAgos</span>
              </label>
            </fieldset>

            <label v-if="form.source === 'redagos'" class="field">
              <span class="form-label">Which drive</span>
              <select v-model="form.mobile_event_id" class="form-input select" @change="onDrivePicked">
                <option value="">Choose a drive</option>
                <option v-for="drive in drives" :key="drive.id" :value="String(drive.id)">
                  {{ formatShortDate(drive.event_date) }} · {{ drive.name }}
                </option>
              </select>
              <span v-if="fieldError('mobile_event_id')" class="field-error">{{ fieldError('mobile_event_id') }}</span>
            </label>

            <template v-else>
              <label class="field">
                <span class="form-label">Drive name</span>
                <input v-model="form.drive_name" type="text" class="form-input" maxlength="150" placeholder="e.g. Barangay San Isidro blood drive">
                <span v-if="fieldError('drive_name')" class="field-error">{{ fieldError('drive_name') }}</span>
              </label>
              <label class="field">
                <span class="form-label">Location <span class="form-optional">optional</span></span>
                <input v-model="form.location" type="text" class="form-input" maxlength="255">
              </label>
            </template>

            <div class="field-row">
              <label class="field">
                <span class="form-label">Date held</span>
                <input
                  v-model="form.held_on"
                  type="date"
                  class="form-input"
                  :max="today"
                  :disabled="form.source === 'redagos'"
                >
                <span v-if="fieldError('held_on')" class="field-error">{{ fieldError('held_on') }}</span>
              </label>
              <label class="field">
                <span class="form-label">Started at</span>
                <input v-model="form.starts_at" type="time" class="form-input">
                <span class="field-hint">A donor with no screening time on the paper is dated at this time.</span>
              </label>
            </div>

            <div class="field-row">
              <label class="field">
                <span class="form-label">Screened by <span class="form-optional">default</span></span>
                <input v-model="form.screened_by_name" type="text" class="form-input" maxlength="120" placeholder="As written on the paper">
              </label>
              <label class="field">
                <span class="form-label">Phlebotomist <span class="form-optional">default</span></span>
                <input v-model="form.phlebotomist_name" type="text" class="form-input" maxlength="120" placeholder="As written on the paper">
              </label>
            </div>
            <p class="field-hint">Each donor starts with these names; change them on any donor the paper says otherwise.</p>

            <label class="check">
              <input v-model="form.notify_donors" type="checkbox">
              <span>
                <strong>Email donors their thank-you or deferral notice</strong>
                <span class="field-hint">Untick for an old record, so no one is emailed about a donation from long ago.</span>
              </span>
            </label>

            <p v-if="oldDrive" class="banner banner--warn" role="note">
              <AssetIcon name="clock" :size="15" />
              <span class="banner__text">
                This drive was {{ oldDriveDays }} days ago. Bags drawn then may be past their shelf life; mark any that
                will not reach the laboratory as you type them.
              </span>
            </p>

            <label class="field">
              <span class="form-label">Notes <span class="form-optional">optional</span></span>
              <textarea v-model="form.notes" class="form-input form-textarea" rows="2" maxlength="1000" />
            </label>

            <p v-if="form.error" class="form-error" role="alert">{{ form.error }}</p>
          </div>

          <div class="modal-card__footer">
            <button type="button" class="btn-outline" @click="closeNewSheet">Cancel</button>
            <button type="submit" class="btn-primary" :disabled="form.busy || !canCreate">
              {{ form.busy ? 'Opening…' : 'Open sheet' }}
            </button>
          </div>
        </form>
      </div>
    </Transition>

    <!-- ============ REMOVE EMPTY SHEET ============ -->
    <Transition name="modal">
      <div v-if="removing.sheet" class="modal-overlay" @click.self="removing.sheet = null">
        <div class="modal-card modal-card--sm" role="alertdialog" aria-modal="true" aria-labelledby="remove-title">
          <div class="modal-card__header">
            <h2 id="remove-title" class="modal-card__title">
              <AssetIcon name="triangle-alert" :size="17" />
              Remove {{ removing.sheet.code }}?
            </h2>
            <button type="button" class="modal-card__close" aria-label="Close" @click="removing.sheet = null">
              <AssetIcon name="x" :size="18" />
            </button>
          </div>
          <div class="modal-card__body">
            <p class="modal-text">The sheet for {{ removing.sheet.drive.name }} has no donors on it. Removing it cannot be undone.</p>
            <p v-if="removing.error" class="form-error" role="alert">{{ removing.error }}</p>
          </div>
          <div class="modal-card__footer">
            <button type="button" class="btn-outline" @click="removing.sheet = null">Back</button>
            <button type="button" class="btn-primary btn-primary--danger" :disabled="removing.busy" @click="confirmDelete">
              {{ removing.busy ? 'Removing…' : 'Remove sheet' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import AssetIcon from '~/components/common/AssetIcon.vue'
import { formatShortDate } from '~/utils/donorRecords'
import { daysSinceDrive, sheetSummary } from '~/utils/paperDonations'
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  // Every Collection role and the head: whoever ran the drive types it in.
  requires: 'donations.record_paper',
})

/**
 * API SHAPE
 * -------------------------------------------------------------------------
 *  GET    /paper-sheets?page=     -> paginator of sheets: { id, code, drive,
 *         held_on, starts_at, screened_by_name, phlebotomist_name,
 *         notify_donors, notes, created_by, counts, can: { delete } }
 *  GET    /paper-sheets/options   -> { today, drives: [{ id, name, location,
 *         event_date, start_time }] } (drives already held)
 *  POST   /paper-sheets           -> { data: sheet }
 *  DELETE /paper-sheets/{id}      -> only an empty sheet
 * -------------------------------------------------------------------------
 */

const route = useRoute()
const router = useRouter()
const { can } = useUser()
const canDelete = computed(() => can('donations.close'))

const initialLoading = ref(true)
const loading = ref(false)
const loadError = ref('')
const notice = ref(null)
const sheets = ref([])
const pager = reactive({ page: 1, lastPage: 1, total: 0 })

const drives = ref([])
const today = ref(localToday())

function localToday() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function errorMessage(err, fallback) {
  return Object.values(err?.errors ?? err?.data?.errors ?? {}).flat()[0] || err?.message || fallback
}

async function load(page = 1) {
  loading.value = true
  loadError.value = ''
  try {
    const res = await bloodCenterService.paperSheets({ page, per_page: 25 })
    sheets.value = res?.data ?? []
    Object.assign(pager, { page: res?.current_page ?? page, lastPage: Math.max(1, res?.last_page ?? 1), total: res?.total ?? sheets.value.length })
  } catch (err) {
    loadError.value = errorMessage(err, 'Could not load the paper sheets.')
  } finally {
    loading.value = false
    initialLoading.value = false
  }
}

async function loadOptions() {
  try {
    const res = await bloodCenterService.paperSheetOptions()
    drives.value = res?.drives ?? []
    if (res?.today) today.value = res.today
  } catch {
    drives.value = []
  }
}

/* ---------- new sheet ---------- */

function blankForm() {
  return {
    open: false,
    busy: false,
    error: '',
    errors: {},
    source: 'outside',
    mobile_event_id: '',
    drive_name: '',
    location: '',
    held_on: '',
    starts_at: '08:00',
    screened_by_name: '',
    phlebotomist_name: '',
    notify_donors: true,
    notes: '',
  }
}

const form = reactive(blankForm())

const pickedDrive = computed(() => drives.value.find((d) => String(d.id) === String(form.mobile_event_id)) ?? null)

const canCreate = computed(() => {
  if (!form.held_on || !form.starts_at) return false
  return form.source === 'redagos' ? Boolean(pickedDrive.value) : Boolean(form.drive_name.trim())
})

const oldDriveDays = computed(() => (form.held_on ? daysSinceDrive(form.held_on) : 0))
const oldDrive = computed(() => oldDriveDays.value > 30)

function fieldError(key) {
  return form.errors?.[key]?.[0] ?? ''
}

function openNewSheet(driveId = null) {
  Object.assign(form, blankForm(), { open: true })

  const drive = driveId ? drives.value.find((d) => String(d.id) === String(driveId)) : null

  if (drive) {
    form.source = 'redagos'
    form.mobile_event_id = String(drive.id)
    onDrivePicked()
  }
}

function closeNewSheet() {
  if (form.busy) return
  form.open = false
}

/** A drive planned in RedAgos was held on its own day, from its own start. */
function onDrivePicked() {
  const drive = pickedDrive.value
  if (!drive) return

  form.held_on = drive.event_date
  if (drive.start_time) form.starts_at = drive.start_time
}

async function createSheet() {
  if (!canCreate.value || form.busy) return

  form.busy = true
  form.error = ''
  form.errors = {}

  const payload = {
    held_on: form.held_on,
    starts_at: form.starts_at,
    notify_donors: form.notify_donors,
  }

  if (form.source === 'redagos') payload.mobile_event_id = Number(form.mobile_event_id)
  else {
    payload.drive_name = form.drive_name.trim()
    if (form.location.trim()) payload.location = form.location.trim()
  }

  for (const key of ['screened_by_name', 'phlebotomist_name', 'notes']) {
    if (form[key].trim()) payload[key] = form[key].trim()
  }

  try {
    const res = await bloodCenterService.createPaperSheet(payload)
    form.busy = false
    form.open = false
    await router.push(`/blood-center/paper-records/${res.data.id}`)
  } catch (err) {
    form.errors = err?.errors ?? {}
    form.error = Object.keys(form.errors).length ? '' : errorMessage(err, 'Could not open the sheet.')
    form.busy = false
  }
}

/* ---------- remove an empty sheet ---------- */

const removing = reactive({ sheet: null, busy: false, error: '' })

function askDelete(sheet) {
  Object.assign(removing, { sheet, busy: false, error: '' })
}

async function confirmDelete() {
  removing.busy = true
  removing.error = ''
  try {
    await bloodCenterService.deletePaperSheet(removing.sheet.id)
    notice.value = { tone: 'success', text: `${removing.sheet.code} was removed.` }
    removing.sheet = null
    await load(pager.page)
  } catch (err) {
    removing.error = errorMessage(err, 'Could not remove the sheet.')
  } finally {
    removing.busy = false
  }
}

/* ---------- keyboard and lifecycle ---------- */

function onKeydown(event) {
  if (event.key !== 'Escape') return
  if (removing.sheet && !removing.busy) removing.sheet = null
  else if (form.open) closeNewSheet()
}

onMounted(async () => {
  window.addEventListener('keydown', onKeydown)
  await Promise.all([load(), loadOptions()])

  // From a completed drive on the Drives page: open its sheet straight away.
  if (route.query.drive) openNewSheet(route.query.drive)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
.paper-page {
  max-width: var(--rb-content-max, 1600px);
  background: var(--rb-page-bg);
  margin: 0 auto;
  padding: 24px var(--rb-gutter, 24px) 40px;
  font-family: var(--rb-font-sans);
  color: var(--rb-text-primary);
}

.paper-inner { display: flex; flex-direction: column; gap: 16px; }

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

/* ---------- Skeletons ---------- */
.skeleton {
  display: block;
  background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 37%, var(--rb-skeleton-a) 63%);
  background-size: 400% 100%;
  border-radius: 14px;
  animation: shimmer 1.4s ease infinite;
}

.skeleton-head { display: flex; flex-direction: column; gap: 8px; }
.skeleton--header { height: 28px; max-width: 200px; border-radius: 8px; }
.skeleton--sub { height: 14px; max-width: 320px; border-radius: 6px; }
.skeleton--panel { height: 320px; }
.skeleton--line { height: 16px; width: 100%; border-radius: 6px; }

@keyframes shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}

/* ---------- Header and buttons ---------- */
.header-row { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; }
.page-title { font-size: 20px; font-weight: 700; letter-spacing: -0.02em; margin: 0; }
.page-subtitle { font-size: 13px; color: var(--rb-text-secondary); margin: 3px 0 0; max-width: 70ch; }

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 6px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--rb-text-secondary);
  text-decoration: none;
}

.back-link:hover { color: var(--rb-primary-text); }

.btn-primary,
.btn-outline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  height: 36px;
  padding: 0 14px;
  border-radius: 10px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
  text-decoration: none;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s ease, border-color 0.15s ease, opacity 0.15s ease;
}

.btn-primary { color: #fff; background: var(--rb-primary); border: 1px solid var(--rb-primary); }
.btn-primary:hover:not(:disabled) { background: color-mix(in srgb, var(--rb-primary) 88%, #000); }
.btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }
.btn-primary--danger { background: var(--rb-accent); border-color: var(--rb-accent); }
.btn-primary--danger:hover:not(:disabled) { background: color-mix(in srgb, var(--rb-accent) 88%, #000); }

.btn-outline { color: var(--rb-text-primary); background: var(--rb-surface); border: 1px solid var(--rb-border-strong); }
.btn-outline:hover:not(:disabled) { background: var(--rb-surface-hover); border-color: var(--rb-border-hover); }
.btn-outline:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-outline--sm { height: 30px; padding: 0 10px; font-size: 12px; border-radius: 8px; gap: 4px; }

.btn-link {
  background: none;
  border: none;
  padding: 0;
  color: var(--rb-primary-text);
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.btn-link:hover { text-decoration: underline; }

.btn-primary:focus-visible,
.btn-outline:focus-visible,
.btn-link:focus-visible,
.back-link:focus-visible,
.icon-btn:focus-visible,
.modal-card__close:focus-visible {
  outline: none;
  box-shadow: var(--rb-focus-ring);
}

/* ---------- Banners ---------- */
.banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid var(--rb-border);
  background: var(--rb-surface);
  font-size: 13px;
  margin: 0;
}

.banner > :deep(.asset-icon) { flex-shrink: 0; }
.banner__text { flex: 1; margin: 0; line-height: 1.45; }
.banner--success > :deep(.asset-icon) { color: var(--rb-success-text); }
.banner--error > :deep(.asset-icon) { color: var(--rb-accent-text); }
.banner--error { border-color: rgba(var(--rb-accent-rgb), 0.35); }
.banner--warn { align-items: flex-start; }
.banner--warn > :deep(.asset-icon) { color: var(--rb-warning); margin-top: 1px; }

/* ---------- Panel and table ---------- */
.panel {
  container-type: inline-size;
  background: var(--rb-surface);
  border: 1px solid var(--rb-border);
  border-radius: 14px;
  box-shadow: 0 1px 2px rgba(var(--rb-shadow-rgb), 0.03);
  overflow: hidden;
}

.table-wrap { position: relative; overflow-x: auto; transition: opacity 0.15s ease; }
.table-wrap--busy { opacity: 0.55; }

.sheet-table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 13px; }

.sheet-table thead th {
  padding: 10px;
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

.sheet-table tbody td {
  padding: 11px 10px;
  border-bottom: 1px solid var(--rb-border);
  vertical-align: middle;
  overflow: hidden;
}

.sheet-table th:first-child,
.sheet-table td:first-child { padding-left: 16px; }

.sheet-table th:last-child,
.sheet-table td:last-child { padding-right: 16px; }

.sheet-table tbody tr:last-child td { border-bottom: 0; }
.sheet-row { transition: background 0.12s ease; }
.sheet-row:hover { background: var(--rb-surface-hover); }

.c-code { width: 112px; }
.c-date { width: 118px; }
.c-count { width: 220px; }
.c-by { width: 160px; }
.c-actions { width: 140px; }

@container (max-width: 860px) {
  .c-by { display: none; }
}

@container (max-width: 680px) {
  .c-count { display: none; }
}

.code { font-family: var(--rb-font-mono); font-size: 12px; font-weight: 600; color: var(--rb-text-secondary); white-space: nowrap; }
.drive__name { display: block; font-weight: 700; overflow-wrap: anywhere; }
.sub { display: block; margin-top: 2px; font-size: 11.5px; color: var(--rb-text-secondary); }
.nowrap { white-space: nowrap; }

.row-actions { display: flex; align-items: center; gap: 6px; }

.icon-btn {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 8px;
  background: var(--rb-surface);
  color: var(--rb-text-secondary);
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease, border-color 0.12s ease;
}

.icon-btn--danger:hover:not(:disabled) { color: var(--rb-accent-text); border-color: rgba(var(--rb-accent-rgb), 0.45); background: var(--rb-surface-hover); }
.icon-btn:disabled { opacity: 0.35; cursor: not-allowed; }

.empty-cell { padding: 0 !important; }
.empty-state { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 48px 24px; text-align: center; }

.empty-state__icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  margin-bottom: 6px;
  border-radius: 12px;
  background: var(--rb-surface-alt);
  border: 1px solid var(--rb-border);
  color: var(--rb-text-secondary);
}

.empty-state__title { margin: 0; font-size: 14px; font-weight: 700; }
.empty-state__text { margin: 0 0 8px; max-width: 46ch; font-size: 13px; line-height: 1.5; color: var(--rb-text-secondary); }

/* ---------- Pager ---------- */
.pager {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 14px;
  padding: 12px 16px;
  border-top: 1px solid var(--rb-border);
  font-size: 12.5px;
  color: var(--rb-text-secondary);
}

.pager__btns { display: flex; align-items: center; gap: 8px; }
.pager__page { font-variant-numeric: tabular-nums; }

/* ---------- Modals ---------- */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: var(--rb-overlay);
}

.modal-card {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 600px;
  max-height: calc(100vh - 40px);
  margin: 0;
  background: var(--rb-surface);
  border: 1px solid var(--rb-border);
  border-radius: 16px;
  box-shadow: 0 12px 32px rgba(var(--rb-shadow-rgb), 0.28);
}

.modal-card--sm { max-width: 440px; }

.modal-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--rb-border);
  flex-shrink: 0;
}

.modal-card__title { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 15.5px; font-weight: 700; }
.modal-card__title :deep(.asset-icon) { color: var(--rb-text-secondary); }

.modal-card__close {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 1px solid var(--rb-border);
  border-radius: 8px;
  background: none;
  color: var(--rb-text-secondary);
  cursor: pointer;
}

.modal-card__close:hover { color: var(--rb-text-primary); background: var(--rb-surface-hover); }
.modal-card__body { display: flex; flex-direction: column; gap: 14px; padding: 18px 20px; overflow-y: auto; min-height: 0; }

.modal-card__footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid var(--rb-border);
  flex-shrink: 0;
}

.modal-text { margin: 0; font-size: 13.5px; line-height: 1.55; }

/* ---------- Form ---------- */
.field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.field-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.form-label { font-size: 12.5px; font-weight: 600; }
.form-optional { margin-left: 4px; font-weight: 500; color: var(--rb-text-secondary); }
.field-hint { display: block; margin: 0; font-size: 11.5px; line-height: 1.45; color: var(--rb-text-secondary); font-weight: 500; }
.field-error { font-size: 12px; color: var(--rb-accent-text); }

.choice { display: flex; flex-wrap: wrap; gap: 8px 18px; margin: 0; padding: 0; border: 0; }
.choice legend { width: 100%; margin-bottom: 6px; padding: 0; }
.choice__option { display: inline-flex; align-items: center; gap: 7px; font-size: 13px; cursor: pointer; }

.check { display: flex; align-items: flex-start; gap: 9px; font-size: 13px; line-height: 1.45; cursor: pointer; }
.check input { margin-top: 3px; }

.form-error {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid rgba(var(--rb-accent-rgb), 0.35);
  border-radius: 8px;
  background: var(--rb-surface);
  color: var(--rb-accent-text);
  font-size: 13px;
  line-height: 1.45;
}

/* Anchored on the page root: other portals ship unscoped dark .form-input rules. */
.paper-page .form-input {
  width: 100%;
  height: 38px;
  padding: 0 12px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  background-color: var(--rb-surface);
  font-family: inherit;
  font-size: 13px;
  color: var(--rb-text-primary);
  color-scheme: light dark;
}

.paper-page .form-input:disabled { opacity: 0.7; cursor: not-allowed; }
.paper-page .form-textarea { height: auto; min-height: 64px; padding: 10px 12px; line-height: 1.5; resize: vertical; }
.paper-page .form-input:focus { outline: none; border-color: var(--rb-primary); box-shadow: var(--rb-focus-ring); }

.paper-page .select {
  padding-right: 30px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2394a3b8' stroke-width='1.5' fill='none' fill-rule='evenodd'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 10px 6px;
  appearance: none;
  cursor: pointer;
}

.modal-enter-active,
.modal-leave-active { transition: opacity 0.18s ease; }

.modal-enter-from,
.modal-leave-to { opacity: 0; }

@media (max-width: 760px) {
  .header-row { flex-direction: column; align-items: stretch; }
  .field-row { grid-template-columns: minmax(0, 1fr); }
  .modal-overlay { padding: 10px; align-items: flex-end; }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none !important; }
}
</style>
