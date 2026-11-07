<template>
  <div class="report">
    <!-- ============ HEADER ============ -->
    <PageHeader title="Inventory Report" :subtitle="hospitalPageSubtitle('inventoryReport', can)" />

    <div v-if="error" class="alert" role="alert">
      <AssetIcon name="circle-alert" :size="16" />
      <span>{{ error }}</span>
    </div>

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
        <AssetIcon name="file-text" :size="15" /> New Report
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
        <AssetIcon name="history" :size="15" /> Generated Reports
        <span v-if="historyTotal" class="tabs__count">{{ historyTotal }}</span>
      </button>
    </div>

    <!-- ============ NEW REPORT: the settings beside the document ============ -->
    <div v-show="tab === 'settings'" id="panel-settings" role="tabpanel" aria-labelledby="tab-settings" class="workspace">
      <!-- Chosen before anything is drawn (project owner, 2026-10-28) -->
      <aside class="panel rail" aria-labelledby="rail-title">
        <h2 id="rail-title" class="rail__title">Report Settings</h2>

        <div class="rail__body">
          <template v-if="optionsLoading">
            <div class="setting" aria-busy="true">
              <span class="sk sk--line" style="width: 46%" />
              <div class="checks">
                <span v-for="n in 4" :key="n" class="sk check-sk" />
              </div>
            </div>
            <div class="setting" aria-busy="true">
              <span class="sk sk--line" style="width: 36%" />
              <div class="checks checks--types">
                <span v-for="n in 8" :key="n" class="sk check-sk" />
              </div>
            </div>
            <div class="setting" aria-busy="true">
              <span class="sk sk--line" style="width: 24%" />
              <div class="layouts">
                <span v-for="n in 2" :key="n" class="sk layout-sk" />
              </div>
            </div>
          </template>

          <template v-else>
            <div class="setting" role="group" aria-labelledby="set-components">
              <div class="setting__head">
                <span id="set-components" class="setting__title">Blood Components</span>
                <button type="button" class="select-all" :aria-pressed="allComponents" @click="toggleAll('components')">
                  <AssetIcon :name="allComponents ? 'check-circle' : 'circle'" :size="14" /> Select All
                </button>
              </div>
              <div class="checks">
                <label v-for="component in componentOptions" :key="component.id" class="check" :class="{ 'check--on': config.components.includes(component.id) }" :title="component.name">
                  <input v-model="config.components" type="checkbox" :value="component.id" class="check__input">
                  <span class="check__box" aria-hidden="true"><AssetIcon name="check" :size="12" /></span>
                  {{ componentLabel(component) }}
                </label>
              </div>
            </div>

            <div class="setting" role="group" aria-labelledby="set-types">
              <div class="setting__head">
                <span id="set-types" class="setting__title">Blood Types</span>
                <button type="button" class="select-all" :aria-pressed="allTypes" @click="toggleAll('bloodTypes')">
                  <AssetIcon :name="allTypes ? 'check-circle' : 'circle'" :size="14" /> Select All
                </button>
              </div>
              <div class="checks checks--types">
                <label v-for="type in typeOptions" :key="type.id" class="check" :class="{ 'check--on': config.bloodTypes.includes(type.id) }">
                  <input v-model="config.bloodTypes" type="checkbox" :value="type.id" class="check__input">
                  <span class="check__box" aria-hidden="true"><AssetIcon name="check" :size="12" /></span>
                  {{ displayType(type.code) }}
                </label>
              </div>
            </div>

            <div class="setting" role="group" aria-labelledby="set-sheets">
              <div class="setting__head">
                <span id="set-sheets" class="setting__title">Sheets</span>
              </div>
              <div class="layouts" role="radiogroup" aria-label="Sheets">
                <label v-for="option in LAYOUTS" :key="option.value" class="layout" :class="{ 'layout--on': config.by === option.value }">
                  <input v-model="config.by" type="radio" name="report-layout" :value="option.value" class="check__input">
                  <span class="layout__radio" aria-hidden="true" />
                  <span class="layout__text">
                    <span class="layout__title">{{ option.label }}</span>
                  </span>
                </label>
              </div>
            </div>
          </template>
        </div>

        <footer class="rail__foot">
          <p class="rail__summary" :class="{ 'rail__summary--warn': !canGenerate && !optionsLoading }">{{ summary }}</p>
          <button type="button" class="btn-primary" :disabled="!canGenerate || generating" @click="generate">
            <AssetIcon :name="generating ? 'refresh-cw' : 'file-text'" :size="15" :class="{ spin: generating }" />
            {{ generating ? 'Generating…' : 'Generate Report' }}
          </button>
        </footer>
      </aside>

      <!-- ============ THE REPORT ============ -->
      <section ref="previewEl" class="panel viewer" aria-label="Report preview">
        <header class="viewer__bar">
          <div class="viewer__heading">
            <h2 class="viewer__name">{{ sheet?.facility.name || facilityLabel }} · Inventory Report</h2>
            <p v-if="sheet" class="viewer__meta">
              As of {{ sheet.as_of_date }}, {{ sheet.as_of_time }} · Prepared by {{ sheet.prepared_by }}
            </p>
            <p v-else-if="generating" class="viewer__meta">Generating the report…</p>
            <p v-else class="viewer__meta">Nothing generated yet. Choose the settings, then press Generate Report.</p>
          </div>
          <div v-if="sheet" class="viewer__actions">
            <button type="button" class="btn-outline" :disabled="busyReport === current?.id" @click="viewReport(current)">
              <AssetIcon name="eye" :size="15" />
              View PDF
            </button>
            <button type="button" class="btn-primary" :disabled="busyReport === current?.id" @click="downloadReport(current)">
              <AssetIcon name="file-down" :size="15" />
              {{ busyReport === current?.id ? 'Preparing…' : 'Download PDF' }}
            </button>
          </div>
        </header>

        <p v-if="stale" class="viewer__stale" role="status">
          <AssetIcon name="info" :size="14" />
          The settings have changed since this report. Generate again for a new one; this one stays in Generated Reports.
        </p>

        <!-- The report's own figures, from the sheets just built. -->
        <dl v-if="sheet || generating" class="figures" :aria-busy="!sheet">
          <div v-for="figure in figures" :key="figure.label" class="figure">
            <dt>{{ figure.label }}</dt>
            <dd>
              <span v-if="!sheet" class="sk sk--line figure__sk" />
              <template v-else>{{ figure.value }}</template>
            </dd>
          </div>
          <div class="figure figure--wide">
            <dt>Covers</dt>
            <dd class="figure__covers">
              <span v-if="!sheet" class="sk sk--line" style="width: 70%" />
              <template v-else>{{ sheet.components.join(', ') || 'No components' }} · {{ sheet.blood_types.map(displayType).join(', ') || 'No blood types' }}</template>
            </dd>
          </div>
        </dl>

        <!-- Each type's sheet to jump to, and the page being read. -->
        <nav v-if="sheet?.sheets.length > 1" class="pages" aria-label="Report pages">
          <div v-if="sheet.by === 'type'" class="jump">
            <button
              v-for="(page, index) in sheet.sheets"
              v-show="page.page === 1"
              :key="index"
              type="button"
              class="jump__chip"
              :class="{ 'jump__chip--on': page.blood_type === sheet.sheets[activeSheet]?.blood_type }"
              @click="jumpTo(index)"
            >
              {{ displayType(page.blood_type) }}
              <span class="jump__count">{{ bagsOn(page.blood_type) }}</span>
            </button>
          </div>
          <div class="pager">
            <button type="button" class="pager__btn" :disabled="activeSheet === 0" aria-label="Previous page" @click="jumpTo(activeSheet - 1)">
              <AssetIcon name="chevron-left" :size="15" />
            </button>
            <span class="pager__label" aria-live="polite">Page {{ activeSheet + 1 }} of {{ sheet.sheets.length }}</span>
            <button type="button" class="pager__btn" :disabled="activeSheet >= sheet.sheets.length - 1" aria-label="Next page" @click="jumpTo(activeSheet + 1)">
              <AssetIcon name="chevron-right" :size="15" />
            </button>
          </div>
        </nav>

        <p v-if="sheet && sheet.sheets.length && !bagTotal && !transfusedTotal" class="viewer__note">
          <AssetIcon name="info" :size="14" />
          No bags in date on these settings, so the form is empty.
        </p>

        <div v-if="sheet && !sheet.sheets.length" class="empty">
          <span class="empty__icon"><AssetIcon name="inbox" :size="22" /></span>
          <p class="empty__title">Nothing to print</p>
          <p class="empty__desc">These settings cover no sheet. Choose at least one component and one blood type.</p>
        </div>

        <!--
          A print preview: white paper whatever the theme, because this is what
          prints. Until a report exists it shows the blank form, as it will fill.
        -->
        <div
          v-else
          ref="canvasEl"
          class="canvas"
          :class="{ 'canvas--busy': generating }"
          :aria-busy="generating"
          @scroll.passive="onCanvasScroll"
        >
          <article
            v-for="(page, index) in drawnPages"
            :id="`sheet-${index}`"
            :key="index"
            class="paper"
            :class="{ 'paper--blank': !sheet }"
            :aria-hidden="!sheet"
            :aria-label="`Inventory sheet${page.blood_type ? `, ${page.blood_type}` : ''}${page.kind === 'other' ? ', other components' : ''}${page.pages > 1 ? `, page ${page.page} of ${page.pages}` : ''}`"
          >
            <header class="paper__head">
              <div>
                <p class="paper__facility">{{ sheet?.facility.name || facilityLabel }}</p>
                <p class="paper__type">
                  {{ page.blood_type ? `Blood type: ${page.blood_type}` : 'All blood types' }}<template v-if="page.kind === 'other'"> · Other components</template>
                </p>
              </div>
              <p v-if="sheet" class="paper__when">
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
                  <tr v-for="row in rowNumbers" :key="row">
                    <td class="form__num">{{ row }}</td>
                    <template v-for="(column, c) in page[section.key]" :key="c">
                      <td class="form__bag" :class="cellTone(column.cells[row - 1], section.key)">
                        <template v-if="column.cells[row - 1]">
                          {{ cellLabel(column.cells[row - 1]) }}
                          <abbr v-if="column.cells[row - 1].tagged" class="form__tag" title="Tagged to a patient, waiting for crossmatch">(T)</abbr>
                          <abbr v-else-if="column.cells[row - 1].reserved" class="form__tag" title="Reserved for a blood donor partner">(R)</abbr>
                          <abbr v-else-if="column.cells[row - 1].transfused" class="form__tag" title="Transfused today">(TF)</abbr>
                        </template>
                      </td>
                      <td class="form__exp" :class="cellTone(column.cells[row - 1], section.key)">{{ expiry(column.cells[row - 1]?.expiry_date) }}</td>
                    </template>
                  </tr>
                </tbody>
              </table>

              <table class="form form--sign">
                <tbody>
                  <tr>
                    <td class="form__sign" style="width: 40%">INVENTORY DONE BY:<span class="form__sign-value">{{ sheet?.prepared_by }}</span></td>
                    <td class="form__sign" style="width: 25%">DATE:<span class="form__sign-value">{{ sheet?.as_of_date }}</span></td>
                    <td class="form__sign" style="width: 35%">CHECKED BY:</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p class="paper__legend">
              <b class="paper__section">Crossmatched:</b>
              <span class="paper__key"><span class="paper__swatch paper__swatch--waiting" aria-hidden="true" />Waiting for transfusion</span>
              <span class="paper__key"><span class="paper__swatch paper__swatch--transfused" aria-hidden="true" /><b class="form__cell--transfused">(TF)</b> Transfused today</span>
            </p>
            <p class="paper__legend">
              <b class="paper__section">Uncrossmatched:</b>
              <span class="paper__key"><span class="paper__swatch" aria-hidden="true" />Available, not tagged</span>
              <span class="paper__key"><span class="paper__swatch paper__swatch--tagged" aria-hidden="true" /><b class="form__cell--tagged">(T)</b> Tagged to a patient, waiting for crossmatch</span>
              <span class="paper__key"><span class="paper__swatch paper__swatch--reserved" aria-hidden="true" /><b class="form__cell--reserved">(R)</b> Reserved for a blood donor partner</span>
            </p>

            <footer v-if="sheet" class="paper__control">
              <span>{{ sheet.footer.form_code }}</span>
              <span>{{ sheet.footer.effectivity }}</span>
              <span>{{ sheet.footer.revision }}</span>
            </footer>
          </article>
        </div>
      </section>
    </div>

    <!-- ============ GENERATED REPORTS ============ -->
    <!-- Each kept as the PDF it was printed as (project owner, 2026-10-29) -->
    <section v-show="tab === 'history'" id="panel-history" role="tabpanel" aria-labelledby="tab-history" class="panel history">
      <p v-if="historyError" class="history__error" role="alert">{{ historyError }}</p>

      <!-- The centre's Donor Management list (project owner, 2026-10-30). -->
      <div class="table-wrap" :class="{ 'table-wrap--busy': historyLoading && reports.length }">
        <table class="reports">
          <caption class="sr-only">Generated reports, newest first</caption>
          <thead>
            <tr>
              <th scope="col">Generated</th>
              <th scope="col">By</th>
              <th scope="col">Covers</th>
              <th scope="col">Sheets</th>
              <th scope="col" class="num">Bags</th>
              <th scope="col" class="num">Pages</th>
              <th scope="col" class="reports__actions">Actions</th>
            </tr>
          </thead>

          <tbody v-if="historyLoading && !reports.length">
            <SkeletonRows :columns="7" :rows="3" />
          </tbody>

          <tbody v-else-if="!reports.length">
            <tr>
              <td colspan="7" class="reports__empty">
                <div class="list-empty">
                  <span class="list-empty__icon"><AssetIcon name="history" :size="20" /></span>
                  <p class="list-empty__title">No reports generated yet</p>
                  <p class="list-empty__text">Every report you generate is kept here as its PDF, to download again exactly as it was printed.</p>
                </div>
              </td>
            </tr>
          </tbody>

          <tbody v-else>
            <tr v-for="item in reports" :key="item.id">
              <td>
                <span class="reports__date">
                  {{ formatDate(item.generated_at) }}
                  <span v-if="item.id === current?.id" class="reports__new">Just generated</span>
                </span>
                <span class="reports__sub">{{ formatTime(item.generated_at) }}</span>
              </td>
              <td>{{ item.generated_by || '—' }}</td>
              <td class="reports__covers">
                <span>{{ coverLabel(item.components, componentOptions.length) }}</span>
                <span class="reports__sub">{{ coverLabel(item.blood_types.map(displayType), typeOptions.length, 'blood types') }}</span>
              </td>
              <td>{{ item.layout === 'type' ? 'One per type' : 'All on one' }}</td>
              <td class="num">
                <span class="reports__date">{{ reportBags(item) }}</span>
                <span class="reports__sub">{{ item.totals?.crossmatched ?? 0 }} crossmatched</span>
              </td>
              <td class="num">{{ item.pages }}</td>
              <td class="reports__actions">
                <div class="row-actions">
                  <button
                    type="button"
                    class="row-btn"
                    :disabled="busyReport === item.id"
                    :aria-label="`View the report generated ${formatDate(item.generated_at)}, ${formatTime(item.generated_at)}`"
                    title="View"
                    @click="viewReport(item)"
                  >
                    <AssetIcon name="eye" :size="15" />
                  </button>
                  <button
                    type="button"
                    class="row-btn"
                    :disabled="busyReport === item.id"
                    :aria-label="`Download the report generated ${formatDate(item.generated_at)}, ${formatTime(item.generated_at)}`"
                    title="Download PDF"
                    @click="downloadReport(item)"
                  >
                    <AssetIcon name="download" :size="15" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <ListPager
        :page="historyPage || 1"
        :last-page="historyLastPage"
        :from="historyFrom"
        :to="historyTo"
        :total="historyTotal"
        :busy="historyLoading"
        @go="loadHistory"
      />
    </section>

    <!-- A kept report's PDF, on this page rather than in another tab. -->
    <CenterModal
      v-if="viewing"
      size="lg"
      title="Inventory Report"
      :eyebrow="`Generated ${formatDate(viewing.item.generated_at)}, ${formatTime(viewing.item.generated_at)}`"
      @close="closeViewer"
    >
      <p v-if="viewing.error" class="alert" role="alert">
        <AssetIcon name="circle-alert" :size="16" />
        <span>{{ viewing.error }}</span>
      </p>
      <iframe v-else-if="viewing.url" :src="viewing.url" class="pdf-frame" :title="`Inventory report, ${formatDate(viewing.item.generated_at)}`" />
      <span v-else class="sk pdf-frame" aria-busy="true" />

      <template #actions>
        <button type="button" class="btn-outline" @click="closeViewer">Close</button>
        <button type="button" class="btn-primary" :disabled="busyReport === viewing.item.id" @click="downloadReport(viewing.item)">
          <AssetIcon name="file-down" :size="15" />
          {{ busyReport === viewing.item.id ? 'Preparing…' : 'Download PDF' }}
        </button>
      </template>
    </CenterModal>
  </div>
</template>

<script setup>
/**
 * The hospital blood bank's Inventory Report: its paper inventory form,
 * filled from its own shelf (project owner, 2026-10-28). The form holds Whole
 * Blood and Packed RBC; every other component follows on "Other components"
 * pages in the same layout, a column each.
 *
 * New Report sets Report Settings beside the document, as a report viewer does
 * (project owner, 2026-11-01): the components, the blood types and the layout,
 * chosen before anything is drawn. Generate Report has the server build the
 * sheets and keep them as their PDF, so the preview, the Download and every
 * later re-download are the same report, exactly as printed that day; those
 * are listed under Generated Reports.
 *
 * CROSSMATCHED holds the bags tagged to a patient and crossmatched, ready to
 * transfuse (blue), then the day's transfusions (green, (TF)), its Whole
 * Blood under TRANSFUSE AS PRBC. UNCROSSMATCHED holds the free bags (black),
 * those tagged but still waiting for their crossmatch (pink, (T)) and those
 * reserved for a blood donor partner (purple, (R)). Colours: project owner,
 * 2026-11-07.
 */
import PageHeader from '~/components/ui/PageHeader.vue'
import SkeletonRows from '~/components/ui/SkeletonRows.vue'

import CenterModal from '~/components/ui/CenterModal.vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import ListPager from '~/components/common/ListPager.vue'
import { hospitalService } from '~/api/hospital/HospitalService'
import { orderDashboardTypes } from '~/utils/inventoryDashboard'
import { hospitalPageSubtitle } from '~/utils/hospitalPageSubtitles'

definePageMeta({ middleware: ['auth', 'hospital-portal'], layout: 'hospitaldashboard', requires: 'hospital.inventory.view' })

const LAYOUTS = [
  { value: 'type', label: 'One sheet per type', icon: 'layout-grid' },
  { value: 'all', label: 'All types on one sheet', icon: 'layers' },
]

const SECTIONS = [
  { key: 'crossmatched', title: 'CROSSMATCHED' },
  { key: 'uncrossmatched', title: 'UNCROSSMATCHED' },
]

// The names the settings show, as the mock-up writes them; the sheets print the codes.
const COMPONENT_LABELS = { WB: 'Whole Blood', PC: 'PLT', CRYO: 'Cryo' }
const componentLabel = (component) => COMPONENT_LABELS[component.code] || component.code || component.name

const { can, user } = useUser()
const facilityLabel = computed(() => user.value?.facility?.facility_name || 'Your blood bank')

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
const canvasEl = ref(null)
const activeSheet = ref(0)

// The form's own grid, empty, until a report fills it: the server's Whole Blood
// and Packed RBC page, with nothing on it.
const BLANK_ROWS = 20
const blankColumn = (label) => ({ label, cells: [] })
const BLANK_PAGE = {
  kind: 'form',
  blood_type: null,
  page: 1,
  pages: 1,
  crossmatched: ['TRANSFUSE AS PRBC', 'WB', 'PRBC', 'PRBC'].map(blankColumn),
  uncrossmatched: ['WB', 'PRBC', 'PRBC', 'PRBC'].map(blankColumn),
}
const drawnPages = computed(() => (sheet.value ? sheet.value.sheets : [BLANK_PAGE]))
const rowNumbers = computed(() => sheet.value?.rows ?? BLANK_ROWS)

const bagTotal = computed(() => (sheet.value?.totals.crossmatched ?? 0) + (sheet.value?.totals.uncrossmatched ?? 0))
/** The day's transfusions, listed with the crossmatched bags but no longer here. */
const transfusedTotal = computed(() => sheet.value?.totals.transfused ?? 0)
const figures = computed(() => [
  { label: 'Bags in date', value: bagTotal.value },
  { label: 'Crossmatched', value: sheet.value?.totals.crossmatched ?? 0 },
  { label: 'Uncrossmatched', value: sheet.value?.totals.uncrossmatched ?? 0 },
  { label: 'Transfused today', value: transfusedTotal.value },
  { label: 'Pages', value: sheet.value?.sheets.length ?? 0 },
])

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
    activeSheet.value = 0
    nextTick(() => {
      if (canvasEl.value) canvasEl.value.scrollTop = 0
      previewEl.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
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
const historyFrom = computed(() => (historyTotal.value ? ((historyPage.value || 1) - 1) * 10 + 1 : 0))
const historyTo = computed(() => Math.min((historyPage.value || 1) * 10, historyTotal.value))

async function loadHistory(page = 1) {
  historyLoading.value = true
  historyError.value = ''
  try {
    const response = await hospitalService.inventoryReports({ page, per_page: 10 })
    // One page at a time, under the pager, as the centre's lists are.
    reports.value = response?.data ?? []
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

// The kept report being read, on this page: never another browser tab.
const viewing = ref(null)

async function viewReport(item) {
  if (!item) return
  viewing.value = { item, url: '', error: '' }
  busyReport.value = item.id
  try {
    const blob = await hospitalService.downloadInventoryReport(item.id)
    // Closed while it was on its way: nothing to show it in.
    if (viewing.value?.item.id !== item.id) return
    viewing.value.url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }))
  } catch (err) {
    if (viewing.value?.item.id === item.id) viewing.value.error = err?.message || 'The PDF could not be opened. Try again.'
  } finally {
    busyReport.value = null
  }
}

function closeViewer() {
  if (viewing.value?.url) URL.revokeObjectURL(viewing.value.url)
  viewing.value = null
}

onBeforeUnmount(closeViewer)

onMounted(() => {
  loadOptions()
  // The archive's count shows on its tab from the start.
  loadHistory(1)
})

// ── Drawing ──
function jumpTo(index) {
  activeSheet.value = index
  document.getElementById(`sheet-${index}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/** The page being read: the last to have reached the top of the canvas. */
function onCanvasScroll(event) {
  const canvas = event.target
  const papers = canvas.querySelectorAll('.paper')
  let reading = 0
  papers.forEach((paper, index) => {
    if (paper.offsetTop <= canvas.scrollTop + 80) reading = index
  })
  activeSheet.value = reading
}

/** Every bag a kept report listed. */
const reportBags = (item) => (item.totals?.crossmatched ?? 0) + (item.totals?.uncrossmatched ?? 0)

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

/**
 * The colour code, as the PDF prints it (project owner, 2026-11-07).
 * CROSSMATCHED: waiting for transfusion blue, transfused green.
 * UNCROSSMATCHED: tagged pink, reserved purple, the rest black.
 */
function cellTone(cell, section) {
  if (!cell) return ''
  if (section === 'crossmatched') return cell.transfused ? 'form__cell--transfused' : 'form__cell--waiting'
  if (cell.tagged) return 'form__cell--tagged'

  return cell.reserved ? 'form__cell--reserved' : ''
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
  padding: 24px var(--rb-gutter, 24px) 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.spin { animation: spin 0.9s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

.alert {
  display: flex; align-items: center; gap: 8px; margin: 0; padding: 10px 14px; border-radius: 10px; font-size: 13px;
  background: rgba(var(--rb-accent-rgb), 0.08); color: var(--rb-accent-text); border: 1px solid rgba(var(--rb-accent-rgb), 0.25);
}

.panel {
  overflow: hidden;
  border: 1px solid var(--rb-border);
  border-radius: 16px;
  background: var(--rb-surface);
  box-shadow: var(--rb-shadow-sm);
}

/* ── Tabs ── */
.tabs { display: flex; gap: 8px; border-bottom: 1px solid var(--rb-border); overflow: auto hidden; }
.tabs__tab {
  display: inline-flex; align-items: center; gap: 8px; padding: 10px 6px; margin-right: 14px;
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

/* ── New Report: settings beside the document, each scrolling on its own ── */
.workspace {
  display: grid; grid-template-columns: 320px minmax(0, 1fr); gap: 14px; align-items: stretch;
  height: max(560px, calc(100dvh - 240px));
}

.rail { display: flex; flex-direction: column; min-height: 0; }
.rail__title { margin: 0; padding: 10px 18px; font-size: 14.5px; font-weight: 700; color: var(--rb-text-primary); border-bottom: 1px solid var(--rb-border); }
.rail__body { flex: 1; min-height: 0; overflow-y: auto; }
.rail__foot { display: flex; flex-direction: column; gap: 8px; padding: 10px 18px; border-top: 1px solid var(--rb-border); }
.rail__foot .btn-primary { width: 100%; }
.rail__summary { margin: 0; font-size: 12.5px; line-height: 1.45; color: var(--rb-text-secondary); }
.rail__summary--warn { color: var(--rb-warning-text, #B45309); font-weight: 600; }

.setting { display: flex; flex-direction: column; gap: 8px; padding: 10px 18px; border-bottom: 1px solid var(--rb-border); }
.setting:last-child { border-bottom: 0; }
.setting__head { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 26px; }
.setting__title { font-size: 13px; font-weight: 700; color: var(--rb-text-primary); }

.select-all {
  display: inline-flex; align-items: center; gap: 5px; padding: 3px 6px; border: 0; border-radius: 7px; background: none; cursor: pointer;
  font: inherit; font-size: 12px; font-weight: 600; color: var(--rb-primary-text);
}
.select-all:hover { background: rgba(var(--rb-primary-rgb), 0.08); }
.select-all:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: 2px; }

/* Checkbox chips */
.checks { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.checks--types { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.check {
  position: relative; display: flex; align-items: center; gap: 7px; min-width: 0; height: 32px; padding: 0 9px;
  border: 1px solid var(--rb-border-strong); border-radius: 9px; background: var(--rb-surface); cursor: pointer; user-select: none;
  font-size: 12.5px; font-weight: 600; color: var(--rb-text-primary); white-space: nowrap;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}
.check:hover { border-color: rgba(var(--rb-primary-rgb), 0.45); }
.check--on { border-color: rgba(var(--rb-primary-rgb), 0.45); background: rgba(var(--rb-primary-rgb), 0.05); }
.check__input { position: absolute; opacity: 0; width: 1px; height: 1px; pointer-events: none; }
.check__box {
  display: grid; place-items: center; width: 16px; height: 16px; border-radius: 5px; flex-shrink: 0;
  border: 1.5px solid var(--rb-border-strong); background: var(--rb-surface); color: transparent;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}
.check--on .check__box { border-color: var(--rb-primary); background: var(--rb-primary); color: #fff; }
.check:focus-within { outline: 2px solid var(--rb-primary-text); outline-offset: 2px; }
.check-sk { height: 32px; border-radius: 9px; }

/* The two ways to organize it, as a radio list */
.layouts { display: flex; flex-direction: column; gap: 8px; }
.layout {
  position: relative; display: flex; align-items: flex-start; gap: 10px; padding: 8px 12px;
  border: 1px solid var(--rb-border-strong); border-radius: 10px; background: var(--rb-surface); cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}
.layout:hover { border-color: rgba(var(--rb-primary-rgb), 0.45); }
.layout--on { border-color: var(--rb-primary); background: rgba(var(--rb-primary-rgb), 0.05); }
.layout:focus-within { outline: 2px solid var(--rb-primary-text); outline-offset: 2px; }
.layout__text { flex: 1; min-width: 0; }
.layout__title { display: block; font-size: 12.5px; font-weight: 700; color: var(--rb-text-primary); }
.layout__radio {
  flex-shrink: 0; width: 16px; height: 16px; margin-top: 1px; border-radius: 50%;
  border: 1.5px solid var(--rb-border-strong); background: var(--rb-surface);
}
.layout--on .layout__radio { border-color: var(--rb-primary); box-shadow: inset 0 0 0 3px var(--rb-surface); background: var(--rb-primary); }
.layout-sk { height: 52px; border-radius: 10px; }

/* Buttons */
.btn-primary, .btn-outline {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 38px; padding: 0 16px;
  border-radius: 10px; cursor: pointer; white-space: nowrap; font: inherit; font-size: 13px;
  transition: background-color 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
}
.btn-primary { border: 0; background: var(--rb-primary); color: #fff; font-weight: 700; }
.btn-primary:hover:not(:disabled) { background: var(--rb-primary-hover); }
.btn-outline { border: 1px solid var(--rb-border-strong); background: var(--rb-surface); color: var(--rb-text-primary); font-weight: 600; }
.btn-outline:hover:not(:disabled) { border-color: rgba(var(--rb-primary-rgb), 0.45); background: var(--rb-surface-hover); }
.btn-primary:active:not(:disabled), .btn-outline:active:not(:disabled) { transform: translateY(1px); }
.btn-primary:disabled, .btn-outline:disabled { opacity: 0.55; cursor: not-allowed; }
.btn-primary:focus-visible, .btn-outline:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: 2px; }

/* ── The report viewer ── */
.viewer { display: flex; flex-direction: column; min-width: 0; min-height: 0; scroll-margin-top: 80px; }
.viewer__bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 12px 18px; border-bottom: 1px solid var(--rb-border); }
.viewer__heading { min-width: 0; }
.viewer__name { margin: 0; font-size: 14.5px; font-weight: 700; color: var(--rb-text-primary); }
.viewer__meta { margin: 2px 0 0; font-size: 12.5px; color: var(--rb-text-secondary); }
.viewer__actions { display: flex; flex-wrap: wrap; gap: 8px; }
.viewer__stale, .viewer__note { display: flex; align-items: center; gap: 7px; margin: 0; padding: 9px 18px; border-bottom: 1px solid var(--rb-border); font-size: 12.5px; }
.viewer__stale { font-weight: 600; color: var(--rb-warning-text, #B45309); }
.viewer__note { color: var(--rb-text-secondary); }

.figures { display: flex; flex-wrap: wrap; margin: 0; border-bottom: 1px solid var(--rb-border); }
.figure { flex: 0 0 auto; min-width: 112px; padding: 8px 18px; border-right: 1px solid var(--rb-border); }
.figure--wide { flex: 1 1 200px; min-width: 0; border-right: 0; }
.figure dt { font-size: 11.5px; color: var(--rb-text-secondary); }
.figure dd { display: flex; align-items: center; min-height: 26px; margin: 2px 0 0; font-size: 19px; font-weight: 750; font-variant-numeric: tabular-nums; color: var(--rb-text-primary); }
.figure .figure__covers { display: block; font-size: 12.5px; font-weight: 500; line-height: 1.4; }
.figure__sk { width: 44px; }

.pages { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 8px 18px; border-bottom: 1px solid var(--rb-border); }
.jump { display: flex; flex-wrap: wrap; gap: 6px; }
.jump__chip {
  display: inline-flex; align-items: center; gap: 6px; padding: 4px 9px; border-radius: 999px; cursor: pointer;
  border: 1px solid var(--rb-border-strong); background: var(--rb-surface); color: var(--rb-text-primary);
  font: inherit; font-size: 12.5px; font-weight: 700;
}
.jump__chip:hover { border-color: rgba(var(--rb-primary-rgb), 0.45); }
.jump__chip--on { border-color: var(--rb-primary); background: rgba(var(--rb-primary-rgb), 0.08); color: var(--rb-primary-text); }
.jump__chip:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: 2px; }
.jump__count { font-size: 11px; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--rb-text-secondary); }
.pager { display: inline-flex; align-items: center; gap: 8px; margin-left: auto; }
.pager__label { font-size: 12.5px; font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; color: var(--rb-text-secondary); }
.pager__btn {
  display: grid; place-items: center; width: 28px; height: 28px; border: 1px solid var(--rb-border-strong); border-radius: 8px;
  background: var(--rb-surface); color: var(--rb-text-primary); cursor: pointer;
}
.pager__btn:hover:not(:disabled) { border-color: rgba(var(--rb-primary-rgb), 0.45); }
.pager__btn:disabled { opacity: 0.4; cursor: not-allowed; }
.pager__btn:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: 2px; }

.empty { display: flex; flex: 1; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 56px 28px; text-align: center; }
.empty__icon { display: grid; place-items: center; width: 52px; height: 52px; border-radius: 16px; background: rgba(var(--rb-primary-rgb), 0.08); color: var(--rb-primary-text); }
.empty__title { margin: 10px 0 0; font-size: 15px; font-weight: 700; color: var(--rb-text-primary); }
.empty__desc { margin: 0; max-width: 52ch; font-size: 13px; line-height: 1.5; color: var(--rb-text-secondary); }

/* The print preview canvas: the paper on a darker desk, as a PDF viewer sets it. */
.canvas {
  position: relative; flex: 1; min-height: 0; overflow-y: auto;
  display: flex; flex-direction: column; gap: 22px;
  padding: 22px; background: var(--rb-surface-alt);
  transition: opacity 0.15s ease;
}
.canvas--busy { opacity: 0.6; }
.paper {
  flex-shrink: 0; width: 100%; max-width: 860px; margin: 0 auto; scroll-margin-top: 12px;
  background: #ffffff; color: #111827;
  border-radius: 3px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08), 0 12px 32px -12px rgba(15, 23, 42, 0.28);
  padding: 32px 36px 28px;
}
/* The form before there is a report: plainly not filled in. */
.paper--blank > * { opacity: 0.45; }

.paper__head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; margin-bottom: 6px; }
.paper__facility { margin: 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.02em; }
.paper__type { margin: 2px 0 0; font-size: 11.5px; }
.paper__when { margin: 0; font-size: 10.5px; color: #374151; text-align: right; }
.paper__scroll { overflow-x: auto; }
.paper__legend { display: flex; flex-wrap: wrap; gap: 4px 16px; margin: 4px 0 0; font-size: 9.5px; color: #374151; }
.paper__key { display: inline-flex; align-items: center; gap: 5px; }
.paper__swatch { width: 8px; height: 8px; border-radius: 1px; background: #111827; }
.paper__swatch--tagged { background: #D81B60; }
.paper__swatch--reserved { background: #7B1FA2; }
.paper__swatch--waiting { background: #1565C0; }
.paper__swatch--transfused { background: #2E7D32; }
.paper__section { color: #111827; }
.paper__legend + .paper__legend { margin-top: 2px; }
.paper__control { display: flex; justify-content: space-between; gap: 12px; margin-top: 14px; font-size: 10px; font-weight: 700; }

/* The form: hairline rules, as printed. */
.form { width: 100%; min-width: 640px; border-collapse: collapse; table-layout: fixed; }
.form + .form { margin-top: -1px; }
.form__num-col { width: 4%; }
.form__bag-col { width: 15.5%; }
.form__exp-col { width: 8.5%; }
.form th, .form td {
  height: 21px; padding: 0 4px; border: 1px solid #4B5563;
  font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.form__section { font-size: 14px !important; font-weight: 800; letter-spacing: 0.02em; text-align: center; height: 26px !important; }
.form__col { font-size: 10px; font-weight: 700; text-align: center; }
.form__num { text-align: center; font-size: 9px !important; color: #4B5563; }
.form__bag { font-family: var(--rb-font-mono); font-size: 9.5px !important; }
.form__exp { text-align: center; font-size: 9.5px !important; font-variant-numeric: tabular-nums; }
.form__tag { margin-left: 3px; font-family: var(--rb-font-sans); font-weight: 700; text-decoration: none; }
/* The colour code (project owner, 2026-11-07), as the PDF prints it: a tagged
   bag pink, one reserved for a blood donor partner purple, every other bag
   black. The paper stays white in either theme. */
.form__cell--tagged { color: #D81B60; }
.form__cell--reserved { color: #7B1FA2; }
.form__cell--waiting { color: #1565C0; }
.form__cell--transfused { color: #2E7D32; }
.form__sign { height: 34px !important; vertical-align: top; padding-top: 3px !important; font-size: 8.5px !important; }
.form__sign-value { display: block; margin-top: 6px; font-size: 10.5px; }

/* ── Generated reports ── */
.history { min-height: 120px; }
.history__error { margin: 16px 24px 0; font-size: 13px; color: var(--rb-accent-text); }
/* The table, as the centre's Donor Management list draws it (project owner, 2026-10-30). */
.table-wrap { position: relative; overflow-x: auto; transition: opacity 0.15s ease; }
.table-wrap--busy { opacity: 0.55; }
.reports { width: 100%; border-collapse: collapse; font-size: 13px; }
.reports thead th {
  padding: 10px; text-align: left; white-space: nowrap;
  font-size: 10.5px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--rb-text-secondary);
  background: var(--rb-surface-alt); border-bottom: 1px solid var(--rb-border);
}
.reports th:first-child, .reports td:first-child { padding-left: 16px; }
.reports th:last-child, .reports td:last-child { padding-right: 16px; }
.reports tbody td { padding: 11px 10px; border-bottom: 1px solid var(--rb-border); color: var(--rb-text-primary); vertical-align: middle; }
.reports tbody tr:last-child td { border-bottom: 0; }
.reports tbody tr { transition: background 0.12s ease; }
.reports tbody tr:hover { background: var(--rb-surface-hover); }
.reports__date { display: block; font-weight: 700; white-space: nowrap; }
.reports__new { margin-left: 6px; padding: 1px 7px; border-radius: 999px; font-size: 11px; font-weight: 600; background: rgba(var(--rb-primary-rgb), 0.1); color: var(--rb-primary-text); }
.reports__sub { display: block; font-size: 11.5px; color: var(--rb-text-secondary); }
.reports__covers { min-width: 180px; }
.reports .reports__actions { text-align: right; white-space: nowrap; }
.reports .num { text-align: right; font-variant-numeric: tabular-nums; }
.reports .reports__empty { padding: 0; }

.row-actions { display: flex; justify-content: flex-end; gap: 6px; }
.row-btn {
  display: grid; place-items: center; width: 30px; height: 30px;
  border: 1px solid var(--rb-border-strong); border-radius: 8px;
  background: var(--rb-surface); color: var(--rb-text-secondary); cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease, border-color 0.12s ease;
}
.row-btn:hover:not(:disabled) { color: var(--rb-primary-text); border-color: rgba(var(--rb-primary-rgb), 0.45); background: var(--rb-surface-hover); }
.row-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.row-btn:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }

.list-empty { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 48px 24px; text-align: center; }
.list-empty__icon {
  display: grid; place-items: center; width: 44px; height: 44px; margin-bottom: 6px; border-radius: 12px;
  background: var(--rb-surface-alt); border: 1px solid var(--rb-border); color: var(--rb-text-secondary);
}
.list-empty__title { margin: 0; font-size: 14px; font-weight: 700; color: var(--rb-text-primary); }
.list-empty__text { margin: 0; max-width: 44ch; font-size: 13px; line-height: 1.5; color: var(--rb-text-secondary); }

/* A kept report's PDF */
.pdf-frame { display: block; width: 100%; height: 68dvh; border: 1px solid var(--rb-border); border-radius: 8px; }

@media (prefers-reduced-motion: reduce) {
  .spin { animation: none; }
  .check, .check__box, .layout, .btn-primary, .btn-outline { transition: none; }
}

/* Too narrow for the two side by side: settings first, and the page scrolls. */
@media (max-width: 1100px) {
  .workspace { grid-template-columns: minmax(0, 1fr); height: auto; }
  .canvas { overflow-y: visible; }
  .checks { grid-template-columns: repeat(auto-fill, minmax(112px, 1fr)); }
  .checks--types { grid-template-columns: repeat(auto-fill, minmax(72px, 1fr)); }
}

@media (max-width: 640px) {
  .report { padding: 16px 16px 32px; }
  .canvas { padding: 12px; }
  .paper { padding: 18px 14px; }
  .viewer__actions, .viewer__actions .btn-primary, .viewer__actions .btn-outline { flex: 1 1 auto; }
  .figure { flex: 1 1 40%; min-width: 0; border-right: 0; }
}
</style>
