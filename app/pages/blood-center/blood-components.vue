<template>
  <div class="components-page">
    <header class="components-page__header">
      <div>
        <p class="components-page__eyebrow">Blood Center Portal / Settings</p>
        <h1 class="components-page__title">Blood Components</h1>
        <p class="components-page__subtitle">
          Your centre's shelf life and price for each component. Shelf life is what every unit's expiry
          date is derived from — a component without one cannot be booked into stock here.
        </p>
      </div>

      <button type="button" class="btn" :disabled="busy" @click="load">
        <AssetIcon name="refresh-cw" :size="14" />
        {{ busy ? 'Loading…' : 'Refresh' }}
      </button>
    </header>

    <p class="alert alert--notice">
      These values belong to <strong>{{ facilityName || 'this centre' }}</strong> alone. Other centres on
      the network set their own, because shelf life varies by preparation and protocol, and a price
      switches on payment-before-release for your own units only.
    </p>

    <p v-if="banner" class="alert" :class="`alert--${bannerKind}`" role="status">{{ banner }}</p>

    <section class="card">
      <table class="components">
        <thead>
          <tr>
            <th>Component</th>
            <th>Shelf life (days)</th>
            <th>Price per unit</th>
            <th>State</th>
            <th class="right">Action</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="busy && !rows.length">
            <td colspan="5" class="empty">Loading…</td>
          </tr>
          <tr v-else-if="!rows.length">
            <td colspan="5" class="empty">No blood components are defined.</td>
          </tr>
          <tr v-for="row in rows" v-else :key="row.id">
            <td class="name">{{ row.name }}</td>
            <td>
              <input
                v-model="drafts[row.id].shelf_life_days"
                type="number"
                min="1"
                max="3650"
                placeholder="Not set"
                class="cell-input cell-input--narrow"
              >
            </td>
            <td>
              <input
                v-model="drafts[row.id].price"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                class="cell-input cell-input--narrow"
              >
            </td>
            <td>
              <span class="pill" :class="row.shelf_life_configured ? 'pill--ok' : 'pill--warn'">
                {{ row.shelf_life_configured ? 'Configured' : 'Not configured' }}
              </span>
            </td>
            <td class="right">
              <button
                type="button"
                class="btn btn--primary"
                :disabled="savingId === row.id || !isDirty(row)"
                @click="save(row)"
              >
                {{ savingId === row.id ? 'Saving…' : 'Save' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <p class="footnote">
      Leaving a field blank means "no approved value yet". Stock intake then refuses that component
      rather than falling back to a guess, and a blank price leaves units releasable without payment.
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
      banner.value = `${unconfigured} component(s) have no shelf life set, so they cannot be booked into your stock.`
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
  max-width: 1152px;
  margin: 0 auto;
  padding: 24px 32px 40px;
  background: var(--rb-page-bg);
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.components-page__header {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: flex-start;
  justify-content: space-between;
}

.components-page__eyebrow {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--rb-primary-text);
}

.components-page__title {
  margin: 0.15rem 0 0;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--rb-text-primary);
}

.components-page__subtitle {
  margin: 0.3rem 0 0;
  max-width: 68ch;
  font-size: 13px;
  color: var(--rb-text-secondary);
}

@media (max-width: 640px) {
  .components-page { padding: 16px 16px 32px; }
}

.card {
  padding: 0;
  border: 1px solid var(--rb-border);
  border-radius: 12px;
  background: var(--rb-surface);
  overflow: hidden;
}

.components {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.components th {
  text-align: left;
  padding: 0.65rem 0.9rem;
  background: var(--rb-surface-alt);
  border-bottom: 1px solid var(--rb-border);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--rb-text-secondary);
}

.components td {
  padding: 0.65rem 0.9rem;
  border-bottom: 1px solid var(--rb-border);
  vertical-align: middle;
  color: var(--rb-text-primary);
}

.components tr:last-child td { border-bottom: 0; }

.right { text-align: right; }
.name { font-weight: 600; }

.empty {
  padding: 1.8rem 0.9rem;
  text-align: center;
  color: var(--rb-text-secondary);
}

.cell-input {
  width: 100%;
  padding: 0.45rem 0.6rem;
  border: 1px solid var(--rb-border-strong);
  border-radius: 8px;
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  font: inherit;
  font-size: 0.85rem;
}

.cell-input--narrow { max-width: 9rem; }

.cell-input:focus-visible {
  outline: 2px solid var(--rb-primary);
  outline-offset: 1px;
  border-color: var(--rb-primary);
}

.pill {
  display: inline-block;
  padding: 0.18rem 0.55rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
}

.pill--ok { background: rgba(var(--rb-success-rgb), 0.12); color: var(--rb-success-text); }
.pill--warn { background: rgba(var(--rb-warning-rgb), 0.12); color: var(--rb-warning-text); }

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  border: 1px solid var(--rb-border-strong);
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  border-radius: 10px;
  padding: 0.45rem 0.9rem;
  font-size: 0.83rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 140ms ease, border-color 140ms ease;
}

.btn:hover:not(:disabled) { background: var(--rb-surface-hover); border-color: var(--rb-border-hover); }
.btn:disabled { opacity: 0.55; cursor: not-allowed; }

.btn--primary { background: var(--rb-primary); border-color: var(--rb-primary); color: #fff; }
.btn--primary:hover:not(:disabled) {
  background: color-mix(in srgb, var(--rb-primary) 88%, #000);
  border-color: color-mix(in srgb, var(--rb-primary) 88%, #000);
}

.alert {
  margin: 0;
  padding: 0.65rem 0.85rem;
  border-radius: 10px;
  font-size: 0.84rem;
  line-height: 1.5;
}

.alert--notice {
  background: rgba(var(--rb-primary-rgb), 0.08);
  color: var(--rb-primary-text);
  border: 1px solid rgba(var(--rb-primary-rgb), 0.25);
}

.alert--success {
  background: rgba(var(--rb-success-rgb), 0.1);
  color: var(--rb-success-text);
  border: 1px solid rgba(var(--rb-success-rgb), 0.3);
}

.alert--error {
  background: rgba(var(--rb-accent-rgb), 0.1);
  color: var(--rb-accent-text);
  border: 1px solid rgba(var(--rb-accent-rgb), 0.3);
}

.footnote {
  margin: 0;
  font-size: 0.78rem;
  color: var(--rb-text-secondary);
}
</style>
