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

    <!--
      ── How RedAgos helps ──
      Before / with RedAgos, per role. It used to be quote cards that looked
      like testimonials while saying "these are not user reviews"; this says
      what changes instead, using only features the portals have today.
    -->
    <section class="scenarios lp-section" aria-labelledby="scenarios-title">
      <div class="lp-inner">
        <header v-reveal class="lp-head lp-head--center">
          <h2 id="scenarios-title" class="lp-h2">How RedAgos helps</h2>
          <p class="lp-lead">
            Five everyday situations, and what changes for each person once
            RedAgos is in place.
          </p>
        </header>

        <div v-reveal class="scenario-panel">
          <div
            ref="tablist"
            class="scenario-picker"
            role="tablist"
            aria-label="Choose a person"
            @keydown="onTabKeydown"
          >
            <button
              v-for="(item, i) in scenarios"
              :id="`scenario-tab-${i}`"
              :key="item.role"
              type="button"
              role="tab"
              class="picker-btn"
              :class="{ active: i === current }"
              :aria-selected="i === current"
              :aria-controls="`scenario-panel-${i}`"
              :tabindex="i === current ? 0 : -1"
              @click="current = i"
            >
              <AssetIcon :name="item.icon" :size="18" />
              {{ item.role }}
            </button>
          </div>

          <div
            :id="`scenario-panel-${current}`"
            class="scenario-body"
            role="tabpanel"
            :aria-labelledby="`scenario-tab-${current}`"
          >
            <Transition name="swap" mode="out-in">
              <div :key="current" class="scenario">
                <p class="scenario-role">{{ scenarios[current].role }}</p>
                <h3 class="scenario-title">{{ scenarios[current].situation }}</h3>

                <div class="compare">
                  <div class="compare-col compare-col--before">
                    <p class="compare-label">
                      <AssetIcon name="circle-x" :size="16" />
                      Before
                    </p>
                    <ul>
                      <li v-for="line in scenarios[current].before" :key="line">{{ line }}</li>
                    </ul>
                  </div>

                  <div class="compare-col compare-col--with">
                    <p class="compare-label">
                      <AssetIcon name="check-circle" :size="16" />
                      With RedAgos
                    </p>
                    <ul>
                      <li v-for="line in scenarios[current].with" :key="line">{{ line }}</li>
                    </ul>
                  </div>
                </div>

                <NuxtLink
                  v-if="scenarios[current].cta.to"
                  :to="scenarios[current].cta.to"
                  class="scenario-cta"
                >
                  {{ scenarios[current].cta.label }}
                  <AssetIcon name="arrow-right" :size="16" />
                </NuxtLink>
                <a v-else href="#drives" class="scenario-cta" @click.prevent="goToDrives">
                  {{ scenarios[current].cta.label }}
                  <AssetIcon name="arrow-right" :size="16" />
                </a>
              </div>
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

// One situation per role. Every "With RedAgos" line must describe something
// the portals actually do; no names, figures, or quotes.
const scenarios = [
  {
    role: 'Regular Donor',
    icon: 'blood-drop',
    situation: 'Keeping up with regular donations',
    before: ['Keeps donation dates on paper or in memory', 'Calls the center to ask about appointments'],
    with: ['Sees their full donation history in the donor portal', 'Books online and gets appointment reminders'],
    cta: { label: 'Register as a donor', to: '/auth/donor/register' },
  },
  {
    role: 'First-Time Donor',
    icon: 'user',
    situation: 'Donating for the first time',
    before: ['Not sure they qualify until they reach the center', 'Fills in paper forms while waiting in line'],
    with: ['Completes eligibility screening online first', 'Books a slot and checks in with a QR code'],
    cta: { label: 'Register as a donor', to: '/auth/donor/register' },
  },
  {
    role: 'Hospital Blood Bank Staff',
    icon: 'hospital',
    situation: 'Finding blood for a patient',
    before: ['Phones blood centers one by one to find units', 'No clear view of when the blood will arrive'],
    with: ['Searches availability across partner blood centers', 'Requests online and tracks it until it arrives'],
    cta: { label: 'Hospital sign in', to: '/auth/login' },
  },
  {
    role: 'Drive Organizer',
    icon: 'calendar',
    situation: 'Running a mobile blood drive',
    before: ['Announces drives through posters and phone calls', 'Cannot tell how many donors will come'],
    with: ['Posts the drive where donors already look', 'Sees who has registered before the day itself'],
    cta: { label: 'Blood center sign in', to: '/auth/login' },
  },
  {
    role: "Patient's Family",
    icon: 'heart',
    situation: 'When a family member needs blood',
    before: ['Asked to look for blood or replacement donors themselves', 'Left waiting without updates'],
    with: ['The hospital requests from the blood center right away', 'The request is tracked until the units arrive'],
    cta: { label: 'Find a donation drive', to: null },
  },
]

const current = ref(0)
const tablist = ref(null)

// Tabs pattern: arrow keys (and Home / End) move between people.
function onTabKeydown(e) {
  const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }
  let next = null
  if (e.key in keys) next = (current.value + keys[e.key] + scenarios.length) % scenarios.length
  else if (e.key === 'Home') next = 0
  else if (e.key === 'End') next = scenarios.length - 1
  if (next === null) return
  e.preventDefault()
  current.value = next
  nextTick(() => {
    const tab = tablist.value?.querySelector(`#scenario-tab-${next}`)
    tab?.focus()
    tab?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  })
}

// Same as the navbar: smooth scroll and a #drives hash.
function goToDrives() {
  document.getElementById('drives')?.scrollIntoView({ behavior: 'smooth' })
  window.history.replaceState(null, '', '#drives')
}
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
  min-height: 340px;
  padding: 36px clamp(24px, 4vw, 48px);
}
.scenario { margin: 0; }
.scenario-role {
  margin: 0 0 4px;
  font-size: 13px;
  font-weight: 700;
  color: var(--lp-accent-text);
}
.scenario-title {
  margin: 0 0 22px;
  font-size: clamp(20px, 2vw, 24px);
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--lp-text);
}

.compare {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 24px;
}
.compare-col {
  padding: 18px 20px;
  border-radius: 16px;
}
.compare-col--before { background: var(--lp-bg); border: 1px solid var(--lp-border); }
.compare-col--with { background: var(--lp-accent-soft); border: 1px solid rgba(21, 101, 192, 0.22); }
.compare-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 700;
}
.compare-col--before .compare-label { color: var(--lp-muted); }
.compare-col--with .compare-label { color: var(--lp-accent-text); }
.compare ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}
.compare li {
  position: relative;
  padding-left: 14px;
  font-size: 14.5px;
  line-height: 1.5;
}
.compare li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0.62em;
  width: 5px;
  height: 5px;
  border-radius: 50%;
}
.compare-col--before li { color: var(--lp-text-2); }
.compare-col--before li::before { background: var(--lp-muted); }
.compare-col--with li { color: var(--lp-text); font-weight: 600; }
.compare-col--with li::before { background: var(--lp-accent); }

.scenario-cta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 15px;
  font-weight: 700;
  color: var(--lp-accent-text);
  text-decoration: none;
}
.scenario-cta:hover { text-decoration: underline; text-underline-offset: 4px; }
.scenario-cta:focus-visible { outline: 2px solid var(--lp-accent); outline-offset: 3px; border-radius: 4px; }

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
  .scenario-body { min-height: 0; padding: 26px 20px 28px; }
}
@media (max-width: 640px) {
  .compare { grid-template-columns: 1fr; }
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
