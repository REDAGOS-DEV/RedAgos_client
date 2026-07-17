<template>
  <div class="billing-page">
    <!-- Header Section -->
    <div class="header-row fade-in" style="--delay: 0ms">
      <div>
        <h1 class="page-title">Billing & Payments</h1>
        <p class="page-subtitle">Process payments and verify transactions.</p>
      </div>
      <button class="btn-primary">
        + New Billing
      </button>
    </div>

    <!-- Main Content Panel -->
    <div class="panel fade-in" style="--delay: 100ms">
      <div v-for="bill in bills" :key="bill.id" class="notif-row">
        
        <!-- Left: Status Icon Indicator -->
        <div class="notif-row__icon" :class="`notif-row__icon--${bill.status.toLowerCase()}`">
          <AssetIcon :name="bill.status === 'PAID' ? 'check' : 'alert-circle'" :size="16" />
        </div>

        <!-- Center: Billing Details -->
        <div class="notif-row__content">
          <p class="notif-row__title">Request #{{ bill.requestId }} — {{ bill.requesterName }}</p>
          <p class="notif-row__meta">Total: ₱{{ bill.totalAmount.toLocaleString() }} • {{ bill.date }}</p>
        </div>

        <!-- Right: Status Tag & Action Button -->
        <div class="notif-row__side">
          <span class="notif-tag" :class="`notif-tag--${bill.status.toLowerCase()}`">
            {{ bill.status }}
          </span>
          <button class="notif-row__action" @click="processPayment(bill)">
            {{ bill.status === 'UNPAID' ? 'Process' : 'View' }}
          </button>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import AssetIcon from '~/components/common/AssetIcon.vue'

definePageMeta({
  middleware: 'auth',
  layout: 'blood-centerdashboard',
})

const bills = ref([
  { id: 1, requestId: 'BILL-001', requesterName: 'Saint Mary Hospital', totalAmount: 14200, date: 'Jul 10, 2026', status: 'UNPAID' },
  { id: 2, requestId: 'BILL-002', requesterName: 'City General Clinic', totalAmount: 8200, date: 'Jul 8, 2026', status: 'PAID' },
  { id: 3, requestId: 'BILL-003', requesterName: 'Green Cross Lab', totalAmount: 5400, date: 'Jul 5, 2026', status: 'PAID' },
])

function processPayment(bill) {
  if (bill.status === 'UNPAID') {
    bill.status = 'PAID'
  }
}
</script>

<style scoped>
/* Base Layout Structure */
.billing-page {
  max-width: 1152px;
  margin: 0 auto;
  padding: 24px 32px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.page-title {
  font-size: 22px;
  font-weight: 700;
  color: #1f2937;
  margin: 0;
}

.page-subtitle {
  font-size: 13.5px;
  color: #6b7280;
  margin: 4px 0 0;
}

.btn-primary {
  background: #1565c0;
  color: white;
  padding: 10px 18px;
  border-radius: 10px;
  border: none;
  font-weight: 600;
  font-size: 13.5px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.btn-primary:hover {
  background: #0d47a1;
}

/* Main White Container Block */
.panel {
  background: white;
  border-radius: 14px;
  border: 1px solid #eef0f3;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
}

/* Row & Alignment Vibe */
.notif-row {
  display: flex;
  align-items: center;
  padding: 18px 24px;
  border-bottom: 1px solid #f3f4f6;
  transition: background-color 0.15s ease;
}

.notif-row:last-child {
  border-bottom: none;
}

.notif-row:hover {
  background-color: #f9fafb;
}

.notif-row__icon {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 18px;
  flex-shrink: 0;
}

.notif-row__icon--unpaid {
  background: #fee2e2;
  color: #b91c1c;
}

.notif-row__icon--paid {
  background: #dcfce7;
  color: #15803d;
}

.notif-row__content {
  flex: 1;
}

.notif-row__title {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.notif-row__meta {
  font-size: 12.5px;
  color: #6b7280;
  margin: 3px 0 0;
}

/* Right side configuration */
.notif-row__side {
  display: flex;
  align-items: center;
  gap: 16px;
}

.notif-tag {
  font-size: 11px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 999px;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.notif-tag--unpaid {
  background: #fef2f2;
  color: #991b1b;
}

.notif-tag--paid {
  background: #f0fdf4;
  color: #166534;
}

.notif-row__action {
  border: none;
  background: none;
  color: #1565c0;
  font-weight: 700;
  cursor: pointer;
  font-size: 13px;
  padding: 4px 8px;
  border-radius: 6px;
  transition: background-color 0.15s ease;
}

.notif-row__action:hover {
  background-color: #f0f6ff;
  text-decoration: underline;
}

/* CSS Keyframe Animation Integration */
.fade-in {
  animation: fadeIn 0.4s ease forwards;
  opacity: 0;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
  </style>
  