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

    <!-- ── Blood Service Facilities ── -->
    <div class="facilities-wrap" ref="facilitiesRef">
      <div class="section-inner">

        <div class="section-head" :class="{ 'animate-in': facilitiesVisible }">
          <div class="badge-pill">
            <AssetIcon name="heart" class="badge-icon" :size="16" />
            Be a Lifesaver Today
          </div>
          <h2>Blood Service Facilities</h2>
          <p>Blood service facilities in Davao City. Contact them directly to donate blood or request blood supply.</p>
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
          <NuxtLink to="/auth/role-selection" class="btn-primary">
            Register Now <AssetIcon name="arrow-right" :size="16" />
          </NuxtLink>
          <NuxtLink to="/auth/donor/login" class="btn-outline">
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
import { ref, onMounted, onUnmounted } from 'vue'
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

const facilities = [
  { name:'Southern Philippines Medical Center', address:'J.P. Laurel Ave, Bajada, Davao City', phone:'(082) 227-2731', hours:'Mon – Fri, 8:00 AM – 5:00 PM' },
  { name:'Sub-National Blood Center', address:'J.P. Laurel Avenue, Bajada, Davao City', phone:'(082) 221-6900', hours:'Mon – Fri, 8:00 AM – 3:00 PM' },
  { name:'Philippine Red Cross – Davao Chapter', address:'Quirino Ave, Davao City', phone:'(082) 226-2661', hours:'Mon – Sun, 8:00 AM – 5:00 PM' },
]
const stats = [
  { value:'3', label:'User Portals' },
  { value:'24/7', label:'Online Access' },
  { value:'3 Mos', label:'Between Donations' },
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
  font-family: var(--rb-font-sans);
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
  max-width: 1280px;
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
  background: var(--lp-surface);
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
  color: var(--lp-text);
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
  color: var(--lp-muted);
  line-height: 1.45;
}
.facility-icon { color: var(--lp-accent-text); margin-top: 1px; }

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
  background: var(--lp-on-accent);
  color: var(--lp-accent);
  font-size: 14px;
  font-weight: 700;
  padding: 14px 32px;
  border-radius: 10px;
  text-decoration: none;
  box-shadow: 0 8px 24px rgba(15,23,42,0.25);
  transition: background 0.2s, transform 0.15s, box-shadow 0.2s;
}
.btn-primary:hover {
  background: #fff;
  transform: translateY(-2px);
  box-shadow: 0 12px 30px rgba(15,23,42,0.32);
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
  .section-head    { margin-bottom: 32px; }
  .section-head h2 { font-size: 28px; }
  .badge-pill      { font-size: 12px; padding: 6px 14px; margin-bottom: 16px; }
  .facilities-grid { gap: 14px; }
  .facility-card   { padding: 18px 18px 20px; }
  .facility-card h3 { font-size: 15px; margin-bottom: 12px; }
  .facility-details { gap: 8px; }
  .cta-wrap       { padding: 60px 1.25rem 72px; }
  .cta-heading     { font-size: 28px; }
  .cta-buttons     { flex-direction: column; width: 100%; }
  .btn-primary, .btn-outline { justify-content: center; width: 100%; }
  .stats-row       { width: 100%; }
  .stat-item       { flex: 1; min-width: 0; padding: 6px 8px; }
  .stat-value      { font-size: 22px; }
  .stat-label      { font-size: 10.5px; line-height: 1.3; }
  .float-icon      { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .section-head, .facility-card, .cta-inner { opacity: 1; animation: none; }
  .float-icon { animation: none; }
}
</style>
