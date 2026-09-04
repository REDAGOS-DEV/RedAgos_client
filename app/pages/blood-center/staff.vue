<template>
  <div class="staff">
    <header class="staff__header">
      <div>
        <p class="staff__eyebrow">Administration</p>
        <h1 class="staff__title">Staff Accounts</h1>
        <p class="staff__subtitle">
          Add colleagues, assign them to a department, and manage the management level.
          A department decides what a staff member can do.
        </p>
      </div>

      <button type="button" class="btn-primary" @click="openCreate">
        <AssetIcon name="plus" :size="16" />
        Add Staff
      </button>
    </header>

    <div v-if="banner" class="banner" :class="`banner--${bannerKind}`">
      {{ banner }}
    </div>

    <div class="staff__filters">
      <div class="field">
        <AssetIcon name="search" :size="15" />
        <input v-model="search" type="text" placeholder="Search name, email, or employee ID" @keydown.enter="load" >
      </div>

      <select v-model="departmentFilter" class="select" @change="load">
        <option value="">All departments</option>
        <option v-for="option in DEPARTMENTS" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>

      <label class="toggle">
        <input v-model="includeDeleted" type="checkbox" @change="load" >
        Show removed
      </label>
    </div>

    <div v-if="loading" class="empty">Loading roster…</div>

    <div v-else-if="!rows.length" class="empty">No staff accounts match this view.</div>

    <div v-else class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Department</th>
            <th>Level</th>
            <th>Status</th>
            <th>Employee ID</th>
            <th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.uuid" :class="{ 'row--removed': row.deleted_at }">
            <td>
              <p class="cell-strong">{{ row.full_name }}</p>
              <p class="cell-sub">{{ row.email }}</p>
            </td>
            <td>{{ row.department_label || '—' }}</td>
            <td>
              <span v-if="row.is_supervisor" class="pill pill--supervisor">Supervisor</span>
              <span v-else class="pill">Staff</span>
            </td>
            <td>
              <span class="pill" :class="statusClass(row)">{{ statusLabel(row) }}</span>
            </td>
            <td>{{ row.employee_id || '—' }}</td>
            <td class="actions">
              <button v-if="!row.deleted_at" type="button" class="ghost-btn" @click="openEdit(row)">
                Edit
              </button>
              <button v-if="!row.deleted_at" type="button" class="ghost-btn ghost-btn--danger" @click="remove(row)">
                Remove
              </button>
              <button v-else type="button" class="ghost-btn" @click="restore(row)">
                Restore
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create / edit -->
    <div v-if="modalOpen" class="modal-backdrop" @click.self="modalOpen = false">
      <div class="modal">
        <h2 class="modal__title">{{ editing ? 'Edit staff account' : 'Add staff' }}</h2>

        <form class="form" @submit.prevent="submit">
          <template v-if="!editing">
            <div class="form__row">
              <label class="form__field">
                <span>First name</span>
                <input v-model="form.first_name" type="text" required >
                <em v-if="errors.first_name">{{ errors.first_name[0] }}</em>
              </label>
              <label class="form__field">
                <span>Last name</span>
                <input v-model="form.last_name" type="text" required >
                <em v-if="errors.last_name">{{ errors.last_name[0] }}</em>
              </label>
            </div>

            <label class="form__field">
              <span>Email</span>
              <input v-model="form.email" type="email" required >
              <em v-if="errors.email">{{ errors.email[0] }}</em>
            </label>

            <label class="form__field">
              <span>Temporary password</span>
              <input v-model="form.password" type="password" required >
              <small>At least 8 characters, with upper and lower case and a number. They will be asked to verify their email address.</small>
              <em v-if="errors.password">{{ errors.password[0] }}</em>
            </label>

            <label class="form__field">
              <span>Confirm password</span>
              <input v-model="form.password_confirmation" type="password" required >
            </label>
          </template>

          <div class="form__row">
            <label class="form__field">
              <span>Phone</span>
              <input v-model="form.phone" type="tel" placeholder="09XXXXXXXXX" >
              <em v-if="errors.phone">{{ errors.phone[0] }}</em>
            </label>
            <label class="form__field">
              <span>Employee ID</span>
              <input v-model="form.employee_id" type="text" >
              <em v-if="errors.employee_id">{{ errors.employee_id[0] }}</em>
            </label>
          </div>

          <label class="form__field">
            <span>Position</span>
            <input v-model="form.position" type="text" placeholder="e.g. Medical Technologist" >
          </label>

          <label class="form__field">
            <span>Department</span>
            <select v-model="form.department">
              <option value="">No department</option>
              <option v-for="option in DEPARTMENTS" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
            <small>
              A supervisor holds every permission whether or not they sit in a department.
              Anyone else needs one, or they can sign in but reach nothing.
            </small>
            <em v-if="errors.department">{{ errors.department[0] }}</em>
          </label>

          <label class="toggle toggle--block">
            <input v-model="form.is_supervisor" type="checkbox" >
            Supervisor — can manage staff and see the overall Blood Center view
          </label>

          <label v-if="editing" class="form__field">
            <span>Account status</span>
            <select v-model="form.account_status">
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="deactivated">Deactivated</option>
            </select>
            <small>Suspending or deactivating an account signs it out immediately.</small>
          </label>

          <p v-if="formError" class="form__error">{{ formError }}</p>

          <div class="modal__actions">
            <button type="button" class="ghost-btn" @click="modalOpen = false">Cancel</button>
            <button type="submit" class="btn-primary" :disabled="saving">
              {{ saving ? 'Saving…' : (editing ? 'Save changes' : 'Add staff') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  requires: 'staff.manage',
})

useHead({ title: 'Staff Accounts · RedAgos' })

const DEPARTMENTS = [
  { value: 'collection', label: 'Donor / Collection' },
  { value: 'laboratory', label: 'Laboratory / Processing' },
  { value: 'inventory', label: 'Inventory / Storage & Requests' },
  { value: 'billing', label: 'Billing / Payment' },
]

const rows = ref([])
const loading = ref(true)
const search = ref('')
const departmentFilter = ref('')
const includeDeleted = ref(false)

const modalOpen = ref(false)
const editing = ref(null)
const saving = ref(false)
const errors = ref({})
const formError = ref('')
const banner = ref('')
const bannerKind = ref('success')

const form = reactive({
  first_name: '', last_name: '', email: '', password: '', password_confirmation: '',
  phone: '', employee_id: '', position: '', department: '', is_supervisor: false,
  account_status: 'active',
})

function resetForm() {
  Object.assign(form, {
    first_name: '', last_name: '', email: '', password: '', password_confirmation: '',
    phone: '', employee_id: '', position: '', department: '', is_supervisor: false,
    account_status: 'active',
  })
  errors.value = {}
  formError.value = ''
}

async function load() {
  loading.value = true

  try {
    const params = { per_page: 100 }
    if (search.value.trim()) params.search = search.value.trim()
    if (departmentFilter.value) params.department = departmentFilter.value
    if (includeDeleted.value) params.include_deleted = true

    const response = await bloodCenterService.staff(params)
    rows.value = response?.data ?? []
  } catch (error) {
    showBanner(error?.message || 'Could not load the roster.', 'error')
  } finally {
    loading.value = false
  }
}

function openCreate() {
  resetForm()
  editing.value = null
  modalOpen.value = true
}

function openEdit(row) {
  resetForm()
  editing.value = row
  Object.assign(form, {
    phone: row.phone || '',
    employee_id: row.employee_id || '',
    position: row.position || '',
    department: row.department || '',
    is_supervisor: row.is_supervisor,
    account_status: row.account_status === 'pending_verification' ? 'active' : row.account_status,
  })
  modalOpen.value = true
}

async function submit() {
  saving.value = true
  errors.value = {}
  formError.value = ''

  try {
    if (editing.value) {
      const payload = {
        phone: form.phone || null,
        employee_id: form.employee_id || null,
        position: form.position || null,
        department: form.department || null,
        is_supervisor: form.is_supervisor,
      }

      // Ang pending_verification kay dili ma-set balik sa supervisor, so
      // ipadala ra kung nausab gyud.
      if (form.account_status !== editing.value.account_status) {
        payload.account_status = form.account_status
      }

      await bloodCenterService.updateStaff(editing.value.uuid, payload)
      showBanner('Account updated.', 'success')
    } else {
      await bloodCenterService.createStaff({
        ...form,
        phone: form.phone || null,
        employee_id: form.employee_id || null,
        position: form.position || null,
        department: form.department || null,
      })
      showBanner('Staff account created. A verification email has been sent.', 'success')
    }

    modalOpen.value = false
    await load()
  } catch (error) {
    if (error?.status === 422) {
      errors.value = error.errors || {}
      formError.value = error.message || 'Please correct the highlighted fields.'
    } else if (error?.status === 409) {
      // last_supervisor — ang facility mahibilin nga walay makadumala.
      formError.value = error.message
    } else {
      formError.value = error?.message || 'Something went wrong.'
    }
  } finally {
    saving.value = false
  }
}

async function remove(row) {
  if (!confirm(`Remove ${row.full_name}? They will be signed out immediately.`)) return

  try {
    await bloodCenterService.deleteStaff(row.uuid)
    showBanner('Account removed.', 'success')
    await load()
  } catch (error) {
    showBanner(error?.message || 'Could not remove that account.', 'error')
  }
}

async function restore(row) {
  try {
    await bloodCenterService.restoreStaff(row.uuid)
    showBanner('Account restored.', 'success')
    await load()
  } catch (error) {
    showBanner(error?.message || 'Could not restore that account.', 'error')
  }
}

function showBanner(message, kind) {
  banner.value = message
  bannerKind.value = kind
  setTimeout(() => { banner.value = '' }, 6000)
}

function statusLabel(row) {
  if (row.deleted_at) return 'Removed'
  if (!row.email_verified) return 'Unverified'

  return { active: 'Active', suspended: 'Suspended', deactivated: 'Deactivated' }[row.account_status] || row.account_status
}

function statusClass(row) {
  if (row.deleted_at || row.account_status === 'deactivated') return 'pill--muted'
  if (row.account_status === 'suspended') return 'pill--danger'
  if (!row.email_verified) return 'pill--warning'

  return 'pill--success'
}

onMounted(load)
</script>

<style scoped>
.staff {
  font-family: var(--rb-font-sans);
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px 32px 40px;
  background: var(--rb-page-bg);
}

.staff__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.staff__eyebrow {
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--rb-text-secondary);
}

.staff__title {
  margin: 4px 0 0;
  font-size: 24px;
  font-weight: 800;
  color: var(--rb-text-primary);
}

.staff__subtitle {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--rb-text-secondary);
  max-width: 68ch;
}

.staff__filters {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
  margin-bottom: 16px;
}

.field {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex: 1 1 260px;
  padding: 9px 12px;
  border-radius: 10px;
  border: 1px solid var(--rb-border);
  background: var(--rb-surface);
  color: var(--rb-text-secondary);
}

.field input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: none;
  background: transparent;
  font-size: 13px;
  color: var(--rb-text-primary);
}

.select,
.form__field select,
.form__field input {
  padding: 9px 12px;
  border-radius: 10px;
  border: 1px solid var(--rb-border);
  background: var(--rb-surface);
  font-size: 13px;
  color: var(--rb-text-primary);
}

.toggle {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  color: var(--rb-text-secondary);
}

.toggle--block {
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--rb-border);
  background: var(--rb-surface-alt);
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 9px 16px;
  border: 0;
  border-radius: 10px;
  background: var(--rb-primary);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

.ghost-btn {
  padding: 6px 11px;
  border-radius: 8px;
  border: 1px solid var(--rb-border);
  background: var(--rb-surface);
  font-size: 12px;
  font-weight: 600;
  color: var(--rb-text-secondary);
  cursor: pointer;
}

.ghost-btn--danger { color: var(--rb-accent); }

.table-wrap {
  overflow-x: auto;
  border: 1px solid var(--rb-border);
  border-radius: 14px;
  background: var(--rb-surface);
}

.table { width: 100%; border-collapse: collapse; font-size: 13px; }

.table th {
  text-align: left;
  padding: 12px 14px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--rb-text-secondary);
  border-bottom: 1px solid var(--rb-border);
  white-space: nowrap;
}

.table td {
  padding: 12px 14px;
  border-bottom: 1px solid var(--rb-border);
  color: var(--rb-text-primary);
  vertical-align: top;
}

.row--removed { opacity: 0.55; }

.cell-strong { margin: 0; font-weight: 600; }
.cell-sub { margin: 2px 0 0; font-size: 12px; color: var(--rb-text-secondary); }

.actions { display: flex; gap: 6px; white-space: nowrap; }

.pill {
  display: inline-block;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  background: var(--rb-surface-hover);
  color: var(--rb-text-secondary);
}

.pill--supervisor { background: rgba(var(--rb-primary-rgb), 0.1); color: var(--rb-primary); }
.pill--success { background: rgba(var(--rb-success-rgb), 0.12); color: var(--rb-success); }
.pill--warning { background: rgba(var(--rb-warning-rgb), 0.12); color: var(--rb-warning); }
.pill--danger { background: rgba(var(--rb-accent-rgb), 0.12); color: var(--rb-accent); }
.pill--muted { background: var(--rb-surface-hover); color: var(--rb-text-secondary); }

.empty {
  padding: 40px;
  text-align: center;
  font-size: 13px;
  color: var(--rb-text-secondary);
  border: 1px dashed var(--rb-border-strong);
  border-radius: 14px;
}

.banner {
  margin-bottom: 14px;
  padding: 11px 14px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
}

.banner--success { background: rgba(var(--rb-success-rgb), 0.08); color: var(--rb-success); }
.banner--error { background: rgba(var(--rb-accent-rgb), 0.08); color: var(--rb-accent); }

.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: var(--rb-overlay);
  overflow-y: auto;
}

.modal {
  width: 100%;
  max-width: 560px;
  border-radius: 14px;
  background: var(--rb-surface);
  padding: 22px 24px 24px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal__title {
  margin: 0 0 16px;
  font-size: 18px;
  font-weight: 700;
  color: var(--rb-text-primary);
}

.form { display: flex; flex-direction: column; gap: 12px; }

.form__row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.form__field { display: flex; flex-direction: column; gap: 5px; }

.form__field > span {
  font-size: 12px;
  font-weight: 600;
  color: var(--rb-text-secondary);
}

.form__field small { font-size: 11px; color: var(--rb-text-secondary); }
.form__field em { font-size: 11px; font-style: normal; color: var(--rb-accent); }

.form__error {
  margin: 0;
  font-size: 12px;
  color: var(--rb-accent);
}

.modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 6px;
}

@media (max-width: 640px) {
  .staff { padding: 20px 16px 32px; }
}

.btn-primary:focus-visible,
.ghost-btn:focus-visible {
  outline: 2px solid var(--rb-primary, #1565C0);
  outline-offset: 2px;
}
</style>
