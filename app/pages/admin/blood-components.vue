<template>
  <div class="admin-page">
    <header class="page-header">
      <div>
        <h1>Blood Components</h1>
        <p class="subtitle">
          Shelf life is what every blood unit's expiry date is derived from. A component without one
          cannot be booked into stock at any centre.
        </p>
      </div>

      <div class="header-actions">
        <button type="button" class="ghost-btn" :disabled="busy" @click="load">
          <AssetIcon name="refresh-cw" :size="16" />
          {{ busy ? 'Loading…' : 'Refresh' }}
        </button>
      </div>
    </header>

    <p class="banner banner-info">
      These values apply to every blood centre on the network — a component is one shared record, not a
      per-facility setting. RedAgos ships them unset on purpose: shelf life varies by preparation,
      anticoagulant and storage protocol, so it has to be entered by someone clinically accountable for
      it rather than defaulted in software.
    </p>

    <p v-if="banner" class="banner" :class="`banner-${bannerKind}`">{{ banner }}</p>

    <div class="table-wrap">
      <table class="components">
        <thead>
          <tr>
            <th>Component</th>
            <th>Shelf life (days)</th>
            <th>Storage temperature</th>
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
                v-model="drafts[row.id].storage_temperature"
                type="text"
                placeholder="e.g. 2–6 °C"
                class="cell-input"
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
                class="primary-btn"
                :disabled="savingId === row.id || !isDirty(row)"
                @click="save(row)"
              >
                {{ savingId === row.id ? 'Saving…' : 'Save' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="footnote">
      Clearing a shelf life is allowed and means "no approved value yet". Stock intake then refuses that
      component rather than falling back to a guess.
    </p>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import { bloodComponentService } from '~/api/admin/BloodComponentService'

definePageMeta({
  middleware: 'auth',
  layout: 'admindashboard',
  keepalive: true,
})

useHead({ title: 'Blood Components · RedAgos' })

const rows = ref([])
const drafts = reactive({})
const busy = ref(false)
const savingId = ref(null)
const banner = ref('')
const bannerKind = ref('info')

function seedDraft(row) {
  drafts[row.id] = {
    shelf_life_days: row.shelf_life_days ?? '',
    storage_temperature: row.storage_temperature ?? '',
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
  const temp = draft.storage_temperature.trim() || null

  return days !== row.shelf_life_days || temp !== (row.storage_temperature ?? null)
}

async function load() {
  busy.value = true
  banner.value = ''

  try {
    const res = await bloodComponentService.list()

    rows.value = res?.data ?? []
    rows.value.forEach(seedDraft)

    const unconfigured = res?.meta?.unconfigured ?? 0

    if (unconfigured > 0) {
      bannerKind.value = 'error'
      banner.value = `${unconfigured} component(s) have no shelf life set, so no centre can book them into stock.`
    }
  } catch (err) {
    bannerKind.value = 'error'
    banner.value = err?.data?.message || 'The component catalogue could not be loaded.'
  } finally {
    busy.value = false
  }
}

async function save(row) {
  const draft = drafts[row.id]

  savingId.value = row.id
  banner.value = ''

  try {
    const res = await bloodComponentService.update(row.id, {
      // An empty field is null, not 0: it means "not configured", which is a
      // state the server accepts and intake then refuses on.
      shelf_life_days: draft.shelf_life_days === '' ? null : Number(draft.shelf_life_days),
      storage_temperature: draft.storage_temperature.trim() || null,
    })

    const updated = res?.data

    if (updated) {
      const index = rows.value.findIndex((r) => r.id === row.id)

      if (index !== -1) rows.value[index] = updated
      seedDraft(updated)
    }

    bannerKind.value = 'success'
    banner.value = `${row.name} updated. This applies to every centre on the network.`
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
.admin-page {
  padding: 24px 32px 40px;
  max-width: 1280px;
  margin: 0 auto;
  color: #0f172a;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  flex-wrap: wrap;
  margin-bottom: 24px;
}

.page-header h1 {
  margin: 0 0 4px;
  font-size: 24px;
  font-weight: 700;
}

.subtitle {
  margin: 0;
  max-width: 70ch;
  font-size: 14px;
  color: #64748b;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.ghost-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #fff;
  font-size: 13px;
  font-weight: 600;
  color: #334155;
  cursor: pointer;
  text-decoration: none;
}

.ghost-btn:hover:not(:disabled) { background: #f1f5f9; }
.ghost-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.banner {
  margin: 0 0 16px;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
}

.banner-success { background: #F1F7F1; color: #2E7D32; }
.banner-error { background: #FDF1F1; color: #C62828; }
.banner-info { background: #EFF4FB; color: #1565C0; font-weight: 400; line-height: 1.55; }

.table-wrap {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  overflow: hidden;
  background: #fff;
}

.components {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.components th {
  text-align: left;
  padding: 10px 14px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #64748b;
}

.components td {
  padding: 10px 14px;
  border-bottom: 1px solid #f1f5f9;
  vertical-align: middle;
}

.components tr:last-child td { border-bottom: 0; }

.right { text-align: right; }
.name { font-weight: 600; }

.empty {
  padding: 28px 14px;
  text-align: center;
  color: #64748b;
}

.cell-input {
  width: 100%;
  max-width: 14rem;
  padding: 7px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font: inherit;
  font-size: 13px;
  color: #0f172a;
}

.cell-input--narrow { max-width: 8rem; }

.cell-input:focus-visible {
  outline: 2px solid #1565C0;
  outline-offset: 1px;
  border-color: #1565C0;
}

.pill {
  display: inline-block;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
}

.pill--ok { background: #F1F7F1; color: #2E7D32; }
.pill--warn { background: #FDF6EC; color: #B26A00; }

.primary-btn {
  padding: 8px 16px;
  border: 1px solid #1565C0;
  border-radius: 8px;
  background: #1565C0;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.primary-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.footnote {
  margin: 14px 0 0;
  font-size: 12px;
  color: #64748b;
}
</style>
