<template>
  <!--
    One blood bank Request History event, opened (2026-11-26), as the blood
    centre's opens: the bag or the patient request it was about, as it stands
    now, and everything that has happened to it.
  -->
  <CenterModal
    :title="title"
    :eyebrow="event.source === 'stock' ? (event.bag_number || event.unit_id) : event.reference"
    size="md"
    @close="$emit('close')"
  >
    <template #meta>
      <span class="ev-meta">
        <span class="ev-kind" :class="`tone--${kind.tone}`">
          <AssetIcon :name="kind.icon" :size="13" />
          {{ kind.label }}
        </span>
        <span class="ev-when">{{ longWhen(event.at) }}<template v-if="event.actor"> · {{ event.actor }}</template></span>
      </span>
    </template>

    <div class="ev">
      <SkeletonList v-if="loading" :rows="4" />

      <p v-else-if="failed" class="ev-note" role="alert">
        <AssetIcon name="circle-alert" :size="15" />
        This bag could not be loaded.
      </p>

      <!-- A bag: where it is now, where it came from, and every movement. -->
      <template v-else-if="event.source === 'stock'">
        <section>
          <h3 class="ev-section">Bag now</h3>
          <dl class="ev-grid">
            <div><dt>Status</dt><dd>{{ unit ? (HOSPITAL_UNIT_STATUS_LABELS[unit.status] || unit.status_label) : 'No longer listed' }}</dd></div>
            <div><dt>Blood type</dt><dd>{{ unit?.blood_type?.code || event.blood_type || '—' }}</dd></div>
            <div><dt>Component</dt><dd>{{ unit?.component?.name || event.component || '—' }}</dd></div>
            <div><dt>Volume</dt><dd>{{ unit?.volume_ml ? `${unit.volume_ml} mL` : '—' }}</dd></div>
            <div>
              <dt>Expires</dt>
              <dd>
                {{ longDate(unit?.expiry_date) }}
                <span v-if="unit?.days_remaining != null && unit.days_remaining >= 0" class="ev-sub">{{ unit.days_remaining }} day{{ unit.days_remaining === 1 ? '' : 's' }} left</span>
              </dd>
            </div>
            <div><dt>Storage</dt><dd>{{ unit?.storage_location || '—' }}</dd></div>
            <div class="ev-grid__wide"><dt>Came from</dt><dd>{{ sourceLabel }}</dd></div>
            <div><dt>Stocked in</dt><dd>{{ longWhen(unit?.stocked_at) || '—' }}<span v-if="unit?.stocked_by" class="ev-sub">by {{ unit.stocked_by }}</span></dd></div>
            <div v-if="unit?.active_tag" class="ev-grid__wide"><dt>Tagged to</dt><dd>{{ unit.active_tag.description }}</dd></div>
            <div v-if="unit?.discard_reason" class="ev-grid__wide"><dt>Discard reason</dt><dd>{{ unit.discard_reason }}</dd></div>
          </dl>
        </section>

        <section>
          <h3 class="ev-section">Movement history</h3>
          <p v-if="!moves.length" class="ev-muted">No recorded movement.</p>
          <ol v-else class="ev-timeline">
            <li v-for="move in moves" :key="move.id" class="ev-step" :class="{ 'ev-step--this': move.id === eventId }">
              <span class="ev-step__icon" :class="`tone--${meta(move.kind).tone}`"><AssetIcon :name="meta(move.kind).icon" :size="13" /></span>
              <span class="ev-step__body">
                <strong>{{ meta(move.kind).label }}<span v-if="move.id === eventId" class="ev-step__this">This event</span></strong>
                <span>{{ longWhen(move.at) }} · {{ move.actor || 'System' }}</span>
              </span>
            </li>
          </ol>
        </section>
      </template>

      <!-- A weekly restock: what was ordered from which center, and how far it got. -->
      <template v-else-if="event.source === 'weekly'">
        <section>
          <h3 class="ev-section">Weekly request</h3>
          <dl class="ev-grid">
            <div><dt>Status</dt><dd>{{ weekly?.status_label || '—' }}</dd></div>
            <div class="ev-grid__wide"><dt>Blood center</dt><dd>{{ event.center || '—' }}</dd></div>
            <div><dt>Requested</dt><dd>{{ weeklyTotals.requested }} unit{{ weeklyTotals.requested === 1 ? '' : 's' }}</dd></div>
            <div><dt>Released</dt><dd>{{ weeklyTotals.fulfilled }}</dd></div>
            <div><dt>Received</dt><dd :class="{ 'ev-warn': weeklyTotals.awaiting_receipt > 0 }">{{ weeklyTotals.received }}<span v-if="weeklyTotals.awaiting_receipt > 0" class="ev-sub">{{ weeklyTotals.awaiting_receipt }} still to receive</span></dd></div>
            <div><dt>Requested by</dt><dd>{{ event.requested_by || '—' }}</dd></div>
            <div v-if="weeklyTotals.not_supplied > 0" class="ev-grid__wide"><dt>Not supplied</dt><dd>{{ weeklyTotals.not_supplied }} unit{{ weeklyTotals.not_supplied === 1 ? '' : 's' }}</dd></div>
          </dl>
          <ul v-if="weeklyLines.length" class="ev-lines">
            <li v-for="(line, i) in weeklyLines" :key="i">
              <span class="ev-lines__type">{{ line.type }}</span>
              {{ line.component }}
              <span class="ev-lines__qty">× {{ line.quantity }}</span>
            </li>
          </ul>
        </section>

        <section>
          <h3 class="ev-section">Progress</h3>
          <ol class="ev-timeline">
            <li v-for="step in weeklySteps" :key="step.label" class="ev-step" :class="{ 'ev-step--todo': !step.at }">
              <span class="ev-step__icon" :class="step.at ? 'tone--success' : ''">
                <AssetIcon :name="step.at ? 'check' : step.icon" :size="13" />
              </span>
              <span class="ev-step__body">
                <strong>{{ step.label }}</strong>
                <span>{{ step.at ? longWhen(step.at) : 'Not yet' }}</span>
              </span>
            </li>
          </ol>
        </section>
      </template>

      <!-- A patient request: what was asked for, and its four steps with their times. -->
      <template v-else>
        <section>
          <h3 class="ev-section">Request</h3>
          <dl class="ev-grid">
            <div><dt>Status</dt><dd>{{ event.status_label || '—' }}</dd></div>
            <div><dt>Priority</dt><dd :class="{ 'ev-crit': event.emergency }">{{ event.emergency ? 'STAT' : 'Routine' }}</dd></div>
            <div><dt>Units</dt><dd>{{ event.units_label || '—' }}</dd></div>
            <div class="ev-grid__wide"><dt>Patient</dt><dd>{{ event.patient || 'Not recorded' }}</dd></div>
            <div><dt>Blood type</dt><dd>{{ event.blood_type || '—' }}</dd></div>
            <div class="ev-grid__wide"><dt>Component</dt><dd>{{ event.component || '—' }}</dd></div>
            <div><dt>Requested by</dt><dd>{{ event.requested_by || '—' }}</dd></div>
            <div v-if="event.facilities" class="ev-grid__wide"><dt>Facilities asked</dt><dd>{{ event.facilities }}</dd></div>
          </dl>
        </section>

        <section>
          <h3 class="ev-section">Progress</h3>
          <TransfusionStepper :request="event.raw" :times="event.raw?.step_times ?? {}" />
        </section>
      </template>
    </div>

    <template #actions>
      <NuxtLink v-if="event.source === 'weekly' && canOpenRequests" :to="`/hospital/receiving/weekly/${event.weekly_id}`" class="ui-btn">
        Open weekly request
        <AssetIcon name="arrow-right" :size="14" />
      </NuxtLink>
      <NuxtLink v-else-if="event.source === 'request' && canOpenRequests" :to="`/hospital/transfusion-requests/${event.request_id}`" class="ui-btn">
        Open request
        <AssetIcon name="arrow-right" :size="14" />
      </NuxtLink>
      <NuxtLink v-else-if="event.source === 'stock'" to="/hospital/inventory" class="ui-btn">
        Open Blood Bank Inventory
        <AssetIcon name="arrow-right" :size="14" />
      </NuxtLink>
    </template>
  </CenterModal>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import CenterModal from '~/components/ui/CenterModal.vue'
import SkeletonList from '~/components/ui/SkeletonList.vue'
import TransfusionStepper from '~/components/Hospital/TransfusionStepper.vue'
import { hospitalService } from '~/api/hospital/HospitalService'
import { hospitalActivityKindMeta } from '~/utils/hospitalInventoryDashboard'
import { HOSPITAL_UNIT_STATUS_LABELS } from '~/types/hospitalInventory'

const props = defineProps({
  // A row of the blood bank's Request History list.
  event: { type: Object, required: true },
  // The request kinds' labels and icons, which the page defines.
  requestKinds: { type: Object, default: () => ({}) },
})
defineEmits(['close'])

const { can } = useUser()
const canOpenRequests = computed(() => can('hospital.requests.view'))

const meta = (kind) => props.requestKinds[kind] ?? hospitalActivityKindMeta(kind)
const kind = computed(() => meta(props.event.kind))
const eventId = computed(() => Number(String(props.event.key ?? '').replace(/^s-/, '')) || null)

const title = computed(() => {
  if (props.event.source === 'weekly') return props.event.center || 'Weekly request'
  if (props.event.source === 'request') return props.event.patient || 'Patient request'
  return [props.event.blood_type, props.event.component].filter(Boolean).join(' · ') || 'Blood bag'
})

// A request row carries everything it shows; only a bag is fetched.
const loading = ref(props.event.source === 'stock')
const failed = ref(false)
const unit = ref(null)
const moves = ref([])

/** Where the bag came from: the request it was received for, or the outside sender. */
const sourceLabel = computed(() => {
  const source = unit.value?.source
  if (!source) return '—'
  if (source.direct_distribution) return source.direct_distribution.source_name || 'Outside RedAgos'
  if (source.transfusion_reference) return `Patient request ${source.transfusion_reference}`
  if (source.weekly_request_id) return `Weekly request${source.reference_number ? ` ${source.reference_number}` : ''}`

  return source.reference_number || '—'
})

// A weekly restock: its figures, what it ordered, and its four steps with their times.
const weekly = computed(() => (props.event.source === 'weekly' ? props.event.raw : null))
const weeklyTotals = computed(() => ({
  requested: 0, fulfilled: 0, received: 0, awaiting_receipt: 0, not_supplied: 0,
  ...(weekly.value?.totals ?? {}),
}))
const weeklyLines = computed(() => (weekly.value?.requests ?? []).flatMap((request) => (request.items ?? []).map((item) => ({
  type: item.blood_type?.code || (request.blood_types ?? [])[0] || request.blood_type?.code || '',
  component: item.component?.name || 'Component',
  quantity: item.quantity,
}))))
const weeklySteps = computed(() => {
  const times = weekly.value?.step_times ?? {}
  return [
    { label: 'Sent', icon: 'send', at: weekly.value?.submitted_at ?? times.submitted ?? null },
    { label: 'Confirmed by the center', icon: 'check-circle', at: times.confirmed ?? null },
    { label: 'Dispatched', icon: 'truck', at: times.released ?? null },
    { label: 'Received', icon: 'package-check', at: times.received ?? null },
  ]
})

onMounted(async () => {
  if (props.event.source !== 'stock') return
  const id = props.event.unit_id
  try {
    const [detail, activity] = await Promise.all([
      hospitalService.inventoryUnit(id).catch(() => null),
      hospitalService.inventoryActivity({ unit_id: id, per_page: 50 }).catch(() => null),
    ])
    if (!detail && !activity) failed.value = true
    unit.value = detail?.unit ?? null
    moves.value = (activity?.data ?? []).filter((move) => !move.unit_id || move.unit_id === id)
  } finally {
    loading.value = false
  }
})

function longDate(value) {
  if (!value) return '—'
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00+08:00`) : new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function longWhen(value) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}
</script>

<style scoped>
.ev { display: flex; flex-direction: column; gap: 22px; }
.ev-meta { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.ev-kind {
  --tone: var(--rb-text-secondary);
  display: inline-flex; align-items: center; gap: 5px; padding: 2px 9px; border-radius: 999px;
  border: 1px solid var(--rb-border); font-size: 12px; font-weight: 700; color: var(--rb-text-primary);
}
.ev-kind :deep(svg) { color: var(--tone); }
.tone--success { --tone: var(--rb-success); }
.tone--danger { --tone: var(--rb-accent); }
.tone--warning { --tone: var(--rb-warning); }
.tone--info { --tone: var(--rb-primary); }
.ev-when { font-size: 12.5px; color: var(--rb-text-secondary); }

.ev-section { margin: 0 0 10px; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--rb-text-secondary); }
.ev-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px 20px; margin: 0; }
.ev-grid dt { margin-bottom: 3px; font-size: 11.5px; color: var(--rb-text-secondary); }
.ev-grid dd { margin: 0; font-size: 13.5px; font-weight: 600; color: var(--rb-text-primary); overflow-wrap: anywhere; }
.ev-grid__wide { grid-column: span 2; }
.ev-sub { display: block; margin-top: 2px; font-size: 11.5px; font-weight: 500; color: var(--rb-text-secondary); }
.ev-crit { color: var(--rb-accent-text) !important; }
.ev-warn { color: var(--rb-warning-text) !important; }

.ev-lines { display: flex; flex-wrap: wrap; gap: 8px; margin: 14px 0 0; padding: 0; list-style: none; }
.ev-lines li {
  display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border: 1px solid var(--rb-border);
  border-radius: 10px; background: var(--rb-surface-alt); font-size: 12.5px; color: var(--rb-text-primary);
}
.ev-lines__type { font-weight: 700; color: var(--rb-accent-text); }
.ev-lines__qty { font-weight: 700; color: var(--rb-text-secondary); }
.ev-step--todo .ev-step__body strong { font-weight: 500; color: var(--rb-text-muted); }

.ev-timeline { display: flex; flex-direction: column; gap: 0; margin: 0; padding: 0; list-style: none; }
.ev-step { position: relative; display: flex; gap: 12px; padding: 0 0 14px; }
.ev-step:not(:last-child)::before { content: ''; position: absolute; left: 13px; top: 28px; bottom: 0; width: 1px; background: var(--rb-border); }
.ev-step__icon {
  --tone: var(--rb-text-secondary);
  display: grid; flex-shrink: 0; place-items: center; width: 28px; height: 28px; border-radius: 50%;
  background: color-mix(in srgb, var(--tone) 12%, var(--rb-surface)); color: var(--tone);
}
.ev-step__body { display: flex; flex-direction: column; gap: 2px; padding-top: 4px; font-size: 12px; color: var(--rb-text-secondary); }
.ev-step__body strong { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: var(--rb-text-primary); }
.ev-step__this { padding: 0 7px; border-radius: 999px; background: rgba(var(--rb-primary-rgb), 0.1); color: var(--rb-primary-text); font-size: 10.5px; font-weight: 700; }
.ev-muted { margin: 0; font-size: 12.5px; color: var(--rb-text-secondary); }
.ev-note { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 13px; color: var(--rb-accent-text); }
</style>
