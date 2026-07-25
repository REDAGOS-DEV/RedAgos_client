<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="modelValue" class="modal-overlay" @click.self="close">
        <Transition name="modal-pop" appear>
          <div class="modal-card" role="dialog" aria-modal="true" aria-label="New Blood Request">
            <!-- Header -->
            <div class="modal-header">
              <div>
                <h2 class="modal-title">New Blood Request</h2>
                <p class="modal-subtitle">Submit a blood requirement for a patient</p>
              </div>
              <button type="button" class="modal-close" @click="close" aria-label="Close">
                <AssetIcon name="x" :size="16" />
              </button>
            </div>

            <!-- Skeleton loading state -->
            <div v-if="loadingReference" class="modal-body">
              <div class="form-skeleton">
                <div class="skeleton skeleton--field" v-for="n in 6" :key="n" />
              </div>
            </div>

            <div v-else class="modal-body">
              <p v-if="errorMessage" class="error-banner">
                <AssetIcon name="alert" :size="15" />
                {{ errorMessage }}
              </p>

              <!-- Form -->
              <form class="modal-form" @submit.prevent="submit">
                <div class="form-grid">
                  <label class="field">
                    <span class="field__label">Blood type</span>
                    <select v-model="form.blood_type_id" required class="field__input">
                      <option value="" disabled>Select blood type</option>
                      <option v-for="type in bloodTypes" :key="type.id" :value="type.id">
                        {{ type.code || type.name }}
                      </option>
                    </select>
                  </label>

                  <label class="field">
                    <span class="field__label">Component</span>
                    <select v-model="form.component_id" required class="field__input">
                      <option value="" disabled>Select component</option>
                      <option v-for="component in components" :key="component.id" :value="component.id">
                        {{ component.name }}
                      </option>
                    </select>
                  </label>

                  <label class="field">
                    <span class="field__label">Patient name</span>
                    <input v-model.trim="form.patient_name" required class="field__input" placeholder="Juan Dela Cruz" />
                  </label>

                  <label class="field">
                    <span class="field__label">Patient ID <span class="field__optional">(optional)</span></span>
                    <input v-model.trim="form.patient_identifier" class="field__input" placeholder="e.g. HN-0042" />
                  </label>

                  <label class="field">
                    <span class="field__label">Quantity (units)</span>
                    <input v-model.number="form.quantity" required min="1" type="number" class="field__input" />
                  </label>

                  <label class="field">
                    <span class="field__label">Ward / Department <span class="field__optional">(optional)</span></span>
                    <input v-model.trim="form.ward" class="field__input" placeholder="e.g. ICU, Surgery" />
                  </label>

                  <div class="field field--full">
                    <span class="field__label">Urgency</span>
                    <div class="urgency-toggle">
                      <button
                        type="button"
                        class="urgency-toggle__option"
                        :class="{ 'urgency-toggle__option--active': form.urgency_level === 'routine' }"
                        @click="form.urgency_level = 'routine'"
                      >
                        <AssetIcon name="clock" :size="14" />
                        Routine
                      </button>
                      <button
                        type="button"
                        class="urgency-toggle__option urgency-toggle__option--emergency"
                        :class="{ 'urgency-toggle__option--active-emergency': form.urgency_level === 'emergency' }"
                        @click="form.urgency_level = 'emergency'"
                      >
                        <AssetIcon name="alert" :size="14" />
                        Emergency
                      </button>
                    </div>
                  </div>
                </div>

                <div class="form-actions">
                  <button type="button" class="btn-text" @click="close">Cancel</button>
                  <button :disabled="saving" class="btn-primary" type="submit">
                    <AssetIcon v-if="!saving" name="send" :size="14" />
                    {{ saving ? 'Submitting…' : 'Submit Request' }}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, reactive, ref, watch, onMounted, onBeforeUnmount } from 'vue';
import AssetIcon from '~/components/common/AssetIcon.vue';
import { hospitalService } from '~/api/hospital/HospitalService';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue', 'created']);

const loadingReference = ref(true);
const saving = ref(false);
const errorMessage = ref('');

const reference = ref(null);
const bloodTypes = computed(() => reference.value?.blood_types || []);
const components = computed(() => reference.value?.blood_components || []);

function freshForm() {
  return {
    blood_type_id: '',
    component_id: '',
    patient_name: '',
    patient_identifier: '',
    quantity: 1,
    ward: '',
    urgency_level: 'routine',
  };
}

const form = reactive(freshForm());

async function loadReferenceData() {
  loadingReference.value = true;
  errorMessage.value = '';
  try {
    // // Dev note: referenceData() kay mag-fetch sa blood types ug components
    // // gikan sa GET /hospital/reference-data endpoint
    reference.value = await hospitalService.referenceData();
  } catch (err) {
    errorMessage.value = err.message || 'Unable to load reference data.';
  } finally {
    loadingReference.value = false;
  }
}

// Fetch reference data (once) and reset the form each time the modal opens
watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      Object.assign(form, freshForm());
      errorMessage.value = '';
      if (!reference.value) loadReferenceData();
    }
  }
);

onMounted(() => {
  document.addEventListener('keydown', onKeydown);
  if (props.modelValue) loadReferenceData();
});

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown);
});

function onKeydown(e) {
  if (e.key === 'Escape' && props.modelValue) close();
}

function close() {
  if (saving.value) return;
  emit('update:modelValue', false);
}

async function submit() {
  saving.value = true;
  errorMessage.value = '';
  try {
    const request = await hospitalService.createRequest(form);
    emit('created', request);
    emit('update:modelValue', false);
  } catch (error) {
    errorMessage.value = error.message || 'Unable to submit the request.';
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.modal-overlay {
  --primary: #1565c0;
  --accent: #d32f2f;
  --success: #2e7d32;
  --warning: #f57c00;
  --text-primary: #1f2937;
  --text-secondary: #94a3b8;
  --border: #eef1f5;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.modal-card {
  background: #F7F8FA;
  border-radius: 16px;
  width: 100%;
  max-width: 720px;
  max-height: min(88vh, 720px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(15, 23, 42, 0.25);
  transition: background-color 0.2s ease;
}

.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 22px 24px 18px;
  border-bottom: 1px solid var(--border);
  background: white;
  flex-shrink: 0;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}
.modal-title {
  font-size: 19px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--text-primary);
  margin: 0;
}
.modal-subtitle {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 3px 0 0;
}
.modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: white;
  color: var(--text-secondary);
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s ease;
}
.modal-close:hover { background: #f8fafc; color: var(--text-primary); }

.modal-body {
  padding: 22px 24px 24px;
  overflow-y: auto;
}

.skeleton {
  background: linear-gradient(90deg, #eef1f5 25%, #f6f8fa 37%, #eef1f5 63%);
  background-size: 400% 100%;
  border-radius: 10px;
  animation: shimmer 1.4s ease infinite;
}
.skeleton--field { height: 56px; }
.form-skeleton {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}
@keyframes shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}
@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none !important; }
}

.error-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #D32F2F14;
  color: #D32F2F;
  border-radius: 10px;
  padding: 12px 14px;
  font-size: 13px;
  font-weight: 500;
  margin: 0 0 16px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 18px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field--full {
  grid-column: 1 / -1;
}

.field__label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-primary);
}
.field__optional {
  font-weight: 400;
  color: var(--text-secondary);
}

.field__input {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 13.5px;
  color: var(--text-primary);
  background: white;
  outline: none;
  transition: border-color 0.15s ease, background-color 0.2s ease;
}
.field__input:focus {
  border-color: #1565C060;
}

.urgency-toggle {
  display: flex;
  gap: 10px;
}

.urgency-toggle__option {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  border-radius: 10px;
  border: 1.5px solid var(--border);
  background: white;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.urgency-toggle__option--active {
  border-color: #1565C0;
  background: #1565C014;
  color: var(--primary);
}

.urgency-toggle__option--active-emergency {
  border-color: #D32F2F;
  background: #D32F2F14;
  color: #D32F2F;
}

.form-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 22px;
  padding-top: 18px;
  border-top: 1px solid var(--border);
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 10px 20px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  color: white;
  background: var(--primary);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
  transition: opacity 0.15s ease, transform 0.15s ease;
  border: none;
  cursor: pointer;
}
.btn-primary:hover:not(:disabled) { opacity: 0.92; transform: translateY(-1px); }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-primary:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }

.btn-text {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  background: none;
  border: none;
  cursor: pointer;
  padding: 10px 14px;
}
.btn-text:hover { color: var(--text-primary); }

/* Transitions */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.18s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-pop-enter-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.modal-pop-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.modal-pop-enter-from,
.modal-pop-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.98);
}

@media (prefers-reduced-motion: reduce) {
  .modal-fade-enter-active,
  .modal-fade-leave-active,
  .modal-pop-enter-active,
  .modal-pop-leave-active {
    transition: none !important;
  }
}

/* Responsive */
@media (max-width: 640px) {
  .modal-overlay { padding: 0; align-items: flex-end; }
  .modal-card {
    max-width: 100%;
    max-height: 92vh;
    border-radius: 16px 16px 0 0;
  }
  .form-grid { grid-template-columns: 1fr; }
  .form-skeleton { grid-template-columns: 1fr; }
  .urgency-toggle { flex-direction: column; }
}

/* Dark mode */
:global(.dark .modal-overlay) {
  --text-primary: #F1F5F9;
  --text-secondary: #94A3B8;
  --border: #334155;
}
:global(.dark .modal-card) { background: #0F172A; }
:global(.dark .modal-header) {
  background: #1E293B;
  border-color: #334155;
}
:global(.dark .modal-close) {
  background: #1E293B;
  border-color: #334155;
}
:global(.dark .modal-close:hover) { background: #263449; }
:global(.dark .field__input),
:global(.dark .urgency-toggle__option) {
  background: #1E293B;
  border-color: #334155;
}
:global(.dark .field__input) { color: #F1F5F9; }
:global(.dark .urgency-toggle__option--active) {
  border-color: #64B5F6;
  background: #42A5F529;
  color: #64B5F6;
}
:global(.dark .urgency-toggle__option--active-emergency) {
  border-color: #EF5350;
  background: #D32F2F29;
  color: #EF9A9A;
}
:global(.dark .form-actions) { border-color: #334155; }
:global(.dark .skeleton) {
  background: linear-gradient(90deg, #1E293B 25%, #263449 37%, #1E293B 63%);
}
</style>