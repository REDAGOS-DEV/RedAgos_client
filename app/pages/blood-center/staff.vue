<template>
  <div class="staff">
    <header class="staff__header">
      <div>
        <h1 class="staff__title">Staff Accounts</h1>
        <p class="staff__subtitle">
          Add colleagues, place them in a department and set what they can do.
        </p>
      </div>

      <button type="button" class="btn-primary" @click="openCreate">
        <AssetIcon name="plus" :size="16" />
        Add Staff
      </button>
    </header>

    <div v-if="banner" class="banner" :class="`banner--${bannerKind}`" role="status">
      <AssetIcon :name="bannerKind === 'error' ? 'circle-alert' : 'circle-check-big'" :size="16" />
      <span>{{ banner }}</span>
    </div>

    <!-- At-a-glance counts for the current view -->
    <div v-if="!loading && rows.length" class="summary">
      <span class="summary__item"><strong>{{ activeRows.length }}</strong> staff</span>
      <span class="summary__item"><strong>{{ supervisorCount }}</strong> supervisor{{ supervisorCount === 1 ? '' : 's' }}</span>
      <span v-if="unverifiedCount" class="summary__item summary__item--warning">
        <strong>{{ unverifiedCount }}</strong> waiting to verify email
      </span>
    </div>

    <div class="staff__filters">
      <div class="field">
        <AssetIcon name="search" :size="15" />
        <input
          v-model="search"
          type="text"
          placeholder="Search name, email, or employee ID"
          aria-label="Search staff"
          @keydown.enter="load"
        >
        <button v-if="search" type="button" class="field__clear" aria-label="Clear search" @click="search = ''; load()">
          <AssetIcon name="x" :size="14" />
        </button>
      </div>

      <select v-model="departmentFilter" class="select" aria-label="Filter by department" @change="load">
        <option value="">All departments</option>
        <option v-for="group in departments" :key="group.department" :value="group.department">
          {{ group.label }}
        </option>
      </select>

      <label class="toggle">
        <input v-model="includeDeleted" type="checkbox" @change="load" >
        Show removed
      </label>
    </div>

    <!-- Loading: rows shaped like the table -->
    <div v-if="loading" class="table-wrap" aria-busy="true">
      <div v-for="n in 4" :key="n" class="skeleton-row">
        <span class="skeleton skeleton--avatar" />
        <span class="skeleton skeleton--line" />
        <span class="skeleton skeleton--line skeleton--short" />
      </div>
    </div>

    <!-- Nobody yet: the supervisor's first step -->
    <div v-else-if="!rows.length && !hasFilters" class="empty empty--onboarding">
      <span class="empty__icon"><AssetIcon name="users" :size="22" /></span>
      <p class="empty__title">Add your first team member</p>
      <p class="empty__text">
        Give each colleague a department and role, and they can sign in to the pages their work needs.
      </p>
      <button type="button" class="btn-primary" @click="openCreate">
        <AssetIcon name="plus" :size="16" />
        Add Staff
      </button>
    </div>

    <div v-else-if="!rows.length" class="empty">
      <span class="empty__icon"><AssetIcon name="users" :size="22" /></span>
      <p class="empty__title">No staff match this view</p>
      <button type="button" class="ghost-btn" @click="clearFilters">Clear filters</button>
    </div>

    <div v-else class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Role</th>
            <th>
              Privileges
              <span class="th-hint" title="R = Read, W = Write, U = Update, D = Delete">(R W U D)</span>
            </th>
            <th>Status</th>
            <th>Employee ID</th>
            <th aria-label="Actions" />
          </tr>
        </thead>

        <!-- One block per department, in the same order as the sidebar -->
        <tbody v-for="group in groupedRows" :key="group.key">
          <tr class="group-row">
            <th colspan="6" scope="colgroup">
              {{ group.label }}
              <span class="group-row__count">{{ group.rows.length }}</span>
            </th>
          </tr>
          <tr v-for="row in group.rows" :key="row.uuid" :class="{ 'row--removed': row.deleted_at }">
            <td>
              <div class="person">
                <span class="person__avatar" aria-hidden="true">{{ initials(row.full_name) }}</span>
                <div class="person__text">
                  <p class="cell-strong">
                    {{ row.full_name }}
                    <span v-if="row.is_supervisor" class="pill pill--supervisor">Supervisor</span>
                  </p>
                  <p class="cell-sub">{{ row.email }}</p>
                </div>
              </div>
            </td>
            <td>
              <p class="cell-strong">
                {{ row.role_label || (row.is_supervisor ? 'Management' : 'No role yet') }}
                <span v-if="row.custom_role" class="tag">custom</span>
              </p>
              <p v-if="row.position" class="cell-sub">{{ row.position }}</p>
            </td>
            <td>
              <span v-if="row.is_supervisor" class="cell-sub">All</span>
              <span v-else class="privs">
                <span
                  v-for="p in PRIVILEGE_ORDER"
                  :key="p"
                  class="priv"
                  :class="{ 'priv--on': row.staff_privileges?.includes(p) }"
                  :title="`${p[0].toUpperCase()}${p.slice(1)}: ${row.staff_privileges?.includes(p) ? 'allowed' : 'not allowed'}`"
                >
                  {{ p[0].toUpperCase() }}
                </span>
              </span>
            </td>
            <td>
              <span class="pill" :class="statusClass(row)">{{ statusLabel(row) }}</span>
            </td>
            <td class="cell-mono">{{ row.employee_id || '-' }}</td>
            <td>
              <!-- flex on an inner div: a flex <td> stops being a table cell and
                   its bottom border falls short of the row's. -->
              <div class="actions">
                <button v-if="!row.deleted_at" type="button" class="ghost-btn" @click="openEdit(row)">
                  <AssetIcon name="pencil" :size="13" />
                  Edit
                </button>
                <button v-if="!row.deleted_at" type="button" class="ghost-btn ghost-btn--danger" @click="remove(row)">
                  Remove
                </button>
                <button v-else type="button" class="ghost-btn" @click="restore(row)">
                  Restore
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create / edit -->
    <Transition name="modal-fade">
      <div v-if="modalOpen" class="modal-backdrop" @click.self="modalOpen = false">
        <div
          v-focus-trap
          class="modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="staff-modal-title"
          @dialog-escape="modalOpen = false"
        >
          <div class="modal__head">
            <div>
              <h2 id="staff-modal-title" class="modal__title">{{ editing ? 'Edit staff account' : 'Add staff' }}</h2>
              <p v-if="editing" class="modal__sub">{{ editing.full_name }} · {{ editing.email }}</p>
            </div>
            <button type="button" class="icon-btn" aria-label="Close" @click="modalOpen = false">
              <AssetIcon name="x" :size="16" />
            </button>
          </div>

          <form class="form" @submit.prevent="submit">
            <template v-if="!editing">
              <section class="form__section">
                <h3 class="form__section-title">Personal details</h3>
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
              </section>

              <section class="form__section">
                <h3 class="form__section-title">Sign-in</h3>
                <div class="form__row">
                  <label class="form__field">
                    <span>Temporary password</span>
                    <input v-model="form.password" type="text" autocomplete="new-password" required >
                    <em v-if="errors.password">{{ errors.password[0] }}</em>
                  </label>
                  <label class="form__field">
                    <span>Confirm password</span>
                    <input v-model="form.password_confirmation" type="text" autocomplete="new-password" required >
                  </label>
                </div>
                <p class="form__hint">
                  At least 8 characters, with upper and lower case and a number. Share it with them directly; they will be
                  asked to verify their email address.
                  <button type="button" class="link-btn" @click="generatePassword">Generate a password</button>
                </p>
              </section>
            </template>

            <section class="form__section">
              <h3 class="form__section-title">Work details</h3>
              <div class="form__row">
                <label class="form__field">
                  <span>Phone <i>optional</i></span>
                  <input v-model="form.phone" type="tel" placeholder="09XXXXXXXXX" >
                  <em v-if="errors.phone">{{ errors.phone[0] }}</em>
                </label>
                <label class="form__field">
                  <span>Employee ID <i>optional</i></span>
                  <input v-model="form.employee_id" type="text" >
                  <em v-if="errors.employee_id">{{ errors.employee_id[0] }}</em>
                </label>
              </div>

              <!-- Title: pick RMT or RN, or type any other. A label only. -->
              <div class="form__field">
                <label for="staff-title" class="form__label">Title <i>optional</i></label>
                <ComboInput
                  id="staff-title"
                  v-model="form.position"
                  :options="titles"
                  maxlength="100"
                  placeholder="Choose or type, e.g. RMT"
                />
                <em v-if="errors.position">{{ errors.position[0] }}</em>
              </div>
            </section>

            <section class="form__section">
              <h3 class="form__section-title">Role and access</h3>
              <div class="form__row">
                <label class="form__field">
                  <span>Department</span>
                  <select v-model="form.department">
                    <option value="">Select a department</option>
                    <option v-for="group in departments" :key="group.department" :value="group.department">
                      {{ group.label }}
                    </option>
                  </select>
                  <em v-if="errors.department">{{ errors.department[0] }}</em>
                </label>

                <!-- Role: pick one of the department's roles, or type a custom one. -->
                <!-- A div, not a label: a click on a suggestion would otherwise
                     refocus the field and reopen the list. -->
                <div class="form__field">
                  <label for="staff-role" class="form__label">Role</label>
                  <ComboInput
                    id="staff-role"
                    v-model="form.role"
                    :options="departmentRoles.map((role) => role.label)"
                    maxlength="100"
                    :placeholder="form.department ? 'Choose or type a role' : 'Choose a department first'"
                    :disabled="!form.department && !form.role"
                  />
                  <em v-if="errors.staff_role">{{ errors.staff_role[0] }}</em>
                  <em v-if="errors.custom_role">{{ errors.custom_role[0] }}</em>
                  <em v-if="catalogueError">{{ catalogueError }}</em>
                </div>
              </div>
              <p class="form__hint form__hint--role">
                <template v-if="matchedRole">{{ matchedRole.description }}</template>
                <template v-else-if="form.role.trim()">
                  A custom role: it can do what the {{ departmentLabel }} department does, within the privileges ticked below.
                </template>
                <template v-else>
                  A supervisor needs no role. Anyone else needs one, or they can sign in but reach nothing.
                </template>
              </p>

              <fieldset class="form__field privileges">
                <legend>Privileges</legend>
                <div class="privileges__grid">
                  <label v-for="privilege in privileges" :key="privilege.key" class="privilege">
                    <input v-model="form.staff_privileges" type="checkbox" :value="privilege.key" >
                    <span>
                      <strong>{{ privilege.label }}</strong>
                      <small>{{ privilege.description }}</small>
                    </span>
                  </label>
                </div>
                <small>They cap the role: unticking Delete, for example, stops them closing a donation or discarding a unit.</small>
                <em v-if="errors.staff_privileges">{{ errors.staff_privileges[0] }}</em>
              </fieldset>

              <label class="toggle toggle--block">
                <input v-model="form.is_supervisor" type="checkbox" >
                <span>
                  <strong>Supervisor</strong>
                  <small>Can manage staff and see the whole Blood Center overview.</small>
                </span>
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
            </section>

            <p v-if="formError" class="form__error" role="alert">{{ formError }}</p>

            <div class="modal__actions">
              <button type="button" class="ghost-btn" @click="modalOpen = false">Cancel</button>
              <button type="submit" class="btn-primary" :disabled="saving">
                {{ saving ? 'Saving…' : (editing ? 'Save changes' : 'Add staff') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import ComboInput from '~/components/common/ComboInput.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  requires: 'staff.manage',
})

useHead({ title: 'Staff Accounts · RedAgos' })

const PRIVILEGE_ORDER = ['read', 'write', 'update', 'delete']

/**
 * Departments and their roles, the privileges and the title suggestions,
 * served by the server so the form describes each role in the same words its
 * permission matrix enforces.
 */
const departments = ref([])
const privileges = ref([])
const titles = ref(['RMT', 'RN'])
const catalogueError = ref('')

const departmentRoles = computed(() => departments.value.find((group) => group.department === form.department)?.roles ?? [])
const departmentLabel = computed(() => departments.value.find((group) => group.department === form.department)?.label ?? 'chosen')

/** The predefined role the typed text names, if any — matched on its title. */
const matchedRole = computed(() => {
  const typed = form.role.trim().toLowerCase()

  if (!typed) return null

  return departments.value
    .flatMap((group) => group.roles)
    .find((role) => role.label.toLowerCase() === typed || role.key === typed) ?? null
})

async function loadCatalogue() {
  try {
    const response = await bloodCenterService.staffRoles()
    departments.value = response?.data?.departments ?? []
    privileges.value = response?.data?.privileges ?? []
    if (response?.data?.titles?.length) titles.value = response.data.titles
  } catch (error) {
    catalogueError.value = error?.message || 'Could not load the list of roles.'
  }
}

/** A predefined role is sent as its key; anything else as a custom role. */
function rolePayload() {
  const typed = form.role.trim()

  if (!typed) return { staff_role: null, custom_role: null }

  return matchedRole.value
    ? { staff_role: matchedRole.value.key, custom_role: null }
    : { staff_role: null, custom_role: typed }
}

/*
 * Password::min(8)->mixedCase()->numbers() is the server rule, so the
 * generated value is built to satisfy it — the same generator as the super
 * admin's account form.
 */
function generatePassword() {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghijkmnopqrstuvwxyz'
  const digits = '23456789'
  const pool = upper + lower + digits

  const pick = (set) => set[Math.floor(Math.random() * set.length)]
  const chars = [pick(upper), pick(lower), pick(digits), pick(digits)]

  while (chars.length < 12) chars.push(pick(pool))

  // Shuffle so the guaranteed characters are not always in the same positions.
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }

  form.password = chars.join('')
  form.password_confirmation = form.password
}

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

function blankForm() {
  return {
    first_name: '', last_name: '', email: '', password: '', password_confirmation: '',
    phone: '', employee_id: '', position: '', department: '', role: '',
    staff_privileges: [...PRIVILEGE_ORDER], is_supervisor: false,
    account_status: 'active',
  }
}

const form = reactive(blankForm())

// Picking a predefined role from another department moves the department to it.
watch(matchedRole, (role) => {
  if (role) {
    const home = departments.value.find((group) => group.roles.some((r) => r.key === role.key))
    if (home) form.department = home.department
  }
})

function resetForm() {
  Object.assign(form, blankForm())
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
    role: row.role_label || '',
    staff_privileges: [...(row.staff_privileges ?? PRIVILEGE_ORDER)],
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
        position: form.position.trim() || null,
        department: form.department || null,
        ...rolePayload(),
        staff_privileges: [...form.staff_privileges],
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
      const { role: _role, ...fields } = form

      await bloodCenterService.createStaff({
        ...fields,
        phone: form.phone || null,
        employee_id: form.employee_id || null,
        position: form.position.trim() || null,
        department: form.department || null,
        ...rolePayload(),
        staff_privileges: [...form.staff_privileges],
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

// --- Roster grouping and counts ---

const hasFilters = computed(() => Boolean(search.value.trim() || departmentFilter.value || includeDeleted.value))

const activeRows = computed(() => rows.value.filter((row) => !row.deleted_at))
const supervisorCount = computed(() => activeRows.value.filter((row) => row.is_supervisor).length)
const unverifiedCount = computed(() => activeRows.value.filter((row) => !row.email_verified).length)

/**
 * Rows grouped by department, in the catalogue's order, so the roster reads
 * the way the sidebar does. Accounts without a department (usually
 * supervisors) come first, under Management.
 */
const groupedRows = computed(() => {
  const groups = [{ key: '__none', label: 'Management / no department', rows: [] }]
  const byKey = new Map()

  for (const dept of departments.value) {
    const group = { key: dept.department, label: dept.label, rows: [] }
    groups.push(group)
    byKey.set(dept.department, group)
  }

  for (const row of rows.value) {
    const group = byKey.get(row.department)
    if (group) {
      group.rows.push(row)
    } else if (row.department) {
      // A department the catalogue did not list (or has not loaded yet).
      const extra = { key: row.department, label: row.department_label || row.department, rows: [row] }
      groups.push(extra)
      byKey.set(row.department, extra)
    } else {
      groups[0].rows.push(row)
    }
  }

  return groups.filter((group) => group.rows.length)
})

function initials(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0][0]
  return letters.toUpperCase()
}

function clearFilters() {
  search.value = ''
  departmentFilter.value = ''
  includeDeleted.value = false
  load()
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

onMounted(() => Promise.all([load(), loadCatalogue()]))
</script>

<style scoped>
.staff {
  font-family: var(--rb-font-sans);
  max-width: var(--rb-content-max, 1600px);
  margin: 0 auto;
  padding: 24px var(--rb-gutter, 24px) 40px;
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

.staff__title {
  margin: 0;
  font-size: 20px;
  letter-spacing: -0.02em;
  font-weight: 700;
  color: var(--rb-text-primary);
}

.staff__subtitle {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--rb-text-secondary);
  max-width: 68ch;
}

.summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
}

.summary__item {
  padding: 5px 11px;
  border-radius: 999px;
  border: 1px solid var(--rb-border);
  background: var(--rb-surface);
  font-size: 12px;
  color: var(--rb-text-secondary);
}

.summary__item strong {
  color: var(--rb-text-primary);
  font-variant-numeric: tabular-nums;
}

.summary__item--warning {
  border-color: rgba(var(--rb-warning-rgb), 0.3);
  background: rgba(var(--rb-warning-rgb), 0.08);
  color: var(--rb-warning-text);
}

.summary__item--warning strong { color: inherit; }

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

.field:focus-within {
  border-color: var(--rb-primary);
  box-shadow: var(--rb-focus-ring);
}

.field__clear {
  display: flex;
  padding: 2px;
  border: 0;
  border-radius: 6px;
  background: none;
  color: var(--rb-text-secondary);
  cursor: pointer;
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
  border: 1px solid var(--rb-border-strong);
  background: var(--rb-surface);
  font-size: 13px;
  color: var(--rb-text-primary);
  font-family: inherit;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.select:focus,
.form__field select:focus,
.form__field input:focus {
  outline: none;
  border-color: var(--rb-primary);
  box-shadow: var(--rb-focus-ring);
}

.form__field input:disabled {
  background: var(--rb-surface-alt);
  cursor: not-allowed;
}

.toggle {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  color: var(--rb-text-secondary);
}

.toggle--block {
  align-items: flex-start;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--rb-border);
  background: var(--rb-surface-alt);
  cursor: pointer;
}

.toggle--block input { margin-top: 3px; }
.toggle--block strong { display: block; font-size: 13px; color: var(--rb-text-primary); }
.toggle--block small { display: block; font-size: 12px; color: var(--rb-text-secondary); }

.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 10px 16px;
  border: 0;
  border-radius: 10px;
  background: var(--rb-primary);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s ease;
}

.btn-primary:hover:not(:disabled) { background: #0D47A1; }

.btn-primary:focus-visible,
.ghost-btn:focus-visible {
  outline: 2px solid var(--rb-primary-text);
  outline-offset: 2px;
}

.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

.ghost-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 11px;
  border-radius: 8px;
  border: 1px solid var(--rb-border);
  background: var(--rb-surface);
  font-size: 12px;
  font-weight: 600;
  color: var(--rb-text-secondary);
  cursor: pointer;
}

.ghost-btn:hover { border-color: var(--rb-border-hover); color: var(--rb-text-primary); }
.ghost-btn--danger { color: var(--rb-accent-text); }
.ghost-btn--danger:hover { border-color: rgba(var(--rb-accent-rgb), 0.4); color: var(--rb-accent-text); }

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
  vertical-align: middle;
}

.table tbody tr:not(.group-row):hover td { background: var(--rb-surface-hover); }

.th-hint {
  margin-left: 4px;
  font-weight: 600;
  letter-spacing: 0.04em;
  opacity: 0.7;
  cursor: help;
}

.group-row th {
  padding: 9px 14px;
  background: var(--rb-surface-alt);
  border-bottom: 1px solid var(--rb-border);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--rb-text-secondary);
  text-align: left;
}

.group-row__count {
  margin-left: 6px;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--rb-surface);
  border: 1px solid var(--rb-border);
  font-size: 10.5px;
  letter-spacing: 0;
}

.person { display: flex; align-items: center; gap: 10px; min-width: 0; }

.person__avatar {
  width: 32px;
  height: 32px;
  border-radius: 999px;
  display: inline-grid;
  place-items: center;
  flex-shrink: 0;
  background: rgba(var(--rb-primary-rgb), 0.1);
  color: var(--rb-primary-text);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.person__text { min-width: 0; }

.cell-mono { font-variant-numeric: tabular-nums; color: var(--rb-text-secondary); }

.row--removed { opacity: 0.55; }

.cell-strong { margin: 0; font-weight: 600; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.cell-sub { margin: 2px 0 0; font-size: 12px; color: var(--rb-text-secondary); }

.actions { display: flex; justify-content: flex-end; gap: 6px; white-space: nowrap; }

.pill {
  display: inline-block;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  background: var(--rb-surface-hover);
  color: var(--rb-text-secondary);
}

.pill--supervisor { background: rgba(var(--rb-primary-rgb), 0.1); color: var(--rb-primary-text); }
.pill--success { background: rgba(var(--rb-success-rgb), 0.12); color: var(--rb-success-text); }
.pill--warning { background: rgba(var(--rb-warning-rgb), 0.12); color: var(--rb-warning-text); }
.pill--danger { background: rgba(var(--rb-accent-rgb), 0.12); color: var(--rb-accent-text); }
.pill--muted { background: var(--rb-surface-hover); color: var(--rb-text-secondary); }

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 40px 24px;
  text-align: center;
  font-size: 13px;
  color: var(--rb-text-secondary);
  border: 1px dashed var(--rb-border-strong);
  border-radius: 14px;
  background: var(--rb-surface);
}

.empty__icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: rgba(var(--rb-primary-rgb), 0.08);
  color: var(--rb-primary-text);
}

.empty__title { margin: 0; font-size: 14px; font-weight: 700; color: var(--rb-text-primary); }
.empty__text { margin: 0; max-width: 46ch; line-height: 1.5; }

.skeleton-row {
  display: grid;
  grid-template-columns: 32px minmax(0, 2fr) minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  padding: 14px;
  border-bottom: 1px solid var(--rb-border);
}

.skeleton {
  display: block;
  height: 12px;
  border-radius: 6px;
  background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 37%, var(--rb-skeleton-a) 63%);
  background-size: 400% 100%;
  animation: staff-shimmer 1.4s ease infinite;
}

.skeleton--avatar { width: 32px; height: 32px; border-radius: 999px; }
.skeleton--short { width: 60%; }

@keyframes staff-shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none; }
}

.banner {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  padding: 11px 14px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
}

.banner--success { background: rgba(var(--rb-success-rgb), 0.08); color: var(--rb-success-text); }
.banner--error { background: rgba(var(--rb-accent-rgb), 0.08); color: var(--rb-accent-text); }

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
  max-width: 600px;
  border-radius: 16px;
  background: var(--rb-surface);
  padding: 0 24px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 24px 60px -20px rgba(var(--rb-shadow-rgb), 0.35);
}

.modal__head {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 20px 0 14px;
  background: var(--rb-surface);
  border-bottom: 1px solid var(--rb-border);
}

.modal__title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: var(--rb-text-primary);
}

.modal__sub { margin: 3px 0 0; font-size: 12px; color: var(--rb-text-secondary); }

.icon-btn {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--rb-text-secondary);
  cursor: pointer;
}

.icon-btn:hover { background: var(--rb-surface-hover); color: var(--rb-text-primary); }
.icon-btn:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: 2px; }

.form { display: flex; flex-direction: column; gap: 4px; padding-top: 4px; }

.form__section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 0 16px;
  border-bottom: 1px solid var(--rb-border);
}

.form__section:last-of-type { border-bottom: 0; }

.form__section-title {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--rb-text-secondary);
}

.form__row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.form__field { display: flex; flex-direction: column; gap: 5px; }

.form__field > span,
.form__field > .form__label {
  font-size: 12px;
  font-weight: 600;
  color: var(--rb-text-primary);
}

.form__field > span i,
.form__field > .form__label i {
  margin-left: 4px;
  font-style: normal;
  font-weight: 500;
  color: var(--rb-text-secondary);
}

.form__field small { font-size: 11px; color: var(--rb-text-secondary); }
.form__field em { font-size: 11px; font-style: normal; color: var(--rb-accent-text); }

.form__error {
  margin: 0;
  font-size: 12px;
  color: var(--rb-accent-text);
}

.modal__actions {
  position: sticky;
  bottom: 0;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 0 20px;
  background: var(--rb-surface);
  border-top: 1px solid var(--rb-border);
}

.modal-fade-enter-active,
.modal-fade-leave-active { transition: opacity 0.15s ease; }
.modal-fade-enter-from,
.modal-fade-leave-to { opacity: 0; }

@media (max-width: 640px) {
  .staff { padding: 20px 16px 32px; }
  .modal { padding: 0 16px; }
  .modal-backdrop { padding: 0; align-items: flex-end; }
  .modal { max-height: 94vh; border-radius: 16px 16px 0 0; }
}

.form__hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--rb-text-secondary);
}

.form__hint--role { margin-top: -4px; }

.link-btn {
  margin-left: 4px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--rb-primary-text);
  font-size: 11px;
  font-weight: 600;
  text-decoration: underline;
  cursor: pointer;
}

.privileges {
  border: 0;
  margin: 0;
  padding: 0;
}

.privileges legend {
  margin-bottom: 5px;
  font-size: 12px;
  font-weight: 600;
}

.privileges__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.privilege {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  padding: 8px 10px;
  border: 1px solid var(--rb-border);
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.privilege:has(input:checked) {
  border-color: rgba(var(--rb-primary-rgb), 0.35);
  background: rgba(var(--rb-primary-rgb), 0.05);
}

.privilege strong {
  display: block;
  font-size: 12px;
}

.privilege small {
  display: block;
  font-size: 11px;
  color: var(--rb-text-secondary);
}

.privs {
  display: inline-flex;
  gap: 3px;
}

.priv {
  width: 20px;
  height: 20px;
  display: inline-grid;
  place-items: center;
  border-radius: 5px;
  font-size: 10px;
  font-weight: 700;
  background: var(--rb-surface-hover);
  color: var(--rb-text-secondary);
  opacity: 0.45;
}

.priv--on {
  background: rgba(var(--rb-primary-rgb), 0.12);
  color: var(--rb-primary-text);
  opacity: 1;
}

.tag {
  margin-left: 4px;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--rb-surface-hover);
  color: var(--rb-text-secondary);
  font-size: 10px;
  font-weight: 600;
}

@media (max-width: 560px) {
  .privileges__grid {
    grid-template-columns: 1fr;
  }
}
</style>
