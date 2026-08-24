<template>
  <div class="admin-page">
    <header class="page-header">
      <div>
        <h1>Facility Registrations</h1>
        <p class="subtitle">
          Review blood center applications and manage facility access.
        </p>
      </div>

      <button type="button" class="ghost-btn" :disabled="loading" @click="load">
        <AssetIcon name="refresh-cw" :size="16" />
        {{ loading ? 'Loading…' : 'Refresh' }}
      </button>
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
      <table class="registrations">
        <thead>
          <tr>
            <th>Facility</th>
            <th>DOH License</th>
            <th>Contact</th>
            <th>Submitted</th>
            <th>Status</th>
            <th class="actions-col">Actions</th>
          </tr>
        </thead>

        <tbody>
          <tr v-if="loading">
            <td colspan="6" class="state">Loading registrations…</td>
          </tr>

          <tr v-else-if="loadError">
            <td colspan="6" class="state state-error">{{ loadError }}</td>
          </tr>

          <tr v-else-if="!rows.length">
            <td colspan="6" class="state">No {{ activeLabel.toLowerCase() }} registrations.</td>
          </tr>

          <tr v-for="row in rows" v-else :key="row.id">
            <td>
              <span class="facility-name">{{ row.name }}</span>
              <span class="muted">{{ row.address }}</span>
            </td>

            <td class="mono">{{ row.doh_license_number }}</td>

            <td>
              <span>{{ row.contact_person }}</span>
              <span class="muted">{{ row.email }}</span>
              <span class="muted">{{ row.phone }}</span>
            </td>

            <td>
              <span>{{ formatDate(row.created_at) }}</span>
              <!-- Ang resubmission mao ang labing importante nga makita sa
                   reviewer: gi-ayo na sa aplikante ang detalye. -->
              <span v-if="row.resubmitted_at" class="resubmitted">
                Resubmitted {{ formatDate(row.resubmitted_at) }}
              </span>
            </td>

            <td>
              <span class="pill" :class="`pill-${row.status}`">{{ labelFor(row.status) }}</span>
              <span v-if="row.rejection_reason" class="muted reason">{{ row.rejection_reason }}</span>
            </td>

            <td class="actions-col">
              <div class="row-actions">
                <button
                  v-for="action in actionsFor(row.status)"
                  :key="action.kind"
                  type="button"
                  class="action-btn"
                  :class="action.kind"
                  :disabled="busyId === row.id"
                  @click="startAction(row, action)"
                >
                  {{ action.label }}
                </button>

                <span v-if="!actionsFor(row.status).length" class="muted">
                  Awaiting applicant
                </span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <footer v-if="lastPage > 1" class="pagination">
      <button type="button" class="ghost-btn" :disabled="page <= 1 || loading" @click="goToPage(page - 1)">
        Previous
      </button>

      <span class="page-label">Page {{ page }} of {{ lastPage }}</span>

      <button type="button" class="ghost-btn" :disabled="page >= lastPage || loading" @click="goToPage(page + 1)">
        Next
      </button>
    </footer>

    <!-- Reason modal — gikinahanglan sa reject ug suspend (required|max:255). -->
    <Teleport to="body">
      <div v-if="modal.open" class="modal-overlay" @click.self="closeModal">
        <div class="modal">
          <h2>{{ modal.title }}</h2>
          <p class="modal-lede">{{ modal.lede }}</p>

          <label for="reason">Reason</label>
          <textarea
            id="reason"
            v-model="modal.reason"
            rows="3"
            maxlength="255"
            placeholder="Explain the decision. This is emailed to the facility."
          />
          <span class="counter">{{ modal.reason.length }} / 255</span>

          <p v-if="modal.error" class="state-error">{{ modal.error }}</p>

          <div class="modal-actions">
            <button type="button" class="ghost-btn" :disabled="modal.submitting" @click="closeModal">
              Cancel
            </button>

            <button
              type="button"
              class="action-btn"
              :class="modal.kind"
              :disabled="modal.submitting || !modal.reason.trim()"
              @click="confirmAction"
            >
              {{ modal.submitting ? 'Submitting…' : modal.confirmLabel }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import { adminService } from '~/api/admin/AdminService'
import { useUser } from '~/composables/useUser.js'

definePageMeta({
  middleware: 'auth',
})

useHead({ title: 'Facility Registrations · RedAgos' })

const { user, fetchUser } = useUser()

const TABS = [
  { value: 'pending_approval', label: 'Pending Approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'suspended', label: 'Suspended' },
]

const STATUS_LABELS = {
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  rejected: 'Rejected',
  suspended: 'Suspended',
}

const activeStatus = ref('pending_approval')
const rows = ref([])
const page = ref(1)
const lastPage = ref(1)
const total = ref(null)

const loading = ref(true)
const loadError = ref('')
const busyId = ref(null)
const banner = ref('')
const bannerKind = ref('info')

const activeLabel = computed(() => STATUS_LABELS[activeStatus.value] ?? activeStatus.value)

const modal = reactive({
  open: false,
  kind: '',
  row: null,
  title: '',
  lede: '',
  confirmLabel: '',
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

/**
 * Ang mga aksyon kay gisunod gyud sa state rules sa server, mao nga wala gyud
 * ta mo-presenta og button nga mo-409 ra puhon.
 */
function actionsFor(status) {
  if (status === 'pending_approval') {
    return [
      { kind: 'approve', label: 'Approve', needsReason: false },
      { kind: 'reject', label: 'Reject', needsReason: true },
    ]
  }

  if (status === 'approved') {
    return [{ kind: 'suspend', label: 'Suspend', needsReason: true }]
  }

  if (status === 'suspended') {
    return [{ kind: 'reinstate', label: 'Reinstate', needsReason: false }]
  }

  // Ang rejected kay ang aplikante ra ang makabalik niini pinaagi sa
  // resubmission — walay "reopen" ang admin.
  return []
}

const MODAL_COPY = {
  reject: {
    title: 'Reject registration',
    lede: 'The facility will be told why, and can correct the details and submit again.',
    confirmLabel: 'Reject',
  },
  suspend: {
    title: 'Suspend facility',
    lede: 'Staff keep their accounts but lose access to inventory until reinstated.',
    confirmLabel: 'Suspend',
  },
}

function startAction(row, action) {
  banner.value = ''

  if (!action.needsReason) {
    return runAction(row, action.kind)
  }

  const copy = MODAL_COPY[action.kind]

  Object.assign(modal, {
    open: true,
    kind: action.kind,
    row,
    title: copy.title,
    lede: copy.lede,
    confirmLabel: copy.confirmLabel,
    reason: '',
    error: '',
    submitting: false,
  })
}

function closeModal() {
  if (modal.submitting) return
  modal.open = false
  modal.row = null
}

async function confirmAction() {
  modal.submitting = true
  modal.error = ''

  try {
    await callEndpoint(modal.row.id, modal.kind, modal.reason.trim())

    modal.open = false
    modal.row = null

    showBanner(`${modal.confirmLabel} completed.`, 'success')
    await load()
  } catch (error) {
    modal.error = messageFor(error)
  } finally {
    modal.submitting = false
  }
}

async function runAction(row, kind) {
  busyId.value = row.id

  try {
    await callEndpoint(row.id, kind)
    showBanner(`${row.name} — ${kind} completed.`, 'success')
    await load()
  } catch (error) {
    showBanner(messageFor(error), 'error')

    // Ang 409 nagpasabot nga nausab ang state samtang nagtan-aw ta, so
    // i-refresh nato ang lista aron sakto ang gipakita nga mga buton.
    if (error?.status === 409) {
      await load()
    }
  } finally {
    busyId.value = null
  }
}

function callEndpoint(id, kind, reason = '') {
  if (kind === 'approve') return adminService.approve(id)
  if (kind === 'reject') return adminService.reject(id, reason)
  if (kind === 'suspend') return adminService.suspend(id, reason)
  if (kind === 'reinstate') return adminService.reinstate(id)

  throw new Error(`Unknown action: ${kind}`)
}

/**
 * Gi-attach na sa BaseService ang `code` ug ang 422 `errors` bag, so ipakita
 * nato ang tinuod nga mensahe sa server — labi na ang self_approval_forbidden
 * ug ang mga facility_not_* nga 409.
 */
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

function changeStatus(status) {
  if (activeStatus.value === status) return

  activeStatus.value = status
  page.value = 1
  banner.value = ''
}

function goToPage(next) {
  page.value = next
}

// Ang Supabase kay mahinay usahay (4-17s). Kung mag-ilis-ilis og tab ang user,
// posible nga ang daan nga response mo-abot HUMAN sa bag-o — so mo-render ta og
// sayop nga data ilalom sa laing tab. Kini nga counter mao ang mo-piho nga ang
// katapusang request ra ang makasulat sa state.
let latestRequest = 0

async function load() {
  const requestId = ++latestRequest

  loading.value = true
  loadError.value = ''

  try {
    const data = await adminService.list({
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
    // Ang stale nga request dili mo-clear sa loading flag, kay naa pay bag-o
    // nga nagdagan.
    if (requestId === latestRequest) {
      loading.value = false
    }
  }
}

watch([activeStatus, page], load)

onMounted(async () => {
  // UX ra ni nga pag-check — ang `role:admin` sa server mao gihapon ang tinuod
  // nga gate. Kung dili admin, ang API mo-403 gihapon bisan makaabot sila diri.
  if (!user.value) {
    await fetchUser()
  }

  if (user.value && !user.value.roles?.includes('admin')) {
    return navigateTo('/auth/role-selection')
  }

  await load()
})
</script>

<style scoped>
.admin-page {
  min-height: 100vh;
  padding: 32px 24px 48px;
  background: #f7f9fc;
  color: #1e293b;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  max-width: 1180px;
  margin: 0 auto 20px;
}

.page-header h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 800;
}

.subtitle {
  margin: 6px 0 0;
  font-size: 14px;
  color: #64748b;
}

.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-width: 1180px;
  margin: 0 auto 16px;
}

.tab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border: 1px solid #e5eaf0;
  border-radius: 999px;
  background: #ffffff;
  color: #475569;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.tab.active {
  background: #1565c0;
  border-color: #1565c0;
  color: #ffffff;
}

.tab-count {
  padding: 1px 7px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.24);
  font-size: 11px;
}

.banner {
  max-width: 1180px;
  margin: 0 auto 16px;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 14px;
}

.banner-success { background: #ecfdf5; color: #047857; }
.banner-error { background: #fef2f2; color: #b91c1c; }
.banner-info { background: #eff6ff; color: #1d4ed8; }

.table-wrap {
  max-width: 1180px;
  margin: 0 auto;
  background: #ffffff;
  border: 1px solid #eef1f5;
  border-radius: 12px;
  overflow-x: auto;
}

.registrations {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.registrations th {
  padding: 12px 16px;
  text-align: left;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #64748b;
  border-bottom: 1px solid #eef1f5;
  white-space: nowrap;
}

.registrations td {
  padding: 14px 16px;
  border-bottom: 1px solid #f4f6f9;
  vertical-align: top;
}

.registrations tbody tr:last-child td {
  border-bottom: none;
}

.facility-name {
  display: block;
  font-weight: 600;
}

.muted {
  display: block;
  color: #94a3b8;
  font-size: 12px;
  margin-top: 2px;
}

.reason {
  max-width: 220px;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px;
  white-space: nowrap;
}

.resubmitted {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  font-weight: 600;
  color: #b45309;
}

.pill {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.pill-pending_approval { background: #fff7ed; color: #b45309; }
.pill-approved { background: #ecfdf5; color: #047857; }
.pill-rejected { background: #fef2f2; color: #b91c1c; }
.pill-suspended { background: #f1f5f9; color: #475569; }

.actions-col {
  text-align: right;
}

.row-actions {
  display: inline-flex;
  gap: 6px;
  justify-content: flex-end;
  flex-wrap: wrap;
}

.action-btn {
  padding: 6px 12px;
  border: none;
  border-radius: 7px;
  font-size: 13px;
  font-weight: 600;
  color: #ffffff;
  cursor: pointer;
  white-space: nowrap;
}

.action-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.action-btn.approve { background: #2e7d32; }
.action-btn.reject { background: #d32f2f; }
.action-btn.suspend { background: #b45309; }
.action-btn.reinstate { background: #1565c0; }

.ghost-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: 1px solid #e5eaf0;
  border-radius: 8px;
  background: #ffffff;
  color: #475569;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.ghost-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.state {
  padding: 32px 16px;
  text-align: center;
  color: #94a3b8;
}

.state-error {
  color: #b91c1c;
  font-size: 14px;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  max-width: 1180px;
  margin: 18px auto 0;
}

.page-label {
  font-size: 13px;
  color: #64748b;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(15, 23, 42, 0.45);
}

.modal {
  width: 100%;
  max-width: 460px;
  background: #ffffff;
  border-radius: 14px;
  padding: 24px;
}

.modal h2 {
  margin: 0 0 6px;
  font-size: 18px;
  font-weight: 700;
}

.modal-lede {
  margin: 0 0 18px;
  font-size: 13px;
  color: #64748b;
  line-height: 1.5;
}

.modal label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #475569;
  margin-bottom: 6px;
}

.modal textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #e5eaf0;
  border-radius: 8px;
  font-family: inherit;
  font-size: 14px;
  color: #1e293b;
  resize: vertical;
}

.modal textarea:focus {
  outline: none;
  border-color: #1565c0;
}

.counter {
  display: block;
  text-align: right;
  font-size: 11px;
  color: #94a3b8;
  margin-top: 4px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 18px;
}
</style>
