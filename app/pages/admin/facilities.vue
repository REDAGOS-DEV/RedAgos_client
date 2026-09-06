<template>
  <div class="admin-page" :class="isDark ? 'dark' : ''">
    <header class="page-header">
      <div>
        <h1>Facility Management</h1>
        <p class="subtitle">
          Create and review blood center and hospital blood bank accounts.
        </p>
      </div>

      <div class="header-actions">
        <span v-if="user" class="signed-in-as">{{ user.full_name || user.email }}</span>

        <!-- Dark Mode Toggle Button -->
        <button type="button" class="theme-toggle-btn" @click="toggleDarkMode" :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'">
          <AssetIcon :name="isDark ? 'sun' : 'moon'" :size="16" />
        </button>

        <button type="button" class="primary-btn" @click="openCreate">
          <AssetIcon name="plus" :size="16" />
          Create Facility
        </button>

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
        v-for="tab in TYPE_TABS"
        :key="tab.value || 'all'"
        type="button"
        class="tab"
        :class="{ active: activeType === tab.value }"
        @click="changeType(tab.value)"
      >
        {{ tab.label }}
        <span v-if="activeType === tab.value && total !== null" class="tab-count">{{ total }}</span>
      </button>

      <select v-model="activeStatus" class="status-filter" aria-label="Filter by status">
        <option value="">All statuses</option>
        <option v-for="(label, value) in STATUS_LABELS" :key="value" :value="value">{{ label }}</option>
      </select>
    </nav>

    <p v-if="banner" class="banner" :class="`banner-${bannerKind}`">{{ banner }}</p>

    <!-- Legacy entries only. Nothing created here can land in pending_approval,
         so this is the queue left behind by public registration draining away. -->
    <p v-if="pendingCount > 0 && !activeStatus" class="banner banner-info">
      {{ pendingCount }} facilit{{ pendingCount === 1 ? 'y' : 'ies' }} left over from the old
      self-registration flow are still awaiting a decision. Approve or reject each one to clear them.
    </p>

    <div class="table-wrap">
      <table class="facilities">
        <thead>
          <tr>
            <th>Facility</th>
            <th>Type</th>
            <th>DOH License</th>
            <th>Primary Account</th>
            <th>Status</th>
            <th class="actions-col">Actions</th>
          </tr>
        </thead>

        <tbody>
          <tr v-if="loading">
            <td colspan="6" class="state">Loading facilities…</td>
          </tr>

          <tr v-else-if="loadError">
            <td colspan="6" class="state state-error">{{ loadError }}</td>
          </tr>

          <tr v-else-if="!rows.length">
            <td colspan="6" class="state">No facilities match this filter.</td>
          </tr>

          <tr v-for="row in rows" v-else :key="row.id">
            <td>
              <span class="facility-name">{{ row.name }}</span>
              <span class="muted">{{ row.address }}</span>
              <span class="muted">{{ row.email }} · {{ row.phone }}</span>
            </td>

            <td>
              <span class="type-pill" :class="`type-${row.facility_type}`">
                {{ row.facility_type_label || row.facility_type || '—' }}
              </span>
            </td>

            <td class="mono">{{ row.doh_license_number || '—' }}</td>

            <td>
              <template v-if="row.primary_account">
                <span class="facility-name">{{ row.primary_account.full_name }}</span>
                <span class="muted">{{ row.primary_account.email }}</span>
                <span class="muted">{{ row.primary_account.position }}</span>
                <span v-if="!row.primary_account.email_verified" class="unverified">
                  Awaiting email verification
                </span>
              </template>
              <span v-else class="muted">No primary account on record</span>
            </td>

            <td>
              <span class="pill" :class="`pill-${row.status}`">{{ labelFor(row.status) }}</span>
              <span v-if="row.rejection_reason" class="muted reason">{{ row.rejection_reason }}</span>
              <span class="muted">Created {{ formatDate(row.created_at) }}</span>
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

                <span v-if="!actionsFor(row.status).length" class="muted">—</span>
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

    <!-- Reason modal — gikinahanglan sa reject (required|max:255). -->
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

    <!-- Create Facility. The facility and its first account are one submission
         because the server creates them in one transaction. -->
    <Teleport to="body">
      <div v-if="create.open" class="modal-overlay" @click.self="closeCreate">
        <form class="modal modal-wide" @submit.prevent="submitCreate">
          <h2>Create facility</h2>
          <p class="modal-lede">
            The facility is active as soon as it is created. Its primary account must verify
            its email address before it can sign in.
          </p>

          <fieldset class="type-choice">
            <legend>Facility type</legend>

            <label
              v-for="option in FACILITY_TYPES"
              :key="option.value"
              class="type-option"
              :class="{ selected: form.facility_type === option.value }"
            >
              <input
                v-model="form.facility_type"
                type="radio"
                name="facility_type"
                :value="option.value"
              />
              <span>
                <strong>{{ option.label }}</strong>
                <small>{{ option.hint }}</small>
              </span>
            </label>
          </fieldset>
          <p v-if="errorFor('facility_type')" class="field-error">{{ errorFor('facility_type') }}</p>

          <h3 class="section-heading">Facility details</h3>

          <div class="field-grid">
            <div class="field">
              <label for="f-name">Facility name</label>
              <input id="f-name" v-model="form.name" type="text" maxlength="150" required />
              <p v-if="errorFor('name')" class="field-error">{{ errorFor('name') }}</p>
            </div>

            <div class="field">
              <label for="f-license">DOH license number</label>
              <input id="f-license" v-model="form.doh_license_number" type="text" maxlength="50" required />
              <p v-if="errorFor('doh_license_number')" class="field-error">{{ errorFor('doh_license_number') }}</p>
            </div>

            <div class="field field-wide">
              <label for="f-address">Address</label>
              <input id="f-address" v-model="form.address" type="text" maxlength="255" required />
              <p v-if="errorFor('address')" class="field-error">{{ errorFor('address') }}</p>
            </div>

            <div class="field">
              <label for="f-email">Facility email</label>
              <input id="f-email" v-model="form.email" type="email" maxlength="150" required />
              <p v-if="errorFor('email')" class="field-error">{{ errorFor('email') }}</p>
            </div>

            <div class="field">
              <label for="f-phone">Facility phone</label>
              <input id="f-phone" v-model="form.phone" type="tel" placeholder="09171234567" required />
              <p v-if="errorFor('phone')" class="field-error">{{ errorFor('phone') }}</p>
            </div>

            <div class="field field-wide">
              <label for="f-description">Description</label>
              <textarea id="f-description" v-model="form.description" rows="2" maxlength="1000" />
              <p v-if="errorFor('description')" class="field-error">{{ errorFor('description') }}</p>
            </div>
          </div>

          <!-- Only a blood center takes donor bookings, so the operating
               details are shown for one type and dropped by the server for
               the other. -->
          <template v-if="acceptsBookings">
            <h3 class="section-heading">Operating details</h3>

            <div class="field-grid">
              <div class="field field-wide">
                <label for="f-hours">Operating hours</label>
                <input
                  id="f-hours"
                  v-model="form.operating_hours"
                  type="text"
                  maxlength="100"
                  placeholder="Mon - Fri 8 AM - 3 PM"
                />
                <p v-if="errorFor('operating_hours')" class="field-error">{{ errorFor('operating_hours') }}</p>
              </div>

              <div class="field">
                <label for="f-start">Slots open at</label>
                <input id="f-start" v-model="form.slots_start_at" type="time" />
                <p v-if="errorFor('slots_start_at')" class="field-error">{{ errorFor('slots_start_at') }}</p>
              </div>

              <div class="field">
                <label for="f-end">Slots close at</label>
                <input id="f-end" v-model="form.slots_end_at" type="time" />
                <p v-if="errorFor('slots_end_at')" class="field-error">{{ errorFor('slots_end_at') }}</p>
              </div>

              <div class="field">
                <label for="f-capacity">Slot capacity</label>
                <input id="f-capacity" v-model.number="form.slot_capacity" type="number" min="1" max="500" />
                <p v-if="errorFor('slot_capacity')" class="field-error">{{ errorFor('slot_capacity') }}</p>
              </div>

              <div class="field">
                <label for="f-interval">Slot interval (minutes)</label>
                <input
                  id="f-interval"
                  v-model.number="form.slot_interval_minutes"
                  type="number"
                  min="5"
                  max="240"
                />
                <p v-if="errorFor('slot_interval_minutes')" class="field-error">
                  {{ errorFor('slot_interval_minutes') }}
                </p>
              </div>
            </div>
          </template>

          <h3 class="section-heading">Primary account</h3>

          <div class="field-grid">
            <div class="field">
              <label for="a-first">First name</label>
              <input id="a-first" v-model="form.primary_account.first_name" type="text" maxlength="150" required />
              <p v-if="errorFor('primary_account.first_name')" class="field-error">
                {{ errorFor('primary_account.first_name') }}
              </p>
            </div>

            <div class="field">
              <label for="a-last">Last name</label>
              <input id="a-last" v-model="form.primary_account.last_name" type="text" maxlength="150" required />
              <p v-if="errorFor('primary_account.last_name')" class="field-error">
                {{ errorFor('primary_account.last_name') }}
              </p>
            </div>

            <div class="field field-wide">
              <label for="a-position">Position</label>
              <input id="a-position" v-model="form.primary_account.position" type="text" maxlength="100" required />
              <p v-if="errorFor('primary_account.position')" class="field-error">
                {{ errorFor('primary_account.position') }}
              </p>
            </div>

            <div class="field">
              <label for="a-email">Email</label>
              <input id="a-email" v-model="form.primary_account.email" type="email" maxlength="150" required />
              <p v-if="errorFor('primary_account.email')" class="field-error">
                {{ errorFor('primary_account.email') }}
              </p>
            </div>

            <div class="field">
              <label for="a-phone">Phone</label>
              <input id="a-phone" v-model="form.primary_account.phone" type="tel" placeholder="09181234567" required />
              <p v-if="errorFor('primary_account.phone')" class="field-error">
                {{ errorFor('primary_account.phone') }}
              </p>
            </div>

            <div class="field">
              <label for="a-password">Password</label>
              <input id="a-password" v-model="form.primary_account.password" type="password" required />
              <p v-if="errorFor('primary_account.password')" class="field-error">
                {{ errorFor('primary_account.password') }}
              </p>
            </div>

            <div class="field">
              <label for="a-password-confirm">Confirm password</label>
              <input
                id="a-password-confirm"
                v-model="form.primary_account.password_confirmation"
                type="password"
                required
              />
            </div>
          </div>

          <p v-if="create.error" class="state-error">{{ create.error }}</p>

          <div class="modal-actions">
            <button type="button" class="ghost-btn" :disabled="create.submitting" @click="closeCreate">
              Cancel
            </button>

            <button type="submit" class="primary-btn" :disabled="create.submitting">
              {{ create.submitting ? 'Creating…' : 'Create facility' }}
            </button>
          </div>
        </form>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import { adminService } from '~/api/admin/AdminService'
import { useUser } from '~/composables/useUser'

definePageMeta({
  middleware: 'auth',
})

useHead({ title: 'Facility Management · RedAgos' })

const { user, fetchUser, logout } = useUser()

// --- Dark mode awareness (following blood center sidebar pattern) ---
const isDark = ref(false)
let themeObserver = null

onMounted(() => {
  isDark.value = document.documentElement.classList.contains('dark')
  themeObserver = new MutationObserver(() => {
    isDark.value = document.documentElement.classList.contains('dark')
  })
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
})

onUnmounted(() => {
  themeObserver?.disconnect()
})

const toggleDarkMode = () => {
  if (isDark.value) {
    document.documentElement.classList.remove('dark')
  } else {
    document.documentElement.classList.add('dark')
  }
  isDark.value = !isDark.value
}

// --- Color tokens for light/dark mode ---
const BG_PRIMARY = computed(() => (isDark.value ? '#0F172A' : '#f7f9fc'))
const BG_SECONDARY = computed(() => (isDark.value ? '#1E293B' : '#ffffff'))
const BG_TERTIARY = computed(() => (isDark.value ? '#334155' : '#f4f6f9'))

const TEXT_PRIMARY = computed(() => (isDark.value ? '#F1F5F9' : '#1e293b'))
const TEXT_SECONDARY = computed(() => (isDark.value ? '#CBD5E1' : '#64748b'))
const TEXT_MUTED = computed(() => (isDark.value ? '#94A3B8' : '#94a3b8'))

const BORDER_COLOR = computed(() => (isDark.value ? '#334155' : '#eef1f5'))
const BORDER_SUBTLE = computed(() => (isDark.value ? '#1E293B' : '#f4f6f9'))

const ACCENT_PRIMARY = computed(() => '#1565c0')
const ACCENT_SUCCESS = computed(() => '#2e7d32')
const ACCENT_DANGER = computed(() => '#d32f2f')
const ACCENT_WARNING = computed(() => '#b45309')

const TYPE_TABS = [
  { value: '', label: 'All Facilities' },
  { value: 'blood_center', label: 'Blood Centers' },
  { value: 'blood_bank', label: 'Hospital Blood Banks' },
]

const FACILITY_TYPES = [
  {
    value: 'blood_center',
    label: 'Blood Center',
    hint: 'Collects from donors, processes donations, and holds stock.',
  },
  {
    value: 'blood_bank',
    label: 'Hospital Blood Bank',
    hint: 'Requests blood from centers for its hospital.',
  },
]

const STATUS_LABELS = {
  pending_approval: 'Pending Approval',
  approved: 'Active',
  rejected: 'Rejected',
}

const loggingOut = ref(false)

const activeType = ref('')
const activeStatus = ref('')
const rows = ref([])
const page = ref(1)
const lastPage = ref(1)
const total = ref(null)

const loading = ref(true)
const loadError = ref('')
const busyId = ref(null)
const banner = ref('')
const bannerKind = ref('info')

const pendingCount = computed(
  () => rows.value.filter((row) => row.status === 'pending_approval').length
)

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

const create = reactive({
  open: false,
  submitting: false,
  error: '',
  errors: {},
})

function emptyForm() {
  return {
    facility_type: 'blood_center',
    name: '',
    doh_license_number: '',
    address: '',
    email: '',
    phone: '',
    description: '',
    operating_hours: '',
    slots_start_at: '',
    slots_end_at: '',
    slot_capacity: 4,
    slot_interval_minutes: 30,
    primary_account: {
      first_name: '',
      last_name: '',
      position: '',
      email: '',
      phone: '',
      password: '',
      password_confirmation: '',
    },
  }
}

const form = reactive(emptyForm())

const acceptsBookings = computed(() => form.facility_type === 'blood_center')

function labelFor(status) {
  return STATUS_LABELS[status] ?? status
}

function formatDate(value) {
  if (!value) return '—'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function actionsFor(status) {
  if (status === 'pending_approval') {
    return [
      { kind: 'approve', label: 'Approve', needsReason: false },
      { kind: 'reject', label: 'Reject', needsReason: true },
    ]
  }

  return []
}

const MODAL_COPY = {
  reject: {
    title: 'Reject legacy registration',
    lede: 'This clears a facility left over from the old self-registration flow. Its record is kept.',
    confirmLabel: 'Reject',
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

  throw new Error(`Unknown action: ${kind}`)
}

function openCreate() {
  Object.assign(form, emptyForm())
  Object.assign(create, { open: true, submitting: false, error: '', errors: {} })
}

function closeCreate() {
  if (create.submitting) return
  create.open = false
}

function errorFor(field) {
  const messages = create.errors?.[field]

  return Array.isArray(messages) ? messages[0] : messages || ''
}

function buildPayload() {
  const payload = {
    facility_type: form.facility_type,
    name: form.name.trim(),
    doh_license_number: form.doh_license_number.trim(),
    address: form.address.trim(),
    email: form.email.trim(),
    phone: form.phone.trim(),
    primary_account: {
      first_name: form.primary_account.first_name.trim(),
      last_name: form.primary_account.last_name.trim(),
      position: form.primary_account.position.trim(),
      email: form.primary_account.email.trim(),
      phone: form.primary_account.phone.trim(),
      password: form.primary_account.password,
      password_confirmation: form.primary_account.password_confirmation,
    },
  }

  if (form.description.trim()) {
    payload.description = form.description.trim()
  }

  if (!acceptsBookings.value) {
    return payload
  }

  if (form.operating_hours.trim()) payload.operating_hours = form.operating_hours.trim()
  if (form.slots_start_at) payload.slots_start_at = form.slots_start_at
  if (form.slots_end_at) payload.slots_end_at = form.slots_end_at
  if (form.slot_capacity) payload.slot_capacity = form.slot_capacity
  if (form.slot_interval_minutes) payload.slot_interval_minutes = form.slot_interval_minutes

  return payload
}

async function submitCreate() {
  create.submitting = true
  create.error = ''
  create.errors = {}

  try {
    const response = await adminService.create(buildPayload())

    create.open = false
    showBanner(response?.message || 'Facility created.', 'success')

    page.value = 1
    await load()
  } catch (error) {
    create.errors = error?.errors ?? {}
    create.error = messageFor(error)
  } finally {
    create.submitting = false
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

function changeType(type) {
  if (activeType.value === type) return

  activeType.value = type
  page.value = 1
  banner.value = ''
}

function goToPage(next) {
  page.value = next
}

let latestRequest = 0

async function load() {
  const requestId = ++latestRequest

  loading.value = true
  loadError.value = ''

  try {
    const data = await adminService.list({
      ...(activeType.value ? { facility_type: activeType.value } : {}),
      ...(activeStatus.value ? { status: activeStatus.value } : {}),
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

watch([activeType, activeStatus, page], (next, previous) => {
  if (next[1] !== previous[1] && page.value !== 1) {
    page.value = 1
    return
  }

  load()
})

onMounted(async () => {
  if (!user.value) {
    await fetchUser()
  }

  await load()
})
</script>

<style scoped>
.admin-page {
  min-height: 100vh;
  padding: 32px 24px 48px;
  transition: background-color 0.3s ease, color 0.3s ease;
}

.admin-page {
  background: v-bind('BG_PRIMARY');
  color: v-bind('TEXT_PRIMARY');
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
  color: v-bind('TEXT_PRIMARY');
}

.subtitle {
  margin: 6px 0 0;
  font-size: 14px;
  color: v-bind('TEXT_SECONDARY');
}

.tabs {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  max-width: 1180px;
  margin: 0 auto 16px;
}

.tab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border: 1px solid v-bind('BORDER_COLOR');
  border-radius: 999px;
  background: v-bind('BG_SECONDARY');
  color: v-bind('TEXT_SECONDARY');
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tab:hover {
  border-color: v-bind('ACCENT_PRIMARY');
}

.tab.active {
  background: v-bind('ACCENT_PRIMARY');
  border-color: v-bind('ACCENT_PRIMARY');
  color: #ffffff;
}

.tab-count {
  padding: 1px 7px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.24);
  font-size: 11px;
}

.status-filter {
  margin-left: auto;
  padding: 8px 12px;
  border: 1px solid v-bind('BORDER_COLOR');
  border-radius: 8px;
  background: v-bind('BG_SECONDARY');
  color: v-bind('TEXT_SECONDARY');
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.2s ease;
}

.status-filter:focus {
  outline: none;
  border-color: v-bind('ACCENT_PRIMARY');
}

.header-actions {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.signed-in-as {
  font-size: 13px;
  color: v-bind('TEXT_SECONDARY');
  white-space: nowrap;
}

.theme-toggle-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 14px;
  border: 1px solid v-bind('BORDER_COLOR');
  border-radius: 8px;
  background: v-bind('BG_SECONDARY');
  color: v-bind('TEXT_SECONDARY');
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.theme-toggle-btn:hover {
  border-color: v-bind('ACCENT_PRIMARY');
  color: v-bind('ACCENT_PRIMARY');
}

.banner {
  max-width: 1180px;
  margin: 0 auto 16px;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.banner-success { 
  background: #F1F7F1; 
  color: #2E7D32; 
}

.banner-error { 
  background: #FDF1F1; 
  color: #C62828; 
}

.banner-info { 
  background: #EFF4FB; 
  color: #1565C0; 
}

.admin-page.dark .banner-success {
  background: #1B3B1B;
}

.admin-page.dark .banner-error {
  background: #3B1B1B;
}

.admin-page.dark .banner-info {
  background: #1B2E3B;
}

.table-wrap {
  max-width: 1180px;
  margin: 0 auto;
  background: v-bind('BG_SECONDARY');
  border: 1px solid v-bind('BORDER_COLOR');
  border-radius: 12px;
  overflow-x: auto;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.facilities {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.facilities th {
  padding: 12px 16px;
  text-align: left;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: v-bind('TEXT_SECONDARY');
  border-bottom: 1px solid v-bind('BORDER_SUBTLE');
  white-space: nowrap;
  background: v-bind('BG_TERTIARY');
}

.facilities td {
  padding: 14px 16px;
  border-bottom: 1px solid v-bind('BORDER_SUBTLE');
  vertical-align: top;
  color: v-bind('TEXT_PRIMARY');
}

.facilities tbody tr:last-child td {
  border-bottom: none;
}

.facilities tbody tr:hover {
  background: v-bind('BG_TERTIARY');
  transition: background-color 0.15s ease;
}

.facility-name {
  display: block;
  font-weight: 600;
  color: v-bind('TEXT_PRIMARY');
}

.muted {
  display: block;
  color: v-bind('TEXT_MUTED');
  font-size: 12px;
  margin-top: 2px;
}

.unverified {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  font-weight: 600;
  color: v-bind('ACCENT_WARNING');
}

.reason {
  max-width: 220px;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px;
  white-space: nowrap;
  color: v-bind('TEXT_PRIMARY');
}

.pill,
.type-pill {
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

.admin-page.dark .pill-pending_approval { background: #3B2415; color: #FCA060; }
.admin-page.dark .pill-approved { background: #154E31; color: #6EE7B7; }
.admin-page.dark .pill-rejected { background: #3B1515; color: #FCA5A5; }

.type-blood_center { background: #eff6ff; color: #1d4ed8; }
.type-blood_bank { background: #f5f3ff; color: #6d28d9; }

.admin-page.dark .type-blood_center { background: #1B2E42; color: #60A5FA; }
.admin-page.dark .type-blood_bank { background: #2E1F42; color: #A78BFA; }

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
  transition: all 0.2s ease;
}

.action-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.action-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.action-btn.approve { background: #2e7d32; }
.action-btn.approve:hover:not(:disabled) { background: #1b5e20; }

.action-btn.reject { background: #d32f2f; }
.action-btn.reject:hover:not(:disabled) { background: #b71c1c; }

.primary-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  background: v-bind('ACCENT_PRIMARY');
  color: #ffffff;
  font-family: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.primary-btn:hover:not(:disabled) {
  background: #12539f;
  transform: translateY(-1px);
}

.primary-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.ghost-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: 1px solid v-bind('BORDER_COLOR');
  border-radius: 8px;
  background: v-bind('BG_SECONDARY');
  color: v-bind('TEXT_SECONDARY');
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.ghost-btn:hover:not(:disabled) {
  border-color: v-bind('ACCENT_PRIMARY');
  color: v-bind('ACCENT_PRIMARY');
}

.ghost-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.state {
  padding: 32px 16px;
  text-align: center;
  color: v-bind('TEXT_MUTED');
}

.state-error {
  color: v-bind('ACCENT_DANGER');
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
  color: v-bind('TEXT_SECONDARY');
}

.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: v-bind('isDark ? "rgba(15,23,42,0.65)" : "rgba(15,23,42,0.45)"');
  transition: background 0.2s ease;
}

.modal {
  width: 100%;
  max-width: 460px;
  background: v-bind('BG_SECONDARY');
  border-radius: 14px;
  padding: 24px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
  transition: background-color 0.2s ease;
}

.admin-page.dark .modal {
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
}

.modal-wide {
  max-width: 720px;
  max-height: 88vh;
  overflow-y: auto;
}

.modal h2 {
  margin: 0 0 6px;
  font-size: 18px;
  font-weight: 700;
  color: v-bind('TEXT_PRIMARY');
}

.section-heading {
  margin: 22px 0 10px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: v-bind('TEXT_SECONDARY');
}

.modal-lede {
  margin: 0 0 18px;
  font-size: 13px;
  color: v-bind('TEXT_SECONDARY');
  line-height: 1.5;
}

.modal label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: v-bind('TEXT_PRIMARY');
  margin-bottom: 6px;
}

.modal input,
.modal select,
.modal textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid v-bind('BORDER_COLOR');
  border-radius: 8px;
  font-family: inherit;
  font-size: 14px;
  color: v-bind('TEXT_PRIMARY');
  background: v-bind('BG_SECONDARY');
  resize: vertical;
  transition: all 0.2s ease;
}

.modal input:focus,
.modal select:focus,
.modal textarea:focus {
  outline: none;
  border-color: v-bind('ACCENT_PRIMARY');
  box-shadow: 0 0 0 3px rgba(21, 101, 192, 0.1);
}

.type-choice {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin: 0;
  padding: 0;
  border: none;
}

.type-choice legend {
  padding: 0;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  color: v-bind('TEXT_PRIMARY');
}

.type-option {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 0;
  padding: 12px 14px;
  border: 2px solid v-bind('BORDER_COLOR');
  border-radius: 10px;
  cursor: pointer;
  background: var-bind('BG_SECONDARY');
  transition: all 0.2s ease;
}

.type-option:hover {
  border-color: v-bind('ACCENT_PRIMARY');
}

.type-option.selected {
  border-color: v-bind('ACCENT_PRIMARY');
  background: v-bind('isDark ? "#1E3A4F" : "#f4f8fd"');
}

.type-option input {
  width: auto;
  margin-top: 3px;
}

.type-option strong {
  display: block;
  font-size: 14px;
  color: v-bind('TEXT_PRIMARY');
}

.type-option small {
  display: block;
  margin-top: 2px;
  font-size: 12px;
  font-weight: 500;
  color: v-bind('TEXT_SECONDARY');
  line-height: 1.4;
}

.field-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.field-wide {
  grid-column: 1 / -1;
}

.field-error {
  margin: 6px 0 0;
  font-size: 12px;
  font-weight: 600;
  color: v-bind('ACCENT_DANGER');
}

.counter {
  display: block;
  text-align: right;
  font-size: 11px;
  color: v-bind('TEXT_MUTED');
  margin-top: 4px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 18px;
}

@media (max-width: 640px) {
  .admin-page {
    padding: 24px 16px 32px;
  }

  .type-choice,
  .field-grid {
    grid-template-columns: 1fr;
  }

  .modal {
    max-width: 100%;
  }

  .header-actions {
    width: 100%;
  }
}
</style>