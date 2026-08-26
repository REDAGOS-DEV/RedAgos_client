<template>
  <BloodCenterDepartmentDashboard
    title="Billing / Payment"
    subtitle="Generate billing statements, record cash and GCash payments, and confirm payment before release."
    :facility-label="facilityLabel"
    :stats="stats"
    :panels="panels"
  />
</template>

<script setup>
import BloodCenterDepartmentDashboard from '~/components/BloodCenter/DepartmentDashboard.vue'

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  requires: 'billing.create',
})

const { user } = useUser()
const facilityLabel = computed(() => user.value?.facility?.facility_name || '')

// Walay mock data diri. Kung wala pay endpoint, `null` ang value ug ang panel
// mao nay mo-explain ngano — mas maayo na kaysa sample number nga mabasa nga
// tinuod.
const stats = computed(() => [
  { label: 'Unpaid', value: null, caption: 'Statements awaiting payment', icon: 'credit-card', tone: 'var(--rb-accent)' },
  { label: 'Partially Paid', value: null, caption: 'Balance outstanding', icon: 'clock', tone: 'var(--rb-warning)' },
  { label: 'Paid Today', value: null, caption: 'Confirmed payments', icon: 'check-circle', tone: 'var(--rb-success)' },
  { label: 'Awaiting Confirmation', value: null, caption: 'Cash pending staff sign-off', icon: 'alert', tone: 'var(--rb-purple)' },
])

const panels = [
  { title: 'Open Statements', subtitle: 'Billing raised against fulfilled requests.', icon: 'credit-card',
    emptyTitle: 'No statements',
    emptyBody: 'Billing is raised against a blood request, and the request module is not built yet.' },
  { title: 'Recent Payments', subtitle: 'Cash and GCash transactions recorded here.', icon: 'receipt',
    emptyTitle: 'No payments recorded',
    emptyBody: 'Payment recording and receipt generation are the next module for this department.' },
]
</script>
