<template>
  <div class="admins">
    <div class="admins-inner">
      <!-- Header -->
      <div class="header-row">
        <div class="header-titles">
          <h1 class="page-title">Administrators</h1>
          <p class="page-subtitle">RedAgos staff accounts and what each one can reach.</p>
        </div>

        <div class="header-actions">
          <button type="button" class="btn-ghost" :disabled="busy" @click="load">
            <AssetIcon name="refresh-cw" :size="15" />
            <span class="btn-text">{{ busy ? 'Refreshing…' : 'Refresh' }}</span>
          </button>

          <button type="button" class="btn-primary" @click="openCreate">
            <AssetIcon name="circle-plus" :size="16" />
            <span class="btn-text">Add admin</span>
          </button>
        </div>
      </div>

      <p v-if="banner" class="banner" :class="`banner--${bannerKind}`">
        <AssetIcon :name="bannerKind === 'success' ? 'circle-check-big' : 'circle-alert'" :size="16" />
        {{ banner }}
      </p>

      <!-- Table -->
      <section class="panel">
        <header class="panel-header">
          <div>
            <h2 class="panel-title">Admin accounts</h2>
            <p class="panel-subtitle">
              {{ loading ? 'Loading…' : `${rows.length} account${rows.length === 1 ? '' : 's'}` }}
            </p>
          </div>
        </header>

        <div v-if="loading" class="loading-rows">
          <div v-for="n in 4" :key="n" class="loading-row">
            <div class="skeleton" style="height:32px;width:32px;border-radius:999px" />
            <div class="loading-row__body">
              <div class="skeleton" style="height:12px;width:38%" />
              <div class="skeleton" style="height:10px;width:54%" />
            </div>
          </div>
        </div>

        <div v-else-if="loadError" class="empty-state">
          <div class="empty-state__icon"><AssetIcon name="circle-alert" :size="22" /></div>
          <p class="empty-state__title">Could not load accounts</p>
          <p class="empty-state__text">{{ loadError }}</p>
        </div>

        <div v-else-if="!rows.length" class="empty-state">
          <div class="empty-state__icon"><AssetIcon name="shield-check" :size="22" /></div>
          <p class="empty-state__title">No admin accounts yet</p>
          <p class="empty-state__text">Add RedAgos staff and choose which modules each of them can reach.</p>
        </div>

        <div v-else class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th scope="col">Administrator</th>
                <th scope="col">Access level</th>
                <th scope="col">Privileges</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in rows" :key="row.uuid">
                <td data-label="Administrator">
                  <span class="person">
                    <span class="person__avatar">{{ nameOf(row).charAt(0) }}</span>
                    <span class="person__text">
                      <span class="person__name">
                        {{ nameOf(row) }}
                        <span v-if="row.uuid === user?.uuid" class="person__you">You</span>
                      </span>
                      <span class="person__email">{{ row.email }}</span>
                    </span>
                  </span>
                </td>

                <td data-label="Access level">
                  <span class="badge" :class="row.is_super_admin ? 'badge--accent' : 'badge--primary'">
                    {{ adminRoleLabel(roleOf(row)) }}
                  </span>
                </td>

                <td data-label="Privileges">
                  <span class="privs">
                    <span v-for="key in privilegesOf(row).slice(0, 2)" :key="key" class="badge badge--neutral">
                      {{ privilegeLabel(key) }}
                    </span>
                    <span v-if="privilegesOf(row).length > 2" class="privs__more"
                      :title="privilegesOf(row).map(privilegeLabel).join(', ')">
                      +{{ privilegesOf(row).length - 2 }}
                    </span>
                    <span v-if="!privilegesOf(row).length" class="muted">None granted</span>
                  </span>
                </td>

                <td data-label="Status">
                  <span class="badge" :class="statusTone(row.account_status)">
                    {{ statusLabel(row.account_status) }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <!-- Create modal -->
    <Teleport to="body">
      <div v-if="modalOpen" class="modal-layer" role="dialog" aria-modal="true" aria-label="Add administrator">
        <div class="overlay" @click="closeModal" />

        <div class="modal">
          <header class="modal__head">
            <div>
              <h2 class="modal__title">Add administrator</h2>
              <p class="modal__subtitle">A platform admin belongs to RedAgos, not to a facility.</p>
            </div>
            <button type="button" class="modal__close" aria-label="Close" @click="closeModal">
              <AssetIcon name="x" :size="18" />
            </button>
          </header>

          <div class="modal__body">
            <p v-if="form.error" class="banner banner--error">
              <AssetIcon name="circle-alert" :size="16" />
              {{ form.error }}
            </p>

            <div class="row row--split">
              <label class="group">
                <span class="label">First name <span class="req">*</span></span>
                <input v-model="form.first_name" type="text" class="input" placeholder="Paolo">
                <span v-if="fieldError('first_name')" class="field-error">{{ fieldError('first_name') }}</span>
              </label>

              <label class="group">
                <span class="label">Last name <span class="req">*</span></span>
                <input v-model="form.last_name" type="text" class="input" placeholder="Guzman">
                <span v-if="fieldError('last_name')" class="field-error">{{ fieldError('last_name') }}</span>
              </label>
            </div>

            <div class="row row--split">
              <label class="group">
                <span class="label">Email address <span class="req">*</span></span>
                <input v-model="form.email" type="email" class="input" placeholder="name@redagos.ph"
                  @blur="deriveUsername">
                <span v-if="fieldError('email')" class="field-error">{{ fieldError('email') }}</span>
              </label>

              <label class="group">
                <span class="label">Username <span class="req">*</span></span>
                <input v-model="form.username" type="text" class="input" placeholder="p.guzman">
                <span v-if="fieldError('username')" class="field-error">{{ fieldError('username') }}</span>
              </label>
            </div>

            <div class="row row--split">
              <label class="group">
                <span class="label">Temporary password <span class="req">*</span></span>
                <input v-model="form.password" type="text" class="input" placeholder="At least 8 characters">
                <span v-if="fieldError('password')" class="field-error">{{ fieldError('password') }}</span>
                <span v-else class="hint">Mixed case and a number. Share it with them directly.</span>
              </label>

              <label class="group">
                <span class="label">Confirm password <span class="req">*</span></span>
                <input v-model="form.password_confirmation" type="text" class="input">
                <button type="button" class="link-btn" @click="generatePassword">Generate a password</button>
              </label>
            </div>

            <p class="section">Access</p>

            <div class="row">
              <label class="group">
                <span class="label">Role <span class="req">*</span></span>
                <span class="select-wrap">
                  <select v-model="form.role" class="input select" @change="applyRole($event.target.value)">
                    <option v-if="canGrantSuper" value="super_admin">Super Administrator</option>
                    <option v-for="preset in presets" :key="preset.name" :value="preset.name">
                      {{ adminRoleLabel(preset.name) }}
                    </option>
                    <option value="custom">Custom</option>
                  </select>
                  <AssetIcon name="chevron-down" :size="14" class="select__caret" />
                </span>
                <span class="hint">{{ roleHint }}</span>
              </label>
            </div>

            <fieldset v-if="form.role !== 'super_admin'" class="fieldset">
              <legend class="label">
                Privileges <span class="req">*</span>
                <span class="label__count">{{ form.privileges.length }} of {{ privileges.length }}</span>
              </legend>

              <p class="section-hint">
                A role is a preset. Change any tick and the role becomes <strong>Custom</strong>, so what you
                see always matches what the account gets.
              </p>

              <div v-if="catalogueLoading" class="privileges">
                <div v-for="n in 4" :key="n" class="skeleton" style="height:56px;border-radius:12px" />
              </div>

              <div v-else class="privileges">
                <button v-for="privilege in privileges" :key="privilege.key" type="button" class="privilege"
                  :class="form.privileges.includes(privilege.key) ? 'privilege--on' : ''"
                  :aria-pressed="form.privileges.includes(privilege.key)" @click="togglePrivilege(privilege.key)">
                  <span class="privilege__box">
                    <AssetIcon v-if="form.privileges.includes(privilege.key)" name="check" :size="11" />
                  </span>
                  <span class="privilege__text">
                    <span class="privilege__label">{{ privilege.label }}</span>
                    <span class="privilege__hint">{{ privilege.description }}</span>
                  </span>
                </button>
              </div>

              <span v-if="fieldError('admin_privileges')" class="field-error">
                {{ fieldError('admin_privileges') }}
              </span>
            </fieldset>

            <p v-else class="note">
              <AssetIcon name="info" :size="15" class="note__icon" />
              <span>A Super Administrator holds every privilege, including the ability to create and rescope
                other administrators. Grant it sparingly.</span>
            </p>
          </div>

          <footer class="modal__foot">
            <button type="button" class="btn-ghost" :disabled="form.submitting" @click="closeModal">Cancel</button>
            <button type="button" class="btn-primary" :disabled="!canSubmit || form.submitting" @click="submit">
              {{ form.submitting ? 'Creating…' : 'Create admin' }}
            </button>
          </footer>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
/*
 * Platform admin accounts.
 *
 * Backed by `/users`, which is the admin account endpoint in everything but
 * name — the whole group sits behind role:admin plus can:admin.accounts.manage.
 *
 * The privilege catalogue is fetched from `/admin/privileges` rather than
 * hard-coded, so a privilege added to `App\Support\AdminPrivileges` appears in
 * this form without a client release and carries the label the gate enforces.
 *
 * Roles are presets over that catalogue, not a second permission system. Ticks
 * are the source of truth: `roleMatching()` re-derives the role name after each
 * toggle, so the select can never claim "Verification Officer" while the boxes
 * below say something else.
 */
import { computed, onActivated, onMounted, reactive, ref } from 'vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import { adminAccountService } from '~/api/admin/AdminAccountService'
import { useUser } from '~/composables/useUser'

definePageMeta({
  middleware: 'auth',
  layout: 'admindashboard',
  keepalive: true,
})

useHead({ title: 'Administrators · RedAgos Admin' })

const { user, ensureUser } = useUser()

const rows = ref([])
const loading = ref(true)
const refreshing = ref(false)
const loaded = ref(false)
// Either kind of in-flight load, for the Refresh control.
const busy = computed(() => loading.value || refreshing.value)
const loadError = ref('')
const banner = ref('')
const bannerKind = ref('success')

const privileges = ref([])
const presets = ref([])
const catalogueLoading = ref(true)

const modalOpen = ref(false)

const emptyForm = () => ({
  first_name: '',
  last_name: '',
  email: '',
  username: '',
  password: '',
  password_confirmation: '',
  role: 'verification_officer',
  privileges: [],
  submitting: false,
  error: '',
  errors: {},
})

const form = reactive(emptyForm())

/* Only an unrestricted account may confer unrestricted access. The server
   enforces this with a 422 on is_super_admin; hiding the option keeps a scoped
   admin from filling in a whole form only to be refused at the end. */
const canGrantSuper = computed(() => Boolean(user.value?.is_super_admin))

const roleHint = computed(() => {
  if (form.role === 'super_admin') return 'Unrestricted access to every module.'
  if (form.role === 'custom') return 'Privileges picked by hand.'

  const preset = presets.value.find((entry) => entry.name === form.role)

  return preset ? `${preset.privileges.length} privilege${preset.privileges.length === 1 ? '' : 's'} granted.` : ''
})

const canSubmit = computed(() => {
  const filled = form.first_name.trim() && form.last_name.trim() && form.email.trim()
    && form.username.trim() && form.password && form.password_confirmation

  if (!filled) return false

  return form.role === 'super_admin' || form.privileges.length > 0
})

const nameOf = (row) => row.full_name || [row.first_name, row.last_name].filter(Boolean).join(' ') || row.email

/** Roles arrive as objects from the index and as bare strings from create. */
const roleNames = (row) => (row.roles ?? []).map((role) => role?.name ?? role)

const privilegesOf = (row) => {
  if (row.is_super_admin) return privileges.value.map((privilege) => privilege.key)

  return Array.isArray(row.admin_privileges) ? row.admin_privileges : []
}

const roleOf = (row) => {
  if (row.is_super_admin) return 'super_admin'
  if (row.admin_role) return row.admin_role

  return matchPreset(privilegesOf(row))
}

const privilegeLabel = (key) =>
  privileges.value.find((privilege) => privilege.key === key)?.label ?? key

const fieldError = (field) => form.errors?.[field]?.[0] ?? ''

const STATUS_LABELS = {
  active: 'Active',
  pending_verification: 'Invited',
  suspended: 'Suspended',
  deactivated: 'Deactivated',
}

const statusLabel = (status) => STATUS_LABELS[status] ?? (status || 'Unknown')

const statusTone = (status) => {
  if (status === 'active') return 'badge--success'
  if (status === 'pending_verification') return 'badge--info'

  return 'badge--neutral'
}

/** The preset whose privilege set exactly matches, or null for "Custom". */
function matchPreset(selected) {
  const signature = [...new Set(selected)].sort().join('|')

  return presets.value.find(
    (preset) => [...new Set(preset.privileges)].sort().join('|') === signature
  )?.name ?? null
}

function applyRole(value) {
  form.role = value

  if (value === 'super_admin' || value === 'custom') return

  const preset = presets.value.find((entry) => entry.name === value)
  form.privileges = [...(preset?.privileges ?? [])]
}

function togglePrivilege(key) {
  const next = new Set(form.privileges)

  if (next.has(key)) next.delete(key)
  else next.add(key)

  form.privileges = [...next]
  form.role = matchPreset(form.privileges) ?? 'custom'
}

function deriveUsername() {
  if (form.username.trim() || !form.email.includes('@')) return

  form.username = form.email.split('@')[0].toLowerCase()
}

/*
 * Password::min(8)->mixedCase()->numbers() is the server rule, so the generated
 * value is built to satisfy it rather than left to chance in a random string.
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

function openCreate() {
  Object.assign(form, emptyForm())
  applyRole('verification_officer')
  modalOpen.value = true
}

function closeModal() {
  if (form.submitting) return
  modalOpen.value = false
}

async function loadCatalogue() {
  catalogueLoading.value = true

  try {
    const response = await adminAccountService.privileges()
    privileges.value = response?.privileges ?? []
    presets.value = response?.presets ?? []
    applyRole(form.role)
  } catch (err) {
    console.error('Failed to load the privilege catalogue:', err)
  } finally {
    catalogueLoading.value = false
  }
}

/*
 * `silent` keeps the cached page on screen while it refreshes.
 *
 * Without it the return trip flips `loading` on, the template swaps to
 * skeletons, and the keepalive cache buys nothing visible — the page still
 * appears to reload every time. A first visit and a filter change do want the
 * skeletons; a background refresh over content already on screen does not.
 */
async function load({ silent = false } = {}) {
  if (silent) refreshing.value = true
  else loading.value = true

  loadError.value = ''

  try {
    const response = await adminAccountService.list({ per_page: 100 })
    const data = response?.data ?? response
    const list = Array.isArray(data) ? data : (data?.data ?? [])

    // The endpoint is every user, not only admins. Donors and blood-centre
    // staff belong on their own screens, not in an admin roster.
    rows.value = list.filter((row) => roleNames(row).includes('admin'))
  } catch (err) {
    console.error('Failed to load administrators:', err)
    loadError.value = err?.data?.message || 'The request was refused. Check your connection and try again.'
  } finally {
    loading.value = false
    refreshing.value = false
    loaded.value = true
  }
}

async function submit() {
  if (!canSubmit.value || form.submitting) return

  form.submitting = true
  form.error = ''
  form.errors = {}

  const payload = {
    first_name: form.first_name.trim(),
    last_name: form.last_name.trim(),
    email: form.email.trim(),
    username: form.username.trim(),
    password: form.password,
    password_confirmation: form.password_confirmation,
    roles: ['admin'],
  }

  if (form.role === 'super_admin') payload.is_super_admin = true
  else payload.admin_privileges = form.privileges

  try {
    await adminAccountService.create(payload)

    modalOpen.value = false
    bannerKind.value = 'success'
    banner.value = `${payload.first_name} ${payload.last_name} was added as ${adminRoleLabel(form.role === 'custom' ? null : form.role)}.`

    await load()
  } catch (err) {
    // 422 carries per-field messages; anything else gets one line.
    form.errors = err?.data?.errors ?? {}
    form.error = form.errors && Object.keys(form.errors).length
      ? 'Check the highlighted fields.'
      : (err?.data?.message || 'The account could not be created.')
  } finally {
    form.submitting = false
  }
}

/*
 * onActivated, not onMounted: this page is keepalive'd, so the instance is
 * cached rather than destroyed when you navigate away and onMounted would run
 * exactly once per session. onActivated fires on the first mount *and* on every
 * return, which is what keeps a queue two admins are both working from going
 * stale behind the cached markup.
 */
/*
 * Two hooks on purpose.
 *
 * onMounted always fires and owns the first load, so the page can never sit on
 * its initial `loading = true` if KeepAlive is not in play for any reason.
 * onActivated fires only on a *return* to the cached instance — guarded on
 * `loaded` so the first mount, where Vue fires both, does not fetch twice.
 */
async function boot() {
  if (!user.value) await ensureUser()
  await Promise.all([loadCatalogue(), load({ silent: loaded.value })])
}

onMounted(boot)
onActivated(() => {
  if (loaded.value) boot()
})
</script>

<style scoped>
.admins {
  --primary: #1565c0;
  --accent: #d32f2f;
  --success: #2e7d32;
  --text-primary: #1f2937;
  --text-secondary: #94a3b8;
  --border: #eef1f5;
  --card-bg: #ffffff;

  max-width: 1280px;
  margin: 0 auto;
  padding: 24px 32px 40px;
}

.admins-inner { display: flex; flex-direction: column; gap: 22px; }

/* Header */
.header-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.header-titles { min-width: 0; }

.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: -0.03em;
  color: var(--text-primary);
}

.page-subtitle { margin: 6px 0 0; font-size: 13.5px; color: var(--text-secondary); }

.header-actions { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }

.btn-primary,
.btn-ghost {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 10px 18px;
  border-radius: 12px;
  border: 1px solid transparent;
  font-family: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.btn-primary { background: var(--primary); color: #fff; }
.btn-primary:hover:not(:disabled) { background: #0d47a1; }
.btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }

.btn-ghost { background: transparent; border-color: #e2e8f0; color: var(--text-secondary); }
.btn-ghost:hover:not(:disabled) { border-color: var(--primary); color: var(--primary); }
.btn-ghost:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-primary:focus-visible,
.btn-ghost:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }

.link-btn {
  align-self: flex-start;
  border: none;
  background: none;
  padding: 0;
  font-family: inherit;
  font-size: 11.5px;
  font-weight: 700;
  color: var(--primary);
  cursor: pointer;
}

.link-btn:hover { text-decoration: underline; }

.banner {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  padding: 12px 16px;
  border-radius: 12px;
  font-size: 12.5px;
  font-weight: 600;
}

.banner--success { background: rgba(46, 125, 50, 0.08); border: 1px solid rgba(46, 125, 50, 0.22); color: #2e7d32; }
.banner--error { background: rgba(211, 47, 47, 0.07); border: 1px solid rgba(211, 47, 47, 0.22); color: #b71c1c; }

/* Panel + table */
.panel {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  overflow: hidden;
}

.panel-header { padding: 16px 20px; border-bottom: 1px solid var(--border); }
.panel-title { margin: 0; font-size: 15px; font-weight: 800; letter-spacing: -0.01em; color: var(--text-primary); }
.panel-subtitle { margin: 3px 0 0; font-size: 12px; color: var(--text-secondary); }

.table-wrap { overflow-x: auto; }
.table { width: 100%; border-collapse: collapse; font-size: 12.5px; }

.table thead th {
  text-align: left;
  padding: 11px 20px;
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text-secondary);
  background: #fafbfc;
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}

.table tbody td { padding: 13px 20px; border-bottom: 1px solid var(--border); vertical-align: middle; }
.table tbody tr:last-child td { border-bottom: none; }
.table tbody tr:hover { background: #f8fafc; }

.person { display: flex; align-items: center; gap: 10px; min-width: 0; }

.person__avatar {
  width: 32px;
  height: 32px;
  border-radius: 999px;
  background: var(--primary);
  color: #fff;
  font-size: 12px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.person__text { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.person__name { display: flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 700; color: var(--text-primary); }
.person__email { font-size: 11.5px; color: var(--text-secondary); }

.person__you {
  font-size: 9.5px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 1px 6px;
  border-radius: 999px;
  background: #f1f5f9;
  color: #64748b;
}

.privs { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }

.privs__more {
  font-size: 10px;
  font-weight: 800;
  padding: 3px 7px;
  border-radius: 999px;
  background: #f1f5f9;
  color: #64748b;
  cursor: help;
}

.muted { font-size: 11.5px; color: var(--text-secondary); }

.badge {
  display: inline-block;
  font-size: 10px;
  font-weight: 800;
  padding: 3px 9px;
  border-radius: 999px;
  white-space: nowrap;
}

.badge--primary { background: rgba(21, 101, 192, 0.08); color: var(--primary); }
.badge--accent { background: rgba(211, 47, 47, 0.08); color: var(--accent); }
.badge--success { background: rgba(46, 125, 50, 0.09); color: var(--success); }
.badge--info { background: rgba(2, 136, 209, 0.1); color: #0277bd; }
.badge--neutral { background: #f1f5f9; color: #64748b; }

/* States */
.loading-rows { padding: 4px 0; }

.loading-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--border);
}

.loading-row:last-child { border-bottom: none; }
.loading-row__body { flex: 1; display: flex; flex-direction: column; gap: 7px; }

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 8px;
  padding: 42px 24px;
}

.empty-state__icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f1f5f9;
  color: var(--text-secondary);
  margin-bottom: 2px;
}

.empty-state__title { margin: 0; font-size: 13.5px; font-weight: 800; color: var(--text-primary); }
.empty-state__text { margin: 0; max-width: 38ch; font-size: 12.5px; line-height: 1.55; color: var(--text-secondary); }

.skeleton {
  background-image: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 37%, #e2e8f0 63%);
  background-size: 400% 100%;
  border-radius: 8px;
  animation: shimmer 1.4s ease infinite;
}

@keyframes shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}

@media (prefers-reduced-motion: reduce) { .skeleton { animation: none; } }

/* Modal */
.modal-layer {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  font-family: 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif;

  --primary: #1565c0;
  --accent: #d32f2f;
  --text-primary: #1f2937;
  --text-secondary: #94a3b8;
  --border: #eef1f5;
  --card-bg: #ffffff;
}

.overlay { position: absolute; inset: 0; background: rgba(15, 23, 42, 0.45); }

.modal {
  position: relative;
  width: 100%;
  max-width: 640px;
  max-height: calc(100vh - 48px);
  display: flex;
  flex-direction: column;
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: 0 24px 64px rgba(15, 23, 42, 0.28);
  overflow: hidden;
}

.modal__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 20px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.modal__title { margin: 0; font-size: 16px; font-weight: 800; letter-spacing: -0.01em; color: var(--text-primary); }
.modal__subtitle { margin: 3px 0 0; font-size: 12.5px; color: var(--text-secondary); }

.modal__close {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.modal__close:hover { background: #f8fafc; }

.modal__body { padding: 18px 20px 22px; overflow-y: auto; }

.modal__foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 20px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}

/* Form */
.row { margin-bottom: 14px; }
.row--split { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.group { display: flex; flex-direction: column; gap: 6px; min-width: 0; }

.label {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0;
  font-size: 10.5px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text-secondary);
}

.label__count {
  margin-left: auto;
  text-transform: none;
  letter-spacing: 0;
  font-size: 11px;
  color: var(--primary);
}

.req { color: var(--accent); }

.input {
  width: 100%;
  height: 38px;
  padding: 0 12px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
  font-family: inherit;
  font-size: 13px;
  color: var(--text-primary);
  outline: none;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.input::placeholder { color: var(--text-secondary); opacity: 1; }
.input:focus { border-color: var(--primary); background: #fff; }

.select-wrap { position: relative; display: block; }
.select { appearance: none; padding-right: 34px; cursor: pointer; font-weight: 600; }

.select__caret {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-secondary);
  pointer-events: none;
}

.hint { font-size: 11.5px; line-height: 1.5; color: var(--text-secondary); }
.field-error { font-size: 11.5px; font-weight: 700; color: var(--accent); }

.section {
  margin: 20px 0 12px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
  font-size: 12.5px;
  font-weight: 800;
  color: var(--text-primary);
}

.section-hint { margin: 6px 0 10px; font-size: 11.5px; line-height: 1.5; color: var(--text-secondary); }

.fieldset { border: none; margin: 0; padding: 0; }

.privileges { display: flex; flex-direction: column; gap: 8px; }

.privilege {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 11px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: transparent;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.privilege:hover { border-color: rgba(21, 101, 192, 0.35); }
.privilege--on { border-color: rgba(21, 101, 192, 0.4); background: rgba(21, 101, 192, 0.06); }

.privilege__box {
  width: 17px;
  height: 17px;
  border-radius: 5px;
  border: 1.5px solid #cbd5e1;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 1px;
  color: #fff;
}

.privilege--on .privilege__box { background: var(--primary); border-color: var(--primary); }

.privilege__text { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.privilege__label { font-size: 12.5px; font-weight: 700; color: var(--text-primary); }
.privilege__hint { font-size: 11.5px; line-height: 1.45; color: var(--text-secondary); }

.note {
  display: flex;
  gap: 10px;
  margin: 0;
  padding: 12px 14px;
  border: 1px solid rgba(21, 101, 192, 0.22);
  border-radius: 12px;
  background: rgba(21, 101, 192, 0.06);
  font-size: 12px;
  line-height: 1.55;
  color: var(--text-primary);
}

.note__icon { color: var(--primary); flex-shrink: 0; margin-top: 1px; }

/* Responsive */
@media (max-width: 900px) {
  .table thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  .table, .table tbody, .table tr, .table td { display: block; width: 100%; }
  .table tbody tr { padding: 14px 16px; border-bottom: 1px solid var(--border); }
  .table tbody tr:last-child { border-bottom: none; }

  .table tbody td {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 5px 0;
    border-bottom: none;
    text-align: right;
  }

  .table tbody td::before {
    content: attr(data-label);
    flex-shrink: 0;
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--text-secondary);
    text-align: left;
  }

  .table tbody td[data-label='Administrator'] { padding-bottom: 10px; }
  .table tbody td[data-label='Administrator']::before { display: none; }
  .privs { justify-content: flex-end; }
}

@media (max-width: 640px) {
  .admins { padding: 16px 16px 36px; }
  .header-actions { width: 100%; }
  .btn-primary, .btn-ghost { flex: 1; }
  .modal-layer { padding: 0; align-items: flex-end; }
  .modal { max-width: none; max-height: 92vh; border-radius: 18px 18px 0 0; }
  .row--split { grid-template-columns: 1fr; }
}

/* Dark mode */
:global(.dark .admins),
:global(.dark .modal-layer) {
  --text-primary: #f1f5f9;
  --text-secondary: #94a3b8;
  --border: #334155;
  --card-bg: #1e293b;
}

:global(.dark .table thead th) { background: #182234; }
:global(.dark .table tbody tr:hover) { background: #263449; }
:global(.dark .input) { background: #182234; border-color: #334155; }
:global(.dark .input:focus) { background: #1e293b; }
:global(.dark .privilege) { border-color: #334155; }
:global(.dark .privilege--on) { background: rgba(66, 165, 245, 0.16); }
:global(.dark .privilege__box) { border-color: #475569; }
:global(.dark .btn-ghost) { border-color: #334155; }
:global(.dark .modal__close:hover) { background: #263449; }
:global(.dark .badge--neutral),
:global(.dark .privs__more),
:global(.dark .person__you),
:global(.dark .empty-state__icon) { background: #334155; color: #94a3b8; }
:global(.dark .badge--primary) { background: rgba(66, 165, 245, 0.16); color: #64b5f6; }
:global(.dark .badge--accent) { background: rgba(239, 83, 80, 0.18); color: #ef9a9a; }
:global(.dark .badge--success) { background: rgba(76, 175, 80, 0.18); color: #81c784; }
:global(.dark .badge--info) { background: rgba(66, 165, 245, 0.16); color: #64b5f6; }
:global(.dark .banner--success) { background: rgba(76, 175, 80, 0.14); border-color: rgba(76, 175, 80, 0.3); color: #81c784; }
:global(.dark .banner--error) { background: rgba(239, 83, 80, 0.14); border-color: rgba(239, 83, 80, 0.3); color: #ef9a9a; }
:global(.dark .note) { background: rgba(66, 165, 245, 0.12); border-color: rgba(66, 165, 245, 0.3); }
:global(.dark .skeleton) { background-image: linear-gradient(90deg, #1e293b 25%, #334155 37%, #1e293b 63%); }
</style>
