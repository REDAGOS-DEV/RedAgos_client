<template>
  <div class="components-page">
    <header class="components-page__header">
      <div>
        <h1 class="components-page__title">Blood Components</h1>
      </div>

      <div class="header-actions">
        <button v-if="!howOpen" type="button" class="how-link" @click="setHow(true)">
          <AssetIcon name="help-circle" :size="14" />
          How shelf life is used
        </button>
        <button type="button" class="btn btn--ghost" :disabled="busy" @click="load">
          <AssetIcon name="refresh-cw" :size="14" :class="{ spin: busy }" />
          {{ busy ? 'Loading…' : 'Refresh' }}
        </button>
        <button v-if="!adding" type="button" class="btn btn--primary" @click="openAdd">
          <AssetIcon name="plus" :size="14" />
          Add component
        </button>
      </div>
    </header>

    <!-- How shelf life is used: a small card, put away once read (2026-10-28). -->
    <aside v-if="howOpen" class="how" aria-labelledby="how-title">
      <span class="how__icon" aria-hidden="true"><AssetIcon name="info" :size="16" /></span>
      <div class="how__body">
        <p id="how-title" class="how__title">How shelf life is used</p>
        <p class="how__text">
          Every unit's expiry date comes from its component's shelf life, so a component without one cannot be booked
          into stock: stock intake refuses it rather than guessing. Shelf life is set for
          <strong>{{ facilityName || 'this centre' }}</strong> only; other centres set their own. Prices are set by
          Billing, under Component Prices.
        </p>
      </div>
      <button type="button" class="icon-btn" aria-label="Hide how shelf life is used" @click="setHow(false)">
        <AssetIcon name="x" :size="15" />
      </button>
    </aside>

    <div v-if="banner" class="alert" :class="`alert--${bannerKind}`" role="status">
      <AssetIcon :name="bannerKind === 'success' ? 'circle-check-big' : bannerKind === 'error' ? 'circle-alert' : 'info'" :size="16" />
      <span>{{ banner }}</span>
    </div>

    <!-- Add a component: it joins the catalogue every centre shares. -->
    <form v-if="adding" class="card add" novalidate @submit.prevent="submitAdd">
      <div class="add__head">
        <h2 class="add__title">Add a component</h2>
        <p class="add__note">
          <AssetIcon name="info" :size="13" />
          Every centre and every hospital's request form will list it. Other centres see it as not configured until they
          set their own shelf life.
        </p>
      </div>

      <div class="add__body">
        <div class="add__fields">
          <label class="field field--name">
            <span class="field__label">Name</span>
            <input
              ref="nameInput"
              v-model="addForm.name"
              type="text"
              maxlength="150"
              placeholder="e.g. Leukoreduced Packed RBC"
              class="text-input"
              :class="{ 'text-input--invalid': addErrors.name }"
              required
            >
            <em v-if="addErrors.name" class="field__error">{{ addErrors.name }}</em>
          </label>

          <label class="field field--code">
            <span class="field__label">Bag code</span>
            <input
              v-model="addForm.code"
              type="text"
              maxlength="10"
              placeholder="e.g. LPRBC"
              class="text-input text-input--code"
              :class="{ 'text-input--invalid': addErrors.code }"
              autocapitalize="characters"
              spellcheck="false"
              required
            >
            <em v-if="addErrors.code" class="field__error">{{ addErrors.code }}</em>
          </label>

          <label class="field field--temp">
            <span class="field__label">Storage <i>optional</i></span>
            <input
              v-model="addForm.storage_temperature"
              type="text"
              maxlength="50"
              placeholder="e.g. 1–6 °C"
              class="text-input"
              :class="{ 'text-input--invalid': addErrors.storage_temperature }"
            >
            <em v-if="addErrors.storage_temperature" class="field__error">{{ addErrors.storage_temperature }}</em>
          </label>

          <label class="field field--days">
            <span class="field__label">Shelf life <i>optional</i></span>
            <span class="input-group" :class="{ 'input-group--invalid': addErrors.shelf_life_days }">
              <input
                v-model="addForm.shelf_life_days"
                type="number"
                min="1"
                max="3650"
                placeholder="Not set"
                class="cell-input"
              >
              <span class="input-group__suffix">days</span>
            </span>
            <em v-if="addErrors.shelf_life_days" class="field__error">{{ addErrors.shelf_life_days }}</em>
          </label>

          <!-- The usual storage ranges, one click into the field (2026-10-28). -->
          <div class="presets" role="group" aria-label="Common storage">
            <span class="presets__label">Common storage</span>
            <button
              v-for="preset in STORAGE_PRESETS"
              :key="preset"
              type="button"
              class="storage storage--btn"
              :class="[`storage--${storageKind(preset)}`, { 'storage--on': addForm.storage_temperature.trim() === preset }]"
              :aria-pressed="addForm.storage_temperature.trim() === preset"
              @click="addForm.storage_temperature = preset"
            >
              <AssetIcon :name="STORAGE_ICONS[storageKind(preset)]" :size="12" />
              {{ preset }}
            </button>
          </div>
        </div>

        <!-- How the bag's label will read, as it is filled in. -->
        <div class="label-preview" aria-live="polite">
          <p class="label-preview__caption">On the bag label <i>sample number</i></p>
          <div class="label-preview__card">
            <span class="label-preview__code">
              <span class="label-preview__sample" title="A sample bag number">1234567</span>-<span :class="{ 'label-preview__empty': !addForm.code.trim() }">{{ codePreview }}</span>
            </span>
            <span class="label-preview__name" :class="{ 'label-preview__empty': !addForm.name.trim() }">{{ addForm.name.trim() || 'Component name' }}</span>
            <span class="label-preview__meta">
              <span v-if="addForm.storage_temperature.trim()" class="storage" :class="`storage--${storageKind(addForm.storage_temperature)}`">
                <AssetIcon :name="STORAGE_ICONS[storageKind(addForm.storage_temperature)]" :size="12" />
                {{ addForm.storage_temperature.trim() }}
              </span>
              <span v-if="addForm.shelf_life_days">Keeps {{ readableDays(addForm.shelf_life_days) }}</span>
            </span>
          </div>
        </div>
      </div>

      <div class="add__actions">
        <span v-if="!canSubmitAdd" class="add__missing">{{ addMissing }}</span>
        <button type="button" class="btn btn--ghost" :disabled="addSaving" @click="closeAdd">Cancel</button>
        <button type="submit" class="btn btn--primary" :disabled="addSaving || !canSubmitAdd">
          {{ addSaving ? 'Adding…' : 'Add component' }}
        </button>
      </div>
    </form>

    <!-- One place that says what is missing: the chips, which also filter (2026-10-28). -->
    <div v-if="rows.length" class="tally" role="group" aria-label="Show components">
      <button type="button" class="tally__chip" :class="{ 'tally__chip--on': filter === 'all' }" :aria-pressed="filter === 'all'" @click="filter = 'all'">
        All
        <span class="tally__count">{{ rows.length }}</span>
      </button>
      <button
        type="button"
        class="tally__chip tally__chip--warn"
        :class="{ 'tally__chip--on': filter === 'unset' }"
        :aria-pressed="filter === 'unset'"
        :disabled="!unsetCount && filter !== 'unset'"
        @click="filter = filter === 'unset' ? 'all' : 'unset'"
      >
        <AssetIcon name="circle-alert" :size="13" />
        Shelf life needed
        <span class="tally__count">{{ unsetCount }}</span>
      </button>
      <span v-if="!howOpen" class="scope">
        <AssetIcon name="building-2" :size="13" />
        Shelf life for <strong>{{ facilityName || 'this centre' }}</strong> only
      </span>
    </div>

    <p v-if="unsetCount" class="hint-line">
      <AssetIcon name="circle-alert" :size="14" />
      {{ unsetCount }} component{{ unsetCount === 1 ? ' has' : 's have' }} no shelf life, so {{ unsetCount === 1 ? 'it' : 'they' }} cannot be booked into your stock.
    </p>

    <section class="card">
      <table class="components">
        <thead>
          <tr>
            <th>Component</th>
            <th>Storage</th>
            <th>Shelf life</th>
            <th class="right"><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <template v-if="busy && !rows.length">
            <tr v-for="n in 4" :key="`sk-${n}`" class="row--skeleton">
              <td><span class="skeleton skeleton--name" /></td>
              <td><span class="skeleton skeleton--code" /></td>
              <td><span class="skeleton skeleton--input" /></td>
              <td />
            </tr>
          </template>
          <tr v-else-if="!rows.length">
            <td colspan="4" class="empty">No blood components are defined.</td>
          </tr>
          <tr v-else-if="!shownRows.length">
            <td colspan="4" class="empty">
              Every component has a shelf life.
              <button type="button" class="link-btn" @click="filter = 'all'">Show all</button>
            </td>
          </tr>
          <tr
            v-for="row in shownRows"
            v-else
            :key="row.id"
            :class="{ 'row--dirty': isDirty(row), 'row--new': row.id === justAddedId }"
          >
            <td class="name">
              <span class="name__line">
                <span class="swatch" :class="`comp--${componentTone(row.name)}`" aria-hidden="true" />
                {{ row.name }}
                <span class="code">{{ row.code }}</span>
              </span>
            </td>
            <td>
              <span v-if="row.storage_temperature" class="storage" :class="`storage--${storageKind(row.storage_temperature)}`">
                <AssetIcon :name="STORAGE_ICONS[storageKind(row.storage_temperature)]" :size="13" />
                {{ row.storage_temperature }}
              </span>
              <span v-else class="muted">—</span>
            </td>
            <td>
              <div class="life">
                <label class="input-group" :class="{ 'input-group--unset': !row.shelf_life_configured && !drafts[row.id].shelf_life_days }">
                  <span class="sr-only">{{ row.name }} shelf life in days</span>
                  <input
                    v-model="drafts[row.id].shelf_life_days"
                    type="number"
                    min="1"
                    max="3650"
                    placeholder="Not set"
                    class="cell-input"
                  >
                  <span class="input-group__suffix">days</span>
                </label>
                <span v-if="drafts[row.id].shelf_life_days" class="life__readable">≈ {{ readableDays(drafts[row.id].shelf_life_days) }}</span>
                <span v-else class="life__unset">
                  <AssetIcon name="circle-alert" :size="12" />
                  Shelf life needed
                </span>
              </div>
            </td>
            <td class="right">
              <div v-if="isDirty(row)" class="row-actions">
                <!-- Undo puts the field back to what is saved; nothing is sent. -->
                <button
                  type="button"
                  class="btn btn--ghost btn--sm"
                  :disabled="savingId === row.id"
                  @click="seedDraft(row)"
                >
                  Undo
                </button>
                <button
                  type="button"
                  class="btn btn--primary btn--sm"
                  :disabled="savingId === row.id || !isDirty(row)"
                  @click="save(row)"
                >
                  {{ savingId === row.id ? 'Saving…' : 'Save' }}
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- Save within reach while changes are pending, as on Component Prices. -->
    <Transition name="savebar">
      <div v-if="dirtyRows.length" class="savebar" role="region" aria-label="Unsaved changes">
        <span class="savebar__text">
          <AssetIcon name="pencil" :size="14" />
          {{ dirtyRows.length }} {{ dirtyRows.length === 1 ? 'change' : 'changes' }} not saved
        </span>
        <button type="button" class="btn btn--ghost" :disabled="savingAll" @click="discardAll">Discard</button>
        <button type="button" class="btn btn--primary" :disabled="savingAll" @click="saveAll">
          <AssetIcon name="check" :size="14" />
          {{ savingAll ? 'Saving…' : 'Save changes' }}
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'

/**
 * Processing's components: the shared catalogue, and this centre's shelf life for each.
 *
 * The shelf life is held per facility rather than on the shared
 * `blood_components` row: four facilities share that row, so a value written
 * there would decide another centre's expiry dates. Adding a component, by
 * contrast, adds to that shared row on purpose: every centre and every
 * hospital's request form sees it.
 *
 * The Component Technologist's (`components.configure`). The price on the
 * same settings row is Billing's and is set on Component Prices.
 */

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  requires: 'components.configure',
})

useHead({ title: 'Blood Components · RedAgos' })

const rows = ref([])
const drafts = reactive({})
const facilityName = ref('')
const busy = ref(false)
const savingId = ref(null)
const banner = ref('')
const bannerKind = ref('notice')

// ── What is still unset, as a filter (2026-10-28) ──
const unsetCount = computed(() => rows.value.filter((row) => !row.shelf_life_configured).length)
const filter = ref('all')
const shownRows = computed(() => (filter.value === 'unset' ? rows.value.filter((row) => !row.shelf_life_configured) : rows.value))
const dirtyRows = computed(() => rows.value.filter(isDirty))

// ── Saving every changed row at once, from the save bar ──
const savingAll = ref(false)
async function saveAll() {
  savingAll.value = true
  const names = []
  for (const row of [...dirtyRows.value]) {
    await save(row)
    if (bannerKind.value === 'error') break
    names.push(row.name)
  }
  savingAll.value = false
  if (bannerKind.value !== 'error' && names.length > 1) {
    banner.value = `${names.length} components updated.`
  }
}
function discardAll() {
  rows.value.forEach(seedDraft)
}

// ── Reading a component at a glance ──
/** Frozen, refrigerated or room temperature, read from the storage text. */
function storageKind(text) {
  const t = String(text ?? '')
  // A minus sign that starts a number ("-18", "≤ −25"), not the hyphen of a range ("1-6").
  if (/(^|[\s≤<(])[-−]\s*\d|below|frozen|freez/i.test(t)) return 'frozen'
  const n = Number((t.match(/\d+/) ?? [])[0])
  if (Number.isFinite(n) && n >= 15) return 'room'
  return 'cold'
}
const STORAGE_ICONS = { frozen: 'snowflake', cold: 'thermometer', room: 'sun' }

/** 365 days reads "1 year", 35 "5 weeks", 5 "5 days". */
function readableDays(value) {
  const days = Number(value)
  if (!Number.isFinite(days) || days <= 0) return ''
  const plural = (n, unit) => `${n} ${unit}${n === 1 ? '' : 's'}`
  if (days >= 365 && days % 365 === 0) return plural(days / 365, 'year')
  if (days >= 60) return plural(Math.round(days / 30), 'month')
  if (days >= 14 && days % 7 === 0) return plural(days / 7, 'week')
  return plural(days, 'day')
}

/** Each component's colour, as on the Processing pages. */
function componentTone(name) {
  const n = String(name).toLowerCase()
  if (n.includes('red') || n.includes('rbc') || n.includes('whole')) return 'red'
  if (n.includes('cryo')) return 'blue'
  if (n.includes('plasma')) return 'amber'
  if (n.includes('platelet')) return 'purple'
  return 'grey'
}

// How shelf life is used: put away once read, remembered on this browser.
const HOW_KEY = 'rb.components.how'
const howOpen = ref(true)
function setHow(open) {
  howOpen.value = open
  try { localStorage.setItem(HOW_KEY, open ? '1' : '0') } catch { /* private window: shown again next time */ }
}
onMounted(() => {
  try { howOpen.value = localStorage.getItem(HOW_KEY) !== '0' } catch { /* keep it shown */ }
})

function seedDraft(row) {
  drafts[row.id] = { shelf_life_days: row.shelf_life_days ?? '' }
}

/**
 * Saving an unchanged row would write an audit entry recording no change, so
 * the button stays disabled until something actually differs.
 */
function isDirty(row) {
  const draft = drafts[row.id]

  if (!draft) return false

  const days = draft.shelf_life_days === '' ? null : Number(draft.shelf_life_days)

  return days !== row.shelf_life_days
}

function firstError(err, fallback) {
  return err?.data?.message
    || Object.values(err?.data?.errors ?? err?.errors ?? {}).flat()[0]
    || err?.message
    || fallback
}

async function load() {
  busy.value = true
  banner.value = ''

  try {
    const res = await bloodCenterService.componentSettings()

    rows.value = res?.data ?? []
    rows.value.forEach(seedDraft)
    facilityName.value = res?.meta?.facility?.name ?? ''
    // What is still unset is said by the chips and one amber line (2026-10-28).
  } catch (err) {
    bannerKind.value = 'error'
    banner.value = firstError(err, 'The components could not be loaded.')
  } finally {
    busy.value = false
  }
}

async function save(row) {
  const draft = drafts[row.id]

  savingId.value = row.id
  banner.value = ''

  try {
    const res = await bloodCenterService.updateComponentSetting(row.id, {
      // An empty field is null, not 0: null means "not configured", which the
      // server accepts and stock intake then refuses on.
      shelf_life_days: draft.shelf_life_days === '' ? null : Number(draft.shelf_life_days),
    })

    const updated = res?.data

    if (updated) {
      const index = rows.value.findIndex((r) => r.id === row.id)

      if (index !== -1) rows.value[index] = updated
      seedDraft(updated)
    }

    bannerKind.value = 'success'
    banner.value = res?.message || `${row.name} updated.`
  } catch (err) {
    bannerKind.value = 'error'
    banner.value = firstError(err, 'The shelf life could not be saved.')
  } finally {
    savingId.value = null
  }
}

/* --- Adding a component --- */

const adding = ref(false)
const addSaving = ref(false)
const nameInput = ref(null)
const justAddedId = ref(null)
const addErrors = reactive({})

function blankAdd() {
  return { name: '', code: '', storage_temperature: '', shelf_life_days: '' }
}

const addForm = reactive(blankAdd())

// The server stores the code in capitals; show it the way it will print.
const codePreview = computed(() => addForm.code.trim().toUpperCase() || 'CODE')
const canSubmitAdd = computed(() => addForm.name.trim().length >= 2 && addForm.code.trim() !== '')
// What still stands in the way of adding, said beside the button.
const addMissing = computed(() => {
  const name = addForm.name.trim().length >= 2
  const code = addForm.code.trim() !== ''
  if (!name && !code) return 'Add a name and a bag code to continue.'
  return !name ? 'Add a name to continue.' : 'Add a bag code to continue.'
})
const STORAGE_PRESETS = ['≤ -18 °C', '1–6 °C', '20–24 °C, agitated']

function clearAddErrors() {
  Object.keys(addErrors).forEach((key) => delete addErrors[key])
}

async function openAdd() {
  Object.assign(addForm, blankAdd())
  clearAddErrors()
  adding.value = true
  await nextTick()
  nameInput.value?.focus()
}

function closeAdd() {
  adding.value = false
}

async function submitAdd() {
  addSaving.value = true
  clearAddErrors()
  banner.value = ''

  try {
    const res = await bloodCenterService.addComponent({
      name: addForm.name.trim(),
      code: addForm.code.trim(),
      storage_temperature: addForm.storage_temperature.trim() || null,
      shelf_life_days: addForm.shelf_life_days === '' ? null : Number(addForm.shelf_life_days),
    })

    const added = res?.data

    if (added) {
      // Into its place in the name order the server lists by.
      rows.value = [...rows.value, added].sort((a, b) => a.name.localeCompare(b.name))
      seedDraft(added)
      justAddedId.value = added.id
    }

    adding.value = false
    bannerKind.value = 'success'
    banner.value = res?.message || `${addForm.name.trim()} added.`
  } catch (err) {
    const fieldErrors = err?.data?.errors ?? err?.errors

    if (fieldErrors) {
      for (const [field, messages] of Object.entries(fieldErrors)) {
        addErrors[field] = Array.isArray(messages) ? messages[0] : messages
      }
    } else {
      bannerKind.value = 'error'
      banner.value = firstError(err, 'The component could not be added.')
    }
  } finally {
    addSaving.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.components-page {
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

.components-page__header { display: flex; gap: 16px; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; }
.components-page__title { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }
.header-actions { display: flex; align-items: center; gap: 8px; }

/* scope + progress */
.scope { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.scope__item { display: inline-flex; align-items: center; gap: 7px; font-size: 12.5px; color: var(--rb-text-secondary); }
.scope__item strong { color: var(--rb-text-primary); }
.scope__progress {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 11px;
  border-radius: 999px;
  background: rgba(var(--rb-warning-rgb), 0.12);
  color: var(--rb-warning-text);
  font-size: 12px;
  font-weight: 700;
}
.scope__progress--done { background: rgba(var(--rb-success-rgb), 0.12); color: var(--rb-success-text); }

/* alerts */
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
.add__fields {
  display: grid;
  grid-template-columns: minmax(200px, 2fr) minmax(130px, 1fr) minmax(130px, 1fr) 170px;
  gap: 12px;
  align-items: start;
}
.add__actions { display: flex; justify-content: flex-end; gap: 8px; }

.field { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.field__label { font-size: 12px; font-weight: 600; color: var(--rb-text-primary); }
.field__label i { font-style: normal; font-weight: 500; color: var(--rb-text-secondary); }
.field__hint { font-size: 11.5px; color: var(--rb-text-secondary); font-variant-numeric: tabular-nums; }
.field__error { font-size: 11.5px; font-style: normal; color: var(--rb-accent-text); }

.text-input {
  height: 36px;
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
.text-input--code { text-transform: uppercase; letter-spacing: 0.04em; font-variant-numeric: tabular-nums; }
.text-input--code::placeholder { text-transform: none; letter-spacing: normal; }
.text-input--invalid,
.input-group--invalid { border-color: var(--rb-accent); }

/* table */
.components { width: 100%; border-collapse: collapse; font-size: 13px; }
.components th {
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
.components td { padding: 10px 16px; border-bottom: 1px solid var(--rb-border); vertical-align: middle; }
.components tr:last-child td { border-bottom: 0; }
.components tbody tr { transition: background-color 0.12s ease; }
.components tbody tr:hover { background: var(--rb-surface-hover); }

.row--unset td:first-child { box-shadow: inset 3px 0 0 var(--rb-warning); }
.row--dirty { background: rgba(var(--rb-primary-rgb), 0.04); }
.row--new { background: rgba(var(--rb-success-rgb), 0.06); }

.right { text-align: right; }
.name { font-weight: 600; }
.name__sub { display: block; margin-top: 1px; font-size: 11.5px; font-weight: 500; color: var(--rb-text-secondary); }
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

/* inputs with a unit */
.input-group {
  display: inline-flex;
  align-items: center;
  width: 170px;
  height: 36px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  background: var(--rb-surface);
  overflow: hidden;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.input-group:focus-within { border-color: var(--rb-primary); box-shadow: var(--rb-focus-ring); }
.input-group__suffix {
  padding: 0 10px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--rb-text-secondary);
  background: var(--rb-surface-alt);
  align-self: stretch;
  display: grid;
  place-items: center;
  border-left: 1px solid var(--rb-border);
}

.cell-input {
  flex: 1;
  min-width: 0;
  height: 100%;
  padding: 0 10px;
  border: 0;
  background: transparent;
  color: var(--rb-text-primary);
  font: inherit;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
.cell-input:focus { outline: none; }
.cell-input::placeholder { color: var(--rb-placeholder); }

/* status */
.pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 700;
  white-space: nowrap;
}
.pill--ok { background: rgba(var(--rb-success-rgb), 0.12); color: var(--rb-success-text); }
.pill--warn { background: rgba(var(--rb-warning-rgb), 0.14); color: var(--rb-warning-text); }

/* actions */
.row-actions { display: inline-flex; align-items: center; gap: 6px; }
.unsaved {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-right: 4px;
  font-size: 11.5px;
  font-weight: 700;
  color: var(--rb-primary-text);
}
.unsaved::before { content: ''; width: 6px; height: 6px; border-radius: 999px; background: currentColor; }

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

/* skeleton */
.skeleton {
  display: block;
  border-radius: 6px;
  background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 37%, var(--rb-skeleton-a) 63%);
  background-size: 400% 100%;
  animation: comp-shimmer 1.4s ease infinite;
}
.skeleton--name { width: 60%; height: 12px; }
.skeleton--code { width: 52px; height: 20px; }
.skeleton--input { width: 170px; height: 36px; border-radius: 10px; }
.skeleton--pill { width: 90px; height: 20px; border-radius: 999px; }
@keyframes comp-shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}

.spin { animation: comp-spin 0.9s linear infinite; }
@keyframes comp-spin { to { transform: rotate(360deg); } }

.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

@media (max-width: 900px) {
  .add__fields { grid-template-columns: 1fr 1fr; }
  .field--name { grid-column: 1 / -1; }
}

@media (max-width: 560px) {
  .add__fields { grid-template-columns: 1fr; }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton, .spin { animation: none; }
}

/* ===== Refresh (project owner, 2026-10-28) ===== */
.components-page { padding-bottom: 96px; }
.header-actions { align-items: center; }
.how-link { display: inline-flex; align-items: center; gap: 6px; margin-right: 6px; border: 0; background: none; font: inherit; font-size: 12.5px; font-weight: 600; color: var(--rb-primary-text); cursor: pointer; }

.how { display: flex; align-items: flex-start; gap: 12px; padding: 14px 14px 14px 16px; border: 1px solid rgba(var(--rb-primary-rgb), .2); border-radius: 14px; background: rgba(var(--rb-primary-rgb), .05); }
.how__icon { display: grid; place-items: center; flex: none; width: 30px; height: 30px; border-radius: 9px; background: rgba(var(--rb-primary-rgb), .12); color: var(--rb-primary-text); }
.how__body { flex: 1; min-width: 0; }
.how__title { margin: 4px 0 0; font-size: 13.5px; font-weight: 700; color: var(--rb-text-primary); }
.how__text { margin: 4px 0 0; max-width: 90ch; font-size: 12.5px; line-height: 1.6; color: var(--rb-text-secondary); }
.icon-btn { display: grid; place-items: center; flex: none; width: 30px; height: 30px; border: 0; border-radius: 8px; background: transparent; color: var(--rb-text-secondary); cursor: pointer; }
.icon-btn:hover { background: rgba(var(--rb-primary-rgb), .08); color: var(--rb-text-primary); }

/* Chips: all, and what still needs a shelf life. */
.tally { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.tally__chip { display: inline-flex; align-items: center; gap: 7px; height: 34px; padding: 0 12px; border: 1px solid var(--rb-border); border-radius: 999px; background: var(--rb-surface); font: inherit; font-size: 12.5px; font-weight: 600; color: var(--rb-text-secondary); cursor: pointer; }
.tally__chip:hover:not(:disabled) { border-color: var(--rb-border-strong); color: var(--rb-text-primary); }
.tally__chip:disabled { opacity: .55; cursor: default; }
.tally__chip:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }
.tally__chip--on, .tally__chip--on:hover:not(:disabled) { border-color: var(--rb-primary); background: rgba(var(--rb-primary-rgb), .08); color: var(--rb-primary-text); }
.tally__chip--warn :deep(.asset-icon) { color: var(--rb-warning-text); }
.tally__chip--warn.tally__chip--on { border-color: rgb(var(--rb-warning-rgb)); background: rgba(var(--rb-warning-rgb), .1); color: var(--rb-warning-text); }
.tally__count { min-width: 22px; padding: 1px 7px; border-radius: 999px; background: var(--rb-surface-alt); font-size: 12px; font-weight: 800; text-align: center; color: var(--rb-text-primary); }
.tally__chip--warn:not(:disabled) .tally__count { background: rgba(var(--rb-warning-rgb), .16); color: var(--rb-warning-text); }
.scope { display: inline-flex; align-items: center; gap: 6px; margin-left: auto; font-size: 12.5px; color: var(--rb-text-secondary); }
.hint-line { display: flex; align-items: center; gap: 8px; margin: 0; padding: 10px 14px; border-radius: 12px; background: rgba(var(--rb-warning-rgb), .1); font-size: 13px; color: var(--rb-warning-text); }

/* The rows. */
.card { border-radius: 16px; }
.components td { padding-top: 12px; padding-bottom: 12px; }
.name__line { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 9px; font-weight: 600; }
.swatch { flex: none; width: 10px; height: 10px; border-radius: 3px; background: var(--comp); }
.comp--red { --comp: rgb(var(--rb-accent-rgb)); }
.comp--amber { --comp: rgb(var(--rb-warning-rgb)); }
.comp--purple { --comp: rgb(var(--rb-purple-rgb, 124, 58, 237)); }
.comp--blue { --comp: rgb(var(--rb-primary-rgb)); }
.comp--grey { --comp: var(--rb-text-muted); }
.storage { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; white-space: nowrap; }
.storage--frozen { background: rgba(var(--rb-primary-rgb), .1); color: var(--rb-primary-text); }
.storage--cold { background: rgba(0, 150, 136, .1); color: #00796B; }
.storage--room { background: rgba(var(--rb-warning-rgb), .12); color: var(--rb-warning-text); }
html.dark .storage--cold { color: #4DB6AC; }
.muted { color: var(--rb-text-muted); }
.life { display: flex; align-items: center; gap: 12px; }
.life__readable { font-size: 12.5px; color: var(--rb-text-secondary); white-space: nowrap; }
.life__unset { display: inline-flex; align-items: center; gap: 5px; font-size: 12.5px; font-weight: 600; color: var(--rb-warning-text); white-space: nowrap; }
.input-group--unset { border-color: rgba(var(--rb-warning-rgb), .6) !important; }
.row--unset { box-shadow: none !important; }
.row--dirty td { background: rgba(var(--rb-primary-rgb), .04); }
.link-btn { margin-left: 6px; border: 0; background: none; font: inherit; font-weight: 600; color: var(--rb-primary-text); cursor: pointer; }

/* Add: the fields beside how the label will read. */
.add__body { display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 20px; align-items: start; }
.label-preview { display: flex; flex-direction: column; gap: 8px; }
.label-preview__caption { margin: 0; font-size: 12px; font-weight: 700; color: var(--rb-text-secondary); }
.label-preview__card { display: flex; flex-direction: column; gap: 6px; padding: 14px; border: 1px dashed var(--rb-border-strong); border-radius: 12px; background: var(--rb-surface); }
.label-preview__code { font-family: var(--rb-font-mono); font-size: 15px; font-weight: 800; letter-spacing: .02em; }
.label-preview__name { font-size: 13px; font-weight: 600; overflow-wrap: anywhere; }
.label-preview__meta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 12px; color: var(--rb-text-secondary); }

/* Save within reach. */
.savebar { position: sticky; bottom: 16px; z-index: 5; display: flex; align-items: center; gap: 8px; padding: 10px 10px 10px 16px; border: 1px solid var(--rb-border); border-radius: 14px; background: var(--rb-surface); box-shadow: 0 8px 24px rgba(var(--rb-shadow-rgb), .14); }
.savebar__text { display: inline-flex; flex: 1; align-items: center; gap: 7px; font-size: 13px; font-weight: 700; color: var(--rb-primary-text); }
.savebar-enter-active, .savebar-leave-active { transition: opacity .18s ease, transform .18s ease; }
.savebar-enter-from, .savebar-leave-to { opacity: 0; transform: translateY(8px); }
@media (prefers-reduced-motion: reduce) { .savebar-enter-active, .savebar-leave-active { transition: none; } }
@media (max-width: 900px) { .add__body { grid-template-columns: 1fr; } }
/* The preview reads as a sample until it is filled in; the actions close the whole form. */
.label-preview__caption i { font-style: normal; font-weight: 500; color: var(--rb-text-muted); }
.label-preview__sample { color: var(--rb-text-muted); }
.label-preview__empty { font-style: italic; font-weight: 500; color: var(--rb-text-muted); }
.add__actions { padding-top: 14px; border-top: 1px solid var(--rb-border); }
/* Storage presets under the fields; what is missing beside the button. */
.add__fields { align-content: start; }
.presets { grid-column: 1 / -1; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.presets__label { margin-right: 2px; font-size: 12px; font-weight: 600; color: var(--rb-text-secondary); }
.storage--btn { border: 1px solid transparent; font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; }
.storage--btn:hover { border-color: currentColor; }
.storage--btn:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }
.storage--on { border-color: currentColor; }
.add__actions { align-items: center; }
.add__missing { margin-right: auto; font-size: 12.5px; color: var(--rb-text-secondary); }
</style>
