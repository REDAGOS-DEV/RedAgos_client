<template>
  <div class="ba-page">
    <div class="ba-inner">
      <PageHeader title="Blood Availability" :subtitle="hospitalPageSubtitle('availability', can)">
        <template v-if="canCreate" #actions>
          <NuxtLink :to="newRequestLink" class="ui-btn ui-btn--primary">
            <AssetIcon name="plus" :size="15" />
            New Request
          </NuxtLink>
        </template>
      </PageHeader>

      <!-- WHAT TO LOOK FOR -->
      <section class="panel ba-search" aria-label="Search blood centers">
        <div class="field">
          <label for="ba-type" class="field-label">Blood type</label>
          <SelectField
            id="ba-type"
            v-model="filters.blood_type_id"
            :options="bloodTypes.map((type) => ({ value: type.id, label: type.label }))"
            :placeholder="referenceLoading ? 'Loading…' : 'Select…'"
            :disabled="referenceLoading"
          />
        </div>
        <div class="field field--wide">
          <label for="ba-component" class="field-label">Blood component</label>
          <SelectField
            id="ba-component"
            v-model="filters.component_id"
            :options="components.map((component) => ({ value: component.id, label: component.name }))"
            :placeholder="referenceLoading ? 'Loading…' : 'Select…'"
            :disabled="referenceLoading"
          />
        </div>
        <div class="field">
          <label for="ba-quantity" class="field-label">Units needed <span class="field-optional">optional</span></label>
          <input id="ba-quantity" v-model.number="filters.quantity" type="number" min="1" max="100" class="input">
        </div>
      </section>

      <div v-if="referenceError" class="banner" role="alert">
        <AssetIcon name="triangle-alert" :size="16" />
        <span>{{ referenceError }}</span>
        <button type="button" class="ui-btn ui-btn--sm" @click="loadReference">Try again</button>
      </div>

      <!-- NOTHING ASKED YET -->
      <section v-else-if="!canSearch" class="panel">
        <EmptyState icon="search" title="Choose a blood type and a component" description="The blood centers holding it are listed here, with how much each has." />
      </section>

      <!-- SEARCHING -->
      <section v-else-if="searching && !result" class="panel panel--flush" aria-busy="true">
        <table class="list">
          <thead><tr><th>Blood center</th><th class="num">Available</th><th>Earliest expiry</th><th>For this need</th></tr></thead>
          <tbody><SkeletonRows :columns="4" :rows="4" /></tbody>
        </table>
      </section>

      <div v-else-if="searchError" class="banner" role="alert">
        <AssetIcon name="triangle-alert" :size="16" />
        <span>{{ searchError }}</span>
        <button type="button" class="ui-btn ui-btn--sm" @click="search">Try again</button>
      </div>

      <template v-else-if="result">
        <!-- NO CENTER HOLDS IT -->
        <section v-if="!result.facilities.length" class="panel">
          <EmptyState
            icon="search-x"
            :title="`No blood center has ${resultLabel} right now`"
            description="Try another component, or raise the request anyway and it can be asked of a center when stock arrives."
          />
        </section>

        <section v-else class="panel panel--flush" :class="{ 'panel--busy': searching }">
          <header class="ba-result-head">
            <div>
              <h2 class="ba-result-title">{{ resultLabel }}</h2>
              <p class="ba-result-sub">
                {{ result.totals.units_available }} unit{{ result.totals.units_available === 1 ? '' : 's' }}
                at {{ result.totals.facilities_with_stock }} blood center{{ result.totals.facilities_with_stock === 1 ? '' : 's' }}
              </p>
            </div>
          </header>

          <div class="ba-scroll">
            <table class="list">
              <thead>
                <tr>
                  <th scope="col">Blood center</th>
                  <th scope="col" class="num">Available</th>
                  <th scope="col">Earliest expiry</th>
                  <th v-if="result.criteria.quantity" scope="col">For {{ result.criteria.quantity }} unit{{ result.criteria.quantity === 1 ? '' : 's' }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="holding in result.facilities" :key="holding.facility.id">
                  <td>
                    <span class="list__name">{{ holding.facility.name }}</span>
                    <span v-if="holding.facility.address" class="list__sub">{{ holding.facility.address }}</span>
                  </td>
                  <td class="num list__units">{{ holding.available }}</td>
                  <td class="nowrap">{{ formatDate(holding.earliest_expiry) }}</td>
                  <td v-if="result.criteria.quantity">
                    <span class="cover" :class="holding.covers_request ? 'cover--ok' : 'cover--part'">
                      {{ holding.covers_request ? 'Covers it' : `Only ${holding.can_fulfil}` }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p class="ba-advisory">
            <AssetIcon name="info" :size="14" />
            A guide, as of now. Nothing is held until a request is raised and a center approves it.
          </p>
        </section>
      </template>
    </div>
  </div>
</template>

<script setup>
/**
 * Which blood centers hold a blood type and component (rebuilt 2026-11-01). The
 * page it replaces called an endpoint that never existed, so it only ever said
 * it had failed. This reads GET /hospital/availability, which answers one pairing.
 */
import AssetIcon from '~/components/common/AssetIcon.vue'
import SelectField from '~/components/common/SelectField.vue'
import EmptyState from '~/components/ui/EmptyState.vue'
import PageHeader from '~/components/ui/PageHeader.vue'
import SkeletonRows from '~/components/ui/SkeletonRows.vue'
import { hospitalService } from '~/api/hospital/HospitalService'
import { hospitalPageSubtitle } from '~/utils/hospitalPageSubtitles'
import { onPageReturn } from '~/composables/useKeptAlive'

definePageMeta({
  middleware: ['auth', 'hospital-portal'],
  layout: 'hospitaldashboard',
  requires: 'hospital.requests.view',
  keepalive: true,
})

const { can } = useUser()
const canCreate = computed(() => can('hospital.requests.manage'))

const bloodTypes = ref([])
const components = ref([])
const referenceLoading = ref(true)
const referenceError = ref('')

const filters = reactive({ blood_type_id: null, component_id: null, quantity: null })

const result = ref(null)
const searching = ref(false)
const searchError = ref('')

const canSearch = computed(() => Boolean(filters.blood_type_id && filters.component_id))
const wantedUnits = computed(() => {
  const units = Number(filters.quantity)
  return Number.isInteger(units) && units >= 1 && units <= 100 ? units : null
})

const resultLabel = computed(() => (result.value
  ? `${result.value.criteria.blood_type.code} ${result.value.criteria.component.name}`
  : ''))

// New Request opens on what was searched for.
const newRequestLink = computed(() => ({
  path: '/hospital/bloodrequests/newrequest',
  query: canSearch.value
    ? { blood_type_id: filters.blood_type_id, component_id: filters.component_id, ...(wantedUnits.value ? { quantity: wantedUnits.value } : {}) }
    : {},
}))

async function loadReference() {
  referenceLoading.value = true
  referenceError.value = ''
  try {
    const reference = await hospitalService.referenceData()
    bloodTypes.value = reference?.blood_types ?? []
    components.value = reference?.components ?? []
  } catch (err) {
    referenceError.value = err?.message || 'Could not load the blood types and components.'
  } finally {
    referenceLoading.value = false
  }
}

// Only the latest search may answer: a slow reply must not replace a newer one.
let ticket = 0
let typingTimer = null

async function search() {
  if (!canSearch.value) {
    result.value = null
    return
  }

  const mine = ++ticket
  searching.value = true
  searchError.value = ''

  try {
    const response = await hospitalService.availability({
      blood_type_id: filters.blood_type_id,
      component_id: filters.component_id,
      ...(wantedUnits.value ? { quantity: wantedUnits.value } : {}),
    })
    if (mine === ticket) result.value = response
  } catch (err) {
    if (mine === ticket) {
      result.value = null
      searchError.value = err?.message || 'Could not search the blood centers. Please try again.'
    }
  } finally {
    if (mine === ticket) searching.value = false
  }
}

// It answers as soon as there is something to ask, so no Search button is needed.
watch([() => filters.blood_type_id, () => filters.component_id], search)
watch(() => filters.quantity, () => {
  clearTimeout(typingTimer)
  typingTimer = setTimeout(search, 350)
})

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

onMounted(loadReference)
// Kept alive: back here, the same search is asked again, over the last answer.
onPageReturn(search)
onUnmounted(() => clearTimeout(typingTimer))
</script>

<style scoped>
.ba-page { min-height: 100%; padding: 24px var(--rb-gutter, 24px) 40px; background: var(--rb-page-bg); font-family: var(--rb-font-sans); }
.ba-inner { display: flex; flex-direction: column; gap: 16px; max-width: var(--rb-content-max, 1600px); margin: 0 auto; }

.panel {
  border: 1px solid var(--rb-border);
  border-radius: var(--rb-radius-lg);
  background: var(--rb-surface);
  box-shadow: var(--rb-shadow-sm);
  padding: 20px;
}
.panel--flush { padding: 0; overflow: hidden; }
.panel--busy { opacity: 0.6; transition: opacity 0.15s ease; }

.ba-search { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 2fr) minmax(0, 1fr); gap: 14px; }
.field { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.field-label { font-size: 12.5px; font-weight: 600; color: var(--rb-text-primary); }
.field-optional { font-weight: 500; color: var(--rb-text-secondary); }
.input {
  width: 100%; height: 42px; padding: 9px 11px; font: inherit; font-size: 13.5px;
  color: var(--rb-text-primary); background: var(--rb-surface);
  border: 1px solid var(--rb-border-strong); border-radius: 9px;
}
.input:focus { outline: none; border-color: var(--rb-primary); box-shadow: 0 0 0 3px rgba(var(--rb-primary-rgb), 0.12); }

.banner {
  display: flex; align-items: center; gap: 8px; padding: 11px 14px; border-radius: 10px; font-size: 13px;
  background: rgba(var(--rb-accent-rgb), 0.08); color: var(--rb-accent-text); border: 1px solid rgba(var(--rb-accent-rgb), 0.25);
}
.banner .ui-btn { margin-left: auto; }

.ba-result-head { padding: 16px 20px 14px; border-bottom: 1px solid var(--rb-border); }
.ba-result-title { margin: 0; font-size: 15px; font-weight: 700; color: var(--rb-text-primary); }
.ba-result-sub { margin: 2px 0 0; font-size: 13px; color: var(--rb-text-secondary); }
.ba-scroll { overflow-x: auto; }

.list { width: 100%; border-collapse: collapse; font-size: 13.5px; color: var(--rb-text-primary); }
.list th { padding: 11px 20px; border-bottom: 1px solid var(--rb-border); font-size: 12px; font-weight: 600; text-align: left; white-space: nowrap; color: var(--rb-text-secondary); }
.list td { padding: 13px 20px; border-bottom: 1px solid var(--rb-border); }
.list tbody tr:last-child td { border-bottom: 0; }
.list .num { text-align: right; font-variant-numeric: tabular-nums; }
.list__name { display: block; font-weight: 700; }
.list__sub { display: block; margin-top: 1px; font-size: 12.5px; color: var(--rb-text-secondary); }
.list__units { font-size: 15px; font-weight: 800; }
.nowrap { white-space: nowrap; }

.cover { display: inline-flex; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; white-space: nowrap; }
.cover--ok { background: rgba(var(--rb-success-rgb), 0.14); color: var(--rb-success-text); }
.cover--part { background: rgba(var(--rb-warning-rgb), 0.16); color: var(--rb-warning-text); }

.ba-advisory { display: flex; align-items: flex-start; gap: 7px; margin: 0; padding: 12px 20px; border-top: 1px solid var(--rb-border); font-size: 12.5px; color: var(--rb-text-secondary); }
.ba-advisory :deep(svg) { flex: none; margin-top: 2px; }

@media (max-width: 720px) {
  .ba-page { padding: 14px; }
  .ba-search { grid-template-columns: minmax(0, 1fr); }
}
</style>
