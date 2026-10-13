<template>
  <div>
    <!-- ── About ── -->
    <section id="about" class="about lp-section">
      <div class="lp-inner about-grid">
        <div v-reveal class="about-copy">
          <h2 class="lp-h2">About <span class="brand">Red</span>Agos</h2>
          <p class="lp-lead">
            RedAgos is a centralized web-based Blood Bank Management and Inventory
            System designed for Davao City's blood service network, connecting donors,
            blood centers, and hospital blood banks in one platform.
          </p>
          <p class="lp-lead">
            By digitizing blood service operations, RedAgos improves coordination, reduces
            delays, and ensures every unit of blood reaches the patient who needs it most.
          </p>
        </div>

        <ul class="pillars">
          <li v-for="(pillar, i) in pillars" :key="pillar.title" v-reveal="i * 80" class="pillar">
            <span class="pillar-icon"><AssetIcon :name="pillar.icon" :size="20" /></span>
            <h3>{{ pillar.title }}</h3>
            <p>{{ pillar.desc }}</p>
          </li>
        </ul>
      </div>
    </section>

    <!-- ── Sample scenarios ── -->
    <section class="scenarios lp-section" aria-labelledby="scenarios-title">
      <div class="lp-inner">
        <header v-reveal class="lp-head lp-head--center">
          <h2 id="scenarios-title" class="lp-h2">How RedAgos helps</h2>
          <p class="lp-lead">
            Illustrative scenarios of how donors, hospital staff, and families
            can use RedAgos. These are examples, not user reviews.
          </p>
        </header>

        <div v-reveal class="scenario-panel">
          <div class="scenario-picker" role="group" aria-label="Choose a scenario">
            <button
              v-for="(item, i) in scenarios"
              :key="item.name"
              type="button"
              class="picker-btn"
              :class="{ active: i === current }"
              :aria-pressed="i === current"
              @click="current = i"
            >
              <AssetIcon :name="item.icon" :size="18" />
              {{ item.name }}
            </button>
          </div>

          <div class="scenario-body" aria-live="polite">
            <Transition name="swap" mode="out-in">
              <figure :key="current" class="scenario">
                <AssetIcon name="quote" :size="28" class="quote-mark" />
                <blockquote>{{ scenarios[current].quote }}</blockquote>
                <figcaption>
                  <span class="who">{{ scenarios[current].name }}</span>
                  <span class="tag">Sample scenario</span>
                  <span v-if="scenarios[current].bloodType" class="blood-tag">
                    {{ scenarios[current].bloodType }}
                  </span>
                </figcaption>
              </figure>
            </Transition>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'

const pillars = [
  { icon: 'shield-check', title: 'Safe & Reliable', desc: 'Eligibility screening ensures only qualified donors proceed, backed by inventory monitoring.' },
  { icon: 'bolt', title: 'Fast Processing', desc: 'Digital blood requests replace phone calls and paperwork between facilities.' },
  { icon: 'users', title: 'Connected Community', desc: 'Linking donors, hospital blood banks, and blood centers in one unified platform.' },
  { icon: 'bar-chart', title: 'Data-Driven', desc: 'Analytics and reporting support smarter planning, forecasting, and blood supply management.' },
]

// Illustrative only. No real names, photos, facilities, or figures. The
// section header says so, and these must never read as genuine reviews.
const scenarios = [
  {
    name: 'Regular Donor',
    icon: 'blood-drop',
    bloodType: 'O+',
    quote: 'I can book appointments, check my eligibility, and see my full donation history from my phone. RedAgos also reminds me when I can donate again.',
  },
  {
    name: 'First-Time Donor',
    icon: 'user',
    bloodType: 'A+',
    quote: 'I was nervous about donating for the first time, but the online eligibility screening walked me through everything before I even got to the center.',
  },
  {
    name: 'Hospital Blood Bank Staff',
    icon: 'hospital',
    quote: 'Instead of calling around for blood, we submit a request and track its status until it arrives. Stock thresholds warn us before we run low.',
  },
  {
    name: 'Drive Organizer',
    icon: 'calendar',
    quote: 'We list upcoming donation drives and donors register online, so we know how many people to expect before the day itself.',
  },
  {
    name: "Patient's Family Member",
    icon: 'heart',
    quote: 'When my father needed a transfusion, the hospital could request blood from the blood center right away, and the request was tracked every step of the way.',
  },
]

const current = ref(0)
</script>

<style scoped>
/* ── About ── */
.about,
.scenarios { background: var(--lp-surface); }

.about-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
  gap: clamp(2.5rem, 6vw, 5rem);
  align-items: start;
}
.brand { color: var(--lp-brand); }

.pillars {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
.pillar {
  padding: 26px;
  background: var(--lp-bg);
  border-radius: var(--lp-radius);
}
.pillar-icon {
  width: 46px;
  height: 46px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
  border-radius: 14px;
  background: var(--lp-surface);
  color: var(--lp-accent-text);
  box-shadow: var(--lp-shadow);
}
.pillar h3 { margin: 0 0 6px; font-size: 16px; font-weight: 700; color: var(--lp-text); }
.pillar p { margin: 0; font-size: 14px; line-height: 1.6; color: var(--lp-text-2); }

/* ── Scenarios ── */
.scenarios { padding-top: 0; }

.scenario-panel {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  background: var(--lp-surface);
  border: 1px solid var(--lp-border);
  border-radius: 28px;
  box-shadow: var(--lp-shadow-lg);
  overflow: hidden;
}

.scenario-picker {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 20px;
  background: var(--lp-accent-soft);
}
.picker-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid transparent;
  border-radius: 12px;
  background: none;
  color: var(--lp-text-2);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  transition: background 150ms ease, color 150ms ease;
}
.picker-btn:hover { color: var(--lp-text); background: var(--lp-surface); }
.picker-btn.active {
  background: var(--lp-surface);
  border-color: var(--lp-border);
  color: var(--lp-accent-text);
  box-shadow: var(--lp-shadow);
}
.picker-btn:focus-visible { outline: 2px solid var(--lp-accent); outline-offset: 2px; }

.scenario-body {
  display: flex;
  align-items: center;
  min-height: 280px;
  padding: 40px clamp(24px, 5vw, 56px);
}
.scenario { margin: 0; }
.quote-mark { color: var(--lp-brand); opacity: 0.5; margin-bottom: 16px; }
.scenario blockquote {
  max-width: 52ch;
  margin: 0 0 24px;
  font-size: clamp(18px, 1.8vw, 22px);
  font-weight: 500;
  line-height: 1.55;
  color: var(--lp-text);
}
.scenario figcaption {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  font-size: 14px;
}
.who { font-weight: 700; color: var(--lp-text); }
.tag { color: var(--lp-muted); }
.blood-tag {
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--lp-brand-soft);
  color: var(--lp-brand);
  font-size: 12px;
  font-weight: 700;
}

.swap-enter-active,
.swap-leave-active { transition: opacity 0.2s ease, transform 0.2s var(--lp-ease); }
.swap-enter-from { opacity: 0; transform: translateY(8px); }
.swap-leave-to { opacity: 0; }

/* ── Responsive ── */
@media (max-width: 960px) {
  .about-grid { grid-template-columns: 1fr; }
  .scenario-panel { grid-template-columns: 1fr; }
  /* The picker becomes a horizontal, swipeable row of chips. */
  .scenario-picker {
    flex-direction: row;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
  }
  .picker-btn { flex-shrink: 0; white-space: nowrap; scroll-snap-align: start; }
  .scenario-body { min-height: 0; padding: 28px 24px 32px; }
}
@media (max-width: 560px) {
  .pillars { grid-template-columns: 1fr; }
}

@media (prefers-reduced-motion: reduce) {
  .swap-enter-active,
  .swap-leave-active,
  .picker-btn { transition: none; }
}
</style>
