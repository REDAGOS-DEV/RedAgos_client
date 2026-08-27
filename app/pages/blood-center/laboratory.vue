<template>
  <BloodCenterDepartmentDashboard
    title="Laboratory / Processing"
    subtitle="Record screening and processing results provided by qualified personnel, and release validated units to inventory."
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
  requires: 'lab.view',
})

const { user } = useUser()
const facilityLabel = computed(() => user.value?.facility?.facility_name || '')

// Walay mock data diri. Kung wala pay endpoint, `null` ang value ug ang panel
// mao nay mo-explain ngano — mas maayo na kaysa sample number nga mabasa nga
// tinuod.
const stats = computed(() => [
  { label: 'Awaiting Screening', value: null, caption: 'Donations registered', icon: 'clipboard-check', tone: 'var(--rb-primary)' },
  { label: 'In Processing', value: null, caption: 'Collected, not yet tested', icon: 'flask-conical', tone: 'var(--rb-warning)' },
  { label: 'Tested', value: null, caption: 'Results recorded', icon: 'check-circle', tone: 'var(--rb-teal)' },
  { label: 'Cleared for Inventory', value: null, caption: 'Completed donations', icon: 'package', tone: 'var(--rb-success)' },
])

const panels = [
  { title: 'Processing Queue', subtitle: 'Donations moving from collection to cleared stock.', icon: 'flask-conical',
    emptyTitle: 'Nothing in the queue',
    emptyBody: 'RedAgos records results produced by qualified healthcare professionals; it does not perform testing itself. The recording endpoints are not built yet.' },
  { title: 'Validated Units', subtitle: 'Units this department has released to inventory.', icon: 'droplets',
    link: '/blood-center/inventory', linkLabel: 'View inventory',
    emptyTitle: 'No units released',
    emptyBody: 'Inventory intake gates on a donation reaching the completed status, which nothing writes yet.' },
]
</script>
