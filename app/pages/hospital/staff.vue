<template>
  <div class="list-page">
    <div class="list-inner">
      <PageHeader title="Staff" subtitle="Your blood bank's accounts and what each person may do." />

      <div v-if="loadError" class="banner banner--error" role="alert">
        <AssetIcon name="circle-alert" :size="16" />
        <p class="banner__text">{{ loadError }}</p>
        <button type="button" class="btn-link" @click="refresh">Retry</button>
      </div>

      <!-- What each role covers, from the server. -->
      <section class="roles" aria-label="Roles">
        <article v-for="role in roles" :key="role.value" class="role-card">
          <div class="role-card__top">
            <span class="role-card__icon" :class="`role-card__icon--${role.value}`">
              <AssetIcon :name="ROLE_ICONS[role.value] || 'user-circle'" :size="18" />
            </span>
            <h2 class="role-card__title">{{ role.label }}</h2>
            <span class="role-card__count">{{ roleCount(role.value) }}</span>
          </div>
          <p class="role-card__desc">{{ role.description }}</p>
        </article>
      </section>

      <section class="panel" aria-labelledby="roster-title">
        <h2 id="roster-title" class="sr-only">Staff accounts</h2>

        <!-- The donors page's toolbar (project owner, 2026-10-30): filters left, actions right. -->
        <div class="toolbar">
          <div class="toolbar__filters">
            <label class="search">
              <AssetIcon name="search" :size="15" class="search__icon" />
              <input
                v-model="search"
                type="search"
                class="search__input"
                placeholder="Search name / email / title"
                aria-label="Search staff by name, email or title"
              >
            </label>

            <SelectField v-model="roleFilter" class="sel-filter" size="sm" aria-label="Filter by role"
              :options="[{ value: '', label: 'All roles' }, ...roles.map((role) => ({ value: role.value, label: role.label }))]" />

            <SelectField v-model="accountFilter" class="sel-filter" size="sm" aria-label="Filter by account"
              :options="ACCOUNT_FILTERS" />
          </div>

          <div class="toolbar__actions">
            <span v-if="updatedAt" class="updated" :title="`List loaded at ${updatedAtLabel}`">
              <AssetIcon name="clock" :size="13" />
              Updated {{ updatedAtLabel }}
            </span>

            <button
              type="button"
              class="btn-outline btn-outline--squeeze"
              :disabled="refreshing"
              aria-label="Refresh the list"
              :title="updatedAt ? `Refresh · updated ${updatedAtLabel}` : 'Refresh'"
              @click="refresh"
            >
              <AssetIcon name="refresh-cw" :size="14" :class="{ spin: refreshing }" />
              <span class="btn-text">Refresh</span>
            </button>

            <button type="button" class="btn-primary" @click="openAdd">
              <AssetIcon name="plus" :size="15" />
              Add Staff
            </button>
          </div>
        </div>

        <div class="table-wrap" :class="{ 'table-wrap--busy': refreshing && staff.length }">
          <table class="list-table">
            <caption class="sr-only">Your blood bank's staff accounts</caption>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Role</th>
                <th scope="col">Title</th>
                <th scope="col">Account</th>
                <th scope="col" class="c-actions">Actions</th>
              </tr>
            </thead>

            <tbody v-if="loading">
              <tr v-for="n in 4" :key="'skr-' + n">
                <td colspan="5"><span class="skeleton skeleton--line" /></td>
              </tr>
            </tbody>

            <tbody v-else-if="!visible.length">
              <tr>
                <td colspan="5" class="empty-cell">
                  <div class="empty-state">
                    <span class="empty-state__icon"><AssetIcon :name="hasFilters ? 'search-x' : 'users'" :size="20" /></span>
                    <p class="empty-state__title">{{ hasFilters ? 'No staff match' : 'No staff yet' }}</p>
                    <p class="empty-state__text">
                      {{ hasFilters ? 'Try another name, email or title, or clear the filters.' : 'Add your colleagues with the role their work needs.' }}
                    </p>
                    <button v-if="hasFilters" type="button" class="btn-outline" @click="clearFilters">Clear filters</button>
                    <button v-else type="button" class="btn-primary" @click="openAdd">
                      <AssetIcon name="plus" :size="15" />
                      Add Staff
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>

            <tbody v-else>
              <tr v-for="member in pageItems" :key="member.uuid" class="list-row" :class="{ 'row--removed': member.deleted_at }">
                <td>
                  <div class="cell">
                    <span class="cell__main">{{ member.full_name }}</span>
                    <span v-if="member.is_you" class="tag">You</span>
                    <span class="cell__sub">{{ member.email }}</span>
                  </div>
                </td>
                <td class="nowrap">{{ member.hospital_role_label || '—' }}</td>
                <td>{{ member.position || '—' }}</td>
                <td>
                  <span class="badge" :class="accountBadge(member)">
                    <span class="badge__dot" aria-hidden="true" />
                    {{ accountLabel(member) }}
                  </span>
                </td>
                <td class="c-actions">
                  <div class="row-actions">
                    <button
                      v-if="member.deleted_at"
                      type="button"
                      class="icon-btn"
                      :disabled="busy === member.uuid"
                      :aria-label="`Restore ${member.full_name}'s account`"
                      title="Restore"
                      @click="restore(member)"
                    >
                      <AssetIcon name="undo-2" :size="15" />
                    </button>
                    <template v-else>
                      <button
                        type="button"
                        class="icon-btn"
                        :disabled="busy === member.uuid"
                        :aria-label="`Edit ${member.full_name}`"
                        title="Edit role and title"
                        @click="openEdit(member)"
                      >
                        <AssetIcon name="pencil" :size="15" />
                      </button>
                      <button
                        type="button"
                        class="icon-btn icon-btn--danger"
                        :disabled="busy === member.uuid || member.is_you"
                        :aria-label="member.is_you ? 'Another Head can remove your account' : `Remove ${member.full_name}'s account`"
                        :title="member.is_you ? 'Another Head can remove your account' : 'Remove'"
                        @click="remove(member)"
                      >
                        <AssetIcon name="user-x" :size="15" />
                      </button>
                    </template>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <ListPager :page="page" :last-page="lastPage" :from="from" :to="to" :total="total" @go="go" />
      </section>
    </div>

    <!-- ADD STAFF -->
    <div v-if="adding" class="dialog-backdrop" @click.self="closeAdd">
      <form class="dialog" role="dialog" aria-modal="true" aria-labelledby="add-title" @submit.prevent="submitAdd">
        <header class="dialog__head">
          <h2 id="add-title" class="dialog__title">Add staff</h2>
          <button type="button" class="ui-btn ui-btn--icon ui-btn--sm" aria-label="Close" @click="closeAdd"><AssetIcon name="x" :size="16" /></button>
        </header>

        <div class="dialog__body">
          <div class="field-pair">
            <label class="field">
              <span class="field-label">First name</span>
              <input v-model.trim="form.first_name" class="field-input" required maxlength="150" autocomplete="off">
              <span v-if="errors.first_name" class="field-error">{{ errors.first_name }}</span>
            </label>
            <label class="field">
              <span class="field-label">Last name</span>
              <input v-model.trim="form.last_name" class="field-input" required maxlength="150" autocomplete="off">
              <span v-if="errors.last_name" class="field-error">{{ errors.last_name }}</span>
            </label>
          </div>

          <label class="field">
            <span class="field-label">Email</span>
            <input v-model.trim="form.email" type="email" class="field-input" required maxlength="150" autocomplete="off">
            <span v-if="errors.email" class="field-error">{{ errors.email }}</span>
          </label>

          <div class="field-pair">
            <label class="field">
              <span class="field-label">Mobile <span class="optional">(optional)</span></span>
              <input v-model.trim="form.phone" class="field-input" inputmode="tel" placeholder="09XX XXX XXXX" autocomplete="off">
              <span v-if="errors.phone" class="field-error">{{ errors.phone }}</span>
            </label>
            <label class="field">
              <span class="field-label">Title <span class="optional">(optional)</span></span>
              <input v-model.trim="form.position" class="field-input" maxlength="100" placeholder="e.g. RMT">
            </label>
          </div>

          <fieldset class="field">
            <legend class="field-label">Role</legend>
            <label v-for="role in roles" :key="role.value" class="role-option" :class="{ 'role-option--on': form.hospital_role === role.value }">
              <input v-model="form.hospital_role" type="radio" name="hospital_role" :value="role.value" required>
              <span>
                <strong>{{ role.label }}</strong>
                <span class="role-option__desc">{{ role.description }}</span>
              </span>
            </label>
            <span v-if="errors.hospital_role" class="field-error">{{ errors.hospital_role }}</span>
          </fieldset>

          <div class="field-pair">
            <label class="field">
              <span class="field-label">Password</span>
              <input v-model="form.password" type="password" class="field-input" required autocomplete="new-password">
              <span v-if="errors.password" class="field-error">{{ errors.password }}</span>
            </label>
            <label class="field">
              <span class="field-label">Confirm password</span>
              <input v-model="form.password_confirmation" type="password" class="field-input" required autocomplete="new-password">
            </label>
          </div>
          <p class="hint">At least 8 characters, with upper- and lower-case letters and a number. They verify their email before signing in.</p>

          <p v-if="addError" class="form-error" role="alert">{{ addError }}</p>
        </div>

        <footer class="dialog__foot">
          <button type="button" class="ui-btn" @click="closeAdd">Cancel</button>
          <button type="submit" class="ui-btn ui-btn--primary" :disabled="saving">{{ saving ? 'Adding…' : 'Add staff' }}</button>
        </footer>
      </form>
    </div>

    <!-- EDIT: a colleague's role and title (name and email are their own to change) -->
    <div v-if="editing" class="dialog-backdrop" @click.self="closeEdit">
      <form class="dialog" role="dialog" aria-modal="true" aria-labelledby="edit-title" @submit.prevent="submitEdit">
        <header class="dialog__head">
          <h2 id="edit-title" class="dialog__title">Edit {{ editing.full_name }}</h2>
          <button type="button" class="ui-btn ui-btn--icon ui-btn--sm" aria-label="Close" @click="closeEdit"><AssetIcon name="x" :size="16" /></button>
        </header>

        <div class="dialog__body">
          <div class="edit-who">
            <span class="edit-who__avatar">{{ initialsOf(editing.full_name) }}</span>
            <span class="edit-who__text">
              <strong>{{ editing.full_name }}</strong>
              <span>{{ editing.email }}</span>
            </span>
          </div>

          <label class="field">
            <span class="field-label">Title <span class="optional">(optional)</span></span>
            <input v-model.trim="editForm.position" class="field-input" maxlength="100" placeholder="e.g. RMT">
            <span v-if="editErrors.position" class="field-error">{{ editErrors.position }}</span>
          </label>

          <fieldset class="field">
            <legend class="field-label">Role</legend>
            <label v-for="role in roles" :key="role.value" class="role-option" :class="{ 'role-option--on': editForm.hospital_role === role.value }">
              <input v-model="editForm.hospital_role" type="radio" name="edit_hospital_role" :value="role.value" required>
              <span>
                <strong>{{ role.label }}</strong>
                <span class="role-option__desc">{{ role.description }}</span>
              </span>
            </label>
            <span v-if="editErrors.hospital_role" class="field-error">{{ editErrors.hospital_role }}</span>
          </fieldset>

          <p class="hint">Only the role and title can be changed here. Their name, email and mobile number stay as they signed up.</p>
          <p v-if="editError" class="form-error" role="alert">{{ editError }}</p>
        </div>

        <footer class="dialog__foot">
          <button type="button" class="ui-btn" @click="closeEdit">Cancel</button>
          <button type="submit" class="ui-btn ui-btn--primary" :disabled="savingEdit || !editChanged">{{ savingEdit ? 'Saving…' : 'Save changes' }}</button>
        </footer>
      </form>
    </div>

    <!-- REMOVE: confirmed here rather than in the browser's own box -->
    <div v-if="removing" class="dialog-backdrop" @click.self="removing = null">
      <div class="dialog dialog--sm" role="alertdialog" aria-modal="true" aria-labelledby="remove-title" aria-describedby="remove-desc">
        <div class="dialog__body dialog__body--confirm">
          <span class="confirm-icon"><AssetIcon name="user-x" :size="20" /></span>
          <h2 id="remove-title" class="dialog__title">Remove {{ removing.full_name }}'s account?</h2>
          <p id="remove-desc" class="confirm-text">They are signed out at once. You can restore it later.</p>
        </div>
        <footer class="dialog__foot">
          <button type="button" class="ui-btn" @click="removing = null">Cancel</button>
          <button type="button" class="ui-btn ui-btn--danger" @click="confirmRemove">Remove account</button>
        </footer>
      </div>
    </div>

    <transition name="toast">
      <div v-if="toast" class="toast" role="status">{{ toast }}</div>
    </transition>
  </div>
</template>

<script setup>
import PageHeader from '~/components/ui/PageHeader.vue'
/**
 * A hospital blood bank's staff, kept by its Head (project owner, 2026-10-11).
 *
 * The Head adds colleagues with a role, changes their role, and removes or
 * restores their accounts. The server keeps at least one Head and refuses
 * anything else; this page shows what it says.
 */
import AssetIcon from '~/components/common/AssetIcon.vue'
import ListPager from '~/components/common/ListPager.vue'
import { hospitalService } from '~/api/hospital/HospitalService'
import SelectField from '~/components/common/SelectField.vue'
import { useListPager } from '~/composables/useListPager'

definePageMeta({ middleware: ['auth', 'hospital-portal'], layout: 'hospitaldashboard', requires: 'hospital.staff.manage' })

useHead({ title: 'Staff' })

const staff = ref([])
const roles = ref([])
const loading = ref(true)
const refreshing = ref(false)
const loadError = ref('')
const busy = ref(null)
const updatedAt = ref(null)

// ── The list: searched and filtered here, since the server returns it whole ──
const ACCOUNT_FILTERS = [
  { value: '', label: 'All accounts' },
  { value: 'active', label: 'Active' },
  { value: 'unverified', label: 'Awaiting verification' },
  { value: 'removed', label: 'Removed' },
]

const search = ref('')
const roleFilter = ref('')
const accountFilter = ref('')

const hasFilters = computed(() => Boolean(search.value.trim() || roleFilter.value || accountFilter.value))

const visible = computed(() => {
  const term = search.value.trim().toLowerCase()

  return staff.value.filter((member) => {
    if (roleFilter.value && member.hospital_role !== roleFilter.value) return false
    if (accountFilter.value && accountKey(member) !== accountFilter.value) return false
    if (!term) return true

    return [member.full_name, member.email, member.position].some((value) => String(value || '').toLowerCase().includes(term))
  })
})

const { page, total, lastPage, from, to, pageItems, go } = useListPager(visible)

function clearFilters() {
  search.value = ''
  roleFilter.value = ''
  accountFilter.value = ''
}

const updatedAtLabel = computed(() => (updatedAt.value
  ? updatedAt.value.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  : ''))

async function refresh() {
  refreshing.value = true

  try {
    await load()
  } finally {
    refreshing.value = false
  }
}

const toast = ref('')
let toastTimer = null

function showToast(message) {
  toast.value = message
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 4000)
}

function firstError(err) {
  const first = Object.values(err?.errors ?? {})[0]

  return (Array.isArray(first) ? first[0] : first) || err?.message || 'That could not be done.'
}

async function load() {
  loadError.value = ''

  try {
    const response = await hospitalService.staff()
    staff.value = response?.data ?? []
    roles.value = response?.roles ?? []
    updatedAt.value = new Date()
  } catch (err) {
    loadError.value = err?.message || 'Could not load your staff.'
  } finally {
    loading.value = false
  }
}

function accountKey(member) {
  if (member.deleted_at) return 'removed'

  return member.email_verified ? 'active' : 'unverified'
}

function accountLabel(member) {
  return { removed: 'Removed', unverified: 'Awaiting email verification', active: 'Active' }[accountKey(member)]
}

function accountBadge(member) {
  return { removed: 'badge--neutral', unverified: 'badge--warn', active: 'badge--ok' }[accountKey(member)]
}

// ── Role cards ──
const ROLE_ICONS = {
  head: 'shield-check',
  inventory_staff: 'package',
  requesting_staff: 'clipboard-list',
}
// Active accounts in a role, for the card's count.
function roleCount(role) {
  const n = staff.value.filter((member) => !member.deleted_at && member.hospital_role === role).length
  return n === 1 ? '1 person' : `${n} people`
}

function initialsOf(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0][0]).toUpperCase()
}

// ── Edit: role and title, in one PATCH ──
const editing = ref(null)
const editForm = reactive({ hospital_role: '', position: '' })
const editErrors = reactive({})
const editError = ref('')
const savingEdit = ref(false)

const editChanged = computed(() => Boolean(editing.value) && (
  editForm.hospital_role !== editing.value.hospital_role
  || (editForm.position || '') !== (editing.value.position || '')
))

function openEdit(member) {
  editing.value = member
  editForm.hospital_role = member.hospital_role
  editForm.position = member.position || ''
  editError.value = ''
  for (const key of Object.keys(editErrors)) delete editErrors[key]
}

function closeEdit() {
  editing.value = null
}

async function submitEdit() {
  const member = editing.value
  if (!member || !editChanged.value) return

  savingEdit.value = true
  editError.value = ''
  for (const key of Object.keys(editErrors)) delete editErrors[key]

  // Only what changed, so a title edit cannot trip the last-Head rule.
  const payload = {}
  if (editForm.hospital_role !== member.hospital_role) payload.hospital_role = editForm.hospital_role
  if ((editForm.position || '') !== (member.position || '')) payload.position = editForm.position || null

  try {
    const response = await hospitalService.updateStaff(member.uuid, payload)
    Object.assign(member, response.data)
    showToast(response.message)
    editing.value = null
  } catch (err) {
    for (const [key, value] of Object.entries(err?.errors ?? {})) {
      editErrors[key] = Array.isArray(value) ? value[0] : value
    }
    editError.value = Object.keys(editErrors).length ? '' : firstError(err)
  } finally {
    savingEdit.value = false
  }
}

// The member waiting on the confirm dialog.
const removing = ref(null)

function remove(member) {
  removing.value = member
}

async function confirmRemove() {
  const member = removing.value
  removing.value = null
  if (!member) return

  busy.value = member.uuid

  try {
    const response = await hospitalService.removeStaff(member.uuid)
    showToast(response.message)
    await load()
  } catch (err) {
    showToast(firstError(err))
  } finally {
    busy.value = null
  }
}

async function restore(member) {
  busy.value = member.uuid

  try {
    const response = await hospitalService.restoreStaff(member.uuid)
    showToast(response.message)
    await load()
  } catch (err) {
    showToast(firstError(err))
  } finally {
    busy.value = null
  }
}

/* ADD STAFF */
const blank = () => ({
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  position: '',
  hospital_role: 'requesting_staff',
  password: '',
  password_confirmation: '',
})

const adding = ref(false)
const saving = ref(false)
const form = reactive(blank())
const errors = reactive({})
const addError = ref('')

function openAdd() {
  Object.assign(form, blank())
  Object.keys(errors).forEach((key) => delete errors[key])
  addError.value = ''
  adding.value = true
}

function closeAdd() {
  adding.value = false
}

async function submitAdd() {
  saving.value = true
  addError.value = ''
  Object.keys(errors).forEach((key) => delete errors[key])

  try {
    const response = await hospitalService.addStaff({
      ...form,
      phone: form.phone || null,
      position: form.position || null,
    })
    adding.value = false
    showToast(response.message)
    await load()
  } catch (err) {
    Object.entries(err?.errors ?? {}).forEach(([key, messages]) => {
      errors[key] = Array.isArray(messages) ? messages[0] : messages
    })
    addError.value = err?.status === 422 ? 'Check the highlighted fields.' : (err?.message || 'The account could not be added.')
  } finally {
    saving.value = false
  }
}

onMounted(load)

onUnmounted(() => clearTimeout(toastTimer))
</script>

<!-- The list: the blood centre's Donor Management structure (project owner, 2026-10-30). -->
<style scoped src="~/assets/css/list-ui.css"></style>

<style scoped>
.roles { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
.role-card { padding: 14px 16px; border-radius: var(--rb-radius-lg); border: 1px solid var(--rb-border); background: var(--rb-surface); box-shadow: var(--rb-shadow-sm); }
.role-card__top { display: flex; align-items: center; gap: 10px; }
.role-card__icon {
  display: flex; flex-shrink: 0; align-items: center; justify-content: center;
  width: 36px; height: 36px; border-radius: 11px;
  background: rgba(var(--rb-primary-rgb), 0.1); color: var(--rb-primary-text);
}
.role-card__icon--head { background: rgba(var(--rb-purple-rgb), 0.1); color: var(--rb-purple-text); }
.role-card__icon--inventory_staff { background: rgba(var(--rb-success-rgb), 0.1); color: var(--rb-success-text); }
.role-card__title { flex: 1; min-width: 0; margin: 0; font-size: 14px; font-weight: 700; }
.role-card__count {
  flex-shrink: 0; padding: 2px 9px; border-radius: 999px;
  background: var(--rb-surface-alt); color: var(--rb-text-secondary); font-size: 11.5px; font-weight: 600;
}
.role-card__desc { margin: 10px 0 0; font-size: 12.5px; line-height: 1.5; color: var(--rb-text-secondary); }

.edit-who {
  display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 12px;
  background: var(--rb-surface-alt);
}
.edit-who__avatar {
  display: flex; flex-shrink: 0; align-items: center; justify-content: center;
  width: 38px; height: 38px; border-radius: 12px; background: var(--rb-primary); color: #fff;
  font-size: 13px; font-weight: 800;
}
.edit-who__text { display: flex; flex-direction: column; min-width: 0; font-size: 12.5px; color: var(--rb-text-secondary); }
.edit-who__text strong { font-size: 14px; color: var(--rb-text-primary); }

.row--removed td { color: var(--rb-text-muted); }

.field { display: flex; flex-direction: column; gap: 4px; min-width: 0; border: 0; margin: 0; padding: 0; }
.field-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.field-label { font-size: 12.5px; font-weight: 600; }
.optional { font-weight: 400; color: var(--rb-text-muted); }
.field-input {
  height: 36px; padding: 0 10px; border-radius: 9px; border: 1px solid var(--rb-border-strong);
  font: inherit; font-size: 13px; color: var(--rb-text-primary); background: var(--rb-surface);
}
.field-input:focus { outline: none; border-color: var(--rb-primary); box-shadow: var(--rb-focus-ring); }
.field-error, .form-error { margin: 0; font-size: 12px; color: var(--rb-accent-text); }
.hint { margin: 0; font-size: 12px; color: var(--rb-text-secondary); }

.role-option { display: flex; gap: 10px; align-items: flex-start; padding: 8px 10px; border-radius: 10px; border: 1px solid var(--rb-border); cursor: pointer; }
.role-option + .role-option { margin-top: 6px; }
.role-option--on { border-color: var(--rb-primary); background: rgba(var(--rb-primary-rgb), .05); }
.role-option input { margin-top: 3px; }
.role-option strong { display: block; font-size: 13px; }
.role-option__desc { display: block; font-size: 12px; line-height: 1.4; color: var(--rb-text-secondary); }

.dialog-backdrop { position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; padding: 16px; background: rgba(15, 23, 42, .45); }
.dialog { width: min(560px, 100%); border: 1px solid var(--rb-border); max-height: calc(100dvh - 32px); display: flex; flex-direction: column; border-radius: 18px; background: var(--rb-surface); box-shadow: 0 20px 50px -12px rgba(15, 23, 42, .35); }
.dialog__head { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; border-bottom: 1px solid var(--rb-border); }
.dialog__title { margin: 0; font-size: 16px; font-weight: 700; }
.dialog__body { padding: 14px 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }
.dialog__foot { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 16px; border-top: 1px solid var(--rb-border); }

.toast {
  position: fixed; right: 18px; bottom: 18px; z-index: 70; max-width: 360px; padding: 10px 14px; border-radius: 10px;
  font-size: 13px; color: var(--rb-text-primary); background: var(--rb-surface); border: 1px solid var(--rb-border-strong);
  box-shadow: 0 6px 20px rgba(var(--rb-shadow-rgb), .12);
}
.toast-enter-active, .toast-leave-active { transition: opacity .2s; }
.toast-enter-from, .toast-leave-to { opacity: 0; }

@media (max-width: 640px) {
  .field-pair { grid-template-columns: 1fr; }
}

.dialog--sm { width: min(420px, 100%); }
.dialog__body--confirm { align-items: flex-start; gap: 6px; padding: 20px 20px 16px; }
.confirm-icon {
  display: flex; align-items: center; justify-content: center; width: 42px; height: 42px; margin-bottom: 6px;
  border-radius: 12px; background: rgba(var(--rb-accent-rgb), 0.1); color: var(--rb-accent-text);
}
.confirm-text { margin: 0; font-size: 13.5px; line-height: 1.5; color: var(--rb-text-secondary); }
</style>
