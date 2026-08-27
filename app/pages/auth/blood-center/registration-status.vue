<template>
  <div class="status-page">
    <div class="status-card">
      <div class="brand">
        <img :src="logo" alt="RedAgos" class="brand-logo">
        <h1>Red<span class="brand-accent">Agos</span></h1>
      </div>

      <p v-if="loading" class="state">Loading your registration…</p>

      <p v-else-if="loadError" class="state state-error">{{ loadError }}</p>

      <template v-else>
        <span class="badge" :class="`badge-${facility.status}`">{{ statusLabel }}</span>

        <h2 class="facility-name">{{ facility.name }}</h2>
        <p class="lede">{{ statusMessage }}</p>

        <p v-if="facility.rejection_reason" class="reason">
          <strong>Reason given:</strong> {{ facility.rejection_reason }}
        </p>

        <form v-if="canResubmit" class="resubmit-form" @submit.prevent="submitResubmission">
          <h3>Correct and resubmit</h3>

          <label for="centerName">Blood Center Name</label>
          <input id="centerName" v-model="form.centerName" type="text">

          <label for="dohLicense">DOH License Number</label>
          <input id="dohLicense" v-model="form.dohLicense" type="text">

          <label for="contactPerson">Contact Person</label>
          <input id="contactPerson" v-model="form.contactPerson" type="text">

          <label for="address">Address</label>
          <input id="address" v-model="form.address" type="text">

          <label for="description">Description</label>
          <textarea id="description" v-model="form.description" rows="3" />

          <p v-if="errorMessage" class="state-error">{{ errorMessage }}</p>
          <ul v-if="fieldErrors.length" class="state-error">
            <li v-for="(message, index) in fieldErrors" :key="index">{{ message }}</li>
          </ul>
          <p v-if="successMessage" class="state-success">{{ successMessage }}</p>

          <button type="submit" class="primary-btn" :disabled="submitting">
            {{ submitting ? 'Submitting…' : 'Resubmit registration' }}
          </button>
        </form>

        <div class="actions">
          <button type="button" class="ghost-btn" @click="load">Refresh</button>
          <button type="button" class="ghost-btn" @click="signOut">Sign out</button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import logo from '~/assets/images/RedAgosLogo.png'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import { useUser } from '~/composables/useUser.js'

definePageMeta({
  middleware: 'auth',
})

useHead({ title: 'Registration Status · RedAgos' })

const { logout } = useUser()

const loading = ref(true)
const loadError = ref('')
const canResubmit = ref(false)

const facility = reactive({
  id: null,
  name: '',
  status: '',
  rejection_reason: null,
  resubmitted_at: null,
  doh_license_number: '',
  contact_person: '',
  address: '',
  description: '',
})

const form = reactive({
  centerName: '',
  dohLicense: '',
  contactPerson: '',
  address: '',
  description: '',
})

const submitting = ref(false)
const errorMessage = ref('')
const fieldErrors = ref([])
const successMessage = ref('')

const STATUS_COPY = {
  pending_approval: 'Your registration is with an administrator for review. We will email you once a decision has been made.',
  rejected: 'Your registration was not approved. You can correct the details below and submit it again.',
  suspended: 'This facility has been suspended and cannot access the system. Please contact the administrator.',
  approved: 'Your facility is approved. You can now sign in to the dashboard.',
}

const statusLabel = computed(() => (facility.status || 'unknown').replace(/_/g, ' '))
const statusMessage = computed(() => STATUS_COPY[facility.status] || '')

async function load() {
  loading.value = true
  loadError.value = ''

  try {
    const data = await bloodCenterService.registrationStatus()

    Object.assign(facility, data?.facility ?? {})
    canResubmit.value = Boolean(data?.can_resubmit)

    // I-prefill ang porma sa kasamtangan nga detalye. Ang DOH licence labi na —
    // ang organisasyon parehas ra gihapon og lisensya bisan gi-reject, so dili
    // nato sila pa-type pag-usab gikan sa memorya.
    form.centerName = facility.name || ''
    form.dohLicense = facility.doh_license_number || ''
    form.contactPerson = facility.contact_person || ''
    form.address = facility.address || ''
    form.description = facility.description || ''
  } catch (error) {
    loadError.value = error?.message || 'We could not load your registration status.'
  } finally {
    loading.value = false
  }
}

async function submitResubmission() {
  submitting.value = true
  errorMessage.value = ''
  fieldErrors.value = []
  successMessage.value = ''

  try {
    await bloodCenterService.resubmitRegistration({
      center_name: form.centerName,
      doh_license_number: form.dohLicense,
      contact_person: form.contactPerson,
      address: form.address,
      description: form.description || null,
    })

    successMessage.value = 'Registration resubmitted. An administrator will review it again.'

    await load()
  } catch (error) {
    const errors = error?.errors

    if (errors) {
      fieldErrors.value = Object.values(errors).flat()
    }

    errorMessage.value = errors
      ? 'Please correct the highlighted details.'
      : (error?.message || 'We could not resubmit your registration.')
  } finally {
    submitting.value = false
  }
}

function signOut() {
  return logout('/auth/blood-center/login')
}

onMounted(load)
</script>

<style scoped>
.status-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  background: #eef4fb;
}

.status-card {
  width: 100%;
  max-width: 560px;
  background: #ffffff;
  border-radius: 16px;
  padding: 32px;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08);
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 24px;
}

.brand-logo {
  width: 36px;
  height: 36px;
  object-fit: contain;
}

.brand h1 {
  font-size: 18px;
  font-weight: 800;
  color: #1e293b;
  margin: 0;
}

.brand-accent {
  color: #d32f2f;
}

.state {
  color: #64748b;
  font-size: 14px;
}

.state-error {
  color: #d32f2f;
  font-size: 14px;
  margin: 8px 0;
}

.state-success {
  color: #2e7d32;
  font-size: 14px;
  margin: 8px 0;
}

.badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  text-transform: capitalize;
  letter-spacing: 0.02em;
}

.badge-pending_approval { background: #fff7ed; color: #b45309; }
.badge-rejected { background: #fef2f2; color: #b91c1c; }
.badge-suspended { background: #f1f5f9; color: #475569; }
.badge-approved { background: #ecfdf5; color: #047857; }

.facility-name {
  margin: 12px 0 6px;
  font-size: 22px;
  font-weight: 700;
  color: #1e293b;
}

.lede {
  color: #475569;
  font-size: 14px;
  line-height: 1.6;
  margin: 0;
}

.reason {
  margin-top: 16px;
  padding: 12px 14px;
  background: #fef2f2;
  border-left: 3px solid #d32f2f;
  border-radius: 6px;
  color: #7f1d1d;
  font-size: 14px;
}

.resubmit-form {
  margin-top: 28px;
  border-top: 1px solid #eef1f5;
  padding-top: 24px;
}

.resubmit-form h3 {
  font-size: 15px;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 16px;
}

.resubmit-form label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #475569;
  margin-bottom: 6px;
}

.resubmit-form input,
.resubmit-form textarea {
  width: 100%;
  padding: 10px 12px;
  margin-bottom: 14px;
  border: 1px solid #e5eaf0;
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  color: #1e293b;
}

.resubmit-form input:focus,
.resubmit-form textarea:focus {
  outline: none;
  border-color: #1565c0;
}

.primary-btn {
  width: 100%;
  padding: 11px 16px;
  border: none;
  border-radius: 8px;
  background: #1565c0;
  color: #ffffff;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.primary-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.actions {
  display: flex;
  gap: 10px;
  margin-top: 24px;
}

.ghost-btn {
  flex: 1;
  padding: 9px 14px;
  border: 1px solid #e5eaf0;
  border-radius: 8px;
  background: transparent;
  color: #475569;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.ghost-btn:hover {
  background: #f7f9fc;
}
</style>
