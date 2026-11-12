<template>
  <div class="list-page">
    <div class="list-inner">
      <NuxtLink to="/blood-center/drives" class="back-link">
        <AssetIcon name="arrow-left" :size="14" />
        Donation Drives
      </NuxtLink>

      <PageHeader :title="drive?.name || 'Drive roster'">
        <template #actions>
          <button
            v-if="drive?.is_drive_day && canCheckIn"
            type="button"
            class="btn-primary"
            @click="openWalkIn"
          >
            <AssetIcon name="user-check" :size="15" />
            Walk-in
          </button>
        </template>
      </PageHeader>

      <div v-if="loadError" class="banner banner--error" role="alert">
        <AssetIcon name="circle-alert" :size="16" />
        <p class="banner__text">{{ loadError }}</p>
        <button type="button" class="btn-link" @click="refresh">Retry</button>
      </div>

      <!-- The link people register through -->
      <section v-if="drive" class="panel link-panel" aria-labelledby="link-title">
        <div class="link-panel__head">
          <h2 id="link-title" class="panel-title">Registration link</h2>
          <span class="badge" :class="badgeClass(linkTone)">
            <span class="badge__dot" aria-hidden="true" />
            {{ linkLabel }}
          </span>
        </div>
        <div v-if="linkUrl" class="link-row">
          <input ref="linkInput" class="link-input" :value="linkUrl" readonly aria-label="Registration link" @focus="$event.target.select()">
          <button type="button" class="btn-outline" @click="copyLink">
            <AssetIcon :name="copied ? 'check' : 'link'" :size="14" />
            {{ copied ? 'Copied' : 'Copy link' }}
          </button>
          <a :href="linkUrl" target="_blank" rel="noopener" class="btn-outline">
            <AssetIcon name="arrow-up-right" :size="14" />
            Open
          </a>
        </div>
        <p v-else class="link-blocked">Publish the drive on Donation Drives to share its link.</p>
      </section>

      <!-- Planning, kept apart from what happened on the day -->
      <section class="figures" aria-labelledby="planning-title">
        <h2 id="planning-title" class="figures__title">Planning</h2>
        <StatStrip :columns="3">
          <StatItem :loading="loading" label="Pre-registered donors" :value="summary.pre_registered_donors" :hint="planningHint" icon="users" tone="primary" />
          <StatItem :loading="loading" label="From partners" :value="summary.from_partners" icon="briefcase" tone="purple" />
          <StatItem :loading="loading" label="Withdrawn" :value="summary.withdrawn" icon="user-x" tone="neutral" />
        </StatStrip>
      </section>

      <section class="figures" aria-labelledby="day-title">
        <h2 id="day-title" class="figures__title">On the day</h2>
        <StatStrip :columns="5">
          <StatItem :loading="loading" label="Checked in" :value="summary.checked_in" icon="user-check" tone="primary" />
          <StatItem :loading="loading" label="Walk-ins" :value="summary.walk_ins" icon="users" tone="neutral" />
          <StatItem :loading="loading" label="No-show" :value="summary.no_show" icon="user-x" tone="danger" />
          <StatItem :loading="loading" label="Deferred" :value="summary.deferred" icon="clock" tone="warning" />
          <StatItem :loading="loading" label="Collected" :value="summary.collected" icon="droplets" tone="success" />
        </StatStrip>
      </section>

      <section class="panel" aria-labelledby="list-title">
        <h2 id="list-title" class="sr-only">Everyone on this drive</h2>
        <div class="toolbar">
          <div class="toolbar__filters">
            <label class="search">
              <AssetIcon name="search" :size="15" class="search__icon" />
              <input
                v-model="search"
                type="search"
                class="search__input"
                placeholder="Search name / email / number / organisation"
                aria-label="Search the roster"
              >
            </label>
            <SelectField v-model="statusFilter" class="sel-filter" size="sm" aria-label="Filter by status" :options="ROSTER_STATUS_FILTERS" />
            <SelectField v-model="sourceFilter" class="sel-filter" size="sm" aria-label="Filter by source" :options="ROSTER_SOURCE_FILTERS" />
          </div>
          <div class="toolbar__actions">
            <button type="button" class="btn-outline" :disabled="refreshing" aria-label="Refresh the roster" title="Refresh" @click="refresh">
              <AssetIcon name="refresh-cw" :size="14" :class="{ spin: refreshing }" />
              <span class="btn-text">Refresh</span>
            </button>
          </div>
        </div>

        <p v-if="actionError" class="banner banner--error action-error" role="alert">
          <AssetIcon name="circle-alert" :size="16" />
          <span class="banner__text">{{ actionError }}</span>
        </p>

        <div class="table-wrap" :class="{ 'table-wrap--busy': refreshing && rows.length }">
          <table class="list-table">
            <caption class="sr-only">Everyone this drive knows of</caption>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Source</th>
                <th scope="col">Self-check</th>
                <th scope="col">Status</th>
                <th scope="col">Donor</th>
                <th scope="col" class="c-actions">Actions</th>
              </tr>
            </thead>
            <tbody v-if="loading">
              <SkeletonRows :columns="6" :rows="5" />
            </tbody>
            <tbody v-else-if="!filtered.length">
              <tr>
                <td colspan="6" class="empty-cell">
                  <div class="empty-state">
                    <span class="empty-state__icon"><AssetIcon :name="hasFilters ? 'search-x' : 'users'" :size="20" /></span>
                    <p class="empty-state__title">{{ hasFilters ? 'Nobody matches' : 'Nobody yet' }}</p>
                    <p class="empty-state__text">
                      {{ hasFilters ? 'Try another name, or clear the filters.' : 'People appear here as they register through the link or book in the portal.' }}
                    </p>
                    <button v-if="hasFilters" type="button" class="btn-outline" @click="clearFilters">Clear filters</button>
                  </div>
                </td>
              </tr>
            </tbody>
            <tbody v-else>
              <tr v-for="row in pageItems" :key="row.key" class="list-row" :class="{ 'row--off': ['withdrawn', 'cancelled'].includes(row.status) || row.anonymised }">
                <td>
                  <div class="cell">
                    <span class="cell__main">{{ rosterName(row) }}</span>
                    <span v-if="contactLine(row)" class="cell__sub">{{ contactLine(row) }}</span>
                    <span v-if="row.affiliation" class="cell__sub">{{ row.affiliation }}</span>
                  </div>
                </td>
                <td>{{ row.source_label }}</td>
                <td class="nowrap">
                  <span class="check" :class="`check--${row.self_check}`">{{ selfCheckLabel(row.self_check) }}</span>
                </td>
                <td>
                  <span class="badge" :class="badgeClass(rosterTone(row.status))">
                    <span class="badge__dot" aria-hidden="true" />
                    {{ row.status_label }}
                  </span>
                </td>
                <td>
                  <div v-if="row.donor" class="cell">
                    <span class="cell__main mono">{{ row.donor.code }}</span>
                    <span class="cell__sub">{{ row.donor.name }}</span>
                  </div>
                  <div v-else-if="row.possible_donor" class="cell">
                    <span class="tag">Possible match</span>
                    <span class="cell__sub">{{ row.possible_donor.code }} · {{ row.possible_donor.name }}</span>
                  </div>
                  <span v-else class="muted">—</span>
                </td>
                <td class="c-actions">
                  <!-- Someone on the link's list -->
                  <div v-if="row.kind === 'listed'" class="row-actions">
                    <button
                      type="button"
                      class="icon-btn"
                      :disabled="!row.can.check_in || !canCheckIn || busyKey === row.key"
                      :aria-label="`Check in ${rosterName(row)}`"
                      :title="checkInTitle(row)"
                      @click="ask('check_in', row)"
                    >
                      <AssetIcon name="clipboard-check" :size="15" />
                    </button>
                    <button
                      v-if="row.donor"
                      type="button"
                      class="icon-btn"
                      :disabled="!row.can.unmatch || !canManage || busyKey === row.key"
                      :aria-label="`Unlink ${rosterName(row)} from ${row.donor.code}`"
                      title="Unlink from the donor"
                      @click="ask('unmatch', row)"
                    >
                      <AssetIcon name="undo-2" :size="15" />
                    </button>
                    <button
                      v-else-if="row.possible_donor"
                      type="button"
                      class="icon-btn"
                      :disabled="!row.can.match || !canManage || busyKey === row.key"
                      :aria-label="`Link ${rosterName(row)} to ${row.possible_donor.code}`"
                      :title="`Link to ${row.possible_donor.code}`"
                      @click="ask('match', row)"
                    >
                      <AssetIcon name="user-check" :size="15" />
                    </button>
                    <NuxtLink
                      v-else-if="row.can.register && canRegister"
                      :to="{ path: '/blood-center/donors', query: registerDonorQuery(driveId, row) }"
                      class="icon-btn"
                      :aria-label="`Register ${rosterName(row)} as a donor`"
                      title="Register as a donor"
                    >
                      <AssetIcon name="file-plus" :size="15" />
                    </NuxtLink>
                    <button
                      v-else
                      type="button"
                      class="icon-btn"
                      disabled
                      :aria-label="`No donor record for ${rosterName(row)}`"
                      title="No donor record to link"
                    >
                      <AssetIcon name="user-check" :size="15" />
                    </button>
                    <button
                      type="button"
                      class="icon-btn icon-btn--danger"
                      :disabled="!row.can.withdraw || !canManage || busyKey === row.key"
                      :aria-label="`Take ${rosterName(row)} off the list`"
                      :title="row.can.withdraw ? 'Take off the list' : 'Already off the list'"
                      @click="ask('withdraw', row)"
                    >
                      <AssetIcon name="user-x" :size="15" />
                    </button>
                  </div>
                  <!-- A booking: the counter checks the donor in and opens the visit -->
                  <div v-else-if="row.kind === 'booking'" class="row-actions">
                    <NuxtLink
                      v-if="row.can.open_counter && row.donor && canCheckIn"
                      :to="`/blood-center/donation?donor=${row.donor.uuid}`"
                      class="icon-btn"
                      :aria-label="`Open ${rosterName(row)} at the Donation counter`"
                      title="Open at the Donation counter"
                    >
                      <AssetIcon name="arrow-right" :size="15" />
                    </NuxtLink>
                    <span v-else class="muted">—</span>
                  </div>
                  <span v-else class="muted">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <ListPager :page="page" :last-page="lastPage" :from="from" :to="to" :total="total" @go="go" />
      </section>
    </div>

    <!-- Confirm: check in, link, unlink, or take off the list -->
    <div v-if="confirming" class="dialog-backdrop" @click.self="closeConfirm">
      <div
        v-focus-trap
        class="dialog dialog--sm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-text"
        @dialog-escape="closeConfirm"
      >
        <div class="dialog__body dialog__body--confirm">
          <span class="confirm-icon" :class="{ 'confirm-icon--info': confirming.kind !== 'withdraw' }">
            <AssetIcon :name="CONFIRM[confirming.kind].icon" :size="20" />
          </span>
          <h2 id="confirm-title" class="dialog__title">{{ CONFIRM[confirming.kind].title(confirming.row) }}</h2>
          <p id="confirm-text" class="confirm-text">{{ CONFIRM[confirming.kind].text(confirming.row) }}</p>
          <p v-if="confirmError" class="confirm-error" role="alert">{{ confirmError }}</p>
        </div>
        <footer class="dialog__foot">
          <button type="button" class="ui-btn" @click="closeConfirm">Cancel</button>
          <button
            type="button"
            class="ui-btn"
            :class="confirming.kind === 'withdraw' ? 'ui-btn--danger' : 'ui-btn--primary'"
            :disabled="busyKey === confirming.row.key"
            @click="confirmAction"
          >
            {{ CONFIRM[confirming.kind].action }}
          </button>
        </footer>
      </div>
    </div>

    <!-- Walk-in: find the donor exactly, then check them in -->
    <div v-if="walkIn.open" class="dialog-backdrop" @click.self="closeWalkIn">
      <div
        v-focus-trap
        class="dialog dialog--sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="walkin-title"
        @dialog-escape="closeWalkIn"
      >
        <header class="dialog__head">
          <h2 id="walkin-title" class="dialog__title">Walk-in</h2>
          <button type="button" class="icon-btn" aria-label="Close" @click="closeWalkIn">
            <AssetIcon name="x" :size="16" />
          </button>
        </header>
        <form class="dialog__body" @submit.prevent="findWalkIn">
          <div class="walkin-find">
            <SelectField v-model="walkIn.type" size="sm" aria-label="Find by" :options="LOOKUP_TYPES" />
            <input v-model="walkIn.value" class="walkin-input" :aria-label="lookupLabel" :placeholder="lookupLabel" maxlength="150">
            <button type="submit" class="btn-outline" :disabled="walkIn.finding || !walkIn.value.trim()">
              <AssetIcon name="search" :size="14" />
              Find
            </button>
          </div>
          <div v-if="walkIn.found" class="walkin-found">
            <span class="cell__main">{{ walkIn.found.full_name }}</span>
            <span class="cell__sub mono">{{ walkIn.found.donor_code }}</span>
          </div>
          <p v-if="walkIn.error" class="confirm-error" role="alert">{{ walkIn.error }}</p>
        </form>
        <footer class="dialog__foot">
          <button type="button" class="ui-btn" @click="closeWalkIn">Cancel</button>
          <button type="button" class="ui-btn ui-btn--primary" :disabled="!walkIn.found || walkIn.saving" @click="checkInWalkIn">
            {{ walkIn.saving ? 'Checking in…' : 'Check in' }}
          </button>
        </footer>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * One drive's roster (drive pre-registration; project owner, 2026-11-11 and
 * 2026-11-12). Everyone the drive knows of, one row each: the link's list,
 * bookings made in the portal or by the desk, walk-ins, and donations typed in
 * from its paper sheets. Staff share the link, link list entries to donor
 * records, take people off the list, and on the drive's day check people in
 * (the counter then takes over). They do not type people onto the list.
 *
 * Planning (pre-registered donors) is kept apart from what happened on the
 * day, which comes only from the appointments and donations themselves. The
 * self-check is a status from the donor's own portal questionnaire, never an
 * answer.
 */
import { computed, onMounted, reactive, ref } from 'vue'

import AssetIcon from '~/components/common/AssetIcon.vue'
import ListPager from '~/components/common/ListPager.vue'
import SelectField from '~/components/common/SelectField.vue'
import PageHeader from '~/components/ui/PageHeader.vue'
import SkeletonRows from '~/components/ui/SkeletonRows.vue'
import StatItem from '~/components/ui/StatItem.vue'
import StatStrip from '~/components/ui/StatStrip.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import { useListPager } from '~/composables/useListPager'
import { badgeClass } from '~/utils/listBadge'
import { formatPhoneNumber } from '~/utils/phone'
import {
  ROSTER_SOURCE_FILTERS,
  ROSTER_STATUS_FILTERS,
  driveLinkUrl,
  filterRoster,
  registerDonorQuery,
  rosterName,
  rosterTone,
  selfCheckLabel,
} from '~/utils/driveRegistration'

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  requires: 'drives.manage',
})

const route = useRoute()
const driveId = computed(() => String(route.params.id ?? ''))

const { can } = useUser()
const canManage = computed(() => can('drives.manage'))
const canCheckIn = computed(() => can('appointments.verify'))
const canRegister = computed(() => can('donors.manage'))

const loading = ref(true)
const refreshing = ref(false)
const loadError = ref('')
const actionError = ref('')
const busyKey = ref(null)

const drive = ref(null)
const summary = reactive({
  pre_registered_donors: 0, listed: 0, booked: 0, from_partners: 0, withdrawn: 0,
  walk_ins: 0, checked_in: 0, no_show: 0, deferred: 0, collected: 0, cancelled: 0,
})
const rows = ref([])

const search = ref('')
const statusFilter = ref('')
const sourceFilter = ref('')
const hasFilters = computed(() => Boolean(search.value.trim() || statusFilter.value || sourceFilter.value))
const filtered = computed(() => filterRoster(rows.value, search.value, statusFilter.value, sourceFilter.value))
const { page, total, lastPage, from, to, pageItems, go } = useListPager(filtered)

function clearFilters() {
  search.value = ''
  statusFilter.value = ''
  sourceFilter.value = ''
}

const planningHint = computed(() => `${summary.listed} on the list · ${summary.booked} booked`)

/* ---------- The link ---------- */

const linkUrl = computed(() => (import.meta.client ? driveLinkUrl(window.location.origin, drive.value?.registration_token) : ''))
const copied = ref(false)
const linkInput = ref(null)

const linkLabel = computed(() => {
  const status = drive.value?.status
  if (status === 'Draft') return 'Not published'
  if (status === 'Cancelled') return 'Cancelled'
  if (status === 'Completed') return 'Drive held'
  return drive.value?.registration_open ? 'Open' : 'Closed'
})

const linkTone = computed(() => (linkLabel.value === 'Open' ? 'ok' : linkLabel.value === 'Cancelled' ? 'crit' : 'neutral'))

async function copyLink() {
  try {
    await navigator.clipboard.writeText(linkUrl.value)
  } catch {
    // No clipboard (an http page, an old browser): leave it selected to copy by hand.
    linkInput.value?.select()
    return
  }
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}

/* ---------- Loading ---------- */

async function load() {
  loadError.value = ''
  try {
    const data = await bloodCenterService.driveRegistrations(driveId.value)
    drive.value = data.drive
    Object.assign(summary, data.summary ?? {})
    rows.value = data.data ?? []
  } catch (err) {
    loadError.value = err?.message || 'Could not load this drive\'s roster. Please try again.'
  } finally {
    loading.value = false
  }
}

async function refresh() {
  refreshing.value = true
  await load()
  refreshing.value = false
}

/* ---------- Row actions ---------- */

function contactLine(row) {
  return [formatPhoneNumber(row.phone), row.email].filter(Boolean).join(' · ')
}

function checkInTitle(row) {
  if (row.can.check_in) return 'Check in'
  if (!drive.value?.is_drive_day) return 'On the drive\'s day'
  if (!row.donor) return 'Link to a donor record first'
  return 'Not on the list'
}

const CONFIRM = {
  check_in: {
    icon: 'clipboard-check',
    title: (row) => `Check in ${rosterName(row)}?`,
    text: (row) => `As ${row.donor?.code}. The Donation counter opens next.`,
    action: 'Check in',
  },
  match: {
    icon: 'user-check',
    title: (row) => `Link ${rosterName(row)} to ${row.possible_donor?.code}?`,
    text: (row) => `${row.possible_donor?.name} has the same email or mobile number. Link only if this is the same person.`,
    action: 'Link to donor',
  },
  unmatch: {
    icon: 'undo-2',
    title: (row) => `Unlink ${rosterName(row)} from ${row.donor?.code}?`,
    text: () => 'The entry stays on the list without a donor.',
    action: 'Unlink',
  },
  withdraw: {
    icon: 'user-x',
    title: (row) => `Take ${rosterName(row)} off the list?`,
    text: () => 'They can register again through the link.',
    action: 'Take off the list',
  },
}

const confirming = ref(null)
const confirmError = ref('')

function ask(kind, row) {
  confirming.value = { kind, row }
  confirmError.value = ''
  actionError.value = ''
}

function closeConfirm() {
  if (busyKey.value) return
  confirming.value = null
  confirmError.value = ''
}

async function confirmAction() {
  const { kind, row } = confirming.value
  busyKey.value = row.key
  confirmError.value = ''
  try {
    if (kind === 'check_in') {
      const res = await bloodCenterService.checkInDriveRegistration(driveId.value, row.entry_id)
      busyKey.value = null
      confirming.value = null
      // The counter brings the donor up on the booking just made.
      await navigateTo(`/blood-center/donation?donor=${res?.data?.donor_uuid}`)
      return
    }
    const calls = {
      match: () => bloodCenterService.matchDriveRegistration(driveId.value, row.entry_id, row.possible_donor.uuid),
      unmatch: () => bloodCenterService.unmatchDriveRegistration(driveId.value, row.entry_id),
      withdraw: () => bloodCenterService.withdrawDriveRegistration(driveId.value, row.entry_id),
    }
    await calls[kind]()
    busyKey.value = null
    confirming.value = null
    // The figures move with the row, so reload both.
    await load()
  } catch (err) {
    // Shown in the dialog, where the question was asked.
    confirmError.value = err?.message || 'Could not change this entry. Please try again.'
  } finally {
    busyKey.value = null
  }
}

/* ---------- Walk-in ---------- */

const LOOKUP_TYPES = [
  { value: 'donor_code', label: 'Donor code' },
  { value: 'phone', label: 'Mobile number' },
  { value: 'email', label: 'Email' },
  { value: 'valid_id_number', label: 'Valid ID number' },
]

const walkIn = reactive({ open: false, type: 'donor_code', value: '', found: null, finding: false, saving: false, error: '' })
const lookupLabel = computed(() => LOOKUP_TYPES.find((t) => t.value === walkIn.type)?.label ?? 'Identifier')

function openWalkIn() {
  Object.assign(walkIn, { open: true, type: 'donor_code', value: '', found: null, finding: false, saving: false, error: '' })
}

function closeWalkIn() {
  if (walkIn.saving) return
  walkIn.open = false
}

async function findWalkIn() {
  walkIn.finding = true
  walkIn.error = ''
  walkIn.found = null
  try {
    const found = await bloodCenterService.lookupDonor({ type: walkIn.type, value: walkIn.value.trim() })
    walkIn.found = found?.uuid ? found : null
    if (!walkIn.found) walkIn.error = 'No donor matches that.'
  } catch (err) {
    walkIn.error = err?.message || 'No donor matches that.'
  } finally {
    walkIn.finding = false
  }
}

async function checkInWalkIn() {
  if (!walkIn.found) return
  walkIn.saving = true
  walkIn.error = ''
  try {
    const res = await bloodCenterService.driveWalkIn(driveId.value, walkIn.found.uuid)
    walkIn.saving = false
    walkIn.open = false
    await navigateTo(`/blood-center/donation?donor=${res?.data?.donor_uuid}`)
  } catch (err) {
    walkIn.error = err?.message || 'Could not check this donor in. Please try again.'
  } finally {
    walkIn.saving = false
  }
}

onMounted(load)
</script>

<style scoped src="~/assets/css/list-ui.css"></style>

<style scoped>
.back-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  align-self: flex-start;
  font-size: 13px;
  font-weight: 600;
  color: var(--rb-text-secondary);
  text-decoration: none;
}

.back-link:hover { color: var(--rb-text-primary); }

.link-panel { padding: 16px 18px; display: flex; flex-direction: column; gap: 12px; }
.link-panel__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }

.link-row { display: flex; align-items: center; gap: 8px; }

.link-input {
  flex: 1;
  min-width: 0;
  height: 38px;
  padding: 0 12px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  background: var(--rb-surface-alt);
  color: var(--rb-text-primary);
  font-family: var(--rb-font-mono, ui-monospace, monospace);
  font-size: 12.5px;
}

.link-input:focus { outline: none; border-color: var(--rb-primary); box-shadow: var(--rb-focus-ring); }
a.btn-outline { text-decoration: none; }
.link-blocked { margin: 0; font-size: 13px; color: var(--rb-text-secondary); }

.figures { display: flex; flex-direction: column; gap: 8px; }

.figures__title {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--rb-text-secondary);
}

.action-error { margin: 12px 16px 0; }

.row--off .cell__main { color: var(--rb-text-secondary); }

.check { font-size: 13px; font-weight: 600; }
.check--cleared { color: var(--rb-success-text); }
.check--follow_up { color: var(--rb-warning-text); }
.check--not_completed { color: var(--rb-text-secondary); font-weight: 500; }

a.icon-btn { text-decoration: none; }

.dialog-backdrop { position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; padding: 16px; background: rgba(15, 23, 42, .45); }
.dialog { width: min(560px, 100%); border: 1px solid var(--rb-border); max-height: calc(100dvh - 32px); display: flex; flex-direction: column; border-radius: 18px; background: var(--rb-surface); box-shadow: 0 20px 50px -12px rgba(15, 23, 42, .35); }
.dialog--sm { width: min(440px, 100%); }
.dialog__head { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; border-bottom: 1px solid var(--rb-border); }
.dialog__title { margin: 0; font-size: 16px; font-weight: 700; }
.dialog__body { padding: 14px 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }
.dialog__body--confirm { align-items: flex-start; gap: 6px; padding: 20px 20px 16px; }
.dialog__foot { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 16px; border-top: 1px solid var(--rb-border); }

.confirm-icon {
  display: flex; align-items: center; justify-content: center; width: 42px; height: 42px; margin-bottom: 6px;
  border-radius: 12px; background: rgba(var(--rb-accent-rgb), 0.1); color: var(--rb-accent-text);
}

.confirm-icon--info { background: rgba(var(--rb-primary-rgb), 0.1); color: var(--rb-primary-text); }
.confirm-text { margin: 0; font-size: 13.5px; line-height: 1.5; color: var(--rb-text-secondary); }
.confirm-error { margin: 6px 0 0; font-size: 13px; color: var(--rb-accent-text); }

.walkin-find { display: grid; grid-template-columns: 150px minmax(0, 1fr) auto; gap: 8px; align-items: center; }

.walkin-input {
  height: 36px;
  min-width: 0;
  padding: 0 10px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 9px;
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  font-family: inherit;
  font-size: 13px;
}

.walkin-input:focus { outline: none; border-color: var(--rb-primary); box-shadow: var(--rb-focus-ring); }

.walkin-found {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  border: 1px solid var(--rb-border);
  border-radius: 10px;
  background: var(--rb-surface-alt);
}

@media (max-width: 640px) {
  .link-row { flex-wrap: wrap; }
  .link-input { flex-basis: 100%; }
  .walkin-find { grid-template-columns: 1fr; }
}
</style>
