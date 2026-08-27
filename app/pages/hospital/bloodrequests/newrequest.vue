<template>
  <div class="new-request-page">
    <!-- Loading skeleton -->
    <div v-if="loadingReference" class="page-inner">
      <div class="skeleton skeleton--header" />
      <div class="skeleton skeleton--stepper" />
      <div class="wizard-grid">
        <div class="skeleton skeleton--panel" style="height:480px" />
        <div class="skeleton skeleton--panel" style="height:480px" />
      </div>
    </div>

    <div v-else class="page-inner">
      <!-- Page header -->
      <header class="page-header fade-in" style="--delay:0ms">
        <div class="page-header__left">
          <NuxtLink to="/hospital/bloodrequests" class="back-link">
            <AssetIcon name="arrow-left" :size="15" />
            Back to Blood Requests
          </NuxtLink>
          <h1 class="page-title">New Blood Request</h1>
          <p class="page-subtitle">Complete the information below to submit a blood request to the Blood Center.</p>
        </div>
        <div class="page-header__right">
          <span v-if="step < 5" class="draft-badge">
            <span class="draft-badge__dot" />
            Draft &middot; Unsaved Changes
          </span>
        </div>
      </header>

      <!-- Stepper -->
      <div v-if="step <= 5" class="stepper fade-in" style="--delay:40ms">
        <div v-for="(s, i) in steps" :key="s.key" class="stepper__item">
          <div class="stepper__node-wrap">
            <div class="stepper__node" :class="{
              'stepper__node--done': step > i + 1,
              'stepper__node--current': step === i + 1,
            }">
              <AssetIcon v-if="step > i + 1" name="check" :size="14" />
              <AssetIcon v-else :name="s.icon" :size="14" />
            </div>
            <span v-if="i !== steps.length - 1" class="stepper__line" :class="{ 'stepper__line--done': step > i + 1 }" />
          </div>
          <div class="stepper__label">
            <span class="stepper__label-step">Step {{ i + 1 }}</span>
            <span class="stepper__label-title" :class="{ 'stepper__label-title--current': step === i + 1 }">{{ s.title }}</span>
          </div>
        </div>
      </div>

      <div class="wizard-grid">
        <!-- Left column: form -->
        <div class="wizard-main">
          <!-- STEP 1: Request Information -->
          <section v-if="step === 1" class="panel fade-in" style="--delay:80ms">
            <div class="panel-head">
              <h2 class="panel-head__title">Request Information</h2>
              <p class="panel-head__subtitle">Basic details about who is requesting and when it's needed.</p>
            </div>

            <div class="form-grid">
              <label class="field">
                <span class="field__label">Hospital Department <span class="field__required">*</span></span>
                <select v-model="form.department_id" class="field__input" :class="{ 'field__input--error': touched.step1 && !form.department_id }">
                  <option value="" disabled>Select department</option>
                  <option v-for="d in departments" :key="d.id" :value="d.id">{{ d.name }}</option>
                </select>
                <span v-if="touched.step1 && !form.department_id" class="field__error">Hospital department is required.</span>
              </label>

              <label class="field">
                <span class="field__label">Requesting Physician <span class="field__required">*</span></span>
                <select v-model="form.physician_id" class="field__input" :class="{ 'field__input--error': touched.step1 && !form.physician_id }">
                  <option value="" disabled>Select physician</option>
                  <option v-for="p in physicians" :key="p.id" :value="p.id">{{ p.name }}</option>
                </select>
                <span v-if="touched.step1 && !form.physician_id" class="field__error">Requesting physician is required.</span>
              </label>

              <label class="field">
                <span class="field__label">Patient Reference Number <span class="field__optional">(optional)</span></span>
                <input v-model.trim="form.patient_reference" type="text" class="field__input" placeholder="e.g. HN-0042" />
              </label>

              <label class="field">
                <span class="field__label">Required Date <span class="field__required">*</span></span>
                <input v-model="form.required_date" type="date" :min="todayIso" class="field__input"
                  :class="{ 'field__input--error': touched.step1 && !form.required_date }" />
                <span v-if="touched.step1 && !form.required_date" class="field__error">Required date is required.</span>
              </label>

              <div class="field field--full">
                <span class="field__label">Priority <span class="field__required">*</span></span>
                <div class="priority-toggle">
                  <button v-for="p in priorityOptions" :key="p.value" type="button" class="priority-toggle__option"
                    :class="{ 'priority-toggle__option--active': form.priority === p.value }"
                    :style="form.priority === p.value ? { borderColor: p.color, background: `${p.color}14`, color: p.color } : {}"
                    @click="form.priority = p.value">
                    <AssetIcon :name="p.icon" :size="14" />
                    {{ p.label }}
                  </button>
                </div>
              </div>

              <label class="field field--full">
                <span class="field__label">Purpose of Request <span class="field__required">*</span></span>
                <input v-model.trim="form.purpose" type="text" class="field__input" placeholder="e.g. Scheduled surgery, transfusion support"
                  :class="{ 'field__input--error': touched.step1 && !form.purpose }" />
                <span v-if="touched.step1 && !form.purpose" class="field__error">Purpose of request is required.</span>
              </label>

              <label class="field field--full">
                <span class="field__label">Request Notes <span class="field__optional">(optional)</span></span>
                <textarea v-model.trim="form.notes" rows="3" class="field__input field__input--textarea"
                  placeholder="Any additional context for the Blood Center..." />
              </label>
            </div>
          </section>

          <!-- STEP 2: Blood Details -->
          <section v-if="step === 2" class="panel fade-in" style="--delay:80ms">
            <div class="panel-head">
              <h2 class="panel-head__title">Blood Details</h2>
              <p class="panel-head__subtitle">Specify the blood type, component, and quantity needed.</p>
            </div>

            <div class="form-grid">
              <label class="field">
                <span class="field__label">Blood Type <span class="field__required">*</span></span>
                <select v-model="form.blood_type_id" class="field__input" :class="{ 'field__input--error': touched.step2 && !form.blood_type_id }">
                  <option value="" disabled>Select blood type</option>
                  <option v-for="t in bloodTypes" :key="t.id" :value="t.id">{{ t.code || t.name }}</option>
                </select>
                <span v-if="touched.step2 && !form.blood_type_id" class="field__error">Blood type is required.</span>
              </label>

              <label class="field">
                <span class="field__label">Blood Component <span class="field__required">*</span></span>
                <select v-model="form.component_id" class="field__input" :class="{ 'field__input--error': touched.step2 && !form.component_id }">
                  <option value="" disabled>Select component</option>
                  <option v-for="c in components" :key="c.id" :value="c.id">{{ c.name }}</option>
                </select>
                <span v-if="touched.step2 && !form.component_id" class="field__error">Blood component is required.</span>
              </label>

              <label class="field">
                <span class="field__label">Units Requested <span class="field__required">*</span></span>
                <input v-model.number="form.units" type="number" min="1" class="field__input"
                  :class="{ 'field__input--error': touched.step2 && (!form.units || form.units < 1) }" />
                <span v-if="touched.step2 && (!form.units || form.units < 1)" class="field__error">Enter at least 1 unit.</span>
              </label>

              <div class="field">
                <span class="field__label">Estimated Availability</span>
                <div v-if="selectedAvailability" class="availability-inline"
                  :style="{ color: availabilityStatusColor(selectedAvailability.status) }">
                  <AssetIcon name="droplets" :size="14" />
                  {{ selectedAvailability.units }} units {{ availabilityStatusLabel(selectedAvailability.status) }}
                </div>
                <div v-else class="availability-inline availability-inline--muted">
                  <AssetIcon name="info" :size="14" />
                  Select a blood type to check availability
                </div>
              </div>

              <label class="field field--full">
                <span class="field__label">Reason for Blood Request <span class="field__required">*</span></span>
                <textarea v-model.trim="form.blood_reason" rows="3" class="field__input field__input--textarea"
                  placeholder="Why is this blood product needed?"
                  :class="{ 'field__input--error': touched.step2 && !form.blood_reason }" />
                <span v-if="touched.step2 && !form.blood_reason" class="field__error">Reason for blood request is required.</span>
              </label>
            </div>
          </section>

          <!-- STEP 3: Clinical Information -->
          <section v-if="step === 3" class="panel fade-in" style="--delay:80ms">
            <div class="panel-head">
              <h2 class="panel-head__title">Clinical Information</h2>
              <p class="panel-head__subtitle">Provide clinical context to support the request review.</p>
            </div>

            <div class="form-grid">
              <label class="field field--full">
                <span class="field__label">Clinical Indication <span class="field__required">*</span></span>
                <textarea v-model.trim="form.clinical_indication" rows="3" class="field__input field__input--textarea"
                  placeholder="Describe the clinical indication for transfusion..."
                  :class="{ 'field__input--error': touched.step3 && !form.clinical_indication }" />
                <span v-if="touched.step3 && !form.clinical_indication" class="field__error">Clinical indication is required.</span>
              </label>

              <label class="field field--full">
                <span class="field__label">Diagnosis <span class="field__optional">(optional)</span></span>
                <textarea v-model.trim="form.diagnosis" rows="3" class="field__input field__input--textarea"
                  placeholder="Primary diagnosis or working impression..." />
              </label>

              <div class="field field--full">
                <span class="field__label">Supporting Documents <span class="field__optional">(optional)</span></span>
                <div class="uploader" :class="{ 'uploader--dragover': isDragOver }"
                  @dragover.prevent="isDragOver = true" @dragleave.prevent="isDragOver = false" @drop.prevent="handleDrop"
                  @click="fileInput?.click()">
                  <AssetIcon name="cloud-upload" :size="26" class="uploader__icon" />
                  <p class="uploader__title">Drag & drop files here, or click to browse</p>
                  <p class="uploader__hint">Accepted: PDF, DOCX, images</p>
                  <input ref="fileInput" type="file" multiple accept=".pdf,.doc,.docx,image/*" class="uploader__input" @change="handleFileSelect" />
                </div>

                <div v-if="attachments.length" class="attachment-list">
                  <div v-for="att in attachments" :key="att.id" class="attachment-row">
                    <AssetIcon name="file-text" :size="16" class="attachment-row__icon" />
                    <div class="attachment-row__info">
                      <p class="attachment-row__name">{{ att.name }}</p>
                      <div class="attachment-row__progress-track">
                        <div class="attachment-row__progress-fill" :style="{
                          width: `${att.progress}%`,
                          background: att.status === 'error' ? 'var(--danger)' : 'var(--primary)'
                        }" />
                      </div>
                    </div>
                    <span class="attachment-row__status">
                      <AssetIcon v-if="att.status === 'done'" name="check-circle" :size="15" style="color:#2E7D32" />
                      <AssetIcon v-else-if="att.status === 'error'" name="triangle-alert" :size="15" style="color:#D32F2F" />
                      <span v-else class="attachment-row__percent">{{ att.progress }}%</span>
                    </span>
                    <button type="button" class="attachment-row__remove" @click="removeAttachment(att.id)" aria-label="Remove file">
                      <AssetIcon name="x" :size="14" />
                    </button>
                  </div>
                </div>
                <p v-else class="uploader__empty">No files uploaded.</p>
              </div>
            </div>
          </section>

          <!-- STEP 4: Review -->
          <section v-if="step === 4" class="panel fade-in" style="--delay:80ms">
            <div class="panel-head">
              <h2 class="panel-head__title">Review Request</h2>
              <p class="panel-head__subtitle">Verify all details before submitting to the Blood Center.</p>
            </div>

            <div v-if="missingRequiredFields.length" class="review-warning">
              <AssetIcon name="triangle-alert" :size="16" />
              <span>Missing required information: {{ missingRequiredFields.join(', ') }}</span>
            </div>

            <dl class="summary-grid">
              <div class="summary-field">
                <dt>Department</dt>
                <dd>{{ departmentName || '—' }}</dd>
              </div>
              <div class="summary-field">
                <dt>Physician</dt>
                <dd>{{ physicianName || '—' }}</dd>
              </div>
              <div class="summary-field">
                <dt>Blood Type</dt>
                <dd>{{ bloodTypeName || '—' }}</dd>
              </div>
              <div class="summary-field">
                <dt>Component</dt>
                <dd>{{ componentName || '—' }}</dd>
              </div>
              <div class="summary-field">
                <dt>Units</dt>
                <dd>{{ form.units || '—' }}</dd>
              </div>
              <div class="summary-field">
                <dt>Priority</dt>
                <dd>
                  <span class="priority-chip" :style="{ color: priorityColor(form.priority), background: `${priorityColor(form.priority)}14` }">
                    {{ priorityLabel(form.priority) }}
                  </span>
                </dd>
              </div>
              <div class="summary-field">
                <dt>Required Date</dt>
                <dd>{{ formatDate(form.required_date) || '—' }}</dd>
              </div>
              <div class="summary-field">
                <dt>Documents Attached</dt>
                <dd>{{ attachments.length }} file{{ attachments.length !== 1 ? 's' : '' }}</dd>
              </div>
              <div class="summary-field summary-field--full">
                <dt>Clinical Indication</dt>
                <dd>{{ form.clinical_indication || '—' }}</dd>
              </div>
            </dl>

            <div class="checklist">
              <p class="checklist__title">Submission Checklist</p>
              <div v-for="item in checklistItems" :key="item.label" class="checklist__item">
                <AssetIcon :name="item.ok ? 'check-circle' : 'circle'" :size="15" :style="{ color: item.ok ? '#2E7D32' : '#CBD5E1' }" />
                <span :class="{ 'checklist__item--muted': !item.ok }">{{ item.label }}</span>
              </div>
            </div>
          </section>

          <!-- STEP 5: Submit / Success -->
          <section v-if="step === 5" class="panel panel--success fade-in" style="--delay:80ms">
            <div v-if="submitting" class="success-state">
              <div class="success-spinner" />
              <p class="success-state__title">Submitting your request…</p>
            </div>

            <div v-else-if="submitError" class="success-state">
              <div class="success-icon success-icon--error">
                <AssetIcon name="triangle-alert" :size="30" />
              </div>
              <h2 class="success-state__title">Submission Failed</h2>
              <p class="success-state__desc">{{ submitError }}</p>
              <button type="button" class="btn-primary" @click="submitRequest">Try Again</button>
            </div>

            <div v-else-if="submissionResult" class="success-state">
              <div class="success-icon">
                <AssetIcon name="check" :size="30" />
              </div>
              <h2 class="success-state__title">Blood Request Submitted Successfully</h2>
              <p class="success-state__desc">Your request has been sent to the Blood Center for review.</p>

              <div class="success-details">
                <div class="success-details__row">
                  <span>Reference Number</span>
                  <strong>{{ submissionResult.reference_number }}</strong>
                </div>
                <div class="success-details__row">
                  <span>Current Status</span>
                  <span class="badge" style="background:#F59E0B14;color:#F59E0B">{{ submissionResult.status_label || 'Pending Approval' }}</span>
                </div>
                <div class="success-details__row">
                  <span>Estimated Processing Time</span>
                  <strong>{{ submissionResult.estimated_processing_time || '—' }}</strong>
                </div>
              </div>

              <div class="success-actions">
                <NuxtLink :to="`/hospital/bloodrequests/${submissionResult.id}`" class="btn-primary">View Request</NuxtLink>
                <button type="button" class="btn-secondary" @click="resetForm">Create Another Request</button>
                <NuxtLink to="/hospital/bloodrequests" class="btn-text">Return to Blood Requests</NuxtLink>
              </div>
            </div>
          </section>
        </div>

        <!-- Right column: info cards -->
        <aside class="wizard-side">
          <!-- Blood availability -->
          <div class="panel side-panel fade-in" style="--delay:100ms">
            <div class="panel-head panel-head--sm">
              <h3 class="panel-head__title panel-head__title--sm">Blood Availability</h3>
            </div>
            <div v-if="loadingAvailability" class="side-panel__loading">
              <div class="skeleton skeleton--row" v-for="n in 4" :key="n" />
            </div>
            <div v-else-if="availability.length" class="availability-list">
              <div v-for="a in availability" :key="a.blood_type" class="availability-row">
                <span class="availability-row__type">{{ a.blood_type }}</span>
                <div class="availability-row__bar-track">
                  <div class="availability-row__bar-fill" :style="{
                    width: `${availabilityPercent(a)}%`,
                    background: availabilityStatusColor(a.status)
                  }" />
                </div>
                <span class="availability-row__units">{{ a.units }}</span>
                <span class="availability-row__status" :style="{ color: availabilityStatusColor(a.status) }">
                  {{ availabilityStatusLabel(a.status) }}
                </span>
              </div>
            </div>
            <p v-else class="side-panel__empty">No availability information at this time.</p>
          </div>

          <!-- Guidelines -->
          <div class="panel side-panel fade-in" style="--delay:140ms">
            <div class="panel-head panel-head--sm">
              <h3 class="panel-head__title panel-head__title--sm">Submission Guidelines</h3>
            </div>
            <ul class="guideline-list">
              <li v-for="g in guidelines" :key="g">
                <AssetIcon name="info" :size="13" />
                {{ g }}
              </li>
            </ul>
          </div>

          <!-- Timeline -->
          <div class="panel side-panel fade-in" style="--delay:180ms">
            <div class="panel-head panel-head--sm">
              <h3 class="panel-head__title panel-head__title--sm">Estimated Processing Timeline</h3>
            </div>
            <div class="timeline-list">
              <div v-for="(t, i) in processingTimeline" :key="t.label" class="timeline-row">
                <div class="timeline-row__rail">
                  <span class="timeline-row__dot" />
                  <span v-if="i !== processingTimeline.length - 1" class="timeline-row__line" />
                </div>
                <div class="timeline-row__body">
                  <p class="timeline-row__label">{{ t.label }}</p>
                  <p v-if="t.duration" class="timeline-row__duration">{{ t.duration }}</p>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>

    <!-- Sticky bottom action bar -->
    <div v-if="!loadingReference && step <= 4" class="action-bar">
      <button v-if="step > 1" type="button" class="btn-secondary" @click="prevStep">
        <AssetIcon name="arrow-left" :size="14" /> Previous Step
      </button>
      <span v-else />

      <div class="action-bar__right">
        <button type="button" class="btn-text" @click="saveDraft" :disabled="savingDraft">
          {{ savingDraft ? 'Saving…' : 'Save as Draft' }}
        </button>
        <button v-if="step < 4" type="button" class="btn-primary" @click="nextStep">
          Next Step <AssetIcon name="arrow-right" :size="14" />
        </button>
        <button v-else type="button" class="btn-primary" :disabled="!canSubmit" @click="handleFinalSubmit">
          <AssetIcon name="send" :size="14" /> Submit Request
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import AssetIcon from '~/components/common/AssetIcon.vue';
import { hospitalService } from '~/api/hospital/HospitalService';

definePageMeta({ middleware: 'auth', layout: 'hospitaldashboard' });

const loadingReference = ref(true);
const loadingAvailability = ref(true);

// ---------- Reference data  ----------
const departments = ref([]);
const physicians = ref([]);
const bloodTypes = ref([]);
const components = ref([]);
const availability = ref([]);

const guidelines = ref([]);
const processingTimeline = ref([]);

const todayIso = new Date().toISOString().slice(0, 10);

onMounted(async () => {
  try {
    // referenceData() kay mag-return unta og
    // { blood_types, blood_components, departments, physicians }
    // gikan sa GET /hospital/reference-data endpoint
    const ref_ = await hospitalService.referenceData();
    bloodTypes.value = ref_?.blood_types || [];
    components.value = ref_?.blood_components || [];
    departments.value = ref_?.departments || [];
    physicians.value = ref_?.physicians || [];
  } catch (err) {
    console.error('Failed to load reference data:', err);
  } finally {
    loadingReference.value = false;
  }

  try {
    // bloodAvailabilitySummary() kay mag-fetch sa GET /hospital/blood-availability-summary
    // nga mag-return og array sa { blood_type, units, status } per blood type
    const data = await hospitalService.bloodAvailabilitySummary();
    availability.value = data?.availability ?? data ?? [];
  } catch (err) {
    console.error('Failed to load blood availability:', err);
  } finally {
    loadingAvailability.value = false;
  }

  try {
    // submissionGuidelines() ug processingTimeline() kay
    // mag-fetch sa policy/config endpoints (e.g. GET /hospital/request-policy)
    // para dili static ang reminders ug ang stage durations
    const policy = await hospitalService.requestSubmissionPolicy?.();
    guidelines.value = policy?.guidelines ?? [];
    processingTimeline.value = policy?.processing_timeline ?? [];
  } catch (err) {
    console.error('Failed to load submission policy:', err);
  }
});

// ---------- Steps ----------
const steps = [
  { key: 'request', title: 'Request Information', icon: 'clipboard-list' },
  { key: 'blood', title: 'Blood Details', icon: 'droplets' },
  { key: 'clinical', title: 'Clinical Information', icon: 'stethoscope' },
  { key: 'review', title: 'Review', icon: 'eye' },
  { key: 'submit', title: 'Submit', icon: 'send' },
];

const step = ref(1);
const touched = reactive({ step1: false, step2: false, step3: false });

const priorityOptions = [
  { value: 'normal', label: 'Normal', color: '#1565C0', icon: 'clock' },
  { value: 'urgent', label: 'Urgent', color: '#F59E0B', icon: 'circle-alert' },
  { value: 'emergency', label: 'Emergency', color: '#D32F2F', icon: 'triangle-alert' },
];

function priorityColor(value) { return priorityOptions.find(p => p.value === value)?.color || '#64748B'; }
function priorityLabel(value) { return priorityOptions.find(p => p.value === value)?.label || value; }

// ---------- Form state ----------
const form = reactive({
  department_id: '',
  physician_id: '',
  patient_reference: '',
  priority: 'normal',
  required_date: '',
  purpose: '',
  notes: '',
  blood_type_id: '',
  component_id: '',
  units: 1,
  blood_reason: '',
  clinical_indication: '',
  diagnosis: '',
});

const departmentName = computed(() => departments.value.find(d => d.id === form.department_id)?.name || '');
const physicianName = computed(() => physicians.value.find(p => p.id === form.physician_id)?.name || '');
const bloodTypeName = computed(() => {
  const t = bloodTypes.value.find(t => t.id === form.blood_type_id);
  return t ? (t.code || t.name) : '';
});
const componentName = computed(() => components.value.find(c => c.id === form.component_id)?.name || '');

const selectedAvailability = computed(() => {
  if (!bloodTypeName.value) return null;
  return availability.value.find(a => a.blood_type === bloodTypeName.value) || null;
});

function availabilityPercent(a) {
  const max = Math.max(1, ...availability.value.map(x => x.units));
  return Math.min(100, Math.round((a.units / max) * 100));
}
function availabilityStatusColor(status) {
  return { healthy: '#2E7D32', low: '#F59E0B', critical: '#D32F2F' }[status] || '#64748B';
}
function availabilityStatusLabel(status) {
  return { healthy: 'available', low: 'running low', critical: 'critically low' }[status] || status;
}

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ---------- Validation per step ----------
const step1Valid = computed(() => !!(form.department_id && form.physician_id && form.required_date && form.purpose));
const step2Valid = computed(() => !!(form.blood_type_id && form.component_id && form.units >= 1 && form.blood_reason));
const step3Valid = computed(() => !!form.clinical_indication);

const missingRequiredFields = computed(() => {
  const missing = [];
  if (!form.department_id) missing.push('Hospital Department');
  if (!form.physician_id) missing.push('Requesting Physician');
  if (!form.blood_type_id) missing.push('Blood Type');
  if (!form.component_id) missing.push('Blood Component');
  if (!form.units || form.units < 1) missing.push('Units Requested');
  if (!form.priority) missing.push('Priority');
  if (!form.clinical_indication) missing.push('Clinical Justification');
  if (!form.required_date) missing.push('Required Date');
  return missing;
});

const checklistItems = computed(() => [
  { label: 'Hospital Department', ok: !!form.department_id },
  { label: 'Blood Type', ok: !!form.blood_type_id },
  { label: 'Blood Component', ok: !!form.component_id },
  { label: 'Units Requested', ok: form.units >= 1 },
  { label: 'Priority', ok: !!form.priority },
  { label: 'Clinical Justification', ok: !!form.clinical_indication },
  { label: 'Required Date', ok: !!form.required_date },
]);

const canSubmit = computed(() => missingRequiredFields.value.length === 0);

// ---------- Step navigation ----------
function nextStep() {
  if (step.value === 1) {
    touched.step1 = true;
    if (!step1Valid.value) return;
  }
  if (step.value === 2) {
    touched.step2 = true;
    if (!step2Valid.value) return;
  }
  if (step.value === 3) {
    touched.step3 = true;
    if (!step3Valid.value) return;
  }
  step.value = Math.min(4, step.value + 1);
}
function prevStep() {
  step.value = Math.max(1, step.value - 1);
}

// ---------- Draft save ----------
const savingDraft = ref(false);
async function saveDraft() {
  savingDraft.value = true;
  try {
    // saveRequestDraft() kay mag-POST/PUT sa GET /hospital/requests/drafts
    // para ma-resume later ang request nga wala pa na-submit
    await hospitalService.saveRequestDraft?.({ ...form, attachment_ids: attachments.value.map(a => a.id) });
  } catch (err) {
    console.error('Failed to save draft:', err);
  } finally {
    savingDraft.value = false;
  }
}

// ---------- File upload ----------
const fileInput = ref(null);
const isDragOver = ref(false);
const attachments = ref([]);

function handleDrop(e) {
  isDragOver.value = false;
  uploadFiles(Array.from(e.dataTransfer.files || []));
}
function handleFileSelect(e) {
  uploadFiles(Array.from(e.target.files || []));
  e.target.value = '';
}

function uploadFiles(files) {
  for (const file of files) {
    const id = `${Date.now()}-${file.name}`;
    const entry = reactive({ id, name: file.name, progress: 0, status: 'uploading' });
    attachments.value.push(entry);
    uploadOne(file, entry);
  }
}

function uploadOne(file, entry) {
  // real upload progress via XHR against
  // POST /hospital/requests/attachments — i-align ang endpoint/field name
  // sa backend team. hospitalService.uploadDocument gamit XHR para tinuod
  // ang progress %, dili simulated.
  if (typeof hospitalService.uploadDocument !== 'function') {
    entry.status = 'error';
    entry.progress = 0;
    console.error('hospitalService.uploadDocument is not implemented yet.');
    return;
  }
  hospitalService.uploadDocument(file, {
    onProgress: (percent) => { entry.progress = percent; },
  }).then((res) => {
    entry.progress = 100;
    entry.status = 'done';
    entry.id = res?.id ?? entry.id;
  }).catch((err) => {
    console.error('Failed to upload document:', err);
    entry.status = 'error';
  });
}

function removeAttachment(id) {
  attachments.value = attachments.value.filter(a => a.id !== id);
}

// ---------- Submit ----------
const submitting = ref(false);
const submitError = ref('');
const submissionResult = ref(null);

function handleFinalSubmit() {
  if (!canSubmit.value) return;
  step.value = 5;
  submitRequest();
}

async function submitRequest() {
  submitting.value = true;
  submitError.value = '';
  submissionResult.value = null;
  try {
    const payload = {
      ...form,
      attachment_ids: attachments.value.filter(a => a.status === 'done').map(a => a.id),
    };
    const res = await hospitalService.createRequest(payload);
    submissionResult.value = res?.data ?? res;
  } catch (err) {
    submitError.value = err?.message || 'Unable to submit the request. Please try again.';
  } finally {
    submitting.value = false;
  }
}

function resetForm() {
  Object.assign(form, {
    department_id: '', physician_id: '', patient_reference: '', priority: 'normal',
    required_date: '', purpose: '', notes: '', blood_type_id: '', component_id: '',
    units: 1, blood_reason: '', clinical_indication: '', diagnosis: '',
  });
  attachments.value = [];
  touched.step1 = touched.step2 = touched.step3 = false;
  submissionResult.value = null;
  submitError.value = '';
  step.value = 1;
}
</script>

<style scoped>
.new-request-page {
  --primary: #1565c0;
  --primary-hover: #0d47a1;
  --bg: #f7f9fc;
  --surface: #ffffff;
  --border: #e5eaf0;
  --text-primary: #1e293b;
  --text-secondary: #64748b;
  --text-muted: #94a3b8;
  --danger: #d32f2f;
  --warning: #f59e0b;
  --success: #2e7d32;
  --purple: #7c3aed;
  font-family: var(--rb-font-sans);
  max-width: 1400px;
  background: var(--bg);
  margin: 0 auto;
  padding: 32px 32px 100px;
}

.page-inner { display: flex; flex-direction: column; gap: 22px; }

/* Skeleton */
.skeleton {
  background: linear-gradient(90deg, #eef1f5 25%, #f6f8fa 37%, #eef1f5 63%);
  background-size: 400% 100%;
  border-radius: 14px;
  animation: shimmer 1.4s ease infinite;
}
.skeleton--header { height: 70px; max-width: 420px; }
.skeleton--stepper { height: 60px; }
.skeleton--panel { border-radius: 18px; }
.skeleton--row { height: 30px; margin-bottom: 8px; }
@keyframes shimmer { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }

.fade-in { animation: fadeInUp 0.4s ease both; animation-delay: var(--delay, 0ms); }
@keyframes fadeInUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@media (prefers-reduced-motion: reduce) { .fade-in, .skeleton { animation: none !important; } }

/* Header */
.page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.back-link {
  display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600;
  color: var(--text-secondary); text-decoration: none; margin-bottom: 10px;
}
.back-link:hover { color: var(--primary); }
.page-title { font-size: 30px; font-weight: 700; color: var(--text-primary); margin: 0; letter-spacing: -0.01em; }
.page-subtitle { font-size: 15px; color: var(--text-secondary); margin: 6px 0 0; }

.draft-badge {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 8px 14px; border-radius: 999px; background: #F59E0B14; color: #F59E0B;
  font-size: 12.5px; font-weight: 600;
}
.draft-badge__dot { width: 6px; height: 6px; border-radius: 999px; background: #F59E0B; }

/* Stepper */
.stepper { display: flex; align-items: flex-start; gap: 4px; }
.stepper__item { flex: 1; display: flex; flex-direction: column; align-items: flex-start; }
.stepper__node-wrap { display: flex; align-items: center; width: 100%; }
.stepper__node {
  width: 32px; height: 32px; border-radius: 999px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  background: #e2e8f0; color: #94a3b8;
  transition: background 0.2s ease, color 0.2s ease;
}
.stepper__node--current { background: var(--primary); color: #fff; }
.stepper__node--done { background: var(--success); color: #fff; }
.stepper__line { flex: 1; height: 2px; background: var(--border); margin: 0 6px; transition: background 0.2s ease; }
.stepper__line--done { background: var(--success); }
.stepper__label { margin-top: 8px; display: flex; flex-direction: column; }
.stepper__label-step { font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; color: var(--text-muted); }
.stepper__label-title { font-size: 12.5px; font-weight: 600; color: var(--text-secondary); }
.stepper__label-title--current { color: var(--primary); }

/* Layout */
.wizard-grid { display: grid; grid-template-columns: 2.3fr 1fr; gap: 22px; align-items: start; }
.wizard-main { display: flex; flex-direction: column; gap: 20px; }
.wizard-side { display: flex; flex-direction: column; gap: 18px; }

/* Panel */
.panel {
  background: var(--surface); border-radius: 18px; padding: 24px;
  border: 1px solid var(--border); box-shadow: 0 4px 20px rgba(15,23,42,0.05);
  transition: background-color 0.2s ease, border-color 0.2s ease;
}
.panel-head { margin-bottom: 20px; }
.panel-head--sm { margin-bottom: 14px; }
.panel-head__title { font-size: 18px; font-weight: 700; color: var(--text-primary); margin: 0; }
.panel-head__title--sm { font-size: 14.5px; }
.panel-head__subtitle { font-size: 13px; color: var(--text-secondary); margin: 4px 0 0; }

.side-panel { padding: 18px; }

/* Form */
.form-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 18px; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field--full { grid-column: 1 / -1; }
.field__label { font-size: 14px; font-weight: 600; color: var(--text-primary); }
.field__optional { font-weight: 400; color: var(--text-muted); }
.field__required { color: var(--danger); }

.field__input {
  border: 1px solid var(--border); border-radius: 10px; padding: 11px 12px;
  font-size: 14px; color: var(--text-primary); background: white; outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  font-family: inherit;
}
.field__input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px #1565C014; }
.field__input--error { border-color: var(--danger); }
.field__input--error:focus { box-shadow: 0 0 0 3px #D32F2F14; }
.field__input--textarea { resize: vertical; min-height: 80px; }
.field__error { font-size: 11.5px; color: var(--danger); font-weight: 500; }

.priority-toggle { display: flex; gap: 10px; }
.priority-toggle__option {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 7px;
  padding: 11px; border-radius: 10px; border: 1.5px solid var(--border);
  background: white; font-size: 13.5px; font-weight: 600; color: var(--text-secondary);
  cursor: pointer; transition: all 0.15s ease;
}
.priority-toggle__option--active { border-width: 1.5px; }

.availability-inline { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; padding-top: 4px; }
.availability-inline--muted { color: var(--text-muted); font-weight: 500; }

/* Uploader */
.uploader {
  border: 2px dashed var(--border); border-radius: 14px; padding: 28px 20px;
  display: flex; flex-direction: column; align-items: center; text-align: center; gap: 4px;
  cursor: pointer; transition: border-color 0.15s ease, background 0.15s ease;
}
.uploader:hover, .uploader--dragover { border-color: var(--primary); background: #1565C00A; }
.uploader__icon { color: var(--text-muted); margin-bottom: 6px; }
.uploader__title { font-size: 13.5px; font-weight: 600; color: var(--text-primary); margin: 0; }
.uploader__hint { font-size: 12px; color: var(--text-muted); margin: 0; }
.uploader__input { display: none; }
.uploader__empty { font-size: 12.5px; color: var(--text-muted); margin: 10px 0 0; }

.attachment-list { margin-top: 14px; display: flex; flex-direction: column; gap: 8px; }
.attachment-row { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 10px; background: #f8fafc; }
.attachment-row__icon { color: var(--text-muted); flex-shrink: 0; }
.attachment-row__info { flex: 1; min-width: 0; }
.attachment-row__name { font-size: 12.5px; font-weight: 600; color: var(--text-primary); margin: 0 0 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.attachment-row__progress-track { height: 4px; border-radius: 999px; background: var(--border); overflow: hidden; }
.attachment-row__progress-fill { height: 100%; border-radius: 999px; transition: width 0.2s ease; }
.attachment-row__status { flex-shrink: 0; width: 32px; text-align: center; }
.attachment-row__percent { font-size: 11px; font-weight: 700; color: var(--text-muted); }
.attachment-row__remove { flex-shrink: 0; background: none; border: none; color: var(--text-muted); cursor: pointer; display: flex; }
.attachment-row__remove:hover { color: var(--danger); }

/* Review */
.review-warning {
  display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 10px;
  background: #F59E0B14; color: #B45309; font-size: 13px; font-weight: 500; margin-bottom: 18px;
}
.summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin: 0 0 22px; }
.summary-field { display: flex; flex-direction: column; gap: 3px; }
.summary-field--full { grid-column: 1 / -1; }
.summary-field dt { font-size: 11.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; color: var(--text-muted); margin: 0; }
.summary-field dd { font-size: 14px; font-weight: 500; color: var(--text-primary); margin: 0; }

.checklist { border-top: 1px solid var(--border); padding-top: 18px; }
.checklist__title { font-size: 13px; font-weight: 700; color: var(--text-primary); margin: 0 0 10px; }
.checklist__item { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-primary); padding: 4px 0; }
.checklist__item--muted { color: var(--text-muted); }

.priority-chip { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; }

/* Success state */
.panel--success { display: flex; align-items: center; justify-content: center; min-height: 420px; }
.success-state { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 6px; max-width: 420px; }
.success-icon {
  width: 64px; height: 64px; border-radius: 999px; background: #2E7D3214; color: var(--success);
  display: flex; align-items: center; justify-content: center; margin-bottom: 10px;
}
.success-icon--error { background: #D32F2F14; color: var(--danger); }
.success-spinner {
  width: 40px; height: 40px; border-radius: 999px; border: 3px solid var(--border);
  border-top-color: var(--primary); animation: spin 0.8s linear infinite; margin-bottom: 14px;
}
@keyframes spin { to { transform: rotate(360deg); } }
.success-state__title { font-size: 19px; font-weight: 700; color: var(--text-primary); margin: 0; }
.success-state__desc { font-size: 13.5px; color: var(--text-secondary); margin: 4px 0 18px; }

.success-details { width: 100%; display: flex; flex-direction: column; gap: 10px; margin-bottom: 22px; }
.success-details__row {
  display: flex; align-items: center; justify-content: space-between; padding: 10px 14px;
  border-radius: 10px; background: #f8fafc; font-size: 13px; color: var(--text-secondary);
}
.success-details__row strong { color: var(--text-primary); font-size: 13.5px; }

.badge { font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 999px; }

.success-actions { display: flex; flex-direction: column; gap: 10px; width: 100%; }

/* Buttons */
.btn-primary {
  display: inline-flex; align-items: center; justify-content: center; gap: 7px;
  height: 48px; padding: 0 20px; border-radius: 14px;
  font-family: inherit; font-size: 15px; font-weight: 600; color: #fff;
  background: var(--primary); border: none; cursor: pointer;
  transition: background 0.15s ease, transform 0.15s ease; text-decoration: none;
}
.btn-primary:hover:not(:disabled) { background: var(--primary-hover); transform: translateY(-1px); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-secondary {
  display: inline-flex; align-items: center; justify-content: center; gap: 7px;
  height: 48px; padding: 0 18px; border-radius: 14px;
  font-family: inherit; font-size: 14px; font-weight: 600; color: var(--text-secondary);
  background: white; border: 1px solid var(--border); cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease;
}
.btn-secondary:hover { border-color: var(--primary); color: var(--primary); }

.btn-text {
  font-size: 13.5px; font-weight: 600; color: var(--text-secondary); background: none; border: none;
  cursor: pointer; text-decoration: none; text-align: center; padding: 8px;
}
.btn-text:hover:not(:disabled) { color: var(--primary); }
.btn-text:disabled { opacity: 0.6; cursor: not-allowed; }

/* Sticky action bar */
.action-bar {
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 20;
  background: var(--surface); border-top: 1px solid var(--border);
  padding: 14px 32px; display: flex; align-items: center; justify-content: space-between;
  box-shadow: 0 -4px 20px rgba(15,23,42,0.06);
}
.action-bar__right { display: flex; align-items: center; gap: 14px; }

/* Availability list (sidebar) */
.availability-list { display: flex; flex-direction: column; gap: 10px; }
.availability-row { display: grid; grid-template-columns: 34px 1fr 30px 70px; align-items: center; gap: 8px; }
.availability-row__type { font-size: 12.5px; font-weight: 700; color: var(--text-primary); }
.availability-row__bar-track { height: 6px; border-radius: 999px; background: #eef1f5; overflow: hidden; }
.availability-row__bar-fill { height: 100%; border-radius: 999px; transition: width 0.3s ease; }
.availability-row__units { font-size: 11.5px; font-weight: 600; color: var(--text-secondary); text-align: right; }
.availability-row__status { font-size: 10.5px; font-weight: 700; text-transform: capitalize; }
.side-panel__empty { font-size: 12.5px; color: var(--text-muted); }
.side-panel__loading { display: flex; flex-direction: column; }

/* Guidelines */
.guideline-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.guideline-list li { display: flex; align-items: flex-start; gap: 8px; font-size: 12.5px; color: var(--text-secondary); line-height: 1.4; }
.guideline-list li :deep(svg) { flex-shrink: 0; margin-top: 2px; color: var(--primary); }

/* Timeline (sidebar) */
.timeline-list { display: flex; flex-direction: column; }
.timeline-row { display: flex; gap: 10px; }
.timeline-row__rail { display: flex; flex-direction: column; align-items: center; width: 14px; flex-shrink: 0; }
.timeline-row__dot { width: 8px; height: 8px; border-radius: 999px; background: var(--primary); flex-shrink: 0; margin-top: 4px; }
.timeline-row__line { flex: 1; width: 2px; background: var(--border); min-height: 20px; margin: 2px 0; }
.timeline-row__body { padding-bottom: 14px; }
.timeline-row__label { font-size: 12.5px; font-weight: 600; color: var(--text-primary); margin: 0; }
.timeline-row__duration { font-size: 11px; color: var(--text-muted); margin: 2px 0 0; }

/* Responsive */
@media (max-width: 1080px) {
  .wizard-grid { grid-template-columns: 1fr; }
}
@media (max-width: 640px) {
  .new-request-page { padding: 20px 16px 100px; }
  .page-header { flex-direction: column; align-items: stretch; }
  .form-grid { grid-template-columns: 1fr; }
  .summary-grid { grid-template-columns: 1fr; }
  .priority-toggle { flex-direction: column; }
  .stepper__label-title { display: none; }
  .action-bar { padding: 12px 16px; flex-wrap: wrap; gap: 10px; }
  .action-bar__right { flex: 1; justify-content: flex-end; }
}

/* Dark mode */
:global(.dark .new-request-page) {
  --text-primary: #F1F5F9; --text-secondary: #94A3B8; --text-muted: #64748B;
  --border: #2A3447; --surface: #1E293B; --bg: #0F172A;
  background: #0F172A;
}
:global(.dark .panel), :global(.dark .field__input), :global(.dark .btn-secondary),
:global(.dark .priority-toggle__option), :global(.dark .uploader), :global(.dark .action-bar) {
  background: #1E293B; border-color: #2A3447;
}
:global(.dark .field__input) { color: #F1F5F9; }
:global(.dark .attachment-row), :global(.dark .success-details__row) { background: #243247; }
:global(.dark .stepper__node) { background: #334155; color: #94A3B8; }
:global(.dark .availability-row__bar-track), :global(.dark .attachment-row__progress-track) { background: #334155; }
</style>
