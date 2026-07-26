<script setup>
/**
 * RedAgos — Hospital Portal
 * Route: /hospital/blood-requests/edit/[id]
 *
 * Editing is only allowed while status === 'Pending'.
 * Everything on this page is fetched from the Laravel backend —
 * no hardcoded data. Adjust the composable method names below
 * (useBloodRequests / useApi) to match your actual API layer.
 */
import { computed, reactive, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

definePageMeta({
  layout: 'dashboard'
})

const route = useRoute()
const router = useRouter()
const requestId = route.params.id

const api = useApi()
const bloodRequests = useBloodRequests()

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */
const isLoading = ref(true)
const loadError = ref(null)

const originalRequest = ref(null)   // as returned by the API
const bloodAvailability = ref([])
const auditHistory = ref([])

const isAvailabilityLoading = ref(true)
const isAuditLoading = ref(true)

const isSavingDraft = ref(false)
const isSavingChanges = ref(false)
const saveError = ref(null)

const form = reactive({
  hospitalDepartment: '',
  physician: '',
  patientRef: '',
  priority: '',
  requiredDate: '',
  bloodType: '',
  component: '',
  unitsRequested: null,
  purpose: '',
  clinicalIndication: '',
  diagnosis: '',
  additionalNotes: '',
  documents: []
})

const newDocuments = ref([]) // freshly attached File objects pending upload

const errors = reactive({})

const requiredFields = [
  'hospitalDepartment',
  'bloodType',
  'component',
  'unitsRequested',
  'priority',
  'requiredDate',
  'clinicalIndication'
]

const fieldLabels = {
  hospitalDepartment: 'Hospital Department',
  physician: 'Requesting Physician',
  patientRef: 'Patient Reference Number',
  priority: 'Priority',
  requiredDate: 'Required Date',
  bloodType: 'Blood Type',
  component: 'Blood Component',
  unitsRequested: 'Units Requested',
  purpose: 'Purpose',
  clinicalIndication: 'Clinical Indication',
  diagnosis: 'Diagnosis',
  additionalNotes: 'Additional Notes'
}

/* ------------------------------------------------------------------ */
/* Fetching                                                             */
/* ------------------------------------------------------------------ */
async function loadRequest() {
  isLoading.value = true
  loadError.value = null
  try {
    const data = await bloodRequests.getById(requestId)
    originalRequest.value = data
    hydrateForm(data)
  } catch (err) {
    loadError.value = err?.message || 'Unable to load this blood request. Please try again.'
  } finally {
    isLoading.value = false
  }
}

function hydrateForm(data) {
  if (!data) return
  form.hospitalDepartment = data.department ?? ''
  form.physician = data.physician ?? ''
  form.patientRef = data.patientRef ?? ''
  form.priority = data.priority ?? ''
  form.requiredDate = data.requiredDate ? data.requiredDate.slice(0, 10) : ''
  form.bloodType = data.bloodType ?? ''
  form.component = data.component ?? ''
  form.unitsRequested = data.unitsRequested ?? null
  form.purpose = data.purpose ?? ''
  form.clinicalIndication = data.clinicalIndication ?? ''
  form.diagnosis = data.diagnosis ?? ''
  form.additionalNotes = data.additionalNotes ?? ''
  form.documents = Array.isArray(data.documents) ? [...data.documents] : []
}

async function loadBloodAvailability() {
  isAvailabilityLoading.value = true
  try {
    const data = await api.get('/blood-inventory/summary')
    bloodAvailability.value = Array.isArray(data) ? data : (data?.data ?? [])
  } catch {
    bloodAvailability.value = []
  } finally {
    isAvailabilityLoading.value = false
  }
}

async function loadAuditHistory() {
  isAuditLoading.value = true
  try {
    const data = await api.get(`/blood-requests/${requestId}/audit-log`)
    auditHistory.value = Array.isArray(data) ? data : (data?.data ?? [])
  } catch {
    auditHistory.value = []
  } finally {
    isAuditLoading.value = false
  }
}

onMounted(() => {
  loadRequest()
  loadBloodAvailability()
  loadAuditHistory()
})

/* ------------------------------------------------------------------ */
/* Editability                                                         */
/* ------------------------------------------------------------------ */
const isEditable = computed(() => originalRequest.value?.status === 'Pending')

const statusMeta = {
  Pending:            { bg: '#FFF4E5', fg: '#B45309', dot: '#F59E0B' },
  Approved:           { bg: '#E8F0FE', fg: '#1565C0', dot: '#1565C0' },
  Processing:         { bg: '#EDE7F6', fg: '#5E35B1', dot: '#5E35B1' },
  'Ready for Pickup': { bg: '#E3F2FD', fg: '#0277BD', dot: '#0277BD' },
  Completed:          { bg: '#E8F5E9', fg: '#2E7D32', dot: '#2E7D32' },
  Rejected:           { bg: '#FDECEA', fg: '#D32F2F', dot: '#D32F2F' },
  Cancelled:          { bg: '#F1F1F1', fg: '#616161', dot: '#9E9E9E' }
}

function statusStyle(status) {
  const m = statusMeta[status] || statusMeta.Pending
  return { backgroundColor: m.bg, color: m.fg }
}
function statusDotStyle(status) {
  const m = statusMeta[status] || statusMeta.Pending
  return { backgroundColor: m.dot }
}

/* ------------------------------------------------------------------ */
/* Change tracking / summary                                           */
/* ------------------------------------------------------------------ */
const trackedFields = [
  'hospitalDepartment', 'physician', 'patientRef', 'priority', 'requiredDate',
  'bloodType', 'component', 'unitsRequested', 'purpose',
  'clinicalIndication', 'diagnosis', 'additionalNotes'
]

const originalFieldValue = {
  hospitalDepartment: (d) => d?.department,
  physician: (d) => d?.physician,
  patientRef: (d) => d?.patientRef,
  priority: (d) => d?.priority,
  requiredDate: (d) => d?.requiredDate ? d.requiredDate.slice(0, 10) : '',
  bloodType: (d) => d?.bloodType,
  component: (d) => d?.component,
  unitsRequested: (d) => d?.unitsRequested,
  purpose: (d) => d?.purpose,
  clinicalIndication: (d) => d?.clinicalIndication,
  diagnosis: (d) => d?.diagnosis,
  additionalNotes: (d) => d?.additionalNotes
}

const changedFields = computed(() => {
  if (!originalRequest.value) return []
  return trackedFields
    .map((key) => {
      const prev = originalFieldValue[key](originalRequest.value)
      const next = form[key]
      const prevStr = prev === null || prev === undefined ? '' : String(prev)
      const nextStr = next === null || next === undefined ? '' : String(next)
      if (prevStr === nextStr) return null
      return {
        key,
        label: fieldLabels[key],
        previous: prevStr || '—',
        updated: nextStr || '—'
      }
    })
    .filter(Boolean)
})

const hasChanges = computed(() => changedFields.value.length > 0 || newDocuments.value.length > 0)

/* ------------------------------------------------------------------ */
/* Validation                                                           */
/* ------------------------------------------------------------------ */
function validate() {
  Object.keys(errors).forEach((k) => delete errors[k])
  requiredFields.forEach((key) => {
    const val = form[key]
    const isEmpty = val === null || val === undefined || val === '' ||
      (key === 'unitsRequested' && (Number.isNaN(Number(val)) || Number(val) <= 0))
    if (isEmpty) {
      errors[key] = `${fieldLabels[key]} is required.`
    }
  })
  return Object.keys(errors).length === 0
}

/* ------------------------------------------------------------------ */
/* Documents                                                            */
/* ------------------------------------------------------------------ */
function handleFileSelect(event) {
  const files = Array.from(event.target.files || [])
  newDocuments.value.push(...files)
  event.target.value = ''
}

function removeExistingDocument(index) {
  form.documents.splice(index, 1)
}

function removeNewDocument(index) {
  newDocuments.value.splice(index, 1)
}

/* ------------------------------------------------------------------ */
/* Actions                                                              */
/* ------------------------------------------------------------------ */
function buildPayload() {
  const payload = new FormData()
  trackedFields.forEach((key) => payload.append(key, form[key] ?? ''))
  payload.append('existing_documents', JSON.stringify(form.documents))
  newDocuments.value.forEach((file) => payload.append('new_documents[]', file))
  return payload
}

async function handleSaveDraft() {
  saveError.value = null
  isSavingDraft.value = true
  try {
    await bloodRequests.saveDraft(requestId, buildPayload())
    router.push(`/hospital/blood-requests/${requestId}`)
  } catch (err) {
    saveError.value = err?.message || 'Unable to save draft. Please try again.'
  } finally {
    isSavingDraft.value = false
  }
}

async function handleSaveChanges() {
  saveError.value = null
  if (!validate()) return
  isSavingChanges.value = true
  try {
    await bloodRequests.update(requestId, buildPayload())
    router.push(`/hospital/blood-requests/${requestId}`)
  } catch (err) {
    saveError.value = err?.message || 'Unable to save changes. Please try again.'
  } finally {
    isSavingChanges.value = false
  }
}

function handleCancel() {
  router.push(`/hospital/blood-requests/${requestId}`)
}

function handleReturnToDetails() {
  router.push(`/hospital/blood-requests/${requestId}`)
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}
</script>

<template>
  <div class="eb-page">
    <!-- ============================ HEADER ============================ -->
    <div class="eb-header">
      <NuxtLink :to="`/hospital/blood-requests/${requestId}`" class="eb-back">
        <span class="eb-back-arrow">←</span> Back to Request Details
      </NuxtLink>

      <nav class="eb-breadcrumb" aria-label="Breadcrumb">
        <span>Hospital Portal</span>
        <span class="eb-crumb-sep">/</span>
        <span>Blood Requests</span>
        <span class="eb-crumb-sep">/</span>
        <span class="eb-crumb-current">Edit Request</span>
      </nav>

      <div class="eb-header-row">
        <div class="eb-header-titles">
          <h1 class="eb-title">Edit Blood Request</h1>
          <p class="eb-subtitle">Update request information before it is processed by the Blood Center.</p>
        </div>

        <div v-if="originalRequest" class="eb-header-actions">
          <span v-if="isEditable" class="eb-status-badge" :style="statusStyle('Pending')">
            <span class="eb-status-dot" :style="statusDotStyle('Pending')"></span>
            Pending
          </span>
          <span v-else class="eb-status-badge eb-status-disabled">
            <span class="eb-status-dot eb-status-dot-disabled"></span>
            Editing Disabled
          </span>
        </div>
      </div>
    </div>

    <!-- ============================ LOADING ============================ -->
    <div v-if="isLoading" class="eb-skeleton-wrap">
      <div class="eb-skeleton eb-skeleton-banner"></div>
      <div class="eb-skeleton eb-skeleton-card"></div>
      <div class="eb-skeleton eb-skeleton-card"></div>
    </div>

    <!-- ============================ ERROR ============================ -->
    <div v-else-if="loadError" class="eb-card eb-error-state">
      <span class="eb-error-icon">⚠</span>
      <p class="eb-error-text">{{ loadError }}</p>
      <button class="eb-btn eb-btn-outline" @click="loadRequest">Try Again</button>
    </div>

    <!-- ============================ EMPTY ============================ -->
    <div v-else-if="!originalRequest" class="eb-card eb-empty-state">
      <span class="eb-empty-icon">🩸</span>
      <p class="eb-empty-text">This blood request could not be found.</p>
      <NuxtLink to="/hospital/blood-requests" class="eb-btn eb-btn-outline">Back to Blood Requests</NuxtLink>
    </div>

    <!-- ============================ CONTENT ============================ -->
    <template v-else>
      <!-- Locked banner -->
      <div v-if="!isEditable" class="eb-locked-banner">
        <span class="eb-locked-icon">🔒</span>
        <div class="eb-locked-text">
          <strong>This request can no longer be edited.</strong>
          <span>
            It is currently <strong>{{ originalRequest.status }}</strong> and has already entered the
            fulfillment process. Only requests with a <strong>Pending</strong> status can be modified.
          </span>
        </div>
      </div>

      <div class="eb-layout">
        <div class="eb-main">

          <!-- ============================ FORM ============================ -->
          <fieldset class="eb-card" :disabled="!isEditable">
            <h2 class="eb-section-title">Request Information</h2>
            <div class="eb-form-grid">
              <div class="eb-field">
                <label class="eb-label">Hospital Department <span class="eb-required">*</span></label>
                <input v-model="form.hospitalDepartment" type="text" class="eb-input" :class="{ 'has-error': errors.hospitalDepartment }" />
                <span v-if="errors.hospitalDepartment" class="eb-error-msg">{{ errors.hospitalDepartment }}</span>
              </div>
              <div class="eb-field">
                <label class="eb-label">Requesting Physician</label>
                <input v-model="form.physician" type="text" class="eb-input" />
              </div>
              <div class="eb-field">
                <label class="eb-label">Patient Reference Number</label>
                <input v-model="form.patientRef" type="text" class="eb-input" />
              </div>
              <div class="eb-field">
                <label class="eb-label">Priority <span class="eb-required">*</span></label>
                <select v-model="form.priority" class="eb-input" :class="{ 'has-error': errors.priority }">
                  <option value="" disabled>Select priority</option>
                  <option value="Routine">Routine</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent</option>
                </select>
                <span v-if="errors.priority" class="eb-error-msg">{{ errors.priority }}</span>
              </div>
              <div class="eb-field">
                <label class="eb-label">Required Date <span class="eb-required">*</span></label>
                <input v-model="form.requiredDate" type="date" class="eb-input" :class="{ 'has-error': errors.requiredDate }" />
                <span v-if="errors.requiredDate" class="eb-error-msg">{{ errors.requiredDate }}</span>
              </div>
              <div class="eb-field">
                <label class="eb-label">Purpose</label>
                <input v-model="form.purpose" type="text" class="eb-input" />
              </div>
            </div>
          </fieldset>

          <fieldset class="eb-card" :disabled="!isEditable">
            <h2 class="eb-section-title">Blood Details</h2>
            <div class="eb-form-grid">
              <div class="eb-field">
                <label class="eb-label">Blood Type <span class="eb-required">*</span></label>
                <select v-model="form.bloodType" class="eb-input" :class="{ 'has-error': errors.bloodType }">
                  <option value="" disabled>Select blood type</option>
                  <option v-for="t in ['O+','O-','A+','A-','B+','B-','AB+','AB-']" :key="t" :value="t">{{ t }}</option>
                </select>
                <span v-if="errors.bloodType" class="eb-error-msg">{{ errors.bloodType }}</span>
              </div>
              <div class="eb-field">
                <label class="eb-label">Blood Component <span class="eb-required">*</span></label>
                <select v-model="form.component" class="eb-input" :class="{ 'has-error': errors.component }">
                  <option value="" disabled>Select component</option>
                  <option value="Whole Blood">Whole Blood</option>
                  <option value="Packed Red Blood Cells (PRBC)">Packed Red Blood Cells (PRBC)</option>
                  <option value="Platelet Concentrate">Platelet Concentrate</option>
                  <option value="Fresh Frozen Plasma">Fresh Frozen Plasma</option>
                  <option value="Cryoprecipitate">Cryoprecipitate</option>
                </select>
                <span v-if="errors.component" class="eb-error-msg">{{ errors.component }}</span>
              </div>
              <div class="eb-field">
                <label class="eb-label">Units Requested <span class="eb-required">*</span></label>
                <input v-model.number="form.unitsRequested" type="number" min="1" class="eb-input" :class="{ 'has-error': errors.unitsRequested }" />
                <span v-if="errors.unitsRequested" class="eb-error-msg">{{ errors.unitsRequested }}</span>
              </div>
            </div>
            <p v-if="isEditable" class="eb-hint">
              Changing the blood type will require re-verification by the Blood Center before approval.
            </p>
          </fieldset>

          <fieldset class="eb-card" :disabled="!isEditable">
            <h2 class="eb-section-title">Clinical Information</h2>
            <div class="eb-form-grid eb-form-grid-1">
              <div class="eb-field">
                <label class="eb-label">Clinical Indication <span class="eb-required">*</span></label>
                <textarea v-model="form.clinicalIndication" rows="2" class="eb-input eb-textarea" :class="{ 'has-error': errors.clinicalIndication }"></textarea>
                <span v-if="errors.clinicalIndication" class="eb-error-msg">{{ errors.clinicalIndication }}</span>
              </div>
              <div class="eb-field">
                <label class="eb-label">Diagnosis</label>
                <textarea v-model="form.diagnosis" rows="2" class="eb-input eb-textarea"></textarea>
              </div>
              <div class="eb-field">
                <label class="eb-label">Additional Notes</label>
                <textarea v-model="form.additionalNotes" rows="3" class="eb-input eb-textarea"></textarea>
              </div>
            </div>

            <div class="eb-docs">
              <label class="eb-label">Supporting Documents</label>

              <div v-if="form.documents.length || newDocuments.length" class="eb-doc-list">
                <div v-for="(doc, idx) in form.documents" :key="`existing-${idx}`" class="eb-doc-item">
                  <span class="eb-doc-icon">📄</span>
                  <span class="eb-doc-info">
                    <span class="eb-doc-name">{{ doc.name }}</span>
                    <span class="eb-doc-size">{{ doc.size }}</span>
                  </span>
                  <button v-if="isEditable" type="button" class="eb-doc-remove" @click="removeExistingDocument(idx)">Remove</button>
                </div>
                <div v-for="(file, idx) in newDocuments" :key="`new-${idx}`" class="eb-doc-item eb-doc-item-new">
                  <span class="eb-doc-icon">🆕</span>
                  <span class="eb-doc-info">
                    <span class="eb-doc-name">{{ file.name }}</span>
                    <span class="eb-doc-size">{{ (file.size / 1024).toFixed(0) }} KB</span>
                  </span>
                  <button type="button" class="eb-doc-remove" @click="removeNewDocument(idx)">Remove</button>
                </div>
              </div>
              <p v-else class="eb-doc-empty">No supporting documents attached yet.</p>

              <label v-if="isEditable" class="eb-upload-btn">
                + Attach Document
                <input type="file" multiple class="eb-upload-input" @change="handleFileSelect" />
              </label>
            </div>
          </fieldset>

          <!-- ============================ CHANGE SUMMARY ============================ -->
          <section v-if="isEditable && changedFields.length" class="eb-card eb-change-card">
            <h2 class="eb-section-title">Change Summary</h2>
            <div class="eb-change-list">
              <div v-for="change in changedFields" :key="change.key" class="eb-change-row">
                <span class="eb-change-label">{{ change.label }}</span>
                <div class="eb-change-values">
                  <span class="eb-change-prev">{{ change.previous }}</span>
                  <span class="eb-change-arrow">↓</span>
                  <span class="eb-change-updated">{{ change.updated }}</span>
                </div>
              </div>
            </div>
          </section>

          <!-- ============================ AUDIT HISTORY ============================ -->
          <section class="eb-card">
            <h2 class="eb-section-title">Audit History</h2>

            <div v-if="isAuditLoading" class="eb-skeleton eb-skeleton-audit"></div>

            <p v-else-if="!auditHistory.length" class="eb-empty-inline">
              No edits have been recorded for this request yet.
            </p>

            <ol v-else class="eb-audit-timeline">
              <li v-for="(entry, idx) in auditHistory" :key="idx" class="eb-audit-item">
                <span class="eb-audit-marker"></span>
                <div class="eb-audit-content">
                  <div class="eb-audit-top">
                    <span class="eb-audit-field">{{ entry.fieldChanged }}</span>
                    <span class="eb-audit-date">{{ formatDateTime(entry.date) }}</span>
                  </div>
                  <div class="eb-audit-values">
                    <span class="eb-audit-prev">{{ entry.previousValue }}</span>
                    <span class="eb-audit-arrow">→</span>
                    <span class="eb-audit-new">{{ entry.newValue }}</span>
                  </div>
                  <span class="eb-audit-by">Edited by {{ entry.editedBy }}</span>
                </div>
              </li>
            </ol>
          </section>
        </div>

        <!-- ============================ RIGHT SIDEBAR ============================ -->
        <aside class="eb-sidebar">
          <div class="eb-card eb-side-card">
            <h3 class="eb-side-title">Current Status</h3>
            <span class="eb-status-badge" :style="statusStyle(originalRequest.status)">
              <span class="eb-status-dot" :style="statusDotStyle(originalRequest.status)"></span>
              {{ originalRequest.status }}
            </span>
            <div class="eb-side-row">
              <span class="eb-side-label">Reference Number</span>
              <span class="eb-side-value eb-mono">{{ originalRequest.referenceNumber }}</span>
            </div>
            <div class="eb-side-row">
              <span class="eb-side-label">Submitted</span>
              <span class="eb-side-value">{{ formatDate(originalRequest.requestDate) }}</span>
            </div>
          </div>

          <div class="eb-card eb-side-card">
            <h3 class="eb-side-title">Blood Availability</h3>
            <div v-if="isAvailabilityLoading" class="eb-skeleton eb-skeleton-avail"></div>
            <p v-else-if="!bloodAvailability.length" class="eb-empty-inline">
              Availability data is unavailable right now.
            </p>
            <ul v-else class="eb-availability-list">
              <li v-for="item in bloodAvailability" :key="item.type" class="eb-availability-row">
                <span class="eb-availability-type" :class="{ 'is-match': item.type === form.bloodType }">
                  {{ item.type }}
                </span>
                <span class="eb-availability-bar-track">
                  <span
                    class="eb-availability-bar-fill"
                    :style="{ width: Math.min(100, (item.units / (item.capacity || 50)) * 100) + '%' }"
                  ></span>
                </span>
                <span class="eb-availability-units">{{ item.units }}</span>
              </li>
            </ul>
          </div>

          <div class="eb-card eb-side-card">
            <h3 class="eb-side-title">Editing Rules</h3>
            <ul class="eb-rules-list">
              <li>Requests can only be edited while <strong>Pending</strong>.</li>
              <li>Changes are recorded in the audit log.</li>
              <li>Blood type changes should be verified before saving.</li>
            </ul>
          </div>
        </aside>
      </div>
    </template>

    <!-- ============================ STICKY BOTTOM ACTION BAR ============================ -->
    <div v-if="originalRequest && !isLoading" class="eb-action-bar">
      <span v-if="saveError" class="eb-save-error">{{ saveError }}</span>
      <div class="eb-action-bar-buttons">
        <template v-if="isEditable">
          <button type="button" class="eb-btn eb-btn-outline" @click="handleCancel">Cancel</button>
          <button type="button" class="eb-btn eb-btn-outline" :disabled="isSavingDraft" @click="handleSaveDraft">
            {{ isSavingDraft ? 'Saving Draft…' : 'Save Draft' }}
          </button>
          <button type="button" class="eb-btn eb-btn-primary" :disabled="isSavingChanges || !hasChanges" @click="handleSaveChanges">
            {{ isSavingChanges ? 'Saving…' : 'Save Changes' }}
          </button>
        </template>
        <template v-else>
          <button type="button" class="eb-btn eb-btn-primary" @click="handleReturnToDetails">Return to Request Details</button>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.eb-page {
  --eb-primary: #1565c0;
  --eb-primary-hover: #0d47a1;
  --eb-warning: #f59e0b;
  --eb-success: #2e7d32;
  --eb-danger: #d32f2f;
  --eb-bg: #f7f9fc;
  --eb-card: #ffffff;
  --eb-border: #e5eaf0;
  --eb-border-dark: #2a3447;
  --eb-text: #1a2233;
  --eb-text-muted: #6b7789;

  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  background: var(--eb-bg);
  min-height: 100%;
  padding: 24px 28px 110px;
  color: var(--eb-text);
  animation: eb-page-in 0.35s ease;
}

@keyframes eb-page-in {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ---------- header ---------- */
.eb-back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--eb-primary);
  text-decoration: none;
  margin-bottom: 10px;
}
.eb-back:hover { text-decoration: underline; }
.eb-back-arrow { font-size: 16px; }

.eb-breadcrumb {
  font-size: 13px;
  color: var(--eb-text-muted);
  margin-bottom: 18px;
}
.eb-crumb-sep { margin: 0 6px; color: #c3cbd6; }
.eb-crumb-current { color: var(--eb-text); font-weight: 600; }

.eb-header-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 24px;
}
.eb-title {
  font-size: 30px;
  font-weight: 700;
  margin: 0 0 6px;
  letter-spacing: -0.02em;
}
.eb-subtitle {
  font-size: 14px;
  font-weight: 400;
  color: var(--eb-text-muted);
  margin: 0;
}
.eb-header-actions { display: flex; align-items: center; gap: 10px; }

/* ---------- status badge ---------- */
.eb-status-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 700;
  width: fit-content;
}
.eb-status-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.eb-status-disabled { background: #f1f1f1; color: #616161; }
.eb-status-dot-disabled { background: #9e9e9e; }

/* ---------- locked banner ---------- */
.eb-locked-banner {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  background: #fff4e5;
  border: 1px solid #f5d9a8;
  border-radius: 14px;
  padding: 16px 20px;
  margin-bottom: 20px;
}
.eb-locked-icon { font-size: 20px; }
.eb-locked-text { display: flex; flex-direction: column; gap: 4px; font-size: 14px; color: #7a4b00; }

/* ---------- buttons ---------- */
.eb-btn {
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  padding: 11px 18px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.15s ease;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.eb-btn:disabled { opacity: 0.55; cursor: not-allowed; }
.eb-btn-outline {
  background: #fff;
  border-color: var(--eb-border);
  color: var(--eb-text);
}
.eb-btn-outline:hover:not(:disabled) {
  border-color: var(--eb-primary);
  color: var(--eb-primary);
}
.eb-btn-primary {
  background: var(--eb-primary);
  color: #fff;
}
.eb-btn-primary:hover:not(:disabled) { background: var(--eb-primary-hover); }

/* ---------- cards ---------- */
.eb-card {
  background: var(--eb-card);
  border: 1px solid var(--eb-border);
  border-radius: 18px;
  padding: 24px;
  margin-bottom: 20px;
  box-shadow: 0 2px 10px rgba(21, 101, 192, 0.04);
}
fieldset.eb-card { border: 1px solid var(--eb-border); }
fieldset.eb-card:disabled { background: #fbfcfe; }
.eb-section-title { font-size: 18px; font-weight: 700; margin: 0 0 18px; }

/* ---------- form ---------- */
.eb-form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 18px 24px;
}
.eb-form-grid-1 { grid-template-columns: 1fr; }
.eb-field { display: flex; flex-direction: column; gap: 6px; }
.eb-label { font-size: 13px; font-weight: 600; color: var(--eb-text-muted); }
.eb-required { color: var(--eb-danger); }
.eb-input {
  font-family: inherit;
  font-size: 14px;
  padding: 10px 12px;
  border: 1px solid var(--eb-border);
  border-radius: 10px;
  background: #fff;
  color: var(--eb-text);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.eb-input:focus {
  outline: none;
  border-color: var(--eb-primary);
  box-shadow: 0 0 0 3px rgba(21, 101, 192, 0.12);
}
.eb-input.has-error { border-color: var(--eb-danger); }
.eb-textarea { resize: vertical; }
.eb-error-msg { font-size: 12px; color: var(--eb-danger); font-weight: 500; }
.eb-hint { font-size: 13px; color: var(--eb-text-muted); margin: 14px 0 0; }

/* ---------- documents ---------- */
.eb-docs { margin-top: 22px; }
.eb-doc-list { display: flex; flex-direction: column; gap: 10px; margin: 10px 0; }
.eb-doc-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border: 1px solid var(--eb-border);
  border-radius: 12px;
  background: #fbfcfe;
}
.eb-doc-item-new { border-color: var(--eb-primary); background: #eef5fd; }
.eb-doc-icon { font-size: 18px; }
.eb-doc-info { display: flex; flex-direction: column; flex: 1; gap: 2px; }
.eb-doc-name { font-size: 14px; font-weight: 600; }
.eb-doc-size { font-size: 12px; color: var(--eb-text-muted); }
.eb-doc-remove {
  border: none;
  background: transparent;
  color: var(--eb-danger);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.eb-doc-empty { font-size: 13px; color: var(--eb-text-muted); margin: 10px 0; }
.eb-upload-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 700;
  color: var(--eb-primary);
  border: 1px dashed var(--eb-primary);
  border-radius: 10px;
  padding: 9px 14px;
  cursor: pointer;
  margin-top: 6px;
}
.eb-upload-input { display: none; }

/* ---------- change summary ---------- */
.eb-change-card { border-color: #bcd6f2; }
.eb-change-list { display: flex; flex-direction: column; gap: 14px; }
.eb-change-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--eb-border);
  flex-wrap: wrap;
}
.eb-change-row:last-child { border-bottom: none; padding-bottom: 0; }
.eb-change-label { font-size: 13px; font-weight: 700; color: var(--eb-text-muted); min-width: 160px; }
.eb-change-values { display: flex; align-items: center; gap: 10px; font-size: 14px; flex-wrap: wrap; }
.eb-change-prev { color: var(--eb-text-muted); text-decoration: line-through; }
.eb-change-arrow { color: var(--eb-primary); font-weight: 700; }
.eb-change-updated { color: var(--eb-success); font-weight: 700; }

/* ---------- audit timeline ---------- */
.eb-audit-timeline { list-style: none; margin: 0; padding: 0; }
.eb-audit-item { display: flex; gap: 14px; position: relative; padding-bottom: 22px; }
.eb-audit-item:last-child { padding-bottom: 0; }
.eb-audit-item::before {
  content: '';
  position: absolute;
  left: 4px;
  top: 16px;
  bottom: 0;
  width: 2px;
  background: var(--eb-border);
}
.eb-audit-item:last-child::before { display: none; }
.eb-audit-marker {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--eb-primary);
  margin-top: 5px;
  flex-shrink: 0;
}
.eb-audit-content { display: flex; flex-direction: column; gap: 4px; }
.eb-audit-top { display: flex; gap: 12px; align-items: baseline; flex-wrap: wrap; }
.eb-audit-field { font-size: 14px; font-weight: 700; }
.eb-audit-date { font-size: 12px; color: var(--eb-text-muted); }
.eb-audit-values { display: flex; align-items: center; gap: 8px; font-size: 13px; }
.eb-audit-prev { color: var(--eb-text-muted); text-decoration: line-through; }
.eb-audit-arrow { color: var(--eb-primary); }
.eb-audit-new { color: var(--eb-success); font-weight: 600; }
.eb-audit-by { font-size: 12px; color: var(--eb-text-muted); }

.eb-empty-inline { font-size: 13px; color: var(--eb-text-muted); margin: 6px 0 0; }

/* ---------- layout ---------- */
.eb-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 24px;
  align-items: start;
}
.eb-sidebar { position: sticky; top: 20px; display: flex; flex-direction: column; }
.eb-side-card { margin-bottom: 20px; }
.eb-side-title { font-size: 16px; font-weight: 700; margin: 0 0 14px; }
.eb-side-row { display: flex; flex-direction: column; gap: 4px; padding-top: 14px; margin-top: 14px; border-top: 1px solid var(--eb-border); }
.eb-side-label { font-size: 12px; font-weight: 600; color: var(--eb-text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
.eb-side-value { font-size: 14px; font-weight: 600; }
.eb-mono { font-family: 'SF Mono', 'Roboto Mono', monospace; }

.eb-availability-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.eb-availability-row { display: grid; grid-template-columns: 40px 1fr 30px; align-items: center; gap: 10px; }
.eb-availability-type { font-size: 13px; font-weight: 700; color: var(--eb-text-muted); }
.eb-availability-type.is-match { color: var(--eb-danger); }
.eb-availability-bar-track { height: 6px; border-radius: 999px; background: #eef1f6; overflow: hidden; }
.eb-availability-bar-fill { display: block; height: 100%; border-radius: 999px; background: var(--eb-success); }
.eb-availability-units { font-size: 13px; font-weight: 700; text-align: right; }

.eb-rules-list { margin: 0; padding-left: 18px; font-size: 13px; color: var(--eb-text-muted); display: flex; flex-direction: column; gap: 8px; }

/* ---------- sticky action bar ---------- */
.eb-action-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: #fff;
  border-top: 1px solid var(--eb-border);
  padding: 14px 28px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  z-index: 20;
  box-shadow: 0 -4px 16px rgba(21, 101, 192, 0.06);
}
.eb-action-bar-buttons { display: flex; gap: 10px; margin-left: auto; }
.eb-save-error { font-size: 13px; color: var(--eb-danger); font-weight: 600; }

/* ---------- error / empty states ---------- */
.eb-error-state, .eb-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  text-align: center;
  padding: 48px 24px;
}
.eb-error-icon, .eb-empty-icon { font-size: 28px; }
.eb-error-text, .eb-empty-text { font-size: 14px; color: var(--eb-text-muted); }

/* ---------- skeleton ---------- */
.eb-skeleton-wrap { display: flex; flex-direction: column; gap: 20px; }
.eb-skeleton {
  border-radius: 18px;
  background: linear-gradient(90deg, #eef1f6 25%, #f6f8fb 37%, #eef1f6 63%);
  background-size: 400% 100%;
  animation: eb-shimmer 1.4s ease infinite;
}
.eb-skeleton-banner { height: 60px; }
.eb-skeleton-card { height: 200px; }
.eb-skeleton-audit { height: 80px; }
.eb-skeleton-avail { height: 140px; }
@keyframes eb-shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}

/* ---------- responsive ---------- */
@media (max-width: 1080px) {
  .eb-layout { grid-template-columns: 1fr; }
  .eb-sidebar { position: static; }
}
@media (max-width: 720px) {
  .eb-page { padding: 18px 16px 130px; }
  .eb-title { font-size: 24px; }
  .eb-form-grid { grid-template-columns: 1fr; }
  .eb-action-bar { flex-direction: column; align-items: stretch; padding: 12px 16px; }
  .eb-action-bar-buttons { flex-direction: column; margin-left: 0; }
  .eb-action-bar-buttons .eb-btn { width: 100%; }
}

/* ---------- dark mode ---------- */
:global(.dark .eb-page) { background: #0f1420; color: #e6eaf2; }
:global(.dark .eb-card) { background: #161d2c; border-color: var(--eb-border-dark); box-shadow: none; }
:global(.dark .eb-change-card) { border-color: #2c4a70; }
:global(.dark .eb-input) { background: #131a27; border-color: var(--eb-border-dark); color: #e6eaf2; }
:global(.dark .eb-subtitle),
:global(.dark .eb-label),
:global(.dark .eb-side-label),
:global(.dark .eb-doc-size),
:global(.dark .eb-hint),
:global(.dark .eb-empty-inline),
:global(.dark .eb-audit-date),
:global(.dark .eb-audit-by),
:global(.dark .eb-rules-list),
:global(.dark .eb-availability-type),
:global(.dark .eb-change-label) { color: #8b95a8; }
:global(.dark .eb-breadcrumb) { color: #8b95a8; }
:global(.dark .eb-crumb-current) { color: #e6eaf2; }
:global(.dark .eb-btn-outline) { background: #161d2c; border-color: var(--eb-border-dark); color: #e6eaf2; }
:global(.dark .eb-doc-item) { background: #131a27; border-color: var(--eb-border-dark); }
:global(.dark .eb-side-row),
:global(.dark .eb-change-row) { border-color: var(--eb-border-dark); }
:global(.dark .eb-availability-bar-track) { background: #232c3f; }
:global(.dark .eb-action-bar) { background: #161d2c; border-color: var(--eb-border-dark); }
:global(.dark .eb-audit-item::before) { background: var(--eb-border-dark); }
:global(.dark .eb-locked-banner) { background: #2a2314; border-color: #4a3a12; }
:global(.dark fieldset.eb-card:disabled) { background: #12182a; }
</style>