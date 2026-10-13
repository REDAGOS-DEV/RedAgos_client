<template>
  <section id="drives" class="drives" ref="sectionRef">
    <div class="section-inner">
      <div class="badge" :class="{ 'animate-in': visible }">
        <span class="badge-dot"></span>
        DONATION DRIVES
      </div>

      <div class="heading-wrap" :class="{ 'animate-in': visible }">
        <h2 class="heading-top">
          Upcoming <span class="heading-blue">Donation Drives</span>
        </h2>
        <p class="subheading">Join a mobile blood donation drive near you and help save lives.</p>
      </div>

      <div v-if="sortedDrives.length === 0" class="empty-state">
        <AssetIcon name="calendar" :size="32" />
        <p>No upcoming drives at the moment. Check back soon!</p>
      </div>

      <div v-else class="drive-grid">
        <article
          v-for="(drive, index) in sortedDrives"
          :key="drive.title"
          class="drive-card"
          :class="{ 'animate-in': visible }"
          :style="{ '--drive-delay': `${index * 0.08}s` }"
        >
          <div class="card-head">
            <div class="date-block" aria-hidden="true">
              <span class="date-month">{{ drive.month }}</span>
              <span class="date-day">{{ drive.day }}</span>
            </div>
            <div class="card-head-text">
              <span class="status-pill">Upcoming</span>
              <h3>{{ drive.title }}</h3>
            </div>
          </div>

          <ul class="drive-details">
            <li>
              <AssetIcon name="map-pin" :size="16" />
              <span>{{ drive.location }}</span>
            </li>
            <li>
              <AssetIcon name="calendar" :size="16" />
              <span>{{ drive.dateLabel }}</span>
            </li>
            <li>
              <AssetIcon name="clock" :size="16" />
              <span>{{ drive.time }}</span>
            </li>
          </ul>

          <div class="slots">
            <div class="slots-row">
              <span class="slots-label">
                <AssetIcon name="users" :size="16" />
                {{ drive.registered }}/{{ drive.capacity }} registered
              </span>
              <span class="slots-left">{{ drive.capacity - drive.registered }} slots left</span>
            </div>
            <div class="slots-track">
              <div class="slots-fill" :style="{ width: `${(drive.registered / drive.capacity) * 100}%` }"></div>
            </div>
          </div>

          <button class="card-cta" @click="navigateTo('/auth/donor/login')">
            Register to Donate
          </button>
        </article>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import AssetIcon from '~/components/common/AssetIcon.vue'

const sectionRef = ref(null)
const visible = ref(false)

const drives = [
  {
    title: 'Davao City Hall Community Drive',
    location: 'Davao City Hall, San Pedro St.',
    date: '2026-12-05',
    time: '7:00 AM – 12:00 PM',
    registered: 8,
    capacity: 60,
  },
  {
    title: 'SM Lanang Blood Donation',
    location: 'SM Lanang Premier, J.P. Laurel Ave.',
    date: '2026-11-21',
    time: '9:00 AM – 5:00 PM',
    registered: 15,
    capacity: 80,
  },
  {
    title: 'Ateneo de Davao Blood Drive',
    location: 'Ateneo de Davao University, Jacinto St.',
    date: '2026-11-07',
    time: '8:00 AM – 3:00 PM',
    registered: 42,
    capacity: 100,
  },
]

// Local YYYY-MM-DD, so a drive stays listed through its own day.
const today = new Date().toLocaleDateString('en-CA')

// Upcoming drives only, soonest first, with the pieces the date block needs.
const sortedDrives = computed(() =>
  drives
    .filter((drive) => drive.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((drive) => {
      const d = new Date(`${drive.date}T00:00:00`)
      return {
        ...drive,
        month: d.toLocaleString('en-US', { month: 'short' }),
        day: d.getDate(),
        dateLabel: d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
      }
    })
)

let observer

onMounted(() => {
  observer = new IntersectionObserver(
    ([entry]) => { if (entry.isIntersecting) visible.value = true },
    { threshold: 0.18 }
  )
  if (sectionRef.value) observer.observe(sectionRef.value)
})

onUnmounted(() => observer?.disconnect())
</script>

<style scoped>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

/* Same motion as FeaturesSection/RolesSection. The card reveal animates
   `translate`/`scale` so the `transform` used on hover still applies. */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(28px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes cardReveal {
  0%   { opacity: 0; translate: 0 34px; scale: 0.96; filter: blur(4px); }
  100% { opacity: 1; translate: 0 0;    scale: 1;    filter: blur(0); }
}

/* ── Section — same container as About/Footer ── */
.drives {
  padding: 90px 0 100px;
  background: var(--lp-bg);
  font-family: var(--rb-font-sans);
  scroll-margin-top: 76px;
}

.section-inner {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 2.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* ── Badge ── */
.badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 18px;
  border-radius: 999px;
  background: var(--lp-accent-soft);
  color: var(--lp-accent-text);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  border: 1px solid rgba(37, 99, 235, 0.2);
  margin-bottom: 32px;
  opacity: 0;
}
.badge.animate-in {
  animation: fadeUp 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.05s forwards;
}
.badge-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--lp-accent);
}

/* ── Heading ── */
.heading-wrap {
  text-align: center;
  max-width: 780px;
  margin-bottom: 56px;
  opacity: 0;
}
.heading-wrap.animate-in {
  animation: fadeUp 0.65s cubic-bezier(0.22, 1, 0.36, 1) 0.12s forwards;
}
.heading-top {
  font-size: 44px;
  font-weight: 800;
  color: var(--lp-text);
  line-height: 1.15;
}
.heading-blue { color: var(--lp-accent-text); }
.subheading {
  margin: 16px auto 0;
  color: var(--lp-text-2);
  font-size: 17px;
  line-height: 1.7;
  max-width: 680px;
}

/* ── Empty state ── */
.empty-state {
  text-align: center;
  padding: 64px 0;
  color: var(--lp-muted);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  font-size: 15px;
}

/* ── Grid ── */
.drive-grid {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 24px;
}

/* ── Card ── */
.drive-card {
  background: var(--lp-surface);
  border: 1px solid var(--lp-border);
  border-radius: 16px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  position: relative;
  overflow: hidden;
  opacity: 0;
  transition: box-shadow 0.28s ease, transform 0.28s ease, border-color 0.28s ease;
}
.drive-card::before {
  content: '';
  position: absolute;
  inset: 0 0 auto 0;
  height: 4px;
  background: linear-gradient(90deg, var(--lp-accent), var(--lp-brand));
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.28s ease;
}
.drive-card.animate-in {
  animation: cardReveal 0.72s cubic-bezier(0.22, 1, 0.36, 1) var(--drive-delay) forwards;
}
.drive-card:hover {
  box-shadow: 0 18px 44px rgba(37, 99, 235, 0.14);
  transform: translateY(-8px) scale(1.015);
  border-color: rgba(37, 99, 235, 0.16);
}
.drive-card:hover::before {
  transform: scaleX(1);
}

/* ── Card head: date block + title ── */
.card-head {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}
.date-block {
  width: 56px;
  flex-shrink: 0;
  border-radius: 12px;
  background: var(--lp-brand-soft);
  color: var(--lp-brand);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 0;
  line-height: 1;
}
.date-month {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.date-day {
  font-size: 24px;
  font-weight: 800;
  margin-top: 4px;
}
.card-head-text { min-width: 0; }
.status-pill {
  display: inline-block;
  background: var(--lp-accent-soft);
  color: var(--lp-accent-text);
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 999px;
  margin-bottom: 8px;
}
.card-head h3 {
  font-size: 17px;
  font-weight: 700;
  color: var(--lp-text);
  line-height: 1.35;
}

/* ── Details ── */
.drive-details {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 20px;
  border-top: 1px solid var(--lp-border);
}
.drive-details li {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 13.5px;
  color: var(--lp-text-2);
  line-height: 1.4;
}
.drive-details .asset-icon {
  color: var(--lp-accent-text);
  flex-shrink: 0;
  margin-top: 1px;
}

/* ── Slots ── */
.slots { margin-top: auto; }
.slots-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  margin-bottom: 8px;
}
.slots-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--lp-muted);
}
.slots-left {
  color: #16a34a;
  font-weight: 600;
}
.slots-track {
  height: 6px;
  border-radius: 999px;
  background: var(--lp-border);
  overflow: hidden;
}
.slots-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--lp-accent);
}

/* ── CTA ── */
.card-cta {
  width: 100%;
  padding: 11px 16px;
  border-radius: 8px;
  border: 1px solid var(--lp-accent);
  background: var(--lp-surface);
  color: var(--lp-accent-text);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s, color 0.2s, transform 0.15s, box-shadow 0.2s;
}
/* Same lift as the Hero/Contact buttons */
.card-cta:hover {
  background: var(--lp-accent);
  color: var(--lp-on-accent);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(37, 99, 235, 0.3);
}
.card-cta:focus-visible {
  outline: 2px solid var(--lp-accent);
  outline-offset: 2px;
}

/* ── Responsive ── */
@media (max-width: 1024px) {
  .drive-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 640px) {
  .drives { padding: 56px 0 64px; }
  .section-inner { padding: 0 1.25rem; }
  .heading-top { font-size: 28px; }
  .subheading { font-size: 15px; }
  .heading-wrap { margin-bottom: 36px; }
  .drive-grid { grid-template-columns: 1fr; }
  .drive-card { padding: 20px; }
}

@media (prefers-reduced-motion: reduce) {
  .badge, .heading-wrap, .drive-card {
    opacity: 1;
    transform: none;
    animation: none;
  }
  .drive-card:hover,
  .card-cta:hover { transform: none; }
}
</style>
