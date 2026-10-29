<template>
  <div class="corrections">
    <PageHeader title="Corrections">
      <template #subtitle>
        Saved records are never edited directly; a change goes through a correction.
      </template>
    </PageHeader>

    <!-- The full rules, in a small card that can be put away (2026-10-27). -->
    <aside v-if="howOpen" class="how" aria-labelledby="how-title">
      <span class="how__icon" aria-hidden="true"><AssetIcon name="info" :size="16" /></span>
      <div class="how__body">
        <p id="how-title" class="how__title">How corrections work</p>
        <ul class="how__list">
          <li>Whoever entered a record requests a correction, and the department's head decides.</li>
          <li>The head's own correction is applied as soon as it is sent.</li>
          <li>An approved correction is applied under the same rules as the original.</li>
          <li>
            A unit's storage location and expiry date are the exception: the Inventory Control Officer edits them
            directly, and everyone else files a correction.
          </li>
        </ul>
      </div>
      <button type="button" class="icon-btn" aria-label="Hide how corrections work" @click="setHow(false)">
        <AssetIcon name="x" :size="15" />
      </button>
    </aside>

    <div class="toolbar">
      <!--
        In the browser only: the server renders before the user (and so
        canApprove) is known, and hydrating that left both tabs looking chosen.
      -->
      <ClientOnly>
        <div class="seg" role="tablist" aria-label="Corrections">
          <button
            v-if="canApprove"
            type="button"
            role="tab"
            class="seg__btn"
            :class="{ 'seg__btn--on': scope === 'review' }"
            :aria-selected="scope === 'review'"
            @click="switchScope('review')"
          >
            To review
            <span v-if="pendingReview" class="seg__badge">{{ pendingReview }}</span>
          </button>
          <button
            type="button"
            role="tab"
            class="seg__btn"
            :class="{ 'seg__btn--on': scope === 'mine' }"
            :aria-selected="scope === 'mine'"
            @click="switchScope('mine')"
          >
            My requests
          </button>
        </div>
        <template #fallback>
          <div class="seg seg--placeholder" aria-hidden="true" />
        </template>
      </ClientOnly>

      <!-- Status as chips: the current choice is visible without opening anything. -->
      <div class="chips" role="group" aria-label="Status">
        <button
          v-for="option in STATUS_FILTERS"
          :key="option.value"
          type="button"
          class="chip"
          :class="{ 'chip--on': statusFilter === option.value }"
          :aria-pressed="statusFilter === option.value"
          @click="setStatus(option.value)"
        >
          {{ option.label }}
        </button>
      </div>

      <button v-if="!howOpen" type="button" class="how-link" @click="setHow(true)">
        <AssetIcon name="help-circle" :size="14" />
        How corrections work
      </button>
    </div>

    <div v-if="error" class="alert alert--error" role="alert">
      <AssetIcon name="circle-alert" :size="16" />
      <span>{{ error }}</span>
    </div>
    <div v-else-if="notice" class="alert alert--notice" role="status">
      <AssetIcon name="circle-check-big" :size="16" />
      <span>{{ notice }}</span>
    </div>

    <!-- Loading: shaped like the list and the detail -->
    <div v-if="loading && !items.length" class="review" aria-busy="true">
      <ul class="queue">
        <li v-for="n in 4" :key="n" class="q-skeleton">
          <span class="skeleton skeleton--icon" />
          <span class="q-skeleton__lines"><span class="skeleton skeleton--title" /><span class="skeleton skeleton--line" /></span>
        </li>
      </ul>
      <div class="detail">
        <span class="skeleton skeleton--title" />
        <span class="skeleton skeleton--line" />
        <span class="skeleton skeleton--block" />
      </div>
    </div>

    <div v-else-if="!items.length" class="empty">
      <span class="empty__icon">
        <AssetIcon :name="scope === 'review' ? 'circle-check-big' : 'pencil'" :size="24" />
      </span>
      <p class="empty__title">{{ emptyCopy.title }}</p>
      <p class="empty__text">{{ emptyCopy.text }}</p>
    </div>

    <!--
      Master and detail (2026-10-27): the requests on the left, the one picked
      on the right with its changes and the decision. After a decision the
      next request is picked, so a queue is reviewed in one sitting.
    -->
    <div v-else class="review">
      <ul class="queue" role="listbox" aria-label="Correction requests">
        <li v-for="item in items" :key="item.id">
          <button
            type="button"
            role="option"
            class="q-item"
            :class="{ 'q-item--on': selected?.id === item.id }"
            :aria-selected="selected?.id === item.id"
            @click="select(item)"
          >
            <span class="kind-icon" :class="`kind--${kindOf(item).tone}`" aria-hidden="true"><AssetIcon :name="kindOf(item).icon" :size="16" /></span>
            <span class="q-item__body">
              <span class="q-item__title">{{ item.subject_label }}</span>
              <span class="q-item__ref">{{ item.target_label || ('Donation #' + item.donation_id) }}</span>
              <span class="q-item__meta">{{ item.requested_by || 'Unknown' }}</span>
            </span>
            <span class="q-item__side">
              <span v-if="item.status === 'pending'" class="age" :class="{ 'age--late': ageDays(item.requested_at) >= 2 }">{{ age(item.requested_at) }}</span>
              <span v-else class="pill" :class="`pill--${item.status}`">{{ statusLabel(item.status) }}</span>
            </span>
          </button>
        </li>
      </ul>

      <article v-if="selected" :key="selected.id" class="detail" :aria-labelledby="`cr-title-${selected.id}`">
        <header class="detail__head">
          <span class="kind-icon kind-icon--lg" :class="`kind--${kindOf(selected).tone}`" aria-hidden="true"><AssetIcon :name="kindOf(selected).icon" :size="20" /></span>
          <div class="detail__heading">
            <h2 :id="`cr-title-${selected.id}`" class="detail__title">
              {{ selected.subject_label }}
              <span class="detail__ref">{{ selected.target_label || ('Donation #' + selected.donation_id) }}</span>
            </h2>
            <p class="detail__meta">
              <template v-if="selected.donation_barcode">Barcode <span class="mono">{{ selected.donation_barcode }}</span> · </template>
              Requested by {{ selected.requested_by || 'Unknown' }} · {{ formatDate(selected.requested_at) }}
            </p>
          </div>
          <span class="pill" :class="`pill--${selected.status}`">{{ statusLabel(selected.status) }}</span>
        </header>

        <div class="reason">
          <AssetIcon name="file-text" :size="15" class="reason__icon" />
          <div>
            <p class="reason__label">Reason</p>
            <p class="reason__text">{{ selected.reason }}</p>
          </div>
        </div>

        <section class="changes" aria-label="Changes">
          <p class="section-label">{{ selected.changed_fields.length === 1 ? '1 change' : `${selected.changed_fields.length} changes` }}</p>
          <ul v-if="selected.changed_fields.length" class="diff">
            <li v-for="field in selected.changed_fields" :key="field" class="diff__row">
              <span class="diff__field">{{ fieldName(field) }}</span>
              <span class="diff__values">
                <span class="val val--before" :class="{ 'val--none': isEmpty(selected.previous?.[field]) }">
                  <span class="sr-only">Saved: </span>
                  <template v-if="isEmpty(selected.previous?.[field])"><i class="diff__empty">empty</i></template>
                  <template v-else>{{ display(selected.previous?.[field]) }}</template>
                </span>
                <AssetIcon name="arrow-right" :size="14" class="diff__arrow" aria-hidden="true" />
                <span class="val val--after" :class="{ 'val--none': isEmpty(selected.changes?.[field]) }">
                  <span class="sr-only">Corrected: </span>
                  <template v-if="isEmpty(selected.changes?.[field])"><i class="diff__empty">empty</i></template>
                  <template v-else>{{ display(selected.changes?.[field]) }}</template>
                </span>
              </span>
            </li>
          </ul>
          <p v-else class="detail__meta">No field differs from the saved record.</p>
        </section>

        <p v-if="selected.reviewed_by" class="decision" :class="`decision--${selected.status}`">
          <AssetIcon :name="selected.status === 'approved' ? 'circle-check-big' : 'circle-x'" :size="16" />
          <span>
            <strong>{{ selected.status === 'approved' ? 'Approved' : 'Rejected' }}</strong> by {{ selected.reviewed_by }} · {{ formatDate(selected.reviewed_at) }}
            <template v-if="selected.review_note"><br><span class="decision__note">Note: {{ selected.review_note }}</span></template>
          </span>
        </p>

        <div v-if="selected.can_decide" class="decide">
          <label v-if="noteOpen[selected.id]" class="field">
            <span class="field__label">Note <span class="field__optional">optional to approve, required to reject</span></span>
            <textarea
              :ref="(el) => { noteInputs[selected.id] = el }"
              v-model="notes[selected.id]"
              class="field__input"
              rows="2"
              maxlength="1000"
              placeholder="Why you are approving or rejecting this correction"
            />
          </label>
          <div class="actions">
            <button v-if="!noteOpen[selected.id]" type="button" class="link-btn" @click="openNote(selected)">
              <AssetIcon name="plus" :size="14" />
              Add note
            </button>
            <span v-else-if="!(notes[selected.id] || '').trim()" class="actions__hint">Add a note to reject.</span>
            <span class="actions__spacer" />
            <button
              type="button"
              class="ui-btn ui-btn--danger"
              :disabled="busy === selected.id"
              @click="rejectClicked(selected)"
            >
              <AssetIcon name="circle-x" :size="15" />
              Reject
            </button>
            <button type="button" class="ui-btn ui-btn--primary" :disabled="busy === selected.id" @click="decide(selected, 'approve')">
              <AssetIcon name="check" :size="15" />
              {{ busy === selected.id ? 'Working…' : 'Approve and apply' }}
            </button>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import PageHeader from '~/components/ui/PageHeader.vue'
import { correctionKind } from '~/utils/correctionKinds'

/**
 * Correction requests: the caller's own, and — for a department's head —
 * those waiting on their decision.
 *
 * The server decides who may decide (`can_decide`): the department's head,
 * never a peer head, and nobody else for their own request. A head's own
 * correction is applied as it is filed, so it never waits here. Approving applies the
 * change through the original write, so a request whose record has since been
 * cleared or rejected is refused and stays pending until someone rejects it.
 */

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  requires: 'corrections.request',
})

useHead({ title: 'Corrections · RedAgos' })

const { can } = useUser()
const canApprove = computed(() => can('corrections.approve'))

const scope = ref(canApprove.value ? 'review' : 'mine')
const statusFilter = ref('pending')
const items = ref([])
const loading = ref(false)
const busy = ref(null)
const error = ref(null)
const notice = ref(null)
const notes = reactive({})
const noteOpen = reactive({})
const noteInputs = {}

// ── The request picked, shown beside the list (2026-10-27) ──
const selectedId = ref(null)
const selected = computed(() => items.value.find((item) => item.id === selectedId.value) ?? items.value[0] ?? null)
let selectedIndex = 0

function select(item) {
  selectedId.value = item.id
  selectedIndex = items.value.indexOf(item)
}

// After a reload, keep the one picked; when it has gone (decided), the next in its place.
watch(items, (list) => {
  if (list.some((item) => item.id === selectedId.value)) return
  const next = list[Math.min(selectedIndex, list.length - 1)]
  selectedId.value = next?.id ?? null
})

// What each kind of record is, by its icon and colour (shared with the filing dialog).
const kindOf = (item) => correctionKind(item.subject)

// ── How long a request has waited ──
function ageDays(value) {
  const at = new Date(value)
  if (Number.isNaN(at.getTime())) return 0
  return Math.floor((Date.now() - at.getTime()) / 86400000)
}
function age(value) {
  const days = ageDays(value)
  return days <= 0 ? 'Today' : days === 1 ? '1 day' : `${days} days`
}

// ── The note: opened when wanted, and always before a reject ──
function openNote(item) {
  noteOpen[item.id] = true
  nextTick(() => noteInputs[item.id]?.focus())
}
function rejectClicked(item) {
  if (!(notes[item.id] || '').trim()) {
    openNote(item)
    return
  }
  decide(item, 'reject')
}

// ── How corrections work: put away once read, remembered on this browser ──
const HOW_KEY = 'rb.corrections.how'
const howOpen = ref(true)
function setHow(open) {
  howOpen.value = open
  try { localStorage.setItem(HOW_KEY, open ? '1' : '0') } catch { /* private window: shown again next time */ }
}
onMounted(() => {
  try { howOpen.value = localStorage.getItem(HOW_KEY) !== '0' } catch { /* keep it shown */ }
})
const pendingReview = ref(0)

const STATUS = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' }

const STATUS_FILTERS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: '', label: 'All' },
]

function setStatus(value) {
  if (statusFilter.value === value) return
  statusFilter.value = value
  selectedId.value = null
  selectedIndex = 0
  notice.value = null
  load()
}

const emptyCopy = computed(() => {
  const status = statusFilter.value ? STATUS[statusFilter.value].toLowerCase() : ''

  if (scope.value === 'review') {
    return statusFilter.value === 'pending'
      ? { title: 'Nothing is waiting for your decision', text: 'New correction requests from your department will appear here.' }
      : { title: `No ${status} corrections`, text: 'Try another status to see the rest.' }
  }

  return statusFilter.value === 'pending' || !statusFilter.value
    ? { title: 'You have not requested any corrections', text: 'To fix a saved record, open it and choose Request correction. Your request will be listed here.' }
    : { title: `No ${status} requests`, text: 'Try another status to see the rest.' }
})

function isEmpty(value) {
  return value === null || value === undefined || value === '' || (Array.isArray(value) && !value.length)
}

function statusLabel(status) {
  return STATUS[status] ?? status
}

// A payment void carries one field, whether the payment is voided.
function fieldName(field) {
  return field === 'void' ? 'voided' : field.replace(/_/g, ' ')
}

function display(value) {
  if (isEmpty(value)) return ''
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) return value.map((row) => (typeof row === 'object' ? Object.values(row).join(' / ') : row)).join('; ')
  if (typeof value === 'object') return JSON.stringify(value)

  return String(value)
}

function formatDate(value) {
  if (!value) return 'unknown date'

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? 'unknown date' : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

async function load() {
  loading.value = true
  error.value = null

  try {
    const params = { scope: scope.value, per_page: 50 }
    if (statusFilter.value) params.status = statusFilter.value

    const response = await bloodCenterService.corrections(params)
    items.value = response?.data ?? []

    if (scope.value === 'review' && statusFilter.value === 'pending') pendingReview.value = response?.total ?? items.value.length
  } catch (err) {
    error.value = err?.message || 'Could not load corrections.'
  } finally {
    loading.value = false
  }
}

function switchScope(next) {
  scope.value = next
  selectedId.value = null
  selectedIndex = 0
  notice.value = null
  load()
}

const REFUSALS = {
  self_approval: 'You cannot decide on your own correction request.',
  not_the_approver: "This correction is decided by the department's head.",
  correction_decided: 'This correction has already been decided.',
  results_cleared: 'The record was cleared since this was requested, so it can no longer be corrected. Reject it.',
  results_locked: 'The donation was rejected since this was requested. Reject the correction.',
  run_not_open: 'The serology run has been decided since this was requested. Reject the correction.',
  record_changed: 'The record has been changed since this was requested. Reject the correction and ask for it again.',
  nothing_to_correct: 'There is nothing left to correct here. Reject the correction.',
  unit_not_editable: 'The unit can no longer be edited, so this cannot be applied. Reject the correction.',
  not_dispatched: 'The unit is no longer dispatched, so there is no dispatch record to correct. Reject the correction.',
  dispatch_time_invalid: 'That release time no longer fits between when the unit was reserved and when it was received. Reject the correction.',
  billing_void: 'The invoice has been voided, so its payments can no longer be corrected. Reject the correction.',
}

async function decide(item, action) {
  busy.value = item.id
  error.value = null
  notice.value = null

  try {
    const note = (notes[item.id] || '').trim()
    const response = action === 'approve'
      ? await bloodCenterService.approveCorrection(item.id, note ? { note } : {})
      : await bloodCenterService.rejectCorrection(item.id, { note })

    notice.value = response?.message ?? null
    await load()
  } catch (err) {
    const errors = err?.data?.errors
    const first = errors && typeof errors === 'object' ? Object.values(errors).flat()[0] : null

    error.value = first || REFUSALS[err?.data?.code] || err?.data?.message || err?.message || 'That could not be done.'
  } finally {
    busy.value = null
  }
}

onMounted(load)
</script>

<style scoped>
.corrections {
  font-family: var(--rb-font-sans);
  max-width: var(--rb-content-max, 1600px);
  margin: 0 auto;
  padding: 24px var(--rb-gutter, 24px) 40px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  color: var(--rb-text-primary);
}

/* How corrections work: a small card, put away once read. */
.how { display: flex; align-items: flex-start; gap: 12px; padding: 14px 14px 14px 16px; border: 1px solid rgba(var(--rb-primary-rgb), .2); border-radius: 14px; background: rgba(var(--rb-primary-rgb), .05); }
.how__icon { display: grid; place-items: center; flex: none; width: 30px; height: 30px; border-radius: 9px; background: rgba(var(--rb-primary-rgb), .12); color: var(--rb-primary-text); }
.how__body { flex: 1; min-width: 0; }
.how__title { margin: 4px 0 0; font-size: 13.5px; font-weight: 700; color: var(--rb-text-primary); }
.how__list { margin: 6px 0 0; padding-left: 18px; font-size: 12.5px; line-height: 1.6; color: var(--rb-text-secondary); }
.how__list li + li { margin-top: 2px; }
.icon-btn { display: grid; place-items: center; flex: none; width: 30px; height: 30px; border: 0; border-radius: 8px; background: transparent; color: var(--rb-text-secondary); cursor: pointer; }
.icon-btn:hover { background: rgba(var(--rb-primary-rgb), .08); color: var(--rb-text-primary); }
.how-link { display: inline-flex; align-items: center; gap: 6px; margin-left: auto; border: 0; background: none; font: inherit; font-size: 12.5px; font-weight: 600; color: var(--rb-primary-text); cursor: pointer; }

/* Tabs as one control, then the status chips. */
.toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.seg { display: inline-flex; padding: 3px; border: 1px solid var(--rb-border); border-radius: 12px; background: var(--rb-surface); }
.seg__btn { display: inline-flex; align-items: center; gap: 7px; height: 32px; padding: 0 14px; border: 0; border-radius: 9px; background: transparent; font: inherit; font-size: 13px; font-weight: 600; color: var(--rb-text-secondary); cursor: pointer; }
.seg__btn:hover:not(.seg__btn--on) { color: var(--rb-text-primary); background: var(--rb-surface-hover); }
.seg__btn--on { background: var(--rb-primary); color: #fff; }
.seg__badge { min-width: 20px; padding: 1px 7px; border-radius: 999px; background: rgba(var(--rb-warning-rgb), .18); color: var(--rb-warning-text); font-size: 11px; font-weight: 800; text-align: center; }
.seg__btn--on .seg__badge { background: rgba(255, 255, 255, .22); color: #fff; }

.chips { display: flex; gap: 6px; flex-wrap: wrap; }
.chip { height: 32px; padding: 0 13px; border: 1px solid var(--rb-border); border-radius: 999px; background: var(--rb-surface); color: var(--rb-text-secondary); font: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer; transition: background-color .15s ease, border-color .15s ease, color .15s ease; }
.chip:hover { border-color: var(--rb-border-strong); color: var(--rb-text-primary); }
.chip--on, .chip--on:hover { border-color: rgba(var(--rb-primary-rgb), .4); background: rgba(var(--rb-primary-rgb), .08); color: var(--rb-primary-text); }
.seg__btn:focus-visible, .chip:focus-visible, .q-item:focus-visible, .how-link:focus-visible, .link-btn:focus-visible, .icon-btn:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }

/* Alerts */
.alert { display: flex; align-items: center; gap: 8px; margin: 0; padding: 11px 14px; border-radius: 10px; font-size: 13px; font-weight: 500; }
.alert--error { background: rgba(var(--rb-accent-rgb), .08); color: var(--rb-accent-text); }
.alert--notice { background: rgba(var(--rb-success-rgb), .08); color: var(--rb-success-text); }

/* Empty: as on Invoices and Payments. */
.empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 48px 24px; border: 1px solid var(--rb-border); border-radius: 16px; background: var(--rb-surface); text-align: center; }
.empty__icon { display: grid; place-items: center; width: 56px; height: 56px; border-radius: 16px; background: rgba(var(--rb-primary-rgb), .08); color: var(--rb-primary-text); box-shadow: 0 0 0 6px rgba(var(--rb-primary-rgb), .04); }
.empty__title { margin: 6px 0 0; font-size: 17px; font-weight: 800; }
.empty__text { margin: 0; max-width: 480px; font-size: 13.5px; line-height: 1.6; color: var(--rb-text-secondary); text-wrap: pretty; }

/* ── Master and detail ── */
.review { display: grid; grid-template-columns: minmax(280px, 360px) minmax(0, 1fr); gap: 16px; align-items: start; }
.queue { position: sticky; top: 80px; display: flex; flex-direction: column; gap: 2px; max-height: calc(100dvh - 120px); margin: 0; padding: 6px; overflow-y: auto; list-style: none; border: 1px solid var(--rb-border); border-radius: 16px; background: var(--rb-surface); }
.q-item { display: flex; align-items: flex-start; gap: 11px; width: 100%; padding: 11px 12px; border: 0; border-radius: 11px; background: transparent; font: inherit; text-align: left; color: inherit; cursor: pointer; transition: background-color .12s ease; }
.q-item:hover { background: var(--rb-surface-hover); }
.q-item--on, .q-item--on:hover { background: rgba(var(--rb-primary-rgb), .08); box-shadow: inset 0 0 0 1px rgba(var(--rb-primary-rgb), .3); }
.q-item__body { display: flex; flex: 1; flex-direction: column; gap: 1px; min-width: 0; }
.q-item__title { font-size: 13.5px; font-weight: 700; }
.q-item__ref { overflow: hidden; font-family: var(--rb-font-mono); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; color: var(--rb-text-secondary); }
.q-item__meta { font-size: 12px; color: var(--rb-text-muted); }
.q-item__side { flex: none; padding-top: 2px; }

.kind-icon { display: grid; place-items: center; flex: none; width: 34px; height: 34px; border-radius: 10px; }
.kind-icon--lg { width: 44px; height: 44px; border-radius: 13px; }
.kind--red { background: rgba(var(--rb-accent-rgb), .1); color: var(--rb-accent-text); }
.kind--purple { background: rgba(var(--rb-purple-rgb, 124, 58, 237), .1); color: rgb(var(--rb-purple-rgb, 124, 58, 237)); }
.kind--blue { background: rgba(var(--rb-primary-rgb), .1); color: var(--rb-primary-text); }
.kind--green { background: rgba(var(--rb-success-rgb), .12); color: var(--rb-success-text); }
.kind--amber { background: rgba(var(--rb-warning-rgb), .14); color: var(--rb-warning-text); }

.age { padding: 2px 8px; border-radius: 999px; background: var(--rb-surface-alt); font-size: 11.5px; font-weight: 700; white-space: nowrap; color: var(--rb-text-secondary); }
.age--late { background: rgba(var(--rb-warning-rgb), .16); color: var(--rb-warning-text); }

.detail { display: flex; flex-direction: column; gap: 18px; min-width: 0; padding: 20px 22px; border: 1px solid var(--rb-border); border-radius: 16px; background: var(--rb-surface); }
.detail__head { display: flex; align-items: flex-start; gap: 14px; }
.detail__heading { flex: 1; min-width: 0; }
.detail__title { margin: 0; font-size: 17px; font-weight: 800; }
.detail__ref { margin-left: 6px; font-family: var(--rb-font-mono); font-size: 13px; font-weight: 600; color: var(--rb-text-secondary); }
.detail__meta { margin: 4px 0 0; font-size: 12.5px; color: var(--rb-text-secondary); }

.reason { display: flex; gap: 10px; padding: 12px 14px; border-radius: 12px; background: var(--rb-surface-alt); }
.reason__icon { flex: none; margin-top: 2px; color: var(--rb-text-muted); }
.reason__label, .section-label { margin: 0; font-size: 12px; font-weight: 700; color: var(--rb-text-secondary); }
.reason__text { margin: 3px 0 0; font-size: 14px; line-height: 1.55; }

/* Saved → corrected: each change on one line. */
.changes { display: flex; flex-direction: column; gap: 8px; }
.diff { display: flex; flex-direction: column; margin: 0; padding: 0; list-style: none; border: 1px solid var(--rb-border); border-radius: 12px; }
.diff__row { display: grid; grid-template-columns: minmax(120px, 200px) minmax(0, 1fr); align-items: center; gap: 12px; padding: 11px 14px; border-top: 1px solid var(--rb-border); }
.diff__row:first-child { border-top: 0; }
.diff__field { font-size: 13px; font-weight: 600; text-transform: capitalize; color: var(--rb-text-secondary); }
.diff__values { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; min-width: 0; }
.val { padding: 3px 10px; border-radius: 8px; font-size: 13px; overflow-wrap: anywhere; }
.val--before { background: rgba(var(--rb-accent-rgb), .07); color: var(--rb-accent-text); text-decoration: line-through; text-decoration-color: rgba(var(--rb-accent-rgb), .5); }
.val--after { background: rgba(var(--rb-success-rgb), .1); font-weight: 700; color: var(--rb-success-text); }
.diff__arrow { flex: none; color: var(--rb-text-muted); }
.diff__empty { font-style: italic; font-weight: 500; }

.decision { display: flex; align-items: flex-start; gap: 8px; margin: 0; padding: 11px 14px; border-radius: 12px; font-size: 13px; }
.decision--approved { background: rgba(var(--rb-success-rgb), .08); color: var(--rb-success-text); }
.decision--rejected { background: rgba(var(--rb-accent-rgb), .07); color: var(--rb-accent-text); }
.decision :deep(svg) { flex-shrink: 0; margin-top: 1px; }
.decision__note { color: var(--rb-text-primary); }

/* The decision, at the foot of the detail. */
.decide { display: flex; flex-direction: column; gap: 10px; padding-top: 16px; border-top: 1px solid var(--rb-border); }
.field { display: flex; flex-direction: column; gap: 6px; }
.field__label { font-size: 12.5px; font-weight: 600; }
.field__optional { margin-left: 4px; font-weight: 500; color: var(--rb-text-secondary); }
.field__input { padding: 10px 12px; border: 1px solid var(--rb-border-strong); border-radius: 10px; background: var(--rb-surface); color: var(--rb-text-primary); font: inherit; font-size: 13px; resize: vertical; }
.field__input::placeholder { color: var(--rb-placeholder); }
.field__input:focus { outline: none; border-color: var(--rb-primary); box-shadow: var(--rb-focus-ring); }
.actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.actions__spacer { flex: 1; }
.actions__hint { font-size: 12.5px; color: var(--rb-text-secondary); }
.link-btn { display: inline-flex; align-items: center; gap: 5px; padding: 6px 4px; border: 0; border-radius: 6px; background: none; font: inherit; font-size: 13px; font-weight: 600; color: var(--rb-primary-text); cursor: pointer; }

.pill { padding: 3px 10px; border-radius: 999px; font-size: 11.5px; font-weight: 700; white-space: nowrap; }
.pill--pending { background: rgba(var(--rb-warning-rgb), .14); color: var(--rb-warning-text); }
.pill--approved { background: rgba(var(--rb-success-rgb), .12); color: var(--rb-success-text); }
.pill--rejected { background: rgba(var(--rb-accent-rgb), .12); color: var(--rb-accent-text); }

.mono { font-family: var(--rb-font-mono); }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }

/* Skeleton */
.q-skeleton { display: flex; gap: 11px; padding: 11px 12px; }
.q-skeleton__lines { display: flex; flex: 1; flex-direction: column; gap: 6px; }
.skeleton { display: block; height: 12px; border-radius: 6px; background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 37%, var(--rb-skeleton-a) 63%); background-size: 400% 100%; animation: corrections-shimmer 1.4s ease infinite; }
.skeleton--icon { flex: none; width: 34px; height: 34px; border-radius: 10px; }
.skeleton--title { width: 40%; height: 14px; }
.skeleton--line { width: 65%; }
.skeleton--block { height: 120px; border-radius: 12px; }
@keyframes corrections-shimmer { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }

@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none; }
  .chip, .q-item { transition: none; }
}

@media (max-width: 900px) {
  .review { grid-template-columns: 1fr; }
  .queue { position: static; max-height: none; }
  .diff__row { grid-template-columns: 1fr; gap: 6px; }
}
.seg--placeholder { width: 220px; height: 40px; }
/* Reject as an outline beside the one filled action, Approve. */
.actions .ui-btn--danger { border: 1px solid rgba(var(--rb-accent-rgb), .4); background: var(--rb-surface); color: var(--rb-accent-text); }
.actions .ui-btn--danger:hover:not(:disabled) { background: rgba(var(--rb-accent-rgb), .06); }
.val--none, .val--none.val--before { background: var(--rb-surface-alt); font-weight: 500; color: var(--rb-text-muted); text-decoration: none; }
</style>
