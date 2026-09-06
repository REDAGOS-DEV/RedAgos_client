<template>
  <div class="admin-page">
    <header class="page-header">
      <div>
        <h1>Facility Management</h1>
        <p class="subtitle">
          Create and review blood center and hospital blood bank accounts.
        </p>
      </div>

      <div class="header-actions">
        <span v-if="user" class="signed-in-as">{{ user.full_name || user.email }}</span>

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
import { computed, onMounted, reactive, ref, watch } from 'vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import { adminService } from '~/api/admin/AdminService'
import { useUser } from '~/composables/useUser'

definePageMeta({
  middleware: 'auth',
})

useHead({ title: 'Facility Management · RedAgos' })

const { user, fetchUser, logout } = useUser()

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

// Tulo ka status ra ang naa sa server nga FacilityStatus. Ang `pending_approval`
// ug `rejected` kay para ra sa mga legacy nga record — ang bag-o nga facility
// kay `approved` gyud dayon.
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

/**
 * Ang mga aksyon kay gisunod gyud sa state rules sa server, mao nga wala gyud
 * ta mo-presenta og button nga mo-409 ra puhon.
 *
 * Ang Approve ug Reject na lang ang nahibilin, ug para ra sila sa mga legacy
 * nga entry — ang bag-o nga facility kay `approved` na dayon pag-himo.
 */
function actionsFor(status) {
  if (status === 'pending_approval') {
    return [
      { kind: 'approve', label: 'Approve', needsReason: false },
      { kind: 'reject', label: 'Reject', needsReason: true },
    ]
  }

  // Walay aksyon sa usa ka active nga facility. Ang suspend ug reinstate kay
  // gitangtang na — walay endpoint sa server nga mo-usab sa status sa usa ka
  // facility nga nahuman na og onboarding.
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

  throw new Error(`Unknown action: ${kind}`)
}

// --- Create facility --------------------------------------------------------

function openCreate() {
  Object.assign(form, emptyForm())
  Object.assign(create, { open: true, submitting: false, error: '', errors: {} })
}

function closeCreate() {
  if (create.submitting) return
  create.open = false
}

/**
 * Ang server nagpadala og nested nga key para sa primary account, pananglitan
 * `primary_account.email`. Gikuha nato ang una nga mensahe kada field aron
 * mabutang sa tapad sa mismong input.
 */
function errorFor(field) {
  const messages = create.errors?.[field]

  return Array.isArray(messages) ? messages[0] : messages || ''
}

/**
 * Ang mga blangko nga optional field kay wala gyud ipadala.
 *
 * Ang `slots_start_at` kay `nullable|date_format:H:i` sa server, ug ang empty
 * string dili mo-agi niana — mao nga ang wala napuno nga porma mo-422 unta bisan
 * walay sayop ang admin.
 */
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

    // Balik sa unang page aron makita dayon ang bag-o nga facility, nga
    // gi-order sa server pinaagi sa created_at descending.
    page.value = 1
    await load()
  } catch (error) {
    create.errors = error?.errors ?? {}
    create.error = messageFor(error)
  } finally {
    create.submitting = false
  }
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

/**
 * Ang `logout()` mao nay mo-revoke sa token sa server, mo-clear sa localStorage,
 * ug mo-redirect — walay laing lakang nga kinahanglan dinhi.
 */
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

// Ang Supabase kay mahinay usahay (4-17s). Kung mag-ilis-ilis og filter ang
// user, posible nga ang daan nga response mo-abot HUMAN sa bag-o — so mo-render
// ta og sayop nga data. Kini nga counter mao ang mo-piho nga ang katapusang
// request ra ang makasulat sa state.
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
    // Ang stale nga request dili mo-clear sa loading flag, kay naa pay bag-o
    // nga nagdagan.
    if (requestId === latestRequest) {
      loading.value = false
    }
  }
}

watch([activeType, activeStatus, page], (next, previous) => {
  // Ang pag-ilis sa status filter kay mobalik sa unang page; kon dili, posible
  // nga mag-landing ta sa page 4 sa lista nga tulo ra ka page.
  if (next[1] !== previous[1] && page.value !== 1) {
    page.value = 1
    return
  }

  load()
})

onMounted(async () => {
  // Ang role check kay sa `portal` global middleware na, nga modagan sa dili pa
  // mo-render ang page — walay dili-admin nga makakita niini nga shell.
  //
  // Ang `role:admin` sa server gihapon ang tinuod nga gate.
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

.status-filter {
  margin-left: auto;
  padding: 8px 12px;
  border: 1px solid #e5eaf0;
  border-radius: 8px;
  background: #ffffff;
  color: #475569;
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
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
  color: #64748b;
  white-space: nowrap;
}

.banner {
  max-width: 1180px;
  margin: 0 auto 16px;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
}

.banner-success { background: #F1F7F1; color: #2E7D32; }
.banner-error { background: #FDF1F1; color: #C62828; }
.banner-info { background: #EFF4FB; color: #1565C0; }

.table-wrap {
  max-width: 1180px;
  margin: 0 auto;
  background: #ffffff;
  border: 1px solid #eef1f5;
  border-radius: 12px;
  overflow-x: auto;
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
  color: #64748b;
  border-bottom: 1px solid #eef1f5;
  white-space: nowrap;
}

.facilities td {
  padding: 14px 16px;
  border-bottom: 1px solid #f4f6f9;
  vertical-align: top;
}

.facilities tbody tr:last-child td {
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

.unverified {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  font-weight: 600;
  color: #b45309;
}

.reason {
  max-width: 220px;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px;
  white-space: nowrap;
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

.type-blood_center { background: #eff6ff; color: #1d4ed8; }
.type-blood_bank { background: #f5f3ff; color: #6d28d9; }

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

.primary-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  background: #1565c0;
  color: #ffffff;
  font-family: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.primary-btn:hover:not(:disabled) {
  background: #12539f;
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

.modal-wide {
  max-width: 720px;
  max-height: 88vh;
  overflow-y: auto;
}

.modal h2 {
  margin: 0 0 6px;
  font-size: 18px;
  font-weight: 700;
}

.section-heading {
  margin: 22px 0 10px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #64748b;
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

.modal input,
.modal select,
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

.modal input:focus,
.modal select:focus,
.modal textarea:focus {
  outline: none;
  border-color: #1565c0;
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
  color: #475569;
}

.type-option {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 0;
  padding: 12px 14px;
  border: 2px solid #e5eaf0;
  border-radius: 10px;
  cursor: pointer;
}

.type-option.selected {
  border-color: #1565c0;
  background: #f4f8fd;
}

.type-option input {
  width: auto;
  margin-top: 3px;
}

.type-option strong {
  display: block;
  font-size: 14px;
  color: #1e293b;
}

.type-option small {
  display: block;
  margin-top: 2px;
  font-size: 12px;
  font-weight: 500;
  color: #64748b;
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
  color: #b91c1c;
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

@media (max-width: 640px) {
  .type-choice,
  .field-grid {
    grid-template-columns: 1fr;
  }
}
</style>
