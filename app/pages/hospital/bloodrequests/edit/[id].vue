<template>
  <div class="eb-page">
    <!-- ======= HEADER ========= -->
    <div class="eb-header">
      <NuxtLink :to="`/hospital/bloodrequests/${requestId}`" class="eb-back">
        <AssetIcon name="arrow-left" :size="16" class="eb-back-arrow" /> Back to Request Details
      </NuxtLink>

      <PageHeader class="eb-header-row" title="Edit Blood Request" subtitle="Update request information before it is processed by the Blood Center.">
        <template v-if="originalRequest" #actions>
          <StatusBadge v-if="isEditable" :tone="statusTone('Pending')">Pending</StatusBadge>
          <StatusBadge v-else tone="neutral">Editing Disabled</StatusBadge>
        </template>
      </PageHeader>
    </div>

    <!-- ====== LOADING ====== -->
    <div v-if="isLoading" class="eb-skeleton-wrap">
      <div class="eb-skeleton eb-skeleton-banner"></div>
      <div class="eb-skeleton eb-skeleton-card"></div>
      <div class="eb-skeleton eb-skeleton-card"></div>
    </div>

    <!-- ======= ERROR ======= -->
    <div v-else-if="loadError" class="eb-card">
      <EmptyState icon="triangle-alert" title="Couldn't load this request" :description="loadError">
        <button class="ui-btn" @click="loadRequest">Try Again</button>
      </EmptyState>
    </div>

    <!-- ======== EMPTY ====== -->
    <div v-else-if="!originalRequest" class="eb-card">
      <EmptyState icon="droplets" title="This blood request could not be found.">
        <NuxtLink to="/hospital/bloodrequests" class="ui-btn">Back to Patient Request</NuxtLink>
      </EmptyState>
    </div>

    <!-- ====== CONTENT ====== -->
    <template v-else>
      <!-- Locked banner -->
      <div v-if="!isEditable" class="eb-locked-banner">
        <AssetIcon name="lock" :size="20" class="eb-locked-icon" />
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

          <!-- ===== FORM ====== -->
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
                <label class="eb-label" for="eb-priority">Priority <span class="eb-required">*</span></label>
                <SelectField
                  id="eb-priority"
                  v-model="form.priority"
                  :options="[{ value: 'Routine', label: 'Routine' }, { value: 'High', label: 'High' }, { value: 'Urgent', label: 'Urgent' }]"
                  placeholder="Select priority"
                  :invalid="Boolean(errors.priority)"
                />
                <span v-if="errors.priority" class="eb-error-msg">{{ errors.priority }}</span>
              </div>
              <div class="eb-field">
                <label class="eb-label" for="eb-required-date">Required Date <span class="eb-required">*</span></label>
                <DatePicker id="eb-required-date" v-model="form.requiredDate" :invalid="Boolean(errors.requiredDate)" />
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
                <label class="eb-label" for="eb-blood-type">Blood Type <span class="eb-required">*</span></label>
                <SelectField
                  id="eb-blood-type"
                  v-model="form.bloodType"
                  :options="['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map((t) => ({ value: t, label: t }))"
                  placeholder="Select blood type"
                  :invalid="Boolean(errors.bloodType)"
                />
                <span v-if="errors.bloodType" class="eb-error-msg">{{ errors.bloodType }}</span>
              </div>
              <div class="eb-field">
                <label class="eb-label" for="eb-component">Blood Component <span class="eb-required">*</span></label>
                <SelectField
                  id="eb-component"
                  v-model="form.component"
                  :options="['Whole Blood', 'Packed Red Blood Cells (PRBC)', 'Platelet Concentrate', 'Fresh Frozen Plasma', 'Cryoprecipitate'].map((c) => ({ value: c, label: c }))"
                  placeholder="Select component"
                  :invalid="Boolean(errors.component)"
                />
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
                  <AssetIcon name="file-text" :size="18" class="eb-doc-icon" style="color: var(--eb-text-muted)" />
                  <span class="eb-doc-info">
                    <span class="eb-doc-name">{{ doc.name }}</span>
                    <span class="eb-doc-size">{{ doc.size }}</span>
                  </span>
                  <button v-if="isEditable" type="button" class="eb-doc-remove" @click="removeExistingDocument(idx)">Remove</button>
                </div>
                <div v-for="(file, idx) in newDocuments" :key="`new-${idx}`" class="eb-doc-item eb-doc-item-new">
                  <AssetIcon name="file-plus" :size="18" class="eb-doc-icon" style="color: var(--eb-primary)" />
                  <span class="eb-doc-info">
                    <span class="eb-doc-name">{{ file.name }}</span>
                    <span class="eb-doc-size">{{ (file.size / 1024).toFixed(0) }} KB</span>
                  </span>
                  <button type="button" class="eb-doc-remove" @click="removeNewDocument(idx)">Remove</button>
                </div>
              </div>
              <p v-else class="eb-doc-empty">No supporting documents attached yet.</p>

              <label v-if="isEditable" class="eb-upload-btn">
                <AssetIcon name="file-plus" :size="14" /> Attach Document
                <input type="file" multiple class="eb-upload-input" @change="handleFileSelect" />
              </label>
            </div>
          </fieldset>

          <!-- ======== CHANGE SUMMARY ======= -->
          <section v-if="isEditable && changedFields.length" class="eb-card eb-change-card">
            <h2 class="eb-section-title">Change Summary</h2>
            <div class="eb-change-list">
              <div v-for="change in changedFields" :key="change.key" class="eb-change-row">
                <span class="eb-change-label">{{ change.label }}</span>
                <div class="eb-change-values">
                  <span class="eb-change-prev">{{ change.previous }}</span>
                  <AssetIcon name="chevron-down" :size="14" class="eb-change-arrow" />
                  <span class="eb-change-updated">{{ change.updated }}</span>
                </div>
              </div>
            </div>
          </section>

          <!-- ======= AUDIT HISTORY ======== -->
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
                    <AssetIcon name="arrow-right" :size="12" class="eb-audit-arrow" />
                    <span class="eb-audit-new">{{ entry.newValue }}</span>
                  </div>
                  <span class="eb-audit-by">Edited by {{ entry.editedBy }}</span>
                </div>
              </li>
            </ol>
          </section>
        </div>

        <!-- ======== RIGHT SIDEBAR ======= -->
        <aside class="eb-sidebar">
          <div class="eb-card eb-side-card">
            <h3 class="eb-side-title">Current Status</h3>
            <StatusBadge :tone="statusTone(originalRequest.status)">
              {{ originalRequest.status }}
            </StatusBadge>
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

    <!-- ======= STICKY BOTTOM ACTION BAR ======= -->
    <div v-if="originalRequest && !isLoading" class="eb-action-bar">
      <span v-if="saveError" class="eb-save-error">{{ saveError }}</span>
      <div class="eb-action-bar-buttons">
        <template v-if="isEditable">
          <button type="button" class="ui-btn" @click="handleCancel">Cancel</button>
          <button type="button" class="ui-btn" :disabled="isSavingDraft" @click="handleSaveDraft">
            {{ isSavingDraft ? 'Saving Draft…' : 'Save Draft' }}
          </button>
          <button type="button" class="ui-btn ui-btn--primary" :disabled="isSavingChanges || !hasChanges" @click="handleSaveChanges">
            {{ isSavingChanges ? 'Saving…' : 'Save Changes' }}
          </button>
        </template>
        <template v-else>
          <button type="button" class="ui-btn ui-btn--primary" @click="handleReturnToDetails">Return to Request Details</button>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import PageHeader from '~/components/ui/PageHeader.vue'
import StatusBadge from '~/components/ui/StatusBadge.vue'
import EmptyState from '~/components/ui/EmptyState.vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import { computed, reactive, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SelectField from '~/components/common/SelectField.vue'
import DatePicker from '~/components/common/DatePicker.vue'

definePageMeta({
  middleware: ['auth', 'hospital-portal'],
  layout: 'hospitaldashboard'
})

const route = useRoute()
const router = useRouter()
const requestId = route.params.id

const api = useApi()
const bloodRequests = useBloodRequests()


/* State   */
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

const newDocuments = ref([])

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

/* Fetching  */

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
    const data = await api.get('/bloodinventory/summary')
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
    const data = await api.get(`/bloodrequests/${requestId}/audit-log`)
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


/* Editability    */

const isEditable = computed(() => originalRequest.value?.status === 'Pending')

const statusMeta = {
  Pending:            { tone: 'warning' },
  Approved:           { tone: 'info' },
  Processing:         { tone: 'purple' },
  'Ready for Pickup': { tone: 'info' },
  Completed:          { tone: 'success' },
  Rejected:           { tone: 'danger' },
  Cancelled:          { tone: 'neutral' }
}

// Each status as a StatusBadge tone, so the colours match every staff page.
function statusTone(status) {
  return statusMeta[status]?.tone ?? statusMeta.Pending.tone
}


/* Change tracking / summary   */

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


/* Validation   */

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

/* Documents     */

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

/* Actions      */

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
    router.push(`/hospital/bloodrequests/${requestId}`)
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
    router.push(`/hospital/bloodrequests/${requestId}`)
  } catch (err) {
    saveError.value = err?.message || 'Unable to save changes. Please try again.'
  } finally {
    isSavingChanges.value = false
  }
}

function handleCancel() {
  router.push(`/hospital/bloodrequests/${requestId}`)
}

function handleReturnToDetails() {
  router.push(`/hospital/bloodrequests/${requestId}`)
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

<style scoped>
.eb-page {
  --eb-primary: var(--rb-primary);
  --eb-primary-hover: color-mix(in srgb, var(--rb-primary) 88%, #000);
  --eb-warning: var(--rb-warning);
  --eb-success: var(--rb-success);
  --eb-danger: var(--rb-accent);
  --eb-bg: var(--rb-page-bg);
  --eb-card: var(--rb-surface);
  --eb-border: var(--rb-border);
  --eb-border-dark: var(--rb-border-strong);
  --eb-text: var(--rb-text-primary);
  --eb-text-muted: var(--rb-text-secondary);

  font-family: var(--rb-font-sans);
  background: var(--eb-bg);
  min-height: 100%;
  padding: 24px var(--rb-gutter, 24px) 110px;
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
  color: var(--rb-primary-text);
  text-decoration: none;
  margin-bottom: 10px;
}
.eb-back:hover { text-decoration: underline; }
.eb-back-arrow { flex-shrink: 0; }

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
  background: rgba(var(--rb-warning-rgb), 0.1);
  border: 1px solid rgba(var(--rb-warning-rgb), 0.35);
  border-radius: 14px;
  padding: 16px 20px;
  margin-bottom: 20px;
}
.eb-locked-icon { flex-shrink: 0; margin-top: 1px; color: var(--rb-warning-text); }
.eb-locked-text { display: flex; flex-direction: column; gap: 4px; font-size: 14px; color: var(--rb-warning-text); }

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
  background: var(--rb-surface);
  border-color: var(--eb-border);
  color: var(--eb-text);
}
.eb-btn-outline:hover:not(:disabled) {
  border-color: var(--rb-primary-text);
  color: var(--rb-primary-text);
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
fieldset.eb-card:disabled { background: var(--rb-surface-alt); }
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
  background: var(--rb-surface);
  color: var(--eb-text);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.eb-input:focus {
  outline: none;
  border-color: var(--rb-primary-text);
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
  background: var(--rb-surface-alt);
}
.eb-doc-item-new { border-color: var(--rb-primary-text); background: rgba(var(--rb-primary-rgb), 0.06); }
.eb-doc-icon { flex-shrink: 0; }
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
  color: var(--rb-primary-text);
  border: 1px dashed var(--eb-primary);
  border-radius: 10px;
  padding: 9px 14px;
  cursor: pointer;
  margin-top: 6px;
}
.eb-upload-input { display: none; }

/* ---------- change summary ---------- */
.eb-change-card { border-color: rgba(var(--rb-primary-rgb), 0.35); }
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
.eb-change-arrow { color: var(--rb-primary-text); flex-shrink: 0; }
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
.eb-audit-arrow { color: var(--rb-primary-text); flex-shrink: 0; }
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
.eb-availability-bar-track { height: 6px; border-radius: 999px; background: var(--rb-surface-alt); overflow: hidden; }
.eb-availability-bar-fill { display: block; height: 100%; border-radius: 999px; background: var(--eb-success); }
.eb-availability-units { font-size: 13px; font-weight: 700; text-align: right; }

.eb-rules-list { margin: 0; padding-left: 18px; font-size: 13px; color: var(--eb-text-muted); display: flex; flex-direction: column; gap: 8px; }

/* ---------- sticky action bar ---------- */
.eb-action-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--rb-surface);
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
.eb-error-icon, .eb-empty-icon { flex-shrink: 0; }
.eb-error-text, .eb-empty-text { font-size: 14px; color: var(--eb-text-muted); }

/* ---------- skeleton ---------- */
.eb-skeleton-wrap { display: flex; flex-direction: column; gap: 20px; }
.eb-skeleton {
  border-radius: 18px;
  background: linear-gradient(90deg, var(--rb-surface-alt) 25%, var(--rb-surface-hover) 37%, var(--rb-surface-alt) 63%);
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

</style>
