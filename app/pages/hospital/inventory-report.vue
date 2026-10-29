<template>
  <div class="report">
    <!-- ============ HEADER ============ -->
    <header class="hero">
      <span class="hero__icon" aria-hidden="true"><AssetIcon name="file-text" :size="24" /></span>
      <div class="hero__text">
        <h1 class="hero__title">Inventory Report</h1>
        <p class="hero__sub">Choose the components and blood types to cover, then generate the blood bank's inventory sheet.</p>
      </div>
      <p class="hero__tag" aria-hidden="true">
        <AssetIcon name="blood-drop" :size="26" class="hero__drop" />
        <span>Safe Blood.<br>Healthier Communities.</span>
      </p>
      <svg class="hero__wave" viewBox="0 0 600 120" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 80 C 120 40, 240 120, 360 80 S 540 40, 600 70 L 600 120 L 0 120 Z" />
      </svg>
    </header>

    <div v-if="error" class="alert" role="alert">
      <AssetIcon name="circle-alert" :size="16" />
      <span>{{ error }}</span>
    </div>

    <!-- ============ SETTINGS / GENERATED REPORTS ============ -->
    <section class="panel">
      <div class="tabs" role="tablist" aria-label="Inventory report">
        <button
          id="tab-settings"
          type="button"
          role="tab"
          class="tabs__tab"
          :class="{ 'tabs__tab--on': tab === 'settings' }"
          :aria-selected="tab === 'settings'"
          aria-controls="panel-settings"
          @click="tab = 'settings'"
        >
          <AssetIcon name="settings" :size="15" /> Report Settings
        </button>
        <button
          id="tab-history"
          type="button"
          role="tab"
          class="tabs__tab"
          :class="{ 'tabs__tab--on': tab === 'history' }"
          :aria-selected="tab === 'history'"
          aria-controls="panel-history"
          @click="openHistory"
        >
          <AssetIcon name="file-text" :size="15" /> Generated Reports
          <span v-if="historyTotal" class="tabs__count">{{ historyTotal }}</span>
        </button>
      </div>

      <!-- Settings: chosen before anything is drawn (project owner, 2026-10-28) -->
      <div v-show="tab === 'settings'" id="panel-settings" role="tabpanel" aria-labelledby="tab-settings">
        <div v-if="optionsLoading" class="setting" aria-busy="true">
          <span class="skeleton skeleton--line" style="width: 60%" />
          <span class="skeleton skeleton--line" style="width: 45%" />
        </div>

        <template v-else>
          <div class="setting" role="group" aria-labelledby="set-components">
            <span class="setting__icon" aria-hidden="true"><AssetIcon name="flask-conical" :size="17" /></span>
            <div class="setting__body">
              <div class="setting__head">
                <span>
                  <span id="set-components" class="setting__title">Blood Components</span>
                  <span class="setting__sub">Select the components to include in the report.</span>
                </span>
              </div>
              <button type="button" class="select-all" :aria-pressed="allComponents" @click="toggleAll('components')">
                <AssetIcon :name="allComponents ? 'check-circle' : 'circle'" :size="15" /> Select All
              </button>
              <div class="checks">
                <label v-for="component in componentOptions" :key="component.id" class="check" :class="{ 'check--on': config.components.includes(component.id) }" :title="component.name">
                  <input v-model="config.components" type="checkbox" :value="component.id" class="check__input">
                  <span class="check__box" aria-hidden="true"><AssetIcon name="check" :size="12" /></span>
                  {{ componentLabel(component) }}
                </label>
              </div>
            </div>
          </div>

          <div class="setting" role="group" aria-labelledby="set-types">
            <span class="setting__icon" aria-hidden="true"><AssetIcon name="blood-drop" :size="17" /></span>
            <div class="setting__body">
              <div class="setting__head">
                <span>
                  <span id="set-types" class="setting__title">Blood Types</span>
                  <span class="setting__sub">Select the blood types to include in the report.</span>
                </span>
              </div>
              <button type="button" class="select-all" :aria-pressed="allTypes" @click="toggleAll('bloodTypes')">
                <AssetIcon :name="allTypes ? 'check-circle' : 'circle'" :size="15" /> Select All
              </button>
              <div class="checks">
                <label v-for="type in typeOptions" :key="type.id" class="check check--type" :class="{ 'check--on': config.bloodTypes.includes(type.id) }">
                  <input v-model="config.bloodTypes" type="checkbox" :value="type.id" class="check__input">
                  <span class="check__box" aria-hidden="true"><AssetIcon name="check" :size="12" /></span>
                  {{ displayType(type.code) }}
                </label>
              </div>
            </div>
          </div>

          <div class="setting" role="group" aria-labelledby="set-sheets">
            <span class="setting__icon" aria-hidden="true"><AssetIcon name="file-text" :size="17" /></span>
            <div class="setting__body">
              <div class="setting__head">
                <span>
                  <span id="set-sheets" class="setting__title">Sheets</span>
                  <span class="setting__sub">Choose how you want to organize the report.</span>
                </span>
              </div>
              <div class="layouts" role="radiogroup" aria-label="Sheets">
                <label v-for="option in LAYOUTS" :key="option.value" class="layout" :class="{ 'layout--on': config.by === option.value }">
                  <input v-model="config.by" type="radio" name="report-layout" :value="option.value" class="check__input">
                  <span class="layout__icon" aria-hidden="true"><AssetIcon :name="option.icon" :size="18" /></span>
                  <span class="layout__text">
                    <span class="layout__title">{{ option.label }}</span>
                    <span class="layout__desc">{{ option.description }}</span>
                  </span>
                  <span class="layout__radio" aria-hidden="true" />
                </label>
              </div>
            </div>
          </div>
        </template>

        <footer class="panel__foot">
          <p class="panel__summary" :class="{ 'panel__summary--warn': !canGenerate && !optionsLoading }">{{ summary }}</p>
          <button type="button" class="btn-primary" :disabled="!canGenerate || generating" @click="generate">
            <AssetIcon :name="generating ? 'refresh-cw' : 'file-text'" :size="15" :class="{ spin: generating }" />
            {{ generating ? 'Generating…' : 'Generate Report' }}
            <AssetIcon v-if="!generating" name="arrow-right" :size="15" />
          </button>
        </footer>
      </div>

      <!-- Generated reports: each kept as the PDF it was printed as (project owner, 2026-10-29) -->
      <div v-show="tab === 'history'" id="panel-history" role="tabpanel" aria-labelledby="tab-history" class="history">
        <p v-if="historyError" class="history__error" role="alert">{{ historyError }}</p>

        <div v-if="historyLoading && !reports.length" class="history__state" aria-busy="true">
          <span class="skeleton skeleton--line" style="width: 70%" />
          <span class="skeleton skeleton--line" style="width: 55%" />
        </div>

        <div v-else-if="!reports.length" class="empty empty--flat">
          <span class="empty__icon"><AssetIcon name="history" :size="22" /></span>
          <p class="empty__title">No reports generated yet</p>
          <p class="empty__desc">Every report you generate is kept here as its PDF, to download again exactly as it was printed.</p>
        </div>

        <div v-else class="table-wrap">
          <table class="reports">
            <thead>
              <tr>
                <th>Generated</th>
                <th>By</th>
                <th>Covers</th>
                <th>Sheets</th>
                <th class="num">Pages</th>
                <th><span class="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in reports" :key="item.id" :class="{ 'reports__row--new': item.id === current?.id }">
                <td>
                  <span class="reports__date">{{ formatDate(item.generated_at) }}</span>
                  <span class="reports__sub">{{ formatTime(item.generated_at) }}</span>
                </td>
                <td>{{ item.generated_by || '—' }}</td>
                <td class="reports__covers">
                  <span>{{ coverLabel(item.components, componentOptions.length) }}</span>
                  <span class="reports__sub">{{ coverLabel(item.blood_types.map(displayType), typeOptions.length, 'blood types') }}</span>
                </td>
                <td>{{ item.layout === 'type' ? 'One per type' : 'All on one' }}</td>
                <td class="num">{{ item.pages }}</td>
                <td class="reports__actions">
                  <button type="button" class="btn-ghost" :disabled="busyReport === item.id" @click="viewReport(item)">
                    <AssetIcon name="eye" :size="14" /> View
                  </button>
                  <button type="button" class="btn-ghost" :disabled="busyReport === item.id" @click="downloadReport(item)">
                    <AssetIcon name="download" :size="14" /> Download
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="historyPage < historyLastPage" class="history__more">
          <button type="button" class="btn-ghost" :disabled="historyLoading" @click="loadHistory(historyPage + 1)">
            {{ historyLoading ? 'Loading…' : 'Load more' }}
          </button>
        </div>
      </div>
    </section>

    <!-- ============ THE REPORT ============ -->
    <section ref="previewEl" class="preview" aria-label="Report preview">
      <div v-if="generating && !sheet" class="canvas" aria-busy="true">
        <div class="paper paper--skeleton">
          <span class="skeleton" style="height: 18px; width: 40%" />
          <span class="skeleton" style="height: 420px" />
        </div>
      </div>

      <!-- Nothing yet: the report is drawn only once it is set up. -->
      <div v-else-if="!sheet" class="empty">
        <span class="empty__art" aria-hidden="true">
          <span class="empty__icon empty__icon--lg"><AssetIcon name="file-text" :size="26" /></span>
        </span>
        <p class="empty__title">No report generated yet</p>
        <p class="empty__desc">Choose the components and blood types above, then press Generate report to see the sheets and download the PDF.</p>
        <svg class="empty__wave" viewBox="0 0 600 120" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 70 C 150 30, 260 110, 400 70 S 560 40, 600 60 L 600 120 L 0 120 Z" />
        </svg>
      </div>

      <template v-else>
        <div class="result">
          <div class="result__text">
            <p class="result__title">
              Report generated {{ formatDate(current?.generated_at) }}, {{ formatTime(current?.generated_at) }}
            </p>
            <p class="result__meta">
              <strong>{{ sheet.totals.crossmatched }}</strong> crossmatched ·
              <strong>{{ sheet.totals.uncrossmatched }}</strong> uncrossmatched ·
              {{ sheet.components.join(', ') || 'No components' }} · {{ sheet.blood_types.map(displayType).join(', ') || 'No blood types' }}
            </p>
            <p v-if="stale" class="result__stale" role="status">
              <AssetIcon name="info" :size="13" />
              The settings have changed since this report. Generate again for a new one; this one stays in Generated Reports.
            </p>
          </div>
          <button type="button" class="btn-primary" :disabled="busyReport === current?.id" @click="downloadReport(current)">
            <AssetIcon name="file-down" :size="15" />
            {{ busyReport === current?.id ? 'Preparing…' : 'Download PDF' }}
          </button>
        </div>

        <!-- Each type's sheet, to jump to. -->
        <nav v-if="sheet.by === 'type' && sheet.sheets.length" class="jump" aria-label="Blood types">
          <button
            v-for="(page, index) in sheet.sheets"
            v-show="page.page === 1"
            :key="index"
            type="button"
            class="jump__chip"
            @click="jumpTo(index)"
          >
            {{ displayType(page.blood_type) }}
            <span class="jump__count">{{ bagsOn(page.blood_type) }}</span>
          </button>
        </nav>

        <div v-if="!sheet.sheets.length" class="empty">
          <span class="empty__icon"><AssetIcon name="inbox" :size="22" /></span>
          <p class="empty__title">Nothing to print</p>
          <p class="empty__desc">These settings cover no sheet. Choose at least one component and one blood type.</p>
        </div>

        <!-- A print preview: white paper whatever the theme, because this is what prints. -->
        <div v-else class="canvas" :class="{ 'canvas--busy': generating }">
          <article
            v-for="(page, index) in sheet.sheets"
            :id="`sheet-${index}`"
            :key="index"
            class="paper"
            :aria-label="`Inventory sheet${page.blood_type ? `, ${page.blood_type}` : ''}${page.kind === 'other' ? ', other components' : ''}${page.pages > 1 ? `, page ${page.page} of ${page.pages}` : ''}`"
          >
            <header class="paper__head">
              <div>
                <p class="paper__facility">{{ sheet.facility.name }}</p>
                <p class="paper__type">
                  {{ page.blood_type ? `Blood type: ${page.blood_type}` : 'All blood types' }}<template v-if="page.kind === 'other'"> · Other components</template>
                </p>
              </div>
              <p class="paper__when">
                As of {{ sheet.as_of_date }}, {{ sheet.as_of_time }}
                <template v-if="page.pages > 1"><br>Page {{ page.page }} of {{ page.pages }}</template>
              </p>
            </header>

            <div class="paper__scroll">
              <table v-for="section in SECTIONS" :key="section.key" class="form">
                <colgroup>
                  <col class="form__num-col">
                  <template v-for="(column, c) in page[section.key]" :key="c">
                    <col class="form__bag-col">
                    <col class="form__exp-col">
                  </template>
                </colgroup>
                <thead>
                  <tr>
                    <th />
                    <th class="form__section" :colspan="page[section.key].length * 2">{{ section.title }}</th>
                  </tr>
                  <tr>
                    <th />
                    <template v-for="(column, c) in page[section.key]" :key="c">
                      <th class="form__col">{{ column.label }}</th>
                      <th class="form__col">EXP.</th>
                    </template>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in sheet.rows" :key="row">
                    <td class="form__num">{{ row }}</td>
                    <template v-for="(column, c) in page[section.key]" :key="c">
                      <td class="form__bag">
                        <template v-if="column.cells[row - 1]">
                          {{ cellLabel(column.cells[row - 1]) }}
                          <abbr v-if="column.cells[row - 1].tagged" class="form__tag" title="Tagged to a patient, waiting for crossmatch">(T)</abbr>
                        </template>
                      </td>
                      <td class="form__exp">{{ expiry(column.cells[row - 1]?.expiry_date) }}</td>
                    </template>
                  </tr>
                </tbody>
              </table>

              <table class="form form--sign">
                <tbody>
                  <tr>
                    <td class="form__sign" style="width: 40%">INVENTORY DONE BY:<span class="form__sign-value">{{ sheet.prepared_by }}</span></td>
                    <td class="form__sign" style="width: 25%">DATE:<span class="form__sign-value">{{ sheet.as_of_date }}</span></td>
                    <td class="form__sign" style="width: 35%">CHECKED BY:</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p class="paper__legend">(T) Tagged to a patient, waiting for crossmatch.</p>

            <footer class="paper__control">
              <span>{{ sheet.footer.form_code }}</span>
              <span>{{ sheet.footer.effectivity }}</span>
              <span>{{ sheet.footer.revision }}</span>
            </footer>
          </article>
        </div>
      </template>
    </section>
  </div>
</template>

<script setup>
/**
 * The hospital blood bank's Inventory Report: its paper inventory form,
 * filled from its own shelf (project owner, 2026-10-28). The form holds Whole
 * Blood and Packed RBC; every other component follows on "Other components"
 * pages in the same layout, a column each.
 *
 * Laid out from the owner's mock-up (2026-10-29): Report Settings — the
 * components, the blood types and the layout, chosen before anything is
 * drawn — and Generated Reports. Generate Report has the server build the
 * sheets and keep them as their PDF, so the preview, the Download and every
 * later re-download are the same report, exactly as printed that day.
 *
 * CROSSMATCHED holds the bags tagged to a patient and crossmatched, ready to
 * transfuse, its Whole Blood under TRANSFUSE AS PRBC; UNCROSSMATCHED holds
 * the free bags and those tagged but still waiting for their crossmatch,
 * marked (T).
 */

import AssetIcon from '~/components/common/AssetIcon.vue'
import { hospitalService } from '~/api/hospital/HospitalService'
import { orderDashboardTypes } from '~/utils/inventoryDashboard'

definePageMeta({ middleware: ['auth', 'hospital-portal'], layout: 'hospitaldashboard', requires: 'hospital.inventory.view' })

const LAYOUTS = [
  { value: 'type', label: 'One sheet per type', description: 'Each blood type will have its own sheet.', icon: 'layout-grid' },
  { value: 'all', label: 'All types on one sheet', description: 'All selected blood types will be included in a single sheet.', icon: 'layers' },
]

const SECTIONS = [
  { key: 'crossmatched', title: 'CROSSMATCHED' },
  { key: 'uncrossmatched', title: 'UNCROSSMATCHED' },
]

// The names the settings show, as the mock-up writes them; the sheets print the codes.
const COMPONENT_LABELS = { WB: 'Whole Blood', PC: 'PLT', CRYO: 'Cryo' }
const componentLabel = (component) => COMPONENT_LABELS[component.code] || component.code || component.name

const tab = ref('settings')
const error = ref('')

// ── Settings ──
const componentOptions = ref([])
const typeOptions = ref([])
const optionsLoading = ref(true)
const config = reactive({ components: [], bloodTypes: [], by: 'type' })

// The last settings this browser used, so a daily report is one click. A
// per-viewer convenience: without storage every choice starts ticked.
const SETTINGS_KEY = 'redagos:hospital-inventory-report'

function restoreSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null')
    if (!saved || typeof saved !== 'object') return
    const known = (ids, options) => (Array.isArray(ids) ? ids.filter((id) => options.some((o) => o.id === id)) : null)
    config.components = known(saved.components, componentOptions.value) ?? config.components
    config.bloodTypes = known(saved.bloodTypes, typeOptions.value) ?? config.bloodTypes
    if (saved.by === 'type' || saved.by === 'all') config.by = saved.by
  } catch {
    // Unreadable or blocked: keep the defaults.
  }
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(config))
  } catch {
    // Storage blocked: the report still generates.
  }
}

// The components (with their codes) and blood types the blood bank works with.
async function loadOptions() {
  optionsLoading.value = true
  try {
    const status = await hospitalService.stockThresholds()
    componentOptions.value = [...(status?.components ?? [])].sort((a, b) => a.id - b.id)
    typeOptions.value = orderDashboardTypes(status?.blood_types ?? [])
  } catch {
    try {
      const reference = await hospitalService.referenceData()
      componentOptions.value = [...(reference?.components ?? [])].sort((a, b) => a.id - b.id)
      typeOptions.value = orderDashboardTypes(reference?.blood_types ?? [])
    } catch {
      error.value = 'The components and blood types could not be loaded. Refresh to try again.'
    }
  } finally {
    // Everything ticked until this browser remembers otherwise.
    config.components = componentOptions.value.map((c) => c.id)
    config.bloodTypes = typeOptions.value.map((t) => t.id)
    restoreSettings()
    optionsLoading.value = false
  }
}

const allComponents = computed(() => componentOptions.value.length > 0 && config.components.length === componentOptions.value.length)
const allTypes = computed(() => typeOptions.value.length > 0 && config.bloodTypes.length === typeOptions.value.length)

/** Select All: everything, or nothing when everything is already chosen. */
function toggleAll(key) {
  const options = key === 'components' ? componentOptions.value : typeOptions.value
  const all = key === 'components' ? allComponents.value : allTypes.value
  config[key] = all ? [] : options.map((option) => option.id)
}

const canGenerate = computed(() => !optionsLoading.value && config.components.length > 0 && config.bloodTypes.length > 0)

const summary = computed(() => {
  if (optionsLoading.value) return 'Loading the components and blood types…'
  if (!config.components.length) return 'Choose at least one component.'
  if (!config.bloodTypes.length) return 'Choose at least one blood type.'
  const components = allComponents.value ? 'Every component' : `${config.components.length} component${config.components.length === 1 ? '' : 's'}`
  const types = allTypes.value ? 'every blood type' : `${config.bloodTypes.length} blood type${config.bloodTypes.length === 1 ? '' : 's'}`
  return `${components}, ${types}, ${config.by === 'type' ? 'one sheet per type' : 'all types on one sheet'}.`
})

// ── Generating ──
const sheet = ref(null)
const current = ref(null)
const generating = ref(false)
const previewEl = ref(null)

const options = () => ({ by: config.by, components: [...config.components], bloodTypes: [...config.bloodTypes] })
const generatedWith = ref(null)
const sameSettings = (a, b) => a.by === b.by
  && [...a.components].sort().join() === [...b.components].sort().join()
  && [...a.bloodTypes].sort().join() === [...b.bloodTypes].sort().join()
const stale = computed(() => Boolean(sheet.value && generatedWith.value && !sameSettings(generatedWith.value, options())))

async function generate() {
  if (!canGenerate.value) return
  const chosen = options()
  generating.value = true
  error.value = ''
  saveSettings()

  try {
    const response = await hospitalService.generateInventoryReport(chosen)
    sheet.value = response.sheet
    current.value = response.report
    generatedWith.value = chosen
    // It joins the archive at the top.
    reports.value = [response.report, ...reports.value.filter((item) => item.id !== response.report.id)]
    historyTotal.value += 1
    nextTick(() => previewEl.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  } catch (err) {
    error.value = Object.values(err?.data?.errors ?? {}).flat()[0] || err?.message || 'The report could not be generated. Try again.'
  } finally {
    generating.value = false
  }
}

// ── Generated reports ──
const reports = ref([])
const historyPage = ref(0)
const historyLastPage = ref(1)
const historyTotal = ref(0)
const historyLoading = ref(false)
const historyError = ref('')
const busyReport = ref(null)

async function loadHistory(page = 1) {
  historyLoading.value = true
  historyError.value = ''
  try {
    const response = await hospitalService.inventoryReports({ page, per_page: 10 })
    const rows = response?.data ?? []
    reports.value = page === 1 ? rows : [...reports.value, ...rows.filter((row) => !reports.value.some((r) => r.id === row.id))]
    historyPage.value = response?.current_page ?? page
    historyLastPage.value = response?.last_page ?? page
    historyTotal.value = response?.total ?? reports.value.length
  } catch (err) {
    historyError.value = err?.message || 'The generated reports could not be loaded.'
  } finally {
    historyLoading.value = false
  }
}

function openHistory() {
  tab.value = 'history'
  if (!historyPage.value) loadHistory(1)
}

/** Save a kept report's PDF under its own name. */
async function downloadReport(item) {
  if (!item) return
  busyReport.value = item.id
  error.value = ''
  try {
    const blob = await hospitalService.downloadInventoryReport(item.id)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = item.filename || `inventory-sheet-${item.id}.pdf`
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (err) {
    error.value = err?.message || 'The PDF could not be downloaded. Try again.'
  } finally {
    busyReport.value = null
  }
}

/**
 * Open a kept report's PDF in a new tab. The tab is opened at once, while the
 * click still counts as the user's, and given the PDF when it arrives; a
 * browser that refuses the tab gets the download instead.
 */
async function viewReport(item) {
  const viewer = window.open('', '_blank')
  if (!viewer) {
    downloadReport(item)
    return
  }
  busyReport.value = item.id
  try {
    const blob = await hospitalService.downloadInventoryReport(item.id)
    viewer.location.href = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }))
  } catch (err) {
    viewer.close()
    error.value = err?.message || 'The PDF could not be opened. Try again.'
  } finally {
    busyReport.value = null
  }
}

onMounted(() => {
  loadOptions()
  // The archive's count shows on its tab from the start.
  loadHistory(1)
})

// ── Drawing ──
function jumpTo(index) {
  document.getElementById(`sheet-${index}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/** How many bags a blood type's sheets hold, across its pages. */
function bagsOn(bloodType) {
  return (sheet.value?.sheets ?? [])
    .filter((page) => page.blood_type === bloodType)
    .flatMap((page) => [...page.crossmatched, ...page.uncrossmatched])
    .reduce((sum, column) => sum + column.cells.filter(Boolean).length, 0)
}

// The bag, and its type when every type shares the sheet.
function cellLabel(cell) {
  return sheet.value?.by === 'all' && cell.blood_type ? `${cell.bag_number} · ${cell.blood_type}` : cell.bag_number
}

// As the PDF prints it: MM/DD/YY.
function expiry(date) {
  if (!date) return ''
  const [year, month, day] = date.split('-')
  return `${month}/${day}/${year.slice(2)}`
}

// A true minus sign, which reads as "minus" aloud and lines up with the plus.
const displayType = (code) => (code ? String(code).replace('-', '−') : '')

/** "Every component", or the codes when only some were chosen. */
function coverLabel(codes, optionCount, noun = 'components') {
  if (!codes?.length) return `No ${noun}`
  if (optionCount && codes.length >= optionCount) return `Every ${noun === 'components' ? 'component' : 'blood type'}`
  return codes.join(', ')
}

function formatDate(value) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' })
}

function formatTime(value) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' })
}
</script>

<style scoped>
/* On the shared staff UI: tokens only, so dark mode follows them. The paper
   stays white in both themes, because it is what prints. */
.report {
  font-family: var(--rb-font-sans);
  max-width: var(--rb-content-max, 1600px);
  margin: 0 auto;
  padding: 24px var(--rb-gutter, 24px) 40px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.spin { animation: spin 0.9s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

.alert {
  display: flex; align-items: center; gap: 8px; margin: 0; padding: 10px 14px; border-radius: 10px; font-size: 13px;
  background: rgba(var(--rb-accent-rgb), 0.08); color: var(--rb-accent-text); border: 1px solid rgba(var(--rb-accent-rgb), 0.25);
}

/* ── Header: the page's title on a soft wash of the portal colour ── */
.hero {
  position: relative;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 22px 24px;
  overflow: hidden;
  border: 1px solid var(--rb-border);
  border-radius: 20px;
  background:
    radial-gradient(60% 140% at 100% 0%, rgba(var(--rb-primary-rgb), 0.10), transparent 60%),
    var(--rb-surface);
  box-shadow: var(--rb-shadow-sm);
}
.hero__icon {
  position: relative; z-index: 1; flex-shrink: 0;
  display: grid; place-items: center; width: 52px; height: 52px; border-radius: 14px;
  background: rgba(var(--rb-primary-rgb), 0.12); color: var(--rb-primary-text);
}
.hero__text { position: relative; z-index: 1; flex: 1; min-width: 0; }
.hero__title { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.02em; color: var(--rb-text-primary); }
.hero__sub { margin: 4px 0 0; font-size: 13.5px; color: var(--rb-text-secondary); }
.hero__tag {
  position: relative; z-index: 1; flex-shrink: 0;
  display: flex; align-items: center; gap: 10px; margin: 0;
  font-size: 12px; line-height: 1.4; color: var(--rb-text-secondary);
}
.hero__drop { color: rgba(var(--rb-primary-rgb), 0.55); }
.hero__wave { position: absolute; right: 0; bottom: 0; width: 55%; height: 70%; fill: rgba(var(--rb-primary-rgb), 0.05); pointer-events: none; }

/* ── The settings card and its tabs ── */
.panel {
  overflow: hidden;
  border: 1px solid var(--rb-border);
  border-radius: 20px;
  background: var(--rb-surface);
  box-shadow: var(--rb-shadow-sm);
}
.tabs { display: flex; gap: 8px; padding: 0 20px; border-bottom: 1px solid var(--rb-border); overflow-x: auto; }
.tabs__tab {
  display: inline-flex; align-items: center; gap: 8px; padding: 15px 6px 13px; margin-right: 14px;
  border: 0; border-bottom: 2px solid transparent; background: none; cursor: pointer; white-space: nowrap;
  font: inherit; font-size: 13.5px; font-weight: 600; color: var(--rb-text-secondary);
}
.tabs__tab:hover { color: var(--rb-text-primary); }
.tabs__tab--on { color: var(--rb-primary-text); border-bottom-color: var(--rb-primary); }
.tabs__tab:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: -2px; border-radius: 6px; }
.tabs__count {
  min-width: 20px; padding: 1px 7px; border-radius: 999px; text-align: center;
  background: rgba(var(--rb-primary-rgb), 0.1); color: var(--rb-primary-text); font-size: 11px; font-weight: 700;
}

/* A setting: its icon in the margin, then the title, its line and the choices. */
.setting {
  display: flex; gap: 14px; margin: 0; padding: 20px 24px; min-width: 0;
  border: 0; border-bottom: 1px solid var(--rb-border);
}
.setting__icon {
  flex-shrink: 0; display: grid; place-items: center; width: 30px; height: 30px; border-radius: 9px;
  background: rgba(var(--rb-primary-rgb), 0.08); color: var(--rb-primary-text);
}
.setting__body { position: relative; flex: 1; min-width: 0; }
.setting__head { padding: 0; margin-bottom: 12px; }
.setting__title { display: block; font-size: 14.5px; font-weight: 700; color: var(--rb-text-primary); }
.setting__sub { display: block; margin-top: 2px; font-size: 12.5px; color: var(--rb-text-secondary); }

.select-all {
  position: absolute; top: 0; right: 0;
  display: inline-flex; align-items: center; gap: 6px; padding: 4px 6px; border: 0; border-radius: 8px; background: none; cursor: pointer;
  font: inherit; font-size: 12.5px; font-weight: 600; color: var(--rb-primary-text);
}
.select-all:hover { background: rgba(var(--rb-primary-rgb), 0.08); }
.select-all:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: 2px; }

/* Checkbox chips */
.checks { display: flex; flex-wrap: wrap; gap: 10px; }
.check {
  position: relative; display: inline-flex; align-items: center; gap: 9px; min-width: 64px; padding: 8px 14px 8px 10px;
  border: 1px solid var(--rb-border-strong); border-radius: 10px; background: var(--rb-surface); cursor: pointer; user-select: none;
  font-size: 13px; font-weight: 600; color: var(--rb-text-primary);
  transition: border-color 0.15s ease, background-color 0.15s ease;
}
.check:hover { border-color: rgba(var(--rb-primary-rgb), 0.45); }
.check--on { border-color: rgba(var(--rb-primary-rgb), 0.35); background: rgba(var(--rb-primary-rgb), 0.04); }
.check--type { min-width: 60px; }
.check__input { position: absolute; opacity: 0; width: 1px; height: 1px; pointer-events: none; }
.check__box {
  display: grid; place-items: center; width: 18px; height: 18px; border-radius: 5px; flex-shrink: 0;
  border: 1.5px solid var(--rb-border-strong); background: var(--rb-surface); color: transparent;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}
.check--on .check__box { border-color: var(--rb-primary); background: var(--rb-primary); color: #fff; }
.check:focus-within { outline: 2px solid var(--rb-primary-text); outline-offset: 2px; }

/* Layout cards, chosen like radio buttons */
.layouts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.layout {
  position: relative; display: flex; align-items: center; gap: 14px; padding: 16px 18px;
  border: 1px solid var(--rb-border-strong); border-radius: 14px; background: var(--rb-surface); cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease;
}
.layout:hover { border-color: rgba(var(--rb-primary-rgb), 0.45); }
.layout--on { border-color: var(--rb-primary); background: rgba(var(--rb-primary-rgb), 0.04); box-shadow: 0 0 0 3px rgba(var(--rb-primary-rgb), 0.1); }
.layout:focus-within { outline: 2px solid var(--rb-primary-text); outline-offset: 2px; }
.layout__icon {
  flex-shrink: 0; display: grid; place-items: center; width: 40px; height: 40px; border-radius: 11px;
  background: rgba(var(--rb-primary-rgb), 0.1); color: var(--rb-primary-text);
}
.layout__text { flex: 1; min-width: 0; }
.layout__title { display: block; font-size: 13.5px; font-weight: 700; color: var(--rb-text-primary); }
.layout__desc { display: block; margin-top: 3px; font-size: 12px; color: var(--rb-text-secondary); }
.layout__radio {
  flex-shrink: 0; width: 18px; height: 18px; border-radius: 50%;
  border: 1.5px solid var(--rb-border-strong); background: var(--rb-surface);
}
.layout--on .layout__radio { border-color: var(--rb-primary); box-shadow: inset 0 0 0 4px var(--rb-surface); background: var(--rb-primary); }

.panel__foot {
  display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
  padding: 14px 24px; background: color-mix(in srgb, var(--rb-surface-alt) 60%, var(--rb-surface));
}
.panel__summary { margin: 0; font-size: 12.5px; color: var(--rb-text-secondary); }
.panel__summary--warn { color: var(--rb-warning-text, #B45309); font-weight: 600; }

/* Buttons */
.btn-primary {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 40px; padding: 0 18px;
  border: 0; border-radius: 10px; background: var(--rb-primary); color: #fff; cursor: pointer; white-space: nowrap;
  font: inherit; font-size: 13.5px; font-weight: 700;
  box-shadow: 0 6px 14px -8px rgba(var(--rb-primary-rgb), 0.7);
  transition: background-color 0.15s ease, transform 0.1s ease;
}
.btn-primary:hover:not(:disabled) { background: var(--rb-primary-hover); }
.btn-primary:active:not(:disabled) { transform: translateY(1px); }
.btn-primary:disabled { opacity: 0.55; cursor: not-allowed; box-shadow: none; }
.btn-primary:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: 2px; }
.btn-ghost {
  display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 11px;
  border: 1px solid var(--rb-border-strong); border-radius: 9px; background: var(--rb-surface); cursor: pointer; white-space: nowrap;
  font: inherit; font-size: 12.5px; font-weight: 600; color: var(--rb-text-primary);
}
.btn-ghost:hover:not(:disabled) { border-color: rgba(var(--rb-primary-rgb), 0.45); color: var(--rb-primary-text); }
.btn-ghost:disabled { opacity: 0.55; cursor: not-allowed; }
.btn-ghost:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: 2px; }

/* ── Generated reports ── */
.history { min-height: 120px; }
.history__error { margin: 16px 24px 0; font-size: 13px; color: var(--rb-accent-text); }
.history__state { display: flex; flex-direction: column; gap: 10px; padding: 24px; }
.history__more { display: flex; justify-content: center; padding: 14px; border-top: 1px solid var(--rb-border); }
.table-wrap { overflow-x: auto; }
.reports { width: 100%; border-collapse: collapse; font-size: 13px; }
.reports th {
  padding: 11px 14px; text-align: left; white-space: nowrap;
  font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--rb-text-muted, var(--rb-text-secondary));
  border-bottom: 1px solid var(--rb-border);
}
.reports th:first-child, .reports td:first-child { padding-left: 24px; }
.reports th:last-child, .reports td:last-child { padding-right: 24px; }
.reports td { padding: 12px 14px; border-bottom: 1px solid var(--rb-border); color: var(--rb-text-primary); vertical-align: middle; }
.reports tbody tr:last-child td { border-bottom: 0; }
.reports tbody tr:hover { background: var(--rb-surface-hover); }
.reports__row--new td:first-child { box-shadow: inset 3px 0 0 var(--rb-primary); }
.reports__date { display: block; font-weight: 600; white-space: nowrap; }
.reports__sub { display: block; margin-top: 2px; font-size: 12px; color: var(--rb-text-secondary); }
.reports__covers { min-width: 180px; }
.reports__actions { text-align: right; white-space: nowrap; }
.reports__actions .btn-ghost + .btn-ghost { margin-left: 6px; }
.reports .num { text-align: right; font-variant-numeric: tabular-nums; }

/* ── The report ── */
.preview { display: flex; flex-direction: column; gap: 14px; scroll-margin-top: 80px; }
.result {
  display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap;
  padding: 16px 20px; border: 1px solid var(--rb-border); border-radius: 16px; background: var(--rb-surface);
}
.result__text { min-width: 0; }
.result__title { margin: 0; font-size: 14px; font-weight: 700; color: var(--rb-text-primary); }
.result__meta { margin: 3px 0 0; font-size: 12.5px; color: var(--rb-text-secondary); }
.result__meta strong { color: var(--rb-text-primary); font-variant-numeric: tabular-nums; }
.result__stale { display: flex; align-items: center; gap: 6px; margin: 6px 0 0; font-size: 12.5px; font-weight: 600; color: var(--rb-warning-text, #B45309); }

.empty {
  position: relative; overflow: hidden;
  display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 56px 28px; text-align: center;
  border: 1px solid var(--rb-border); border-radius: 20px; background: var(--rb-surface);
}
.empty--flat { border: 0; border-radius: 0; padding: 44px 28px; }
.empty__art { position: relative; z-index: 1; padding: 0 22px; }
.empty__art::before,
.empty__art::after {
  content: ''; position: absolute; top: 50%; width: 14px; height: 2px; border-radius: 2px;
  background: rgba(var(--rb-primary-rgb), 0.35); box-shadow: 0 -10px 0 rgba(var(--rb-primary-rgb), 0.2), 0 10px 0 rgba(var(--rb-primary-rgb), 0.2);
}
.empty__art::before { left: -2px; }
.empty__art::after { right: -2px; }
.empty__icon {
  position: relative; z-index: 1;
  display: grid; place-items: center; width: 52px; height: 52px; border-radius: 16px;
  background: rgba(var(--rb-primary-rgb), 0.08); color: var(--rb-primary-text);
}
.empty__icon--lg { width: 62px; height: 62px; border-radius: 50%; box-shadow: 0 0 0 8px rgba(var(--rb-primary-rgb), 0.05); }
.empty__title { position: relative; z-index: 1; margin: 10px 0 0; font-size: 15px; font-weight: 700; color: var(--rb-text-primary); }
.empty__desc { position: relative; z-index: 1; margin: 0; max-width: 52ch; font-size: 13px; line-height: 1.5; color: var(--rb-text-secondary); }
.empty__wave { position: absolute; left: 0; right: 0; bottom: 0; width: 100%; height: 45%; fill: rgba(var(--rb-primary-rgb), 0.04); pointer-events: none; }

.jump { display: flex; flex-wrap: wrap; gap: 6px; }
.jump__chip {
  display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 999px; cursor: pointer;
  border: 1px solid var(--rb-border); background: var(--rb-surface); color: var(--rb-text-primary);
  font: inherit; font-size: 12.5px; font-weight: 700;
}
.jump__chip:hover { border-color: rgba(var(--rb-primary-rgb), 0.45); }
.jump__chip:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: 2px; }
.jump__count {
  min-width: 18px; padding: 0 6px; border-radius: 999px; text-align: center;
  background: var(--rb-surface-alt); color: var(--rb-text-secondary); font-size: 11px; font-weight: 600; font-variant-numeric: tabular-nums;
}

/* The print preview canvas, as the centre's Daily Stock Report draws it. */
.canvas {
  display: flex; flex-direction: column; gap: 28px;
  padding: 28px; border-radius: 20px;
  background: var(--rb-surface-alt); border: 1px solid var(--rb-border);
  transition: opacity 0.15s ease;
}
.canvas--busy { opacity: 0.6; }
.paper {
  width: 100%; max-width: 860px; margin: 0 auto; scroll-margin-top: 80px;
  background: #ffffff; color: #111827;
  border-radius: 4px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08), 0 12px 32px -12px rgba(15, 23, 42, 0.28);
  padding: 32px 36px 28px;
}
.paper--skeleton { display: flex; flex-direction: column; gap: 14px; }
.skeleton {
  display: block; border-radius: 6px;
  background: linear-gradient(90deg, var(--rb-skeleton-a, #EEF1F5) 25%, var(--rb-skeleton-b, #F6F8FA) 37%, var(--rb-skeleton-a, #EEF1F5) 63%);
  background-size: 400% 100%; animation: shimmer 1.4s ease infinite;
}
.skeleton--line { height: 14px; }
@keyframes shimmer { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }

.paper__head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; margin-bottom: 6px; }
.paper__facility { margin: 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.02em; }
.paper__type { margin: 2px 0 0; font-size: 11.5px; }
.paper__when { margin: 0; font-size: 10.5px; color: #374151; text-align: right; }
.paper__scroll { overflow-x: auto; }
.paper__legend { margin: 4px 0 0; font-size: 9.5px; color: #374151; }
.paper__control { display: flex; justify-content: space-between; gap: 12px; margin-top: 14px; font-size: 10px; font-weight: 700; }

/* The form: hairline rules, as printed. */
.form { width: 100%; min-width: 640px; border-collapse: collapse; table-layout: fixed; }
.form + .form { margin-top: -1px; }
.form__num-col { width: 4%; }
.form__bag-col { width: 17%; }
.form__exp-col { width: 7%; }
.form th, .form td {
  height: 21px; padding: 0 4px; border: 1px solid #4B5563;
  font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.form__section { font-size: 14px !important; font-weight: 800; letter-spacing: 0.02em; text-align: center; height: 26px !important; }
.form__col { font-size: 10px; font-weight: 700; text-align: center; }
.form__num { text-align: center; font-size: 9px !important; color: #4B5563; }
.form__bag { font-family: var(--rb-font-mono); font-size: 9.5px !important; }
.form__exp { text-align: center; font-variant-numeric: tabular-nums; }
.form__tag { margin-left: 3px; font-family: var(--rb-font-sans); font-weight: 700; text-decoration: none; }
.form__sign { height: 34px !important; vertical-align: top; padding-top: 3px !important; font-size: 8.5px !important; }
.form__sign-value { display: block; margin-top: 6px; font-size: 10.5px; }

@media (prefers-reduced-motion: reduce) {
  .spin, .skeleton { animation: none; }
  .check, .check__box, .layout, .btn-primary { transition: none; }
}

@media (max-width: 760px) {
  .hero__tag { display: none; }
  .layouts { grid-template-columns: minmax(0, 1fr); }
}

@media (max-width: 640px) {
  .report { padding: 16px 16px 32px; }
  .hero { padding: 18px; }
  .hero__icon { width: 44px; height: 44px; }
  .hero__title { font-size: 20px; }
  .setting { padding: 18px 16px; gap: 10px; }
  .select-all { position: static; margin: -4px 0 10px -6px; }
  .panel__foot { padding: 14px 16px; }
  .panel__foot .btn-primary { width: 100%; }
  .canvas { padding: 12px; }
  .paper { padding: 18px 14px; }
}
</style>
