<template>
  <section id="drives" class="drives lp-section">
    <div class="lp-inner">
      <header v-reveal class="lp-head">
        <h2 class="lp-h2">Upcoming donation drives</h2>
        <p class="lp-lead">Join a mobile blood donation drive near you and help save lives.</p>
      </header>

      <div v-if="upcomingDrives.length === 0" class="empty-state">
        <span class="empty-icon"><AssetIcon name="calendar" :size="24" /></span>
        <p class="empty-title">No upcoming drives right now</p>
        <p class="empty-desc">New drives are posted here as blood centers schedule them.</p>
      </div>

      <!--
        Registration counts and capacity are internal to the blood center and
        are not shown on the public page.
      -->
      <ol v-else class="drive-list">
        <li
          v-for="(drive, i) in upcomingDrives"
          :key="drive.title"
          v-reveal="i * 80"
          class="drive"
        >
          <time class="date-tile" :datetime="drive.date">
            <span class="date-month">{{ drive.month }}</span>
            <span class="date-day">{{ drive.day }}</span>
          </time>

          <div class="drive-main">
            <h3>{{ drive.title }}</h3>
            <p class="drive-meta">
              <AssetIcon name="map-pin" :size="15" />
              {{ drive.location }}
            </p>
          </div>

          <div class="drive-when">
            <p class="drive-meta">
              <AssetIcon name="calendar" :size="15" />
              {{ drive.weekday }}
            </p>
            <p class="drive-meta">
              <AssetIcon name="clock" :size="15" />
              {{ drive.time }}
            </p>
          </div>

          <NuxtLink to="/auth/donor/login" class="lp-btn lp-btn--secondary lp-btn--sm drive-cta">
            Join this drive
          </NuxtLink>
        </li>
      </ol>
    </div>
  </section>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import { upcomingDrives as listUpcoming } from '~/utils/donationDrives'

// The list lives in utils/donationDrives.ts, shared with the hero's
// "Next drive" card.
const upcomingDrives = computed(() => listUpcoming())
</script>

<style scoped>
.drive-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 14px;
}

.drive {
  display: grid;
  grid-template-columns: 76px minmax(0, 1.5fr) minmax(0, 1fr) auto;
  align-items: center;
  gap: 28px;
  padding: 20px 24px 20px 20px;
  background: var(--lp-surface);
  border: 1px solid var(--lp-border);
  border-radius: var(--lp-radius);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.drive:hover { border-color: #C9DCF2; box-shadow: var(--lp-shadow); }

.date-tile {
  width: 76px;
  height: 76px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: var(--lp-radius);
  background: var(--lp-brand-soft);
  color: var(--lp-brand);
}
.date-month { font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
.date-day { font-size: 26px; font-weight: 800; line-height: 1; color: var(--lp-text); }

.drive-main h3 {
  margin: 0 0 6px;
  font-size: 18px;
  font-weight: 700;
  color: var(--lp-text);
}
.drive-when { display: grid; gap: 6px; }
.drive-meta {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--lp-text-2);
}
.drive-meta :deep(svg) { color: var(--lp-muted); }

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
.empty-desc { margin: 0; font-size: 14px; color: var(--lp-text-2); }

/* ── Responsive ── */
@media (max-width: 960px) {
  .drive {
    grid-template-columns: 64px minmax(0, 1fr);
    grid-template-areas:
      'date main'
      'date when'
      'date cta';
    column-gap: 20px;
    row-gap: 10px;
    align-items: start;
    padding: 20px;
  }
  .date-tile { grid-area: date; width: 64px; height: 64px; }
  .drive { padding: 18px; }
  .drive-main { grid-area: main; }
  .drive-when { grid-area: when; }
  .drive-cta { grid-area: cta; justify-self: start; }
}
@media (max-width: 640px) {
  .drive-main h3 { font-size: 16px; }
}
@media (prefers-reduced-motion: reduce) {
  .drive { transition: none; }
}
</style>
