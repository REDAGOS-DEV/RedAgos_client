<template>
  <div class="programs-page">
    <PageHeader
      title="Billing Programs"
    >
      <template #actions>
        <button class="ui-btn ui-btn--primary" @click="startNew">
          <AssetIcon name="plus" :size="15" />
          Add program
        </button>
        <button class="ui-btn" :disabled="loading" aria-label="Refresh programs" @click="load">
          <AssetIcon name="refresh-cw" :size="15" :class="{ spinning: loading }" />
          Refresh
        </button>
      </template>
    </PageHeader>

    <section v-if="editorOpen" class="editor" aria-labelledby="editor-title">
      <div class="editor__head">
        <span class="editor__icon" :class="`mark--${form.kind}`" aria-hidden="true"><AssetIcon :name="iconFor(form.kind)" :size="18" /></span>
        <div class="editor__titles">
          <h2 id="editor-title">{{ editingId ? 'Edit billing program' : 'New billing program' }}</h2>
        </div>
        <button class="icon-btn" aria-label="Close program form" @click="closeEditor"><AssetIcon name="x" :size="17" /></button>
      </div>

      <form class="editor__body" @submit.prevent="save">
        <div class="program-form">
          <label class="field field--wide">
            <span>Name</span>
            <input v-model.trim="form.name" class="input" maxlength="100" placeholder="e.g. DOH government subsidy, Q4" required>
          </label>
          <div class="field">
            <label for="program-kind">Program type</label>
            <SelectField id="program-kind" v-model="form.kind" :options="TYPES" />
          </div>
          <label v-if="form.kind !== 'government_subsidy'" class="field">
            <span>{{ form.kind === 'percentage_discount' ? 'Discount percentage' : 'Discount amount' }}</span>
            <div class="amount-input">
              <span>{{ form.kind === 'percentage_discount' ? '%' : '₱' }}</span>
              <input v-model.number="form.value" type="number" min="0.01" :max="form.kind === 'percentage_discount' ? 100 : 1000000" step="0.01" class="input" required>
            </div>
          </label>
          <p v-else class="field field--hint">
            <AssetIcon name="info" :size="14" />
            A subsidy has no amount: it covers the patient's invoice while it is in effect.
          </p>
          <div class="field">
            <label for="program-from">Effective from</label>
            <DatePicker id="program-from" v-model="form.effective_from" :max="form.effective_to || undefined" placeholder="Start date" />
          </div>
          <div class="field">
            <label for="program-to">Effective to <small>optional</small></label>
            <DatePicker id="program-to" v-model="form.effective_to" :min="form.effective_from || undefined" placeholder="Until disabled" />
          </div>
          <label class="field field--wide">
            <span>Internal note <small>optional</small></span>
            <input v-model.trim="form.notes" class="input" maxlength="500" placeholder="Approval reference or eligibility note">
          </label>
          <label class="enabled field--wide">
            <input v-model="form.is_enabled" type="checkbox" class="switch">
            <span>
              <strong>Program enabled</strong>
              <small>{{ form.is_enabled ? 'Applies between its dates.' : 'Kept on file, applied to nothing.' }}</small>
            </span>
          </label>
        </div>

        <!-- What the program will do, said in words as it is filled in (2026-10-27). -->
        <aside class="preview" aria-live="polite">
          <p class="preview__label">How it will read</p>
          <div class="preview__card">
            <span class="program__mark" :class="`mark--${form.kind}`"><AssetIcon :name="iconFor(form.kind)" :size="18" /></span>
            <div class="preview__text">
              <strong>{{ form.name || 'Untitled program' }}</strong>
              <span class="preview__value">{{ previewValue }}</span>
              <span class="preview__dates"><AssetIcon name="calendar" :size="13" /> {{ previewDates }}</span>
            </div>
          </div>
          <p class="preview__note">{{ previewNote }}</p>
        </aside>

        <p v-if="formError" class="form-error">{{ formError }}</p>
        <div class="form-actions">
          <button type="button" class="ui-btn" :disabled="saving" @click="closeEditor">Cancel</button>
          <button type="submit" class="ui-btn ui-btn--primary" :disabled="saving">
            {{ saving ? 'Saving…' : editingId ? 'Save program' : 'Create program' }}
          </button>
        </div>
      </form>
    </section>

    <p v-if="message" class="notice" :class="`notice--${messageTone}`">{{ message }}</p>
    <p v-if="error" class="notice notice--error">{{ error }}</p>

    <!-- Where the programs stand; each chip a filter. -->
    <div v-if="programs.length" class="tally" role="group" aria-label="Show programs">
      <button
        v-for="t in tally"
        :key="t.key"
        type="button"
        class="tally__chip"
        :class="[`tally__chip--${t.key}`, { 'tally__chip--on': filter === t.key }]"
        :aria-pressed="filter === t.key"
        @click="filter = t.key"
      >
        {{ t.label }}
        <span class="tally__count">{{ t.count }}</span>
      </button>
    </div>

    <section class="program-list" aria-label="Billing programs">
      <template v-if="loading && !programs.length">
        <div v-for="n in 3" :key="n" class="skeleton" />
      </template>
      <div v-else-if="!programs.length" class="bp-empty">
        <span class="bp-empty__icon" aria-hidden="true"><AssetIcon name="badge-check" :size="24" /></span>
        <h2 class="bp-empty__title">No billing programs yet</h2>
        <p class="bp-empty__text">
          Add a government subsidy, a percentage discount or a fixed-amount promo. Each one comes off patient invoices between the dates you set. Start with Add program above.
        </p>
      </div>
      <p v-else-if="!shownPrograms.length" class="list-empty">
        No program here.
        <button type="button" class="link-btn" @click="filter = 'all'">Show all programs</button>
      </p>
      <article
        v-for="program in shownPrograms"
        :key="program.id"
        class="program"
        :class="[`program--${statusFor(program).key}`, { 'program--editing': editorOpen && editingId === program.id }]"
      >
        <div class="program__head">
          <span class="program__mark" :class="`mark--${program.kind}`"><AssetIcon :name="iconFor(program.kind)" :size="18" /></span>
          <div class="program__titles">
            <h2>{{ program.name }}</h2>
            <span class="program__type">{{ typeFor(program.kind) }}</span>
          </div>
          <span class="status" :class="statusFor(program).tone">
            <span class="status__dot" aria-hidden="true" />
            {{ statusFor(program).label }}
          </span>
        </div>
        <p class="program__value">{{ program.value !== null ? valueFor(program) : 'Covers the invoice' }}</p>
        <p class="dates"><AssetIcon name="calendar" :size="14" /> {{ dateRange(program) }}</p>
        <p v-if="program.notes" class="notes">{{ program.notes }}</p>
        <div class="program__foot">
          <button class="ui-btn ui-btn--sm" @click="edit(program)">
            <AssetIcon name="pencil" :size="13" />
            Edit
          </button>
        </div>
      </article>
    </section>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import PageHeader from '~/components/ui/PageHeader.vue'
import SelectField from '~/components/common/SelectField.vue'
import DatePicker from '~/components/common/DatePicker.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'

definePageMeta({ middleware: ['auth', 'department'], layout: 'blood-centerdashboard', requires: 'billing.prices' })
useHead({ title: 'Billing Programs · RedAgos' })

const TYPES = [
  { value: 'government_subsidy', label: 'Government subsidy' },
  { value: 'percentage_discount', label: 'Percentage discount' },
  { value: 'fixed_discount', label: 'Fixed-amount discount / promo' },
]
const programs = ref([])
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const message = ref('')
const messageTone = ref('success')
const editorOpen = ref(false)
const editingId = ref(null)
const formError = ref('')
const emptyForm = () => ({ name: '', kind: 'government_subsidy', value: null, effective_from: new Date().toISOString().slice(0, 10), effective_to: '', notes: '', is_enabled: true })
const form = reactive(emptyForm())

const firstError = (err, fallback) => err?.data?.message || Object.values(err?.data?.errors ?? {}).flat()[0] || err?.message || fallback
const typeFor = (kind) => TYPES.find((type) => type.value === kind)?.label || 'Billing program'
const iconFor = (kind) => kind === 'government_subsidy' ? 'shield-check' : kind === 'percentage_discount' ? 'trending-down' : 'philippine-peso'
const valueFor = (program) => program.kind === 'percentage_discount' ? `${program.value}% off` : `₱${Number(program.value).toLocaleString(undefined, { minimumFractionDigits: 2 })} off`
const shortDate = (value) => new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
const dateRange = (program) => `${shortDate(program.effective_from)} – ${program.effective_to ? shortDate(program.effective_to) : 'until disabled'}`
const statusFor = (program) => program.is_active_now ? { key: 'active', label: 'Active today', tone: 'status--active' } : !program.is_enabled ? { key: 'off', label: 'Disabled', tone: 'status--off' } : program.effective_from > new Date().toISOString().slice(0, 10) ? { key: 'scheduled', label: 'Scheduled', tone: 'status--scheduled' } : { key: 'off', label: 'Ended', tone: 'status--off' }

// ── Where the programs stand, each chip a filter (2026-10-27) ──
const filter = ref('all')
const tally = computed(() => {
  const count = (key) => programs.value.filter((program) => statusFor(program).key === key).length

  return [
    { key: 'all', label: 'All', count: programs.value.length },
    { key: 'active', label: 'Active today', count: count('active') },
    { key: 'scheduled', label: 'Scheduled', count: count('scheduled') },
    { key: 'off', label: 'Ended or disabled', count: count('off') },
  ]
})
const shownPrograms = computed(() => filter.value === 'all' ? programs.value : programs.value.filter((program) => statusFor(program).key === filter.value))

// ── The form, said in words ──
const previewValue = computed(() => {
  if (form.kind === 'government_subsidy') return 'Covers the invoice'
  const value = Number(form.value)
  if (!Number.isFinite(value) || value <= 0) return form.kind === 'percentage_discount' ? '–% off' : '₱– off'

  return valueFor({ kind: form.kind, value })
})
const previewDates = computed(() => form.effective_from ? dateRange(form) : 'Pick a start date')
const previewNote = computed(() => {
  if (!form.is_enabled) return 'Disabled: kept on file, taken off no invoice.'
  if (form.kind === 'government_subsidy') return 'While in effect, patient invoices are met by the subsidy.'
  if (form.kind === 'percentage_discount') return `On a ₱1,500.00 invoice, the patient would pay ₱${(1500 * (1 - Math.min(Number(form.value) || 0, 100) / 100)).toLocaleString(undefined, { minimumFractionDigits: 2 })}.`

  return `On a ₱1,500.00 invoice, the patient would pay ₱${Math.max(1500 - (Number(form.value) || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}.`
})

function setForm(data) { Object.assign(form, emptyForm(), data, { effective_to: data.effective_to || '' }) }
function startNew() { editingId.value = null; formError.value = ''; setForm(emptyForm()); editorOpen.value = true }
function closeEditor() { editorOpen.value = false; formError.value = '' }
function edit(program) {
  editingId.value = program.id; formError.value = ''; setForm(program); editorOpen.value = true
  nextTick(() => document.querySelector('.editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}
// A subsidy carries no amount (was the select's @change; SelectField has v-model only).
watch(() => form.kind, (kind) => { if (kind === 'government_subsidy') form.value = null })

async function load() {
  loading.value = true; error.value = ''
  try { programs.value = (await bloodCenterService.billingPrograms())?.data ?? [] }
  catch (err) { error.value = firstError(err, 'Billing programs could not be loaded.') }
  finally { loading.value = false }
}

async function save() {
  formError.value = ''
  if (!form.effective_from) { formError.value = 'Choose the date the program starts.'; return }
  if (form.kind !== 'government_subsidy' && (!Number.isFinite(Number(form.value)) || Number(form.value) <= 0)) { formError.value = 'Enter a discount value above zero.'; return }
  if (form.kind === 'percentage_discount' && Number(form.value) > 100) { formError.value = 'A percentage discount cannot be above 100%.'; return }
  if (form.effective_to && form.effective_to < form.effective_from) { formError.value = 'The end date cannot be before the start date.'; return }
  saving.value = true
  const payload = { ...form, value: form.kind === 'government_subsidy' ? null : Number(form.value), effective_to: form.effective_to || null }
  try {
    const response = editingId.value ? await bloodCenterService.updateBillingProgram(editingId.value, payload) : await bloodCenterService.createBillingProgram(payload)
    message.value = response?.message || 'Billing program saved.'; messageTone.value = 'success'; closeEditor(); await load()
  } catch (err) { formError.value = firstError(err, 'The billing program could not be saved.') }
  finally { saving.value = false }
}

onMounted(load)
</script>

<style scoped>
.programs-page { max-width: var(--rb-content-max, 1600px); margin: 0 auto; padding: 24px var(--rb-gutter, 24px) 40px; display: flex; flex-direction: column; gap: 16px; color: var(--rb-text-primary); }
.notice { display: flex; align-items: flex-start; gap: 9px; margin: 0; padding: 12px 14px; border: 1px solid rgba(var(--rb-primary-rgb), .2); border-radius: 12px; background: rgba(var(--rb-primary-rgb), .06); color: var(--rb-primary-text); font-size: 13px; line-height: 1.5; }
.notice--success { border-color: rgba(var(--rb-success-rgb), .25); background: rgba(var(--rb-success-rgb), .08); color: var(--rb-success-text); }
.notice--error { border-color: rgba(var(--rb-accent-rgb), .25); background: rgba(var(--rb-accent-rgb), .08); color: var(--rb-accent-text); }

/* Program kinds: one tone each. */
.mark--government_subsidy { color: var(--rb-success-text); background: rgba(var(--rb-success-rgb), .12); }
.mark--percentage_discount { color: var(--rb-primary-text); background: rgba(var(--rb-primary-rgb), .12); }
.mark--fixed_discount { color: var(--rb-warning-text); background: rgba(var(--rb-warning-rgb), .14); }

/* The editor: the form, and beside it what the program will read as. */
.editor { border: 1px solid var(--rb-border); border-radius: 16px; background: var(--rb-surface); box-shadow: 0 6px 20px rgba(var(--rb-shadow-rgb), .06); overflow: hidden; }
.editor__head { display: flex; align-items: center; gap: 12px; padding: 16px 18px; border-bottom: 1px solid var(--rb-border); }
.editor__icon { display: grid; place-items: center; flex: none; width: 38px; height: 38px; border-radius: 11px; }
.editor__titles { flex: 1; min-width: 0; }
.editor h2 { margin: 0; font-size: 15px; font-weight: 750; }
.icon-btn { display: grid; place-items: center; flex: none; width: 34px; height: 34px; border: 0; border-radius: 9px; background: transparent; color: var(--rb-text-secondary); cursor: pointer; }
.icon-btn:hover { background: var(--rb-surface-hover); color: var(--rb-text-primary); }
.editor__body { display: grid; grid-template-columns: minmax(0, 1fr) 320px; grid-template-areas: "form preview" "error error" "actions actions"; gap: 18px 24px; padding: 18px; }
.program-form { grid-area: form; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; align-content: start; }
.field { min-width: 0; display: flex; flex-direction: column; gap: 6px; font-size: 12.5px; font-weight: 700; }
.field--wide { grid-column: 1 / -1; }
.field small { font-weight: 500; color: var(--rb-text-secondary); }
.field--hint { flex-direction: row; align-items: flex-start; gap: 7px; align-self: end; margin: 0; padding: 10px 12px; border-radius: 10px; background: rgba(var(--rb-success-rgb), .07); font-weight: 500; line-height: 1.45; color: var(--rb-text-secondary); }
.field--hint :deep(.asset-icon) { flex: none; margin-top: 2px; color: var(--rb-success-text); }
.input { box-sizing: border-box; width: 100%; height: 42px; padding: 0 12px; border: 1px solid var(--rb-border-strong); border-radius: 10px; background: var(--rb-surface); color: var(--rb-text-primary); font: inherit; font-size: 13px; }
.input:focus { outline: none; border-color: var(--rb-primary); box-shadow: var(--rb-focus-ring); }
.amount-input { display: flex; align-items: center; height: 42px; overflow: hidden; border: 1px solid var(--rb-border-strong); border-radius: 10px; background: var(--rb-surface); }
.amount-input:focus-within { border-color: var(--rb-primary); box-shadow: var(--rb-focus-ring); }
.amount-input > span { display: grid; place-items: center; align-self: stretch; width: 38px; border-right: 1px solid var(--rb-border); background: var(--rb-surface-alt); font-weight: 600; color: var(--rb-text-secondary); }
.amount-input .input { height: 100%; border: 0; border-radius: 0; box-shadow: none; }

/* Enabled, as a switch (still the checkbox). */
.enabled { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: 1px solid var(--rb-border); border-radius: 12px; background: var(--rb-surface-alt); cursor: pointer; }
.enabled span { display: flex; flex-direction: column; gap: 2px; font-size: 13px; }
.enabled small { font-size: 12px; color: var(--rb-text-secondary); }
.switch { position: relative; flex: none; width: 38px; height: 22px; margin: 0; border-radius: 999px; background: var(--rb-border-strong); appearance: none; cursor: pointer; transition: background-color .15s ease; }
.switch::after { content: ''; position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgba(0, 0, 0, .2); transition: transform .15s ease; }
.switch:checked { background: var(--rb-primary); }
.switch:checked::after { transform: translateX(16px); }
.switch:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }

.preview { grid-area: preview; display: flex; flex-direction: column; gap: 10px; padding: 16px; border-radius: 14px; background: var(--rb-surface-alt); }
.preview__label { margin: 0; font-size: 11.5px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--rb-text-muted); }
.preview__card { display: flex; gap: 12px; padding: 14px; border: 1px solid var(--rb-border); border-radius: 12px; background: var(--rb-surface); }
.preview__text { display: flex; flex-direction: column; gap: 4px; min-width: 0; font-size: 13px; }
.preview__text strong { overflow-wrap: anywhere; }
.preview__value { font-size: 18px; font-weight: 800; font-variant-numeric: tabular-nums; }
.preview__dates { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--rb-text-secondary); }
.preview__note { margin: 0; font-size: 12.5px; line-height: 1.5; color: var(--rb-text-secondary); }
.form-error { grid-area: error; margin: 0; color: var(--rb-accent-text); font-size: 12.5px; font-weight: 600; }
.form-actions { grid-area: actions; display: flex; justify-content: flex-end; gap: 8px; padding-top: 14px; border-top: 1px solid var(--rb-border); }

/* Filter chips. */
.tally { display: flex; flex-wrap: wrap; gap: 8px; }
.tally__chip { display: inline-flex; align-items: center; gap: 7px; height: 34px; padding: 0 12px; border: 1px solid var(--rb-border); border-radius: 999px; background: var(--rb-surface); font: inherit; font-size: 12.5px; font-weight: 600; color: var(--rb-text-secondary); cursor: pointer; }
.tally__chip:hover { border-color: var(--rb-border-hover, var(--rb-border-strong)); color: var(--rb-text-primary); }
.tally__chip:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }
.tally__chip--on, .tally__chip--on:hover { border-color: var(--rb-primary); background: rgba(var(--rb-primary-rgb), .08); color: var(--rb-primary-text); }
.tally__count { min-width: 22px; padding: 1px 7px; border-radius: 999px; background: var(--rb-surface-alt); font-size: 12px; font-weight: 800; text-align: center; color: var(--rb-text-primary); }

/* The programs, as cards. */
.program-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 14px; }
.program { display: flex; flex-direction: column; gap: 10px; padding: 16px; border: 1px solid var(--rb-border); border-radius: 16px; background: var(--rb-surface); transition: border-color .15s ease, box-shadow .15s ease; }
.program:hover { border-color: var(--rb-border-strong); box-shadow: 0 4px 14px rgba(var(--rb-shadow-rgb), .06); }
.program--active { box-shadow: inset 0 0 0 1px rgba(var(--rb-success-rgb), .35); border-color: rgba(var(--rb-success-rgb), .45); }
.program--off { background: var(--rb-surface-alt); }
.program--off .program__value, .program--off h2 { color: var(--rb-text-secondary); }
.program--editing, .program--editing:hover { border-color: var(--rb-primary); box-shadow: 0 0 0 1px var(--rb-primary); }
.program__head { display: flex; align-items: flex-start; gap: 12px; }
.program__mark { display: grid; place-items: center; flex: none; width: 38px; height: 38px; border-radius: 11px; }
.program__titles { flex: 1; min-width: 0; }
.program h2 { margin: 0; font-size: 14.5px; font-weight: 750; overflow-wrap: anywhere; }
.program__type { font-size: 12px; color: var(--rb-text-secondary); }
.program__value { margin: 2px 0 0; font-size: 22px; font-weight: 800; line-height: 1.2; font-variant-numeric: tabular-nums; }
.program > p { margin: 0; }
.dates { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--rb-text-secondary); }
.notes { padding: 8px 10px; border-radius: 9px; background: var(--rb-surface-alt); font-size: 12.5px; line-height: 1.45; color: var(--rb-text-secondary); }
.program--off .notes { background: var(--rb-surface); }
.program__foot { display: flex; justify-content: flex-end; margin-top: auto; padding-top: 10px; border-top: 1px solid var(--rb-border); }
.status { display: inline-flex; align-items: center; gap: 6px; flex: none; padding: 3px 9px; border-radius: 999px; font-size: 11.5px; font-weight: 700; white-space: nowrap; }
.status__dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.status--active { background: rgba(var(--rb-success-rgb), .12); color: var(--rb-success-text); }
.status--scheduled { background: rgba(var(--rb-primary-rgb), .12); color: var(--rb-primary-text); }
.status--off { background: var(--rb-surface); color: var(--rb-text-secondary); border: 1px solid var(--rb-border); }

/* Empty: as on Invoices and Payments. */
.bp-empty { grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 48px 24px; text-align: center; border: 1px solid var(--rb-border); border-radius: 16px; background: var(--rb-surface); }
.bp-empty__icon { display: grid; place-items: center; width: 56px; height: 56px; border-radius: 16px; background: rgba(var(--rb-primary-rgb), .08); color: var(--rb-primary-text); box-shadow: 0 0 0 6px rgba(var(--rb-primary-rgb), .04); }
.bp-empty__title { margin: 6px 0 0; font-size: 17px; font-weight: 800; }
.bp-empty__text { max-width: 500px; margin: 0; font-size: 13.5px; line-height: 1.6; color: var(--rb-text-secondary); text-wrap: pretty; }
.list-empty { grid-column: 1 / -1; margin: 0; padding: 28px 16px; text-align: center; color: var(--rb-text-secondary); }
.link-btn { margin-left: 6px; border: 0; background: none; font: inherit; font-weight: 600; color: var(--rb-primary-text); cursor: pointer; }

.skeleton { height: 150px; border-radius: 16px; background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 50%, var(--rb-skeleton-a) 75%); background-size: 200% 100%; animation: shimmer 1.3s infinite; }
@keyframes shimmer { to { background-position: -200% 0; } }
.spinning { animation: spin .9s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 1100px) { .editor__body { grid-template-columns: minmax(0, 1fr); grid-template-areas: "form" "preview" "error" "actions"; } }
@media (max-width: 640px) { .program-form { grid-template-columns: 1fr; } .field--wide { grid-column: auto; } }
@media (prefers-reduced-motion: reduce) { .skeleton, .spinning { animation: none; } .switch, .switch::after, .program { transition: none; } }
</style>
