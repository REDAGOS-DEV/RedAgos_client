<template>
  <main class="dashboard">
    <header class="dashboard-header">
      <h1>Donor Dashboard</h1>
      <p>Manage your donation profile and appointments</p>
    </header>

    <section class="dashboard-grid">
      <div class="card stats-card">
        <div class="stat-item">
          <div class="stat-number">{{ stats.totalDonations }}</div>
          <p class="stat-label">Total Donations</p>
        </div>
      </div>

      <div class="card stats-card">
        <div class="stat-item">
          <div class="stat-number">{{ stats.nextEligibleDate }}</div>
          <p class="stat-label">Days Until Eligible</p>
        </div>
      </div>

      <div class="card stats-card">
        <div class="stat-item">
          <div class="stat-number">{{ stats.upcomingAppointments }}</div>
          <p class="stat-label">Appointments</p>
        </div>
      </div>

      <div class="card action-card">
        <h3>Quick Actions</h3>
        <NuxtLink to="/signup/donor/appointments" class="action-link">
          Book Appointment →
        </NuxtLink>
      </div>
    </section>
  </main>
</template>

<script setup>
import { ref } from 'vue'

const stats = ref({
  totalDonations: 8,
  nextEligibleDate: 15,
  upcomingAppointments: 1,
})
</script>

<style scoped>
main {
  min-height: 100vh;
  background: #f8fafc;
  padding: 40px;
}

.dashboard-header {
  margin-bottom: 40px;
}

.dashboard-header h1 {
  font-size: 32px;
  font-weight: 800;
  color: #1f2937;
  margin-bottom: 8px;
}

.dashboard-header p {
  font-size: 16px;
  color: #64748b;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 24px;
}

.card {
  background: #ffffff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.stats-card {
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-item {
  text-align: center;
}

.stat-number {
  font-size: 48px;
  font-weight: 800;
  color: #ef4444;
  line-height: 1;
}

.stat-label {
  font-size: 14px;
  color: #64748b;
  margin-top: 12px;
}

.action-card h3 {
  margin: 0 0 16px 0;
  font-size: 18px;
  color: #1f2937;
}

.action-link {
  display: inline-block;
  color: #ef4444;
  text-decoration: none;
  font-weight: 700;
  padding: 12px;
  background: #fee2e2;
  border-radius: 8px;
}

.action-link:hover {
  background: #fecaca;
}
</style>