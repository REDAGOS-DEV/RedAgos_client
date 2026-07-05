<template>
  <div class="dashboard-content">
    <!-- Welcome -->
    <div class="welcome-block">
      <h1 class="welcome-title">Welcome back, {{ donor.name }}!</h1>
      <p class="welcome-subtitle">You are eligible to donate. Book your next appointment below.</p>
    </div>

    <!-- Eligibility banner -->
    <div v-if="eligibility.isEligible" class="banner banner--success">
      <AssetIcon name="check-circle" :size="20" />
      <span>{{ eligibility.message }}</span>
    </div>

    <!-- Stat cards -->
    <div class="stats-grid">
      <div v-for="stat in stats" :key="stat.label" class="stat-card">
        <p class="stat-value" :class="`stat-value--${stat.variant}`">{{ stat.value }}</p>
        <p class="stat-label">
          <template v-for="(line, i) in stat.label.split('\n')" :key="i">
            {{ line }}<br v-if="i === 0" />
          </template>
        </p>
      </div>
    </div>

    <!-- Appointment + History -->
    <div class="two-col-grid">
      <div class="panel">
        <div class="panel-header">
          <h2 class="panel-title">Upcoming Appointment</h2>
          <button class="btn btn--primary btn--sm">Manage</button>
        </div>
        <div class="appointment-card">
          <div class="date-chip">
            <span class="date-chip__day">{{ upcomingAppointment.day }}</span>
            <span class="date-chip__month">{{ upcomingAppointment.month }}</span>
          </div>
          <div class="appointment-info">
            <p class="appointment-type">{{ upcomingAppointment.type }}</p>
            <p class="appointment-meta">
              {{ upcomingAppointment.location }} · {{ upcomingAppointment.time }}
            </p>
            <p class="appointment-note">{{ upcomingAppointment.note }}</p>
            <div class="appointment-actions">
              <button class="btn btn--primary btn--sm">View QR Code</button>
              <button class="btn btn--ghost btn--sm">Cancel</button>
            </div>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <h2 class="panel-title">Recent Donation History</h2>
          <NuxtLink to="/signup/donor/DonationHistory" class="link">View All →</NuxtLink>
        </div>
        <ul class="history-list">
          <li v-for="(item, i) in donationHistory" :key="i" class="history-item">
            <span class="history-dot" />
            <div class="history-body">
              <p class="history-date">{{ item.date }}</p>
              <p class="history-label">{{ item.label }}</p>
              <p class="history-detail">{{ item.detail }}</p>
            </div>
            <span class="badge badge--success">{{ item.status }}</span>
          </li>
        </ul>
      </div>
    </div>

    <!-- Nearby drives + QR -->
    <div class="two-col-grid two-col-grid--wide">
      <div class="panel">
        <div class="panel-header">
          <h2 class="panel-title">Nearby Donation Drives</h2>
          <NuxtLink to="/signup/donor/DonationDrives" class="link">View All →</NuxtLink>
        </div>
        <div class="drives-grid">
          <div v-for="(drive, i) in nearbyDrives" :key="i" class="drive-card">
            <p class="drive-name">{{ drive.name }}</p>
            <p class="drive-meta">
              <AssetIcon name="map-pin" :size="14" />
              {{ drive.location }}
            </p>
            <p class="drive-meta">
              <AssetIcon name="clock" :size="14" />
              {{ drive.date }}
            </p>
          </div>
        </div>
      </div>

      <div class="panel panel--qr">
        <h2 class="panel-title panel-title--center">Your donor QR code</h2>
        <p class="qr-subtitle">Present at blood center to proceed.</p>
        <div class="qr-frame">
          <AssetIcon name="qr-code" :size="140" />
        </div>
        <p class="qr-code">{{ donor.donorCode }} · {{ donor.name }}</p>
        <p class="qr-status">
          <span class="badge badge--success">{{ donor.qrStatus }}</span>
          Expires {{ donor.qrExpiry }}
        </p>
        <button class="btn btn--primary btn--full">View full QR</button>
      </div>
    </div>
  </div>
</template>

<script setup>
// pages/signup/donor/Dashboard.vue
// Assumes the sidebar + top navbar (search, notifications, profile) live in layouts/dashboard.vue
// This component is the main content area only.

definePageMeta({ layout: 'dashboard' })

// --- Mock data — swap these for real API calls / composables (e.g. useDonor(), useAppointments()) ---
const donor = reactive({
  name: 'Lusi',
  bloodType: 'O+',
  totalDonations: 4,
  qrStatus: 'Valid',
  qrExpiry: 'Apr 30, 2026',
  donorCode: 'DN-0041',
})

const eligibility = reactive({
  isEligible: true,
  message: 'You have a valid eligibility screening pass. Present your QR code at the blood center to proceed with donation.',
})

const upcomingAppointment = reactive({
  day: '20',
  month: 'APR',
  type: 'Walk-in Donation',
  location: 'Sub-National Blood Center',
  time: '10:00 AM slot',
  note: 'Eligibility screening passed · Present QR code on arrival',
})

const donationHistory = ref([
  { date: 'Jan 10, 2026', label: 'Successful donation', detail: 'O+ · Sub-National Blood Center · Walk-in', status: 'Completed' },
  { date: 'Jul 8, 2025', label: 'Successful donation', detail: 'O+ · PRC Davao · Walk-in', status: 'Completed' },
])

const nearbyDrives = ref([
  { name: 'Davao City Hall Community Drive', location: 'Davao City Hall, San Pedro St.', date: 'August 5, 2026' },
  { name: 'SM Lanang Blood Donation', location: 'SM Lanang Premier, J.P. Laurel Ave.', date: 'July 22, 2026' },
  { name: 'Ateneo de Davao Blood Drive', location: 'Ateneo de Davao University, Jacinto St.', date: 'July 15, 2026' },
])

const stats = computed(() => [
  { label: 'Total\nDonations', value: donor.totalDonations, variant: 'primary' },
  { label: 'Blood\nType', value: donor.bloodType, variant: 'accent' },
  { label: 'QR\nStatus', value: donor.qrStatus, variant: 'success' },
  { label: 'Next\nAppointment', value: `${upcomingAppointment.month} ${upcomingAppointment.day}`, variant: 'warning' },
])
</script>

<style scoped>
.dashboard-content {
  --primary: #1565c0;
  --secondary: #42a5f5;
  --bg: #f1f6fb;
  --surface: #ffffff;
  --text-primary: #1f2937;
  --text-secondary: #6b7280;
  --accent: #d32f2f;
  --success: #2e7d32;
  --warning: #f57c00;

  background: var(--bg);
  color: var(--text-primary);
  padding: 32px;
  min-height: 100%;
}

/* Welcome */
.welcome-title {
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 4px;
  color: var(--text-primary);
}
.welcome-subtitle {
  margin: 0 0 20px;
  color: var(--text-secondary);
  font-size: 15px;
}

/* Banner */
.banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 18px;
  border-radius: 10px;
  font-size: 14px;
  margin-bottom: 24px;
}
.banner--success {
  background: color-mix(in srgb, var(--success) 12%, white);
  color: var(--success);
  border: 1px solid color-mix(in srgb, var(--success) 30%, white);
}

/* Stats */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 28px;
}
.stat-card {
  background: var(--surface);
  border-radius: 12px;
  padding: 20px;
  text-align: center;
  box-shadow: 0 1px 3px rgba(31, 41, 55, 0.06);
}
.stat-value {
  font-size: 26px;
  font-weight: 700;
  margin: 0 0 6px;
}
.stat-value--primary { color: var(--primary); }
.stat-value--accent { color: var(--accent); }
.stat-value--success { color: var(--success); }
.stat-value--warning { color: var(--warning); }
.stat-label {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-secondary);
  line-height: 1.4;
}

/* Grids */
.two-col-grid {
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  gap: 20px;
  margin-bottom: 24px;
}
.two-col-grid--wide {
  grid-template-columns: 1.4fr 1fr;
}

/* Panels */
.panel {
  background: var(--surface);
  border-radius: 12px;
  padding: 22px;
  box-shadow: 0 1px 3px rgba(31, 41, 55, 0.06);
}
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.panel-title {
  font-size: 17px;
  font-weight: 700;
  margin: 0;
  color: var(--text-primary);
}
.panel-title--center { text-align: center; }
.link {
  font-size: 13px;
  font-weight: 600;
  color: var(--primary);
  text-decoration: underline;
}

/* Appointment */
.appointment-card {
  display: flex;
  gap: 16px;
}
.date-chip {
  flex-shrink: 0;
  width: 64px;
  height: 64px;
  border-radius: 10px;
  border: 2px solid var(--primary);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--primary);
}
.date-chip__day { font-size: 20px; font-weight: 700; line-height: 1; }
.date-chip__month { font-size: 11px; font-weight: 600; letter-spacing: 0.05em; }
.appointment-type { font-weight: 700; margin: 0 0 4px; }
.appointment-meta { margin: 0 0 4px; font-size: 13px; color: var(--text-secondary); }
.appointment-note { margin: 0 0 12px; font-size: 12px; color: var(--text-secondary); }
.appointment-actions { display: flex; gap: 10px; }

/* Buttons */
.btn {
  border: none;
  border-radius: 8px;
  padding: 9px 16px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: filter 0.15s ease;
}
.btn:hover { filter: brightness(0.94); }
.btn--primary { background: var(--primary); color: white; }
.btn--ghost { background: var(--bg); color: var(--text-primary); }
.btn--sm { padding: 7px 14px; }
.btn--full { width: 100%; margin-top: 14px; }

/* History */
.history-list { list-style: none; margin: 0; padding: 0; }
.history-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--bg);
}
.history-item:last-child { border-bottom: none; }
.history-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--success);
  margin-top: 6px;
  flex-shrink: 0;
}
.history-body { flex: 1; min-width: 0; }
.history-date { font-size: 12px; color: var(--text-secondary); margin: 0 0 2px; }
.history-label { font-weight: 600; margin: 0 0 2px; font-size: 14px; }
.history-detail { font-size: 12px; color: var(--text-secondary); margin: 0; }

.badge {
  font-size: 11px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 20px;
  white-space: nowrap;
}
.badge--success {
  background: color-mix(in srgb, var(--success) 14%, white);
  color: var(--success);
}

/* Drives */
.drives-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}
.drive-card {
  background: var(--bg);
  border-radius: 10px;
  padding: 14px;
}
.drive-name { font-weight: 700; font-size: 13px; margin: 0 0 8px; }
.drive-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
  margin: 0 0 4px;
}

/* QR panel */
.panel--qr {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.qr-subtitle { font-size: 12px; color: var(--text-secondary); margin: 2px 0 16px; }
.qr-frame {
  width: 160px;
  height: 160px;
  border-radius: 10px;
  border: 1px solid var(--bg);
  background: var(--bg);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 14px;
}
.qr-code { font-weight: 700; font-size: 14px; margin: 0 0 8px; }
.qr-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-secondary);
  margin: 0;
}

/* Responsive */
@media (max-width: 1024px) {
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
  .two-col-grid,
  .two-col-grid--wide { grid-template-columns: 1fr; }
  .drives-grid { grid-template-columns: 1fr; }
}
@media (max-width: 640px) {
  .dashboard-content { padding: 20px 16px; }
  .stats-grid { grid-template-columns: 1fr 1fr; gap: 10px; }
  .stat-card { padding: 14px; }
}
</style>