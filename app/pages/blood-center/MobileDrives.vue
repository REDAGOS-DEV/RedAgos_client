<template>
  <div class="drives-page">
    <div v-if="loading" class="loading-wrap">
      <div class="spinner" />
    </div>

    <div v-else class="drives-inner">
      <!-- Header -->
      <div class="header-row fade-in" style="--delay: 0ms">
        <div>
          <h1 class="page-title">Mobile Drives</h1>
          <p class="page-subtitle">Create, publish, and manage mobile donation drive events.</p>
        </div>
        <button type="button" class="btn-primary" @click="openCreateModal">
          <AssetIcon name="plus" :size="16" />
          Create Drive
        </button>
      </div>

      <!-- ===== ENHANCED STATS CARDS ===== -->
      <div class="stats-row fade-in" style="--delay: 60ms">
        <div class="stat-card stat-card--blue">
          <div class="stat-card__icon">
            <AssetIcon name="calendar" :size="20" />
          </div>
          <div class="stat-card__body">
            <p class="stat-card__label">Upcoming Drives</p>
            <p class="stat-card__value">{{ upcomingDrivesCount }}</p>
            <p class="stat-card__caption">Scheduled across all venues</p>
          </div>
        </div>

        <div class="stat-card stat-card--violet">
          <div class="stat-card__icon">
            <AssetIcon name="users" :size="20" />
          </div>
          <div class="stat-card__body">
            <p class="stat-card__label">Total Registered</p>
            <p class="stat-card__value">{{ totalRegistered }}</p>
            <p class="stat-card__caption">Donors signed up</p>
          </div>
        </div>

        <div class="stat-card stat-card--green">
          <div class="stat-card__icon">
            <AssetIcon name="droplets" :size="20" />
          </div>
          <div class="stat-card__body">
            <p class="stat-card__label">Units Collected</p>
            <p class="stat-card__value">{{ unitsCollectedMonth }}</p>
            <p class="stat-card__caption">This month</p>
          </div>
        </div>
      </div>

      <!-- ===== FILTER BAR (NEW) ===== -->
      <div class="filter-bar fade-in" style="--delay: 80ms">
        <div class="filter-left">
          <AssetIcon name="filter" :size="16" class="filter-icon" />
          <span class="filter-label">Filter by status:</span>
        </div>
        <div class="filter-options">
          <button
            v-for="status in statusFilters"
            :key="status.value"
            class="filter-chip"
            :class="{ 'filter-chip--active': selectedStatus === status.value }"
            @click="selectedStatus = status.value"
          >
            {{ status.label }}
          </button>
        </div>
      </div>

      <!-- ===== DRIVE LIST ===== -->
      <div v-if="filteredDrives.length" class="drive-list">
        <div v-for="(drive, i) in filteredDrives" :key="drive.id" class="drive-card fade-in" :style="{ '--delay': `${100 + i * 50}ms` }">
          <!-- Status indicator line at top -->
          <div class="drive-card__status-line" :class="`drive-card__status-line--${drive.status}`" />

          <div class="drive-card__top">
            <div>
              <p class="drive-card__title">{{ drive.facility_name }} · {{ drive.location }}</p>
              <p class="drive-card__meta">
                {{ formatDateRange(drive.event_date, drive.start_time, drive.end_time) }} · Capacity {{ drive.capacity }}
              </p>
            </div>
            <span class="status-badge" :class="`status-badge--${drive.status}`">{{ statusLabel(drive.status) }}</span>
          </div>

          <div class="progress-track">
            <div class="progress-fill" :class="{ 'progress-fill--full': fillPercent(drive) >= 100 }"
              :style="{ width: `${Math.min(fillPercent(drive), 100)}%` }" />
          </div>
          <div class="progress-meta">
            <span>{{ drive.registered_count }} registered donors</span>
            <span>{{ drive.status === 'open' ? 'Registration open' : `${fillPercent(drive)}% full` }}</span>
          </div>

          <template v-if="drive.donor_preview?.length">
            <p class="preview-label">Registered Donors (Preview)</p>
            <div class="donor-preview-list">
              <div v-for="(donor, di) in drive.donor_preview" :key="donor.id" class="donor-row">
                <div class="donor-row__avatar" :style="{ background: avatarColor(di) }">
                  {{ initials(donor.full_name) }}
                </div>
                <div class="donor-row__info">
                  <p class="donor-row__name">{{ donor.full_name }}</p>
                  <p class="donor-row__meta">
                    {{ donor.blood_type }} · Registered {{ formatDate(donor.registered_at) }} · Screening: {{ donor.screening_status }}
                  </p>
                </div>
                <span class="donor-badge" :class="`donor-badge--${donor.attendance_status}`">
                  {{ donorStatusLabel(donor.attendance_status) }}
                </span>
              </div>
            </div>
          </template>

          <div class="drive-card__actions">
            <NuxtLink :to="`/signup/bloodcenter/MobileDrives/${drive.id}/Donors`" class="btn-outline">
              View all {{ drive.registered_count }} donors
            </NuxtLink>
            <NuxtLink v-if="drive.status !== 'planning'" :to="`/signup/bloodcenter/MobileDrives/${drive.id}/Attendance`" class="btn-outline-blue">
              Mark Attendance
            </NuxtLink>
            <NuxtLink :to="`/signup/bloodcenter/MobileDrives/${drive.id}`" class="btn-primary btn-primary--sm">
              Manage Drive
            </NuxtLink>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-else class="empty-state fade-in" style="--delay: 100ms">
        <AssetIcon name="truck" :size="40" class="empty-icon" />
        <p>No mobile drives match the current filter.</p>
        <button type="button" class="btn-primary btn-primary--sm" @click="openCreateModal">Create your first drive</button>
      </div>
    </div>

    <!-- Create Mobile Drive modal -->
    <Transition name="modal">
      <div v-if="showCreateModal" class="modal-overlay" @click.self="closeCreateModal">
        <div class="modal-card">
          <div class="modal-card__header">
            <h2 class="modal-card__title">Create Mobile Drive</h2>
            <button type="button" class="modal-card__close" @click="closeCreateModal">
              <AssetIcon name="x" :size="18" />
            </button>
          </div>

          <form class="modal-form" @submit.prevent="handleCreateDrive">
            <div class="form-group">
              <label class="form-label">Venue</label>
              <input v-model="driveForm.venue" type="text" class="form-input" placeholder="Venue name and address" required>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Date</label>
                <input v-model="driveForm.date" type="date" class="form-input" required>
              </div>
              <div class="form-group">
                <label class="form-label">Capacity</label>
                <div class="stepper">
                  <input v-model.number="driveForm.capacity" type="number" min="1" class="form-input stepper__input" placeholder="Max Donors" required>
                  <div class="stepper__controls">
                    <button type="button" class="stepper__btn" @click="driveForm.capacity = (driveForm.capacity || 0) + 1">
                      <AssetIcon name="chevron-up" :size="10" />
                    </button>
                    <button type="button" class="stepper__btn" @click="driveForm.capacity = Math.max(1, (driveForm.capacity || 1) - 1)">
                      <AssetIcon name="chevron-down" :size="10" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Start time</label>
                <input v-model="driveForm.start_time" type="time" class="form-input" required>
              </div>
              <div class="form-group">
                <label class="form-label">End time</label>
                <input v-model="driveForm.end_time" type="time" class="form-input" required>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Assigned staff</label>
              <input v-model="driveForm.assigned_staff" type="text" class="form-input" placeholder="Staff names...">
            </div>

            <div class="form-group">
              <label class="form-label">Announcement message</label>
              <textarea v-model="driveForm.announcement" class="form-textarea" rows="3" placeholder="Message for donors..." />
            </div>

            <div class="modal-actions">
              <button type="button" class="btn-cancel" @click="closeCreateModal">Cancel Drive</button>
              <button type="submit" class="btn-primary" :disabled="submitting">
                {{ submitting ? 'Saving...' : 'Save Changes' }}
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
import { ref, reactive, onMounted, computed } from 'vue'

definePageMeta({
  middleware: 'auth',
  layout: 'blood-centerdashboard'
})

const loading = ref(true)
const submitting = ref(false)
const showCreateModal = ref(false)

// ===== FILTER =====
const statusFilters = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'completed', label: 'Completed' },
  { value: 'planning', label: 'Planning' },
]
const selectedStatus = ref('all')

// ===== DRIVE FORM =====
const driveForm = reactive({
  venue: '',
  date: '',
  capacity: 50,
  start_time: '08:00',
  end_time: '16:00',
  assigned_staff: '',
  announcement: '',
})

function resetDriveForm() {
  driveForm.venue = ''
  driveForm.date = ''
  driveForm.capacity = 50
  driveForm.start_time = '08:00'
  driveForm.end_time = '16:00'
  driveForm.assigned_staff = ''
  driveForm.announcement = ''
}

function openCreateModal() {
  showCreateModal.value = true
}

function closeCreateModal() {
  showCreateModal.value = false
  resetDriveForm()
}

async function handleCreateDrive() {
  submitting.value = true
  try {
    const newDrive = await $fetch('/api/bloodcenter/mobile-drives', {
      method: 'POST',
      body: { ...driveForm },
    })
    drives.value = [newDrive, ...drives.value]
    upcomingDrivesCount.value += 1
    closeCreateModal()
  } catch (err) {
    console.error('Failed to create mobile drive (expected while backend is not yet wired up):', err)
  } finally {
    submitting.value = false
  }
}

// ===== DATA =====
const upcomingDrivesCount = ref(0)
const totalRegistered = ref(0)
const unitsCollectedMonth = ref(0)
const drives = ref([])

// ===== COMPUTED FILTER =====
const filteredDrives = computed(() => {
  if (selectedStatus.value === 'all') return drives.value
  return drives.value.filter(d => d.status === selectedStatus.value)
})

// ===== HELPERS =====
const AVATAR_COLORS = ['#1565C0', '#2E7D32', '#F57C00', '#D32F2F', '#6D4C41', '#5E35B1']

function avatarColor(index) {
  return AVATAR_COLORS[index % AVATAR_COLORS.length]
}

function initials(fullName) {
  if (!fullName) return '?'
  return fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('')
}

function fillPercent(drive) {
  if (!drive.capacity) return 0
  return Math.round((drive.registered_count / drive.capacity) * 100)
}

function statusLabel(status) {
  const map = {
    planning: 'Planning',
    open: 'Open',
    upcoming: 'Upcoming',
    completed: 'Completed',
  }
  return map[status] ?? status
}

function donorStatusLabel(status) {
  const map = {
    confirmed: 'Confirmed',
    pending: 'Pending',
    attended: 'Attended',
    no_show: 'No Show',
  }
  return map[status] ?? status
}

function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  const day = d.getDate()
  const monthShort = d.toLocaleDateString('en-US', { month: 'short' })
  return `${monthShort} ${day}`
}

function formatDateRange(eventDate, startTime, endTime) {
  if (!eventDate) return '—'
  const d = new Date(eventDate)
  if (Number.isNaN(d.getTime())) return '—'
  const day = d.getDate()
  const monthShort = d.toLocaleDateString('en-US', { month: 'short' })
  const year = d.getFullYear()
  const timeRange = startTime && endTime ? ` · ${startTime} – ${endTime}` : ''
  return `${monthShort} ${day}, ${year}${timeRange}`
}

// ===== ON MOUNT =====
onMounted(async () => {
  try {
    const data = await $fetch('/api/bloodcenter/mobile-drives')
    upcomingDrivesCount.value = data.upcoming_drives_count ?? 0
    totalRegistered.value = data.total_registered ?? 0
    unitsCollectedMonth.value = data.units_collected_month ?? 0
    drives.value = data.drives ?? []
  } catch (err) {
    console.error('Failed to load mobile drives (expected while backend is not yet wired up):', err)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
/* ===== BASE ===== */
.drives-page {
  --primary: #1565c0;
  --accent: #d32f2f;
  --success: #2e7d32;
  --warning: #f57c00;
  --text-primary: #1f2937;
  --text-secondary: #6b7280;
  max-width: 1152px;
  background: #f5f7fa;
  margin: 0 auto;
  padding: 24px 32px 40px;
}

/* ===== LOADING ===== */
.loading-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 60vh;
}
.spinner {
  width: 32px;
  height: 32px;
  border-radius: 999px;
  border: 4px solid #e3ebf6;
  border-top-color: var(--primary);
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.fade-in {
  animation: fadeInUp 0.5s ease both;
  animation-delay: var(--delay, 0ms);
}
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) { .fade-in, .spinner { animation: none !important; } }

.drives-inner { display: flex; flex-direction: column; gap: 20px; }

/* ===== HEADER ===== */
.header-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.page-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}
.page-subtitle {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 2px 0 0;
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 700;
  color: white;
  background: var(--primary);
  border: none;
  cursor: pointer;
  text-decoration: none;
  transition: opacity 0.15s ease, transform 0.1s;
  flex-shrink: 0;
}
.btn-primary:hover { opacity: 0.92; transform: scale(1.02); }
.btn-primary--sm { padding: 8px 14px; font-size: 12px; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

/* ===== STATS ROW ===== */
.stats-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
  background: white;
  border-radius: 16px;
  border: 1px solid #eef0f3;
  padding: 18px 22px;
  transition: all 0.25s ease;
  box-shadow: 0 1px 3px rgba(0,0,0,0.02);
}
.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px -8px rgba(0,0,0,0.08);
  border-color: #d1d9e6;
}

.stat-card__icon {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-card--blue .stat-card__icon {
  background: linear-gradient(135deg, #E3F2FD, #BBDEFB);
  color: var(--primary);
}
.stat-card--violet .stat-card__icon {
  background: linear-gradient(135deg, #EDE7F6, #D1C4E9);
  color: #5E35B1;
}
.stat-card--green .stat-card__icon {
  background: linear-gradient(135deg, #E8F5E9, #C8E6C9);
  color: var(--success);
}

.stat-card--blue { background: linear-gradient(135deg, #ffffff, #f0f7fe); }
.stat-card--violet { background: linear-gradient(135deg, #ffffff, #f4f1fb); }
.stat-card--green { background: linear-gradient(135deg, #ffffff, #f0f9f0); }

.stat-card__body {
  min-width: 0;
}
.stat-card__label {
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--text-secondary);
  margin: 0;
}
.stat-card__value {
  font-size: 28px;
  font-weight: 800;
  color: var(--text-primary);
  line-height: 1.1;
  margin: 2px 0 0;
}
.stat-card__caption {
  font-size: 11.5px;
  color: var(--text-secondary);
  margin: 2px 0 0;
}

/* ===== FILTER BAR ===== */
.filter-bar {
  background: white;
  border-radius: 14px;
  border: 1px solid #eef0f3;
  padding: 12px 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  box-shadow: 0 1px 3px rgba(0,0,0,0.02);
}
.filter-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.filter-icon { color: var(--text-secondary); }
.filter-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}
.filter-options {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.filter-chip {
  padding: 4px 14px;
  border-radius: 20px;
  border: 1px solid #e5e7eb;
  background: transparent;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}
.filter-chip:hover { background: #f3f4f6; }
.filter-chip--active {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

/* ===== DRIVE CARDS ===== */
.drive-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.drive-card {
  position: relative;
  background: white;
  border-radius: 16px;
  border: 1px solid #eef0f3;
  box-shadow: 0 1px 3px rgba(0,0,0,0.02);
  padding: 20px 24px;
  overflow: hidden;
  transition: box-shadow 0.25s ease, transform 0.25s ease;
}
.drive-card:hover {
  box-shadow: 0 8px 24px rgba(0,0,0,0.06);
  transform: translateY(-2px);
}

.drive-card__status-line {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
}
.drive-card__status-line--upcoming { background: var(--primary); }
.drive-card__status-line--open { background: var(--success); }
.drive-card__status-line--planning { background: #9ca3af; }
.drive-card__status-line--completed { background: #6b7280; }

.drive-card__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-top: 6px;
}
.drive-card__title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}
.drive-card__meta {
  font-size: 12.5px;
  color: var(--text-secondary);
  margin: 4px 0 0;
}

.status-badge {
  font-size: 10.5px;
  font-weight: 700;
  padding: 4px 12px;
  border-radius: 999px;
  flex-shrink: 0;
  white-space: nowrap;
}
.status-badge--upcoming { background: #E3F2FD; color: var(--primary); }
.status-badge--open { background: #E8F5E9; color: var(--success); }
.status-badge--planning { background: #F3F4F6; color: #6b7280; }
.status-badge--completed { background: #ECEFF1; color: #455A64; }

/* Progress */
.progress-track {
  margin-top: 14px;
  height: 6px;
  border-radius: 999px;
  background: #eef0f3;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--primary);
  transition: width 0.5s ease;
}
.progress-fill--full { background: var(--success); }

.progress-meta {
  display: flex;
  justify-content: space-between;
  font-size: 11.5px;
  color: var(--text-secondary);
  margin-top: 6px;
}

/* Donor preview */
.preview-label {
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--text-secondary);
  margin: 18px 0 8px;
  border-top: 1px solid #f3f4f6;
  padding-top: 14px;
}
.donor-preview-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.donor-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.donor-row__avatar {
  width: 32px;
  height: 32px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}
.donor-row__info {
  flex: 1;
  min-width: 0;
}
.donor-row__name {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}
.donor-row__meta {
  font-size: 11.5px;
  color: var(--text-secondary);
  margin: 2px 0 0;
}
.donor-badge {
  font-size: 10.5px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 999px;
  flex-shrink: 0;
}
.donor-badge--confirmed { background: #E8F5E9; color: var(--success); }
.donor-badge--pending { background: #FFF3E0; color: var(--warning); }
.donor-badge--attended { background: #E3F2FD; color: var(--primary); }
.donor-badge--no_show { background: #FDEAEA; color: var(--accent); }

/* Actions */
.drive-card__actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid #f3f4f6;
  flex-wrap: wrap;
}
.btn-outline {
  padding: 8px 14px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 700;
  background: #F3F4F6;
  color: #374151;
  border: none;
  text-decoration: none;
  transition: background 0.15s ease;
  cursor: pointer;
}
.btn-outline:hover { background: #e5e7eb; }
.btn-outline-blue {
  padding: 8px 14px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 700;
  background: #E3F2FD;
  color: var(--primary);
  border: none;
  text-decoration: none;
  transition: background 0.15s ease;
  cursor: pointer;
}
.btn-outline-blue:hover { background: #d3e6fa; }

/* Empty state */
.empty-state {
  background: white;
  border-radius: 16px;
  border: 1px solid #eef0f3;
  padding: 48px 24px;
  text-align: center;
  color: var(--text-secondary);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.empty-icon { color: #d1d5db; }

/* ===== MODAL ===== */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 100;
}
.modal-card {
  background: white;
  border-radius: 16px;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
}
.modal-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px;
  border-bottom: 1px solid #f3f4f6;
}
.modal-card__title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}
.modal-card__close {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-secondary);
  padding: 4px;
  display: flex;
  transition: color 0.15s;
}
.modal-card__close:hover { color: var(--text-primary); }
.modal-form {
  padding: 18px 20px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.form-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.form-input, .form-textarea {
  width: 100%;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 9px 12px;
  font-size: 13px;
  color: var(--text-primary);
  background: #fafbfc;
  font-family: inherit;
  transition: border-color 0.15s ease;
}
.form-input:focus, .form-textarea:focus {
  outline: none;
  border-color: var(--primary);
  background: white;
}
.form-textarea { resize: vertical; min-height: 64px; }

.stepper {
  position: relative;
  display: flex;
  align-items: center;
}
.stepper__input { padding-right: 32px; }
.stepper__input::-webkit-inner-spin-button,
.stepper__input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.stepper__input { -moz-appearance: textfield; appearance: textfield; }
.stepper__controls {
  position: absolute;
  right: 4px;
  display: flex;
  flex-direction: column;
}
.stepper__btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-secondary);
  padding: 1px 6px;
  display: flex;
  transition: color 0.15s;
}
.stepper__btn:hover { color: var(--primary); }

.modal-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 4px;
}
.btn-cancel {
  padding: 10px 16px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 700;
  background: #F3F4F6;
  color: #374151;
  border: none;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-cancel:hover { background: #e5e7eb; }

.modal-enter-active, .modal-leave-active { transition: opacity 0.2s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }

/* ===== RESPONSIVE ===== */
@media (max-width: 768px) {
  .drives-page { padding: 16px; }
  .header-row { flex-direction: column; align-items: stretch; }
  .stats-row { grid-template-columns: 1fr; }
  .filter-bar { flex-direction: column; align-items: stretch; }
  .filter-options { justify-content: center; }
  .drive-card__actions { flex-direction: column; align-items: stretch; }
  .drive-card__actions a { text-align: center; }
  .form-row { grid-template-columns: 1fr; }
}
</style>