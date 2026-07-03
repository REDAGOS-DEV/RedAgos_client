<template>
<section id="contact" class="contact" ref="sectionRef">
  <div class="contact-page" ref="pageRef">
    <div class="float-icon float-icon--tl">
      <AssetIcon name="settings" :size="22" />
    </div>
    <div class="float-icon float-icon--tr">
      <AssetIcon name="activity" :size="22" />
    </div>
    <div class="float-icon float-icon--bl">
      <AssetIcon name="users" :size="22" />
    </div>

    <!-- ── Partner Facilities ── -->
    <div class="facilities-wrap" ref="facilitiesRef">
      <div class="section-inner">

        <div class="section-head" :class="{ 'animate-in': facilitiesVisible }">
          <div class="badge-pill">
            <AssetIcon name="heart" class="badge-icon" :size="16" />
            Be a Lifesaver Today
          </div>
          <h2>Partner Facilities</h2>
          <p>Visit any of our partner facilities to donate blood or request blood supply.</p>
        </div>

        <div class="facilities-grid">
          <div
            v-for="(facility, i) in facilities"
            :key="facility.name"
            class="facility-card"
            :class="{ 'animate-in': facilitiesVisible }"
            :style="{ '--card-delay': `${0.15 + i * 0.12}s` }"
          >
            <h3>{{ facility.name }}</h3>
            <ul class="facility-details">
              <li><AssetIcon name="map-pin" class="facility-icon" :size="16" /><span>{{ facility.address }}</span></li>
              <li><AssetIcon name="phone" class="facility-icon" :size="16" /><span>{{ facility.phone }}</span></li>
              <li><AssetIcon name="clock" class="facility-icon" :size="16" /><span>{{ facility.hours }}</span></li>
            </ul>
          </div>
        </div>

      </div>
    </div>

    <!-- ── CTA + Stats ── -->
    <div class="cta-wrap" ref="ctaRef">
      <div class="cta-inner" :class="{ 'animate-in': ctaVisible }">
        <h2 class="cta-heading">
          Ready to Make a<br />
          <span class="cta-heading-accent">Real Difference?</span>
        </h2>
        <p class="cta-sub">
          Join RedAgos and become part of Davao City's modern blood service network.
          Every registration counts, every donation matters.
        </p>

        <div class="cta-buttons">
          <NuxtLink to="/register" class="btn-primary">
            Register Now <AssetIcon name="arrow-right" :size="16" />
          </NuxtLink>
          <NuxtLink to="/login" class="btn-outline">
            Sign In
          </NuxtLink>
        </div>

        <div class="stats-row">
          <div v-for="stat in stats" :key="stat.label" class="stat-item">
            <div class="stat-value">{{ stat.value }}</div>
            <div class="stat-label">{{ stat.label }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
  </section>
</template>

<script setup>
import { ref, onMounted, onUnmounted, defineComponent, h } from 'vue'
import AssetIcon from '~/components/common/AssetIcon.vue'

const pageRef           = ref(null)
const facilitiesRef     = ref(null)
const ctaRef            = ref(null)
const facilitiesVisible = ref(false)
const ctaVisible        = ref(false)
let obs1, obs2

onMounted(() => {
  const opts = { threshold: 0.1 }
  obs1 = new IntersectionObserver(([e]) => { if (e.isIntersecting) facilitiesVisible.value = true }, opts)
  obs2 = new IntersectionObserver(([e]) => { if (e.isIntersecting) ctaVisible.value = true }, opts)
  if (facilitiesRef.value) obs1.observe(facilitiesRef.value)
  if (ctaRef.value)        obs2.observe(ctaRef.value)
})
onUnmounted(() => { obs1?.disconnect(); obs2?.disconnect() })

// ── Icons ──
const mk = (children) => defineComponent({ setup: () => () => h('svg', {
  viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
  width: '16', height: '16',
}, children) })

const IconHeart    = mk([h('path', { d: 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z' })])
const IconMapPin   = mk([h('path', { d: 'M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z' }), h('circle', { cx:'12', cy:'10', r:'3' })])
const IconPhone    = mk([h('path', { d: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.13 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.04 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z' })])
const IconClock    = mk([h('circle', { cx:'12', cy:'12', r:'10' }), h('path', { d:'M12 6v6l4 2' })])
const IconArrowRight = defineComponent({ setup: () => () => h('svg', {
  viewBox:'0 0 24 24', fill:'none', stroke:'currentColor',
  'stroke-width':'2','stroke-linecap':'round','stroke-linejoin':'round',
  width:'15', height:'15',
}, [h('line',{x1:'5',y1:'12',x2:'19',y2:'12'}), h('polyline',{points:'12 5 19 12 12 19'})])})

// Decorative floating icons
const mkLg = (children) => defineComponent({ setup: () => () => h('svg', {
  viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  'stroke-width': '1.75', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
  width: '22', height: '22',
}, children) })

const IconSettings = mkLg([
  h('circle', { cx:'12', cy:'12', r:'3' }),
  h('path', { d:'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z' }),
])
const IconActivity = mkLg([h('polyline', { points:'22 12 18 12 15 21 9 3 6 12 2 12' })])
const IconUsers    = mkLg([
  h('path', { d:'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' }),
  h('circle', { cx:'9', cy:'7', r:'4' }),
  h('path', { d:'M23 21v-2a4 4 0 0 0-3-3.87' }),
  h('path', { d:'M16 3.13a4 4 0 0 1 0 7.75' }),
])

const facilities = [
  { name:'Southern Philippines Medical Center', address:'J.P. Laurel Ave, Bajada, Davao City', phone:'(082) 227-2731', hours:'Mon – Fri, 8:00 AM – 5:00 PM' },
  { name:'Sub-National Blood Center', address:'J.P. Laurel Avenue, Bajada, Davao City', phone:'(082) 221-6900', hours:'Mon – Fri, 8:00 AM – 3:00 PM' },
  { name:'Philippine Red Cross – Davao Chapter', address:'Quirino Ave, Davao City', phone:'(082) 226-2661', hours:'Mon – Sun, 8:00 AM – 5:00 PM' },
]
const stats = [
  { value:'100+', label:'Units Needed Daily' },
  { value:'24/7', label:'Live Monitoring' },
  { value:'98.5%', label:'Fulfillment Rate' },
]
</script>

<style scoped>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(28px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes floatBob {
  0%, 100% { transform: translateY(0); }
  50%       { transform: translateY(-8px); }
}

/* ── Single unified page background ── */
.contact-page {
  font-family: 'Inter', 'Segoe UI', sans-serif;
  position: relative;
  overflow: hidden;
  /* ONE background for both sections */
  background: #1e4db7;
  background-image:
    radial-gradient(ellipse 55% 70% at 5% 30%,  #0d2472 0%, transparent 55%),
    radial-gradient(ellipse 55% 70% at 95% 30%, #1641a8 0%, transparent 55%),
    radial-gradient(ellipse 70% 50% at 50% 85%, #0f1f6e 0%, transparent 55%),
    radial-gradient(ellipse 40% 40% at 80% 75%, #3a5fd4 0%, transparent 50%);
}

/* ── Floating icons ── */
.float-icon {
  position: absolute;
  width: 52px;
  height: 52px;
  border-radius: 14px;
  background: rgba(255,255,255,0.13);
  border: 1px solid rgba(255,255,255,0.22);
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255,255,255,0.9);
  animation: floatBob 4s ease-in-out infinite;
  z-index: 2;
}
.float-icon--tl { top: 52px;    left: 52px;  animation-delay: 0s; }
.float-icon--tr { top: 48px;    right: 52px; animation-delay: 1.4s; }
.float-icon--bl { bottom: 52px; left: 52px;  animation-delay: 0.8s; }

/* ── Shared inner ── */
.section-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2.5rem;
}

/* ── Facilities block ── */
.facilities-wrap {
  padding: 90px 0 80px;
  position: relative;
  z-index: 1;
}

.section-head {
  text-align: center;
  margin-bottom: 56px;
  opacity: 0;
}
.section-head.animate-in {
  animation: fadeUp 0.65s cubic-bezier(0.22,1,0.36,1) forwards;
}

.badge-pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  background: rgba(255,255,255,0.14);
  border: 1px solid rgba(255,255,255,0.26);
  border-radius: 999px;
  padding: 8px 20px;
  font-size: 13px;
  font-weight: 500;
  color: #fff;
  margin-bottom: 22px;
}
.badge-icon { color: #fff; }

.section-head h2 {
  font-size: 40px;
  font-weight: 800;
  color: #fff;
  letter-spacing: -0.5px;
  margin-bottom: 12px;
}
.section-head p {
  font-size: 14.5px;
  color: rgba(255,255,255,0.72);
  max-width: 480px;
  margin: 0 auto;
  line-height: 1.65;
}

/* ── Cards grid ── */
.facilities-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 22px;
}

.facility-card {
  background: #fff;
  border-radius: 14px;
  padding: 28px 24px 30px;
  opacity: 0;
  box-shadow: 0 2px 8px rgba(0,0,0,0.10), 0 12px 32px rgba(0,0,0,0.12);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.facility-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.12), 0 20px 40px rgba(0,0,0,0.16);
}
.facility-card.animate-in {
  animation: fadeUp 0.6s cubic-bezier(0.22,1,0.36,1) var(--card-delay,0s) both;
}
.facility-card h3 {
  font-size: 15.5px;
  font-weight: 700;
  color: #111827;
  margin-bottom: 20px;
  line-height: 1.35;
}

.facility-details {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.facility-details li {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 13px;
  color: #6b7280;
  line-height: 1.45;
}
.facility-icon { color: #2563eb; margin-top: 1px; }

/* ── CTA block ── */
.cta-wrap {
  padding: 80px 2.5rem 96px;
  text-align: center;
  position: relative;
  z-index: 1;
}

.cta-inner {
  max-width: 780px;
  margin: 0 auto;
  opacity: 0;
}
.cta-inner.animate-in {
  animation: fadeUp 0.65s cubic-bezier(0.22,1,0.36,1) forwards;
}

.cta-heading {
  font-size: 54px;
  font-weight: 800;
  color: #fff;
  line-height: 1.15;
  letter-spacing: -1px;
  margin-bottom: 22px;
}
.cta-heading-accent { color: rgba(147,197,253,0.92); }

.cta-sub {
  font-size: 14.5px;
  color: rgba(255,255,255,0.68);
  max-width: 580px;
  margin: 0 auto 44px;
  line-height: 1.78;
}

.cta-buttons {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  margin-bottom: 68px;
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #e53935;
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  padding: 14px 32px;
  border-radius: 10px;
  text-decoration: none;
  box-shadow: 0 8px 24px rgba(229,57,53,0.38);
  transition: background 0.2s, transform 0.15s, box-shadow 0.2s;
}
.btn-primary:hover {
  background: #c62828;
  transform: translateY(-2px);
  box-shadow: 0 12px 30px rgba(229,57,53,0.45);
}

.btn-outline {
  display: inline-flex;
  align-items: center;
  background: transparent;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  padding: 13px 32px;
  border-radius: 10px;
  border: 1.5px solid rgba(255,255,255,0.48);
  text-decoration: none;
  transition: background 0.2s, border-color 0.2s;
}
.btn-outline:hover {
  background: rgba(255,255,255,0.09);
  border-color: rgba(255,255,255,0.8);
}

/* ── Stats ── */
.stats-row {
  display: flex;
  justify-content: center;
}
.stat-item {
  padding: 10px 56px;
  text-align: center;
  border-left: 1px solid rgba(255,255,255,0.2);
}
.stat-item:first-child { border-left: none; }
.stat-value {
  font-size: 32px;
  font-weight: 800;
  color: #fff;
  line-height: 1.2;
  letter-spacing: -0.5px;
}
.stat-label {
  font-size: 12px;
  color: rgba(255,255,255,0.58);
  margin-top: 4px;
}

/* ── Responsive ── */
@media (max-width: 1024px) {
  .facilities-grid { grid-template-columns: 1fr; max-width: 520px; margin: 0 auto; }
  .cta-heading     { font-size: 42px; }
}
@media (max-width: 768px) {
  .section-head h2 { font-size: 30px; }
  .cta-heading     { font-size: 32px; }
  .stat-item       { padding: 10px 28px; }
  .float-icon--tl  { left: 20px; top: 20px; }
  .float-icon--tr  { right: 20px; top: 20px; }
  .float-icon--bl  { left: 20px; bottom: 20px; }
}
@media (max-width: 480px) {
  .facilities-wrap { padding: 56px 0 60px; }
  .section-inner   { padding: 0 1.25rem; }
  .cta-wrap        { padding: 60px 1.25rem 72px; }
  .cta-heading     { font-size: 28px; }
  .cta-buttons     { flex-direction: column; width: 100%; }
  .btn-primary, .btn-outline { justify-content: center; width: 100%; }
  .stats-row       { flex-direction: column; }
  .stat-item       { border-left: none; border-top: 1px solid rgba(255,255,255,0.15); padding: 16px 0; }
  .stat-item:first-child { border-top: none; }
  .float-icon      { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .section-head, .facility-card, .cta-inner { opacity: 1; animation: none; }
  .float-icon { animation: none; }
}
</style>
