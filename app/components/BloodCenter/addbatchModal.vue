<template>
  <Transition name="modal-fade">
    <div v-if="isOpen" class="modal-overlay" @click.self="$emit('close')">
      <div class="modal-panel">
        <div class="modal-header">
          <div>
            <h3 class="modal-title">{{ editItem ? 'Edit Blood Batch' : 'Add New Blood Batch' }}</h3>
            <p class="modal-subtitle">Modify the fields below to update the blood unit details.</p>
          </div>
          <button class="btn-close" @click="$emit('close')">&times;</button>
        </div>

        <form @submit.prevent="handleSubmit" class="modal-form">
          <div class="form-group">
            <label class="form-label">Blood Component Name</label>
            <select v-model="form.name" class="form-input" required>
              <option value="" disabled>Select component type</option>
              <option value="Packed Red Blood Cells">Packed Red Blood Cells</option>
              <option value="Platelet Concentrate">Platelet Concentrate</option>
              <option value="Fresh Frozen Plasma">Fresh Frozen Plasma</option>
              <option value="Cryoprecipitate">Cryoprecipitate</option>
            </select>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Blood Type</label>
              <select v-model="form.type" class="form-input" required>
                <option value="" disabled>Select Type</option>
                <option v-for="t in ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']" :key="t" :value="t">
                  {{ t }}
                </option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Batch Reference ID</label>
              <!-- Naka-disabled kon mag-edit aron dili mausab ang primary reference ID -->
              <input type="text" v-model="form.id" class="form-input" placeholder="e.g., BLD-9983" :disabled="!!editItem" required />
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Expiry Date</label>
              <input type="date" v-model="form.expiry" class="form-input" required />
            </div>

            <div class="form-group">
              <label class="form-label">Status</label>
              <select v-model="form.status" class="form-input" required>
                <option value="Available">Available</option>
                <option value="Reserved">Reserved</option>
              </select>
            </div>
          </div>

          <div class="modal-actions">
            <button type="button" class="btn-text" @click="$emit('close')">Cancel</button>
            <button type="submit" class="btn-submit">Save Changes</button>
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
  editItem: Object // Nadugangan ug editItem prop control
})

const emit = defineEmits(['close', 'save'])

const initialForm = {
  id: '',
  name: '',
  type: '',
  expiry: '',
  status: 'Available'
}

const form = ref({ ...initialForm })

// Bantayan kung mag change gikan add padung edit state ang parent page
watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    if (props.editItem) {
      // Kung naay editItem data, i-populate ang fields
      form.value = { 
        ...props.editItem,
        // Kon naay rawExpiry gamiton aron mo-display og saktong date ang calendar selector html input
        expiry: props.editItem.rawExpiry || ''
      }
    } else {
      form.value = { ...initialForm }
    }
  }
})

function handleSubmit() {
  const options = { year: 'numeric', month: 'short', day: 'numeric' }
  const formattedDate = new Date(form.value.expiry).toLocaleDateString('en-US', options)
  
  emit('save', {
    ...form.value,
    expiry: formattedDate
  })
}
</script>

<style scoped>
/* Pabilin ra gihapon tanan css variables sa modal sa miaging response */
.modal-overlay { position: fixed; inset: 0; background: rgba(17, 24, 39, 0.4); backdrop-filter: blur(2px); display: grid; place-items: center; z-index: 999; }
.modal-panel { background: white; width: 100%; max-width: 480px; border-radius: 16px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); overflow: hidden; border: 1px solid #eef0f3; }
.modal-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 24px 24px 20px; border-bottom: 1px solid #f3f4f6; }
.modal-title { font-size: 18px; font-weight: 700; color: #1f2937; margin: 0; }
.modal-subtitle { font-size: 13px; color: #6b7280; margin: 4px 0 0; }
.btn-close { background: none; border: none; font-size: 24px; color: #9ca3af; cursor: pointer; line-height: 1; }
.btn-close:hover { color: #1f2937; }
.modal-form { padding: 24px; display: flex; flex-direction: column; gap: 20px; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.form-group { display: flex; flex-direction: column; gap: 6px; }
.form-label { font-size: 12.5px; font-weight: 600; color: #4b5563; }
.form-input { padding: 10px 14px; border-radius: 8px; border: 1px solid #d1d5db; font-size: 14px; color: #1f2937; background-color: #f9fafb; outline: none; }
.form-input:focus { border-color: #1565c0; background-color: white; }
.form-input:disabled { background-color: #e5e7eb; color: #9ca3af; cursor: not-allowed; }
.modal-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 8px; }
.btn-text { background: none; border: none; color: #4b5563; font-weight: 600; font-size: 13.5px; padding: 10px 16px; border-radius: 8px; cursor: pointer; }
.btn-text:hover { background: #f3f4f6; }
.btn-submit { background: #1565c0; color: white; border: none; font-weight: 600; font-size: 13.5px; padding: 10px 20px; border-radius: 8px; cursor: pointer; }
.btn-submit:hover { background: #0d47a1; }
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.25s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
</style>
