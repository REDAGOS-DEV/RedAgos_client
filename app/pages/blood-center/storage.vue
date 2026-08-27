<template>
  <BloodCenterDepartmentDashboard
    title="Inventory / Storage & Requests"
    subtitle="Record and monitor blood units, and coordinate the fulfillment and release of hospital requests."
    :facility-label="facilityLabel"
    :stats="stats"
    :panels="panels"
  />
</template>

<script setup>
import BloodCenterDepartmentDashboard from '~/components/BloodCenter/DepartmentDashboard.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  requires: 'inventory.create',
})

const { user } = useUser()
const facilityLabel = computed(() => user.value?.facility?.facility_name || '')

// Kini ra nga department ang naay tinuod nga endpoint karon:
// GET /blood-center/inventory/summary. Ang uban nga numero (requests) kay
// `null` gihapon kay wala pay module.
const summary = ref(null)

onMounted(async () => {
  try {
    summary.value = await bloodCenterService.inventorySummary()
  } catch (error) {
    // Ang 403 dinhi kay dili gyud mahitabo — ang department middleware
    // mo-redirect na daan. Ang uban nga sayop kay empty state ra, dili crash.
    console.error('Failed to load inventory summary:', error)
  }
})

const stats = computed(() => [
  { label: 'Available Units', value: summary.value?.totals?.available ?? null, caption: 'Ready for allocation', icon: 'droplets', tone: 'var(--rb-primary)' },
  { label: 'Expiring Soon', value: summary.value?.near_expiry?.within_7_days ?? null, caption: 'Within 7 days', icon: 'alert', tone: 'var(--rb-warning)' },
  { label: 'Reserved', value: summary.value?.totals?.reserved ?? null, caption: 'Allocated to requests', icon: 'package', tone: 'var(--rb-purple)' },
  { label: 'Pending Requests', value: null, caption: 'Awaiting a decision', icon: 'clipboard-check', tone: 'var(--rb-accent)' },
])

const panels = [
  { title: 'Stock by Blood Type', subtitle: 'Available units, FEFO-ordered.', icon: 'droplets',
    link: '/blood-center/inventory', linkLabel: 'Manage inventory',
    emptyTitle: 'No stock recorded',
    emptyBody: 'Units trace back to a completed donation, so stock appears once collection and processing are recording them. The inventory page itself is live.' },
  { title: 'Incoming Requests', subtitle: 'Requests from partner hospitals.', icon: 'clipboard-check',
    link: '/blood-center/bloodrequests', linkLabel: 'Review requests',
    emptyTitle: 'No incoming requests',
    emptyBody: 'The hospital portal that submits these is not implemented yet.' },
  { title: 'Ready for Release', subtitle: 'Approved requests with confirmed payment.', icon: 'building-2',
    link: '/blood-center/fulfillment', linkLabel: 'Fulfillment',
    emptyTitle: 'Nothing ready for release',
    emptyBody: 'No unit is released without confirmed payment, so this fills once billing and allocation are live.' },
]
</script>
