<template>
  <div class="programs-page">
    <PageHeader title="Billing Programs">
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
        <h2 id="editor-title">{{ editingId ? 'Edit billing program' : 'New billing program' }}</h2>
        <button class="icon-btn" aria-label="Close program form" @click="closeEditor"><AssetIcon name="x" :size="17" /></button>
      </div>

      <form class="program-form" @submit.prevent="save">
        <label class="field field--wide">
          <span>Name</span>
          <input v-model.trim="form.name" class="input" maxlength="100" placeholder="e.g. DOH government subsidy — Q4" required>
        </label>
        <label class="field">
          <span>Program type</span>
          <select v-model="form.kind" class="input" @change="onKindChange">
            <option v-for="type in TYPES" :key="type.value" :value="type.value">{{ type.label }}</option>
          </select>
        </label>
        <label v-if="form.kind !== 'government_subsidy'" class="field">
          <span>{{ form.kind === 'percentage_discount' ? 'Discount percentage' : 'Discount amount' }}</span>
          <div class="amount-input">
            <span>{{ form.kind === 'percentage_discount' ? '%' : '₱' }}</span>
            <input v-model.number="form.value" type="number" min="0.01" :max="form.kind === 'percentage_discount' ? 100 : 1000000" step="0.01" class="input" required>
          </div>
        </label>
        <label class="field">
          <span>Effective from</span>
          <input v-model="form.effective_from" type="date" class="input" required>
        </label>
        <label class="field">
          <span>Effective to <small>optional</small></span>
          <input v-model="form.effective_to" type="date" :min="form.effective_from || undefined" class="input">
        </label>
        <label class="field field--wide">
          <span>Internal note <small>optional</small></span>
          <input v-model.trim="form.notes" class="input" maxlength="500" placeholder="Approval reference or eligibility note">
        </label>
        <label class="enabled field--wide">
          <input v-model="form.is_enabled" type="checkbox">
          <span><strong>Program enabled</strong></span>
        </label>
        <p v-if="formError" class="form-error field--wide">{{ formError }}</p>
        <div class="form-actions field--wide">
          <button type="button" class="ui-btn" :disabled="saving" @click="closeEditor">Cancel</button>
          <button type="submit" class="ui-btn ui-btn--primary" :disabled="saving">
            {{ saving ? 'Saving…' : editingId ? 'Save program' : 'Create program' }}
          </button>
        </div>
      </form>
    </section>

    <p v-if="message" class="notice" :class="`notice--${messageTone}`">{{ message }}</p>
    <p v-if="error" class="notice notice--error">{{ error }}</p>

    <section class="program-list" aria-label="Billing programs">
      <div v-if="loading && !programs.length" v-for="n in 3" :key="n" class="skeleton" />
      <div v-else-if="!programs.length" class="empty">
        <AssetIcon name="tags" :size="28" />
        <h2>No billing programs yet</h2>
      </div>
      <article v-for="program in programs" :key="program.id" class="program" :class="{ 'program--off': !program.is_enabled }">
        <div class="program__mark" :class="`program__mark--${program.kind}`"><AssetIcon :name="iconFor(program.kind)" :size="18" /></div>
        <div class="program__body">
          <div class="program__top"><h2>{{ program.name }}</h2><span class="status" :class="statusFor(program).tone">{{ statusFor(program).label }}</span></div>
          <p>{{ typeFor(program.kind) }}<template v-if="program.value !== null"> · {{ valueFor(program) }}</template></p>
          <p class="dates"><AssetIcon name="calendar-days" :size="14" /> {{ dateRange(program) }}</p>
          <p v-if="program.notes" class="notes">{{ program.notes }}</p>
        </div>
        <button class="ui-btn ui-btn--sm" @click="edit(program)">Edit</button>
      </article>
    </section>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import PageHeader from '~/components/ui/PageHeader.vue'
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
const iconFor = (kind) => kind === 'government_subsidy' ? 'landmark' : kind === 'percentage_discount' ? 'badge-percent' : 'tag'
const valueFor = (program) => program.kind === 'percentage_discount' ? `${program.value}% off` : `₱${Number(program.value).toLocaleString(undefined, { minimumFractionDigits: 2 })} off`
const shortDate = (value) => new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
const dateRange = (program) => `${shortDate(program.effective_from)} — ${program.effective_to ? shortDate(program.effective_to) : 'until disabled'}`
const statusFor = (program) => program.is_active_now ? { label: 'Active today', tone: 'status--active' } : !program.is_enabled ? { label: 'Disabled', tone: 'status--off' } : program.effective_from > new Date().toISOString().slice(0, 10) ? { label: 'Scheduled', tone: 'status--scheduled' } : { label: 'Ended', tone: 'status--off' }

function setForm(data) { Object.assign(form, emptyForm(), data, { effective_to: data.effective_to || '' }) }
function startNew() { editingId.value = null; formError.value = ''; setForm(emptyForm()); editorOpen.value = true }
function closeEditor() { editorOpen.value = false; formError.value = '' }
function edit(program) { editingId.value = program.id; formError.value = ''; setForm(program); editorOpen.value = true }
function onKindChange() { if (form.kind === 'government_subsidy') form.value = null }

async function load() {
  loading.value = true; error.value = ''
  try { programs.value = (await bloodCenterService.billingPrograms())?.data ?? [] }
  catch (err) { error.value = firstError(err, 'Billing programs could not be loaded.') }
  finally { loading.value = false }
}

async function save() {
  formError.value = ''
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
.editor, .program { border: 1px solid var(--rb-border); border-radius: 14px; background: var(--rb-surface); }.editor { padding: 18px; }.editor__head { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 18px; }.editor h2, .program h2, .empty h2 { margin: 0; font-size: 15px; font-weight: 750; }.icon-btn { display: grid; place-items: center; flex: none; width: 34px; height: 34px; border: 0; border-radius: 9px; background: transparent; color: var(--rb-text-secondary); cursor: pointer; }.icon-btn:hover { background: var(--rb-surface-hover); color: var(--rb-text-primary); }
.program-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; max-width: 840px; }.field { min-width: 0; display: flex; flex-direction: column; gap: 6px; font-size: 12.5px; font-weight: 700; }.field--wide { grid-column: 1 / -1; }.field small { font-weight: 500; color: var(--rb-text-secondary); }.input { box-sizing: border-box; width: 100%; height: 40px; padding: 0 10px; border: 1px solid var(--rb-border-strong); border-radius: 9px; background: var(--rb-surface); color: var(--rb-text-primary); font: inherit; font-size: 13px; }.input:focus { outline: none; border-color: var(--rb-primary); box-shadow: var(--rb-focus-ring); }.amount-input { display: flex; align-items: center; height: 40px; padding-left: 11px; border: 1px solid var(--rb-border-strong); border-radius: 9px; color: var(--rb-text-secondary); background: var(--rb-surface-alt); }.amount-input .input { border: 0; background: transparent; box-shadow: none; }.enabled { flex-direction: row; align-items: flex-start; gap: 9px; padding: 10px 12px; border-radius: 10px; background: var(--rb-surface-alt); font-weight: 500; cursor: pointer; }.enabled input { width: 16px; height: 16px; margin: 1px 0 0; accent-color: var(--rb-primary); }.enabled strong { display: block; }.form-actions { display: flex; justify-content: flex-end; gap: 8px; }.form-error { margin: 0; color: var(--rb-accent-text); font-size: 12.5px; font-weight: 600; }
.notice--success { border-color: rgba(var(--rb-success-rgb), .25); background: rgba(var(--rb-success-rgb), .08); color: var(--rb-success-text); }.notice--error { border-color: rgba(var(--rb-accent-rgb), .25); background: rgba(var(--rb-accent-rgb), .08); color: var(--rb-accent-text); }
.program-list { display: flex; flex-direction: column; gap: 10px; }.program { display: flex; align-items: flex-start; gap: 14px; padding: 15px; }.program--off { opacity: .72; }.program__mark { display: grid; place-items: center; flex: none; width: 38px; height: 38px; border-radius: 10px; }.program__mark--government_subsidy { color: var(--rb-success-text); background: rgba(var(--rb-success-rgb), .12); }.program__mark--percentage_discount { color: var(--rb-primary-text); background: rgba(var(--rb-primary-rgb), .12); }.program__mark--fixed_discount { color: var(--rb-warning-text); background: rgba(var(--rb-warning-rgb), .14); }.program__body { flex: 1; min-width: 0; }.program__top { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }.program__body > p { margin: 4px 0 0; font-size: 12.5px; color: var(--rb-text-secondary); }.dates { display: inline-flex; align-items: center; gap: 6px; }.notes { max-width: 80ch; }.status { padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; }.status--active { background: rgba(var(--rb-success-rgb), .12); color: var(--rb-success-text); }.status--scheduled { background: rgba(var(--rb-primary-rgb), .12); color: var(--rb-primary-text); }.status--off { background: var(--rb-surface-alt); color: var(--rb-text-secondary); }
.empty { padding: 52px 18px; text-align: center; color: var(--rb-text-secondary); border: 1px dashed var(--rb-border-strong); border-radius: 14px; }.empty h2 { margin-top: 10px; color: var(--rb-text-primary); }.skeleton { height: 72px; border-radius: 14px; background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 50%, var(--rb-skeleton-a) 75%); background-size: 200% 100%; animation: shimmer 1.3s infinite; }@keyframes shimmer { to { background-position: -200% 0; } }.spinning { animation: spin .9s linear infinite; }@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 640px) { .program-form { grid-template-columns: 1fr; }.field--wide { grid-column: auto; }.program { gap: 10px; }.program > .ui-btn { align-self: flex-end; } }
@media (prefers-reduced-motion: reduce) { .skeleton, .spinning { animation: none; } }
</style>
