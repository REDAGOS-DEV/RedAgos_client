<template>
  <!--
    Reports for a period, counted from the records the way the dashboards
    count them. Two kinds share this view, its period bar, chart and export:
      centre      the Admin and the Supervisor (reports.view_all),
                  GET /blood-center/reports/centre
      collection  the Donor & Collection roles (donations.view),
                  GET /blood-center/reports/collection
  -->
  <div class="cr">
    <header class="cr__head">
      <div>
        <h1 class="cr__title">Reports &amp; Analytics</h1>
        <p class="cr__sub">{{ kind === 'collection' ? 'Donor & Collection' : facilityName }} · {{ periodLabel }}</p>
      </div>
      <!-- One toolbar, one height: the period, its dates when custom, the export. -->
      <div class="cr__tools">
        <SelectField
          :model-value="preset"
          class="tool-period"
          size="sm"
          icon="calendar"
          aria-label="Period"
          :options="PRESETS.map(p => ({ value: p.key, label: p.label }))"
          @update:model-value="choose"
        />
        <template v-if="preset === 'custom'">
          <DatePicker v-model="from" class="tool-date" :max="to || today" aria-label="From" size="sm" />
          <span class="tool-sep" aria-hidden="true">to</span>
          <DatePicker v-model="to" class="tool-date" :min="from" :max="today" aria-label="To" size="sm" />
        </template>
        <button type="button" class="export" :disabled="!data" @click="exportCsv">
          <AssetIcon name="download" :size="15" />
          Export CSV
        </button>
        <!-- The whole period as a printable report, with the centre's letterhead. -->
        <button type="button" class="export" :disabled="!data || pdfBusy" @click="downloadPdf">
          <AssetIcon name="file-down" :size="15" />
          {{ pdfBusy ? 'Preparing…' : 'Download PDF' }}
        </button>
      </div>
    </header>

    <nav class="tabs" role="tablist" aria-label="Report">
      <button v-for="t in TABS" :key="t.key" type="button" role="tab" class="tab" :class="{ 'tab--on': tab === t.key }"
        :aria-selected="tab === t.key" @click="tab = t.key">
        <AssetIcon :name="t.icon" :size="15" />
        {{ t.label }}
      </button>
      <!-- Looking ahead lives on its own page. -->
      <NuxtLink v-if="can(FORECAST_ABILITIES)" to="/blood-center/forecast" class="tabs__aside">
        <AssetIcon name="trending-up" :size="15" />
        Demand forecast
        <AssetIcon name="arrow-right" :size="13" />
      </NuxtLink>
    </nav>

    <p v-if="error" class="cr__error" role="alert">
      {{ error }} <button type="button" class="link" @click="load">Try again</button>
    </p>

    <div v-if="loading && !data" class="grid4" aria-busy="true">
      <span v-for="n in 4" :key="n" class="kpi kpi--skeleton" />
    </div>

    <template v-else-if="data">
      <section class="stack" :aria-label="currentTab.label">
        <div v-if="kpis.length" class="grid4">
          <div v-for="k in kpis" :key="k.label" class="kpi">
            <span class="kpi__label">{{ k.label }}</span>
            <span class="kpi__value" :class="k.warn && k.value ? 'kpi__value--warn' : ''">{{ k.value }}</span>
            <span v-if="k.delta" class="kpi__foot">
              <span class="delta" :class="`delta--${k.delta.tone}`">
                <AssetIcon v-if="k.delta.tone !== 'flat'" :name="k.delta.up ? 'trending-up' : 'trending-down'" :size="13" />
                {{ k.delta.text }}
              </span>
              <span class="kpi__note">vs previous {{ data.period.days }} days</span>
            </span>
            <span v-else class="kpi__note">{{ k.note }}</span>
          </div>
        </div>

        <!--
          One series at a time, picked above the chart: three bars a day over a
          month was ninety bars and no scale. Gridlines and dates give it one;
          hovering a day shows its count.
        -->
        <section v-if="tab !== 'staff' && tab !== 'activity' && tab !== 'profile'" class="card" aria-labelledby="daily-title">
          <header class="card__head">
            <h2 id="daily-title" class="card__title">Day by day</h2>
            <div class="daily-tools">
            <div v-if="dailyView === 'chart'" class="series" role="radiogroup" aria-label="Show">
              <button v-for="sr in SERIES" :key="sr.key" type="button" role="radio" class="series__btn"
                :class="[`series__btn--${sr.key}`, { 'series__btn--on': series === sr.key }]"
                :aria-checked="series === sr.key" @click="series = sr.key">
                <i class="series__dot" aria-hidden="true" />
                {{ sr.label }}
                <strong>{{ seriesTotal(sr.key) }}</strong>
              </button>
            </div>
            <!-- The exact counts, a day a row, for whoever needs the figures rather than the shape. -->
            <div class="view-toggle" role="radiogroup" aria-label="View">
              <button type="button" role="radio" class="view-toggle__btn" :class="{ 'view-toggle__btn--on': dailyView === 'chart' }"
                :aria-checked="dailyView === 'chart'" @click="dailyView = 'chart'">
                <AssetIcon name="bar-chart" :size="14" /> Chart
              </button>
              <button type="button" role="radio" class="view-toggle__btn" :class="{ 'view-toggle__btn--on': dailyView === 'table' }"
                :aria-checked="dailyView === 'table'" @click="dailyView = 'table'">
                <AssetIcon name="list" :size="14" /> Table
              </button>
            </div>
            </div>
          </header>

          <div v-if="dailyView === 'table'" class="daily-table-wrap">
            <table class="daily-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th v-for="sr in SERIES" :key="sr.key" class="num">{{ sr.label }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="day in dailyNewestFirst" :key="day.date" :class="{ 'is-today': day.date === today }">
                  <td>{{ fmtWeekday(day.date) }}</td>
                  <td v-for="sr in SERIES" :key="sr.key" class="num" :class="{ 'is-zero': !day[sr.key] }">{{ day[sr.key] ?? 0 }}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td v-for="sr in SERIES" :key="sr.key" class="num">{{ seriesTotal(sr.key) }}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div v-else-if="!seriesTotal(series)" class="chart-empty">
            <span class="chart-empty__icon" aria-hidden="true"><AssetIcon name="bar-chart" :size="22" /></span>
            <p class="chart-empty__title">No {{ currentSeries.label.toLowerCase() }} in this period</p>
            <p class="chart-empty__text">Try a longer period, or another figure above.</p>
          </div>

          <div v-else class="plot" :class="`plot--${series}`">
            <div class="plot__y" aria-hidden="true">
              <span>{{ yMax }}</span>
              <span>{{ yMax / 2 }}</span>
              <span>0</span>
            </div>
            <div class="plot__area">
              <div class="plot__grid" aria-hidden="true"><span /><span /><span /></div>
              <!-- The series as a smooth curve over a soft fill; a point a day, drawn in the columns below. -->
              <svg class="curve" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true">
                <defs>
                  <linearGradient id="cr-curve-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" class="curve__stop curve__stop--top" />
                    <stop offset="100%" class="curve__stop curve__stop--bottom" />
                  </linearGradient>
                </defs>
                <path :d="curve.area" fill="url(#cr-curve-fill)" />
                <path :d="curve.line" class="curve__line" vector-effect="non-scaling-stroke" />
              </svg>
              <div class="plot__bars" :class="{ 'plot__bars--dense': daily.length > 31 }" role="img" :aria-label="chartLabel">
                <div v-for="(day, i) in daily" :key="day.date" class="col" :class="{ 'col--today': day.date === today }">
                  <span class="col__dot" :style="{ bottom: `${pointHeight(day[series])}%` }" />
                  <span class="col__tip" :style="{ bottom: `calc(${pointHeight(day[series])}% + 12px)` }">{{ fmtDay(day.date) }} · {{ day[series] }}</span>
                  <span v-if="showTick(i)" class="col__tick" aria-hidden="true">{{ fmtDay(day.date) }}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- ── Collection: overview ── -->
        <template v-if="tab === 'overview'">
          <div class="grid-ov">
            <!-- Age brackets: the tallest bar carries the colour, the rest step back. -->
            <section class="card" aria-labelledby="age-title">
              <header class="card__head">
                <h2 id="age-title" class="card__title">Donors by age</h2>
                <span class="card__note">Donations collected</span>
              </header>
              <div v-if="profile.total.total" class="ages" role="img" :aria-label="agesLabel">
                <div v-for="a in ageBars" :key="a.key" class="ages__col" :class="{ 'ages__col--top': a.top }">
                  <span class="ages__pct">{{ a.pct }}%</span>
                  <span class="ages__track"><span class="ages__bar" :style="{ height: `${a.height}%` }" /></span>
                  <span class="ages__label">{{ a.key }}</span>
                </div>
              </div>
              <p v-else class="empty">No donations collected in this period.</p>
            </section>

            <!-- Donor status as a ring, the sexes as one split bar beneath it. -->
            <section class="card" aria-labelledby="mix-title">
              <header class="card__head">
                <h2 id="mix-title" class="card__title">Who donated</h2>
                <button type="button" class="card__link" @click="tab = 'profile'">
                  Full record <AssetIcon name="arrow-right" :size="14" />
                </button>
              </header>
              <template v-if="profile.total.total">
                <div class="mix">
                  <svg class="donut" viewBox="0 0 120 120" role="img" :aria-label="typesLabel">
                    <circle class="donut__base" cx="60" cy="60" r="46" />
                    <circle v-for="seg in ringSegments" :key="seg.key" class="donut__seg" cx="60" cy="60" r="46"
                      :style="{ stroke: `rgba(var(--rb-primary-rgb), ${seg.alpha})`, strokeDasharray: `${seg.length} ${RING - seg.length}`, strokeDashoffset: -seg.offset }" />
                    <text x="60" y="58" class="donut__value">{{ repeatShare }}%</text>
                    <text x="60" y="74" class="donut__caption">came back</text>
                  </svg>
                  <ul class="mix__legend">
                    <li v-for="seg in ringSegments" :key="seg.key">
                      <span class="mix__dot" :style="{ background: `rgba(var(--rb-primary-rgb), ${seg.alpha})` }" />
                      <span class="mix__name">{{ seg.label }}</span>
                      <span class="mix__count">{{ seg.count }}</span>
                    </li>
                  </ul>
                </div>
                <div class="sexes">
                  <div class="sexes__bar" role="img" :aria-label="`${profile.total.sex.female} female, ${profile.total.sex.male} male`">
                    <span class="sexes__f" :style="{ flexGrow: profile.total.sex.female || 0 }" />
                    <span class="sexes__m" :style="{ flexGrow: profile.total.sex.male || 0 }" />
                  </div>
                  <div class="sexes__legend">
                    <span><span class="mix__dot sexes__f" />Female <strong>{{ profile.total.sex.female }}</strong></span>
                    <span>Male <strong>{{ profile.total.sex.male }}</strong><span class="mix__dot sexes__m" /></span>
                  </div>
                </div>
              </template>
              <p v-else class="empty">No donations collected in this period.</p>
            </section>
          </div>

          <!-- When donors reach the counter, to staff the busy hours. -->
          <section class="card" aria-labelledby="busy-title">
            <header class="card__head">
              <h2 id="busy-title" class="card__title">Busiest hours at the counter</h2>
              <span class="card__note">{{ busy.openLabel ? `Open ${busy.openLabel}` : 'Every arrival, by weekday and hour' }}</span>
            </header>
            <template v-if="busy.max">
              <div class="heat" :style="{ '--cols': busy.hours.length }">
                <span />
                <span v-for="h in busy.hours" :key="`h${h}`" class="heat__hour">{{ busy.hours.length <= 12 || h % 2 === 0 ? hourLabel(h) : '' }}</span>
                <template v-for="d in busy.days" :key="`d${d}`">
                  <span class="heat__day">{{ WEEKDAYS[d] }}</span>
                  <span v-for="h in busy.hours" :key="`c${d}-${h}`" class="heat__cell"
                    :class="{ 'heat__cell--closed': !busy.isOpen(d, h) }"
                    :style="{ backgroundColor: data.busiest[d][h] ? `rgba(var(--rb-primary-rgb), ${0.14 + 0.86 * (data.busiest[d][h] / busy.max)})` : '' }"
                    :title="`${WEEKDAYS[d]} ${hourLabel(h)}: ${data.busiest[d][h]} arrivals${busy.isOpen(d, h) ? '' : ' (outside opening hours)'}`" />
                </template>
              </div>
              <dl class="heat__facts">
                <div><dt>Peak hour</dt><dd>{{ busy.peak }}</dd></div>
                <div><dt>Busiest day</dt><dd>{{ busy.day }}</dd></div>
                <div><dt>Arrivals</dt><dd>{{ busy.total }}</dd></div>
              </dl>
            </template>
            <p v-else class="empty">No one reached the counter in this period.</p>
          </section>
        </template>

        <!-- ── Centre ── -->
        <div v-if="tab === 'centre'" class="grid2">
          <section class="card" aria-labelledby="req-title">
            <h2 id="req-title" class="card__title">Hospital requests</h2>
            <dl class="rows">
              <div><dt>Received</dt><dd>{{ data.centre.requests.received }}</dd></div>
              <div><dt>Emergency</dt><dd>{{ data.centre.requests.emergency }}</dd></div>
              <div><dt>Fulfilled</dt><dd>{{ data.centre.requests.fulfilled }}</dd></div>
              <div><dt>Partly fulfilled</dt><dd>{{ data.centre.requests.partial }}</dd></div>
              <div><dt>Still open</dt><dd>{{ data.centre.requests.open }}</dd></div>
              <div><dt>Declined or cancelled</dt><dd>{{ data.centre.requests.declined }}</dd></div>
            </dl>
          </section>
          <section class="card" aria-labelledby="units-title">
            <h2 id="units-title" class="card__title">Blood units</h2>
            <dl class="rows">
              <div><dt>Released to hospitals</dt><dd>{{ data.centre.units.released }}</dd></div>
              <div><dt>Expired</dt><dd>{{ data.centre.units.expired }}</dd></div>
              <div><dt>Discarded</dt><dd>{{ data.centre.units.discarded }}</dd></div>
              <div><dt>Donations collected</dt><dd>{{ data.centre.donations }}</dd></div>
              <div><dt>Donors deferred</dt><dd>{{ data.centre.deferrals }}</dd></div>
            </dl>
          </section>
        </div>

        <!-- ── Staff & access ── -->
        <section v-if="tab === 'staff'" class="card" aria-labelledby="events-title">
          <header class="card__head">
            <h2 id="events-title" class="card__title">Account changes</h2>
            <NuxtLink to="/blood-center/audit-log" class="card__link">Audit Log <AssetIcon name="arrow-right" :size="13" /></NuxtLink>
          </header>
          <table v-if="data.staff.events.length" class="table">
            <thead><tr><th>When</th><th>Change</th><th>Account</th><th>By</th></tr></thead>
            <tbody>
              <tr v-for="e in data.staff.events" :key="e.id">
                <td>{{ fmtWhen(e.at) }}</td>
                <td>{{ e.label }}</td>
                <td>{{ e.subject || '—' }}</td>
                <td>{{ e.by }}</td>
              </tr>
            </tbody>
          </table>
          <p v-else class="empty">No staff account changes in this period.</p>
        </section>

        <!-- ── Activity ── -->
        <div v-if="tab === 'activity'" class="grid2">
          <section class="card" aria-labelledby="mod-title">
            <header class="card__head">
              <h2 id="mod-title" class="card__title">By module</h2>
              <span class="card__note">{{ data.activity.total }} recorded actions</span>
            </header>
            <ul v-if="data.activity.by_module.length" class="hbars">
              <li v-for="m in data.activity.by_module" :key="m.module" class="hbar">
                <span class="hbar__label">{{ m.module }}</span>
                <span class="hbar__track"><span :style="{ width: `${pctOf(m.count, maxModule)}%` }" /></span>
                <span class="hbar__count">{{ m.count }}</span>
              </li>
            </ul>
            <p v-else class="empty">Nothing recorded in this period.</p>
          </section>
          <section class="card" aria-labelledby="people-title">
            <h2 id="people-title" class="card__title">Most active</h2>
            <ol v-if="data.activity.top_people.length" class="people">
              <li v-for="(p, i) in data.activity.top_people" :key="i" class="person">
                <span class="person__rank">{{ i + 1 }}</span>
                <span class="person__name">{{ p.name }}</span>
                <span class="person__count">{{ p.count }} actions</span>
              </li>
            </ol>
            <p v-else class="empty">Nothing recorded in this period.</p>
          </section>
        </div>

        <!-- ── Collection: donations ── -->
        <div v-if="tab === 'donations'" class="grid2">
          <section class="card" aria-labelledby="group-title">
            <header class="card__head">
              <h2 id="group-title" class="card__title">Donations by blood group</h2>
              <span class="card__note">From the donor's record</span>
            </header>
            <ul v-if="data.donations.by_blood_group.length" class="hbars">
              <li v-for="g in data.donations.by_blood_group" :key="g.code" class="hbar">
                <span class="hbar__label">{{ g.code }}</span>
                <span class="hbar__track"><span :style="{ width: `${pctOf(g.count, maxOf(data.donations.by_blood_group))}%` }" /></span>
                <span class="hbar__count">{{ g.count }}</span>
              </li>
            </ul>
            <p v-else class="empty">No donations in this period.</p>
          </section>
          <section class="card" aria-labelledby="dtype-title">
            <h2 id="dtype-title" class="card__title">Deferrals by type</h2>
            <dl v-if="data.deferrals.by_type.length" class="rows">
              <div v-for="t in data.deferrals.by_type" :key="t.type"><dt>{{ t.type }}</dt><dd>{{ t.count }}</dd></div>
            </dl>
            <p v-else class="empty">No donors deferred in this period.</p>
          </section>
        </div>

        <!-- ── Collection: appointments ── -->
        <div v-if="tab === 'appointments'" class="grid2">
          <section class="card" aria-labelledby="appt-title">
            <h2 id="appt-title" class="card__title">Appointments</h2>
            <dl class="rows">
              <div><dt>Booked</dt><dd>{{ data.appointments.booked }}</dd></div>
              <div><dt>Came and donated</dt><dd>{{ data.appointments.completed }}</dd></div>
              <div><dt>No-show</dt><dd>{{ data.appointments.no_show }}</dd></div>
              <div><dt>Cancelled</dt><dd>{{ data.appointments.cancelled }}</dd></div>
              <div><dt>Booked at a drive</dt><dd>{{ data.appointments.from_drives }}</dd></div>
            </dl>
          </section>
          <section class="card" aria-labelledby="drives-title">
            <header class="card__head">
              <h2 id="drives-title" class="card__title">Drives held</h2>
              <span class="card__note">{{ data.drives.held }} in this period</span>
            </header>
            <table v-if="data.drives.list.length" class="table">
              <thead><tr><th>Date</th><th>Drive</th><th>Booked</th></tr></thead>
              <tbody>
                <tr v-for="d in data.drives.list" :key="d.id">
                  <td>{{ fmtDay(d.date) }}</td>
                  <td>{{ d.name }}</td>
                  <td>{{ d.booked }}{{ d.capacity ? ` / ${d.capacity}` : '' }}</td>
                </tr>
              </tbody>
            </table>
            <p v-else class="empty">No drives in this period.</p>
          </section>
        </div>

        <!--
          ── Collection: donor profile ──
          The centre's monthly collection record, laid out as its paper sheet:
          sex, age bracket and type of donor, a row a month and the total.
        -->
        <section v-if="tab === 'profile'" class="card" aria-labelledby="profile-title">
          <header class="card__head">
            <div>
              <h2 id="profile-title" class="card__title">Collection record</h2>
              <span class="card__note">Donations collected, by donor</span>
            </div>
            <!-- The same figures, laid out as the centre's SNBC sheet, ready to submit. -->
            <button type="button" class="snbc-download" :disabled="snbcBusy" @click="downloadSnbc">
              <AssetIcon name="file-down" :size="15" />
              {{ snbcBusy ? 'Preparing…' : 'Download SNBC record (.xlsx)' }}
            </button>
          </header>
          <p v-if="snbcError" class="cr__error" role="alert">{{ snbcError }}</p>
          <div v-if="profile.total.total" class="snbc-wrap">
            <table class="snbc">
              <thead>
                <tr>
                  <th rowspan="3" class="snbc__month">Month</th>
                  <th colspan="2" class="snbc__group">Sex</th>
                  <th :colspan="AGE_COLS.length" class="snbc__group">Age bracket</th>
                  <th :colspan="KIND_COLS.length" class="snbc__group">Type of donor</th>
                  <th :colspan="TYPE_COLS.length" class="snbc__group">Donor status</th>
                  <th rowspan="3" class="snbc__total">Total</th>
                </tr>
                <!-- WALK-IN holds its TS and NTS donors beneath it; the rest span both rows. -->
                <tr>
                  <th v-for="c in SEX_COLS" :key="`s${c.key}`" rowspan="2" :class="{ 'snbc__first': c === SEX_COLS[0] }">{{ c.label }}</th>
                  <th v-for="c in AGE_COLS" :key="`a${c.key}`" rowspan="2" :class="{ 'snbc__first': c === AGE_COLS[0] }">{{ c.label }}</th>
                  <th colspan="3" class="snbc__first snbc__sub" title="Everyone who came to the centre">Walk-in</th>
                  <th rowspan="2" :title="KIND_COLS[3].title">{{ KIND_COLS[3].label }}</th>
                  <th v-for="c in TYPE_COLS" :key="`t${c.key}`" rowspan="2" :class="{ 'snbc__first': c === TYPE_COLS[0] }">{{ c.label }}</th>
                </tr>
                <tr>
                  <th v-for="c in KIND_COLS.slice(0, 3)" :key="`k${c.key}`" :class="{ 'snbc__first': c === KIND_COLS[0] }" :title="c.title">{{ c.label }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in profileRows" :key="row.month" :class="{ 'snbc__sum': row.month === 'total' }">
                  <th scope="row" class="snbc__month">
                    {{ row.month === 'total' ? 'Total' : fmtMonth(row.month) }}
                  </th>
                  <td v-for="c in SEX_COLS" :key="`s${c.key}`" :class="{ 'snbc__first': c === SEX_COLS[0], 'snbc__zero': !row.sex[c.key] }">{{ row.sex[c.key] }}</td>
                  <td v-for="c in AGE_COLS" :key="`a${c.key}`" :class="{ 'snbc__first': c === AGE_COLS[0], 'snbc__zero': !row.age[c.key] }">{{ row.age[c.key] }}</td>
                  <td v-for="c in KIND_COLS" :key="`k${c.key}`" :class="{ 'snbc__first': c === KIND_COLS[0], 'snbc__zero': !kindCount(row, c.key) }">{{ kindCount(row, c.key) }}</td>
                  <td v-for="c in TYPE_COLS" :key="`t${c.key}`" :class="{ 'snbc__first': c === TYPE_COLS[0], 'snbc__zero': !row.type[c.key] }">{{ row.type[c.key] }}</td>
                  <td class="snbc__total">{{ row.total }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-else class="empty">No donations collected in this period.</p>
          <ul class="snbc-notes">
            <li v-if="profile.total.sex.not_stated || profile.total.age.not_stated">
              Not counted above: {{ profile.total.sex.not_stated }} with no sex recorded,
              {{ profile.total.age.not_stated }} with no birth date.
            </li>
            <li>
              <strong>Walk-in</strong> counts everyone who came to the centre; among them, <strong>TS</strong> gave for a patient
              of the same blood type and <strong>NTS</strong> for a patient of another, as picked at the counter.
              <strong>Mobile drive</strong> counts the donors at drives.
            </li>
            <li>
              <strong>New to centre</strong> donated before, but elsewhere; this was their first time here.
              <strong>Lapsed</strong> donated here before, but over {{ Math.round(profile.lapsed_after_days / 30) }} months earlier.
            </li>
          </ul>
        </section>

        <!-- ── Collection: deferrals ── -->
        <div v-if="tab === 'deferrals'" class="grid2">
          <section class="card" aria-labelledby="reason-title">
            <header class="card__head">
              <h2 id="reason-title" class="card__title">Most common reasons</h2>
              <!-- By deferral code; the server adds what each stands for only for the clinical record's holder. -->
              <span class="card__note">By deferral code</span>
            </header>
            <ul v-if="data.deferrals.top_reasons.length" class="hbars hbars--wide">
              <li v-for="r in data.deferrals.top_reasons" :key="r.label" class="hbar">
                <span class="hbar__label" :title="r.label">{{ r.label }}</span>
                <span class="hbar__track"><span :style="{ width: `${pctOf(r.count, maxOf(data.deferrals.top_reasons))}%` }" /></span>
                <span class="hbar__count">{{ r.count }}</span>
              </li>
            </ul>
            <p v-else class="empty">No donors deferred in this period.</p>
          </section>
          <section class="card" aria-labelledby="dtype2-title">
            <h2 id="dtype2-title" class="card__title">By type</h2>
            <dl v-if="data.deferrals.by_type.length" class="rows">
              <div v-for="t in data.deferrals.by_type" :key="t.type"><dt>{{ t.type }}</dt><dd>{{ t.count }}</dd></div>
            </dl>
            <p v-else class="empty">No donors deferred in this period.</p>
          </section>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import DatePicker from '~/components/common/DatePicker.vue'
import SelectField from '~/components/common/SelectField.vue'
import { FORECAST_ABILITIES } from '~/composables/useBloodCenterNav'
import { smoothPath } from '~/utils/smoothPath'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'

const props = defineProps({
  /** 'centre' (reports.view_all) or 'collection' (donations.view). */
  kind: { type: String, default: 'centre' },
})

const { user, can } = useUser()
const facilityName = computed(() => user.value?.facility?.facility_name || 'Your blood center')

const TABS = props.kind === 'collection'
  ? [
      { key: 'overview', label: 'Overview', icon: 'layout-dashboard' },
      { key: 'donations', label: 'Donations', icon: 'droplets' },
      { key: 'appointments', label: 'Appointments', icon: 'calendar' },
      { key: 'deferrals', label: 'Deferrals', icon: 'user-x' },
      { key: 'profile', label: 'Donor profile', icon: 'clipboard-list' },
    ]
  : [
      { key: 'centre', label: 'Centre', icon: 'layout-dashboard' },
      { key: 'staff', label: 'Staff & access', icon: 'users' },
      { key: 'activity', label: 'Activity', icon: 'history' },
    ]
const PRESETS = [
  { key: '7', label: 'Last 7 days' },
  { key: '30', label: 'Last 30 days' },
  { key: 'month', label: 'This month' },
  { key: 'last-month', label: 'Last month' },
  { key: 'quarter', label: 'This quarter' },
  { key: 'last-quarter', label: 'Last quarter' },
  { key: 'custom', label: 'Custom range' },
]

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const today = iso(new Date())
const daysAgo = n => iso(new Date(Date.now() - n * 86_400_000))

const tab = ref(TABS[0].key)
const currentTab = computed(() => TABS.find(t => t.key === tab.value) ?? TABS[0])
const preset = ref('30')
const from = ref(daysAgo(29))
const to = ref(today)
const data = ref(null)
const loading = ref(false)
const error = ref('')

function choose(key) {
  preset.value = key
  if (key === '7') { from.value = daysAgo(6); to.value = today }
  if (key === '30') { from.value = daysAgo(29); to.value = today }
  if (key === 'month') { from.value = `${today.slice(0, 8)}01`; to.value = today }
  const now = new Date()
  if (key === 'last-month') {
    from.value = iso(new Date(now.getFullYear(), now.getMonth() - 1, 1))
    to.value = iso(new Date(now.getFullYear(), now.getMonth(), 0))
  }
  // Quarters run Jan-Mar, Apr-Jun, Jul-Sep, Oct-Dec.
  const q = Math.floor(now.getMonth() / 3) * 3
  if (key === 'quarter') { from.value = iso(new Date(now.getFullYear(), q, 1)); to.value = today }
  if (key === 'last-quarter') {
    from.value = iso(new Date(now.getFullYear(), q - 3, 1))
    to.value = iso(new Date(now.getFullYear(), q, 0))
  }
}

async function load() {
  if (!from.value || !to.value) return
  loading.value = true
  error.value = ''
  try {
    const params = { from: from.value, to: to.value }
    data.value = props.kind === 'collection'
      ? await bloodCenterService.collectionReport(params)
      : await bloodCenterService.centreReport(params)
  } catch (err) {
    console.error('Failed to load the report:', err)
    error.value = err?.data?.message || err?.message || 'The report could not be loaded.'
  } finally {
    loading.value = false
  }
}
watch([from, to], load)
onMounted(load)

const fmtDay = d => new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const fmtWhen = at => (at ? new Date(at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '')
const periodLabel = computed(() => (data.value ? `${fmtDay(data.value.period.from)} to ${fmtDay(data.value.period.to)}, ${data.value.period.days} days` : ''))

// ── The day-by-day chart ──
const SERIES = [
  { key: 'donations', label: 'Donations' },
  { key: 'deferrals', label: 'Deferrals' },
  props.kind === 'collection' ? { key: 'appointments', label: 'Appointments' } : { key: 'requests', label: 'Requests' },
]
const series = ref('donations')
// Each Collection tab opens the chart on its own series.
watch(tab, (t) => { if (SERIES.some(x => x.key === t)) series.value = t })
const daily = computed(() => (props.kind === 'collection' ? data.value?.daily : data.value?.centre?.daily) ?? [])
const currentSeries = computed(() => SERIES.find(x => x.key === series.value))
const seriesTotal = key => daily.value.reduce((sum, d) => sum + (d[key] ?? 0), 0)

// A round, even top for the scale (2, 4, 6, 8, 10, 20, 40...), so its midpoint is a whole number.
const yMax = computed(() => {
  const top = Math.max(1, ...daily.value.map(d => d[series.value] ?? 0))
  const step = 10 ** Math.floor(Math.log10(top))
  return [2, 4, 6, 8, 10].map(m => m * step).find(v => v >= top) ?? top
})

// The curve: a point at the middle of each day's column, on the same scale.
const pointHeight = n => Math.min(100, ((n || 0) / yMax.value) * 100)
const curve = computed(() => {
  const n = daily.value.length
  if (!n) return { line: '', area: '' }
  const points = daily.value.map((d, i) => ({ x: ((i + 0.5) / n) * 1000, y: 100 - pointHeight(d[series.value]) }))
  const line = smoothPath(points)
  return { line, area: `${line} L${points[n - 1].x},100 L${points[0].x},100 Z` }
})

// About six dates under the chart, whatever the period's length.
const showTick = (i) => {
  const n = daily.value.length
  const every = Math.max(1, Math.ceil(n / 6))
  return i % every === 0
}
const pctOf = (n, max) => Math.round((n / Math.max(1, max)) * 100)
const maxOf = list => Math.max(1, ...list.map(x => x.count))

// The collection record's columns, in the paper sheet's order.
const SEX_COLS = [{ key: 'female', label: 'Female' }, { key: 'male', label: 'Male' }]
const AGE_COLS = ['16-17', '18-24', '25-44', '45-64', '65+'].map(k => ({ key: k, label: k }))
const TYPE_COLS = [
  { key: 'first_time', label: 'First time' },
  { key: 'new_to_centre', label: 'New to centre' },
  { key: 'repeat_retained', label: 'Repeat' },
  { key: 'lapsed', label: 'Lapsed' },
]
// Type of donor, as the counter picks it. WALK-IN counts everyone who came to
// the centre, its TS and NTS donors among them; a drive's donors stand apart.
const KIND_COLS = [
  { key: 'walk_in_total', label: 'Total', title: 'Everyone who came to the centre, TS and NTS included' },
  { key: 'ts', label: 'TS', title: 'Type-specific: for a patient of the same blood type' },
  { key: 'nts', label: 'NTS', title: 'Non-type-specific: for a patient of another blood type' },
  { key: 'drive', label: 'Mobile drive', title: 'At a mobile blood drive' },
]
const kindCount = (row, key) => (key === 'walk_in_total'
  ? (row.kind?.walk_in ?? 0) + (row.kind?.ts ?? 0) + (row.kind?.nts ?? 0)
  : row.kind?.[key] ?? 0)
const profile = computed(() => data.value?.donor_profile ?? { months: [], total: { total: 0, sex: {}, age: {}, type: {}, kind: {} }, lapsed_after_days: 365, lapsed_donors: 0 })
const profileRows = computed(() => [...profile.value.months, { month: 'total', ...profile.value.total }])
// Overview: age bars, the type-of-donor ring, the busiest hours.
const ageBars = computed(() => {
  const age = profile.value.total.age
  const counted = AGE_COLS.reduce((n, c) => n + (age[c.key] ?? 0), 0) || 1
  const top = Math.max(1, ...AGE_COLS.map(c => age[c.key] ?? 0))
  return AGE_COLS.map(c => ({
    key: c.key,
    pct: Math.round(((age[c.key] ?? 0) / counted) * 100),
    height: ((age[c.key] ?? 0) / top) * 100,
    top: (age[c.key] ?? 0) === top && top > 0,
  }))
})
const agesLabel = computed(() => ageBars.value.map(a => `${a.key}: ${a.pct}%`).join(', '))

const RING = 2 * Math.PI * 46
const ringSegments = computed(() => {
  const t = profile.value.total
  const alphas = [1, 0.7, 0.42, 0.2]
  const order = ['repeat_retained', 'first_time', 'new_to_centre', 'lapsed']
  let offset = 0
  return order.map((key, i) => {
    const count = t.type[key] ?? 0
    const length = t.total ? (count / t.total) * RING : 0
    const seg = { key, label: TYPE_COLS.find(c => c.key === key).label, count, alpha: alphas[i], length, offset }
    offset += length
    return seg
  })
})
const repeatShare = computed(() => {
  const t = profile.value.total
  return t.total ? Math.round((((t.type.repeat_retained ?? 0) + (t.type.lapsed ?? 0)) / t.total) * 100) : 0
})
const typesLabel = computed(() => ringSegments.value.map(s => `${s.label} ${s.count}`).join(', '))

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const hourLabel = h => `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`
// The grid covers the centre's opening days and hours (its operating hours and
// appointment slots), widened only where someone arrived outside them.
const busy = computed(() => {
  const grid = data.value?.busiest ?? []
  const open = data.value?.opening_hours ?? { days: [0, 1, 2, 3, 4, 5, 6], from: 7, to: 18, label: null }
  let max = 0
  let total = 0
  let peak = null
  let first = open.from
  let last = open.to - 1
  const shownDays = new Set(open.days)
  grid.forEach((row, d) => row.forEach((n, h) => {
    total += n
    if (n > max) { max = n; peak = { d, h } }
    if (n) { first = Math.min(first, h); last = Math.max(last, h); shownDays.add(d) }
  }))
  const days = grid.map(row => row.reduce((a, b) => a + b, 0))
  const dayMax = Math.max(0, ...days)
  return {
    max,
    total,
    days: [...shownDays].sort((a, b) => a - b),
    hours: Array.from({ length: last - first + 1 }, (_, i) => first + i),
    isOpen: (d, h) => open.days.includes(d) && h >= open.from && h < open.to,
    openLabel: open.label,
    peak: peak ? `${WEEKDAYS[peak.d]}, ${hourLabel(peak.h)} to ${hourLabel(peak.h + 1)}` : '',
    day: dayMax ? ['Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays', 'Sundays'][days.indexOf(dayMax)] : '',
  }
})

// The collection record as the centre's SNBC Excel sheet, for the period on screen.
const snbcBusy = ref(false)
const snbcError = ref('')
async function downloadSnbc() {
  if (!data.value) return
  snbcBusy.value = true
  snbcError.value = ''
  try {
    const blob = await bloodCenterService.snbcRecord({ from: data.value.period.from, to: data.value.period.to })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `redagos-snbc-record-${data.value.period.from}-to-${data.value.period.to}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  } catch (err) {
    snbcError.value = err?.message || 'The SNBC record could not be downloaded. Please try again.'
  } finally {
    snbcBusy.value = false
  }
}

// Day by day as a chart or a table; the table reads newest first.
const dailyView = ref('chart')
const dailyNewestFirst = computed(() => [...daily.value].reverse())
const fmtWeekday = d => new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })

// The period as a printable PDF, from the server.
const pdfBusy = ref(false)
async function downloadPdf() {
  if (!data.value) return
  pdfBusy.value = true
  error.value = ''
  try {
    const kind = props.kind === 'collection' ? 'collection' : 'centre'
    const blob = await bloodCenterService.reportPdf(kind, { from: data.value.period.from, to: data.value.period.to })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `redagos-${kind}-report-${data.value.period.from}-to-${data.value.period.to}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  } catch (err) {
    error.value = err?.message || 'The PDF could not be prepared. Please try again.'
  } finally {
    pdfBusy.value = false
  }
}

const fmtMonth = m => new Date(`${m}-01T00:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
const maxModule = computed(() => Math.max(1, ...(data.value?.activity?.by_module ?? []).map(m => m.count)))
const chartLabel = computed(() => (data.value
  ? `${currentSeries.value.label} per day: ${seriesTotal(series.value)} in total over ${data.value.period.days} days.`
  : ''))

const centreKpis = computed(() => {
  const c = data.value.centre
  const rate = c.requests.received ? Math.round((c.requests.fulfilled / c.requests.received) * 100) : null
  return [
    { label: 'Donations collected', value: c.donations, note: `${c.deferrals} donors deferred` },
    { label: 'Requests received', value: c.requests.received, note: `${c.requests.emergency} emergency` },
    { label: 'Fulfilment rate', value: rate === null ? '—' : `${rate}%`, note: c.requests.avg_hours_to_fulfil === null ? 'No fulfilled requests' : `${c.requests.avg_hours_to_fulfil} h on average` },
    { label: 'Units released', value: c.units.released, note: `${c.units.expired} expired · ${c.units.discarded} discarded` },
  ]
})

// The change against the period of the same length before: a percentage for
// counts, percentage points for rates. Green when it moved the right way.
function change(now, before, { points = false, goodWhenUp = true } = {}) {
  if (now === null || now === undefined || before === null || before === undefined) return null
  const diff = points ? Math.round((now - before) * 10) / 10 : (before ? Math.round(((now - before) / before) * 100) : null)
  if (diff === null) return now ? { text: 'New', tone: 'good', up: true } : null
  if (diff === 0) return { text: 'No change', tone: 'flat', up: true }
  const up = diff > 0
  return { text: `${up ? '+' : ''}${diff}${points ? ' pts' : '%'}`, tone: up === goodWhenUp ? 'good' : 'bad', up }
}

// The figures above each tab.
const kpis = computed(() => {
  if (!data.value) return []
  const d = data.value
  const pct = v => (v === null || v === undefined ? '—' : `${Math.round(v)}%`)
  switch (tab.value) {
    case 'centre': return centreKpis.value
    case 'staff': return staffKpis.value
    case 'donations': return [
      { label: 'Donations collected', value: d.donations.collected, note: `${d.donations.by_blood_group.length} blood groups` },
      { label: 'Donors deferred', value: d.donations.deferred, note: 'At screening' },
      { label: 'Deferral rate', value: pct(d.donations.deferral_rate), note: 'Of everyone screened' },
      { label: 'Drives held', value: d.drives.held, note: `${d.appointments.from_drives} booked at drives` },
    ]
    case 'appointments': return [
      { label: 'Appointments booked', value: d.appointments.booked, note: `${d.appointments.from_drives} at drives` },
      { label: 'Came and donated', value: d.appointments.completed, note: 'Completed' },
      { label: 'No-shows', value: d.appointments.no_show, note: `${d.appointments.cancelled} cancelled`, warn: true },
      { label: 'Show rate', value: pct(d.appointments.show_rate), note: 'Came, of those due' },
    ]
    case 'deferrals': return [
      { label: 'Donors deferred', value: d.donations.deferred, note: 'At screening' },
      { label: 'Deferral rate', value: pct(d.donations.deferral_rate), note: 'Of everyone screened' },
      { label: 'Kinds of deferral', value: d.deferrals.by_type.length, note: 'Temporary, permanent, indefinite' },
      { label: 'Reasons recorded', value: d.deferrals.top_reasons.length, note: 'Most common shown' },
    ]
    case 'overview': {
      const p = d.previous ?? {}
      return [
        { label: 'Donations collected', value: d.donations.collected, note: `${d.donations.by_blood_group.length} blood groups`, delta: change(d.donations.collected, p.collected) },
        { label: 'Deferral rate', value: pct(d.donations.deferral_rate), note: 'Of everyone screened', delta: change(d.donations.deferral_rate, p.deferral_rate, { points: true, goodWhenUp: false }) },
        { label: 'Show rate', value: pct(d.appointments.show_rate), note: 'Came, of those due', delta: change(d.appointments.show_rate, p.show_rate, { points: true }) },
        { label: 'Lapsed donors', value: d.donor_profile.lapsed_donors, note: 'No donation in over a year', warn: true },
      ]
    }
    case 'profile': {
      const t = d.donor_profile.total
      return [
        { label: 'Donations collected', value: t.total, note: `${t.sex.female} female, ${t.sex.male} male` },
        { label: 'First-time donors', value: t.type.first_time, note: `${t.type.new_to_centre} new to this centre` },
        { label: 'Repeat donors', value: t.type.repeat_retained, note: `${t.type.lapsed} came back after lapsing` },
        { label: 'Lapsed donors', value: d.donor_profile.lapsed_donors, note: 'No donation in over a year', warn: true },
      ]
    }
    default: return []
  }
})

const staffKpis = computed(() => {
  const s = data.value.staff
  return [
    { label: 'New accounts', value: s.created, note: `${s.removed} removed · ${s.restored} restored` },
    { label: 'Role changes', value: s.role_changes, note: 'Roles, privileges, levels' },
    { label: 'Status changes', value: s.status_changes, note: 'Suspended or reactivated', warn: true },
    { label: 'Sign-ins', value: s.sign_ins, note: `${s.failed_sign_ins} refused`, warn: false },
  ]
})

// The tab on screen as a CSV file: the same figures, for a spreadsheet.
function exportCsv() {
  if (!data.value) return
  const d = data.value
  const rows = [[`${facilityName.value} report`, `${d.period.from} to ${d.period.to}`], []]
  if (tab.value === 'centre') {
    rows.push(['Figure', 'Value'])
    centreKpis.value.forEach(k => rows.push([k.label, k.value]))
    Object.entries(d.centre.requests).forEach(([k, v]) => rows.push([`Requests: ${k.replace(/_/g, ' ')}`, v ?? '']))
    Object.entries(d.centre.units).forEach(([k, v]) => rows.push([`Units: ${k}`, v]))
    rows.push([], ['Date', 'Donations', 'Deferrals', 'Requests'])
    d.centre.daily.forEach(day => rows.push([day.date, day.donations, day.deferrals, day.requests]))
  } else if (props.kind === 'collection') {
    rows.push(['Figure', 'Value'])
    kpis.value.forEach(k => rows.push([k.label, k.value]))
    if (tab.value === 'donations') {
      rows.push([], ['Blood group', 'Donations'])
      d.donations.by_blood_group.forEach(g => rows.push([g.code, g.count]))
    } else if (tab.value === 'appointments') {
      rows.push([], ['Drive', 'Date', 'Booked', 'Capacity'])
      d.drives.list.forEach(x => rows.push([x.name, x.date, x.booked, x.capacity ?? '']))
    } else if (tab.value === 'overview') {
      rows.push([], ['Age bracket', 'Donations'])
      AGE_COLS.forEach(c => rows.push([c.label, d.donor_profile.total.age[c.key]]))
      rows.push([], ['Type of donor', 'Donations'])
      KIND_COLS.forEach(c => rows.push([c.key === 'walk_in_total' ? 'Walk-in' : c.label, kindCount(d.donor_profile.total, c.key)]))
      rows.push([], ['Donor status', 'Donations'])
      TYPE_COLS.forEach(c => rows.push([c.label, d.donor_profile.total.type[c.key]]))
      rows.push([], ['Hour', ...busy.value.days.map(day => WEEKDAYS[day])])
      busy.value.hours.forEach(h => rows.push([hourLabel(h), ...busy.value.days.map(day => d.busiest[day][h])]))
    } else if (tab.value === 'profile') {
      const cols = [...SEX_COLS.map(c => ['sex', c]), ...AGE_COLS.map(c => ['age', c]), ...KIND_COLS.map(c => ['kind', c]), ...TYPE_COLS.map(c => ['type', c])]
      rows.push([], ['Collection record'], ['', 'Sex', '', 'Age bracket', '', '', '', '', 'Type of donor', '', '', '', 'Donor status', '', '', ''])
      rows.push(['Month', ...cols.map(([g, c]) => (g === 'kind' && c.key === 'walk_in_total' ? 'Walk-in' : c.label)), 'Total'])
      profileRows.value.forEach(r => rows.push([r.month === 'total' ? 'Total' : fmtMonth(r.month), ...cols.map(([g, c]) => (g === 'kind' ? kindCount(r, c.key) : r[g]?.[c.key] ?? 0)), r.total]))
      rows.push([], ['No sex recorded', d.donor_profile.total.sex.not_stated], ['No birth date recorded', d.donor_profile.total.age.not_stated])
    } else {
      rows.push([], ['Reason', 'Deferrals'])
      d.deferrals.top_reasons.forEach(r => rows.push([r.label, r.count]))
      rows.push([], ['Type', 'Deferrals'])
      d.deferrals.by_type.forEach(t => rows.push([t.type, t.count]))
    }
    if (tab.value !== 'profile') {
      rows.push([], ['Date', 'Donations', 'Deferrals', 'Appointments'])
      d.daily.forEach(day => rows.push([day.date, day.donations, day.deferrals, day.appointments]))
    }
  } else if (tab.value === 'staff') {
    staffKpis.value.forEach(k => rows.push([k.label, k.value]))
    rows.push([], ['When', 'Change', 'Account', 'By'])
    d.staff.events.forEach(e => rows.push([e.at, e.label, e.subject ?? '', e.by]))
  } else {
    rows.push(['Module', 'Actions'])
    d.activity.by_module.forEach(m => rows.push([m.module, m.count]))
    rows.push([], ['Person', 'Actions'])
    d.activity.top_people.forEach(p => rows.push([p.name, p.count]))
  }
  const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([String.fromCharCode(0xFEFF) + csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `redagos-${tab.value}-report-${d.period.from}-to-${d.period.to}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped>
.cr { display: flex; flex-direction: column; gap: 16px; max-width: var(--rb-content-max, 1400px); margin: 0 auto; padding: 24px 32px 40px; }
.cr__head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; }
.cr__title { margin: 0; font-size: var(--rb-fs-title, 24px); font-weight: 800; color: var(--rb-text-primary); }
.cr__sub { margin: 4px 0 0; font-size: 13.5px; color: var(--rb-text-secondary); }
.cr__tools { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 8px; }
.cr__error { margin: 0; padding: 10px 14px; border-radius: 12px; background: rgba(211, 47, 47, 0.08); font-size: 13px; color: var(--rb-accent-text, #C62828); }
.link { border: 0; background: none; font: inherit; font-weight: 700; color: inherit; text-decoration: underline; cursor: pointer; }

.tool-period { width: 172px; flex: none; }
.tool-date { width: 172px; flex: none; }
.tool-sep { font-size: 13px; color: var(--rb-text-secondary); }

.tabs { display: flex; align-items: center; gap: 4px; border-bottom: 1px solid var(--rb-border); }
.tabs__aside {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 700;
  color: var(--rb-primary-text, var(--rb-primary));
  text-decoration: none;
}
.tabs__aside:hover { background: rgba(var(--rb-primary-rgb), 0.08); }
.tabs__aside:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; }
.tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-bottom: -1px;
  padding: 10px 14px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: none;
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  color: var(--rb-text-secondary);
  cursor: pointer;
}
.tab--on { border-bottom-color: var(--rb-primary); color: var(--rb-primary-text); }
.tab:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: -2px; }
/* The same height and corners as the period field beside it. */
.export {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 14px;
  border: 1px solid var(--rb-border-strong, var(--rb-border));
  border-radius: 8px;
  background: var(--rb-surface);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  color: var(--rb-text-primary);
  cursor: pointer;
}
.export:hover:not(:disabled) { border-color: rgba(var(--rb-primary-rgb), 0.45); }
.export:disabled { opacity: 0.5; cursor: default; }

.stack { display: flex; flex-direction: column; gap: 16px; }
.grid4 { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.grid2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }

.kpi { display: flex; flex-direction: column; gap: 4px; padding: 16px; border: 1px solid var(--rb-border); border-radius: 16px; background: var(--rb-surface); }
.kpi--skeleton { min-height: 104px; border: 0; background: var(--rb-skeleton-a, #EEF1F5); }
.kpi__label { font-size: 12.5px; font-weight: 600; color: var(--rb-text-secondary); }
.kpi__value { font-size: 28px; font-weight: 800; line-height: 1.1; color: var(--rb-text-primary); font-variant-numeric: tabular-nums; }
.kpi__value--warn { color: #B45309; }
html.dark .kpi__value--warn { color: #FFB74D; }
.kpi__foot { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 2px; }
.delta { display: inline-flex; align-items: center; gap: 3px; padding: 2px 7px; border-radius: 999px; font-size: 11.5px; font-weight: 700; font-variant-numeric: tabular-nums; }
.delta--good { color: #15803D; background: rgba(22, 163, 74, 0.12); }
.delta--bad { color: #B91C1C; background: rgba(220, 38, 38, 0.1); }
.delta--flat { color: var(--rb-text-secondary); background: rgba(127, 127, 127, 0.12); }
html.dark .delta--good { color: #4ADE80; background: rgba(74, 222, 128, 0.14); }
html.dark .delta--bad { color: #F87171; background: rgba(248, 113, 113, 0.14); }
.kpi__note { font-size: 12.5px; color: var(--rb-text-secondary); }

.card { display: flex; flex-direction: column; gap: 14px; padding: 18px 20px; border: 1px solid var(--rb-border); border-radius: 18px; background: var(--rb-surface); }
.card__head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; }
.card__title { margin: 0; font-size: var(--rb-fs-section, 16px); font-weight: 700; color: var(--rb-text-primary); }
.card__note { font-size: 12.5px; color: var(--rb-text-secondary); }
.card__link { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 700; color: var(--rb-primary-text); text-decoration: none; }

/* ── Day-by-day chart ── */
.series { display: inline-flex; flex-wrap: wrap; gap: 4px; padding: 3px; border-radius: 12px; background: var(--rb-surface-hover, #F1F5F9); }
.series__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: 0;
  border-radius: 9px;
  background: none;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  color: var(--rb-text-secondary);
  cursor: pointer;
}
.series__btn strong { font-weight: 800; color: var(--rb-text-primary); font-variant-numeric: tabular-nums; }
.series__btn--on { background: var(--rb-surface); color: var(--rb-text-primary); box-shadow: 0 1px 3px rgba(15, 23, 42, 0.12); }
.series__btn:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 1px; }
.series__dot { width: 8px; height: 8px; border-radius: 3px; background: var(--series); }
.series__btn--donations, .plot--donations { --series: var(--rb-primary); }
.series__btn--deferrals, .plot--deferrals { --series: #F59E0B; }
.series__btn--requests, .plot--requests { --series: #7C3AED; }
html.dark .series__btn--requests, html.dark .plot--requests { --series: #A78BFA; }
.series__btn--appointments, .plot--appointments { --series: #0D9488; }
html.dark .series__btn--appointments, html.dark .plot--appointments { --series: #2DD4BF; }

.plot { display: grid; grid-template-columns: 32px minmax(0, 1fr); gap: 8px; }
.plot__y { display: flex; flex-direction: column; justify-content: space-between; height: 200px; font-size: 11.5px; text-align: right; color: var(--rb-text-secondary); font-variant-numeric: tabular-nums; }
.plot__y span { transform: translateY(-50%); }
.plot__y span:last-child { transform: translateY(50%); }
.plot__area { position: relative; }
.plot__grid { position: absolute; inset: 0 0 auto; display: flex; flex-direction: column; justify-content: space-between; height: 200px; pointer-events: none; }
.plot__grid span { height: 1px; background: var(--rb-border); }
.plot__grid span:last-child { background: var(--rb-border-strong, var(--rb-border)); }
.plot__bars { position: relative; display: flex; align-items: flex-end; gap: 4px; height: 200px; padding-bottom: 26px; box-sizing: content-box; }
.col { position: relative; display: flex; flex: 1; align-items: flex-end; height: 100%; min-width: 0; }

/* The curve over the columns: the same 200px plot, stretched to its width. */
.curve { position: absolute; inset: 0 0 auto; width: 100%; height: 200px; overflow: visible; pointer-events: none; }
.curve__stop--top { stop-color: var(--series); stop-opacity: 0.26; }
.curve__stop--bottom { stop-color: var(--series); stop-opacity: 0; }
.curve__line { fill: none; stroke: var(--series); stroke-width: 2.5; stroke-linejoin: round; stroke-linecap: round; }
.col__dot {
  position: absolute;
  left: 50%;
  width: 9px;
  height: 9px;
  border: 2px solid var(--rb-surface);
  border-radius: 50%;
  background: var(--series);
  transform: translate(-50%, 50%);
  transition: transform 120ms ease;
}
/* A guide down from the day under the pointer. */
.col::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  border-left: 1px dashed var(--rb-border-strong, var(--rb-border));
  opacity: 0;
  transition: opacity 120ms ease;
}
.col:hover::before { opacity: 1; }
.col:hover .col__dot, .col--today .col__dot { transform: translate(-50%, 50%) scale(1.35); }
/* Over a long period, a point only where the pointer is, and today. */
.plot__bars--dense .col__dot { opacity: 0; }
.plot__bars--dense .col:hover .col__dot, .plot__bars--dense .col--today .col__dot { opacity: 1; }
@media (prefers-reduced-motion: reduce) {
  .col__dot, .col::before { transition: none; }
}
.col__tip {
  position: absolute;
  left: 50%;
  z-index: 2;
  padding: 4px 8px;
  border-radius: 8px;
  background: var(--rb-text-primary);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  color: var(--rb-surface);
  opacity: 0;
  pointer-events: none;
  transform: translateX(-50%);
  transition: opacity 120ms ease;
}
.col:hover .col__tip { opacity: 1; }
.col__tick { position: absolute; top: calc(100% + 8px); left: 50%; font-size: 11.5px; white-space: nowrap; color: var(--rb-text-secondary); transform: translateX(-50%); }

.chart-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; min-height: 200px; text-align: center; }
.chart-empty__icon { display: flex; align-items: center; justify-content: center; width: 46px; height: 46px; margin-bottom: 6px; border-radius: 14px; background: var(--rb-surface-hover, #F1F5F9); color: var(--rb-text-secondary); }
.chart-empty__title { margin: 0; font-size: 14.5px; font-weight: 700; color: var(--rb-text-primary); }
.chart-empty__text { margin: 0; font-size: 13px; color: var(--rb-text-secondary); }

.rows { display: flex; flex-direction: column; margin: 0; }
.rows div { display: flex; justify-content: space-between; padding: 9px 0; border-top: 1px solid var(--rb-border); font-size: 14px; }
.rows div:first-child { border-top: 0; }
.rows dt { color: var(--rb-text-secondary); }
.rows dd { margin: 0; font-weight: 700; color: var(--rb-text-primary); font-variant-numeric: tabular-nums; }

.table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
.table th { padding: 8px 10px; border-bottom: 1px solid var(--rb-border); font-size: 12px; font-weight: 700; text-align: left; color: var(--rb-text-secondary); }
.table td { padding: 10px; border-bottom: 1px solid var(--rb-border); color: var(--rb-text-primary); }
.table tr:last-child td { border-bottom: 0; }

.hbars { display: flex; flex-direction: column; gap: 10px; margin: 0; padding: 0; list-style: none; }
.hbar { display: grid; grid-template-columns: 110px minmax(0, 1fr) 40px; align-items: center; gap: 10px; font-size: 13px; }
.hbar__label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--rb-text-primary); }
/* Overview (the ring is .donut: Tailwind's ring utility owns .ring) */
.grid-ov { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 16px; }
.card__link { border: 0; background: none; padding: 0; cursor: pointer; }

.ages { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 14px; height: 220px; padding-top: 4px; }
.ages__col { display: flex; flex-direction: column; align-items: center; gap: 8px; min-width: 0; }
.ages__pct { font-size: 12px; font-weight: 700; color: var(--rb-text-secondary); font-variant-numeric: tabular-nums; }
.ages__track { position: relative; flex: 1; width: 100%; max-width: 56px; border-radius: 14px; background: rgba(var(--rb-primary-rgb), 0.06); overflow: hidden; }
.ages__bar { position: absolute; inset: auto 0 0; border-radius: 14px; background: rgba(var(--rb-primary-rgb), 0.38); transition: height 0.5s var(--rb-ease-out, ease); }
.ages__label { font-size: 12px; font-weight: 600; color: var(--rb-text-secondary); }
.ages__col--top .ages__bar { background: var(--rb-primary); }
.ages__col--top .ages__pct { padding: 1px 7px; border-radius: 6px; color: #fff; background: var(--rb-primary); }
.ages__col--top .ages__label { color: var(--rb-text-primary); }

.mix { display: grid; grid-template-columns: 132px minmax(0, 1fr); align-items: center; gap: 20px; }
.donut { width: 132px; height: 132px; }
.donut__base { fill: none; stroke: rgba(var(--rb-primary-rgb), 0.07); stroke-width: 14; }
.donut__seg { fill: none; stroke-width: 14; transform: rotate(-90deg); transform-origin: 60px 60px; }
.donut__value { text-anchor: middle; font-size: 22px; font-weight: 800; fill: var(--rb-text-primary); }
.donut__caption { text-anchor: middle; font-size: 10px; font-weight: 600; fill: var(--rb-text-secondary); }
.mix__legend { display: flex; flex-direction: column; gap: 9px; margin: 0; padding: 0; list-style: none; font-size: 13px; }
.mix__legend li { display: flex; align-items: center; gap: 8px; }
.mix__dot { display: inline-block; flex: none; width: 9px; height: 9px; border-radius: 3px; }
.mix__name { flex: 1; color: var(--rb-text-secondary); }
.mix__count { font-weight: 700; color: var(--rb-text-primary); font-variant-numeric: tabular-nums; }

.sexes { display: flex; flex-direction: column; gap: 8px; padding-top: 14px; border-top: 1px solid var(--rb-border); }
.sexes__bar { display: flex; gap: 3px; height: 10px; }
.sexes__bar > span { flex-basis: 0; min-width: 4px; border-radius: 999px; }
.sexes__f { background: #DB2777; }
.sexes__m { background: var(--rb-primary); }
.sexes__legend { display: flex; justify-content: space-between; font-size: 12.5px; color: var(--rb-text-secondary); }
.sexes__legend > span { display: inline-flex; align-items: center; gap: 6px; }
.sexes__legend strong { color: var(--rb-text-primary); font-variant-numeric: tabular-nums; }

.heat { display: grid; grid-template-columns: 40px repeat(var(--cols), minmax(0, 1fr)); gap: 4px; align-items: center; }
.heat__hour { font-size: 10.5px; color: var(--rb-text-muted); white-space: nowrap; }
.heat__day { font-size: 12px; font-weight: 600; color: var(--rb-text-secondary); }
.heat__cell { height: 26px; border-radius: 6px; background: rgba(var(--rb-primary-rgb), 0.05); box-shadow: inset 0 0 0 1px rgba(var(--rb-primary-rgb), 0.06); transition: transform 0.12s ease; }
.heat__cell:hover { transform: scale(1.08); }
/* Outside opening hours: shown only because someone arrived then. */
.heat__cell--closed { background-image: repeating-linear-gradient(135deg, transparent 0 4px, rgba(127, 127, 127, 0.14) 4px 5px); }
.heat__facts { display: flex; gap: 32px; margin: 4px 0 0; padding-top: 14px; border-top: 1px solid var(--rb-border); }
.heat__facts div { display: flex; flex-direction: column; gap: 2px; }
.heat__facts dt { font-size: 12px; color: var(--rb-text-secondary); }
.heat__facts dd { margin: 0; font-size: 15px; font-weight: 700; color: var(--rb-text-primary); }
@media (prefers-reduced-motion: reduce) {
  .ages__bar, .heat__cell { transition: none; }
}

/* The collection record: the paper sheet's grouped header, as a table. */
.daily-tools { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.view-toggle { display: inline-flex; padding: 3px; border-radius: 10px; background: rgba(var(--rb-primary-rgb), 0.06); }
.view-toggle__btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 28px;
  padding: 0 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--rb-text-secondary);
  cursor: pointer;
}
.view-toggle__btn--on { background: var(--rb-surface); color: var(--rb-text-primary); box-shadow: 0 1px 3px rgba(var(--rb-shadow-rgb, 15, 23, 42), 0.12); }
.view-toggle__btn:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; }
.daily-table-wrap { max-height: 360px; overflow: auto; border: 1px solid var(--rb-border); border-radius: 12px; }
.daily-table { width: 100%; border-collapse: collapse; font-size: 13px; font-variant-numeric: tabular-nums; }
.daily-table th { position: sticky; top: 0; z-index: 1; padding: 9px 14px; background: var(--rb-surface-alt, var(--rb-surface)); border-bottom: 1px solid var(--rb-border); font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-align: left; text-transform: uppercase; color: var(--rb-text-secondary); }
.daily-table td { padding: 8px 14px; border-bottom: 1px solid var(--rb-border); color: var(--rb-text-primary); }
.daily-table .num { text-align: right; }
.daily-table .is-zero { color: var(--rb-text-muted); }
.daily-table .is-today td { background: rgba(var(--rb-primary-rgb), 0.05); font-weight: 600; }
.daily-table tfoot td { position: sticky; bottom: 0; background: var(--rb-surface-alt, var(--rb-surface)); border-top: 1px solid var(--rb-border-strong, var(--rb-border)); border-bottom: 0; font-weight: 700; }
.snbc-download {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 14px;
  border: 1px solid var(--rb-primary);
  border-radius: 8px;
  background: var(--rb-primary);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  cursor: pointer;
}
.snbc-download:hover:not(:disabled) { background: var(--rb-primary-hover, var(--rb-primary)); }
.snbc-download:active:not(:disabled) { transform: translateY(1px); }
.snbc-download:disabled { opacity: 0.6; cursor: default; }
.snbc-wrap { overflow-x: auto; margin: 4px -4px 0; padding: 0 4px; }
.snbc { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 13px; font-variant-numeric: tabular-nums; }
.snbc th, .snbc td { padding: 10px 12px; text-align: center; white-space: nowrap; border-bottom: 1px solid var(--rb-border); }
.snbc thead th { font-size: 11.5px; font-weight: 600; color: var(--rb-text-secondary); background: rgba(var(--rb-primary-rgb), 0.04); }
.snbc thead tr:first-child th { padding-top: 12px; }
.snbc__group {
  font-size: 10.5px !important;
  font-weight: 700 !important;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--rb-primary) !important;
  border-bottom: 2px solid rgba(var(--rb-primary-rgb), 0.35) !important;
  border-left: 1px solid var(--rb-border);
}
.snbc__first { border-left: 1px solid var(--rb-border); }
.snbc .snbc__sub { padding-top: 6px; padding-bottom: 6px; border-bottom: 1px solid rgba(var(--rb-primary-rgb), 0.25); font-weight: 700; color: var(--rb-text-primary); }
.snbc .snbc__month { text-align: left; font-weight: 600; color: var(--rb-text-primary); }
.snbc thead .snbc__month { color: var(--rb-text-secondary); }
.snbc .snbc__total { border-left: 1px solid var(--rb-border); font-weight: 700; color: var(--rb-text-primary); }
.snbc td { color: var(--rb-text-primary); }
.snbc td.snbc__zero { color: var(--rb-text-muted); }
.snbc tbody tr:hover td, .snbc tbody tr:hover th { background: rgba(var(--rb-primary-rgb), 0.04); }
.snbc .snbc__sum th, .snbc .snbc__sum td { font-weight: 700; border-top: 2px solid var(--rb-border-strong); border-bottom: 0; background: rgba(var(--rb-primary-rgb), 0.06); }
.snbc-notes { margin: 12px 0 0; padding: 0; list-style: none; font-size: 12.5px; line-height: 1.6; color: var(--rb-text-secondary); }
.snbc-notes strong { font-weight: 600; color: var(--rb-text-primary); }
.hbars--wide .hbar { grid-template-columns: minmax(0, 220px) minmax(0, 1fr) 40px; }
.hbar__track { height: 8px; overflow: hidden; border-radius: 999px; background: var(--rb-surface-hover, #F1F5F9); }
.hbar__track span { display: block; height: 100%; border-radius: inherit; background: var(--rb-primary); }
.hbar__count { font-weight: 700; text-align: right; color: var(--rb-text-primary); }

.people { display: flex; flex-direction: column; margin: 0; padding: 0; list-style: none; }
.person { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-top: 1px solid var(--rb-border); }
.person:first-child { border-top: 0; }
.person__rank { display: flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 50%; background: rgba(var(--rb-primary-rgb), 0.1); font-size: 12px; font-weight: 800; color: var(--rb-primary-text); }
.person__name { flex: 1; font-size: 14px; font-weight: 600; color: var(--rb-text-primary); }
.person__count { font-size: 12.5px; color: var(--rb-text-secondary); }
.empty { margin: 0; font-size: 13px; color: var(--rb-text-secondary); }

@media (max-width: 1100px) {
  .grid4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .grid2 { grid-template-columns: minmax(0, 1fr); }
}
</style>
