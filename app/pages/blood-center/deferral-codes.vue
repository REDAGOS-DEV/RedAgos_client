<template>
  <div class="codes-page">
    <header class="codes-page__header">
      <div>
        <h1 class="codes-page__title">Deferral Codes</h1>
        <p class="codes-page__subtitle">
          Every deferral is recorded under one of these codes. Screens, printouts and the donor's own deferral notice show
          the code only; what it stands for stays with staff allowed the donor's clinical record.
        </p>
      </div>

      <div class="header-actions">
        <button type="button" class="btn btn--ghost" :disabled="busy" @click="load">
          <AssetIcon name="refresh-cw" :size="14" :class="{ spin: busy }" />
          {{ busy ? 'Loading…' : 'Refresh' }}
        </button>
        <button v-if="canManage && !adding" type="button" class="btn btn--primary" @click="openAdd">
          <AssetIcon name="plus" :size="14" />
          Add code
        </button>
      </div>
    </header>

    <div class="scope">
      <span class="scope__item">
        <AssetIcon name="lock" :size="14" />
        Codes for this centre only. Another centre's R1 may mean something else.
      </span>
      <label class="scope__toggle">
        <input v-model="showRetired" type="checkbox">
        Show retired codes ({{ retiredCount }})
      </label>
    </div>

    <div v-if="banner" class="alert" :class="`alert--${bannerKind}`" role="status">
      <AssetIcon :name="bannerKind === 'success' ? 'circle-check-big' : bannerKind === 'error' ? 'circle-alert' : 'info'" :size="16" />
      <span>{{ banner }}</span>
    </div>

    <form v-if="adding" class="card add" novalidate @submit.prevent="submitAdd">
      <div class="add__head">
        <h2 class="add__title">Add a deferral code</h2>
        <p class="add__note">
          <AssetIcon name="info" :size="13" />
          Pick a code that says nothing on its own. Donors will see it on their deferral notice.
        </p>
      </div>

      <div class="add__fields">
        <label class="field field--code">
          <span class="field__label">Code</span>
          <input
            ref="codeInput"
            v-model="addForm.code"
            type="text"
            :maxlength="DEFERRAL_CODE_MAX"
            :placeholder="`e.g. ${suggestedCode}`"
            class="text-input text-input--code"
            :class="{ 'text-input--invalid': addErrors.code }"
            spellcheck="false"
            required
          >
          <em v-if="addErrors.code" class="field__error">{{ addErrors.code }}</em>
          <small v-else class="field__hint">Kept as typed, e.g. {{ suggestedCode }} or R2-Low</small>
        </label>

        <label class="field field--reason">
          <span class="field__label">Reason it stands for</span>
          <input
            v-model="addForm.reason"
            type="text"
            maxlength="255"
            placeholder="e.g. Recent blood transfusion"
            class="text-input"
            :class="{ 'text-input--invalid': addErrors.reason }"
            required
          >
          <em v-if="addErrors.reason" class="field__error">{{ addErrors.reason }}</em>
        </label>
      </div>

      <div class="add__actions">
        <button type="button" class="btn btn--ghost" :disabled="addSaving" @click="adding = false">Cancel</button>
        <button type="submit" class="btn btn--primary" :disabled="addSaving || !canSubmitAdd">
          {{ addSaving ? 'Adding…' : 'Add code' }}
        </button>
      </div>
    </form>

    <section class="card">
      <table class="codes">
        <thead>
          <tr>
            <th scope="col" class="c-code">Code</th>
            <th scope="col">Reason</th>
            <th scope="col" class="c-uses">Records</th>
            <th scope="col" class="c-status">Status</th>
            <th v-if="canManage" scope="col" class="right"><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <template v-if="busy && !rows.length">
            <tr v-for="n in 5" :key="`sk-${n}`">
              <td><span class="skeleton skeleton--code" /></td>
              <td><span class="skeleton skeleton--text" /></td>
              <td><span class="skeleton skeleton--num" /></td>
              <td><span class="skeleton skeleton--pill" /></td>
              <td v-if="canManage" />
            </tr>
          </template>
          <tr v-else-if="!visibleRows.length">
            <td :colspan="canManage ? 5 : 4" class="empty">
              {{ rows.length ? 'Every code is retired. Tick "Show retired codes" to see them.' : 'No deferral codes yet.' }}
            </td>
          </tr>
          <tr
            v-for="row in visibleRows"
            v-else
            :key="row.id"
            :class="{ 'row--retired': row.retired, 'row--editing': editing?.id === row.id, 'row--new': row.id === justAddedId }"
          >
            <template v-if="editing?.id === row.id">
              <td class="c-code">
                <label class="sr-only" :for="`code-${row.id}`">Code</label>
                <input
                  :id="`code-${row.id}`"
                  v-model="editing.code"
                  type="text"
                  :maxlength="DEFERRAL_CODE_MAX"
                  class="text-input text-input--code text-input--cell"
                  :class="{ 'text-input--invalid': editErrors.code }"
                  :disabled="!!row.uses"
                  :title="row.uses ? 'On a donor\'s record already, so it keeps its code.' : undefined"
                  spellcheck="false"
                >
                <em v-if="editErrors.code" class="field__error">{{ editErrors.code }}</em>
              </td>
              <td>
                <label class="sr-only" :for="`reason-${row.id}`">Reason</label>
                <input
                  :id="`reason-${row.id}`"
                  v-model="editing.reason"
                  type="text"
                  maxlength="255"
                  class="text-input text-input--cell"
                  :class="{ 'text-input--invalid': editErrors.reason }"
                >
                <em v-if="editErrors.reason" class="field__error">{{ editErrors.reason }}</em>
                <small v-else-if="row.uses" class="field__hint">Past records keep the wording they were recorded with.</small>
              </td>
            </template>
            <template v-else>
              <td class="c-code"><span class="code">{{ row.code }}</span></td>
              <td class="reason">
                {{ row.reason }}
                <span v-if="row.updated_by" class="reason__sub">Last changed by {{ row.updated_by }}{{ row.updated_at ? `, ${formatShortDate(row.updated_at)}` : '' }}</span>
              </td>
            </template>

            <td class="c-uses">{{ row.uses ?? 0 }}</td>
            <td class="c-status">
              <span class="badge" :class="row.retired ? 'badge--neutral' : 'badge--ok'">
                <span class="badge__dot" aria-hidden="true" />
                {{ row.retired ? 'Retired' : 'Offered' }}
              </span>
            </td>

            <td v-if="canManage" class="right">
              <div class="row-actions">
                <template v-if="editing?.id === row.id">
                  <button type="button" class="btn btn--ghost btn--sm" :disabled="savingId === row.id" @click="cancelEdit">Cancel</button>
                  <button type="button" class="btn btn--primary btn--sm" :disabled="savingId === row.id || !editDirty" @click="saveEdit(row)">
                    {{ savingId === row.id ? 'Saving…' : 'Save' }}
                  </button>
                </template>
                <template v-else>
                  <button type="button" class="btn btn--ghost btn--sm" :disabled="savingId === row.id" @click="startEdit(row)">Edit</button>
                  <button type="button" class="btn btn--sm" :disabled="savingId === row.id" @click="toggleRetired(row)">
                    {{ row.retired ? 'Offer again' : 'Retire' }}
                  </button>
                </template>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <p class="footnote">
      <AssetIcon name="info" :size="14" />
      <span>
        A code on a donor's record keeps its name and is never given to another reason, so a donor told "R1" can always ask
        about it. New wording applies to deferrals recorded from now on. Retiring a code stops it being offered; records
        that carry it keep it. Other is always offered beside these codes: the reason is typed, and the donor's notice
        gives none.
      </span>
    </p>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import { DEFERRAL_CODE_MAX, isValidDeferralCode, nextDeferralCode, normaliseDeferralCode, sortDeferralCodes } from '~/utils/deferralCodes'
import { formatShortDate } from '~/utils/donorRecords'

/**
 * The centre's deferral codes (project owner, 2026-10-24).
 *
 * The counter, a drive's paper record and the Deferrals page all record a
 * deferral by code; the record and the donor's notice show the code alone.
 * This is where the Screening Physician keeps the list (deferrals.configure).
 * Anyone else allowed the clinical record may read it here.
 *
 * GET   /blood-center/deferral-codes?include_retired=1
 *        → { data: [{ id, code, reason, retired, uses, updated_at, updated_by }], can: { manage } }
 * POST  /blood-center/deferral-codes { code, reason }                (deferrals.configure)
 * PATCH /blood-center/deferral-codes/{id} { code?, reason?, retired? }
 */

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  requires: ['deferrals.configure', 'donors.view_clinical'],
})

useHead({ title: 'Deferral Codes · RedAgos' })

const rows = ref([])
const canManage = ref(false)
const busy = ref(false)
const showRetired = ref(false)
const banner = ref('')
const bannerKind = ref('notice')

const visibleRows = computed(() => rows.value.filter((row) => showRetired.value || !row.retired))
const retiredCount = computed(() => rows.value.filter((row) => row.retired).length)
const suggestedCode = computed(() => nextDeferralCode(rows.value))

function firstError(err, fallback) {
  return err?.data?.message
    || Object.values(err?.data?.errors ?? err?.errors ?? {}).flat()[0]
    || err?.message
    || fallback
}

function fieldErrors(err) {
  const errors = err?.data?.errors ?? err?.errors
  if (!errors) return null
  return Object.fromEntries(Object.entries(errors).map(([field, messages]) => [field, Array.isArray(messages) ? messages[0] : messages]))
}

function replaceRow(updated) {
  const index = rows.value.findIndex((r) => r.id === updated.id)
  if (index !== -1) rows.value[index] = updated
}

async function load() {
  busy.value = true
  banner.value = ''

  try {
    const res = await bloodCenterService.deferralCodes({ include_retired: true })
    rows.value = res?.data ?? []
    canManage.value = !!res?.can?.manage
  } catch (err) {
    bannerKind.value = 'error'
    banner.value = firstError(err, 'The deferral codes could not be loaded.')
  } finally {
    busy.value = false
  }
}

/* --- Adding --- */

const adding = ref(false)
const addSaving = ref(false)
const codeInput = ref(null)
const justAddedId = ref(null)
const addErrors = reactive({})
const addForm = reactive({ code: '', reason: '' })

const canSubmitAdd = computed(() => isValidDeferralCode(addForm.code) && addForm.reason.trim().length >= 2)

async function openAdd() {
  Object.assign(addForm, { code: suggestedCode.value, reason: '' })
  Object.keys(addErrors).forEach((key) => delete addErrors[key])
  adding.value = true
  await nextTick()
  codeInput.value?.focus()
  codeInput.value?.select()
}

async function submitAdd() {
  addSaving.value = true
  Object.keys(addErrors).forEach((key) => delete addErrors[key])
  banner.value = ''

  try {
    const res = await bloodCenterService.addDeferralCode({
      code: normaliseDeferralCode(addForm.code),
      reason: addForm.reason.trim(),
    })

    if (res?.data) {
      rows.value = sortDeferralCodes([...rows.value, res.data])
      justAddedId.value = res.data.id
    }

    adding.value = false
    bannerKind.value = 'success'
    banner.value = res?.message || 'Code added.'
  } catch (err) {
    const errors = fieldErrors(err)

    if (errors) {
      Object.assign(addErrors, errors)
    } else {
      bannerKind.value = 'error'
      banner.value = firstError(err, 'The code could not be added.')
    }
  } finally {
    addSaving.value = false
  }
}

/* --- Changing --- */

const editing = ref(null)
const editErrors = reactive({})
const savingId = ref(null)

const editDirty = computed(() => {
  const row = rows.value.find((r) => r.id === editing.value?.id)
  if (!row || !editing.value) return false
  return normaliseDeferralCode(editing.value.code) !== row.code || editing.value.reason.trim() !== row.reason
})

function startEdit(row) {
  Object.keys(editErrors).forEach((key) => delete editErrors[key])
  editing.value = { id: row.id, code: row.code, reason: row.reason ?? '' }
}

function cancelEdit() {
  editing.value = null
}

async function saveEdit(row) {
  const code = normaliseDeferralCode(editing.value.code)
  const reason = editing.value.reason.trim()
  const payload = {
    ...(code !== row.code ? { code } : {}),
    ...(reason !== row.reason ? { reason } : {}),
  }

  savingId.value = row.id
  Object.keys(editErrors).forEach((key) => delete editErrors[key])
  banner.value = ''

  try {
    const res = await bloodCenterService.updateDeferralCode(row.id, payload)
    if (res?.data) replaceRow(res.data)
    rows.value = sortDeferralCodes(rows.value)
    editing.value = null
    bannerKind.value = 'success'
    banner.value = res?.message || `${code} saved.`
  } catch (err) {
    const errors = fieldErrors(err)

    if (errors) {
      Object.assign(editErrors, errors)
    } else {
      bannerKind.value = 'error'
      banner.value = firstError(err, 'The code could not be saved.')
    }
  } finally {
    savingId.value = null
  }
}

async function toggleRetired(row) {
  savingId.value = row.id
  banner.value = ''

  try {
    const res = await bloodCenterService.updateDeferralCode(row.id, { retired: !row.retired })
    if (res?.data) replaceRow(res.data)
    bannerKind.value = 'success'
    banner.value = res?.message || 'Saved.'
  } catch (err) {
    bannerKind.value = 'error'
    banner.value = firstError(err, 'The code could not be changed.')
  } finally {
    savingId.value = null
  }
}

onMounted(load)
</script>

<style scoped>
.codes-page {
  font-family: var(--rb-font-sans);
  max-width: var(--rb-content-max, 1600px);
  margin: 0 auto;
  padding: 24px var(--rb-gutter, 24px) 40px;
  background: var(--rb-page-bg);
  display: flex;
  flex-direction: column;
  gap: 16px;
  color: var(--rb-text-primary);
}

.codes-page__header { display: flex; gap: 16px; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; }
.codes-page__title { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }
.codes-page__subtitle { margin: 4px 0 0; max-width: 72ch; font-size: 13px; line-height: 1.55; color: var(--rb-text-secondary); }
.header-actions { display: flex; align-items: center; gap: 8px; }

.scope { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.scope__item { display: inline-flex; align-items: center; gap: 7px; font-size: 12.5px; color: var(--rb-text-secondary); }
.scope__toggle { display: inline-flex; align-items: center; gap: 7px; font-size: 12.5px; font-weight: 600; color: var(--rb-text-secondary); cursor: pointer; }
.scope__toggle input { width: 15px; height: 15px; accent-color: var(--rb-primary); }

.alert {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 11px 14px;
  border-radius: 10px;
  font-size: 13px;
  line-height: 1.5;
}
.alert :deep(svg) { flex-shrink: 0; }
.alert--notice { background: rgba(var(--rb-primary-rgb), 0.08); color: var(--rb-primary-text); border: 1px solid rgba(var(--rb-primary-rgb), 0.25); }
.alert--success { background: rgba(var(--rb-success-rgb), 0.08); color: var(--rb-success-text); border: 1px solid rgba(var(--rb-success-rgb), 0.25); }
.alert--error { background: rgba(var(--rb-accent-rgb), 0.08); color: var(--rb-accent-text); border: 1px solid rgba(var(--rb-accent-rgb), 0.25); }

.card {
  border: 1px solid var(--rb-border);
  border-radius: 14px;
  background: var(--rb-surface);
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(var(--rb-shadow-rgb), 0.03);
}

/* add form */
.add { display: flex; flex-direction: column; gap: 14px; padding: 16px 18px; overflow: visible; }
.add__head { display: flex; flex-direction: column; gap: 4px; }
.add__title { margin: 0; font-size: 14px; font-weight: 700; }
.add__note { display: flex; align-items: flex-start; gap: 6px; margin: 0; font-size: 12px; line-height: 1.5; color: var(--rb-text-secondary); }
.add__note :deep(svg) { flex-shrink: 0; margin-top: 2px; }
.add__fields { display: grid; grid-template-columns: 160px minmax(220px, 1fr); gap: 12px; align-items: start; }
.add__actions { display: flex; justify-content: flex-end; gap: 8px; }

.field { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.field__label { font-size: 12px; font-weight: 600; color: var(--rb-text-primary); }
.field__hint { display: block; margin-top: 3px; font-size: 11.5px; color: var(--rb-text-secondary); }
.field__error { display: block; margin-top: 3px; font-size: 11.5px; font-style: normal; color: var(--rb-accent-text); }

.text-input {
  height: 36px;
  width: 100%;
  padding: 0 11px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  font: inherit;
  font-size: 13px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.text-input:focus { outline: none; border-color: var(--rb-primary); box-shadow: var(--rb-focus-ring); }
.text-input:disabled { background: var(--rb-surface-alt); color: var(--rb-text-secondary); cursor: not-allowed; }
.text-input::placeholder { color: var(--rb-placeholder); }
.text-input--code { letter-spacing: 0.04em; font-variant-numeric: tabular-nums; }
.text-input--code::placeholder { letter-spacing: normal; }
.text-input--cell { height: 32px; }
.text-input--invalid { border-color: var(--rb-accent); }

/* table */
.codes { width: 100%; border-collapse: collapse; font-size: 13px; }
.codes th {
  text-align: left;
  padding: 10px 16px;
  background: var(--rb-surface-alt);
  border-bottom: 1px solid var(--rb-border);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--rb-text-secondary);
}
.codes td { padding: 10px 16px; border-bottom: 1px solid var(--rb-border); vertical-align: middle; }
.codes tr:last-child td { border-bottom: 0; }
.codes tbody tr { transition: background-color 0.12s ease; }
.codes tbody tr:hover { background: var(--rb-surface-hover); }
.c-code { width: 130px; }
.c-uses { width: 90px; font-variant-numeric: tabular-nums; }
.c-status { width: 120px; }

.row--retired .code, .row--retired .reason { color: var(--rb-text-secondary); }
.row--editing { background: rgba(var(--rb-primary-rgb), 0.04); }
.row--editing td { vertical-align: top; }
.row--new { background: rgba(var(--rb-success-rgb), 0.06); }

.right { text-align: right; }
.reason { line-height: 1.45; }
.reason__sub { display: block; margin-top: 1px; font-size: 11.5px; color: var(--rb-text-secondary); }
.code {
  display: inline-block;
  padding: 2px 7px;
  border-radius: 6px;
  background: var(--rb-surface-alt);
  border: 1px solid var(--rb-border);
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.04em;
  font-variant-numeric: tabular-nums;
}
.empty { padding: 32px 16px; text-align: center; color: var(--rb-text-secondary); }

/* status: the app's dot style */
.badge { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; white-space: nowrap; }
.badge__dot { width: 7px; height: 7px; border-radius: 999px; background: currentColor; }
.badge--ok { color: var(--rb-success-text); }
.badge--neutral { color: var(--rb-text-secondary); }

.row-actions { display: inline-flex; align-items: center; gap: 6px; }

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 38px;
  padding: 0 16px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}
.btn:hover:not(:disabled) { background: var(--rb-surface-hover); border-color: var(--rb-border-hover); }
.btn:disabled { opacity: 0.45; cursor: not-allowed; }
.btn:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: 2px; }
.btn--sm { height: 32px; padding: 0 14px; font-size: 12.5px; }
.btn--ghost { border-color: transparent; background: transparent; color: var(--rb-text-secondary); }
.btn--ghost:hover:not(:disabled) { color: var(--rb-text-primary); }
.btn--primary { background: var(--rb-primary); border-color: var(--rb-primary); color: #fff; }
.btn--primary:hover:not(:disabled) { background: #0D47A1; border-color: #0D47A1; }

.footnote {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  margin: 0;
  max-width: 90ch;
  font-size: 12px;
  line-height: 1.5;
  color: var(--rb-text-secondary);
}
.footnote :deep(svg) { flex-shrink: 0; margin-top: 2px; }

.skeleton {
  display: block;
  border-radius: 6px;
  background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 37%, var(--rb-skeleton-a) 63%);
  background-size: 400% 100%;
  animation: codes-shimmer 1.4s ease infinite;
}
.skeleton--code { width: 44px; height: 20px; }
.skeleton--text { width: 55%; height: 12px; }
.skeleton--num { width: 24px; height: 12px; }
.skeleton--pill { width: 70px; height: 14px; }
@keyframes codes-shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}

.spin { animation: codes-spin 0.9s linear infinite; }
@keyframes codes-spin { to { transform: rotate(360deg); } }

.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

@media (max-width: 720px) {
  .add__fields { grid-template-columns: 1fr; }
  .codes thead { display: none; }
  .codes, .codes tbody, .codes tr, .codes td { display: block; width: 100%; }
  .codes tr { padding: 10px 14px; border-bottom: 1px solid var(--rb-border); }
  .codes td { padding: 3px 0; border: 0; }
  .c-code, .c-uses, .c-status { width: auto; }
  .c-uses::before { content: 'Records: '; color: var(--rb-text-secondary); }
  .right { text-align: left; padding-top: 8px; }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton, .spin { animation: none; }
}
</style>
