<template>
  <div class="sop-page">
    <header class="sop-page__header">
      <div>
        <h1 class="sop-page__title">Confirmatory SOP</h1>
        <p class="sop-page__subtitle">
          What becomes of a donor after a reactive screen, marker by marker, once the confirmatory result is documented.
          Transcribe the centre's own approved SOP: RedAgos supplies no rules, and no decision can be recorded until a
          version is approved here.
        </p>
      </div>
      <div class="header-actions">
        <button type="button" class="btn btn--ghost" :disabled="busy" @click="load">
          <AssetIcon name="refresh-cw" :size="14" :class="{ spin: busy }" />
          {{ busy ? 'Loading…' : 'Refresh' }}
        </button>
      </div>
    </header>

    <div v-if="banner" class="alert" :class="`alert--${bannerKind}`" role="status">
      <AssetIcon :name="bannerKind === 'success' ? 'circle-check-big' : 'circle-alert'" :size="16" />
      <span>{{ banner }}</span>
    </div>

    <section class="card">
      <div class="in-force">
        <AssetIcon name="shield-check" :size="16" />
        <p v-if="current">
          In force: <strong>version {{ current.version }}</strong> · {{ current.document_reference }}
          · approved by {{ current.approved_by || '—' }} on {{ formatDate(current.approved_at) }}
        </p>
        <p v-else>No version approved yet. Reactive donors stay deferred pending confirmatory testing until one is.</p>
      </div>

      <form class="sop-form" novalidate @submit.prevent="approve">
        <div class="sop-form__meta">
          <label class="field">
            <span class="field__label">SOP document</span>
            <input v-model="documentReference" class="field__input" maxlength="120" placeholder="e.g. SOP-TTI-07 rev 3">
          </label>
          <label class="field">
            <span class="field__label">Notes <span class="field__optional">optional</span></span>
            <input v-model="notes" class="field__input" maxlength="2000">
          </label>
        </div>

        <div class="table-wrap">
          <table class="rules">
            <thead>
              <tr>
                <th scope="col">Marker</th>
                <th scope="col">Confirmatory result</th>
                <th scope="col">The donor is</th>
                <th scope="col">Days</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="rule in rules" :key="`${rule.marker}-${rule.outcome}`" :class="{ 'rules__first': rule.outcome === 'positive' }">
                <th scope="row">{{ rule.outcome === 'positive' ? markerLabel(rule.marker) : '' }}</th>
                <td>{{ outcomeLabel(rule.outcome) }}</td>
                <td>
                  <select v-model="rule.decision" class="field__input" :aria-label="`${markerLabel(rule.marker)}, ${outcomeLabel(rule.outcome)}: decision`">
                    <option value="" disabled>Choose…</option>
                    <option v-for="option in SOP_DECISIONS" :key="option.value" :value="option.value">{{ option.label }}</option>
                  </select>
                </td>
                <td>
                  <label v-if="rule.decision === 'temporarily_deferred'" class="days">
                    <input v-model="rule.deferral_days" type="number" min="1" max="36500" class="field__input" :aria-label="`${markerLabel(rule.marker)}, ${outcomeLabel(rule.outcome)}: days deferred`">
                    <span>days deferred</span>
                  </label>
                  <label v-else-if="rule.decision === 'indeterminate'" class="days">
                    <input v-model="rule.retest_after_days" type="number" min="1" max="3650" class="field__input" :aria-label="`${markerLabel(rule.marker)}, ${outcomeLabel(rule.outcome)}: days to retest`">
                    <span>days to retest</span>
                  </label>
                  <span v-else class="muted">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p class="hint">
          Days count from the date on the confirmatory report. When markers point different ways, the stricter outcome
          wins, and a marker still without a result keeps the donor pending. Whatever the outcome, the reactive unit stays
          rejected.
        </p>

        <ul v-if="problems.length && attempted" class="problems" role="alert">
          <li v-for="problem in problems" :key="problem">{{ problem }}</li>
        </ul>

        <div class="actions">
          <button type="submit" class="btn btn--primary" :disabled="saving">
            {{ saving ? 'Approving…' : `Approve as version ${nextVersion}` }}
          </button>
          <span class="muted">It takes effect at once. Earlier decisions keep the version they were made under.</span>
        </div>
      </form>
    </section>

    <section v-if="history.length" class="card">
      <h2 class="card__title">Versions</h2>
      <ul class="history">
        <li v-for="version in history" :key="version.id">
          <strong>Version {{ version.version }}</strong> · {{ version.document_reference }}
          · approved by {{ version.approved_by || '—' }} on {{ formatDate(version.approved_at) }}
          <span v-if="version.superseded_at" class="muted"> · superseded {{ formatDate(version.superseded_at) }}</span>
          <span v-else class="badge">In force</span>
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import { CONFIRMATORY_OUTCOMES, SOP_DECISIONS, sopDraft, sopPayload, sopProblems } from '~/utils/confirmation'
import { SEROLOGY_MARKERS } from '~/utils/serology'

/**
 * The centre's marker-specific SOP for reactive donors (project owner,
 * 2026-10-25), kept and approved by the Donor Counselling Physician
 * (confirmatory_sop.configure).
 *
 *  GET  /confirmatory-sop -> { data: version in force | null, history, options }
 *  POST /confirmatory-sop   { document_reference, notes?, rules: [15 × { marker,
 *                             outcome, decision, deferral_days?, retest_after_days? }] }
 *
 * A version is never edited: approving writes the next one. The form starts
 * from the version in force, so a change is an edit of what stands.
 */

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  requires: 'confirmatory_sop.configure',
})

useHead({ title: 'Confirmatory SOP · RedAgos' })

const busy = ref(false)
const saving = ref(false)
const attempted = ref(false)
const banner = ref('')
const bannerKind = ref('success')

const current = ref(null)
const history = ref([])
const markers = ref(SEROLOGY_MARKERS)
const documentReference = ref('')
const notes = ref('')
const rules = ref(sopDraft(SEROLOGY_MARKERS))

const nextVersion = computed(() => (history.value[0]?.version ?? 0) + 1)
const problems = computed(() => sopProblems(rules.value, documentReference.value))

function markerLabel(value) {
  return markers.value.find((marker) => marker.value === value)?.label ?? value
}

function outcomeLabel(value) {
  return CONFIRMATORY_OUTCOMES.find((outcome) => outcome.value === value)?.label ?? value
}

function adopt(res) {
  current.value = res?.data ?? null
  history.value = res?.history ?? []
  if (res?.options?.markers?.length) markers.value = res.options.markers
  documentReference.value = current.value?.document_reference ?? ''
  notes.value = current.value?.notes ?? ''
  rules.value = sopDraft(markers.value, current.value?.rules ?? [])
}

async function load() {
  busy.value = true
  try {
    adopt(await bloodCenterService.confirmatorySop())
  } catch (err) {
    bannerKind.value = 'error'
    banner.value = err?.data?.message || err?.message || 'Could not load the SOP.'
  } finally {
    busy.value = false
  }
}

async function approve() {
  attempted.value = true
  if (problems.value.length) return

  saving.value = true
  banner.value = ''

  try {
    const res = await bloodCenterService.approveConfirmatorySop({
      document_reference: documentReference.value.trim(),
      notes: notes.value.trim() || null,
      rules: sopPayload(rules.value),
    })

    adopt(res)
    attempted.value = false
    bannerKind.value = 'success'
    banner.value = res?.message || 'SOP version approved.'
  } catch (err) {
    bannerKind.value = 'error'
    banner.value = Object.values(err?.data?.errors ?? {}).flat()[0] || err?.data?.message || 'Could not approve this version.'
  } finally {
    saving.value = false
  }
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(undefined, { dateStyle: 'medium' })
}

onMounted(load)
</script>

<style scoped>
.sop-page {
  font-family: var(--rb-font-sans);
  max-width: var(--rb-content-max, 1600px);
  margin: 0 auto;
  padding: 24px var(--rb-gutter, 24px) 40px;
  background: var(--rb-page-bg);
  display: flex;
  flex-direction: column;
  gap: 16px;
  color: var(--rb-text-primary);
}

.sop-page__header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.sop-page__title { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }
.sop-page__subtitle { margin: 3px 0 0; max-width: 78ch; font-size: 13px; line-height: 1.5; color: var(--rb-text-secondary); }
.header-actions { display: flex; gap: 8px; flex-shrink: 0; }

.card {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  padding: 1.1rem;
  border: 1px solid var(--rb-border);
  border-radius: 12px;
  background: var(--rb-surface);
  min-width: 0;
}

.card__title { margin: 0; font-size: 15px; font-weight: 700; }

.in-force {
  display: flex;
  gap: 0.6rem;
  align-items: flex-start;
  padding: 0.7rem 0.85rem;
  border-radius: 10px;
  border: 1px solid rgba(var(--rb-primary-rgb), 0.25);
  background: rgba(var(--rb-primary-rgb), 0.06);
  font-size: 13.5px;
  color: var(--rb-text-primary);
}

.in-force p { margin: 0; }

.sop-form { display: flex; flex-direction: column; gap: 0.85rem; }
.sop-form__meta { display: grid; grid-template-columns: minmax(12rem, 22rem) 1fr; gap: 0.75rem; }

.field { display: flex; flex-direction: column; gap: 0.3rem; min-width: 0; }
.field__label { font-size: 12px; font-weight: 600; color: var(--rb-text-primary); }
.field__optional { font-weight: 400; color: var(--rb-text-secondary); font-size: 11.5px; }

.field__input {
  width: 100%;
  padding: 0.45rem 0.6rem;
  border: 1px solid var(--rb-border-strong);
  border-radius: 8px;
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  font: inherit;
  font-size: 13.5px;
}

.field__input:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 1px; border-color: var(--rb-primary); }

.table-wrap { overflow-x: auto; }
.rules { width: 100%; border-collapse: collapse; font-size: 13.5px; }
.rules th, .rules td { padding: 0.4rem 0.55rem; text-align: left; vertical-align: middle; }
.rules thead th { font-size: 12px; font-weight: 600; color: var(--rb-text-secondary); border-bottom: 1px solid var(--rb-border); }
.rules tbody th { font-weight: 700; white-space: nowrap; }
.rules__first td, .rules__first th { border-top: 1px solid var(--rb-border); }
.rules select { min-width: 12rem; }

.days { display: inline-flex; align-items: center; gap: 0.4rem; font-size: 12.5px; color: var(--rb-text-secondary); }
.days .field__input { width: 6.5rem; }

.hint { margin: 0; font-size: 12.5px; line-height: 1.5; color: var(--rb-text-secondary); }
.muted { color: var(--rb-text-secondary); font-size: 12.5px; }

.problems {
  margin: 0;
  padding: 0.6rem 0.85rem 0.6rem 1.8rem;
  border-radius: 10px;
  background: rgba(var(--rb-accent-rgb), 0.08);
  border: 1px solid rgba(var(--rb-accent-rgb), 0.3);
  color: var(--rb-accent-text);
  font-size: 13px;
}

.actions { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; }

.history { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 0.45rem; font-size: 13.5px; }

.badge {
  margin-left: 0.4rem;
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  background: rgba(var(--rb-success-rgb), 0.12);
  color: var(--rb-success-text);
  font-size: 11.5px;
  font-weight: 600;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  border: 1px solid var(--rb-border-strong);
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  border-radius: 10px;
  padding: 0.5rem 0.95rem;
  font: inherit;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
}

.btn:hover:not(:disabled) { background: var(--rb-surface-hover); }
.btn:disabled { opacity: 0.55; cursor: not-allowed; }
.btn:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }
.btn--ghost { background: transparent; }
.btn--primary { background: var(--rb-primary); border-color: var(--rb-primary); color: #fff; }
.btn--primary:hover:not(:disabled) { background: color-mix(in srgb, var(--rb-primary) 88%, #000); }

.alert { display: flex; align-items: center; gap: 0.5rem; margin: 0; padding: 0.65rem 0.85rem; border-radius: 10px; font-size: 13.5px; }
.alert--success { background: rgba(var(--rb-success-rgb), 0.1); color: var(--rb-success-text); border: 1px solid rgba(var(--rb-success-rgb), 0.3); }
.alert--error { background: rgba(var(--rb-accent-rgb), 0.1); color: var(--rb-accent-text); border: 1px solid rgba(var(--rb-accent-rgb), 0.3); }

.spin { animation: spin 0.9s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 720px) {
  .sop-page { padding: 16px 16px 32px; }
  .sop-page__header { flex-direction: column; }
  .sop-form__meta { grid-template-columns: 1fr; }
}
</style>
