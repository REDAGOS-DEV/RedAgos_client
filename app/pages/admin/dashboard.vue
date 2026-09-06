<template>
  <div class="dashboard">
    <div class="dashboard-inner">
      <!-- Header -->
      <div class="header-row">
        <div class="header-titles">
          <h1 class="page-title">Platform overview</h1>
          <p class="page-subtitle">{{ subtitle }}</p>
        </div>

        <div class="header-actions">
          <button type="button" class="btn-ghost" :disabled="busy" @click="load">
            <AssetIcon name="refresh-cw" :size="15" />
            <span class="btn-text">{{ busy ? 'Refreshing…' : 'Refresh' }}</span>
          </button>

          <NuxtLink v-if="can('admin.facility.manage')" to="/admin/facilities" class="btn-primary">
            <AssetIcon name="circle-plus" :size="16" />
            <span class="btn-text">New facility</span>
          </NuxtLink>
        </div>
      </div>

      <p v-if="loadError" class="banner banner--error">
        <AssetIcon name="circle-alert" :size="16" />
        {{ loadError }}
      </p>

      <!-- Metrics -->
      <div class="stats-grid">
        <template v-if="loading">
          <div v-for="n in metrics.length || 3" :key="n" class="stat-card stat-card--skeleton">
            <div class="skeleton" style="height:11px;width:52%" />
            <div class="skeleton" style="height:28px;width:38%" />
          </div>
        </template>

        <div v-for="metric in metrics" v-else :key="metric.key" class="stat-card">
          <div class="stat-card__top">
            <p class="stat-card__label">{{ metric.label }}</p>
            <div class="stat-card__badge" :class="`stat-card__badge--${metric.tone}`">
              <AssetIcon :name="metric.icon" :size="14" />
            </div>
          </div>
          <p class="stat-card__value">{{ metric.value }}</p>
          <span class="stat-chip" :class="`stat-chip--${metric.chipTone}`">{{ metric.caption }}</span>
        </div>
      </div>

      <div class="main-grid">
        <!--
          Legacy leftovers only, and hidden once they are gone.

          Facilities are created active by `POST /admin/facilities`; nothing
          today can land in pending_approval. These are the records the removed
          public self-registration flow left behind, kept so a Super Admin can
          clear them by hand. A standing "approvals" panel would describe a
          workflow that no longer exists and sit at zero forever.
        -->
        <section v-if="showLegacyApprovals" class="panel">
          <header class="panel-header">
            <div>
              <h2 class="panel-title">Legacy Registration Approvals</h2>
              <p class="panel-subtitle">
                {{ pendingFacilities.length }} left from the retired self-registration flow
              </p>
            </div>
            <NuxtLink to="/admin/facilities" class="panel-link">
              Clear them <AssetIcon name="chevron-right" :size="14" />
            </NuxtLink>
          </header>

          <ul class="queue">
            <li v-for="row in pendingFacilities" :key="row.id" class="queue-item">
              <span class="queue-icon" :class="`queue-icon--${row.facility_type}`">
                <AssetIcon :name="row.facility_type === 'blood_center' ? 'warehouse' : 'hospital'" :size="17" />
              </span>

              <div class="queue-body">
                <div class="queue-title-row">
                  <p class="queue-name">{{ row.name }}</p>
                  <span class="badge badge--warning">Pending</span>
                </div>
                <p class="queue-meta">
                  {{ row.facility_type_label || row.facility_type }}
                  <span class="dot">·</span>
                  <span v-if="row.doh_license_number" class="mono">{{ row.doh_license_number }}</span>
                  <span v-else class="missing">No DOH license on file</span>
                </p>
                <p class="queue-meta">{{ row.address }}</p>
              </div>

              <NuxtLink to="/admin/facilities" class="btn-ghost btn-ghost--sm">Review</NuxtLink>
            </li>
          </ul>
        </section>

        <!-- Donor ID queue -->
        <section v-if="can('admin.donor_identity.verify')" class="panel">
          <header class="panel-header">
            <div>
              <h2 class="panel-title">Donor ID Verification</h2>
              <p class="panel-subtitle">
                {{ loading ? 'Checking the queue…' : `${identities.length} submission${identities.length === 1 ? '' : 's'} waiting` }}
              </p>
            </div>
            <NuxtLink to="/admin/donor-identities" class="panel-link">
              Open queue <AssetIcon name="chevron-right" :size="14" />
            </NuxtLink>
          </header>

          <div v-if="loading" class="queue">
            <div v-for="n in 3" :key="n" class="queue-item">
              <div class="skeleton" style="height:38px;width:38px;border-radius:999px" />
              <div class="queue-skeleton">
                <div class="skeleton" style="height:13px;width:42%" />
                <div class="skeleton" style="height:11px;width:58%" />
              </div>
            </div>
          </div>

          <div v-else-if="!identities.length" class="empty-state">
            <div class="empty-state__icon">
              <AssetIcon name="id-card" :size="22" />
            </div>
            <p class="empty-state__title">No IDs waiting</p>
            <p class="empty-state__text">Donor submissions land here as soon as they upload.</p>
          </div>

          <ul v-else class="queue">
            <li v-for="row in identities" :key="row.uuid" class="queue-item">
              <span class="queue-avatar">{{ (row.full_name || '?').charAt(0) }}</span>

              <div class="queue-body">
                <div class="queue-title-row">
                  <p class="queue-name">{{ row.full_name || 'Donor' }}</p>
                  <span class="badge badge--info">{{ row.valid_id_type_label || row.valid_id_type || 'ID' }}</span>
                </div>
                <p class="queue-meta">{{ row.email }}</p>
              </div>

              <NuxtLink to="/admin/donor-identities" class="btn-ghost btn-ghost--sm">Review</NuxtLink>
            </li>
          </ul>
        </section>
      </div>

      <!-- Nothing granted -->
      <div v-if="!loading && !metrics.length && !loadError" class="empty-state empty-state--page">
        <div class="empty-state__icon">
          <AssetIcon name="lock" :size="22" />
        </div>
        <p class="empty-state__title">No modules assigned yet</p>
        <p class="empty-state__text">
          Your account holds no admin privileges. Ask a Super Administrator to grant the areas you need.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
/*
 * Super Admin overview.
 *
 * Every panel is gated on the privilege that guards its endpoints, and each
 * request is fired only when the account holds the matching grant. That is not
 * decoration: a Verification Officer calling /admin/facilities gets a 403, so
 * asking for it unconditionally would fill the page with errors it cannot act
 * on. What the account cannot read simply is not shown, and an account holding
 * nothing gets a page that says so rather than an empty grid.
 *
 * Counts come from the paginator's `total` rather than from the returned rows,
 * so a metric reads the real figure instead of the first page's length.
 */
import { computed, onActivated, onMounted, ref } from 'vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import { adminService } from '~/api/admin/AdminService'
import { donorIdentityService } from '~/api/admin/DonorIdentityService'
import { adminAccountService } from '~/api/admin/AdminAccountService'
import { useUser } from '~/composables/useUser'

definePageMeta({
  middleware: 'auth',
  layout: 'admindashboard',
  keepalive: true,
})

useHead({ title: 'Dashboard · RedAgos Admin' })

const { user, ensureUser } = useUser()

const loading = ref(true)
const refreshing = ref(false)
const loaded = ref(false)
// Either kind of in-flight load, for the Refresh control.
const busy = computed(() => loading.value || refreshing.value)
const loadError = ref('')

const facilityTotal = ref(0)
const pendingFacilities = ref([])
const identities = ref([])
const identityTotal = ref(0)
const adminTotal = ref(0)

const can = (privilege) => Boolean(user.value?.permissions?.includes(privilege))

/*
 * Only once leftovers are confirmed — deliberately not during loading.
 *
 * This panel exists for a queue that is draining to zero and then staying
 * there, so on almost every load there is nothing to show. Rendering its
 * skeleton while loading meant a card appeared, filled the row, and then
 * vanished — a phantom panel and a layout shift advertising a workflow that no
 * longer exists. Better to stay absent until there is something to say.
 */
const showLegacyApprovals = computed(
  () => can('admin.facility.approve') && !loading.value && pendingFacilities.value.length > 0
)

const subtitle = computed(() => {
  if (user.value?.is_super_admin) return 'Network health and every queue that needs a decision.'

  return 'The areas your account has been granted.'
})

/** Read a Laravel paginator's total, whatever shape the endpoint wraps it in. */
function totalOf(response, rows) {
  return response?.meta?.total ?? response?.total ?? rows.length
}

/** Rows out of a paginator, tolerating both wrapped and bare payloads. */
function rowsOf(response) {
  const data = response?.data ?? response
  return Array.isArray(data) ? data : (data?.data ?? [])
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

  const failures = []

  const tasks = []

  if (can('admin.facility.manage') || can('admin.facility.approve')) {
    tasks.push(
      adminService.list({ per_page: 100 })
        .then((response) => {
          const rows = rowsOf(response)
          facilityTotal.value = totalOf(response, rows)
          pendingFacilities.value = rows.filter((row) => row.status === 'pending_approval').slice(0, 5)
        })
        .catch(() => failures.push('facilities'))
    )
  }

  if (can('admin.donor_identity.verify')) {
    tasks.push(
      donorIdentityService.list({ status: 'pending', per_page: 5 })
        .then((response) => {
          const rows = rowsOf(response)
          identities.value = rows
          identityTotal.value = totalOf(response, rows)
        })
        .catch(() => failures.push('donor IDs'))
    )
  }

  if (can('admin.accounts.manage')) {
    tasks.push(
      adminAccountService.list({ per_page: 1 })
        .then((response) => {
          adminTotal.value = totalOf(response, rowsOf(response))
        })
        .catch(() => failures.push('administrators'))
    )
  }

  await Promise.all(tasks)

  if (failures.length) {
    loadError.value = `Could not load ${failures.join(' and ')}. Everything else on this page is current.`
  }

  loading.value = false
  refreshing.value = false
  loaded.value = true
}

/*
 * Only the cards the account can actually source. A metric built from an
 * endpoint the user is refused would read zero, which is worse than absent —
 * zero is a claim about the network, not about their access.
 */
const metrics = computed(() => {
  const cards = []

  if (can('admin.facility.manage') || can('admin.facility.approve')) {
    cards.push({
      key: 'facilities',
      label: 'Organizations',
      value: facilityTotal.value.toLocaleString('en-US'),
      icon: 'building-2',
      tone: 'primary',
      chipTone: 'neutral',
      caption: 'Blood centers and blood banks',
    })

    /*
     * Only while leftovers exist. A permanent "Pending Approvals: 0" would
     * claim there is an approval queue to watch; there isn't, because
     * facilities are created active and nothing can enter that state any more.
     */
    if (can('admin.facility.approve') && pendingFacilities.value.length) {
      cards.push({
        key: 'pending',
        label: 'Legacy Approvals',
        value: String(pendingFacilities.value.length),
        icon: 'clock',
        tone: 'warning',
        chipTone: 'warning',
        caption: 'From the retired signup flow',
      })
    }
  }

  if (can('admin.donor_identity.verify')) {
    cards.push({
      key: 'identities',
      label: 'Donor IDs Waiting',
      value: identityTotal.value.toLocaleString('en-US'),
      icon: 'id-card',
      tone: identityTotal.value ? 'warning' : 'success',
      chipTone: identityTotal.value ? 'warning' : 'success',
      caption: identityTotal.value ? 'Awaiting verification' : 'Nothing waiting',
    })
  }

  if (can('admin.accounts.manage')) {
    cards.push({
      key: 'admins',
      label: 'Platform Accounts',
      value: adminTotal.value.toLocaleString('en-US'),
      icon: 'shield-check',
      tone: 'secondary',
      chipTone: 'neutral',
      caption: 'Users on the platform',
    })
  }

  return cards
})

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
  // The privilege list decides which requests are even made, so the user has to
  // be resolved before the first one goes out.
  if (!user.value) await ensureUser()
  await load({ silent: loaded.value })
}

onMounted(boot)
onActivated(() => {
  if (loaded.value) boot()
})
</script>

<style scoped>
.dashboard {
  --primary: #1565c0;
  --accent: #d32f2f;
  --success: #2e7d32;
  --warning: #f57c00;
  --text-primary: #1f2937;
  --text-secondary: #94a3b8;
  --border: #eef1f5;
  --card-bg: #ffffff;

  max-width: 1280px;
  margin: 0 auto;
  padding: 24px 32px 40px;
}

.dashboard-inner {
  display: flex;
  flex-direction: column;
  gap: 22px;
}

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

.page-subtitle {
  margin: 6px 0 0;
  font-size: 13.5px;
  color: var(--text-secondary);
}

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
  text-decoration: none;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.btn-primary { background: var(--primary); color: #fff; }
.btn-primary:hover { background: #0d47a1; }

.btn-ghost {
  background: transparent;
  border-color: #e2e8f0;
  color: var(--text-secondary);
}

.btn-ghost:hover:not(:disabled) { border-color: var(--primary); color: var(--primary); }
.btn-ghost:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-ghost--sm { padding: 7px 13px; font-size: 12px; border-radius: 10px; flex-shrink: 0; }

.btn-primary:focus-visible,
.btn-ghost:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }

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

.banner--error {
  background: rgba(211, 47, 47, 0.07);
  border: 1px solid rgba(211, 47, 47, 0.22);
  color: #b71c1c;
}

/* Metrics */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}

.stat-card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 18px 20px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: border-color 0.15s ease;
}

.stat-card:hover { border-color: #e2e8f0; }
.stat-card--skeleton { min-height: 112px; justify-content: center; }

.stat-card__top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }

.stat-card__label {
  margin: 0;
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-secondary);
}

.stat-card__badge {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-card__badge--primary { background: rgba(21, 101, 192, 0.08); color: var(--primary); }
.stat-card__badge--secondary { background: rgba(66, 165, 245, 0.14); color: #0277bd; }
.stat-card__badge--success { background: rgba(46, 125, 50, 0.09); color: var(--success); }
.stat-card__badge--warning { background: rgba(245, 124, 0, 0.11); color: var(--warning); }

.stat-card__value {
  margin: 0;
  font-size: 28px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.03em;
  color: var(--text-primary);
}

.stat-chip {
  display: inline-flex;
  align-self: flex-start;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
}

.stat-chip--neutral { background: #f1f5f9; color: #64748b; }
.stat-chip--success { background: rgba(46, 125, 50, 0.1); color: var(--success); }
.stat-chip--warning { background: rgba(245, 124, 0, 0.11); color: #b45309; }

/* Panels */
.main-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
  gap: 22px;
  align-items: start;
}

.panel {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}

.panel-title {
  margin: 0;
  font-size: 15px;
  font-weight: 800;
  letter-spacing: -0.01em;
  color: var(--text-primary);
}

.panel-subtitle { margin: 3px 0 0; font-size: 12px; color: var(--text-secondary); }

.panel-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 800;
  color: var(--primary);
  text-decoration: none;
  flex-shrink: 0;
}

.panel-link:hover { text-decoration: underline; }

/* Queues */
.queue { list-style: none; margin: 0; padding: 0; }

.queue-item {
  display: flex;
  align-items: flex-start;
  gap: 13px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--border);
  transition: background-color 0.15s ease;
}

.queue-item:last-child { border-bottom: none; }
.queue-item:hover { background: #f8fafc; }

.queue-skeleton { flex: 1; display: flex; flex-direction: column; gap: 8px; }

.queue-icon,
.queue-avatar {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.queue-icon--blood_center { background: rgba(21, 101, 192, 0.08); color: var(--primary); }
.queue-icon--blood_bank { background: rgba(66, 165, 245, 0.14); color: #0277bd; }

.queue-avatar {
  border-radius: 999px;
  background: var(--primary);
  color: #fff;
  font-size: 14px;
  font-weight: 800;
}

.queue-body { flex: 1; min-width: 0; }

.queue-title-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

.queue-name { margin: 0; font-size: 13.5px; font-weight: 800; color: var(--text-primary); }

.queue-meta {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-secondary);
  overflow-wrap: anywhere;
}

.dot { margin: 0 5px; opacity: 0.6; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; }
.missing { font-weight: 700; color: #b45309; }

.badge {
  font-size: 10px;
  font-weight: 800;
  padding: 3px 9px;
  border-radius: 999px;
  white-space: nowrap;
}

.badge--warning { background: rgba(245, 124, 0, 0.11); color: #b45309; }
.badge--info { background: rgba(2, 136, 209, 0.1); color: #0277bd; }

/* Empty states */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 8px;
  padding: 42px 24px;
}

.empty-state--page {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 14px;
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

.empty-state__text {
  margin: 0;
  max-width: 38ch;
  font-size: 12.5px;
  line-height: 1.55;
  color: var(--text-secondary);
}

/* Skeleton */
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

@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none; }
}

@media (max-width: 640px) {
  .dashboard { padding: 16px 16px 36px; }
  .dashboard-inner { gap: 18px; }
  .main-grid { grid-template-columns: 1fr; gap: 18px; }
  .header-actions { width: 100%; }
  .btn-primary, .btn-ghost { flex: 1; }
}

/* Dark mode */
:global(.dark .dashboard) {
  --text-primary: #f1f5f9;
  --text-secondary: #94a3b8;
  --border: #334155;
  --card-bg: #1e293b;
}

:global(.dark .stat-card) { box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25); }
:global(.dark .stat-card:hover) { border-color: #475569; }
:global(.dark .queue-item:hover) { background: #263449; }
:global(.dark .btn-ghost) { border-color: #334155; }
:global(.dark .stat-chip--neutral),
:global(.dark .empty-state__icon) { background: #334155; color: #94a3b8; }
:global(.dark .stat-chip--success) { background: rgba(76, 175, 80, 0.18); color: #81c784; }
:global(.dark .stat-chip--warning),
:global(.dark .badge--warning) { background: rgba(245, 124, 0, 0.2); color: #ffb74d; }
:global(.dark .badge--info) { background: rgba(66, 165, 245, 0.16); color: #64b5f6; }
:global(.dark .missing) { color: #ffb74d; }
:global(.dark .panel-link) { color: #64b5f6; }
:global(.dark .banner--error) { background: rgba(239, 83, 80, 0.14); border-color: rgba(239, 83, 80, 0.3); color: #ef9a9a; }
:global(.dark .skeleton) { background-image: linear-gradient(90deg, #1e293b 25%, #334155 37%, #1e293b 63%); }
</style>
