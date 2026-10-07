<template>
  <section class="quarantine" aria-labelledby="quarantine-title">
    <header class="quarantine__header">
      <div>
        <h2 id="quarantine-title" class="quarantine__title">
          <AssetIcon name="shield-check" :size="16" />
          In quarantine
          <span class="quarantine__count">{{ units.length }}</span>
        </h2>
        <p class="quarantine__hint">
          Booked in, not yet issuable. A donation's bags leave quarantine together, and only once TTI Testing and
          Immunohematology have both cleared it.
          <template v-if="!allowRelease">They are released and given their final labels at Stock Intake.</template>
          <template v-else>Releasing prints each bag's final label.</template>
        </p>
      </div>
      <button type="button" class="quarantine__refresh" :disabled="loading" @click="load">
        <AssetIcon name="refresh-cw" :size="13" />
        Refresh
      </button>
    </header>

    <p v-if="error" class="quarantine__alert quarantine__alert--error" role="alert">{{ error }}</p>
    <p v-else-if="notice" class="quarantine__alert" role="status">{{ notice }}</p>

    <p v-if="loading && !groups.length" class="quarantine__empty">Loading…</p>
    <p v-else-if="!groups.length" class="quarantine__empty">Nothing is waiting in quarantine.</p>

    <ul v-else class="quarantine__list">
      <li v-for="group in groups" :key="group.donationId" class="quarantine__row">
        <div class="quarantine__main">
          <p class="quarantine__name">Donation #{{ group.donationId }}</p>
          <p class="quarantine__meta">
            {{ group.units.length }} bag{{ group.units.length === 1 ? '' : 's' }}:
            <span v-for="(unit, i) in group.units" :key="unit.id">
              <span class="mono">{{ unit.id }}</span> {{ unit.component?.name }}<template v-if="i < group.units.length - 1">, </template>
            </span>
          </p>
        </div>

        <div class="quarantine__chips">
          <template v-if="group.state.locked">
            <span class="chip chip--alarm">
              <AssetIcon name="lock" :size="11" />
              Locked — discard only
            </span>
          </template>
          <template v-else>
            <span class="chip" :class="group.state.tti ? 'chip--done' : ''">
              <AssetIcon v-if="group.state.tti" name="check" :size="11" />
              TTI
            </span>
            <span class="chip" :class="group.state.immunohematology ? 'chip--done' : ''">
              <AssetIcon v-if="group.state.immunohematology" name="check" :size="11" />
              ABO/Rh
            </span>
          </template>
        </div>

        <button
          v-if="canRelease && !group.state.locked"
          type="button"
          class="quarantine__release"
          :disabled="busy === group.donationId || !group.state.releasable"
          :title="group.state.releasable ? '' : 'Waiting for testing to clear this donation'"
          @click="release(group)"
        >
          {{ busy === group.donationId ? 'Releasing…' : 'Release & print labels' }}
        </button>
      </li>
    </ul>
  </section>
</template>

<script setup>
/**
 * Units booked in but not yet cleared, grouped by the donation they came from.
 *
 * The release is the Inventory Control Officer's act, and it happens at Stock
 * Intake, where the final labels are printed: that page passes
 * `allow-release`, and the Blood Inventory page shows the same list read-only.
 * The server re-checks both clearance tokens for anyone who presses it,
 * supervisors included, so the button being enabled is presentation —
 * `releasable` is what the server computed, not what this component guesses.
 */

import AssetIcon from '~/components/common/AssetIcon.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'

const props = defineProps({
  allowRelease: { type: Boolean, default: false },
})

// `released` carries the donation id and the final-label data the server
// returned with the release, so the page can print straight away.
const emit = defineEmits(['released'])

const { can } = useUser()
const canRelease = computed(() => props.allowRelease && can('inventory.release_quarantine'))

const units = ref([])
const loading = ref(false)
const busy = ref(null)
const error = ref(null)
const notice = ref(null)

const REFUSALS = {
  tti_not_cleared: 'TTI Testing has not cleared this donation yet.',
  immunohematology_not_cleared: 'Immunohematology has not cleared this donation yet.',
  donation_rejected: 'This donation was rejected. Its units can only be discarded.',
  unit_past_expiry: 'A bag from this donation is past its date. Discard it, then release the rest.',
  nothing_quarantined: 'Nothing from this donation is in quarantine any more.',
}

const groups = computed(() => {
  const byDonation = new Map()

  for (const unit of units.value) {
    const key = unit.donation_id ?? unit.id

    if (!byDonation.has(key)) {
      byDonation.set(key, {
        donationId: unit.donation_id,
        units: [],
        state: unit.quarantine ?? { tti: false, immunohematology: false, locked: false, releasable: false },
      })
    }

    byDonation.get(key).units.push(unit)
  }

  return [...byDonation.values()]
})

async function load() {
  loading.value = true
  error.value = null

  try {
    const response = await bloodCenterService.inventory({ status: 'quarantined', per_page: 100 })
    units.value = response?.data ?? []
  } catch (err) {
    error.value = err?.message || 'Could not load the quarantine list.'
  } finally {
    loading.value = false
  }
}

async function release(group) {
  busy.value = group.donationId
  error.value = null
  notice.value = null

  try {
    const response = await bloodCenterService.releaseQuarantine(group.donationId)
    notice.value = response?.message || 'Released from quarantine.'
    emit('released', group.donationId, response?.labels ?? null)
    await load()
  } catch (err) {
    error.value = REFUSALS[err?.data?.code] || err?.message || 'The units could not be released.'
  } finally {
    busy.value = null
  }
}

onMounted(load)

defineExpose({ load })
</script>

<style scoped>
.quarantine {
  border: 1px solid var(--rb-border);
  border-radius: 14px;
  background: var(--rb-surface);
  padding: 1rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.quarantine__header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
}

.quarantine__title {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--rb-text-primary);
}

.quarantine__count {
  min-width: 1.4rem;
  padding: 0.05rem 0.45rem;
  border-radius: 999px;
  background: rgba(var(--rb-warning-rgb), 0.16);
  color: var(--rb-warning-text);
  font-size: 12px;
  text-align: center;
}

.quarantine__hint {
  margin: 0.25rem 0 0;
  font-size: 13px;
  color: var(--rb-text-secondary);
  max-width: 60ch;
}

.quarantine__refresh {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.7rem;
  border: 1px solid var(--rb-border);
  border-radius: 8px;
  background: transparent;
  color: var(--rb-text-secondary);
  font-size: 12.5px;
  cursor: pointer;
}

.quarantine__alert {
  margin: 0;
  padding: 0.55rem 0.75rem;
  border-radius: 8px;
  font-size: 13px;
  background: rgba(var(--rb-success-rgb), 0.12);
  color: var(--rb-success-text);
}

.quarantine__alert--error {
  background: rgba(var(--rb-accent-rgb), 0.12);
  color: var(--rb-accent-text);
}

.quarantine__empty {
  margin: 0;
  font-size: 13.5px;
  color: var(--rb-text-secondary);
}

.quarantine__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.quarantine__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 0.75rem;
  border: 1px solid var(--rb-border);
  border-radius: 10px;
  background: var(--rb-surface-alt);
}

.quarantine__name {
  margin: 0;
  font-weight: 600;
  font-size: 14px;
  color: var(--rb-text-primary);
}

.quarantine__meta {
  margin: 0.15rem 0 0;
  font-size: 12.5px;
  color: var(--rb-text-secondary);
}

.quarantine__chips {
  display: flex;
  gap: 0.35rem;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  border: 1px solid var(--rb-border);
  font-size: 11.5px;
  color: var(--rb-text-secondary);
}

.chip--done {
  border-color: transparent;
  background: rgba(var(--rb-success-rgb), 0.14);
  color: var(--rb-success-text);
}

.chip--alarm {
  border-color: transparent;
  background: rgba(var(--rb-accent-rgb), 0.14);
  color: var(--rb-accent-text);
}

.quarantine__release {
  padding: 0.4rem 0.9rem;
  border: 0;
  border-radius: 8px;
  background: var(--rb-primary);
  color: #fff;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
}

.quarantine__release:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.mono {
  font-family: var(--rb-font-mono);
}

@media (max-width: 640px) {
  .quarantine__row {
    grid-template-columns: 1fr;
  }
}
</style>
