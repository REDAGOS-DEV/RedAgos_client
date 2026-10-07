<template>
  <div class="components-page">
    <header class="components-page__header">
      <div>
        <h1 class="components-page__title">Blood Components</h1>
        <p class="components-page__subtitle">
          Shelf life and price for each component. Every unit's expiry date comes from its shelf life, so a component
          without one cannot be booked into stock.
        </p>
      </div>

      <button type="button" class="btn btn--ghost" :disabled="busy" @click="load">
        <AssetIcon name="refresh-cw" :size="14" :class="{ spin: busy }" />
        {{ busy ? 'Loading…' : 'Refresh' }}
      </button>
    </header>

    <!-- Whose settings these are, and how far along they are -->
    <div class="scope">
      <span class="scope__item">
        <AssetIcon name="building-2" :size="14" />
        Settings for <strong>{{ facilityName || 'this centre' }}</strong> only. Other centres set their own.
      </span>
      <span v-if="rows.length" class="scope__progress" :class="{ 'scope__progress--done': configuredCount === rows.length }">
        <AssetIcon :name="configuredCount === rows.length ? 'circle-check-big' : 'circle-alert'" :size="14" />
        {{ configuredCount }} of {{ rows.length }} components configured
      </span>
    </div>

    <div v-if="banner" class="alert" :class="`alert--${bannerKind}`" role="status">
      <AssetIcon :name="bannerKind === 'success' ? 'circle-check-big' : bannerKind === 'error' ? 'circle-alert' : 'info'" :size="16" />
      <span>{{ banner }}</span>
    </div>

    <section class="card">
      <table class="components">
        <thead>
          <tr>
            <th>Component</th>
            <th>Shelf life</th>
            <th>Price per unit</th>
            <th>Status</th>
            <th class="right"><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <template v-if="busy && !rows.length">
            <tr v-for="n in 4" :key="`sk-${n}`" class="row--skeleton">
              <td><span class="skeleton skeleton--name" /></td>
              <td><span class="skeleton skeleton--input" /></td>
              <td><span class="skeleton skeleton--input" /></td>
              <td><span class="skeleton skeleton--pill" /></td>
              <td />
            </tr>
          </template>
          <tr v-else-if="!rows.length">
            <td colspan="5" class="empty">No blood components are defined.</td>
          </tr>
          <tr
            v-for="row in rows"
            v-else
            :key="row.id"
            :class="{ 'row--unset': !row.shelf_life_configured, 'row--dirty': isDirty(row) }"
          >
            <td class="name">{{ row.name }}</td>
            <td>
              <label class="input-group">
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
            </td>
            <td>
              <label class="input-group">
                <span class="input-group__prefix">₱</span>
                <span class="sr-only">{{ row.name }} price per unit</span>
                <input
                  v-model="drafts[row.id].price"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="No price"
                  class="cell-input"
                >
              </label>
            </td>
            <td>
              <span class="pill" :class="row.shelf_life_configured ? 'pill--ok' : 'pill--warn'">
                <AssetIcon :name="row.shelf_life_configured ? 'check' : 'circle-alert'" :size="12" />
                {{ row.shelf_life_configured ? 'Configured' : 'Shelf life needed' }}
              </span>
            </td>
            <td class="right">
              <div class="row-actions">
                <span v-if="isDirty(row)" class="unsaved">Unsaved</span>
                <!-- Undo puts the fields back to what is saved; nothing is sent. -->
                <button
                  v-if="isDirty(row)"
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

    <p class="footnote">
      <AssetIcon name="info" :size="14" />
      <span>
        A blank field means no approved value yet. Stock intake refuses a component with no shelf life rather than
        guessing one, and a component with no price can be released without payment.
      </span>
    </p>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'

/**
 * A blood centre's own settings for each blood component.
 *
 * Held per facility rather than on the shared `blood_components` row: four
 * facilities share that row, so a value written there would decide another
 * centre's expiry dates, and a price set there would switch on the
 * payment-before-release gate for centres that never set one.
 */

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  requires: 'center.configure',
})

useHead({ title: 'Blood Components · RedAgos' })

const rows = ref([])
const drafts = reactive({})
const facilityName = ref('')
const busy = ref(false)
const savingId = ref(null)
const banner = ref('')
const bannerKind = ref('notice')

// How many components already have a shelf life, for the progress line.
const configuredCount = computed(() => rows.value.filter((row) => row.shelf_life_configured).length)

function seedDraft(row) {
  drafts[row.id] = {
    shelf_life_days: row.shelf_life_days ?? '',
    price: row.price ?? '',
  }
}

/**
 * Saving an unchanged row would write an audit entry recording no change, so
 * the button stays disabled until something actually differs.
 */
function isDirty(row) {
  const draft = drafts[row.id]

  if (!draft) return false

  const days = draft.shelf_life_days === '' ? null : Number(draft.shelf_life_days)
  const price = draft.price === '' ? null : Number(draft.price)

  return days !== row.shelf_life_days || price !== row.price
}

async function load() {
  busy.value = true
  banner.value = ''

  try {
    const res = await bloodCenterService.componentSettings()

    rows.value = res?.data ?? []
    rows.value.forEach(seedDraft)
    facilityName.value = res?.meta?.facility?.name ?? ''

    const unconfigured = res?.meta?.unconfigured ?? 0

    if (unconfigured > 0) {
      bannerKind.value = 'error'
      banner.value = `${unconfigured} component${unconfigured === 1 ? ' has' : 's have'} no shelf life set, so ${unconfigured === 1 ? 'it' : 'they'} cannot be booked into your stock.`
    }
  } catch (err) {
    bannerKind.value = 'error'
    banner.value = err?.data?.message || 'The component settings could not be loaded.'
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
      // server accepts and stock intake then refuses on. Zero is a real price.
      shelf_life_days: draft.shelf_life_days === '' ? null : Number(draft.shelf_life_days),
      price: draft.price === '' ? null : Number(draft.price),
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
    banner.value = err?.data?.message
      || Object.values(err?.data?.errors ?? {}).flat()[0]
      || 'The component could not be saved.'
  } finally {
    savingId.value = null
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

.components-page__header { display: flex; gap: 16px; align-items: flex-start; justify-content: space-between; }
.components-page__title { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }
.components-page__subtitle { margin: 4px 0 0; max-width: 72ch; font-size: 13px; line-height: 1.55; color: var(--rb-text-secondary); }

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

/* table */
.card {
  border: 1px solid var(--rb-border);
  border-radius: 14px;
  background: var(--rb-surface);
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(var(--rb-shadow-rgb), 0.03);
}

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

.right { text-align: right; }
.name { font-weight: 600; }
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
.input-group__prefix,
.input-group__suffix {
  padding: 0 10px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--rb-text-secondary);
  background: var(--rb-surface-alt);
  align-self: stretch;
  display: grid;
  place-items: center;
}
.input-group__prefix { border-right: 1px solid var(--rb-border); }
.input-group__suffix { border-left: 1px solid var(--rb-border); }

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
.skeleton--input { width: 170px; height: 36px; border-radius: 10px; }
.skeleton--pill { width: 90px; height: 20px; border-radius: 999px; }
@keyframes comp-shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}

.spin { animation: comp-spin 0.9s linear infinite; }
@keyframes comp-spin { to { transform: rotate(360deg); } }

.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

@media (prefers-reduced-motion: reduce) {
  .skeleton, .spin { animation: none; }
}
</style>
