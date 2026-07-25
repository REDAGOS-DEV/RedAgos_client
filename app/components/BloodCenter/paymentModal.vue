 <template>
  <div v-if="isOpen" class="modal-overlay">
    <div class="modal-content">
      <h3>Process Payment: {{ bill.requestId }}</h3>
      <div class="payment-options">
        <button class="btn-option" @click="confirmPayment('GCash')">GCash</button>
        <button class="btn-option" @click="confirmPayment('Cash')">Cash</button>
      </div>
      <button @click="$emit('close')" class="btn-text">Cancel</button>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
  bill: {
    type: Object,
    default: () => ({ requestId: '' }),
  },
})

const emit = defineEmits(['close', 'confirm'])

function emitClose() {
  emit('close')
}

function confirmPayment(method) {
  emit('confirm', { bill: props.bill, method })
}
</script>

<style scoped>
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: grid; place-items: center; z-index: 100; }
.modal-content { background: white; padding: 24px; border-radius: 12px; width: 400px; }
.payment-options { display: flex; gap: 10px; margin: 20px 0; }
.btn-option { flex: 1; padding: 12px; background: #1565c0; color: white; border: none; border-radius: 8px; cursor: pointer; }
</style>