<template>
  <main class="donation-history">
    <header class="page-header">
      <h1>Donation History</h1>
      <p>View your past donations</p>
    </header>

    <div class="history-table">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Blood Center</th>
            <th>Amount Donated</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="donation in donations" :key="donation.id">
            <td>{{ donation.date }}</td>
            <td>{{ donation.center }}</td>
            <td>{{ donation.amount }}</td>
            <td><span :class="['status-badge', `status-${donation.status}`]">{{ donation.status }}</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  </main>
</template>

<script setup>
import { ref } from 'vue'

const donations = ref([
  { id: 1, date: '2026-06-15', center: 'Main Blood Center', amount: '450 ml', status: 'completed' },
  { id: 2, date: '2026-05-20', center: 'Southern Philippines Medical Center', amount: '450 ml', status: 'completed' },
  { id: 3, date: '2026-04-10', center: 'Main Blood Center', amount: '450 ml', status: 'completed' },
  { id: 4, date: '2026-03-15', center: 'Brokenshire Blood Center', amount: '450 ml', status: 'completed' },
  { id: 5, date: '2026-02-20', center: 'Main Blood Center', amount: '450 ml', status: 'completed' },
])
</script>

<style scoped>
main {
  min-height: 100vh;
  background: #f8fafc;
  padding: 40px;
}

.page-header {
  margin-bottom: 40px;
}

.page-header h1 {
  font-size: 32px;
  font-weight: 800;
  color: #1f2937;
  margin-bottom: 8px;
}

.page-header p {
  font-size: 16px;
  color: #64748b;
}

.history-table {
  background: #ffffff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

table {
  width: 100%;
  border-collapse: collapse;
}

th {
  background: #f1f5f9;
  padding: 16px;
  text-align: left;
  font-weight: 700;
  color: #1f2937;
  border-bottom: 1px solid #e2e8f0;
}

td {
  padding: 16px;
  border-bottom: 1px solid #e2e8f0;
}

.status-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.status-completed {
  background: #d1fae5;
  color: #065f46;
}
</style>