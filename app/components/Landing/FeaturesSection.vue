<template>
  <section id="features" class="features lp-section">
    <div class="lp-inner features-grid">
      <div v-reveal class="features-photo">
        <img
          :src="photo"
          alt="A Philippine Red Cross nurse drawing blood from a donor"
          class="lp-photo"
          width="1000"
          height="1116"
          loading="lazy"
        >
      </div>

      <div>
        <header v-reveal class="lp-head">
          <h2 class="lp-h2">
            Everything you need for <span class="accent">blood service management</span>
          </h2>
          <p class="lp-lead">
            A comprehensive platform designed to streamline every aspect of blood
            donation, inventory control, and request coordination.
          </p>
        </header>

        <ul class="feature-list">
          <li
            v-for="(feature, i) in features"
            :key="feature.title"
            v-reveal="(i % 2) * 80"
            class="feature"
          >
            <span class="feature-icon">
              <AssetIcon :name="feature.icon" :size="20" />
            </span>
            <div>
              <h3 class="feature-title">{{ feature.title }}</h3>
              <p class="feature-desc">{{ feature.desc }}</p>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'

const photo = '/images/photos/prc-blood-draw.jpg'

const features = [
  {
    icon: 'search',
    title: 'Blood Search & Request',
    desc: 'Search available blood across partner facilities and submit digital blood requests instantly.',
  },
  {
    icon: 'clipboard-list',
    title: 'Request Processing',
    desc: 'Review, process, dispatch, and track blood requests with complete status visibility.',
  },
  {
    icon: 'package',
    title: 'Inventory Management',
    desc: 'Blood stock monitoring with FEFO method, expiration alerts, and critical-level notifications.',
  },
  {
    icon: 'truck',
    title: 'Supply Coordination',
    desc: 'Hospitals request blood supplies from partnered blood centers when stock falls below threshold.',
  },
  {
    icon: 'users',
    title: 'Donor Management',
    desc: 'Register donors, manage profiles, record donation history, and organize mobile blood drives.',
  },
  {
    icon: 'calendar-check',
    title: 'Donor Portal',
    desc: 'Donors register, book appointments, complete eligibility screening, and track donation history.',
  },
  {
    icon: 'bell',
    title: 'Smart Notifications',
    desc: 'Automated alerts for appointment reminders, request updates, low inventory, and drive announcements.',
  },
  {
    icon: 'bar-chart',
    title: 'Reports & Analytics',
    desc: 'Generate usage reports, analyze consumption trends, and make data-driven decisions.',
  },
]
</script>

<style scoped>
/* Extra top room for the hero's stats card, which overlaps this section. */
.features { padding-top: 176px; }

.features-grid {
  display: grid;
  grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.4fr);
  gap: clamp(2.5rem, 5vw, 5rem);
  align-items: start;
}

.features-photo {
  position: sticky;
  top: 112px;
  aspect-ratio: 4 / 5;
}
.features-photo .lp-photo { border-radius: 28px; box-shadow: var(--lp-shadow-lg); }

.accent { color: var(--lp-accent-text); }

.feature-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
.feature {
  display: flex;
  gap: 16px;
  padding: 22px;
  background: var(--lp-surface);
  border: 1px solid var(--lp-border);
  border-radius: var(--lp-radius);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.feature:hover { border-color: #C9DCF2; box-shadow: var(--lp-shadow); }
.feature-icon {
  width: 46px;
  height: 46px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  background: var(--lp-accent-soft);
  color: var(--lp-accent-text);
}
.feature-title {
  margin: 2px 0 6px;
  font-size: 16px;
  font-weight: 700;
  color: var(--lp-text);
}
.feature-desc {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--lp-text-2);
}

@media (max-width: 1024px) {
  .features { padding-top: 112px; }
  .features-grid { grid-template-columns: 1fr; }
  .features-photo { position: relative; top: 0; aspect-ratio: 16 / 10; max-height: 380px; }
}
@media (max-width: 640px) {
  .features { padding-top: 80px; }
  .feature-list { grid-template-columns: 1fr; }
  .features-photo { aspect-ratio: 4 / 3; }
}
@media (prefers-reduced-motion: reduce) {
  .feature { transition: none; }
}
</style>
