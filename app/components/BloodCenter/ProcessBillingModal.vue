<template>
  <Transition name="modal-fade">
    <div v-if="isOpen" class="modal-overlay" @click.self="$emit('close')">
      <div class="modal-panel">
        
        <!-- Modal Header -->
        <div class="modal-header">
          <div>
            <h3 class="modal-title">
              {{ billData ? (billData.status === 'UNPAID' ? 'Process Payment' : 'Invoice Details') : 'Create New Billing' }}
            </h3>
            <p class="modal-subtitle">
              {{ billData ? `Reference transaction receipt logs.` : 'Generate a new statement account for requesters.' }}
            </p>
          </div>
          <button class="btn-close" @click="$emit('close')">&times;</button>
        </div>

        <!-- STATE 1: VIEW / PROCESS TRANSACTION VIEW -->
        <div v-if="billData" class="modal-body invoice-view">
          <div class="receipt-card">
            <div class="receipt-row">
              <span class="label">Invoice ID:</span>
              <span class="value font-mono">{{ billData.requestId }}</span>
            </div>
            <div class="receipt-row">
              <span class="label">Client / Requester:</span>
              <span class="value">{{ billData.requesterName }}</span>
            </div>
            <div class="receipt-row">
              <span class="label">Billing Date:</span>
              <span class="value">{{ billData.date }}</span>
            </div>
            <hr class="divider" />
            <div class="receipt-row total-row">
              <span class="label">Total Due Amount:</span>
              <span class="value price">₱{{ billData.totalAmount.toLocaleString() }}</span>
            </div>
            <div class="receipt-row status-receipt">
              <span class="label">Payment Status:</span>
              <span class="badge" :class="`badge--${billData.status.toLowerCase()}`">{{ billData.status }}</span>
            </div>
          </div>

          <div class="modal-actions">
            <button type="button" class="btn-text" @click="$emit('close')">Close</button>
            <button 
              v-if="billData.status === 'UNPAID'" 
              type="button" 
              class="btn-submit btn-success" 
              @click="$emit('confirm-payment', billData.id)"
            >
              Confirm & Pay Receipt
            </button>
          </div>
        </div>

        <!-- STATE 2: CREATE NEW BILLING FORM -->
        <form v-else @submit.prevent="handleSubmit" class="modal-form">
          <div class="form-group">
            <label class="form-label">Requester / Institution Name</label>
            <input type="text" v-model="form.requesterName" class="form-input" placeholder="e.g., Cebu Doctors Hospital" required />
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Custom Request ID</label>
              <input type="text" v-model="form.requestId" class="form-input" placeholder="e.g., BILL-004" required />
            </div>

            <div class="form-group">
              <label class="form-label">Total Amount (₱)</label>
              <input type="number" v-model.number="form.totalAmount" class="form-input" placeholder="0.00" min="1" required />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Initial Billing Status</label>
            <select v-model="form.status" class="form-input" required>
              <option value="UNPAID">UNPAID (Pending Collection)</option>
              <option value="PAID">PAID (Settled Immediately)</option>
            </select>
          </div>

          <div class="modal-actions">
            <button type="button" class="btn-text" @click="$emit('close')">Cancel</button>
            <button type="submit" class="btn-submit">Generate Statement</button>
          </div>
        </form>

      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  isOpen: Boolean,
  billData: Object
})

const emit = defineEmits(['close', 'save', 'confirm-payment'])

const initialForm = {
  requestId: '',
  requesterName: '',
  totalAmount: '',
  status: 'UNPAID'
}

const form = ref({ ...initialForm })

watch(() => props.isOpen, (newVal) => {
  if (newVal && !props.billData) {
    form.value = { ...initialForm }
  }
})

function handleSubmit() {
  emit('save', { ...form.value })
}
</script>

<style scoped>
.modal-overlay { position: fixed; inset: 0; background: rgba(17, 24, 39, 0.4); backdrop-filter: blur(2px); display: grid; place-items: center; z-index: 999; }
.modal-panel { background: white; width: 100%; max-width: 480px; border-radius: 16px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); overflow: hidden; border: 1px solid #eef0f3; }
.modal-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 24px 24px 20px; border-bottom: 1px solid #f3f4f6; }
.modal-title { font-size: 18px; font-weight: 700; color: #1f2937; margin: 0; }
.modal-subtitle { font-size: 13px; color: #6b7280; margin: 4px 0 0; }
.btn-close { background: none; border: none; font-size: 24px; color: #9ca3af; cursor: pointer; line-height: 1; }
.btn-close:hover { color: #1f2937; }

/* Form Styles */
.modal-form, .modal-body { padding: 24px; display: flex; flex-direction: column; gap: 20px; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.form-group { display: flex; flex-direction: column; gap: 6px; }
.form-label { font-size: 12.5px; font-weight: 600; color: #4b5563; }
.form-input { padding: 10px 14px; border-radius: 8px; border: 1px solid #d1d5db; font-size: 14px; color: #1f2937; background-color: #f9fafb; outline: none; }
.form-input:focus { border-color: #1565c0; background-color: white; }

/* Receipt Mode View */
.receipt-card { background: #f9fafb; border: 1px dashed #d1d5db; border-radius: 12px; padding: 20px; display: flex; flex-direction: column; gap: 12px; }
.receipt-row { display: flex; justify-content: space-between; font-size: 14px; }
.receipt-row .label { color: #6b7280; }
.receipt-row .value { font-weight: 600; color: #1f2937; }
.font-mono { font-family: monospace; }
.divider { border: none; border-top: 1px dashed #d1d5db; margin: 4px 0; }
.total-row { font-size: 16px; }
.total-row .price { font-weight: 800; color: #1565c0; }
.badge { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 99px; text-transform: uppercase; }
.badge--unpaid { background: #fee2e2; color: #991b1b; }
.badge--paid { background: #dcfce7; color: #166534; }

/* Actions */
.modal-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 8px; }
.btn-text { background: none; border: none; color: #4b5563; font-weight: 600; font-size: 13.5px; padding: 10px 16px; border-radius: 8px; cursor: pointer; }
.btn-text:hover { background: #f3f4f6; }
.btn-submit { background: #1565c0; color: white; border: none; font-weight: 600; font-size: 13.5px; padding: 10px 20px; border-radius: 8px; cursor: pointer; }
.btn-submit:hover { background: #0d47a1; }
.btn-success { background: #166534; }
.btn-success:hover { background: #14532d; }

.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.2s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
</style>