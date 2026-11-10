<template>
  <div class="disc-page">
    <header class="disc-page__header">
      <h1 class="disc-page__title">Discounts</h1>

      <div class="header-actions">
        <button type="button" class="btn btn--ghost" :disabled="busy" @click="load">
          <AssetIcon name="refresh-cw" :size="14" :class="{ spin: busy }" />
          {{ busy ? 'Loading…' : 'Refresh' }}
        </button>
        <button v-if="!adding" type="button" class="btn btn--primary" @click="openAdd">
          <AssetIcon name="plus" :size="14" />
          Add discount
        </button>
      </div>
    </header>

    <div v-if="banner" class="alert" :class="`alert--${bannerKind}`" role="status">
      <AssetIcon :name="bannerKind === 'success' ? 'circle-check-big' : 'circle-alert'" :size="16" />
      <span>{{ banner }}</span>
    </div>

    <form v-if="adding" class="card add" novalidate @submit.prevent="submitAdd">
      <h2 class="add__title">Add a discount</h2>

      <div class="add__fields">
        <label class="field">
          <span class="field__label">Name</span>
          <input
            ref="nameInput"
            v-model="addForm.name"
            type="text"
            maxlength="100"
            placeholder="e.g. Senior Citizen"
            class="text-input"
            :class="{ 'text-input--invalid': addErrors.name }"
            required
          >
          <em v-if="addErrors.name" class="field__error">{{ addErrors.name }}</em>
        </label>

        <div class="field">
          <span id="add-kind" class="field__label">Type</span>
          <div class="kind" role="radiogroup" aria-labelledby="add-kind">
            <button
              v-for="kind in KINDS"
              :key="kind.value"
              type="button"
              role="radio"
              class="kind__option"
              :class="{ 'kind__option--on': addForm.kind === kind.value }"
              :aria-checked="addForm.kind === kind.value"
              @click="addForm.kind = kind.value"
            >
              {{ kind.label }}
            </button>
          </div>
          <em v-if="addErrors.kind" class="field__error">{{ addErrors.kind }}</em>
        </div>

        <label class="field">
          <span class="field__label">{{ addForm.kind === 'percentage' ? 'Percent off' : 'Amount off' }}</span>
          <span class="amount" :class="`amount--${addForm.kind}`">
            <span v-if="addForm.kind === 'fixed'" class="amount__unit" aria-hidden="true">₱</span>
            <input
              v-model="addForm.value"
              type="number"
              inputmode="decimal"
              min="0.01"
              :max="addForm.kind === 'percentage' ? 100 : 1000000"
              step="0.01"
              class="text-input amount__input"
              :class="{ 'text-input--invalid': addErrors.value }"
              required
            >
            <span v-if="addForm.kind === 'percentage'" class="amount__unit" aria-hidden="true">%</span>
          </span>
          <em v-if="addErrors.value" class="field__error">{{ addErrors.value }}</em>
        </label>
      </div>

      <div class="add__actions">
        <button type="button" class="btn btn--ghost" :disabled="addSaving" @click="adding = false">Cancel</button>
        <button type="submit" class="btn btn--primary" :disabled="addSaving || !canSubmitAdd">
          {{ addSaving ? 'Adding…' : 'Add discount' }}
        </button>
      </div>
    </form>

    <section class="card">
      <table class="discounts">
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col" class="c-amount">Discount</th>
            <th scope="col" class="c-status">Status</th>
            <th scope="col" class="right"><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <template v-if="busy && !rows.length">
            <tr v-for="n in 3" :key="`sk-${n}`">
              <td><span class="skeleton skeleton--text" /></td>
              <td><span class="skeleton skeleton--num" /></td>
              <td><span class="skeleton skeleton--pill" /></td>
              <td />
            </tr>
          </template>
          <tr v-else-if="!rows.length">
            <td colspan="4" class="empty">No discounts yet.</td>
          </tr>
          <tr
            v-for="row in rows"
            v-else
            :key="row.id"
            :class="{ 'row--off': !row.is_active, 'row--editing': editing?.id === row.id }"
          >
            <template v-if="editing?.id === row.id">
              <td>
                <label class="sr-only" :for="`name-${row.id}`">Name</label>
                <input
                  :id="`name-${row.id}`"
                  v-model="editing.name"
                  type="text"
                  maxlength="100"
                  class="text-input text-input--cell"
                  :class="{ 'text-input--invalid': editErrors.name }"
                >
                <em v-if="editErrors.name" class="field__error">{{ editErrors.name }}</em>
              </td>
              <td class="c-amount">
                <div class="edit-amount">
                  <div class="kind kind--sm" role="radiogroup" :aria-label="`Type of ${row.name}`">
                    <button
                      v-for="kind in KINDS"
                      :key="kind.value"
                      type="button"
                      role="radio"
                      class="kind__option"
                      :class="{ 'kind__option--on': editing.kind === kind.value }"
                      :aria-checked="editing.kind === kind.value"
                      @click="editing.kind = kind.value"
                    >
                      {{ kind.short }}
                    </button>
                  </div>
                  <label class="sr-only" :for="`value-${row.id}`">{{ editing.kind === 'percentage' ? 'Percent off' : 'Amount off' }}</label>
                  <input
                    :id="`value-${row.id}`"
                    v-model="editing.value"
                    type="number"
                    inputmode="decimal"
                    min="0.01"
                    :max="editing.kind === 'percentage' ? 100 : 1000000"
                    step="0.01"
                    class="text-input text-input--cell text-input--num"
                    :class="{ 'text-input--invalid': editErrors.value }"
                  >
                </div>
                <em v-if="editErrors.value" class="field__error">{{ editErrors.value }}</em>
              </td>
            </template>
            <template v-else>
              <td class="name">{{ row.name }}</td>
              <td class="c-amount">{{ row.label }}</td>
            </template>

            <td class="c-status">
              <span class="badge" :class="row.is_active ? 'badge--ok' : 'badge--neutral'">
                <span class="badge__dot" aria-hidden="true" />
                {{ row.is_active ? 'On' : 'Off' }}
              </span>
            </td>

            <td class="right">
              <div class="row-actions">
                <template v-if="editing?.id === row.id">
                  <button type="button" class="btn btn--ghost btn--sm" :disabled="savingId === row.id" @click="cancelEdit">Cancel</button>
                  <button type="button" class="btn btn--primary btn--sm" :disabled="savingId === row.id || !editDirty" @click="saveEdit(row)">
                    {{ savingId === row.id ? 'Saving…' : 'Save' }}
                  </button>
                </template>
                <template v-else>
                  <button type="button" class="btn btn--ghost btn--sm" :disabled="savingId === row.id" @click="startEdit(row)">Edit</button>
                  <button type="button" class="btn btn--sm" :disabled="savingId === row.id" @click="toggleActive(row)">
                    {{ row.is_active ? 'Turn off' : 'Turn on' }}
                  </button>
                </template>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import { onPageReturn } from '~/composables/useKeptAlive'

/**
 * The centre's own discounts (project owner, 2026-11-10; they replaced the
 * dated Billing Programs).
 *
 * Billing keeps the list (billing.prices); the counter offers the ones that
 * are on, beside the government subsidy, and whoever takes payments applies
 * one with a note. A discount is turned off rather than deleted: a bill it
 * was given to keeps its own copy, so neither an edit nor turning it off
 * changes a bill already discounted.
 *
 * GET  /blood-center/billing-discounts            → { data: [{ id, name, kind, value, is_active, label, updated_at, updated_by }] }
 * POST /blood-center/billing-discounts            { name, kind: percentage|fixed, value }
 * PUT  /blood-center/billing-discounts/{id}       { name, kind, value, is_active }
 */

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  requires: 'billing.prices',
  keepalive: true,
})

useHead({ title: 'Discounts · RedAgos' })

const KINDS = [
  { value: 'percentage', label: 'Percent', short: '%' },
  { value: 'fixed', label: 'Fixed amount', short: '₱' },
]

const rows = ref([])
const busy = ref(false)
const banner = ref('')
const bannerKind = ref('success')

function firstError(err, fallback) {
  return err?.data?.message || Object.values(err?.errors ?? {}).flat()[0] || err?.message || fallback
}

/** The server's field errors, one message per field. */
function fieldErrors(err) {
  if (err?.status !== 422 || !err?.errors) return null

  return Object.fromEntries(Object.entries(err.errors).map(([field, messages]) => [field, [messages].flat()[0]]))
}

function clear(errors) {
  Object.keys(errors).forEach((key) => delete errors[key])
}

async function load() {
  busy.value = true

  try {
    rows.value = (await bloodCenterService.billingDiscounts())?.data ?? []
  } catch (err) {
    bannerKind.value = 'error'
    banner.value = firstError(err, 'The discounts could not be loaded.')
  } finally {
    busy.value = false
  }
}

/* --- Adding --- */

const adding = ref(false)
const addSaving = ref(false)
const nameInput = ref(null)
const addForm = reactive({ name: '', kind: 'percentage', value: '' })
const addErrors = reactive({})

const canSubmitAdd = computed(() => addForm.name.trim().length >= 2 && Number(addForm.value) > 0)

async function openAdd() {
  Object.assign(addForm, { name: '', kind: 'percentage', value: '' })
  clear(addErrors)
  banner.value = ''
  adding.value = true
  await nextTick()
  nameInput.value?.focus()
}

async function submitAdd() {
  clear(addErrors)
  addSaving.value = true

  try {
    const res = await bloodCenterService.createBillingDiscount({
      name: addForm.name.trim(),
      kind: addForm.kind,
      value: Number(addForm.value),
    })
    adding.value = false
    bannerKind.value = 'success'
    banner.value = res?.message || 'Discount added.'
    await load()
  } catch (err) {
    const errors = fieldErrors(err)

    if (errors) {
      Object.assign(addErrors, errors)
    } else {
      bannerKind.value = 'error'
      banner.value = firstError(err, 'The discount could not be added.')
    }
  } finally {
    addSaving.value = false
  }
}

/* --- Editing and turning on or off --- */

const editing = ref(null)
const editErrors = reactive({})
const savingId = ref(null)

const editDirty = computed(() => {
  const row = rows.value.find((r) => r.id === editing.value?.id)
  if (!row || !editing.value) return false

  return editing.value.name.trim() !== row.name
    || editing.value.kind !== row.kind
    || Number(editing.value.value) !== Number(row.value)
})

function startEdit(row) {
  clear(editErrors)
  banner.value = ''
  editing.value = { id: row.id, name: row.name, kind: row.kind, value: row.value }
}

function cancelEdit() {
  editing.value = null
}

async function save(row, changes, fallback) {
  savingId.value = row.id
  clear(editErrors)
  banner.value = ''

  try {
    const res = await bloodCenterService.updateBillingDiscount(row.id, {
      name: row.name,
      kind: row.kind,
      value: Number(row.value),
      is_active: row.is_active,
      ...changes,
    })
    if (res?.data) rows.value = rows.value.map((r) => (r.id === row.id ? res.data : r))
    editing.value = null
    bannerKind.value = 'success'
    banner.value = res?.message || 'Saved.'
  } catch (err) {
    const errors = fieldErrors(err)

    if (errors && editing.value?.id === row.id) {
      Object.assign(editErrors, errors)
    } else {
      bannerKind.value = 'error'
      banner.value = firstError(err, fallback)
    }
  } finally {
    savingId.value = null
  }
}

function saveEdit(row) {
  return save(row, {
    name: editing.value.name.trim(),
    kind: editing.value.kind,
    value: Number(editing.value.value),
  }, 'The discount could not be saved.')
}

function toggleActive(row) {
  return save(row, { is_active: !row.is_active }, 'The discount could not be changed.')
}

onMounted(load)

// Kept alive: back here, the list reloads, unless a discount is being added or edited.
onPageReturn(() => {
  if (!adding.value && !editing.value) load()
})
</script>

<style scoped>
.disc-page {
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

.disc-page__header { display: flex; gap: 16px; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; }
.disc-page__title { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }
.header-actions { display: flex; align-items: center; gap: 8px; }

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
.add__title { margin: 0; font-size: 14px; font-weight: 700; }
.add__fields { display: grid; grid-template-columns: minmax(220px, 1fr) auto 180px; gap: 12px; align-items: start; }
.add__actions { display: flex; justify-content: flex-end; gap: 8px; }

.field { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.field__label { font-size: 12px; font-weight: 600; color: var(--rb-text-primary); }
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
.text-input::placeholder { color: var(--rb-placeholder); }
.text-input--cell { height: 32px; }
.text-input--num { width: 110px; font-variant-numeric: tabular-nums; }
.text-input--invalid { border-color: var(--rb-accent); }

/* percent or fixed */
.kind { display: inline-flex; padding: 3px; gap: 3px; border: 1px solid var(--rb-border-strong); border-radius: 10px; background: var(--rb-surface-alt); }
.kind__option {
  height: 28px;
  padding: 0 12px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--rb-text-secondary);
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}
.kind__option--on { background: var(--rb-surface); color: var(--rb-text-primary); box-shadow: 0 1px 2px rgba(var(--rb-shadow-rgb), 0.12); }
.kind__option:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: 1px; }
.kind--sm .kind__option { height: 24px; padding: 0 9px; }

.amount { position: relative; display: flex; align-items: center; }
.amount__unit { position: absolute; font-size: 13px; font-weight: 600; color: var(--rb-text-secondary); pointer-events: none; }
.amount--fixed .amount__unit { left: 11px; }
.amount--fixed .amount__input { padding-left: 26px; }
.amount--percentage .amount__unit { right: 11px; }
.amount--percentage .amount__input { padding-right: 28px; }
.amount__input { font-variant-numeric: tabular-nums; }

.edit-amount { display: flex; align-items: center; gap: 8px; }

/* table */
.discounts { width: 100%; border-collapse: collapse; font-size: 13px; }
.discounts th {
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
.discounts td { padding: 10px 16px; border-bottom: 1px solid var(--rb-border); vertical-align: middle; }
.discounts tr:last-child td { border-bottom: 0; }
.discounts tbody tr { transition: background-color 0.12s ease; }
.discounts tbody tr:hover { background: var(--rb-surface-hover); }
.c-amount { width: 260px; font-variant-numeric: tabular-nums; }
.c-status { width: 110px; }
.name { font-weight: 600; }

.row--off .name, .row--off .c-amount { color: var(--rb-text-secondary); }
.row--editing { background: rgba(var(--rb-primary-rgb), 0.04); }
.row--editing td { vertical-align: top; }

.right { text-align: right; }
.empty { padding: 32px 16px; text-align: center; color: var(--rb-text-secondary); }

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

.skeleton {
  display: block;
  border-radius: 6px;
  background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 37%, var(--rb-skeleton-a) 63%);
  background-size: 400% 100%;
  animation: disc-shimmer 1.4s ease infinite;
}
.skeleton--text { width: 40%; height: 12px; }
.skeleton--num { width: 64px; height: 12px; }
.skeleton--pill { width: 44px; height: 14px; }
@keyframes disc-shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}

.spin { animation: disc-spin 0.9s linear infinite; }
@keyframes disc-spin { to { transform: rotate(360deg); } }

.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

@media (max-width: 720px) {
  .add__fields { grid-template-columns: 1fr; }
  .discounts thead { display: none; }
  .discounts, .discounts tbody, .discounts tr, .discounts td { display: block; width: 100%; }
  .discounts tr { padding: 10px 14px; border-bottom: 1px solid var(--rb-border); }
  .discounts td { padding: 3px 0; border: 0; }
  .c-amount, .c-status { width: auto; }
  .right { text-align: left; padding-top: 8px; }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton, .spin { animation: none; }
}
</style>
