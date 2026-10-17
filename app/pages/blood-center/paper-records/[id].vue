<template>
  <div class="sheet-page">
    <div v-if="initialLoading" class="sheet-inner" aria-busy="true" aria-label="Loading the sheet">
      <div class="skeleton-head">
        <div class="skeleton skeleton--header" />
        <div class="skeleton skeleton--sub" />
      </div>
      <div class="skeleton skeleton--panel" />
    </div>

    <div v-else class="sheet-inner">
      <NuxtLink to="/blood-center/paper-records" class="back-link">
        <AssetIcon name="chevron-left" :size="14" />
        Paper Records
      </NuxtLink>

      <div v-if="loadError" class="banner banner--error" role="alert">
        <AssetIcon name="circle-alert" :size="16" />
        <p class="banner__text">{{ loadError }}</p>
        <button type="button" class="btn-link" @click="load">Retry</button>
      </div>

      <template v-if="sheet">
        <header class="sheet-head">
          <div class="sheet-head__main">
            <p class="eyebrow">
              <span class="code">{{ sheet.code }}</span>
              <span v-if="sheet.drive.in_redagos" class="chip">Planned in RedAgos</span>
            </p>
            <h1 class="page-title">{{ sheet.drive.name }}</h1>
            <p class="page-subtitle">
              {{ longDate(sheet.held_on) }} · from {{ sheet.starts_at }}<template v-if="sheet.drive.location"> · {{ sheet.drive.location }}</template>
            </p>
          </div>

          <dl class="tally">
            <div class="tally__item"><dt>Donors</dt><dd>{{ sheet.counts.rows }}</dd></div>
            <div class="tally__item"><dt>Drawn</dt><dd>{{ sheet.counts.drawn }}</dd></div>
            <div class="tally__item"><dt>Deferred</dt><dd>{{ sheet.counts.deferred }}</dd></div>
          </dl>
        </header>

        <p class="sheet-meta">
          <span>
            <AssetIcon :name="sheet.notify_donors ? 'mail' : 'eye-off'" :size="13" />
            {{ sheet.notify_donors ? 'Donors are emailed their thank-you or deferral notice.' : 'Donors are not emailed from this sheet.' }}
          </span>
          <span v-if="sheet.created_by">Opened by {{ sheet.created_by }}</span>
          <span v-if="sheet.notes" class="sheet-meta__notes">{{ sheet.notes }}</span>
        </p>

        <div v-if="notice" class="banner" :class="`banner--${notice.tone}`" role="status">
          <AssetIcon :name="notice.tone === 'error' ? 'circle-alert' : 'circle-check-big'" :size="16" />
          <p class="banner__text">{{ notice.text }}</p>
          <button type="button" class="btn-link" @click="notice = null">Dismiss</button>
        </div>

        <BloodCenterPaperDonationForm
          :sheet="sheet"
          :blood-types="bloodTypes"
          :bag-types="bagTypes"
          @saved="onSaved"
        />

        <section class="panel" aria-labelledby="rows-title">
          <div class="panel__head">
            <h2 id="rows-title" class="panel__title">On this sheet</h2>
            <span class="panel__hint">Newest first. A record can be taken back until the laboratory starts on it.</span>
          </div>

          <div class="table-wrap">
            <table class="row-table">
              <caption class="sr-only">Donors typed from this sheet</caption>
              <thead>
                <tr>
                  <th scope="col" class="c-id">ID</th>
                  <th scope="col" class="c-donor">Donor</th>
                  <th scope="col" class="c-status">Outcome</th>
                  <th scope="col" class="c-bag">Bag</th>
                  <th scope="col" class="c-times">Times</th>
                  <th scope="col" class="c-names">Names on the paper</th>
                  <th scope="col" class="c-actions"><span class="sr-only">Actions</span></th>
                </tr>
              </thead>

              <tbody v-if="!orderedRows.length">
                <tr>
                  <td colspan="7" class="empty-cell">
                    <div class="empty-state">
                      <span class="empty-state__icon"><AssetIcon name="file-text" :size="20" /></span>
                      <p class="empty-state__title">No donors typed yet</p>
                      <p class="empty-state__text">Each donor saved above appears here, ready for the Testing department.</p>
                    </div>
                  </td>
                </tr>
              </tbody>

              <tbody v-else>
                <tr
                  v-for="row in orderedRows"
                  :key="row.id"
                  class="data-row"
                  :class="{ 'data-row--new': row.id === justSavedId }"
                >
                  <td class="c-id"><span class="code">{{ row.code }}</span></td>
                  <td class="c-donor">
                    <template v-if="row.donor && !row.donor.blinded">
                      <span class="donor__name">{{ row.donor.full_name }}</span>
                      <span class="sub">{{ [row.donor.donor_code, row.donor.blood_type].filter(Boolean).join(' · ') }}</span>
                    </template>
                    <span v-else class="muted">Identity hidden</span>
                  </td>
                  <td class="c-status">
                    <span class="badge" :class="`badge--${donationTone(row.status, row.status_label)}`">
                      <span class="badge__dot" aria-hidden="true" />
                      {{ row.status_label }}
                    </span>
                    <span v-if="row.rejection_reason" class="sub">{{ row.rejection_reason }}</span>
                  </td>
                  <td class="c-bag">
                    <span v-if="row.bag?.barcode" class="code code--bag">{{ row.bag.barcode }}</span>
                    <span v-else class="muted">—</span>
                    <span v-if="row.bag" class="sub">{{ row.bag.type }}<template v-if="row.volume_ml"> · {{ row.volume_ml }} mL</template></span>
                  </td>
                  <td class="c-times nowrap">
                    <template v-if="row.collection?.started_at">
                      {{ clock(row.collection.started_at) }}–{{ clock(row.collection.ended_at) }}
                    </template>
                    <span v-else class="muted">—</span>
                    <span class="sub">screened {{ row.time }}</span>
                  </td>
                  <td class="c-names">
                    <span v-if="row.screening?.recorded_by" class="sub sub--first">Screened by {{ row.screening.recorded_by }}</span>
                    <span v-if="row.collection?.collected_by" class="sub">Drawn by {{ row.collection.collected_by }}</span>
                  </td>
                  <td class="c-actions">
                    <button
                      v-if="row.can?.remove"
                      type="button"
                      class="icon-btn icon-btn--danger"
                      :aria-label="`Take back ${row.code}`"
                      title="Take back a record typed in error"
                      @click="askRemove(row)"
                    >
                      <AssetIcon name="trash-2" :size="15" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>
    </div>

    <!-- ============ TAKE BACK A RECORD ============ -->
    <Transition name="modal">
      <div v-if="removing.row" class="modal-overlay" @click.self="cancelRemove">
        <div class="modal-card" role="alertdialog" aria-modal="true" aria-labelledby="remove-title">
          <div class="modal-card__header">
            <h2 id="remove-title" class="modal-card__title">
              <AssetIcon name="triangle-alert" :size="17" />
              Take back {{ removing.row.code }}?
            </h2>
            <button type="button" class="modal-card__close" aria-label="Close" @click="cancelRemove">
              <AssetIcon name="x" :size="18" />
            </button>
          </div>
          <div class="modal-card__body">
            <p class="modal-text">
              The record<template v-if="removing.row.donor && !removing.row.donor.blinded"> for {{ removing.row.donor.full_name }}</template>
              is deleted as if it was never typed<template v-if="removing.row.bag?.barcode">, and bag {{ removing.row.bag.barcode }} leaves the Testing queue</template>.
              Use this only for a record typed in error.
            </p>
            <label class="form-label" for="remove-reason">Reason</label>
            <textarea id="remove-reason" v-model="removing.reason" class="form-input form-textarea" rows="2" maxlength="255" placeholder="e.g. Typed under the wrong donor" />
            <p v-if="removing.error" class="form-error" role="alert">{{ removing.error }}</p>
          </div>
          <div class="modal-card__footer">
            <button type="button" class="btn-outline" @click="cancelRemove">Back</button>
            <button type="button" class="btn-primary btn-primary--danger" :disabled="removing.busy || !removing.reason.trim()" @click="confirmRemove">
              {{ removing.busy ? 'Taking back…' : 'Take back' }}
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
import { donationTone } from '~/utils/donationRecords'
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  requires: 'donations.record_paper',
})

/**
 * API SHAPE
 * -------------------------------------------------------------------------
 *  GET    /paper-sheets/{id}          -> { data: sheet + rows } where each
 *         row is a Donations-list row plus collection.started_at/ended_at
 *         and can.remove
 *  POST   /paper-sheets/{id}/donations -> { message, data: row }
 *  DELETE /paper-sheets/{id}/donations/{donation} { reason }
 * -------------------------------------------------------------------------
 */

const route = useRoute()

const initialLoading = ref(true)
const loadError = ref('')
const notice = ref(null)
const sheet = ref(null)
const rows = ref([])
const justSavedId = ref(null)

const bloodTypes = ref([])
const bagTypes = ref([
  { value: 'single', label: 'Single', code: 'S' },
  { value: 'double', label: 'Double', code: 'D' },
  { value: 'triple', label: 'Triple', code: 'T' },
])

const orderedRows = computed(() => [...rows.value].sort((a, b) => b.id - a.id))

function errorMessage(err, fallback) {
  return Object.values(err?.errors ?? err?.data?.errors ?? {}).flat()[0] || err?.message || fallback
}

function longDate(ymd) {
  const [y, m, d] = String(ymd).split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function clock(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

async function load() {
  loadError.value = ''
  try {
    const res = await bloodCenterService.paperSheet(route.params.id)
    const { rows: list = [], ...rest } = res?.data ?? {}
    sheet.value = rest
    rows.value = list
  } catch (err) {
    loadError.value = err?.status === 404
      ? 'This sheet was not found at your centre.'
      : errorMessage(err, 'Could not load the sheet.')
  } finally {
    initialLoading.value = false
  }
}

async function loadReference() {
  try {
    const reference = await bloodCenterService.referenceData()
    bloodTypes.value = reference?.blood_types ?? []
    if (reference?.blood_bag_types?.length) bagTypes.value = reference.blood_bag_types
  } catch {
    // The fingerprick picker stays empty and optional; the bag falls back to the form's three.
  }
}

/** A saved donor goes to the top of the list, and the tally moves with it. */
function onSaved(row, message) {
  rows.value = [...rows.value, row]
  justSavedId.value = row.id

  const counts = sheet.value.counts
  counts.rows += 1
  if (row.bag) counts.drawn += 1
  if (row.status === 'rejected' && row.status_label === 'Deferred') counts.deferred += 1
  sheet.value.can = { ...sheet.value.can, delete: false }

  notice.value = { tone: 'success', text: `${row.code}${row.donor && !row.donor.blinded ? ` · ${row.donor.full_name}` : ''}. ${message ?? 'Saved.'}` }
}

/* ---------- take back a record ---------- */

const removing = reactive({ row: null, reason: '', busy: false, error: '' })

function askRemove(row) {
  Object.assign(removing, { row, reason: '', busy: false, error: '' })
}

function cancelRemove() {
  if (removing.busy) return
  removing.row = null
}

async function confirmRemove() {
  removing.busy = true
  removing.error = ''
  try {
    await bloodCenterService.removePaperDonation(sheet.value.id, removing.row.id, { reason: removing.reason.trim() })
    notice.value = { tone: 'success', text: `${removing.row.code} was taken back.` }
    removing.busy = false
    removing.row = null
    await load()
  } catch (err) {
    removing.error = errorMessage(err, 'Could not take this record back.')
    removing.busy = false
  }
}

function onKeydown(event) {
  if (event.key === 'Escape' && removing.row) cancelRemove()
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  load()
  loadReference()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
.sheet-page {
  max-width: var(--rb-content-max, 1600px);
  background: var(--rb-page-bg);
  margin: 0 auto;
  padding: 24px var(--rb-gutter, 24px) 40px;
  font-family: var(--rb-font-sans);
  color: var(--rb-text-primary);
}

.sheet-inner { display: flex; flex-direction: column; gap: 16px; }

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
.skeleton--header { height: 28px; max-width: 260px; border-radius: 8px; }
.skeleton--sub { height: 14px; max-width: 340px; border-radius: 6px; }
.skeleton--panel { height: 420px; }

@keyframes shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}

/* ---------- Header ---------- */
.back-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  align-self: flex-start;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--rb-text-secondary);
  text-decoration: none;
}

.back-link:hover { color: var(--rb-primary-text); }

.sheet-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px 24px; flex-wrap: wrap; }
.sheet-head__main { min-width: 0; }
.eyebrow { display: flex; align-items: center; gap: 8px; margin: 0 0 4px; }
.page-title { font-size: 20px; font-weight: 700; letter-spacing: -0.02em; margin: 0; overflow-wrap: anywhere; }
.page-subtitle { font-size: 13px; color: var(--rb-text-secondary); margin: 3px 0 0; }

.chip {
  padding: 1px 8px;
  border-radius: 999px;
  border: 1px solid var(--rb-border-strong);
  font-size: 11px;
  font-weight: 600;
  color: var(--rb-text-secondary);
}

.tally { display: flex; gap: 0; margin: 0; border: 1px solid var(--rb-border); border-radius: 12px; background: var(--rb-surface); overflow: hidden; }
.tally__item { padding: 8px 16px; min-width: 84px; }
.tally__item + .tally__item { border-left: 1px solid var(--rb-border); }
.tally dt { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--rb-text-secondary); }
.tally dd { margin: 2px 0 0; font-size: 18px; font-weight: 700; font-variant-numeric: tabular-nums; }

.sheet-meta { display: flex; flex-wrap: wrap; gap: 6px 18px; margin: -4px 0 0; font-size: 12.5px; color: var(--rb-text-secondary); }
.sheet-meta > span { display: inline-flex; align-items: center; gap: 5px; }
.sheet-meta__notes { flex-basis: 100%; font-style: italic; }

/* ---------- Buttons and banners ---------- */
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
  white-space: nowrap;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, opacity 0.15s ease;
}

.btn-primary { color: #fff; background: var(--rb-primary); border: 1px solid var(--rb-primary); }
.btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }
.btn-primary--danger { background: var(--rb-accent); border-color: var(--rb-accent); }
.btn-primary--danger:hover:not(:disabled) { background: color-mix(in srgb, var(--rb-accent) 88%, #000); }
.btn-outline { color: var(--rb-text-primary); background: var(--rb-surface); border: 1px solid var(--rb-border-strong); }
.btn-outline:hover:not(:disabled) { background: var(--rb-surface-hover); border-color: var(--rb-border-hover); }

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

.banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid var(--rb-border);
  background: var(--rb-surface);
  font-size: 13px;
}

.banner > :deep(.asset-icon) { flex-shrink: 0; }
.banner__text { flex: 1; margin: 0; line-height: 1.45; }
.banner--success > :deep(.asset-icon) { color: var(--rb-success-text); }
.banner--error > :deep(.asset-icon) { color: var(--rb-accent-text); }
.banner--error { border-color: rgba(var(--rb-accent-rgb), 0.35); }

/* ---------- Rows ---------- */
.panel {
  container-type: inline-size;
  background: var(--rb-surface);
  border: 1px solid var(--rb-border);
  border-radius: 14px;
  box-shadow: 0 1px 2px rgba(var(--rb-shadow-rgb), 0.03);
  overflow: hidden;
}

.panel__head { display: flex; align-items: baseline; justify-content: space-between; gap: 6px 16px; flex-wrap: wrap; padding: 14px 16px; border-bottom: 1px solid var(--rb-border); }
.panel__title { margin: 0; font-size: 14px; font-weight: 700; }
.panel__hint { font-size: 12px; color: var(--rb-text-secondary); }

.table-wrap { overflow-x: auto; }
.row-table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 13px; }

.row-table thead th {
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

.row-table tbody td { padding: 11px 10px; border-bottom: 1px solid var(--rb-border); vertical-align: middle; overflow: hidden; }
.row-table th:first-child,
.row-table td:first-child { padding-left: 16px; }
.row-table th:last-child,
.row-table td:last-child { padding-right: 16px; }
.row-table tbody tr:last-child td { border-bottom: 0; }

.data-row { transition: background 0.12s ease; }
.data-row:hover { background: var(--rb-surface-hover); }

/* The donor just saved carries a marker on its edge, never a filled row. */
.data-row--new td:first-child { box-shadow: inset 3px 0 0 var(--rb-success); }

.c-id { width: 112px; }
.c-status { width: 170px; }
.c-bag { width: 140px; }
.c-times { width: 120px; }
.c-names { width: 200px; }
.c-actions { width: 56px; }

@container (max-width: 940px) {
  .c-names { display: none; }
}

@container (max-width: 760px) {
  .c-times { display: none; }
}

@container (max-width: 620px) {
  .c-bag { display: none; }
}

.code { font-family: var(--rb-font-mono); font-size: 12px; font-weight: 600; color: var(--rb-text-secondary); white-space: nowrap; }
.code--bag { color: var(--rb-text-primary); }
.donor__name { display: block; font-weight: 700; text-transform: capitalize; overflow-wrap: anywhere; }
.sub { display: block; margin-top: 2px; font-size: 11.5px; color: var(--rb-text-secondary); overflow-wrap: anywhere; }
.sub--first { margin-top: 0; }
.muted { color: var(--rb-text-secondary); }
.nowrap { white-space: nowrap; }

.badge {
  --tone: var(--rb-text-muted);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 9px;
  border-radius: 999px;
  border: 1px solid var(--rb-border);
  background: var(--rb-surface);
  font-size: 11.5px;
  font-weight: 600;
  line-height: 1.5;
  white-space: nowrap;
}

.badge__dot { width: 6px; height: 6px; border-radius: 999px; background: var(--tone); flex-shrink: 0; }
.badge--info { --tone: var(--rb-primary); }
.badge--ok { --tone: var(--rb-success); }
.badge--warn { --tone: var(--rb-warning); }
.badge--crit { --tone: var(--rb-accent); }
.badge--neutral { --tone: var(--rb-text-muted); color: var(--rb-text-secondary); }

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

.icon-btn--danger:hover { color: var(--rb-accent-text); border-color: rgba(var(--rb-accent-rgb), 0.45); background: var(--rb-surface-hover); }

.empty-cell { padding: 0 !important; }
.empty-state { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 40px 24px; text-align: center; }

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
.empty-state__text { margin: 0; max-width: 46ch; font-size: 13px; line-height: 1.5; color: var(--rb-text-secondary); }

/* ---------- Modal ---------- */
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
  max-width: 480px;
  max-height: calc(100vh - 40px);
  background: var(--rb-surface);
  border: 1px solid var(--rb-border);
  border-radius: 16px;
  box-shadow: 0 12px 32px rgba(var(--rb-shadow-rgb), 0.28);
}

.modal-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--rb-border);
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
.modal-card__body { display: flex; flex-direction: column; gap: 12px; padding: 18px 20px; overflow-y: auto; min-height: 0; }
.modal-card__footer { display: flex; justify-content: flex-end; gap: 10px; padding: 14px 20px; border-top: 1px solid var(--rb-border); }
.modal-text { margin: 0; font-size: 13.5px; line-height: 1.55; }

.form-label { font-size: 12.5px; font-weight: 600; }

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
.sheet-page .form-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  background-color: var(--rb-surface);
  font-family: inherit;
  font-size: 13px;
  color: var(--rb-text-primary);
}

.sheet-page .form-textarea { min-height: 64px; line-height: 1.5; resize: vertical; }
.sheet-page .form-input:focus { outline: none; border-color: var(--rb-primary); box-shadow: var(--rb-focus-ring); }

.modal-enter-active,
.modal-leave-active { transition: opacity 0.18s ease; }

.modal-enter-from,
.modal-leave-to { opacity: 0; }

@media (max-width: 760px) {
  .tally { width: 100%; }
  .tally__item { flex: 1; min-width: 0; }
  .modal-overlay { padding: 10px; align-items: flex-end; }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none !important; }
}
</style>
