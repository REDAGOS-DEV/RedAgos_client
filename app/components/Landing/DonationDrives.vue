<template>
  <section id="drives" class="drives lp-section">
    <div class="lp-inner">
      <header v-reveal class="lp-head">
        <h2 class="lp-h2">Upcoming donation drives</h2>
        <p class="lp-lead">Join a mobile blood donation drive near you and help save lives.</p>
      </header>

      <!-- Nothing scheduled: point people at the one thing that helps. -->
      <div v-if="drives.length === 0" class="empty-state">
        <span class="empty-icon"><AssetIcon name="calendar" :size="24" /></span>
        <p class="empty-title">No drives scheduled yet</p>
        <p class="empty-desc">New drives are posted here as blood centers schedule them.</p>
        <NuxtLink to="/auth/donor/register" class="lp-btn lp-btn--primary lp-btn--sm">
          Create an account to be notified
        </NuxtLink>
      </div>

      <!--
        Registration counts and capacity are internal to the blood center and
        are not shown on the public page.
      -->
      <div v-else class="drives-layout">
        <!-- ── The soonest drive, featured ── -->
        <article v-reveal class="featured">
          <div class="featured-date">
            <span class="featured-month">{{ featured.month }}</span>
            <span class="featured-day">{{ featured.day }}</span>
            <span v-if="relative[featured.date]" class="featured-when">{{ relative[featured.date] }}</span>
          </div>

          <div class="featured-body">
            <p class="featured-label">Next drive</p>
            <h3>{{ featured.title }}</h3>
            <ul class="meta">
              <li><AssetIcon name="map-pin" :size="16" />{{ featured.location }}</li>
              <li><AssetIcon name="calendar" :size="16" />{{ featured.weekday }}</li>
              <li><AssetIcon name="clock" :size="16" />{{ featured.time }}</li>
            </ul>

            <div class="actions">
              <NuxtLink to="/auth/donor/login" class="lp-btn lp-btn--primary lp-btn--sm">
                Register to join
              </NuxtLink>
              <button type="button" class="lp-btn lp-btn--secondary lp-btn--sm" @click="addToCalendar(featured)">
                <AssetIcon name="calendar-check" :size="16" />
                Add to calendar
              </button>
              <a
                :href="driveMapsUrl(featured)"
                target="_blank"
                rel="noopener"
                class="lp-btn lp-btn--secondary lp-btn--sm"
              >
                <AssetIcon name="map-pin" :size="16" />
                Directions
              </a>
            </div>
          </div>
        </article>

        <!-- ── The rest, compact ── -->
        <ol v-if="rest.length" class="rest">
          <li v-for="(drive, i) in rest" :key="drive.title" v-reveal="i * 80" class="row">
            <time class="row-date" :datetime="drive.date">
              <span class="row-month">{{ drive.month }}</span>
              <span class="row-day">{{ drive.day }}</span>
            </time>

            <div class="row-main">
              <h3>{{ drive.title }}</h3>
              <p class="row-meta">{{ drive.weekday }} · {{ drive.time }}</p>
              <p class="row-meta row-place">
                <AssetIcon name="map-pin" :size="14" />{{ drive.location }}
              </p>
            </div>

            <div class="row-actions">
              <button
                type="button"
                class="icon-action"
                :aria-label="`Add ${drive.title} to your calendar`"
                title="Add to calendar"
                @click="addToCalendar(drive)"
              >
                <AssetIcon name="calendar-check" :size="18" />
              </button>
              <a
                :href="driveMapsUrl(drive)"
                target="_blank"
                rel="noopener"
                class="icon-action"
                :aria-label="`Directions to ${drive.location}`"
                title="Directions"
              >
                <AssetIcon name="map-pin" :size="18" />
              </a>
              <NuxtLink to="/auth/donor/login" class="row-link">Register to join</NuxtLink>
            </div>
          </li>
        </ol>
      </div>
    </div>
  </section>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import { driveIcs, driveMapsUrl, relativeDay, upcomingDrives } from '~/utils/donationDrives'

// The list lives in utils/donationDrives.ts, shared with the hero's
// "Next drive" card.
const drives = computed(() => upcomingDrives())
const featured = computed(() => drives.value[0])
const rest = computed(() => drives.value.slice(1))

// "In 3 weeks" depends on today's date, so it is filled in on the client to
// keep the server render and hydration identical.
const relative = ref({})
onMounted(() => {
  relative.value = Object.fromEntries(drives.value.map(d => [d.date, relativeDay(d.date)]))
})

// Builds the .ics file in the browser and hands it over as a download. Phones
// open it straight into the calendar app.
function addToCalendar(drive) {
  const ics = driveIcs(drive)
  if (!ics) return
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${drive.title.replace(/[^\w]+/g, '-').toLowerCase()}.ics`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
</script>

<style scoped>
.drives-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
  gap: 20px;
  align-items: start;
}

/* ── Featured ── */
.featured {
  display: grid;
  grid-template-columns: 132px minmax(0, 1fr);
  overflow: hidden;
  background: var(--lp-surface);
  border: 1px solid var(--lp-border);
  border-radius: 24px;
  box-shadow: var(--lp-shadow);
}
.featured-date {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 24px 12px;
  background:
    radial-gradient(circle at 30% 20%, rgba(255, 255, 255, 0.22), transparent 60%),
    linear-gradient(160deg, #D32F2F, #B71C1C);
  color: #fff;
  text-align: center;
}
.featured-month { font-size: 14px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; opacity: 0.9; }
.featured-day { font-size: 52px; font-weight: 800; line-height: 1; letter-spacing: -0.03em; }
.featured-when {
  margin-top: 10px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.18);
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.featured-body { padding: 26px 28px; }
.featured-label {
  margin: 0 0 6px;
  font-size: 13px;
  font-weight: 700;
  color: var(--lp-brand);
}
.featured-body h3 {
  margin: 0 0 14px;
  font-size: 22px;
  font-weight: 800;
  line-height: 1.25;
  letter-spacing: -0.015em;
  color: var(--lp-text);
}
.meta {
  list-style: none;
  margin: 0 0 22px;
  padding: 0;
  display: grid;
  gap: 8px;
}
.meta li {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 14.5px;
  line-height: 1.45;
  color: var(--lp-text-2);
}
.meta :deep(svg) { flex-shrink: 0; margin-top: 2px; color: var(--lp-muted); }
.actions { display: flex; flex-wrap: wrap; gap: 8px; }

/* ── Compact rows ── */
.rest {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 12px;
}
.row {
  display: grid;
  grid-template-columns: 60px minmax(0, 1fr);
  grid-template-areas:
    'date main'
    'date actions';
  column-gap: 16px;
  row-gap: 12px;
  padding: 18px;
  background: var(--lp-surface);
  border: 1px solid var(--lp-border);
  border-radius: var(--lp-radius);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.row:hover { border-color: #C9DCF2; box-shadow: var(--lp-shadow); }
.row-date {
  grid-area: date;
  width: 60px;
  height: 60px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
  background: var(--lp-brand-soft);
}
.row-month { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--lp-brand); }
.row-day { font-size: 22px; font-weight: 800; line-height: 1; color: var(--lp-text); }
.row-main { grid-area: main; min-width: 0; }
.row-main h3 { margin: 0 0 4px; font-size: 16px; font-weight: 700; color: var(--lp-text); }
.row-meta { margin: 0; font-size: 13.5px; line-height: 1.5; color: var(--lp-text-2); }
.row-place { display: flex; align-items: flex-start; gap: 6px; color: var(--lp-muted); }
.row-place :deep(svg) { flex-shrink: 0; margin-top: 3px; }

.row-actions { grid-area: actions; display: flex; align-items: center; gap: 6px; }
.icon-action {
  width: 38px;
  height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--lp-border);
  border-radius: 12px;
  background: var(--lp-surface);
  color: var(--lp-text-2);
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease;
}
.icon-action:hover { border-color: var(--lp-accent); color: var(--lp-accent-text); }
.row-link {
  margin-left: auto;
  font-size: 14px;
  font-weight: 700;
  color: var(--lp-accent-text);
  text-decoration: none;
}
.row-link:hover { text-decoration: underline; text-underline-offset: 3px; }
.icon-action:focus-visible,
.row-link:focus-visible { outline: 2px solid var(--lp-accent); outline-offset: 2px; }

/* ── Empty state ── */
.empty-state {
  padding: 56px 24px;
  border: 1px dashed var(--lp-border);
  border-radius: var(--lp-radius);
  text-align: center;
}
.empty-icon {
  width: 48px;
  height: 48px;
  margin: 0 auto 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: var(--lp-accent-soft);
  color: var(--lp-accent-text);
}
.empty-title { margin: 0 0 6px; font-size: 16px; font-weight: 700; color: var(--lp-text); }
.empty-desc { margin: 0 0 20px; font-size: 14px; color: var(--lp-text-2); }

/* ── Responsive ── */
@media (max-width: 960px) {
  .drives-layout { grid-template-columns: 1fr; }
}
@media (max-width: 560px) {
  .featured { grid-template-columns: 1fr; }
  .featured-date {
    flex-direction: row;
    align-items: baseline;
    gap: 10px;
    padding: 16px 20px;
    justify-content: flex-start;
  }
  .featured-day { font-size: 34px; }
  .featured-when { margin: 0 0 0 auto; align-self: center; }
  .featured-body { padding: 20px; }
  .featured-body h3 { font-size: 19px; }
  .actions .lp-btn { flex: 1 1 auto; }
}
@media (prefers-reduced-motion: reduce) {
  .row,
  .icon-action { transition: none; }
}
</style>
