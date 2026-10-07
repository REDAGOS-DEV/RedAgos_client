<template>
  <div class="donors-page">
    <!-- Skeleton loading state, the same as the other pages -->
    <div v-if="initialLoading" class="donors-inner" aria-busy="true" aria-label="Loading donors">
      <div class="skeleton-head">
        <div class="skeleton skeleton--header" />
        <div class="skeleton skeleton--sub" />
      </div>
      <div class="stats-row">
        <div v-for="n in 3" :key="'skc-' + n" class="skeleton skeleton--card" />
      </div>
      <div class="skeleton skeleton--panel" style="height: 460px" />
    </div>

    <!-- ============ LIST VIEW ============ -->
    <div v-else-if="!selectedUuid" class="donors-inner">
      <header class="header-row">
        <div>
          <h1 class="page-title">Donors</h1>
          <p class="page-subtitle">{{ listSummary }}</p>
        </div>
        <button v-if="canManage" type="button" class="btn-primary" @click="openAddDonor">
          <AssetIcon name="plus" :size="15" />
          Register walk-in
        </button>
      </header>

      <div v-if="loadError" class="error-banner" role="alert">
        <span>{{ loadError }}</span>
        <button type="button" class="btn-link" @click="loadDonors()">Retry</button>
      </div>

      <div v-if="listNotice" class="success-banner" role="status">
        <AssetIcon name="circle-check-big" :size="16" />
        <p class="success-banner__text">{{ listNotice }}</p>
        <button type="button" class="btn-link" @click="listNotice = ''">Dismiss</button>
      </div>

      <!-- KPI cards, as on Inventory -->
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-card__top">
            <p class="stat-card__label">Total Donors</p>
            <span class="stat-card__badge stat-card__badge--primary"><AssetIcon name="users" :size="14" /></span>
          </div>
          <p class="stat-card__value">{{ pager.total }}</p>
          <span class="stat-chip">Booked or donated here</span>
        </div>
        <div class="stat-card">
          <div class="stat-card__top">
            <p class="stat-card__label">Eligible Now</p>
            <span class="stat-card__badge stat-card__badge--success"><AssetIcon name="shield-check" :size="14" /></span>
          </div>
          <p class="stat-card__value">{{ eligibleCount }}</p>
          <span class="stat-chip">Of the {{ donors.length }} shown</span>
        </div>
        <div class="stat-card">
          <div class="stat-card__top">
            <p class="stat-card__label">Waiting Period</p>
            <span class="stat-card__badge stat-card__badge--warning"><AssetIcon name="calendar" :size="14" /></span>
          </div>
          <p class="stat-card__value">{{ waitingCount }}</p>
          <span class="stat-chip">Not yet due to donate again</span>
        </div>
      </div>

      <section class="panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">Donor records</h2>
            <p class="panel-subtitle">Sorted by last name.</p>
          </div>
        </div>

        <!-- Search is the server's; eligibility narrows the page shown. -->
        <div class="toolbar">
          <label class="search">
            <AssetIcon name="search" :size="15" class="search__icon" />
            <input
              v-model="search"
              type="search"
              class="search__input"
              placeholder="Search name, donor ID, phone or email"
              aria-label="Search donors"
              @input="onSearchInput"
            >
          </label>

          <select
            v-if="bloodTypeOptions.length"
            v-model="bloodTypeId"
            class="select"
            aria-label="Filter by blood type"
            @change="loadDonors()"
          >
            <option value="">All blood types</option>
            <option v-for="bt in bloodTypeOptions" :key="bt.id" :value="bt.id">{{ bt.code }}</option>
          </select>

          <div class="chips" role="group" aria-label="Filter by eligibility">
            <button
              v-for="chip in eligibilityChips"
              :key="chip.value"
              type="button"
              class="chip"
              :class="{ 'chip--on': eligibilityFilter === chip.value }"
              :aria-pressed="eligibilityFilter === chip.value"
              @click="eligibilityFilter = chip.value"
            >
              {{ chip.label }}
              <span class="chip__count">{{ chip.count }}</span>
            </button>
          </div>
        </div>

        <div class="table" :class="{ 'table--contact': contactOnly }">
          <div class="row row--head">
            <span>Donor</span>
            <span v-if="!contactOnly">Blood type</span>
            <span>Contact</span>
            <span class="num">Donations</span>
            <span>Last donation</span>
            <span>Eligibility</span>
            <span aria-hidden="true" />
          </div>

          <template v-if="loadingDonors">
            <div v-for="n in 6" :key="'skr-' + n" class="row row--skeleton">
              <span class="skeleton skeleton--line" />
            </div>
          </template>

          <div v-else-if="!donors.length" class="empty-state">
            <span class="empty-state__icon"><AssetIcon name="users" :size="20" /></span>
            <p class="empty-state__title">{{ search || bloodTypeId ? 'No donors match' : 'No donors yet' }}</p>
            <p class="empty-state__text">
              {{ search || bloodTypeId
                ? 'Try another name, donor ID or blood type.'
                : 'Donors appear here once they book or donate at this centre.' }}
            </p>
            <button v-if="search || bloodTypeId" type="button" class="btn-outline" @click="clearFilters">Clear filters</button>
          </div>

          <div v-else-if="!visibleDonors.length" class="empty-state">
            <span class="empty-state__icon"><AssetIcon name="search" :size="20" /></span>
            <p class="empty-state__title">None on this page</p>
            <p class="empty-state__text">No donor shown here matches that eligibility filter.</p>
            <button type="button" class="btn-outline" @click="eligibilityFilter = 'all'">Show all</button>
          </div>

          <template v-else>
            <component
              :is="canViewProfile && !donor.contactOnly ? 'button' : 'div'"
              v-for="donor in visibleDonors"
              :key="donor.uuid"
              :type="canViewProfile && !donor.contactOnly ? 'button' : undefined"
              class="row"
              :class="{ 'row--link': canViewProfile && !donor.contactOnly }"
              @click="canViewProfile && !donor.contactOnly && viewDonor(donor)"
            >
              <span class="donor-cell">
                <span class="avatar" aria-hidden="true">{{ initials(donor.name) }}</span>
                <span class="donor-cell__text">
                  <span class="donor-cell__name">{{ donor.name }}</span>
                  <span class="donor-cell__id">{{ donor.donorCode }}</span>
                </span>
              </span>
              <span v-if="!contactOnly">
                <span v-if="donor.bloodType" class="blood">{{ donor.bloodType }}</span>
                <span v-else class="muted">Unknown</span>
              </span>
              <span class="contact-cell">
                <span>{{ donor.phone || '—' }}</span>
                <span v-if="donor.email" class="contact-cell__sub">{{ donor.email }}</span>
              </span>
              <span class="num">{{ donor.totalDonations }}</span>
              <span>{{ donor.lastDonation || '—' }}</span>
              <span>
                <span class="pill" :class="`pill--${donor.eligibility.key}`">{{ donor.eligibility.label }}</span>
              </span>
              <span class="row__go" aria-hidden="true">
                <AssetIcon v-if="canViewProfile && !donor.contactOnly" name="chevron-right" :size="16" />
              </span>
            </component>
          </template>
        </div>

        <footer v-if="pager.lastPage > 1 || pager.total" class="pager">
          <span class="pager__info">
            Showing {{ pager.from || 0 }}–{{ pager.to || 0 }} of {{ pager.total }}
          </span>
          <div class="pager__btns">
            <button
              type="button"
              class="pager__btn"
              :disabled="pager.page <= 1 || loadingDonors"
              aria-label="Previous page"
              @click="loadDonors(pager.page - 1)"
            >
              <AssetIcon name="chevron-left" :size="15" />
            </button>
            <span class="pager__page">Page {{ pager.page }} of {{ pager.lastPage }}</span>
            <button
              type="button"
              class="pager__btn"
              :disabled="pager.page >= pager.lastPage || loadingDonors"
              aria-label="Next page"
              @click="loadDonors(pager.page + 1)"
            >
              <AssetIcon name="chevron-right" :size="15" />
            </button>
          </div>
        </footer>
      </section>
    </div>

    <!-- ============ DETAIL VIEW ============ -->
    <div v-else class="donors-inner">
      <nav class="breadcrumb" aria-label="Breadcrumb">
        <button type="button" class="breadcrumb__link" @click="backToList">
          <AssetIcon name="chevron-left" :size="14" />
          Donors
        </button>
        <span class="breadcrumb__sep">/</span>
        <span class="breadcrumb__current">{{ profile?.name || '…' }}</span>
      </nav>

      <div v-if="justRegistered" class="success-banner" role="status">
        <AssetIcon name="circle-check-big" :size="16" />
        <div class="success-banner__body">
          <p class="success-banner__title">{{ justRegistered }}</p>
          <p class="success-banner__text">
            They join the donor list after their first visit here. To take their donation now, verify them at the
            Donation Counter with their valid ID.
          </p>
        </div>
        <NuxtLink to="/blood-center/collection" class="btn-outline">Go to Donation Counter</NuxtLink>
      </div>

      <div v-if="detailError" class="error-banner" role="alert">
        <span>{{ detailError }}</span>
        <button type="button" class="btn-link" @click="loadDonorDetail(selectedUuid)">Retry</button>
      </div>

      <div v-if="loadingDetail" class="skeleton skeleton--hero" />
      <div v-else-if="profile" class="hero">
        <div class="hero__who">
          <span class="avatar avatar--lg" aria-hidden="true">{{ initials(profile.name) }}</span>
          <div>
            <div class="hero__name-row">
              <h1 class="hero__name">{{ profile.name }}</h1>
              <span class="pill" :class="`pill--${profile.eligibility.key}`">{{ profile.eligibility.label }}</span>
            </div>
            <p class="hero__meta">
              <span class="mono">{{ profile.donorCode }}</span>
              <template v-if="profile.bloodType"> &middot; <span class="blood">{{ profile.bloodType }}</span></template>
              <template v-if="profile.phone"> &middot; {{ profile.phone }}</template>
            </p>
          </div>
        </div>

        <!-- Editing and flagging a donor have no server route yet; shown, not faked. -->
        <div v-if="canManage" class="hero__actions">
          <button type="button" class="btn-outline" disabled title="Not connected yet: the server has no route for this.">
            <AssetIcon name="pencil" :size="14" />
            Edit info
          </button>
          <button type="button" class="btn-outline btn-outline--danger" disabled title="Not connected yet: the server has no route for this.">
            <AssetIcon name="flag" :size="14" />
            Add flag
          </button>
        </div>
      </div>

      <p v-if="profile?.restricted" class="notice">
        <AssetIcon name="lock" :size="14" />
        <span>{{ profile.restrictionNote }}</span>
      </p>

      <!-- Donation summary, the numbers a counter asks first -->
      <div v-if="profile" class="stats-row stats-row--four">
        <div class="stat-card">
          <p class="stat-card__label">Total Donations</p>
          <p class="stat-card__value">{{ profile.totalDonations }}</p>
          <span class="stat-chip">All centres</span>
        </div>
        <div class="stat-card">
          <p class="stat-card__label">At This Centre</p>
          <p class="stat-card__value">{{ profile.donationsHere ?? '—' }}</p>
          <span class="stat-chip">{{ profile.restricted ? 'Not shared' : 'Recorded here' }}</span>
        </div>
        <div class="stat-card">
          <p class="stat-card__label">Last Donation</p>
          <p class="stat-card__value stat-card__value--text">{{ profile.lastDonation || 'Never' }}</p>
          <span class="stat-chip">{{ profile.lastDonationAgo || 'No donation recorded' }}</span>
        </div>
        <div class="stat-card">
          <p class="stat-card__label">Next Eligible</p>
          <p class="stat-card__value stat-card__value--text">{{ profile.nextEligible || 'Now' }}</p>
          <span class="stat-chip">{{ profile.eligibility.hint }}</span>
        </div>
      </div>

      <section v-if="profile" class="panel">
        <div class="tabs" role="tablist">
          <button
            type="button"
            role="tab"
            class="tab"
            :class="{ 'tab--active': activeDetailTab === 'info' }"
            :aria-selected="activeDetailTab === 'info'"
            @click="activeDetailTab = 'info'"
          >
            Profile
          </button>
          <!-- The history carries deferral reasons and final results: the physician's alone. -->
          <button
            v-if="canViewHistory && !profile.restricted"
            type="button"
            role="tab"
            class="tab"
            :class="{ 'tab--active': activeDetailTab === 'history' }"
            :aria-selected="activeDetailTab === 'history'"
            @click="activeDetailTab = 'history'"
          >
            Donation history
            <span v-if="history.length" class="tab__count">{{ history.length }}</span>
          </button>
        </div>

        <!-- Profile -->
        <div v-if="activeDetailTab === 'info'" class="tab-content">
          <div class="info-grid">
            <div class="info-group">
              <p class="info-group__title">Personal</p>
              <dl class="info-list">
                <div class="info-row"><dt>Full name</dt><dd>{{ profile.name }}</dd></div>
                <div class="info-row"><dt>Birth date</dt><dd>{{ profile.birthDate || '—' }}</dd></div>
                <div class="info-row"><dt>Sex</dt><dd>{{ profile.gender || '—' }}</dd></div>
                <div class="info-row"><dt>Blood type</dt><dd>{{ profile.bloodType || 'Not typed yet' }}</dd></div>
                <div v-if="!profile.restricted" class="info-row"><dt>Address</dt><dd>{{ profile.address || '—' }}</dd></div>
              </dl>
            </div>

            <div class="info-group">
              <p class="info-group__title">Contact &amp; identity</p>
              <dl class="info-list">
                <div class="info-row"><dt>Phone</dt><dd>{{ profile.phone || '—' }}</dd></div>
                <div class="info-row">
                  <dt>Email</dt>
                  <dd>
                    {{ profile.email || '—' }}
                    <span v-if="profile.email && profile.emailVerified === false" class="tag tag--warn">Unverified</span>
                  </dd>
                </div>
                <template v-if="!profile.restricted">
                  <div class="info-row">
                    <dt>Valid ID</dt>
                    <dd>
                      <span class="mono">{{ profile.validIdNumber || '—' }}</span>
                      <span v-if="profile.validIdType" class="contact-cell__sub">{{ profile.validIdType }}</span>
                    </dd>
                  </div>
                  <div class="info-row">
                    <dt>ID check</dt>
                    <dd><span class="tag" :class="`tag--${profile.identity.tone}`">{{ profile.identity.label }}</span></dd>
                  </div>
                  <div class="info-row"><dt>Account</dt><dd>{{ profile.accountStatus }}</dd></div>
                </template>
              </dl>
            </div>
          </div>
        </div>

        <!-- Donation history -->
        <div v-else class="tab-content">
          <div class="history-head">
            <p class="info-group__title">Donations at this centre</p>
            <!--
              A donation is recorded at the counter, not from a donor's history
              page: it needs the screening and the collection, both of which
              belong to the verified visit on /blood-center/collection.
            -->
            <NuxtLink to="/blood-center/collection" class="btn-outline">
              <AssetIcon name="plus" :size="14" />
              Record at counter
            </NuxtLink>
          </div>

          <div v-if="loadingHistory" class="timeline">
            <div v-for="n in 3" :key="'skh-' + n" class="skeleton skeleton--line skeleton--tall" />
          </div>
          <p v-else-if="historyError" class="notice">
            <AssetIcon name="lock" :size="14" />
            <span>{{ historyError }}</span>
          </p>
          <div v-else-if="!history.length" class="empty-state empty-state--flat">
            <span class="empty-state__icon"><AssetIcon name="droplets" :size="20" /></span>
            <p class="empty-state__title">No donations here yet</p>
            <p class="empty-state__text">Visits recorded at the Donation Counter appear here.</p>
          </div>
          <ol v-else class="timeline">
            <li v-for="item in history" :key="item.id" class="event" :class="`event--${item.tone}`">
              <span class="event__dot" aria-hidden="true" />
              <div class="event__body">
                <div class="event__top">
                  <p class="event__date">{{ item.date }}</p>
                  <span class="pill" :class="`pill--${item.tone}`">{{ item.statusLabel }}</span>
                </div>
                <p class="event__title">{{ item.title }}</p>
                <p v-if="item.detail" class="event__detail">{{ item.detail }}</p>
                <p v-if="item.lab" class="event__lab">
                  <AssetIcon name="flask-conical" :size="13" />
                  {{ item.lab }}
                </p>
              </div>
            </li>
          </ol>
        </div>
      </section>
    </div>

    <!-- REGISTER WALK-IN modal -->
    <Transition name="modal">
      <div v-if="showAddDonorModal" class="modal-overlay" @click.self="closeAddDonor">
        <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="add-donor-title">
          <div class="modal-card__header">
            <div>
              <h2 id="add-donor-title" class="modal-card__title">Register walk-in donor</h2>
              <p class="modal-card__subtitle">For a donor at the counter who has no portal account yet.</p>
            </div>
            <button type="button" class="modal-card__close" aria-label="Close" @click="closeAddDonor">
              <AssetIcon name="x" :size="18" />
            </button>
          </div>

          <form class="modal-form" @submit.prevent="submitAddDonor">
            <p v-if="addDonorError" class="form-error" role="alert">{{ addDonorError }}</p>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="d-first">First name</label>
                <input id="d-first" v-model="addDonorForm.first_name" type="text" class="form-input" maxlength="150" required>
              </div>
              <div class="form-group">
                <label class="form-label" for="d-last">Last name</label>
                <input id="d-last" v-model="addDonorForm.last_name" type="text" class="form-input" maxlength="150" required>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="d-birth">Birth date</label>
                <input id="d-birth" v-model="addDonorForm.birth_date" type="date" class="form-input" :max="todayIso" required>
              </div>
              <div class="form-group">
                <label class="form-label" for="d-sex">Sex <span class="form-optional">optional</span></label>
                <select id="d-sex" v-model="addDonorForm.gender" class="form-input select">
                  <option value="">Not given</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="d-id">Valid ID number</label>
              <input id="d-id" v-model="addDonorForm.valid_id_number" type="text" class="form-input mono" maxlength="50" placeholder="As printed on the ID card" required>
              <p class="form-hint">Each ID can only be registered once, so the same person is never added twice.</p>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="d-phone">Mobile number <span class="form-optional">optional</span></label>
                <input id="d-phone" v-model="addDonorForm.phone" type="tel" class="form-input" placeholder="09XXXXXXXXX">
              </div>
              <div class="form-group">
                <label class="form-label" for="d-email">Email <span class="form-optional">optional</span></label>
                <input id="d-email" v-model="addDonorForm.email" type="email" class="form-input" maxlength="150">
              </div>
            </div>

            <div class="form-row">
              <div v-if="bloodTypeOptions.length" class="form-group">
                <label class="form-label" for="d-bt">Blood type <span class="form-optional">if known</span></label>
                <select id="d-bt" v-model="addDonorForm.blood_type_id" class="form-input select">
                  <option value="">Unknown</option>
                  <option v-for="bt in bloodTypeOptions" :key="bt.id" :value="bt.id">{{ bt.code }}</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label" for="d-address">Address <span class="form-optional">optional</span></label>
                <input id="d-address" v-model="addDonorForm.address" type="text" class="form-input" maxlength="255">
              </div>
            </div>

            <div class="modal-actions">
              <button type="button" class="btn-outline" @click="closeAddDonor">Cancel</button>
              <button type="submit" class="btn-primary" :disabled="savingDonor || !canSaveDonor">
                {{ savingDonor ? 'Registering…' : 'Register donor' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import AssetIcon from '~/components/common/AssetIcon.vue'
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  // donors.view_contact, which Recruitment also holds: the server answers them
  // with a contact list, and the profile and history below stay hidden.
  requires: 'donors.view_contact',
})

const { can } = useUser()
const canViewProfile = computed(() => can('donors.view'))
const canViewHistory = computed(() => can('donors.view_clinical'))
const canManage = computed(() => can('donors.manage'))

/**
 * API SHAPE (tinuod nga mga ruta, /api/blood-center/donors)
 * -------------------------------------------------------------------------
 *  GET  /donors?search=&blood_type_id=&page=&per_page=
 *    -> Laravel paginator { data, current_page, last_page, total, from, to }
 *       data: [{ uuid, donor_code, full_name, blood_type, phone, email,
 *                total_donations, last_donation_at, next_eligible_date,
 *                contact_only? }]
 *  GET  /donors/{uuid}          -> identity + donation_summary + profile
 *  GET  /donors/{uuid}/history  -> { donor, donations: [...] }
 *  POST /donors                 { first_name, last_name, valid_id_number,
 *                                 birth_date, phone?, email?, gender?,
 *                                 blood_type_id?, address? }
 *
 * WALA PAY ROUTE: donor statistics, pag-edit sa donor, ug flags. Ang mga
 * button para niana kay naka-disable imbis mo-call og ruta nga wala.
 * -------------------------------------------------------------------------
 */

const PER_PAGE = 25

const initialLoading = ref(true)
const loadError = ref('')

/* ---------- formatting ---------- */

function todayDate() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

const todayIso = computed(() => {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
})

function toDate(value) {
  if (!value) return null
  const d = new Date(String(value).length === 10 ? `${value}T00:00:00` : value)
  return Number.isNaN(d.getTime()) ? null : d
}

function formatDate(value) {
  const d = toDate(value)
  return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
}

function timeAgo(value) {
  const d = toDate(value)
  if (!d) return ''
  const days = Math.round((todayDate() - d) / 86400000)
  if (days <= 0) return 'Today'
  if (days < 31) return `${days} day${days === 1 ? '' : 's'} ago`
  const months = Math.round(days / 30)
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`
  const years = Math.round(months / 12)
  return `${years} year${years === 1 ? '' : 's'} ago`
}

function initials(name) {
  if (!name) return '?'
  return name.split(' ').filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

/**
 * Eligibility, read off next_eligible_date the server already computes from
 * the donation interval. Never donated: eligible, and new to us.
 */
function eligibilityOf(row) {
  if (!row.last_donation_at) {
    return { key: 'new', label: 'First-time', hint: 'Has not donated yet' }
  }
  const next = toDate(row.next_eligible_date)
  if (!next || next <= todayDate()) {
    return { key: 'eligible', label: 'Eligible', hint: 'Can donate today' }
  }
  return { key: 'waiting', label: `From ${formatDate(row.next_eligible_date).replace(/, \d{4}$/, '')}`, hint: `In ${Math.ceil((next - todayDate()) / 86400000)} days` }
}

function mapDonor(row) {
  return {
    uuid: row.uuid,
    donorCode: row.donor_code || '—',
    name: row.full_name || [row.first_name, row.last_name].filter(Boolean).join(' ') || 'Unnamed donor',
    bloodType: row.blood_type || '',
    phone: row.phone || '',
    email: row.email || '',
    totalDonations: row.total_donations ?? 0,
    lastDonation: formatDate(row.last_donation_at),
    contactOnly: Boolean(row.contact_only),
    eligibility: eligibilityOf(row),
  }
}

/* ---------- reference data (blood types) ---------- */

const bloodTypeOptions = ref([])

async function loadReference() {
  try {
    const data = await bloodCenterService.referenceData()
    bloodTypeOptions.value = (data?.blood_types ?? []).map((bt) => ({ id: bt.id, code: bt.code ?? bt.label }))
  } catch {
    // Without it the blood-type filter and picker simply do not show.
    bloodTypeOptions.value = []
  }
}

/* ---------- list ---------- */

const donors = ref([])
const loadingDonors = ref(false)
const search = ref('')
const bloodTypeId = ref('')
const eligibilityFilter = ref('all')
const pager = reactive({ page: 1, lastPage: 1, total: 0, from: 0, to: 0 })

const contactOnly = computed(() => donors.value.length > 0 && donors.value.every((d) => d.contactOnly))

const eligibleCount = computed(() => donors.value.filter((d) => d.eligibility.key !== 'waiting').length)
const waitingCount = computed(() => donors.value.filter((d) => d.eligibility.key === 'waiting').length)

const eligibilityChips = computed(() => [
  { value: 'all', label: 'All', count: donors.value.length },
  { value: 'eligible', label: 'Eligible', count: donors.value.filter((d) => d.eligibility.key === 'eligible').length },
  { value: 'new', label: 'First-time', count: donors.value.filter((d) => d.eligibility.key === 'new').length },
  { value: 'waiting', label: 'Waiting', count: waitingCount.value },
])

const visibleDonors = computed(() => eligibilityFilter.value === 'all'
  ? donors.value
  : donors.value.filter((d) => d.eligibility.key === eligibilityFilter.value))

const listSummary = computed(() => {
  if (!pager.total) return 'Everyone who has booked or donated at this centre.'
  return `${pager.total} donor${pager.total === 1 ? '' : 's'} who have booked or donated at this centre`
})

async function loadDonors(page = 1) {
  loadingDonors.value = true
  loadError.value = ''
  try {
    const params = { page, per_page: PER_PAGE }
    if (search.value.trim()) params.search = search.value.trim()
    if (bloodTypeId.value) params.blood_type_id = bloodTypeId.value

    const res = await bloodCenterService.donors(params)
    const rows = Array.isArray(res) ? res : (res?.data ?? [])

    donors.value = rows.map(mapDonor)
    Object.assign(pager, {
      page: res?.current_page ?? page,
      lastPage: res?.last_page ?? 1,
      total: res?.total ?? rows.length,
      from: res?.from ?? (rows.length ? 1 : 0),
      to: res?.to ?? rows.length,
    })
  } catch (err) {
    donors.value = []
    loadError.value = err?.message || 'Could not load donor records.'
    console.error(err)
  } finally {
    loadingDonors.value = false
  }
}

let searchTimer = null

// Typing waits a beat before asking the server, rather than once per key.
function onSearchInput() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => loadDonors(), 300)
}

function clearFilters() {
  search.value = ''
  bloodTypeId.value = ''
  eligibilityFilter.value = 'all'
  loadDonors()
}

onBeforeUnmount(() => clearTimeout(searchTimer))

/* ---------- detail ---------- */

const selectedUuid = ref(null)
const profile = ref(null)
const loadingDetail = ref(false)
const detailError = ref('')
const activeDetailTab = ref('info')
const history = ref([])
const loadingHistory = ref(false)
const historyError = ref('')

const IDENTITY = {
  verified: { label: 'Verified', tone: 'ok' },
  pending: { label: 'Pending review', tone: 'warn' },
  rejected: { label: 'Not approved', tone: 'bad' },
  unsubmitted: { label: 'Not submitted', tone: 'muted' },
}

const ACCOUNT = {
  active: 'Active',
  pending_verification: 'Pending verification',
  suspended: 'Suspended',
  deactivated: 'Deactivated',
}

const GENDER = { male: 'Male', female: 'Female', other: 'Other', prefer_not_to_say: 'Prefer not to say' }

function mapProfile(data) {
  const summary = data?.donation_summary ?? {}
  const base = mapDonor({
    ...data,
    total_donations: summary.total_donations,
    last_donation_at: summary.last_donation_at,
    next_eligible_date: summary.next_eligible_date,
  })

  return {
    ...base,
    birthDate: data?.birth_date ? `${formatDate(data.birth_date)} (${ageOf(data.birth_date)})` : '',
    gender: GENDER[data?.gender] ?? '',
    address: data?.address ?? '',
    validIdNumber: data?.valid_id_number ?? '',
    validIdType: data?.valid_id_type ? String(data.valid_id_type).replace(/_/g, ' ') : '',
    identity: IDENTITY[data?.identity_status] ?? IDENTITY.unsubmitted,
    accountStatus: ACCOUNT[data?.account_status] ?? (data?.account_status || '—'),
    emailVerified: data?.email_verified,
    donationsHere: data?.donations_at_this_facility,
    restricted: Boolean(data?.restricted),
    restrictionNote: data?.restriction_note ?? '',
    lastDonationAgo: timeAgo(summary.last_donation_at),
    nextEligible: summary.next_eligible_date && toDate(summary.next_eligible_date) > todayDate()
      ? formatDate(summary.next_eligible_date)
      : '',
  }
}

function ageOf(birthDate) {
  const b = toDate(birthDate)
  if (!b) return ''
  const t = todayDate()
  let age = t.getFullYear() - b.getFullYear()
  if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) age -= 1
  return `${age} yrs`
}

/** One donation as the timeline shows it. */
function mapEvent(d) {
  const s = d.screening
  const deferred = s?.is_deferral || d.laboratory_deferral
  const tone = deferred ? 'deferred' : d.status === 'completed' || d.status === 'collected' ? 'eligible' : 'neutral'

  let title = d.volume_ml ? `${d.volume_ml} mL collected` : (d.status_label || 'Visit recorded')
  if (s?.is_deferral) title = s.outcome_label || 'Deferred at screening'
  if (d.laboratory_deferral) title = 'Deferred after laboratory testing'

  return {
    id: d.id,
    date: formatDate(d.donation_date),
    statusLabel: deferred ? 'Deferred' : (d.status_label || '—'),
    tone,
    title,
    detail: s?.deferral_reason ? `Reason: ${s.deferral_reason}` : '',
    lab: d.laboratory
      ? [d.laboratory.result_label, d.laboratory.blood_type ? `typed ${d.laboratory.blood_type}` : ''].filter(Boolean).join(' · ')
      : '',
  }
}

async function viewDonor(donor) {
  selectedUuid.value = donor.uuid
  activeDetailTab.value = 'info'
  history.value = []
  historyError.value = ''
  await Promise.all([
    loadDonorDetail(donor.uuid),
    canViewHistory.value ? loadDonorHistory(donor.uuid) : Promise.resolve(),
  ])
}

async function loadDonorDetail(uuid) {
  loadingDetail.value = true
  detailError.value = ''
  try {
    profile.value = mapProfile(await bloodCenterService.showDonor(uuid))
  } catch (err) {
    profile.value = null
    detailError.value = err?.message || 'Could not load this donor.'
    console.error(err)
  } finally {
    loadingDetail.value = false
  }
}

async function loadDonorHistory(uuid) {
  loadingHistory.value = true
  try {
    const data = await bloodCenterService.donorHistory(uuid)
    history.value = (data?.donations ?? []).map(mapEvent)
  } catch (err) {
    history.value = []
    historyError.value = err?.message || 'Could not load the donation history.'
  } finally {
    loadingHistory.value = false
  }
}

function backToList() {
  justRegistered.value = ''
  selectedUuid.value = null
  profile.value = null
  history.value = []
}

/* ---------- register walk-in ---------- */

const showAddDonorModal = ref(false)
const savingDonor = ref(false)
// After registering: shown on the new donor's profile, or on the list.
const justRegistered = ref('')
const listNotice = ref('')
const addDonorError = ref('')

const BLANK_DONOR = {
  first_name: '',
  last_name: '',
  birth_date: '',
  gender: '',
  valid_id_number: '',
  phone: '',
  email: '',
  blood_type_id: '',
  address: '',
}

const addDonorForm = reactive({ ...BLANK_DONOR })

const canSaveDonor = computed(() =>
  Boolean(addDonorForm.first_name.trim() && addDonorForm.last_name.trim()
    && addDonorForm.birth_date && addDonorForm.valid_id_number.trim()))

function openAddDonor() {
  Object.assign(addDonorForm, BLANK_DONOR)
  addDonorError.value = ''
  showAddDonorModal.value = true
}

function closeAddDonor() {
  showAddDonorModal.value = false
}

async function submitAddDonor() {
  if (!canSaveDonor.value) return
  savingDonor.value = true
  addDonorError.value = ''
  try {
    // Only what was filled in: the server treats an empty string as a value.
    const payload = Object.fromEntries(
      Object.entries(addDonorForm)
        .map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v])
        .filter(([, v]) => v !== '' && v !== null),
    )
    const res = await bloodCenterService.createDonor(payload)
    const created = res?.data ?? res
    closeAddDonor()

    // The list holds only donors with a booking or donation here, so a new
    // walk-in is not in it yet. Open their profile instead of leaving staff
    // to search for someone the list cannot show.
    const message = res?.message || `${payload.first_name} has been registered.`
    if (created?.uuid && canViewProfile.value) {
      // The response is already the full record. Re-fetching would come back
      // restricted, because the donor has no visit here yet.
      justRegistered.value = message
      selectedUuid.value = created.uuid
      activeDetailTab.value = 'info'
      history.value = []
      historyError.value = ''
      detailError.value = ''
      profile.value = mapProfile(created)
    } else {
      listNotice.value = `${message} They will appear in this list after their first visit.`
    }
  } catch (err) {
    addDonorError.value = Object.values(err?.errors ?? err?.data?.errors ?? {}).flat()[0]
      || err?.message
      || 'Could not register this donor. Please try again.'
  } finally {
    savingDonor.value = false
  }
}

onMounted(async () => {
  await Promise.all([loadDonors(), loadReference()])
  initialLoading.value = false
})
</script>

<style scoped>
.donors-page {
  max-width: var(--rb-content-max, 1600px);
  background: var(--rb-page-bg);
  margin: 0 auto;
  padding: 24px var(--rb-gutter, 24px) 40px;
  font-family: var(--rb-font-sans);
  color: var(--rb-text-primary);
}

.donors-inner {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* ---------- Skeletons (the same page skeleton as Inventory) ---------- */
.skeleton {
  display: block;
  background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 37%, var(--rb-skeleton-a) 63%);
  background-size: 400% 100%;
  border-radius: 14px;
  animation: shimmer 1.4s ease infinite;
}

.skeleton-head { display: flex; flex-direction: column; gap: 8px; }
.skeleton--header { height: 28px; max-width: 220px; border-radius: 8px; }
.skeleton--sub { height: 14px; max-width: 320px; border-radius: 6px; }
.skeleton--card { height: 108px; }
.skeleton--hero { height: 96px; }
.skeleton--line { height: 16px; width: 100%; border-radius: 6px; }
.skeleton--tall { height: 64px; border-radius: 10px; }

@keyframes shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}

/* ---------- Header ---------- */
.header-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.page-title { font-size: 20px; font-weight: 700; letter-spacing: -0.02em; margin: 0; color: var(--rb-text-primary); }
.page-subtitle { font-size: 13px; color: var(--rb-text-secondary); margin: 3px 0 0; }

/* ---------- Buttons (as on Inventory) ---------- */
.btn-primary,
.btn-outline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  height: 38px;
  padding: 0 16px;
  border-radius: 10px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.2;
  white-space: nowrap;
  text-decoration: none;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s ease, border-color 0.15s ease, opacity 0.15s ease;
}

.btn-primary { color: #fff; background: var(--rb-primary); border: none; box-shadow: 0 1px 2px rgba(var(--rb-shadow-rgb), 0.06); }
.btn-primary:hover:not(:disabled) { background: color-mix(in srgb, var(--rb-primary) 88%, #000); }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

.btn-outline { color: var(--rb-text-primary); background: var(--rb-surface); border: 1px solid var(--rb-border-strong); }
.btn-outline:hover:not(:disabled) { background: var(--rb-surface-hover); border-color: var(--rb-border-hover); }
.btn-outline:disabled { opacity: 0.55; cursor: not-allowed; }
.btn-outline--danger { color: var(--rb-accent-text); }

.btn-link {
  background: none;
  border: none;
  padding: 0;
  color: var(--rb-primary-text);
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.btn-link:hover { text-decoration: underline; }

.btn-primary:focus-visible,
.btn-outline:focus-visible,
.btn-link:focus-visible,
.chip:focus-visible,
.pager__btn:focus-visible,
.row--link:focus-visible,
.tab:focus-visible,
.breadcrumb__link:focus-visible {
  outline: none;
  box-shadow: var(--rb-focus-ring);
}

.error-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid rgba(var(--rb-accent-rgb), 0.3);
  background: rgba(var(--rb-accent-rgb), 0.06);
  color: var(--rb-accent-text);
  font-size: 13px;
}

.success-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid rgba(var(--rb-success-rgb), 0.3);
  background: rgba(var(--rb-success-rgb), 0.06);
  color: var(--rb-success-text);
}

.success-banner > :deep(svg) { flex-shrink: 0; }
.success-banner__body { flex: 1; min-width: 0; }
.success-banner__title { margin: 0; font-size: 13.5px; font-weight: 700; color: var(--rb-text-primary); }
.success-banner__text { flex: 1; margin: 2px 0 0; font-size: 12.5px; line-height: 1.45; color: var(--rb-text-secondary); }

.notice {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--rb-border);
  background: var(--rb-surface-alt);
  font-size: 12.5px;
  line-height: 1.45;
  color: var(--rb-text-secondary);
}

.notice :deep(svg) { flex-shrink: 0; margin-top: 1px; }

/* ---------- KPI cards (as on Inventory) ---------- */
.stats-row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
.stats-row--four { grid-template-columns: repeat(4, minmax(0, 1fr)); }

.stat-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  background: var(--rb-surface);
  border: 1px solid var(--rb-border);
  border-radius: 14px;
  box-shadow: 0 1px 2px rgba(var(--rb-shadow-rgb), 0.03);
}

.stat-card__top { display: flex; align-items: center; justify-content: space-between; }
.stat-card__label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--rb-text-secondary); margin: 0; }
.stat-card__badge { width: 26px; height: 26px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.stat-card__badge--primary { background: rgba(var(--rb-primary-rgb), 0.08); color: var(--rb-primary-text); }
.stat-card__badge--success { background: rgba(var(--rb-success-rgb), 0.08); color: var(--rb-success-text); }
.stat-card__badge--warning { background: rgba(var(--rb-warning-rgb), 0.1); color: var(--rb-warning-text); }
.stat-card__value { font-size: 24px; font-weight: 800; color: var(--rb-text-primary); margin: 0; line-height: 1; font-variant-numeric: tabular-nums; }
.stat-card__value--text { font-size: 18px; line-height: 24px; }
.stat-chip { display: inline-flex; align-items: center; align-self: flex-start; font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 999px; background: var(--rb-surface-alt); color: var(--rb-text-secondary); }

/* ---------- Panel ---------- */
.panel {
  background: var(--rb-surface);
  border: 1px solid var(--rb-border);
  border-radius: 14px;
  box-shadow: 0 1px 2px rgba(var(--rb-shadow-rgb), 0.03);
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px;
  border-bottom: 1px solid var(--rb-border);
}

.panel-title { font-weight: 700; font-size: 14px; color: var(--rb-text-primary); margin: 0; }
.panel-subtitle { font-size: 12px; color: var(--rb-text-secondary); margin: 3px 0 0; }

/* ---------- Toolbar ---------- */
.toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 18px;
  border-bottom: 1px solid var(--rb-border);
  background: var(--rb-surface-alt);
}

.search {
  position: relative;
  flex: 0 1 340px;
}

.search__icon {
  position: absolute;
  left: 11px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--rb-text-secondary);
  pointer-events: none;
}

.search__input {
  width: 100%;
  height: 36px;
  padding: 0 12px 0 34px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  background: var(--rb-surface);
  font-family: inherit;
  font-size: 13px;
  color: var(--rb-text-primary);
}

.search__input::placeholder { color: var(--rb-placeholder); }
.search__input:focus { outline: none; border-color: var(--rb-primary); box-shadow: var(--rb-focus-ring); }

.select {
  height: 36px;
  padding: 0 30px 0 12px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  background-color: var(--rb-surface);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2394a3b8' stroke-width='1.5' fill='none' fill-rule='evenodd'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 10px 6px;
  font-family: inherit;
  font-size: 13px;
  color: var(--rb-text-primary);
  appearance: none;
  cursor: pointer;
}

.select:focus { outline: none; border-color: var(--rb-primary); box-shadow: var(--rb-focus-ring); }

.chips {
  display: flex;
  gap: 6px;
  margin-left: auto;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 12px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 999px;
  background: var(--rb-surface);
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--rb-text-secondary);
  cursor: pointer;
}

.chip:hover { color: var(--rb-text-primary); }

.chip--on,
.chip--on:hover {
  background: var(--rb-primary);
  border-color: var(--rb-primary);
  color: #fff;
}

.chip__count {
  min-width: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--rb-surface-alt);
  font-size: 11px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.chip--on .chip__count { background: rgba(255, 255, 255, 0.22); }

/* ---------- Table ---------- */
.table { display: flex; flex-direction: column; }

.row {
  display: grid;
  grid-template-columns: minmax(220px, 2fr) 100px minmax(160px, 1.4fr) 90px 130px 130px 24px;
  align-items: center;
  gap: 16px;
  width: 100%;
  min-height: 60px;
  padding: 10px 18px;
  border: 0;
  border-top: 1px solid var(--rb-border);
  background: transparent;
  font-family: inherit;
  font-size: 13px;
  color: var(--rb-text-primary);
  text-align: left;
}

.table--contact .row { grid-template-columns: minmax(220px, 2fr) minmax(160px, 1.4fr) 90px 130px 130px 24px; }

.row--head {
  min-height: 0;
  padding-top: 10px;
  padding-bottom: 10px;
  border-top: 0;
  background: var(--rb-surface-alt);
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--rb-text-secondary);
}

.row--link { cursor: pointer; transition: background 0.15s ease; }
.row--link:hover { background: var(--rb-surface-hover); }
.row--link:hover .row__go { color: var(--rb-primary-text); }

.row--skeleton { display: flex; }

.num { text-align: right; font-variant-numeric: tabular-nums; }

.donor-cell { display: flex; align-items: center; gap: 10px; min-width: 0; }
.donor-cell__text { display: flex; flex-direction: column; min-width: 0; }
.donor-cell__name { font-weight: 700; text-transform: capitalize; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.donor-cell__id { font-family: var(--rb-font-mono); font-size: 11.5px; color: var(--rb-text-secondary); }

.contact-cell { display: flex; flex-direction: column; min-width: 0; }
.contact-cell__sub { font-size: 11.5px; color: var(--rb-text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.row__go { display: flex; justify-content: flex-end; color: var(--rb-text-muted); }

.avatar {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  border-radius: 999px;
  background: rgba(var(--rb-primary-rgb), 0.1);
  color: var(--rb-primary-text);
  font-size: 12px;
  font-weight: 700;
}

.avatar--lg { width: 56px; height: 56px; font-size: 18px; }

.blood {
  display: inline-flex;
  padding: 2px 8px;
  border-radius: 6px;
  background: rgba(var(--rb-accent-rgb), 0.08);
  color: var(--rb-accent-text);
  font-size: 12px;
  font-weight: 700;
}

.muted { color: var(--rb-text-secondary); }
.mono { font-family: var(--rb-font-mono); font-size: 12.5px; }

/* ---------- Pills ---------- */
.pill {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

.pill--eligible { background: rgba(var(--rb-success-rgb), 0.1); color: var(--rb-success-text); }
.pill--new { background: rgba(var(--rb-primary-rgb), 0.08); color: var(--rb-primary-text); }
.pill--waiting { background: rgba(var(--rb-warning-rgb), 0.1); color: var(--rb-warning-text); }
.pill--deferred { background: rgba(var(--rb-accent-rgb), 0.08); color: var(--rb-accent-text); }
.pill--neutral { background: var(--rb-surface-alt); color: var(--rb-text-secondary); }

.tag {
  display: inline-flex;
  margin-left: 6px;
  padding: 1px 7px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  background: var(--rb-surface-alt);
  color: var(--rb-text-secondary);
}

.tag--ok { margin-left: 0; background: rgba(var(--rb-success-rgb), 0.1); color: var(--rb-success-text); }
.tag--warn { background: rgba(var(--rb-warning-rgb), 0.1); color: var(--rb-warning-text); }
.tag--bad { margin-left: 0; background: rgba(var(--rb-accent-rgb), 0.08); color: var(--rb-accent-text); }
.tag--muted { margin-left: 0; }
dd .tag--warn { margin-left: 6px; }

/* ---------- Pager ---------- */
.pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 18px;
  border-top: 1px solid var(--rb-border);
  font-size: 12.5px;
  color: var(--rb-text-secondary);
}

.pager__btns { display: flex; align-items: center; gap: 8px; }

.pager__btn {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 8px;
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  cursor: pointer;
}

.pager__btn:hover:not(:disabled) { background: var(--rb-surface-hover); }
.pager__btn:disabled { opacity: 0.4; cursor: not-allowed; }
.pager__page { font-variant-numeric: tabular-nums; }

/* ---------- Empty states ---------- */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 48px 24px;
  text-align: center;
  border-top: 1px solid var(--rb-border);
}

.empty-state--flat { border-top: 0; padding: 32px 16px; }

.empty-state__icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  margin-bottom: 6px;
  border-radius: 12px;
  background: var(--rb-surface-alt);
  border: 1px solid var(--rb-border);
  color: var(--rb-text-secondary);
}

.empty-state__title { margin: 0; font-size: 14px; font-weight: 700; color: var(--rb-text-primary); }
.empty-state__text { margin: 0 0 8px; max-width: 44ch; font-size: 13px; line-height: 1.5; color: var(--rb-text-secondary); }

/* ---------- Detail ---------- */
.breadcrumb { display: flex; align-items: center; gap: 8px; font-size: 13px; }

.breadcrumb__link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 4px 2px 0;
  border: 0;
  border-radius: 6px;
  background: none;
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  color: var(--rb-primary-text);
  cursor: pointer;
}

.breadcrumb__link:hover { text-decoration: underline; }
.breadcrumb__sep { color: var(--rb-text-muted); }
.breadcrumb__current { font-weight: 600; color: var(--rb-text-primary); text-transform: capitalize; }

.hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 20px;
  background: var(--rb-surface);
  border: 1px solid var(--rb-border);
  border-radius: 14px;
  box-shadow: 0 1px 2px rgba(var(--rb-shadow-rgb), 0.03);
}

.hero__who { display: flex; align-items: center; gap: 16px; min-width: 0; }
.hero__name-row { display: flex; align-items: center; gap: 10px; }
.hero__name { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em; color: var(--rb-text-primary); text-transform: capitalize; }
.hero__meta { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin: 6px 0 0; font-size: 13px; color: var(--rb-text-secondary); }
.hero__actions { display: flex; gap: 8px; }

.tabs {
  display: flex;
  gap: 24px;
  padding: 0 18px;
  border-bottom: 1px solid var(--rb-border);
  background: var(--rb-surface-alt);
}

.tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 12px 0;
  border: 0;
  border-bottom: 2px solid transparent;
  background: none;
  font-family: inherit;
  font-size: 13px;
  font-weight: 700;
  color: var(--rb-text-secondary);
  cursor: pointer;
}

.tab:hover { color: var(--rb-text-primary); }
.tab--active { color: var(--rb-primary-text); border-bottom-color: var(--rb-primary); }

.tab__count {
  min-width: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: rgba(var(--rb-primary-rgb), 0.1);
  color: var(--rb-primary-text);
  font-size: 11px;
  text-align: center;
}

.tab-content { padding: 18px; }

.info-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; }

.info-group__title {
  margin: 0 0 6px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--rb-text-secondary);
}

.info-list { margin: 0; }

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 11px 0;
  border-bottom: 1px solid var(--rb-border);
  font-size: 13px;
}

.info-row:last-child { border-bottom: 0; }
.info-row dt { color: var(--rb-text-secondary); }
.info-row dd { margin: 0; display: flex; flex-direction: column; align-items: flex-end; font-weight: 600; color: var(--rb-text-primary); text-align: right; }

/* History timeline */
.history-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }

.timeline { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; list-style: none; }

.event {
  position: relative;
  display: flex;
  gap: 14px;
  padding: 0 0 8px 2px;
}

.event:not(:last-child)::before {
  content: '';
  position: absolute;
  left: 7px;
  top: 18px;
  bottom: -8px;
  width: 2px;
  background: var(--rb-border);
}

.event__dot {
  position: relative;
  width: 12px;
  height: 12px;
  margin-top: 5px;
  flex-shrink: 0;
  border-radius: 999px;
  background: var(--rb-text-muted);
  box-shadow: 0 0 0 3px var(--rb-surface);
}

.event--eligible .event__dot { background: var(--rb-success); }
.event--deferred .event__dot { background: var(--rb-accent); }

.event__body {
  flex: 1;
  min-width: 0;
  padding: 10px 14px;
  border: 1px solid var(--rb-border);
  border-radius: 10px;
}

.event__top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.event__date { margin: 0; font-size: 12px; font-weight: 600; color: var(--rb-text-secondary); }
.event__title { margin: 4px 0 0; font-size: 13.5px; font-weight: 700; color: var(--rb-text-primary); }
.event__detail { margin: 3px 0 0; font-size: 12.5px; color: var(--rb-text-secondary); }
.event__lab { display: flex; align-items: center; gap: 6px; margin: 6px 0 0; font-size: 12px; color: var(--rb-text-secondary); }

/* ---------- Modal ---------- */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: var(--rb-overlay);
}

.modal-card {
  width: 100%;
  max-width: 560px;
  max-height: 90vh;
  overflow-y: auto;
  background: var(--rb-surface);
  border-radius: 16px;
  box-shadow: 0 8px 28px rgba(var(--rb-shadow-rgb), 0.28);
}

.modal-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 20px;
  border-bottom: 1px solid var(--rb-border);
}

.modal-card__title { margin: 0; font-size: 16px; font-weight: 700; color: var(--rb-text-primary); }
.modal-card__subtitle { margin: 3px 0 0; font-size: 12.5px; color: var(--rb-text-secondary); }

.modal-card__close {
  display: flex;
  padding: 4px;
  border: 0;
  border-radius: 8px;
  background: none;
  color: var(--rb-text-secondary);
  cursor: pointer;
}

.modal-card__close:hover { color: var(--rb-text-primary); background: var(--rb-surface-hover); }

.modal-form { display: flex; flex-direction: column; gap: 14px; padding: 18px 20px 20px; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.form-group { display: flex; flex-direction: column; gap: 6px; }
.form-label { font-size: 12.5px; font-weight: 600; color: var(--rb-text-primary); }
.form-optional { margin-left: 4px; font-weight: 500; color: var(--rb-text-secondary); }
.form-hint { margin: 0; font-size: 12px; color: var(--rb-text-secondary); }

.form-error {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid rgba(var(--rb-accent-rgb), 0.35);
  border-radius: 8px;
  background: rgba(var(--rb-accent-rgb), 0.08);
  color: var(--rb-accent-text);
  font-size: 13px;
  line-height: 1.45;
}

/* Anchored on the page root: other portals ship unscoped dark .form-input rules. */
.donors-page .form-input {
  width: 100%;
  height: 38px;
  padding: 0 12px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  background-color: var(--rb-surface);
  font-family: inherit;
  font-size: 13px;
  color: var(--rb-text-primary);
}

.donors-page .form-input.select { padding-right: 30px; }
.donors-page .form-input::placeholder { color: var(--rb-placeholder); }
.donors-page .form-input:focus { outline: none; border-color: var(--rb-primary); box-shadow: var(--rb-focus-ring); }

.modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 4px; }

.modal-enter-active,
.modal-leave-active { transition: opacity 0.2s ease; }

.modal-enter-from,
.modal-leave-to { opacity: 0; }

@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none !important; }
}
</style>
