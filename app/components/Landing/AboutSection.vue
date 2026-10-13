<template>
  <div class="about-page">
    <!-- ── About Section ── -->
    <section id="about" class="about-section" ref="aboutRef">
      <div class="section-inner">
        <div class="about-grid">

          <div class="about-left" :class="{ 'animate-in': aboutVisible }">
            <h1>About <span class="brand">Red</span>Agos</h1>
            <p>
              RedAgos is a centralized web-based Blood Bank Management and Inventory
              System designed for Davao City's blood service network, connecting donors,
              blood centers, and hospital blood banks in one platform.
            </p>
            <p>
              By digitizing blood service operations, RedAgos improves coordination, reduces
              delays, and ensures every unit of blood reaches the patient who needs it most.
            </p>
          </div>

          <div class="feature-grid">
            <div
              v-for="(feat, i) in features"
              :key="feat.title"
              class="feat-card"
              :class="{ 'animate-in': aboutVisible }"
              :style="{ '--feat-delay': `${0.1 + i * 0.08}s` }"
            >
              <AssetIcon :name="feat.icon" class="feat-icon" :size="16" />
              <h3>{{ feat.title }}</h3>
              <p>{{ feat.desc }}</p>
            </div>
          </div>

        </div>
      </div>
    </section>

    <!-- ── Testimonials Section ── -->
    <section class="stories-section" ref="storiesRef">
      <div class="section-inner">

        <div class="stories-head" :class="{ 'animate-in': storiesVisible }">
          <div class="badge-pill">
            <AssetIcon name="quote" class="badge-icon" :size="14" />
            Sample Scenarios
          </div>
          <h2>How RedAgos Helps</h2>
          <p>
            Illustrative scenarios of how donors, hospital staff, and families
            can use RedAgos. These are examples, not user reviews.
          </p>
        </div>

        <!-- Desktop: 3-card slider -->
        <div class="desktop-slider">
          <div class="cards-row">
            <div
              v-for="(pos, idx) in visibleIndices"
              :key="`${pos}-${current}`"
              class="tcard"
              :class="{ featured: idx === 1, 'animate-in': storiesVisible }"
              :style="{ '--tcard-delay': `${idx * 0.08}s` }"
            >
              <p class="quote">" {{ testimonials[pos].quote }} "</p>
              <div class="tcard-footer">
                <span class="avatar-img" aria-hidden="true">
                  <AssetIcon :name="testimonials[pos].icon" :size="18" />
                </span>
                <div class="author-info">
                  <span class="author-name">{{ testimonials[pos].name }}</span>
                  <span class="author-role">{{ testimonials[pos].role }}</span>
                </div>
                <span v-if="testimonials[pos].blood_type" class="blood-tag">{{ testimonials[pos].blood_type }}</span>
              </div>
            </div>
          </div>

          <div class="nav-row">
            <button class="nav-btn" @click="prev" aria-label="Previous">
              <AssetIcon name="chevron-left" :size="18" />
            </button>
            <div class="dots">
              <button
                v-for="(_, i) in testimonials"
                :key="i"
                class="dot"
                :class="{ active: i === current }"
                @click="current = i"
                :aria-label="`Go to scenario ${i + 1}`"
              />
            </div>
            <button class="nav-btn" @click="next" aria-label="Next">
              <AssetIcon name="chevron-right" :size="18" />
            </button>
          </div>
        </div>

        <!-- Mobile: single card -->
        <div class="mobile-slider">
          <Transition name="slide" mode="out-in">
            <div class="tcard" :key="current">
              <p class="quote">" {{ testimonials[current].quote }} "</p>
              <div class="tcard-footer">
                <span class="avatar-img" aria-hidden="true">
                  <AssetIcon :name="testimonials[current].icon" :size="18" />
                </span>
                <div class="author-info">
                  <span class="author-name">{{ testimonials[current].name }}</span>
                  <span class="author-role">{{ testimonials[current].role }}</span>
                </div>
                <span v-if="testimonials[current].blood_type" class="blood-tag">{{ testimonials[current].blood_type }}</span>
              </div>
            </div>
          </Transition>

          <div class="nav-row">
            <button class="nav-btn" @click="prev" aria-label="Previous">
              <AssetIcon name="chevron-left" :size="18" />
            </button>
            <div class="dots">
              <button
                v-for="(_, i) in testimonials"
                :key="i"
                class="dot"
                :class="{ active: i === current }"
                @click="current = i"
                :aria-label="`Go to scenario ${i + 1}`"
              />
            </div>
            <button class="nav-btn" @click="next" aria-label="Next">
              <AssetIcon name="chevron-right" :size="18" />
            </button>
          </div>
        </div>

      </div>
    </section>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import AssetIcon from '~/components/common/AssetIcon.vue'

// ── Intersection Observers ──
const aboutRef   = ref(null)
const storiesRef = ref(null)
const aboutVisible   = ref(false)
const storiesVisible = ref(false)
let obs1, obs2

onMounted(() => {
  const opts = { threshold: 0.12 }
  obs1 = new IntersectionObserver(([e]) => { if (e.isIntersecting) aboutVisible.value = true }, opts)
  obs2 = new IntersectionObserver(([e]) => { if (e.isIntersecting) storiesVisible.value = true }, opts)
  if (aboutRef.value)   obs1.observe(aboutRef.value)
  if (storiesRef.value) obs2.observe(storiesRef.value)
})
onUnmounted(() => { obs1?.disconnect(); obs2?.disconnect() })

// ── Features ──
const features = [
  { icon: 'shield',    title: 'Safe & Reliable',    desc: 'Eligibility screening ensures only qualified donors proceed, backed by inventory monitoring.' },
  { icon: 'bolt',      title: 'Fast Processing',     desc: 'Digital blood requests replace phone calls and paperwork between facilities.' },
  { icon: 'users',     title: 'Connected Community', desc: 'Linking donors, hospital blood banks, and blood centers in one unified platform.' },
  { icon: 'bar-chart', title: 'Data-Driven',         desc: 'Analytics and reporting support smarter planning, forecasting, and blood supply management.' },
]

// ── Sample scenarios ──
// Illustrative only. No real names, photos, facilities, or figures — the
// section header says so, and these must never read as genuine reviews.
const testimonials = [
  {
    name: 'Regular Donor',
    role: 'Sample scenario',
    icon: 'blood-drop',
    blood_type: 'O+',
    quote: "I can book appointments, check my eligibility, and see my full donation history from my phone. RedAgos also reminds me when I can donate again.",
  },
  {
    name: 'First-Time Donor',
    role: 'Sample scenario',
    icon: 'user',
    blood_type: 'A+',
    quote: "I was nervous about donating for the first time, but the online eligibility screening walked me through everything before I even got to the center.",
  },
  {
    name: 'Hospital Blood Bank Staff',
    role: 'Sample scenario',
    icon: 'hospital',
    quote: "Instead of calling around for blood, we submit a request and track its status until it arrives. Stock thresholds warn us before we run low.",
  },
  {
    name: 'Drive Organizer',
    role: 'Sample scenario',
    icon: 'calendar',
    quote: "We list upcoming donation drives and donors register online, so we know how many people to expect before the day itself.",
  },
  {
    name: "Patient's Family Member",
    role: 'Sample scenario',
    icon: 'heart',
    quote: "When my father needed a transfusion, the hospital could request blood from the blood center right away, and the request was tracked every step of the way.",
  },
]

const current = ref(0)

const visibleIndices = computed(() => [
  (current.value - 1 + testimonials.length) % testimonials.length,
  current.value,
  (current.value + 1) % testimonials.length,
])

function prev() {
  current.value = (current.value - 1 + testimonials.length) % testimonials.length
}
function next() {
  current.value = (current.value + 1) % testimonials.length
}
</script>

<style scoped>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(22px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── Slide transition (mobile) ── */
.slide-enter-active, .slide-leave-active { transition: opacity 0.3s ease, transform 0.3s ease; }
.slide-enter-from  { opacity: 0; transform: translateX(40px); }
.slide-leave-to    { opacity: 0; transform: translateX(-40px); }

.about-page {
  background: var(--lp-surface-alt);
  font-family: var(--rb-font-sans);
}

.section-inner {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 2.5rem;
}

/* ── About Section ── */
.about-section { padding: 80px 0 72px; }

.about-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 56px;
  align-items: start;
}

.about-left { opacity: 0; }
.about-left.animate-in {
  animation: fadeUp 0.65s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}
.about-left h1 {
  font-size: 42px;
  font-weight: 800;
  color: var(--lp-text);
  line-height: 1.15;
  margin-bottom: 24px;
}
.about-left h1 .brand { color: var(--lp-brand); }
.about-left p {
  font-size: 15px;
  color: var(--lp-text-2);
  line-height: 1.8;
  margin-bottom: 20px;
}

.feature-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.feat-card {
  background: var(--lp-surface);
  border: 1px solid var(--lp-border);
  border-radius: 12px;
  padding: 20px 18px;
  opacity: 0;
}
.feat-card.animate-in {
  animation: fadeUp 0.6s cubic-bezier(0.22, 1, 0.36, 1) var(--feat-delay) forwards;
}
.feat-icon { color: var(--lp-accent-text); margin-bottom: 10px; }
.feat-card h3 { font-size: 14px; font-weight: 700; color: var(--lp-text); margin-bottom: 6px; }
.feat-card p  { font-size: 12.5px; color: var(--lp-muted); line-height: 1.6; }

/* ── Stories Section ── */
.stories-section { padding: 0 0 80px; }

.stories-head { text-align: center; margin-bottom: 44px; opacity: 0; }
.stories-head.animate-in {
  animation: fadeUp 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}
.badge-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--lp-accent-soft);
  border: 1px solid rgba(37, 99, 235, 0.2);
  border-radius: 999px;
  padding: 7px 16px;
  font-size: 13px;
  font-weight: 500;
  color: var(--lp-accent-text);
  margin-bottom: 16px;
}
.badge-icon { color: var(--lp-accent-text); }
.stories-head h2 {
  font-size: 32px;
  font-weight: 800;
  color: var(--lp-text);
  margin-bottom: 10px;
}
.stories-head p {
  font-size: 14px;
  color: var(--lp-muted);
  max-width: 520px;
  margin: 0 auto;
  line-height: 1.6;
}

/* ── Shared card styles ── */
.tcard {
  background: var(--lp-surface);
  border: 1px solid var(--lp-border);
  border-radius: 16px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  opacity: 0;
  transition: box-shadow 0.25s ease;
}
.tcard.animate-in {
  animation: fadeUp 0.55s cubic-bezier(0.22, 1, 0.36, 1) var(--tcard-delay, 0s) forwards;
}
.tcard.featured {
  background: var(--lp-accent-hover);
  border-color: var(--lp-accent-hover);
  transform: scale(1.04);
  z-index: 1;
  box-shadow: 0 20px 48px rgba(29, 78, 216, 0.28);
}


.quote {
  font-size: 13px;
  line-height: 1.7;
  color: var(--lp-muted);
  flex: 1;
}
.featured .quote { color: rgba(191, 219, 254, 0.9); }

.tcard-footer {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-top: 14px;
  border-top: 1px solid var(--lp-border);
}
.featured .tcard-footer { border-color: rgba(255, 255, 255, 0.2); }

.avatar-img {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--lp-accent-soft);
  color: var(--lp-accent-text);
}
.featured .avatar-img {
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
}

.author-info { display: flex; flex-direction: column; gap: 2px; }
.author-name { font-size: 13px; font-weight: 700; color: var(--lp-text); }
.author-role { font-size: 11px; color: var(--lp-muted); }
.featured .author-name { color: #ffffff; }
.featured .author-role { color: rgba(147, 197, 253, 0.85); }

.blood-tag {
  margin-left: auto;
  background: var(--lp-brand-soft);
  color: var(--lp-brand);
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  padding: 4px 10px;
  flex-shrink: 0;
}
.featured .blood-tag {
  background: rgba(255, 255, 255, 0.18);
  color: #bfdbfe;
}

/* ── Desktop slider ── */
.desktop-slider { display: block; }
.mobile-slider  { display: none; }

.cards-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px;
  align-items: stretch;
  margin-bottom: 28px;
}

/* ── Nav ── */
.nav-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 8px;
}
.nav-btn {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: 1px solid var(--lp-border);
  background: var(--lp-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--lp-text-2);
  transition: background 0.2s, border-color 0.2s, color 0.2s;
}
.nav-btn:hover {
  background: var(--lp-accent);
  border-color: var(--lp-accent);
  color: #ffffff;
}
.dots { display: flex; align-items: center; gap: 6px; }
.dot {
  border: none;
  border-radius: 999px;
  background: var(--lp-border);
  cursor: pointer;
  transition: all 0.25s ease;
  width: 8px;
  height: 8px;
  padding: 0;
}
.dot.active {
  width: 22px;
  height: 8px;
  background: var(--lp-accent);
}

/* ── Responsive ── */
@media (max-width: 1024px) {
  .about-grid { grid-template-columns: 1fr; gap: 36px; }
  .desktop-slider { display: none; }
  .mobile-slider  { display: block; }
}

@media (max-width: 768px) {
  .about-left h1 { font-size: 32px; }
  .feature-grid  { grid-template-columns: 1fr 1fr; }
  .stories-head h2 { font-size: 26px; }
}

@media (max-width: 480px) {
  .section-inner { padding: 0 1.25rem; }
  .about-section { padding: 56px 0 48px; }
  .feature-grid  { grid-template-columns: 1fr; }
}

/* Mobile card (no scale, no opacity) */
.mobile-slider .tcard {
  opacity: 1;
  transform: none;
  animation: none;
}

@media (prefers-reduced-motion: reduce) {
  .about-left, .feat-card, .stories-head, .tcard {
    opacity: 1; transform: none; animation: none;
  }
  .tcard.featured { transform: none; }
}
</style>
