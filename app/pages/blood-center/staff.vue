<template>
  <div class="staff">
    <header class="staff__header">
      <div>
        <h1 class="staff__title">Staff Accounts</h1>
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
      <span class="summary__item"><strong>{{ adminCount }}</strong> admin{{ adminCount === 1 ? '' : 's' }}</span>
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

      <SelectField v-model="departmentFilter" class="sel-filter" size="sm" aria-label="Filter by department"
        :options="[{ value: '', label: 'All departments' }, ...departments.map(group => ({ value: group.department, label: group.label }))]"
        @change="load" />

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

    <!-- Nobody yet: the Admin's first step -->
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
                    <!-- As it prints on what they sign: "Rowena Tan, RMT". -->
                    {{ row.signature_name || row.full_name }}
                    <span v-if="row.management_level" class="pill" :class="`pill--${row.management_level}`">
                      {{ row.management_level === 'admin' ? 'Admin' : 'Supervisor' }}
                    </span>
                  </p>
                  <p class="cell-sub">{{ row.email }}</p>
                </div>
              </div>
            </td>
            <td>
              <!-- Every role, the main one first; a custom one is tagged. -->
              <template v-if="row.role_labels?.length">
                <p v-for="(label, i) in row.role_labels" :key="label" :class="i === 0 ? 'cell-strong' : 'cell-role'">
                  {{ label }}
                  <span v-if="row.custom_role && label === row.custom_role" class="tag">custom</span>
                </p>
              </template>
              <p v-else class="cell-strong">{{ row.management_level ? 'Management' : 'No role yet' }}</p>
            </td>
            <td>
              <!-- A level is not capped by privileges; they cap a role, and this account has none. -->
              <span v-if="row.management_level && !row.role_label" class="cell-sub">
                {{ row.management_level === 'admin' ? 'Admin access' : 'View only' }}
              </span>
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
                <!-- Every row, a removed one too: the profile reads only. -->
                <button
                  type="button"
                  class="icon-btn icon-btn--row"
                  :aria-label="`View ${row.full_name}'s profile`"
                  title="View profile"
                  @click="openProfile(row)"
                >
                  <AssetIcon name="eye" :size="15" />
                </button>
                <button v-if="!row.deleted_at" type="button" class="ghost-btn" @click="openEdit(row)">
                  <AssetIcon name="pencil" :size="13" />
                  Edit
                </button>
                <button v-if="!row.deleted_at" type="button" class="ghost-btn ghost-btn--danger" @click="askRemove(row)">
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
                    <input v-model="form.first_name" v-person-name type="text" required >
                    <em v-if="errors.first_name">{{ errors.first_name[0] }}</em>
                  </label>
                  <label class="form__field">
                    <span>Last name</span>
                    <input v-model="form.last_name" v-person-name type="text" required >
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
                <button type="button" class="link-btn" @click="generatePassword">Generate a password</button>
              </section>
            </template>

            <section class="form__section">
              <h3 class="form__section-title">Work details</h3>
              <div class="form__row">
                <label class="form__field">
                  <span>Phone <i>optional</i></span>
                  <PhoneField v-model="form.phone" class="form__phone" size="sm" autocomplete="off" :invalid="Boolean(errors.phone)" />
                  <em v-if="errors.phone">{{ errors.phone[0] }}</em>
                </label>
                <label class="form__field">
                  <span>Employee ID <i>optional</i></span>
                  <input v-model="form.employee_id" type="text" >
                  <em v-if="errors.employee_id">{{ errors.employee_id[0] }}</em>
                </label>
              </div>

              <!--
                Title: credentials only (RMT, RN, MD), printed after the name on
                everything the person signs, in every department, the stock
                report's "BY:" line included. No job post: the role says what
                they do (project owner, 2026-10-22).
              -->
              <div class="form__field">
                <label for="staff-title" class="form__label">Title <i>optional</i></label>
                <ComboInput
                  id="staff-title"
                  v-model="form.credentials"
                  :options="credentialOptions"
                  maxlength="40"
                  placeholder="Choose or type, e.g. RMT"
                />
                <em v-if="errors.credentials">{{ errors.credentials[0] }}</em>
              </div>
            </section>

            <section class="form__section">
              <h3 class="form__section-title">Role and access</h3>
              <label class="form__field">
                <span>Department</span>
                <SelectField v-model="form.department" placeholder="Select a department" aria-label="Department"
                  :options="departments.map(group => ({ value: group.department, label: group.label }))" />
                <em v-if="errors.department">{{ errors.department[0] }}</em>
                <em v-if="catalogueError">{{ catalogueError }}</em>
              </label>

              <!-- Several roles, all in this department (project owner, 2026-10-17). -->
              <fieldset class="form__field roles">
                <legend>Roles</legend>
                <p v-if="!form.department" class="form__hint">Choose a department to see its roles.</p>
                <div v-else class="roles__list">
                  <label v-for="role in departmentRoles" :key="role.key" class="privilege role-option">
                    <input v-model="form.roles" type="checkbox" :value="role.key" >
                    <strong>
                      {{ role.label }}
                      <span v-if="form.roles.length > 1 && form.main_role === role.key" class="tag tag--main">main</span>
                    </strong>
                  </label>
                </div>
                <em v-if="errors.staff_role">{{ errors.staff_role[0] }}</em>
                <em v-if="errors.additional_staff_roles">{{ errors.additional_staff_roles[0] }}</em>
              </fieldset>

              <div class="form__row">
                <!-- Only asked when there is a choice to make. -->
                <label v-if="form.roles.length > 1" class="form__field">
                  <span>Main role</span>
                  <SelectField v-model="form.main_role" aria-label="Main role" :options="form.roles.map(key => ({ value: key, label: roleLabelOf(key) }))" />
                </label>

                <!-- A div, not a label: a click on a suggestion would otherwise
                     refocus the field and reopen the list. -->
                <div class="form__field">
                  <label for="staff-custom-role" class="form__label">Custom role <i>optional</i></label>
                  <input
                    id="staff-custom-role"
                    v-model="form.custom_role"
                    type="text"
                    maxlength="100"
                    :placeholder="form.department ? 'e.g. Quality Lead' : 'Choose a department first'"
                    :disabled="!form.department"
                    @blur="adoptTypedRole"
                  >
                  <em v-if="errors.custom_role">{{ errors.custom_role[0] }}</em>
                </div>
              </div>

              <fieldset class="form__field privileges">
                <legend>Privileges</legend>
                <div class="privileges__grid">
                  <label v-for="privilege in privileges" :key="privilege.key" class="privilege">
                    <input v-model="form.staff_privileges" type="checkbox" :value="privilege.key" >
                    <strong>{{ privilege.label }}</strong>
                  </label>
                </div>
                <em v-if="errors.staff_privileges">{{ errors.staff_privileges[0] }}</em>
              </fieldset>

              <!-- Above the role, not instead of it: an account may hold both. -->
              <fieldset class="form__field levels">
                <legend>Access level</legend>
                <div class="levels__list">
                  <label v-for="level in levelOptions" :key="level.key || 'staff'" class="privilege level">
                    <input v-model="form.management_level" type="radio" name="management_level" :value="level.key" >
                    <strong>{{ level.label }}</strong>
                  </label>
                </div>
                <em v-if="errors.management_level">{{ errors.management_level[0] }}</em>
              </fieldset>

              <label v-if="editing" class="form__field">
                <span>Account status</span>
                <SelectField v-model="form.account_status" aria-label="Account status"
                  :options="[{ value: 'active', label: 'Active' }, { value: 'suspended', label: 'Suspended' }, { value: 'deactivated', label: 'Deactivated' }]" />
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

    <!-- Remove: the page's own confirm, not the browser's -->
    <Transition name="modal-fade">
      <div v-if="removing.row" class="modal-backdrop" @click.self="cancelRemove">
        <div
          v-focus-trap
          class="modal modal--sm"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="remove-modal-title"
          aria-describedby="remove-modal-text"
          @dialog-escape="cancelRemove"
        >
          <div class="modal__head">
            <div>
              <h2 id="remove-modal-title" class="modal__title">Remove {{ removing.row.full_name }}?</h2>
              <p v-if="removing.row.email" class="modal__sub">{{ removing.row.email }}</p>
            </div>
            <button type="button" class="icon-btn" aria-label="Close" :disabled="removing.busy" @click="cancelRemove">
              <AssetIcon name="x" :size="16" />
            </button>
          </div>

          <p id="remove-modal-text" class="modal__text">
            They will be signed out immediately. The account can be restored later: tick
            <strong>Show removed</strong> to find it.
          </p>
          <p v-if="removing.error" class="form__error modal__error" role="alert">{{ removing.error }}</p>

          <div class="modal__actions">
            <button type="button" class="ghost-btn" :disabled="removing.busy" @click="cancelRemove">Cancel</button>
            <button type="button" class="btn-primary btn-primary--danger" :disabled="removing.busy" @click="confirmRemove">
              {{ removing.busy ? 'Removing…' : 'Remove account' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!--
      Staff Profile: read-only, from the staff-detail endpoint. Laid out as the
      Donor Profile; CenterModal brings the focus trap, Escape and the Close.
      No password, token or verification code: the endpoint never sends one.
    -->
    <CenterModal :open="profileView.open" title="Staff Profile" @close="closeProfile">
      <div ref="profileBody" class="sp" tabindex="-1" :aria-busy="profileView.loading ? 'true' : undefined">
        <div v-if="profileView.loading" class="skeleton skeleton--hero" />
        <div v-else-if="profileView.error" class="banner banner--error" role="alert">
          <AssetIcon name="circle-alert" :size="16" />
          <p class="banner__text">{{ profileView.error }}</p>
          <button type="button" class="btn-link" @click="retryProfile">Retry</button>
        </div>

        <template v-else-if="profile">
          <div class="sp-hero">
            <span class="sp-avatar" aria-hidden="true">
              <img v-if="profile.photo" :src="profile.photo" alt="">
              <template v-else>{{ initials(profile.fullName) }}</template>
            </span>
            <div class="sp-hero__text">
              <p class="sp-hero__name">{{ profile.fullName }}</p>
              <p v-if="profile.metaLine" class="sp-hero__meta">{{ profile.metaLine }}</p>
              <div class="sp-hero__badges">
                <span class="pill" :class="statusClass(profile.raw)">{{ statusLabel(profile.raw) }}</span>
                <span v-if="profile.managementLevel" class="pill" :class="`pill--${profile.managementLevel}`">
                  {{ profile.managementLevel === 'admin' ? 'Admin' : 'Supervisor' }}
                </span>
              </div>
            </div>
          </div>

          <dl class="facts">
            <div class="fact"><dt>Email</dt><dd>{{ profile.email || '—' }}</dd></div>
            <div class="fact"><dt>Username</dt><dd>{{ profile.username || '—' }}</dd></div>
            <div class="fact"><dt>Employee ID</dt><dd>{{ profile.employeeId || '—' }}</dd></div>
            <div class="fact"><dt>Phone</dt><dd>{{ profile.phone || '—' }}</dd></div>
            <div v-if="profile.credentials" class="fact"><dt>Title</dt><dd>{{ profile.credentials }}</dd></div>
          </dl>

          <section class="sp-section">
            <h3 class="sp-section__title">Role and access</h3>
            <dl class="facts">
              <div class="fact"><dt>Department</dt><dd>{{ profile.department || '—' }}</dd></div>
              <div class="fact"><dt>Access level</dt><dd>{{ profile.level }}</dd></div>
              <div class="fact"><dt>Main role</dt><dd>{{ profile.mainRole || '—' }}</dd></div>
              <div class="fact">
                <dt>Additional roles</dt>
                <dd>{{ profile.additionalRoles.length ? profile.additionalRoles.join(', ') : '—' }}</dd>
              </div>
              <div class="fact"><dt>Custom role</dt><dd>{{ profile.customRole || '—' }}</dd></div>
              <div class="fact"><dt>Privileges</dt><dd>{{ profile.privileges }}</dd></div>
            </dl>
          </section>

          <section class="sp-section">
            <h3 class="sp-section__title">Account</h3>
            <dl class="facts">
              <div class="fact">
                <dt>Account status</dt>
                <dd>
                  {{ profile.accountStatus }}
                  <span v-if="profile.removedOn" class="fact__sub">Since {{ profile.removedOn }}</span>
                </dd>
              </div>
              <div class="fact"><dt>Email verification</dt><dd>{{ profile.emailVerified ? 'Verified' : 'Not verified' }}</dd></div>
              <div v-if="profile.activatedOn" class="fact"><dt>Activated</dt><dd>{{ profile.activatedOn }}</dd></div>
            </dl>
          </section>
        </template>
      </div>

      <template #actions>
        <button type="button" class="ui-btn" @click="closeProfile">Close</button>
      </template>
    </CenterModal>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import PhoneField from '~/components/common/PhoneField.vue'
import SelectField from '~/components/common/SelectField.vue'
import ComboInput from '~/components/common/ComboInput.vue'
import CenterModal from '~/components/ui/CenterModal.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import { resolveApiAssetURL } from '~/api/BaseService'
import { onPageReturn } from '~/composables/useKeptAlive'
import { createLatest } from '~/composables/useLiveRefresh'
import { formatShortDate } from '~/utils/donorRecords'
import { formatPhoneNumber } from '~/utils/phone'

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  requires: 'staff.manage',
  keepalive: true,
})

useHead({ title: 'Staff Accounts · RedAgos' })

const { user, fetchUser } = useUser()

const PRIVILEGE_ORDER = ['read', 'write', 'update', 'delete']

/**
 * Departments and their roles, the privileges and the title suggestions,
 * served by the server so the form describes each role in the same words its
 * permission matrix enforces.
 */
const departments = ref([])
const levels = ref([])
const privileges = ref([])
// Suggested credentials; the server's catalogue may list others.
const credentialOptions = ref(['RMT', 'RN', 'MD'])
const catalogueError = ref('')

const departmentRoles = computed(() => departments.value.find((group) => group.department === form.department)?.roles ?? [])

const allRoles = computed(() => departments.value.flatMap((group) => group.roles.map((role) => ({ ...role, department: group.department }))))

function roleLabelOf(key) {
  return allRoles.value.find((role) => role.key === key)?.label ?? key
}

/** The listed role a typed name means, if any — matched on its title or key. */
function roleNamed(text) {
  const typed = text.trim().toLowerCase()
  if (!typed) return null
  return allRoles.value.find((role) => role.label.toLowerCase() === typed || role.key === typed) ?? null
}

/**
 * A custom role typed as the name of a listed one is that role: tick it
 * rather than keep a custom "Phlebotomist" beside the real one. One from
 * another department moves the form there, but only while nothing is ticked.
 */
function adoptTypedRole() {
  const role = roleNamed(form.custom_role)
  if (!role) return

  if (role.department !== form.department) {
    if (form.roles.length) return
    form.department = role.department
  }

  if (!form.roles.includes(role.key)) form.roles = [...form.roles, role.key]
  form.custom_role = ''
}

async function loadCatalogue() {
  try {
    const response = await bloodCenterService.staffRoles()
    departments.value = response?.data?.departments ?? []
    levels.value = response?.data?.levels ?? []
    privileges.value = response?.data?.privileges ?? []
    if (response?.data?.titles?.length) credentialOptions.value = response.data.titles
  } catch (error) {
    catalogueError.value = error?.message || 'Could not load the list of roles.'
  }
}

/**
 * The access levels, least first. The two management levels take their names
 * from the server's catalogue; the fallback covers a catalogue that failed to load.
 */
const LEVEL_FALLBACK = {
  supervisor: 'Supervisor',
  admin: 'Blood Center Admin',
}

const levelOptions = computed(() => [
  { key: '', label: 'Staff' },
  ...['supervisor', 'admin'].map((key) => ({
    key,
    label: levels.value.find((level) => level.key === key)?.label ?? LEVEL_FALLBACK[key],
  })),
])

/**
 * The roles as the server takes them: the main one, the others in the
 * department's own order, and a custom one by name.
 */
function rolePayload() {
  const ordered = departmentRoles.value.map((role) => role.key).filter((key) => form.roles.includes(key))
  const main = ordered.includes(form.main_role) ? form.main_role : (ordered[0] ?? null)

  return {
    staff_role: main,
    additional_staff_roles: ordered.filter((key) => key !== main),
    custom_role: form.custom_role.trim() || null,
  }
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
useNoticeToast(banner, { kind: bannerKind })

function blankForm() {
  return {
    first_name: '', last_name: '', email: '', password: '', password_confirmation: '',
    phone: '', employee_id: '', credentials: '', department: '',
    roles: [], main_role: '', custom_role: '',
    staff_privileges: [...PRIVILEGE_ORDER], management_level: '',
    account_status: 'active',
  }
}

const form = reactive(blankForm())

// One person's roles are all in one department: a new department keeps only
// the ticked roles that belong to it.
watch(() => form.department, () => {
  // Nothing to judge by until the catalogue has loaded.
  if (!departments.value.length) return
  const keys = new Set(departmentRoles.value.map((role) => role.key))
  const kept = form.roles.filter((key) => keys.has(key))
  if (kept.length !== form.roles.length) form.roles = kept
})

// The main role is always one of the ticked ones; the first, until chosen.
watch(() => form.roles, (roles) => {
  if (!roles.includes(form.main_role)) form.main_role = roles[0] ?? ''
})

function resetForm() {
  Object.assign(form, blankForm())
  errors.value = {}
  formError.value = ''
}

// `quiet`, on return to this kept-alive page: no skeleton over the roster on screen.
async function load(options = {}) {
  // Read, not destructured: an event or watch handing its own value in may hand in null.
  const quiet = options?.quiet === true
  if (!quiet) loading.value = true

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
    credentials: row.credentials || '',
    department: row.department || '',
    roles: [...(row.staff_roles ?? (row.staff_role ? [row.staff_role] : []))],
    main_role: row.staff_role || '',
    custom_role: row.custom_role || '',
    staff_privileges: [...(row.staff_privileges ?? PRIVILEGE_ORDER)],
    management_level: row.management_level ?? '',
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
        credentials: form.credentials.trim() || null,
        department: form.department || null,
        ...rolePayload(),
        staff_privileges: [...form.staff_privileges],
        management_level: form.management_level || null,
      }

      // Ang pending_verification kay dili ma-set balik sa Admin, so
      // ipadala ra kung nausab gyud.
      if (form.account_status !== editing.value.account_status) {
        payload.account_status = form.account_status
      }

      // What the dialog showed for every field it sends, as the roster gave
      // it: the server refuses the save if another Admin has changed any of
      // them since, rather than putting their change back.
      payload.expected = Object.fromEntries(Object.keys(payload).map((field) => [field, editing.value[field] ?? null]))

      await bloodCenterService.updateStaff(editing.value.uuid, payload)

      // An Admin who just stepped down can no longer open this page.
      if (editing.value.uuid === user.value?.uuid && payload.management_level !== 'admin') {
        await fetchUser()
        modalOpen.value = false
        await navigateTo(departmentHome(user.value))
        return
      }

      showBanner('Account updated.', 'success')
    } else {
      const { roles: _roles, main_role: _main, custom_role: _custom, ...fields } = form

      await bloodCenterService.createStaff({
        ...fields,
        phone: form.phone || null,
        employee_id: form.employee_id || null,
        credentials: form.credentials.trim() || null,
        department: form.department || null,
        ...rolePayload(),
        staff_privileges: [...form.staff_privileges],
        management_level: form.management_level || null,
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
      // last_admin — ang facility mahibilin nga walay makadumala sa staff.
      formError.value = error.message

      // Another Admin changed this account after the dialog opened. Read it
      // again: the dialog keeps what was typed, now judged against what is
      // stored, so saving again is a choice. The roster follows.
      if (error?.data?.code === 'stale_edit' && editing.value) {
        const fresh = await bloodCenterService.showStaff(editing.value.uuid).catch(() => null)
        if (fresh?.uuid) editing.value = fresh
        load()
      }
    } else {
      formError.value = error?.message || 'Something went wrong.'
    }
  } finally {
    saving.value = false
  }
}

// Removing asks first, in the page's own confirm rather than the browser's
// (project owner, 2026-10-26). A refusal stays in the dialog.
const removing = reactive({ row: null, busy: false, error: '' })

function askRemove(row) {
  Object.assign(removing, { row, busy: false, error: '' })
}

function cancelRemove() {
  if (removing.busy) return
  removing.row = null
}

async function confirmRemove() {
  removing.busy = true
  removing.error = ''

  try {
    await bloodCenterService.deleteStaff(removing.row.uuid)
    removing.busy = false
    removing.row = null
    showBanner('Account removed.', 'success')
    await load()
  } catch (error) {
    removing.error = error?.message || 'Could not remove that account.'
    removing.busy = false
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

// --- Staff Profile (read-only) ---

const profileView = reactive({ open: false, uuid: null, loading: false, error: '' })
const profile = ref(null)
const profileBody = ref(null)
// A slow answer for one row never lands on the profile of the next.
const profileLatest = createLatest()

const ACCOUNT_STATUS_LABELS = {
  active: 'Active',
  pending_verification: 'Pending verification',
  suspended: 'Suspended',
  deactivated: 'Deactivated',
}

function privilegeLabel(key) {
  return privileges.value.find((privilege) => privilege.key === key)?.label ?? `${key[0].toUpperCase()}${key.slice(1)}`
}

/** One staff account as the profile shows it, from the staff-detail endpoint. */
function mapStaffProfile(data) {
  // role_labels is every role, main first, then the custom one; the first
  // staff_roles.length of them are the listed roles.
  const roleKeys = data?.staff_roles ?? []
  const roleLabels = (data?.role_labels ?? []).slice(0, roleKeys.length)
  const level = data?.management_level || ''
  // As on the roster: a level is not capped by privileges, a role is.
  const levelOnly = Boolean(level) && !data?.role_labels?.length
  const granted = PRIVILEGE_ORDER.filter((key) => data?.staff_privileges?.includes(key))

  return {
    raw: data,
    fullName: data?.full_name || [data?.first_name, data?.last_name].filter(Boolean).join(' '),
    photo: resolveApiAssetURL(data?.avatar_url) || '',
    metaLine: [roleLabels[0] || data?.custom_role || (level ? 'Management' : ''), data?.department_label].filter(Boolean).join(' · '),
    email: data?.email || '',
    username: data?.username || '',
    employeeId: data?.employee_id || '',
    phone: formatPhoneNumber(data?.phone),
    credentials: data?.credentials || '',
    department: data?.department_label || '',
    level: level
      ? (data?.management_level_label || levelOptions.value.find((option) => option.key === level)?.label || level)
      : 'Staff',
    managementLevel: level,
    mainRole: roleLabels[0] || '',
    additionalRoles: roleLabels.slice(1),
    customRole: data?.custom_role || '',
    privileges: levelOnly
      ? (level === 'admin' ? 'Admin access' : 'View only')
      : (granted.map(privilegeLabel).join(', ') || 'None'),
    accountStatus: data?.deleted_at ? 'Removed' : (ACCOUNT_STATUS_LABELS[data?.account_status] || data?.account_status || '—'),
    removedOn: formatShortDate(data?.deleted_at),
    emailVerified: Boolean(data?.email_verified),
    activatedOn: formatShortDate(data?.activated_at),
  }
}

function openProfile(row) {
  Object.assign(profileView, { open: true, uuid: row.uuid })
  profile.value = null
  loadProfile(row.uuid)
}

async function loadProfile(uuid) {
  const ticket = profileLatest.begin()
  profileView.loading = true
  profileView.error = ''

  try {
    const data = await bloodCenterService.showStaff(uuid)
    if (!profileLatest.isCurrent(ticket)) return
    profile.value = mapStaffProfile(data)
  } catch (error) {
    if (!profileLatest.isCurrent(ticket)) return
    profile.value = null
    profileView.error = error?.message || 'Could not load this staff member.'
  } finally {
    if (profileLatest.isCurrent(ticket)) profileView.loading = false
  }
}

function retryProfile() {
  // Retry goes as the load starts. Focus stays in the dialog, where its
  // focus trap hears Escape, rather than falling to the page.
  profileBody.value?.focus()
  loadProfile(profileView.uuid)
}

function closeProfile() {
  profileLatest.invalidate()
  profileView.open = false
  profileView.loading = false
}

// --- Roster grouping and counts ---

const hasFilters = computed(() => Boolean(search.value.trim() || departmentFilter.value || includeDeleted.value))

const activeRows = computed(() => rows.value.filter((row) => !row.deleted_at))
const adminCount = computed(() => activeRows.value.filter((row) => row.management_level === 'admin').length)
const supervisorCount = computed(() => activeRows.value.filter((row) => row.management_level === 'supervisor').length)
const unverifiedCount = computed(() => activeRows.value.filter((row) => !row.email_verified).length)

/**
 * Rows grouped by department, in the catalogue's order, so the roster reads
 * the way the sidebar does. Accounts without a department (usually the
 * Admin and Supervisors) come first, under Management.
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
// Kept alive: back here, the roster reloads in place; an open editor keeps its fields.
onPageReturn(() => load({ quiet: true }))
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

.form__field .form__phone { --pf-radius: 10px; }

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

.btn-primary--danger { background: var(--rb-accent); }
.btn-primary--danger:hover:not(:disabled) { background: color-mix(in srgb, var(--rb-accent) 88%, #000); }

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

.pill--admin { background: var(--rb-primary); color: #fff; }
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

/* The remove confirm: the same card, narrower, with a line of text for a body. */
.modal--sm { max-width: 440px; }
.modal__text { margin: 16px 0; font-size: 13.5px; line-height: 1.55; color: var(--rb-text-primary); }
.modal .modal__error { margin-bottom: 14px; }

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


.link-btn {
  align-self: flex-start;
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

/* The department's roles, as ticks: same cards as the privileges. */
.roles {
  border: 0;
  margin: 0;
  padding: 0;
}

.roles legend {
  margin-bottom: 5px;
  font-size: 12px;
  font-weight: 600;
}


.roles__list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.role-option strong { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }

.tag--main {
  margin-left: 0;
  background: rgba(var(--rb-primary-rgb), 0.1);
  color: var(--rb-primary-text);
}

/* A person's other roles, under the main one. */
.cell-role { margin: 1px 0 0; font-size: 12.5px; color: var(--rb-text-primary); display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }

.levels {
  border: 0;
  margin: 0;
  padding: 0;
}

.levels legend {
  margin-bottom: 5px;
  font-size: 12px;
  font-weight: 600;
}

.levels__list {
  display: grid;
  gap: 6px;
}

@media (max-width: 560px) {
  .privileges__grid,
  .roles__list {
    grid-template-columns: 1fr;
  }
}

/* ---------- Staff Profile, as Donor Management draws its profile ---------- */

/* The row's eye: Donor Management's bordered icon button. */
.icon-btn--row {
  width: 30px;
  height: 30px;
  border: 1px solid var(--rb-border-strong);
  background: var(--rb-surface);
  transition: background 0.12s ease, color 0.12s ease, border-color 0.12s ease;
}

.icon-btn--row:hover {
  color: var(--rb-primary-text);
  border-color: rgba(var(--rb-primary-rgb), 0.45);
  background: var(--rb-surface-hover);
}

.icon-btn--row:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }

.sp { display: flex; flex-direction: column; gap: 16px; }
.sp:focus { outline: none; }
.sp .banner { margin-bottom: 0; border: 1px solid rgba(var(--rb-accent-rgb), 0.35); }
.banner__text { flex: 1; margin: 0; line-height: 1.45; color: var(--rb-text-primary); }

.btn-link {
  padding: 0;
  border: 0;
  background: none;
  color: var(--rb-primary-text);
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}

.btn-link:hover { text-decoration: underline; }
.btn-link:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }

.skeleton--hero { height: 120px; border-radius: 14px; }

.sp-hero {
  display: flex;
  align-items: center;
  gap: 14px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--rb-border);
}

.sp-avatar {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  overflow: hidden;
  width: 60px;
  height: 60px;
  border-radius: 999px;
  background: rgba(var(--rb-primary-rgb), 0.1);
  color: var(--rb-primary-text);
  font-size: 19px;
  font-weight: 700;
}

.sp-avatar img { width: 100%; height: 100%; object-fit: cover; }
.sp-hero__text { min-width: 0; }
.sp-hero__name { margin: 0; font-size: 18px; font-weight: 700; letter-spacing: -0.01em; color: var(--rb-text-primary); overflow-wrap: anywhere; }
.sp-hero__meta { margin: 3px 0 0; font-size: 12.5px; color: var(--rb-text-secondary); }
.sp-hero__badges { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }

.sp-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid var(--rb-border);
}

.sp-section__title { margin: 0; font-size: 13px; font-weight: 700; color: var(--rb-text-primary); }

.facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px 18px;
  margin: 0;
}

.fact { min-width: 0; }

.fact dt {
  margin: 0 0 3px;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--rb-text-secondary);
}

.fact dd { margin: 0; font-size: 13px; font-weight: 600; color: var(--rb-text-primary); overflow-wrap: anywhere; }
.fact__sub { display: block; font-size: 11.5px; font-weight: 500; color: var(--rb-text-secondary); }

@media (max-width: 480px) {
  .facts { grid-template-columns: 1fr; }
}
</style>

<style scoped>
/* The system dropdown in a toolbar: a fixed width rather than the row's. */
.sel-filter { width: 180px; flex: none; }
</style>
