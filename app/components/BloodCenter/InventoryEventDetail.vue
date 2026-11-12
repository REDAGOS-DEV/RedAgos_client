<template>
  <!--
    One Inventory History event, opened (project owner, 2026-11-11): the unit
    or the request it was about, as it stands now, and everything that has
    happened to it. Read from what the server already sends.
  -->
  <CenterModal
    :title="title"
    :eyebrow="event.source === 'request' ? event.reference : event.unit_id"
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
        {{ event.source === 'request' ? 'This request could not be loaded.' : 'This unit could not be loaded.' }}
      </p>

      <!-- A unit: where it is now, and every movement. -->
      <template v-else-if="event.source === 'stock'">
        <section>
          <h3 class="ev-section">Unit now</h3>
          <dl class="ev-grid">
            <div><dt>Status</dt><dd>{{ unit ? statusLabel(unit) : 'No longer listed' }}</dd></div>
            <div><dt>Blood type</dt><dd>{{ unit?.blood_type?.code || event.blood_type || '—' }}</dd></div>
            <div><dt>Component</dt><dd>{{ unit?.component?.name || event.component || '—' }}</dd></div>
            <div><dt>Volume</dt><dd>{{ unit?.volume_ml ? `${unit.volume_ml} mL` : '—' }}</dd></div>
            <div><dt>Collected</dt><dd>{{ longDate(unit?.collected_at) }}</dd></div>
            <div>
              <dt>Expires</dt>
              <dd>
                {{ longDate(unit?.expiry_date) }}
                <span v-if="unit?.days_remaining != null && unit.days_remaining >= 0" class="ev-sub">{{ unit.days_remaining }} day{{ unit.days_remaining === 1 ? '' : 's' }} left</span>
              </dd>
            </div>
            <div><dt>Storage</dt><dd>{{ unit?.storage_location || '—' }}</dd></div>
            <div><dt>Donation</dt><dd>{{ unit?.donation_id ? `#${unit.donation_id}` : '—' }}</dd></div>
            <div><dt>Booked in</dt><dd>{{ longWhen(unit?.recorded_at) || '—' }}</dd></div>
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

      <!-- A request: who asked for what, where it stands, and what happened to it. -->
      <template v-else>
        <section>
          <h3 class="ev-section">Request</h3>
          <dl class="ev-grid">
            <div><dt>Status</dt><dd>{{ request?.status_label || event.status_label || '—' }}</dd></div>
            <div><dt>Priority</dt><dd :class="{ 'ev-crit': request?.is_emergency }">{{ request?.is_emergency ? 'Emergency' : 'Routine' }}</dd></div>
            <div><dt>Type</dt><dd>{{ request?.request_purpose === 'replenishment' ? 'Replenishment order' : 'Patient request' }}</dd></div>
            <div class="ev-grid__wide"><dt>Hospital</dt><dd>{{ request?.requesting_facility?.name || event.hospital || '—' }}</dd></div>
            <div v-if="request?.patient?.full_name"><dt>Patient</dt><dd>{{ request.patient.full_name }}</dd></div>
            <div><dt>Requested by</dt><dd>{{ request?.requester_name || (request?.is_walk_in ? 'Walk-in' : '—') }}</dd></div>
            <div><dt>Units</dt><dd>{{ request?.fulfilled_quantity ?? 0 }} of {{ request?.quantity ?? '—' }} issued</dd></div>
            <div v-if="request?.rejection_reason" class="ev-grid__wide"><dt>Rejected because</dt><dd>{{ request.rejection_reason }}</dd></div>
          </dl>
          <ul v-if="request?.items?.length" class="ev-lines">
            <li v-for="item in request.items" :key="item.id">
              <span class="ev-lines__type">{{ item.blood_type?.code || (request.blood_types || [])[0] || '' }}</span>
              {{ item.component?.name || 'Component' }}
              <span class="ev-lines__qty">× {{ item.quantity }}</span>
            </li>
          </ul>
        </section>

        <section>
          <h3 class="ev-section">History</h3>
          <RequestHistoryTimeline :events="history" :loading="false" :error="historyError" />
        </section>
      </template>
    </div>

    <template v-if="event.source === 'request' && canOpenRequests" #actions>
      <NuxtLink :to="`/blood-center/bloodrequests${request?.request_purpose === 'replenishment' ? '?type=replenishment' : ''}`" class="ui-btn">
        Open Incoming Requests
        <AssetIcon name="arrow-right" :size="14" />
      </NuxtLink>
    </template>
  </CenterModal>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import CenterModal from '~/components/ui/CenterModal.vue'
import SkeletonList from '~/components/ui/SkeletonList.vue'
import RequestHistoryTimeline from '~/components/common/RequestHistoryTimeline.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import { activityKindMeta, unitStatusTag } from '~/utils/inventoryDashboard'

const props = defineProps({
  // A row of the Inventory History list.
  event: { type: Object, required: true },
  // The request kinds' labels and icons, which the page defines.
  requestKinds: { type: Object, default: () => ({}) },
})
defineEmits(['close'])

const { can } = useUser()
const canOpenRequests = computed(() => can('requests.view'))

const meta = (kind) => props.requestKinds[kind] ?? activityKindMeta(kind)
const kind = computed(() => meta(props.event.kind))
const eventId = computed(() => Number(String(props.event.key ?? '').replace(/^s-/, '')) || null)

const title = computed(() => {
  if (props.event.source === 'request') return props.event.hospital || 'Blood request'
  return [props.event.blood_type, props.event.component].filter(Boolean).join(' · ') || 'Blood unit'
})

const loading = ref(true)
const failed = ref(false)
const unit = ref(null)
const moves = ref([])
const request = ref(null)
const history = ref([])
const historyError = ref('')

function statusLabel(row) {
  return unitStatusTag(row.status, row.days_remaining ?? null).label
}

async function loadUnit() {
  const id = props.event.unit_id
  const [list, activity] = await Promise.all([
    bloodCenterService.inventory({ search: id, per_page: 10 }).catch(() => null),
    bloodCenterService.inventoryActivity({ unit_id: id, per_page: 50 }).catch(() => null),
  ])
  if (!list && !activity) failed.value = true
  unit.value = (list?.data ?? []).find((row) => row.id === id) ?? null
  moves.value = (activity?.data ?? []).filter((move) => !move.unit_id || move.unit_id === id)
}

async function loadRequest() {
  const id = props.event.request_id
  const [review, events] = await Promise.all([
    bloodCenterService.reviewRequest(id).catch(() => null),
    bloodCenterService.requestHistory(id).catch(() => null),
  ])
  if (!review) failed.value = true
  request.value = review?.request ?? null
  history.value = events?.events ?? []
  historyError.value = events ? '' : 'The history could not be loaded.'
}

onMounted(async () => {
  try {
    await (props.event.source === 'request' ? loadRequest() : loadUnit())
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

.ev-lines { display: flex; flex-wrap: wrap; gap: 8px; margin: 14px 0 0; padding: 0; list-style: none; }
.ev-lines li {
  display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border: 1px solid var(--rb-border);
  border-radius: 10px; background: var(--rb-surface-alt); font-size: 12.5px; color: var(--rb-text-primary);
}
.ev-lines__type { font-weight: 700; color: var(--rb-accent-text); }
.ev-lines__qty { font-weight: 700; color: var(--rb-text-secondary); }

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
