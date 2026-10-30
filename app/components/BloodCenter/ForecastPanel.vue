<template>
  <!--
    The weeks ahead, in the parts the viewer's department plans with: the
    server decides which (GET /blood-center/reports/forecast). Each part is a
    weighted average of the last twelve weeks, recent weeks counting more;
    ForecastWeekChart draws the history and, dashed, the weeks forecast.
  -->
  <div class="fc">
    <div v-if="loading" class="fc__skeleton" aria-busy="true">
      <div v-for="n in 4" :key="n" class="fc__skel-card" />
      <div class="fc__skel-chart" />
    </div>

    <div v-else-if="error" class="fc__error" role="alert">
      {{ error }} <button type="button" class="link" @click="load">Try again</button>
    </div>

    <template v-else-if="data">
      <p class="fc__method">
        <AssetIcon name="trending-up" :size="15" />
        <span>
          The next {{ data.method.horizon_weeks }} weeks, from the last {{ data.method.history_weeks }}
          ({{ shortDate(data.method.from) }} to {{ shortDate(data.method.to) }}); recent weeks count more.
          A guide for planning, from this centre's own records.
        </span>
      </p>

      <!-- ── Demand: Issuance and Inventory ── -->
      <section v-if="data.demand" class="fc__part" aria-labelledby="fc-demand">
        <h2 id="fc-demand" class="fc__title">Blood demand</h2>

        <!-- The answer first: is the shelf ready for what is coming? -->
        <div class="outlook" :class="`outlook--${demandOutlook.tone}`" role="status">
          <span class="outlook__icon"><AssetIcon :name="demandOutlook.icon" :size="20" /></span>
          <div class="outlook__body">
            <p class="outlook__title">{{ demandOutlook.title }}</p>
            <p class="outlook__text">{{ demandOutlook.text }}</p>
          </div>
        </div>

        <div class="fc__kpis">
          <div class="kpi kpi--icon">
            <span class="kpi__icon"><AssetIcon name="droplets" :size="18" /></span>
            <span class="kpi__label">Units requested a week</span>
            <span class="kpi__value">{{ num(data.demand.total.per_week) }}</span>
            <span class="kpi__note">Range {{ data.demand.total.low }} to {{ data.demand.total.high }} <TrendChip :value="data.demand.total.trend" /></span>
          </div>
          <div class="kpi kpi--icon" :class="{ 'kpi--bad': data.demand.short }">
            <span class="kpi__icon"><AssetIcon name="octagon-alert" :size="18" /></span>
            <span class="kpi__label">Short within a week</span>
            <span class="kpi__value">{{ data.demand.short }}</span>
            <span class="kpi__note">Blood type and component pairs</span>
          </div>
          <div class="kpi kpi--icon" :class="{ 'kpi--warn': data.demand.watch }">
            <span class="kpi__icon"><AssetIcon name="eye" :size="18" /></span>
            <span class="kpi__label">To watch</span>
            <span class="kpi__value">{{ data.demand.watch }}</span>
            <span class="kpi__note">Under two weeks of stock</span>
          </div>
          <div class="kpi kpi--icon" :class="{ 'kpi--alert': data.demand.emergency.requests }">
            <span class="kpi__icon"><AssetIcon name="circle-alert" :size="18" /></span>
            <span class="kpi__label">Emergency requests a week</span>
            <span class="kpi__value">{{ num(data.demand.emergency.per_week) }}</span>
            <span class="kpi__note">{{ data.demand.emergency.share === null ? 'None in 12 weeks' : `${data.demand.emergency.share}% of requests` }}</span>
          </div>
        </div>

        <div class="fc__grid">
          <article class="card">
            <header class="card__head">
              <h3 class="card__title">Units requested, week by week</h3>
              <span class="card__note">Dashed: the forecast, its range shaded</span>
            </header>
            <ForecastWeekChart :series="data.demand.total.series" :estimate="data.demand.total" :weeks="data.weeks" :horizon="data.horizon" unit="units" />
          </article>
          <article class="card">
            <header class="card__head">
              <h3 class="card__title">Emergency demand</h3>
              <span class="card__note">{{ data.demand.emergency.requests }} in 12 weeks</span>
            </header>
            <template v-if="data.demand.emergency.requests">
              <ForecastWeekChart :series="data.demand.emergency.series" :estimate="data.demand.emergency" :weeks="data.weeks" :horizon="data.horizon" unit="requests" tone="alert" compact />
              <dl class="facts">
                <div><dt>Most often for</dt><dd>{{ data.demand.emergency.by_blood_type.map(t => `${t.code} (${t.count})`).join(', ') }}</dd></div>
                <div v-if="data.demand.emergency.busiest_weekday !== null"><dt>Busiest day</dt><dd>{{ WEEKDAYS[data.demand.emergency.busiest_weekday] }}</dd></div>
              </dl>
            </template>
            <div v-else class="calm">
              <span class="calm__icon"><AssetIcon name="shield-check" :size="22" /></span>
              <p class="calm__title">No emergencies in 12 weeks</p>
              <p class="calm__text">An emergency request from any hospital shows here, with the blood types it was for and its busiest day.</p>
            </div>
          </article>
        </div>

        <article class="card">
          <header class="card__head">
            <h3 class="card__title">By blood type and component</h3>
          </header>
          <div v-if="data.demand.rows.length" class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>Blood type</th><th>Component</th><th class="num">A week</th><th class="num">Range</th><th>Trend</th>
                  <th class="num">In stock</th><th class="num">Lasts</th><th>Runs out</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in data.demand.rows" :key="`${row.blood_type}-${row.component}`" :class="`row--${row.status}`">
                  <td><span class="type">{{ row.blood_type }}</span></td>
                  <td>{{ row.component }}</td>
                  <td class="num strong">{{ num(row.per_week) }}</td>
                  <td class="num muted">{{ row.low }} to {{ row.high }}</td>
                  <td><TrendChip :value="row.trend" /></td>
                  <td class="num">{{ row.stock }}</td>
                  <td class="num">
                    <span class="cover" :class="`cover--${row.status}`" :title="row.weeks_of_cover === null ? 'No demand to run it down' : `${row.weeks_of_cover} weeks of stock at the forecast`">
                      <span class="cover__track" aria-hidden="true"><span :style="{ width: `${coverWidth(row.weeks_of_cover)}%` }" /></span>
                      {{ row.weeks_of_cover === null ? '—' : `${row.weeks_of_cover} wk` }}
                    </span>
                  </td>
                  <td>{{ row.runs_out_on ? shortDate(row.runs_out_on) : '—' }}</td>
                  <td><span class="pill" :class="`pill--${row.status}`">{{ STATUS[row.status] }}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="calm calm--row">
            <span class="calm__icon"><AssetIcon name="inbox" :size="20" /></span>
            <div>
              <p class="calm__title">Nothing to forecast from yet</p>
              <p class="calm__text">No requests reached this centre in the last 12 weeks. Each blood type and component appears here once hospitals request it.</p>
            </div>
          </div>
        </article>
      </section>

      <!-- ── Collection: Donor & Collection ── -->
      <section v-if="data.collection" class="fc__part" aria-labelledby="fc-collection">
        <h2 id="fc-collection" class="fc__title">Donors to recruit</h2>
        <!-- Each figure with its icon and a small picture of what is behind it (2026-10-30). -->
        <div class="fc__kpis">
          <div class="kpi kpi--icon">
            <span class="kpi__top">
              <span class="kpi__icon"><AssetIcon name="users" :size="18" /></span>
              <!-- Needed a week, blood type by blood type. -->
              <span v-if="typeBars.length" class="kpi__days" aria-hidden="true">
                <span v-for="b in typeBars" :key="b.type" class="kpi__day" :title="`${b.type}: ${num(b.needed)} a week`">
                  <span class="kpi__day-exp" :style="{ height: `${Math.max(6, pct(b.needed, typeTop.needed))}%` }" />
                </span>
              </span>
            </span>
            <span class="kpi__label">Donors needed a week</span>
            <span class="kpi__value">{{ num(data.collection.needed_per_week) }}</span>
            <span class="kpi__note">To meet the demand forecast</span>
          </div>
          <div class="kpi kpi--icon">
            <span class="kpi__top">
              <span class="kpi__icon"><AssetIcon name="droplets" :size="18" /></span>
              <!-- The twelve weeks behind, as a small curve. -->
              <svg class="kpi__spark" viewBox="0 0 120 40" preserveAspectRatio="none" aria-hidden="true">
                <path :d="sparkOf(data.collection.donations.series).area" class="kpi__spark-area" />
                <path :d="sparkOf(data.collection.donations.series).line" class="kpi__spark-line" vector-effect="non-scaling-stroke" />
              </svg>
            </span>
            <span class="kpi__label">Donations a week</span>
            <span class="kpi__value">{{ num(data.collection.donations.per_week) }}</span>
            <span class="kpi__note">Range {{ data.collection.donations.low }} to {{ data.collection.donations.high }} <TrendChip :value="data.collection.donations.trend" /></span>
          </div>
          <div class="kpi kpi--icon" :class="gapClass(collectionGap)">
            <span class="kpi__top">
              <span class="kpi__icon"><AssetIcon :name="collectionGap > 0 ? 'trending-up' : 'check-circle'" :size="18" /></span>
              <!-- Each type's gap: red where it falls short, green where collection keeps up. -->
              <span v-if="typeBars.length" class="kpi__days" aria-hidden="true">
                <span v-for="b in typeBars" :key="b.type" class="kpi__day" :title="`${b.type}: ${b.gap > 0 ? '+' : ''}${num(b.gap)} a week`">
                  <span class="kpi__day-exp" :class="b.gap > 0.5 ? 'kpi__day-exp--short' : 'kpi__day-exp--ok'" :style="{ height: `${Math.max(6, pct(Math.abs(b.gap), typeTop.gap))}%` }" />
                </span>
              </span>
            </span>
            <span class="kpi__label">Gap a week</span>
            <span class="kpi__value">{{ collectionGap > 0 ? `+${num(collectionGap)}` : num(collectionGap) }}</span>
            <span class="kpi__note">{{ collectionGap > 0 ? 'More donors needed than come' : 'Collection keeps up' }}</span>
          </div>
          <div class="kpi kpi--icon">
            <span class="kpi__top">
              <span class="kpi__icon"><AssetIcon name="calendar" :size="18" /></span>
              <!-- Who is booked, blood type by blood type. -->
              <span v-if="typeBars.length" class="kpi__days" aria-hidden="true">
                <span v-for="b in typeBars" :key="b.type" class="kpi__day" :title="`${b.type}: ${b.booked} booked`">
                  <span class="kpi__day-exp" :style="{ height: `${Math.max(6, pct(b.booked, typeTop.booked))}%` }" />
                </span>
              </span>
            </span>
            <span class="kpi__label">Booked, next 4 weeks</span>
            <span class="kpi__value">{{ data.collection.booked }}</span>
            <span class="kpi__note">{{ data.collection.booked_untyped ? `${data.collection.booked_untyped} not yet typed` : 'Appointments still to come' }}</span>
          </div>
        </div>
        <div class="fc__grid">
          <article class="card">
            <header class="card__head">
              <h3 class="card__title">By blood type</h3>
            </header>
            <div v-if="data.collection.rows.length" class="table-wrap">
              <table class="table">
                <thead><tr><th>Blood type</th><th class="num">Needed</th><th class="num">Collecting</th><th class="num">Gap</th><th class="num">Booked</th><th>Status</th></tr></thead>
                <tbody>
                  <tr v-for="row in data.collection.rows" :key="row.blood_type">
                    <td><span class="type">{{ row.blood_type }}</span></td>
                    <td class="num strong">{{ num(row.needed_per_week) }}</td>
                    <td class="num">{{ num(row.collecting_per_week) }}</td>
                    <td class="num" :class="{ 'is-bad': row.gap_per_week > 0.5 }">{{ row.gap_per_week > 0 ? `+${num(row.gap_per_week)}` : num(row.gap_per_week) }}</td>
                    <td class="num">{{ row.booked }}</td>
                    <td><span class="pill" :class="row.status === 'short' ? 'pill--short' : 'pill--ok'">{{ row.status === 'short' ? 'Recruit' : 'On track' }}</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-else class="empty">No demand or donations in the last 12 weeks.</p>
          </article>
          <article class="card">
            <header class="card__head">
              <h3 class="card__title">Donations, week by week</h3>
              <span class="card__note">Dashed: the forecast</span>
            </header>
            <ForecastWeekChart :series="data.collection.donations.series" :estimate="data.collection.donations" :weeks="data.weeks" :horizon="data.horizon" unit="donations" />
          </article>
        </div>
      </section>

      <!-- ── Processing ── -->
      <section v-if="data.processing" class="fc__part" aria-labelledby="fc-processing">
        <h2 id="fc-processing" class="fc__title">Donations to process</h2>
        <div class="fc__kpis fc__kpis--3">
          <div class="kpi">
            <span class="kpi__label">Donations a week</span>
            <span class="kpi__value">{{ num(data.processing.donations.per_week) }}</span>
            <span class="kpi__note">Range {{ data.processing.donations.low }} to {{ data.processing.donations.high }} <TrendChip :value="data.processing.donations.trend" /></span>
          </div>
          <div class="kpi">
            <span class="kpi__label">Booked, next 7 days</span>
            <span class="kpi__value">{{ data.processing.booked_next_week }}</span>
            <span class="kpi__note">Donors with appointments</span>
          </div>
          <div class="kpi">
            <span class="kpi__label">Most asked-for component</span>
            <span class="kpi__value kpi__value--text">{{ data.processing.components[0]?.component ?? '—' }}</span>
            <span class="kpi__note">{{ data.processing.components[0] ? `${num(data.processing.components[0].per_week)} units a week` : 'No requests yet' }}</span>
          </div>
        </div>
        <div class="fc__grid">
          <article class="card">
            <header class="card__head"><h3 class="card__title">Components the demand calls for</h3><span class="card__note">Units a week</span></header>
            <ul v-if="data.processing.components.length" class="bars">
              <li v-for="c in data.processing.components" :key="c.component" class="bar">
                <span class="bar__label">{{ c.component }}</span>
                <span class="bar__track"><span :style="{ width: `${pct(c.per_week, maxOf(data.processing.components, 'per_week'))}%` }" /></span>
                <span class="bar__value">{{ num(c.per_week) }}</span>
              </li>
            </ul>
            <p v-else class="empty">No requests in the last 12 weeks.</p>
          </article>
          <article class="card">
            <header class="card__head"><h3 class="card__title">Donations, week by week</h3><span class="card__note">Dashed: the forecast</span></header>
            <ForecastWeekChart :series="data.processing.donations.series" :estimate="data.processing.donations" :weeks="data.weeks" :horizon="data.horizon" unit="donations" />
          </article>
        </div>
      </section>

      <!-- ── Testing ── -->
      <!--
        What comes to the bench and what it may find (2026-10-24): the samples
        a week and the reactive panels among them, from the panels read here,
        the week ahead day by day with who is booked.
      -->
      <section v-if="data.testing" class="fc__part" aria-labelledby="fc-testing">
        <h2 id="fc-testing" class="fc__title">Samples to test</h2>

        <div class="outlook outlook--calm" role="status">
          <span class="outlook__icon"><AssetIcon name="flask-conical" :size="20" /></span>
          <div class="outlook__body">
            <p class="outlook__title">{{ testingOutlook.title }}</p>
            <p class="outlook__text">{{ testingOutlook.text }}</p>
          </div>
        </div>

        <div class="fc__kpis">
          <div class="kpi kpi--icon">
            <span class="kpi__top">
              <span class="kpi__icon"><AssetIcon name="droplets" :size="18" /></span>
              <!-- The twelve weeks behind, as a small curve. -->
              <svg class="kpi__spark" viewBox="0 0 120 40" preserveAspectRatio="none" aria-hidden="true">
                <path :d="sparkOf(data.testing.samples.series).area" class="kpi__spark-area" />
                <path :d="sparkOf(data.testing.samples.series).line" class="kpi__spark-line" vector-effect="non-scaling-stroke" />
              </svg>
            </span>
            <span class="kpi__label">Samples a week</span>
            <span class="kpi__value">{{ num(data.testing.samples.per_week) }}</span>
            <span class="kpi__note">
              <template v-if="data.testing.samples.high">Range {{ data.testing.samples.low }} to {{ data.testing.samples.high }} <TrendChip :value="data.testing.samples.trend" /></template>
              <template v-else>No samples in 12 weeks</template>
            </span>
          </div>
          <div class="kpi kpi--icon">
            <span class="kpi__top">
              <span class="kpi__icon"><AssetIcon name="calendar" :size="18" /></span>
              <!-- The seven days: expected, and booked inside it. -->
              <span class="kpi__days" aria-hidden="true">
                <span v-for="d in data.testing.days" :key="d.date" class="kpi__day">
                  <span class="kpi__day-exp" :style="{ height: `${Math.max(6, pct(d.expected, dayTop))}%` }" />
                  <span v-if="d.booked" class="kpi__day-booked" :style="{ height: `${pct(d.booked, dayTop)}%` }" />
                </span>
              </span>
            </span>
            <span class="kpi__label">Next 7 days</span>
            <span class="kpi__value">{{ num(weekExpected) }}</span>
            <span class="kpi__note">{{ weekBooked }} donors booked</span>
          </div>
          <div class="kpi kpi--icon">
            <span class="kpi__top">
              <span class="kpi__icon"><AssetIcon name="clock" :size="18" /></span>
              <!-- The same week, the busiest day picked out. -->
              <span class="kpi__days" aria-hidden="true">
                <span v-for="d in data.testing.days" :key="d.date" class="kpi__day" :class="{ 'kpi__day--top': busiestDay && d.date === busiestDay.date }">
                  <span class="kpi__day-exp" :style="{ height: `${Math.max(6, pct(d.expected, dayTop))}%` }" />
                </span>
              </span>
            </span>
            <span class="kpi__label">Busiest day ahead</span>
            <span class="kpi__value kpi__value--text">{{ busiestDay ? dayName(busiestDay.date) : '—' }}</span>
            <span class="kpi__note">{{ busiestDay ? `About ${num(busiestDay.expected)} samples` : 'No samples expected' }}</span>
          </div>
          <div v-if="data.testing.reactive" class="kpi kpi--icon" :class="{ 'kpi--alert': data.testing.reactive.found }">
            <span class="kpi__top">
              <span class="kpi__icon"><AssetIcon name="circle-alert" :size="18" /></span>
              <svg class="kpi__spark" :class="{ 'kpi__spark--alert': data.testing.reactive.found }" viewBox="0 0 120 40" preserveAspectRatio="none" aria-hidden="true">
                <path :d="sparkOf(data.testing.reactive.series).area" class="kpi__spark-area" />
                <path :d="sparkOf(data.testing.reactive.series).line" class="kpi__spark-line" vector-effect="non-scaling-stroke" />
              </svg>
            </span>
            <span class="kpi__label">Reactive panels a week</span>
            <span class="kpi__value">{{ num(data.testing.reactive.per_week) }}</span>
            <span class="kpi__note">
              {{ data.testing.reactive.rate === null ? 'No panels read in 12 weeks' : `${data.testing.reactive.rate}% of ${data.testing.reactive.panels} panels in 12 weeks` }}
            </span>
          </div>
        </div>

        <div class="fc__grid">
          <article class="card">
            <header class="card__head"><h3 class="card__title">Samples, week by week</h3><span class="card__note">Dashed: the forecast</span></header>
            <ForecastWeekChart :series="data.testing.samples.series" :estimate="data.testing.samples" :weeks="data.weeks" :horizon="data.horizon" unit="samples" />
          </article>
          <article class="card">
            <header class="card__head"><h3 class="card__title">The week ahead, day by day</h3><span class="card__note">Expected, and who is booked</span></header>
            <div class="days">
              <div v-for="d in data.testing.days" :key="d.date" class="day" :class="{ 'day--top': busiestDay && d.date === busiestDay.date }">
                <span class="day__value">{{ num(d.expected) }}</span>
                <span class="day__track">
                  <span class="day__bar" :style="{ height: `${pct(d.expected, dayTop)}%` }" />
                  <span v-if="d.booked" class="day__booked-bar" :style="{ height: `${pct(d.booked, dayTop)}%` }" />
                </span>
                <span class="day__name">{{ weekdayOf(d.date) }}</span>
                <span class="day__date">{{ shortDate(d.date) }}</span>
                <span class="day__booked">{{ d.booked }} booked</span>
              </div>
            </div>
          </article>
        </div>

        <article v-if="data.testing.reactive" class="card">
          <header class="card__head">
            <h3 class="card__title">Reactive panels, week by week</h3>
            <span class="card__note">{{ data.testing.reactive.found }} in 12 weeks · dashed: the forecast</span>
          </header>
          <ForecastWeekChart :series="data.testing.reactive.series" :estimate="data.testing.reactive" :weeks="data.weeks" :horizon="data.horizon" unit="reactive panels" tone="alert" compact />
        </article>
      </section>

      <!-- ── Billing ── -->
      <section v-if="data.billing" class="fc__part" aria-labelledby="fc-billing">
        <h2 id="fc-billing" class="fc__title">Billing ahead</h2>
        <div class="fc__kpis">
          <div class="kpi">
            <span class="kpi__label">Requests a week</span>
            <span class="kpi__value">{{ num(data.billing.requests.per_week) }}</span>
            <span class="kpi__note">Range {{ data.billing.requests.low }} to {{ data.billing.requests.high }} <TrendChip :value="data.billing.requests.trend" /></span>
          </div>
          <div class="kpi">
            <span class="kpi__label">Units a week</span>
            <span class="kpi__value">{{ num(data.billing.units_per_week) }}</span>
            <span class="kpi__note">Across every component</span>
          </div>
          <div class="kpi">
            <span class="kpi__label">To bill a week</span>
            <span class="kpi__value">{{ peso(data.billing.amount_per_week) }}</span>
            <span class="kpi__note">At today's prices</span>
          </div>
          <div class="kpi">
            <span class="kpi__label">Next {{ data.method.horizon_weeks }} weeks</span>
            <span class="kpi__value">{{ peso(data.billing.amount_horizon) }}</span>
            <span class="kpi__note">Before discounts and waivers</span>
          </div>
        </div>
        <div class="fc__grid">
          <article class="card">
            <header class="card__head"><h3 class="card__title">By component</h3><span class="card__note">A week, at today's prices</span></header>
            <div v-if="data.billing.components.length" class="table-wrap">
              <table class="table">
                <thead><tr><th>Component</th><th class="num">Units</th><th class="num">Price</th><th class="num">Amount</th></tr></thead>
                <tbody>
                  <tr v-for="c in data.billing.components" :key="c.component">
                    <td>{{ c.component }}</td>
                    <td class="num">{{ num(c.units_per_week) }}</td>
                    <td class="num muted">{{ peso(c.price) }}</td>
                    <td class="num strong">{{ peso(c.amount_per_week) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-else class="empty">No requests in the last 12 weeks.</p>
          </article>
          <article class="card">
            <header class="card__head"><h3 class="card__title">Requests, week by week</h3><span class="card__note">Dashed: the forecast</span></header>
            <ForecastWeekChart :series="data.billing.requests.series" :estimate="data.billing.requests" :weeks="data.weeks" :horizon="data.horizon" unit="requests" />
          </article>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, defineComponent, h, onMounted, ref } from 'vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import ForecastWeekChart from '~/components/BloodCenter/ForecastWeekChart.vue'
import { smoothPath } from '~/utils/smoothPath'

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const STATUS = { short: 'Short', watch: 'Watch', ok: 'Enough' }

const data = ref(null)
const loading = ref(true)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    data.value = await bloodCenterService.forecast()
  } catch (err) {
    error.value = err?.message || 'The forecast could not be loaded.'
  } finally {
    loading.value = false
  }
}
onMounted(load)

const num = v => (v === null || v === undefined ? '—' : Number(v).toLocaleString('en-US', { maximumFractionDigits: 1 }))
const peso = v => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(v || 0)
const shortDate = d => new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const dayName = d => new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
const maxOf = (list, key) => Math.max(0.0001, ...list.map(x => x[key] || 0))
const pct = (v, max) => Math.round(((v || 0) / max) * 100)
const gapClass = gap => (gap > 0.5 ? 'kpi--bad' : '')

const collectionGap = computed(() => {
  const c = data.value?.collection
  return c ? Math.round((c.needed_per_week - c.donations.per_week) * 10) / 10 : 0
})
const busiestDay = computed(() => {
  const days = data.value?.testing?.days ?? []
  const top = [...days].sort((a, b) => b.expected - a.expected)[0]
  return top && top.expected > 0 ? top : null
})
const weekExpected = computed(() => (data.value?.testing?.days ?? []).reduce((n, d) => n + d.expected, 0))
// Donors to recruit, blood type by blood type, in the usual order, for the small bars.
const TYPE_ORDER = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const typeBars = computed(() => [...(data.value?.collection?.rows ?? [])]
  .sort((a, b) => TYPE_ORDER.indexOf(a.blood_type) - TYPE_ORDER.indexOf(b.blood_type))
  .map(r => ({ type: r.blood_type, needed: r.needed_per_week, gap: r.gap_per_week, booked: r.booked })))
const typeTop = computed(() => ({
  needed: Math.max(0.0001, ...typeBars.value.map(b => b.needed)),
  gap: Math.max(0.0001, ...typeBars.value.map(b => Math.abs(b.gap))),
  booked: Math.max(0.0001, ...typeBars.value.map(b => b.booked)),
}))

/** A small curve of a week-by-week series, for a headline. */
function sparkOf(series = []) {
  const n = series.length
  if (n < 2) return { line: '', area: '' }
  const top = Math.max(1, ...series)
  const points = series.map((v, i) => ({ x: (i / (n - 1)) * 120, y: 36 - ((v || 0) / top) * 32 }))
  const line = smoothPath(points)
  return { line, area: `${line} L120,40 L0,40 Z` }
}

const weekdayOf = d => new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' })
const weekBooked = computed(() => (data.value?.testing?.days ?? []).reduce((n, d) => n + d.booked, 0))
// One scale for the expected and the booked, so a day booked past its average shows it.
const dayTop = computed(() => Math.max(0.0001, ...(data.value?.testing?.days ?? []).flatMap(d => [d.expected, d.booked])))

// Testing, said in one line: what comes in, and what may be found.
const testingOutlook = computed(() => {
  const t = data.value?.testing
  if (!t) return { title: '', text: '' }
  const perWeek = num(t.samples.per_week)
  const reactive = t.reactive
  if (!t.samples.per_week && !reactive?.panels) {
    return { title: 'Nothing to forecast from yet', text: 'No samples reached the bench in the last 12 weeks. The forecast fills in as donations are collected.' }
  }
  return {
    title: `About ${perWeek} samples a week${busiestDay.value ? `, busiest on ${dayName(busiestDay.value.date)}` : ''}`,
    text: reactive?.rate !== null && reactive?.rate !== undefined
      ? `At the last 12 weeks' rate (${reactive.rate}%), expect about ${num(reactive.per_week)} reactive panels a week, each a referral to follow up.`
      : 'No serology panels were read in the last 12 weeks to set a reactive rate.',
  }
})

// The change of the last four weeks against the four before.
const TrendChip = defineComponent({
  props: { value: { type: Number, default: null } },
  setup(props) {
    return () => {
      if (props.value === null || props.value === undefined) return null
      const flat = Math.abs(props.value) < 5
      const up = props.value > 0
      return h('span', { class: ['trend', flat ? 'trend--flat' : up ? 'trend--up' : 'trend--down'], title: 'Last 4 weeks against the 4 before' },
        flat ? 'steady' : `${up ? '+' : ''}${Math.round(props.value)}%`)
    }
  },
})

// Demand, said in one line: short, to watch, or ready.
const demandOutlook = computed(() => {
  const d = data.value?.demand
  if (!d) return { tone: 'ok', icon: 'check-circle', title: '', text: '' }
  const weeks = data.value.method.horizon_weeks
  if (d.short) {
    return {
      tone: 'bad',
      icon: 'octagon-alert',
      title: `${d.short} ${d.short === 1 ? 'stock runs' : 'stocks run'} short within a week`,
      text: 'At the forecast demand these blood type and component pairs run out in under a week. They are at the top of the table below.',
    }
  }
  if (d.watch) {
    return {
      tone: 'warn',
      icon: 'eye',
      title: `${d.watch} ${d.watch === 1 ? 'stock' : 'stocks'} to watch`,
      text: 'Under two weeks of stock at the forecast demand. Enough for now; plan collection for them.',
    }
  }
  if (!d.rows.length) {
    return {
      tone: 'calm',
      icon: 'inbox',
      title: 'No demand to forecast yet',
      text: 'No hospital requests reached this centre in the last 12 weeks. The forecast fills in as requests come.',
    }
  }
  return {
    tone: 'ok',
    icon: 'check-circle',
    title: `Stock covers the next ${weeks} weeks`,
    text: 'Every blood type and component asked for has at least two weeks of stock at the forecast demand.',
  }
})

// Weeks of stock, against twice the horizon: four weeks fills half.
const coverWidth = (weeks) => {
  if (weeks === null || weeks === undefined) return 100
  return Math.min(100, (weeks / ((data.value?.method?.horizon_weeks || 4) * 2)) * 100)
}
</script>

<style scoped>
.fc { display: flex; flex-direction: column; gap: 20px; }
.fc__method {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  padding: 10px 14px;
  border-radius: 12px;
  background: rgba(var(--rb-primary-rgb), 0.06);
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--rb-text-secondary);
}
.fc__method > :first-child { flex: none; margin-top: 2px; color: var(--rb-primary); }
.fc__error { padding: 10px 14px; border-radius: 12px; background: rgba(211, 47, 47, 0.08); font-size: 13px; color: var(--rb-accent-text, #C62828); }
.link { border: 0; background: none; padding: 0; font: inherit; font-weight: 700; color: inherit; text-decoration: underline; cursor: pointer; }

.fc__part { display: flex; flex-direction: column; gap: 14px; }
.fc__part + .fc__part { padding-top: 6px; }
.fc__title { margin: 0; font-size: 17px; font-weight: 800; color: var(--rb-text-primary); }
.fc__kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.fc__kpis--3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.fc__grid { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: 16px; }

.kpi { display: flex; flex-direction: column; gap: 4px; padding: 16px; border: 1px solid var(--rb-border); border-radius: 16px; background: var(--rb-surface); }
.kpi__label { font-size: 12.5px; font-weight: 600; color: var(--rb-text-secondary); }
.kpi__value { font-size: 28px; font-weight: 800; line-height: 1.1; color: var(--rb-text-primary); font-variant-numeric: tabular-nums; }
.kpi__value--text { font-size: 18px; line-height: 1.35; }
.kpi__note { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 12.5px; color: var(--rb-text-secondary); }
.kpi--bad { border-color: rgba(220, 38, 38, 0.35); background: rgba(220, 38, 38, 0.04); }
.kpi--bad .kpi__value { color: #B91C1C; }
.kpi--warn .kpi__value { color: #B45309; }
html.dark .kpi--bad .kpi__value { color: #F87171; }
html.dark .kpi--warn .kpi__value { color: #FBBF24; }

.card { display: flex; flex-direction: column; gap: 14px; padding: 18px 20px; border: 1px solid var(--rb-border); border-radius: 18px; background: var(--rb-surface); min-width: 0; }
.card__head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; }
.card__title { margin: 0; font-size: 15px; font-weight: 700; color: var(--rb-text-primary); }
.card__note { font-size: 12.5px; color: var(--rb-text-secondary); }
.empty { margin: 0; font-size: 13px; color: var(--rb-text-secondary); }

.table-wrap { overflow-x: auto; }
.table { width: 100%; border-collapse: collapse; font-size: 13px; font-variant-numeric: tabular-nums; }
.table th { padding: 8px 10px; border-bottom: 1px solid var(--rb-border); font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-align: left; text-transform: uppercase; color: var(--rb-text-secondary); white-space: nowrap; }
.table td { padding: 10px; border-bottom: 1px solid var(--rb-border); color: var(--rb-text-primary); white-space: nowrap; }
.table tbody tr:last-child td { border-bottom: 0; }
.table .num { text-align: right; }
.table .strong { font-weight: 700; }
.table .muted { color: var(--rb-text-secondary); }
.table .is-bad { font-weight: 700; color: #B91C1C; }
html.dark .table .is-bad { color: #F87171; }
.type { display: inline-grid; place-items: center; min-width: 34px; padding: 2px 6px; border-radius: 6px; background: rgba(var(--rb-primary-rgb), 0.08); font-weight: 700; color: var(--rb-primary-text, var(--rb-primary)); }

.pill { display: inline-flex; padding: 2px 9px; border-radius: 999px; font-size: 11.5px; font-weight: 700; }
.pill--short { color: #B91C1C; background: rgba(220, 38, 38, 0.1); }
.pill--watch { color: #B45309; background: rgba(245, 158, 11, 0.14); }
.pill--ok { color: #15803D; background: rgba(22, 163, 74, 0.1); }
html.dark .pill--short { color: #F87171; }
html.dark .pill--watch { color: #FBBF24; }
html.dark .pill--ok { color: #4ADE80; }

:deep(.trend) { display: inline-flex; padding: 1px 7px; border-radius: 999px; font-size: 11px; font-weight: 700; }
:deep(.trend--up) { color: #B45309; background: rgba(245, 158, 11, 0.14); }
:deep(.trend--down) { color: #1D4ED8; background: rgba(59, 130, 246, 0.12); }
:deep(.trend--flat) { color: var(--rb-text-secondary); background: rgba(127, 127, 127, 0.12); }

.facts { display: flex; flex-wrap: wrap; gap: 24px; margin: 0; padding-top: 12px; border-top: 1px solid var(--rb-border); }
.facts dt { font-size: 12px; color: var(--rb-text-secondary); }
.facts dd { margin: 2px 0 0; font-size: 14px; font-weight: 700; color: var(--rb-text-primary); }

.bars { display: flex; flex-direction: column; gap: 10px; margin: 0; padding: 0; list-style: none; }
.bar { display: grid; grid-template-columns: minmax(0, 180px) minmax(0, 1fr) 48px; align-items: center; gap: 10px; font-size: 13px; }
.bar__label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--rb-text-primary); }
.bar__track { height: 8px; border-radius: 999px; background: rgba(var(--rb-primary-rgb), 0.08); overflow: hidden; }
.bar__track > span { display: block; height: 100%; border-radius: 999px; background: var(--rb-primary); }
.bar__value { text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--rb-text-primary); }

.days { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 10px; height: 236px; }
.day { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.day__value { font-size: 13px; font-weight: 700; color: var(--rb-text-primary); font-variant-numeric: tabular-nums; }
.day__track { position: relative; flex: 1; width: 100%; max-width: 56px; border-radius: 12px; background: rgba(var(--rb-primary-rgb), 0.06); overflow: hidden; }
.day__bar { position: absolute; inset: auto 0 0; border-radius: 12px; background: color-mix(in srgb, var(--rb-primary) 55%, transparent); }
/* Who is booked, a darker core inside the expected. */
.day__booked-bar { position: absolute; inset: auto 22% 0; border-radius: 8px 8px 12px 12px; background: var(--rb-primary); }
.day--top .day__bar { background: color-mix(in srgb, var(--rb-primary) 75%, transparent); }
.day--top .day__name { color: var(--rb-primary-text); }
.day__name { font-size: 12px; font-weight: 600; color: var(--rb-text-primary); }
.day__booked { font-size: 11.5px; color: var(--rb-text-secondary); }
.day__date { margin-top: -4px; font-size: 11.5px; color: var(--rb-text-secondary); white-space: nowrap; }

/* ===== Refresh (project owner, 2026-10-24) ===== */
.outlook { --tone: var(--rb-success); --tone-rgb: var(--rb-success-rgb); display: flex; align-items: center; gap: 14px; padding: 16px 18px; border: 1px solid rgba(var(--tone-rgb), 0.3); border-radius: 16px; background: rgba(var(--tone-rgb), 0.06); }
.outlook--warn { --tone: var(--rb-warning); --tone-rgb: var(--rb-warning-rgb); }
.outlook--bad { --tone: var(--rb-accent); --tone-rgb: var(--rb-accent-rgb); }
.outlook--calm { --tone: var(--rb-primary); --tone-rgb: var(--rb-primary-rgb); }
.outlook__icon { display: grid; flex: none; place-items: center; width: 42px; height: 42px; border-radius: 12px; background: rgba(var(--tone-rgb), 0.14); color: var(--tone); }
.outlook__title { margin: 0; font-size: 15px; font-weight: 800; color: var(--rb-text-primary); }
.outlook__text { margin: 2px 0 0; font-size: 13px; color: var(--rb-text-secondary); }

.kpi--icon { position: relative; padding-top: 16px; }
.kpi__top { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; margin-bottom: 6px; }
.kpi__top .kpi__icon { margin-bottom: 0; }
.kpi__spark { --spark-rgb: var(--rb-primary-rgb); width: 96px; height: 34px; overflow: visible; }
.kpi__spark--alert { --spark-rgb: var(--rb-accent-rgb); }
.kpi__spark-area { fill: rgba(var(--spark-rgb), 0.14); }
.kpi__spark-line { fill: none; stroke: rgb(var(--spark-rgb)); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
.kpi__days { display: flex; align-items: flex-end; gap: 4px; height: 34px; }
.kpi__day { position: relative; width: 9px; height: 100%; }
.kpi__day-exp { position: absolute; inset: auto 0 0; border-radius: 3px 3px 1px 1px; background: rgba(var(--rb-primary-rgb), 0.3); }
.kpi__day-booked { position: absolute; inset: auto 2px 0; border-radius: 2px 2px 1px 1px; background: var(--rb-primary); }
.kpi__day--top .kpi__day-exp { background: var(--rb-primary); }
.kpi__icon { --tone-rgb: var(--rb-primary-rgb); display: grid; place-items: center; width: 34px; height: 34px; margin-bottom: 6px; border-radius: 10px; background: rgba(var(--tone-rgb), 0.1); color: rgb(var(--tone-rgb)); }
.kpi--bad .kpi__icon { --tone-rgb: var(--rb-accent-rgb); }
.kpi--warn .kpi__icon { --tone-rgb: var(--rb-warning-rgb); }
.kpi--warn { border-color: rgba(var(--rb-warning-rgb), 0.35); }
.kpi--alert .kpi__icon { --tone-rgb: var(--rb-accent-rgb); }
.kpi--icon:not(.kpi--bad):not(.kpi--warn) .kpi__value { color: var(--rb-text-primary); }

.calm { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; flex: 1; min-height: 160px; padding: 12px; text-align: center; }
.calm--row { flex-direction: row; justify-content: flex-start; gap: 14px; min-height: 0; padding: 6px 0; text-align: left; }
.calm__icon { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 50%; background: rgba(var(--rb-success-rgb), 0.1); color: var(--rb-success-text); }
.calm--row .calm__icon { flex: none; background: rgba(var(--rb-primary-rgb), 0.08); color: var(--rb-primary-text); }
.calm__title { margin: 0; font-size: 14px; font-weight: 700; color: var(--rb-text-primary); }
.calm__text { max-width: 360px; margin: 0; font-size: 12.5px; line-height: 1.5; color: var(--rb-text-secondary); }
.calm--row .calm__text { max-width: none; }

.cover { display: inline-flex; align-items: center; justify-content: flex-end; gap: 8px; }
.cover__track { width: 64px; height: 6px; border-radius: 999px; background: var(--rb-surface-alt); box-shadow: inset 0 0 0 1px var(--rb-border); overflow: hidden; }
.cover__track > span { display: block; height: 100%; border-radius: inherit; background: var(--rb-success); }
.cover--watch .cover__track > span { background: var(--rb-warning); }
.cover--short .cover__track > span { background: var(--rb-accent); }
.row--short td:first-child { box-shadow: inset 3px 0 0 var(--rb-accent); }
.row--short td { background: rgba(var(--rb-accent-rgb), 0.04); }
.row--watch td:first-child { box-shadow: inset 3px 0 0 var(--rb-warning); }

.fc__skeleton { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.fc__skel-card { height: 104px; border-radius: 16px; background: var(--rb-skeleton-a, #EEF1F5); }
.fc__skel-chart { grid-column: 1 / -1; height: 240px; border-radius: 18px; background: var(--rb-skeleton-a, #EEF1F5); }
/* The gap bars: short in red, keeping up in green. */
.kpi__day-exp--short { background: rgba(var(--rb-accent-rgb), 0.75); }
.kpi__day-exp--ok { background: rgba(var(--rb-success-rgb), 0.55); }
</style>
