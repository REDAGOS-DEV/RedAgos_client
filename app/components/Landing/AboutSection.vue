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
              System designed for Davao City. It serves Southern Philippines Medical Center,
              the Sub-National Blood Center, and the Philippine Red Cross Davao Chapter.
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
              <component :is="feat.icon" class="feat-icon" />
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
            <IconQuote class="badge-icon" />
            From Our Community
          </div>
          <h2>Stories That Inspire</h2>
          <p>
            Real experiences from donors, healthcare workers, and families
            who've been touched by the RedAgos platform.
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
              <div class="stars">
                <IconStar
                  v-for="n in testimonials[pos].rating"
                  :key="n"
                  :featured="idx === 1"
                />
              </div>
              <p class="quote">" {{ testimonials[pos].quote }} "</p>
              <div class="tcard-footer">
                <img
                  :src="testimonials[pos].avatar"
                  :alt="testimonials[pos].name"
                  class="avatar-img"
                />
                <div class="author-info">
                  <span class="author-name">{{ testimonials[pos].name }}</span>
                  <span class="author-role">{{ testimonials[pos].role }}</span>
                </div>
                <span class="blood-tag">{{ testimonials[pos].blood_type }}</span>
              </div>
            </div>
          </div>

          <div class="nav-row">
            <button class="nav-btn" @click="prev" aria-label="Previous">
              <IconChevronLeft />
            </button>
            <div class="dots">
              <button
                v-for="(_, i) in testimonials"
                :key="i"
                class="dot"
                :class="{ active: i === current }"
                @click="current = i"
                :aria-label="`Go to testimonial ${i + 1}`"
              />
            </div>
            <button class="nav-btn" @click="next" aria-label="Next">
              <IconChevronRight />
            </button>
          </div>
        </div>

        <!-- Mobile: single card -->
        <div class="mobile-slider">
          <Transition name="slide" mode="out-in">
            <div class="tcard" :key="current">
              <div class="stars">
                <IconStar
                  v-for="n in testimonials[current].rating"
                  :key="n"
                  :featured="false"
                />
              </div>
              <p class="quote">" {{ testimonials[current].quote }} "</p>
              <div class="tcard-footer">
                <img
                  :src="testimonials[current].avatar"
                  :alt="testimonials[current].name"
                  class="avatar-img"
                />
                <div class="author-info">
                  <span class="author-name">{{ testimonials[current].name }}</span>
                  <span class="author-role">{{ testimonials[current].role }}</span>
                </div>
                <span class="blood-tag">{{ testimonials[current].blood_type }}</span>
              </div>
            </div>
          </Transition>

          <div class="nav-row">
            <button class="nav-btn" @click="prev" aria-label="Previous">
              <IconChevronLeft />
            </button>
            <div class="dots">
              <button
                v-for="(_, i) in testimonials"
                :key="i"
                class="dot"
                :class="{ active: i === current }"
                @click="current = i"
                :aria-label="`Go to testimonial ${i + 1}`"
              />
            </div>
            <button class="nav-btn" @click="next" aria-label="Next">
              <IconChevronRight />
            </button>
          </div>
        </div>

      </div>
    </section>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, defineComponent, h } from 'vue'

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

// ── Icons ──
const svgBase = {
  viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
  width: '16', height: '16',
}

const IconShield = defineComponent({ setup: () => () => h('svg', svgBase, [
  h('path', { d: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' }),
]) })

const IconBolt = defineComponent({ setup: () => () => h('svg', svgBase, [
  h('path', { d: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z' }),
]) })

const IconUsers = defineComponent({ setup: () => () => h('svg', svgBase, [
  h('path', { d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' }),
  h('circle', { cx: '9', cy: '7', r: '4' }),
  h('path', { d: 'M22 21v-2a4 4 0 0 0-3-3.87' }),
  h('path', { d: 'M16 3.13a4 4 0 0 1 0 7.75' }),
]) })

const IconChart = defineComponent({ setup: () => () => h('svg', svgBase, [
  h('line', { x1: '18', y1: '20', x2: '18', y2: '10' }),
  h('line', { x1: '12', y1: '20', x2: '12', y2: '4' }),
  h('line', { x1: '6',  y1: '20', x2: '6',  y2: '14' }),
]) })

const IconQuote = defineComponent({ setup: () => () => h('svg', { ...svgBase, width: '14', height: '14' }, [
  h('path', { d: 'M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z' }),
  h('path', { d: 'M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z' }),
]) })

const IconStar = defineComponent({
  props: { featured: Boolean },
  setup: (props) => () => h('svg', {
    viewBox: '0 0 24 24', width: '15', height: '15',
    fill: 'currentColor', stroke: 'none',
    style: { color: props.featured ? '#fde047' : '#f59e0b' },
  }, [
    h('polygon', { points: '12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2' }),
  ]),
})

const IconChevronLeft = defineComponent({ setup: () => () => h('svg', { ...svgBase, width: '18', height: '18' }, [
  h('polyline', { points: '15 18 9 12 15 6' }),
]) })

const IconChevronRight = defineComponent({ setup: () => () => h('svg', { ...svgBase, width: '18', height: '18' }, [
  h('polyline', { points: '9 18 15 12 9 6' }),
]) })

// ── Features ──
const features = [
  { icon: IconShield, title: 'Safe & Reliable',    desc: 'Eligibility screening ensures only qualified donors proceed, backed by real-time inventory monitoring.' },
  { icon: IconBolt,   title: 'Fast Processing',     desc: 'Digital blood requests replace manual coordination, reducing delays from hours to minutes.' },
  { icon: IconUsers,  title: 'Connected Community', desc: 'Linking donors, hospital blood banks, and blood centers in one unified platform.' },
  { icon: IconChart,  title: 'Data-Driven',         desc: 'Analytics and reporting support smarter planning, forecasting, and blood supply management.' },
]

// ── Testimonials ──
const testimonials = [
  {
    name: 'Col Kolai',
    role: 'Regular Donor · 8 Donations',
    blood_type: 'O+',
    avatar: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=120&q=80',
    quote: "RedAgos made donating blood so much easier. I can check blood availability, book appointments, and see my full donation history — all from my phone. It feels great knowing my donations are going where they're needed most.",
    rating: 5,
  },
  {
    name: 'Yang Bulaks',
    role: 'First-Time Donor · 1 Donation',
    blood_type: 'A+',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&q=80',
    quote: "I was nervous about donating for the first time, but the eligibility screening on RedAgos walked me through everything clearly. The appointment booking was smooth and the staff at SPMC were amazing.",
    rating: 5,
  },
  {
    name: 'Bevie Ekay',
    role: 'Nurse · SPMC Blood Bank',
    blood_type: 'B+',
    avatar: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=120&q=80',
    quote: "From a healthcare worker's perspective, RedAgos has transformed how we manage blood requests. What used to take hours of phone calls now takes minutes. The real-time inventory view alone saves lives every day.",
    rating: 5,
  },
  {
    name: 'Mee Ann',
    role: 'Volunteer · Red Cross Davao',
    blood_type: 'AB+',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&q=80',
    quote: "Organizing mobile donation drives used to be a logistical nightmare. With RedAgos, we can list upcoming events and donors can register online. Our last drive at SM Lanang saw twice the usual turnout!",
    rating: 5,
  },
  {
    name: 'Hopya Eyy',
    role: "Patient's Family Member",
    blood_type: 'A-',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=120&q=80',
    quote: "When my father needed an emergency transfusion, I was able to find available O- units within minutes using RedAgos. The hospital was able to process the request immediately. This system truly saves lives.",
    rating: 5,
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
  background: #eef0f5;
  font-family: 'Inter', 'Segoe UI', sans-serif;
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
  color: #111827;
  line-height: 1.15;
  margin-bottom: 24px;
}
.about-left h1 .brand { color: #e53935; }
.about-left p {
  font-size: 15px;
  color: #374151;
  line-height: 1.8;
  margin-bottom: 20px;
}

.feature-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.feat-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px 18px;
  opacity: 0;
}
.feat-card.animate-in {
  animation: fadeUp 0.6s cubic-bezier(0.22, 1, 0.36, 1) var(--feat-delay) forwards;
}
.feat-icon { color: #2563eb; margin-bottom: 10px; }
.feat-card h3 { font-size: 14px; font-weight: 700; color: #111827; margin-bottom: 6px; }
.feat-card p  { font-size: 12.5px; color: #6b7280; line-height: 1.6; }

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
  background: rgba(37, 99, 235, 0.08);
  border: 1px solid rgba(37, 99, 235, 0.2);
  border-radius: 999px;
  padding: 7px 16px;
  font-size: 13px;
  font-weight: 500;
  color: #2563eb;
  margin-bottom: 16px;
}
.badge-icon { color: #2563eb; }
.stories-head h2 {
  font-size: 32px;
  font-weight: 800;
  color: #111827;
  margin-bottom: 10px;
}
.stories-head p {
  font-size: 14px;
  color: #6b7280;
  max-width: 520px;
  margin: 0 auto;
  line-height: 1.6;
}

/* ── Shared card styles ── */
.tcard {
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.08);
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
  background: #1d4ed8;
  border-color: #1d4ed8;
  transform: scale(1.04);
  z-index: 1;
  box-shadow: 0 20px 48px rgba(29, 78, 216, 0.28);
}

.stars { display: flex; gap: 3px; }

.quote {
  font-size: 13px;
  line-height: 1.7;
  color: #6b7280;
  flex: 1;
}
.featured .quote { color: rgba(191, 219, 254, 0.9); }

.tcard-footer {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-top: 14px;
  border-top: 1px solid rgba(0, 0, 0, 0.07);
}
.featured .tcard-footer { border-color: rgba(255, 255, 255, 0.2); }

.avatar-img {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  
}
.featured .avatar-img { outline: 2px solid rgba(255, 255, 255, 0.3); }

.author-info { display: flex; flex-direction: column; gap: 2px; }
.author-name { font-size: 13px; font-weight: 700; color: #111827; }
.author-role { font-size: 11px; color: #9ca3af; }
.featured .author-name { color: #ffffff; }
.featured .author-role { color: rgba(147, 197, 253, 0.85); }

.blood-tag {
  margin-left: auto;
  background: rgba(220, 38, 38, 0.08);
  color: #dc2626;
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
  border: 1px solid #d1d5db;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #374151;
  transition: background 0.2s, border-color 0.2s, color 0.2s;
}
.nav-btn:hover {
  background: #2563eb;
  border-color: #2563eb;
  color: #ffffff;
}
.dots { display: flex; align-items: center; gap: 6px; }
.dot {
  border: none;
  border-radius: 999px;
  background: rgba(107, 114, 128, 0.3);
  cursor: pointer;
  transition: all 0.25s ease;
  width: 8px;
  height: 8px;
  padding: 0;
}
.dot.active {
  width: 22px;
  height: 8px;
  background: #2563eb;
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