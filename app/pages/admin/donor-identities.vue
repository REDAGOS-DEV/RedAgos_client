<template>
  <div class="admin-page">
    <header class="page-header">
      <div>
        <h1>Donor ID Verification</h1>
        <p class="subtitle">
          Review the government IDs donors have submitted.
        </p>
      </div>

      <div class="header-actions">
        <span v-if="user" class="signed-in-as">{{ user.full_name || user.email }}</span>

        <NuxtLink to="/admin/registrations" class="ghost-btn">
          <AssetIcon name="building-2" :size="16" />
          Facility Registrations
        </NuxtLink>

        <button type="button" class="ghost-btn" :disabled="loading" @click="load">
          <AssetIcon name="refresh-cw" :size="16" />
          {{ loading ? 'Loading…' : 'Refresh' }}
        </button>

        <button type="button" class="ghost-btn" :disabled="loggingOut" @click="handleLogout">
          <AssetIcon name="log-out" :size="16" />
          {{ loggingOut ? 'Logging out…' : 'Log Out' }}
        </button>
      </div>
    </header>

    <nav class="tabs">
      <button
        v-for="tab in TABS"
        :key="tab.value"
        type="button"
        class="tab"
        :class="{ active: activeStatus === tab.value }"
        @click="changeStatus(tab.value)"
      >
        {{ tab.label }}
        <span v-if="activeStatus === tab.value && total !== null" class="tab-count">{{ total }}</span>
      </button>
    </nav>

    <p v-if="banner" class="banner" :class="`banner-${bannerKind}`">{{ banner }}</p>

    <div class="table-wrap">
      <table class="submissions">
        <thead>
          <tr>
            <th>Donor</th>
            <th>ID type</th>
            <th>ID number</th>
            <th>Submitted</th>
            <th>Status</th>
            <th class="actions-col">Actions</th>
          </tr>
        </thead>

        <tbody>
          <tr v-if="loading">
            <td colspan="6" class="state">Loading submissions…</td>
          </tr>

          <tr v-else-if="loadError">
            <td colspan="6" class="state state-error">{{ loadError }}</td>
          </tr>

          <tr v-else-if="!rows.length">
            <td colspan="6" class="state">Nothing here.</td>
          </tr>

          <tr v-for="row in rows" v-else :key="row.uuid">
            <td>
              <span class="donor-name">{{ row.full_name }}</span>
              <span class="donor-meta">{{ row.email || row.phone || '—' }}</span>
            </td>
            <td>{{ row.valid_id_type_label || '—' }}</td>
            <!--
              Masked gyud ni. Ang tinuod nga numero kay basahon sa reviewer gikan
              sa litrato mismo — walay rason nga ihatag siya sa lista.
            -->
            <td class="mono">{{ row.valid_id_number_masked || '—' }}</td>
            <td>{{ formatDate(row.submitted_at) }}</td>
            <td>
              <span class="status-pill" :class="`status-${row.identity_status}`">
                {{ labelFor(row.identity_status) }}
              </span>
            </td>
            <td class="actions-col">
              <button type="button" class="link-btn" @click="openReview(row)">
                Review ID
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="lastPage > 1" class="pagination">
      <button type="button" class="ghost-btn" :disabled="page <= 1" @click="goToPage(page - 1)">Previous</button>
      <span class="page-label">Page {{ page }} of {{ lastPage }}</span>
      <button type="button" class="ghost-btn" :disabled="page >= lastPage" @click="goToPage(page + 1)">Next</button>
    </div>

    <!-- Review drawer -->
    <div v-if="review.open" class="modal-backdrop" @click.self="closeReview">
      <div class="modal modal-wide">
        <h2 class="modal-title">{{ review.row?.full_name }}</h2>
        <p class="modal-lede">
          Check the photo against the details below, then verify or reject.
        </p>

        <div class="review-body">
          <div class="review-photo">
            <p v-if="loadingImage" class="photo-state">Loading photo…</p>
            <p v-else-if="!imageUrl" class="photo-state photo-state--error">
              {{ photoError || 'No photo on file.' }}
            </p>
            <img v-else :src="imageUrl" alt="Submitted ID" class="photo">
          </div>

          <dl class="review-facts">
            <div><dt>ID type</dt><dd>{{ review.row?.valid_id_type_label || '—' }}</dd></div>
            <div><dt>ID number</dt><dd class="mono">{{ review.row?.valid_id_number_masked || '—' }}</dd></div>
            <div><dt>Date of birth</dt><dd>{{ formatDate(review.row?.birth_date) }}</dd></div>
            <div><dt>Blood type</dt><dd>{{ review.row?.blood_type || '—' }}</dd></div>
            <div><dt>Address</dt><dd>{{ review.row?.address || '—' }}</dd></div>
            <div><dt>Submitted</dt><dd>{{ formatDate(review.row?.submitted_at) }}</dd></div>
          </dl>
        </div>

        <div v-if="review.rejecting" class="reason-block">
          <label class="reason-label" for="reason">Reason</label>
          <textarea
            id="reason"
            v-model="review.reason"
            class="reason-input"
            rows="3"
            placeholder="Tell the donor what to fix, e.g. the photo is too blurry to read."
          />
        </div>

        <p v-if="review.error" class="modal-error">{{ review.error }}</p>

        <div class="modal-actions">
          <button type="button" class="ghost-btn" :disabled="review.submitting" @click="closeReview">Cancel</button>

          <template v-if="review.rejecting">
            <button type="button" class="danger-btn" :disabled="review.submitting || !review.reason.trim()" @click="confirmReject">
              {{ review.submitting ? 'Rejecting…' : 'Reject' }}
            </button>
          </template>
          <template v-else>
            <button type="button" class="danger-btn" :disabled="review.submitting" @click="review.rejecting = true">
              Reject
            </button>
            <button type="button" class="primary-btn" :disabled="review.submitting" @click="confirmApprove">
              {{ review.submitting ? 'Verifying…' : 'Verify' }}
            </button>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import { donorIdentityService } from '~/api/admin/DonorIdentityService'
import { useUser } from '~/composables/useUser.js'

definePageMeta({
  middleware: 'auth',
})

useHead({ title: 'Donor ID Verification · RedAgos' })

const { user, fetchUser, logout } = useUser()

const TABS = [
  { value: 'pending', label: 'Awaiting Review' },
  { value: 'verified', label: 'Verified' },
  { value: 'rejected', label: 'Not Approved' },
]

const STATUS_LABELS = {
  unsubmitted: 'Not submitted',
  pending: 'Awaiting review',
  verified: 'Verified',
  rejected: 'Not approved',
}

const loggingOut = ref(false)

const activeStatus = ref('pending')
const rows = ref([])
const page = ref(1)
const lastPage = ref(1)
const total = ref(null)

const loading = ref(true)
const loadError = ref('')
const banner = ref('')
const bannerKind = ref('info')

// Ang litrato kay authenticated ang route, so dili siya mahimong <img src>.
// I-fetch nato dala ang token, unya object URL ang i-render.
const imageUrl = ref(null)
const loadingImage = ref(false)
const photoError = ref('')
let objectUrl = null

const review = reactive({
  open: false,
  row: null,
  rejecting: false,
  reason: '',
  error: '',
  submitting: false,
})

function labelFor(status) {
  return STATUS_LABELS[status] ?? status
}

function formatDate(value) {
  if (!value) return '—'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function releasePhoto() {
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl)
    objectUrl = null
  }
  imageUrl.value = null
  photoError.value = ''
}

async function openReview(row) {
  banner.value = ''

  Object.assign(review, {
    open: true,
    row,
    rejecting: false,
    reason: '',
    error: '',
    submitting: false,
  })

  releasePhoto()

  if (!row.image_url) {
    photoError.value = 'No photo on file.'
    return
  }

  loadingImage.value = true

  try {
    const blob = await donorIdentityService.image(row.uuid)
    objectUrl = URL.createObjectURL(blob)
    imageUrl.value = objectUrl
  } catch (error) {
    photoError.value = messageFor(error)
  } finally {
    loadingImage.value = false
  }
}

function closeReview() {
  if (review.submitting) return

  review.open = false
  review.row = null
  releasePhoto()
}

async function confirmApprove() {
  await decide(() => donorIdentityService.approve(review.row.uuid, review.row.submission_version))
}

async function confirmReject() {
  await decide(() => donorIdentityService.reject(
    review.row.uuid,
    review.row.submission_version,
    review.reason.trim()
  ))
}

/**
 * Ang decision kay dala ang `submission_version` nga gipakita sa reviewer. Kung
 * giilisan sa donor ang dokumento samtang nagtan-aw ta, mo-409 ang server —
 * dili nato i-toast lang, kinahanglan i-reload ang lista aron ang bag-o nga
 * dokumento ang matan-aw.
 */
async function decide(call) {
  review.submitting = true
  review.error = ''

  try {
    const response = await call()

    review.open = false
    review.row = null
    releasePhoto()

    showBanner(response?.message || 'Decision recorded.', 'success')
    await load()
  } catch (error) {
    review.error = messageFor(error)

    if (error?.status === 409) {
      review.open = false
      review.row = null
      releasePhoto()

      showBanner(messageFor(error), 'error')
      await load()
    }
  } finally {
    review.submitting = false
  }
}

function messageFor(error) {
  const fieldErrors = error?.errors

  if (fieldErrors) {
    return Object.values(fieldErrors).flat().join(' ')
  }

  return error?.message || 'Something went wrong. Please try again.'
}

function showBanner(message, kind) {
  banner.value = message
  bannerKind.value = kind
}

async function handleLogout() {
  loggingOut.value = true
  await logout('/auth/admin/login')
}

function changeStatus(status) {
  if (activeStatus.value === status) return

  activeStatus.value = status
  page.value = 1
  banner.value = ''
}

function goToPage(next) {
  page.value = next
}

// Parehas sa registrations page: kung mag-ilis-ilis og tab, posible nga ang
// daan nga response mo-abot human sa bag-o. Ang katapusang request ra ang
// tugotan nga mosulat sa state.
let latestRequest = 0

async function load() {
  const requestId = ++latestRequest

  loading.value = true
  loadError.value = ''

  try {
    const data = await donorIdentityService.list({
      status: activeStatus.value,
      page: page.value,
    })

    if (requestId !== latestRequest) return

    rows.value = data?.data ?? []
    lastPage.value = data?.last_page ?? 1
    total.value = data?.total ?? null
  } catch (error) {
    if (requestId !== latestRequest) return

    rows.value = []
    loadError.value = messageFor(error)
  } finally {
    if (requestId === latestRequest) {
      loading.value = false
    }
  }
}

watch([activeStatus, page], load)

onMounted(async () => {
  // UX ra ni nga pag-check — ang `role:admin` sa server mao gihapon ang tinuod
  // nga gate.
  if (!user.value) {
    await fetchUser()
  }

  if (user.value && !user.value.roles?.includes('admin')) {
    return navigateTo('/auth/role-selection')
  }

  await load()
})

onUnmounted(releasePhoto)
</script>

<style scoped>
.admin-page {
  padding: 32px 40px 48px;
  max-width: 1200px;
  margin: 0 auto;
  color: #0f172a;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  flex-wrap: wrap;
  margin-bottom: 24px;
}

.page-header h1 {
  margin: 0 0 4px;
  font-size: 24px;
  font-weight: 700;
}

.subtitle {
  margin: 0;
  font-size: 14px;
  color: #64748b;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.signed-in-as {
  font-size: 13px;
  color: #64748b;
}

.ghost-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #fff;
  font-size: 13px;
  font-weight: 600;
  color: #334155;
  cursor: pointer;
  text-decoration: none;
}

.ghost-btn:hover:not(:disabled) {
  background: #f1f5f9;
}

.ghost-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid #e2e8f0;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.tab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border: none;
  border-bottom: 2px solid transparent;
  background: none;
  font-size: 13px;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
}

.tab.active {
  color: #1565c0;
  border-bottom-color: #1565c0;
}

.tab-count {
  padding: 1px 8px;
  border-radius: 999px;
  background: #e3f2fd;
  color: #1565c0;
  font-size: 11px;
}

.banner {
  margin: 0 0 16px;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 13px;
}

.banner-success {
  background: #ecfdf5;
  color: #047857;
}

.banner-error {
  background: #fef2f2;
  color: #b91c1c;
}

.banner-info {
  background: #f1f5f9;
  color: #334155;
}

.table-wrap {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow-x: auto;
  background: #fff;
}

.submissions {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.submissions th,
.submissions td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid #f1f5f9;
  vertical-align: middle;
}

.submissions th {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #64748b;
  background: #f8fafc;
}

.submissions tbody tr:last-child td {
  border-bottom: none;
}

.donor-name {
  display: block;
  font-weight: 600;
}

.donor-meta {
  display: block;
  font-size: 12px;
  color: #94a3b8;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.status-pill {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
}

.status-pending {
  background: #fff7ed;
  color: #c2410c;
}

.status-verified {
  background: #ecfdf5;
  color: #047857;
}

.status-rejected {
  background: #fef2f2;
  color: #b91c1c;
}

.status-unsubmitted {
  background: #f1f5f9;
  color: #475569;
}

.actions-col {
  text-align: right;
  white-space: nowrap;
}

.link-btn {
  border: none;
  background: none;
  color: #1565c0;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
}

.link-btn:hover {
  text-decoration: underline;
}

.state {
  text-align: center;
  padding: 32px 16px;
  color: #94a3b8;
}

.state-error {
  color: #b91c1c;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 16px;
}

.page-label {
  font-size: 13px;
  color: #64748b;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: 50;
}

.modal {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.25);
}

.modal-wide {
  max-width: 720px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-title {
  margin: 0 0 4px;
  font-size: 18px;
  font-weight: 700;
}

.modal-lede {
  margin: 0 0 16px;
  font-size: 13px;
  color: #64748b;
}

.review-body {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
  gap: 20px;
  margin-bottom: 16px;
}

@media (max-width: 720px) {
  .review-body {
    grid-template-columns: 1fr;
  }
}

.review-photo {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.photo {
  max-width: 100%;
  max-height: 320px;
  object-fit: contain;
  display: block;
}

.photo-state {
  margin: 0;
  font-size: 13px;
  color: #94a3b8;
}

.photo-state--error {
  color: #b91c1c;
}

.review-facts {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.review-facts div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.review-facts dt {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #94a3b8;
}

.review-facts dd {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: #0f172a;
  word-break: break-word;
}

.reason-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}

.reason-label {
  font-size: 12px;
  font-weight: 600;
  color: #334155;
}

.reason-input {
  width: 100%;
  padding: 9px 11px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 13px;
  font-family: inherit;
  resize: vertical;
  outline: none;
}

.reason-input:focus {
  border-color: #1565c0;
  box-shadow: 0 0 0 3px rgba(21, 101, 192, 0.12);
}

.modal-error {
  margin: 0 0 12px;
  font-size: 13px;
  color: #b91c1c;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}

.primary-btn,
.danger-btn {
  padding: 9px 16px;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  cursor: pointer;
}

.primary-btn {
  background: #1565c0;
}

.primary-btn:hover:not(:disabled) {
  background: #0d47a1;
}

.danger-btn {
  background: #dc2626;
}

.danger-btn:hover:not(:disabled) {
  background: #b91c1c;
}

.primary-btn:disabled,
.danger-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
