<template>
  <BloodCenterDepartmentDashboard
    title="Donor / Collection"
    subtitle="Register donors, verify appointments, record donations, and run mobile drives."
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
  requires: 'donors.manage',
})

const { user } = useUser()
const facilityLabel = computed(() => user.value?.facility?.facility_name || '')

// Walay mock data diri. Kung wala pay endpoint, `null` ang value ug ang panel
// mao nay mo-explain ngano — mas maayo na kaysa sample number nga mabasa nga
// tinuod.
const stats = computed(() => [
  { label: 'Appointments Today', value: null, caption: 'Booked at this center', icon: 'calendar', tone: 'var(--rb-primary)' },
  { label: 'Awaiting Check-In', value: null, caption: 'Donors yet to arrive', icon: 'clock', tone: 'var(--rb-warning)' },
  { label: 'Donations Recorded', value: null, caption: 'Collected today', icon: 'heart', tone: 'var(--rb-accent)' },
  { label: 'Upcoming Drives', value: null, caption: 'Scheduled mobile events', icon: 'truck', tone: 'var(--rb-purple)' },
])

const panels = [
  { title: 'Check-In Queue', subtitle: 'Donors verified by QR or ID, waiting to donate.', icon: 'qr-code',
    link: '/blood-center/appointments', linkLabel: 'Appointments',
    emptyTitle: 'No check-in queue yet',
    emptyBody: 'Staff-side appointment verification and QR check-in are not built yet, so nothing can be queued.' },
  { title: 'Recent Donations', subtitle: 'Collections recorded at this center.', icon: 'droplets',
    link: '/blood-center/donors', linkLabel: 'Donors',
    emptyTitle: 'No donations recorded',
    emptyBody: 'Recording a completed donation is the next module for this department.' },
  { title: 'Mobile Drives', subtitle: 'Scheduled and in-progress donation drives.', icon: 'truck',
    link: '/blood-center/drives', linkLabel: 'Drives',
    emptyTitle: 'No drives scheduled',
    emptyBody: 'Drive management has no backend yet; the page is a UI shell.' },
]
</script>
