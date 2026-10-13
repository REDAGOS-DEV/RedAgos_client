<template>
  <section id="home" class="hero">
    <div class="hero-bg"></div>
    <div class="hero-overlay"></div>

    <div class="hero-content">
      <!-- Left -->
      <div class="hero-left" :class="{ 'animate-in': mounted }">
        <div class="hero-badge">
          <span class="hero-badge-dot"></span>
          Davao City's Blood Bank Network
        </div>

        <h1 class="hero-title">
          Saving Lives<br/>
          Through<br/>
          <span class="accent">Smart Blood</span><br/>
          Services
        </h1>

        <p class="hero-desc">
          RedAgos is Davao City's integrated blood bank management
          platform — connecting <strong>donors</strong>,
          <strong>hospitals</strong>, and
          <strong>blood centers</strong> for faster, smarter, and
          life-saving blood services.
        </p>

        <div class="hero-btns">
          <button class="btn-primary" @click="navigateTo('/auth/role-selection/')">
            Get Started
          </button>
          <button class="btn-secondary" @click="navigateTo('/auth/donor/login')">Sign In</button>
        </div>
      </div>

      <!-- blood-bank photo -->
      <div class="hero-right" :class="{ 'animate-in': mounted }">
        <div class="visual-scene">
          <img
            :src="heroImage"
            alt="A blood donor giving blood while a health worker attends to them"
            class="visual-photo"
            loading="eager"
            width="620"
            height="480"
          />

          <!-- Floating cards show general donation facts only — no live
               inventory, request, or donor data (confidential). -->

          <!-- Impact -->
          <div class="fcard fcard-blood">
            <div class="fcard-row">
              <div class="fcard-icon-wrap fcard-icon-red">
                <AssetIcon name="heart" class="fcard-icon-red-svg" :size="20" />
              </div>
              <div>
                <div class="fcard-label">Every Donation</div>
                <div class="fcard-value">Saves up to 3 Lives</div>
              </div>
            </div>
          </div>

          <!-- Donation time -->
          <div class="fcard fcard-fulfilled">
            <div class="fcard-row">
              <div class="fcard-icon-wrap fcard-icon-green">
                <AssetIcon name="clock" class="fcard-icon-green-svg" :size="20" />
              </div>
              <div class="fcard-fulfilled-body">
                <div class="fcard-label">Donation Time</div>
                <div class="fcard-value">~10 Minutes</div>
                <div class="progress-track">
                  <div class="progress-fill"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Blood types -->
          <div class="fcard fcard-donors">
            <div class="fcard-row">
              <div class="fcard-icon-wrap fcard-icon-blue">
                <AssetIcon name="droplets" class="fcard-icon-blue-svg" :size="20" />
              </div>
              <div>
                <div class="fcard-label">All Blood Types</div>
                <div class="fcard-value">Are Needed</div>
                <div class="type-chips">
                  <span v-for="type in bloodTypes" :key="type" class="type-chip">{{ type }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Sample donor notification (feature showcase) -->
          <div class="fcard fcard-alert">
            <div class="fcard-alert-title">
              <AssetIcon name="bell" :size="16" />
              Your blood is on its way!
            </div>
            <p class="alert-body">
              Your donation was matched to a patient in need.
            </p>
            <div class="alert-meta">
              <span class="alert-dot alert-dot-red"></span>
              RedAgos Notification
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Stats bar -->
    <div class="stats-bar" :class="{ 'animate-in': mounted }">
      <div class="stat">
        <div class="stat-icon">
          <AssetIcon name="users" :size="22" />
        </div>
        <div class="stat-text">
          <div class="stat-num">3</div>
          <div class="stat-label">User Portals</div>
        </div>
      </div>
      <div class="stat">
        <div class="stat-icon">
          <AssetIcon name="activity" :size="22" />
        </div>
        <div class="stat-text">
          <div class="stat-num">24/7</div>
          <div class="stat-label">Online Access</div>
        </div>
      </div>
      <div class="stat">
        <div class="stat-icon">
          <AssetIcon name="calendar-check" :size="22" />
        </div>
        <div class="stat-text">
          <div class="stat-num">3 Mos</div>
          <div class="stat-label">Between Donations</div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import AssetIcon from '~/components/common/AssetIcon.vue'

const mounted = ref(false)
const heroImage = ref(
  'https://images.unsplash.com/photo-1615461066841-6116e61058f4?w=900&q=70'
)

const bloodTypes = ['A+', 'B+', 'O+', 'AB+']

onMounted(() => {
  setTimeout(() => { mounted.value = true }, 80)
})
</script>

<style scoped>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

/* ── KEYFRAMES ── */
@keyframes fadeSlideUp {
  from { opacity: 0; transform: translateY(32px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes fadeSlideRight {
  from { opacity: 0; transform: translateX(40px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes statSlideUp {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
/* gentle floating bob for the dashboard cards */
@keyframes cardFloat {
  0%, 100% { transform: translateY(0); }
  50%       { transform: translateY(-10px); }
}

/* ── ENTER ANIMATIONS ── */
.hero-left  { opacity: 0; }
.hero-right { opacity: 0; }
.stats-bar  { opacity: 0; }

.hero-left.animate-in  { animation: fadeSlideUp   0.75s cubic-bezier(0.22, 1, 0.36, 1) 0.1s forwards; }
.hero-right.animate-in { animation: fadeSlideRight 0.85s cubic-bezier(0.22, 1, 0.36, 1) 0.3s forwards; }
.stats-bar.animate-in  { animation: statSlideUp    0.6s  ease                           0.7s forwards; }


/* ── HERO ── */
.hero {
  min-height: 100vh;
  padding-top: 60px;
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  overflow: hidden;
  background: var(--lp-bg);
}
.hero-bg {
  position: absolute; inset: 0;
  background: url('https://images.unsplash.com/photo-1615461066841-6116e61058f4?w=1400&q=60') center / cover no-repeat;
  opacity: 0.12; z-index: 0;
}
.hero-overlay {
  position: absolute; inset: 0;
  background: linear-gradient(135deg, rgba(219,234,254,0.55) 0%, rgba(255,255,255,0.35) 40%, rgba(254,226,226,0.45) 100%);
  z-index: 1;
}
/* The light wash above would grey out the dark page background */
:global(.dark) .hero-overlay {
  background: linear-gradient(135deg, rgba(37,99,235,0.14) 0%, rgba(11,18,32,0.4) 40%, rgba(211,47,47,0.10) 100%);
}
.hero-content {
  position: relative; z-index: 2;
  display: flex; align-items: center; gap: 3rem;
  padding: 80px 2.5rem 40px;
  max-width: 1280px; margin: 0 auto; width: 100%;
}
.hero-left { flex: 1; max-width: 480px; min-width: 0; }

/* ── LEFT COLUMN — unchanged: badge, heading, description, CTA ── */
.hero-badge {
  display: inline-flex; align-items: center; gap: 8px;
  background: var(--lp-surface); border: 1px solid var(--lp-border);
  border-radius: 20px; padding: 5px 14px; font-size: 12px;
  font-weight: 500; color: var(--lp-text-2); margin-bottom: 24px;
}
.hero-badge-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--lp-brand); display: inline-block; flex-shrink: 0;
}

.hero-title {
  font-size: 52px; font-weight: 800; line-height: 1.08;
  color: var(--lp-text); margin-bottom: 18px;
}

.accent{
 position:relative;
 display:inline-block;
 color:var(--lp-accent-text);
}

.accent::after{
 content:'';
 position:absolute;
 left:0;
 width:100%;
 bottom:-8px;
 height:12px;
 border-bottom:4px solid var(--lp-brand);
 border-radius:50%;

 transform:rotate(-2deg);

}

.hero-desc { font-size: 15px; color: var(--lp-text-2); line-height: 1.75; margin-bottom: 32px; }
.hero-desc strong { font-weight: 600; color: var(--lp-text); }

.hero-btns { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.btn-primary {
  background: var(--lp-accent); color: #fff; font-size: 14px; font-weight: 600;
  padding: 12px 24px; border-radius: 8px; border: none; cursor: pointer;
  text-decoration: none; display: inline-block;
  transition: background 0.2s, transform 0.15s, box-shadow 0.2s;
}
.btn-primary:hover { background: var(--lp-accent-hover); transform: translateY(-2px); box-shadow: 0 6px 20px rgba(37,99,235,0.3); }
.btn-secondary {
  background: var(--lp-surface); color: var(--lp-text-2); font-size: 14px; font-weight: 500;
  padding: 11px 20px; border-radius: 8px; border: 1px solid var(--lp-border); cursor: pointer;
  transition: background 0.2s, border-color 0.2s, transform 0.15s;
}
.btn-secondary:hover { background: var(--lp-bg); border-color: var(--lp-accent); color: var(--lp-accent-text); transform: translateY(-1px); }

/* ── RIGHT: PHOTO + DASHBOARD CARDS ── */
.hero-right {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
}
.visual-scene {
  position: relative;
  width: 500px;
  max-width: 100%;
  flex-shrink: 0;
}
.visual-photo {
  width: 100%;
  height: 420px;
  object-fit: cover;
  display: block;
  border-radius: 18px;
  box-shadow: 0 20px 45px rgba(15, 23, 42, 0.18);
}

/* ── FLOATING CARDS ── */
.fcard {
  position: absolute;
  background: var(--lp-surface);
  border: 1px solid var(--lp-border);
  border-radius: 12px;
  padding: 10px 14px;
  backdrop-filter: blur(6px);
  min-width: 130px;
  transition: box-shadow 0.2s;
  box-shadow: 0 4px 16px rgba(0,0,0,0.07);
  animation: cardFloat 4.5s ease-in-out infinite;
}
.fcard:hover {
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.12);
  animation-play-state: paused;
  transform: translateY(-4px);
  transition: box-shadow 0.2s, transform 0.2s;
}

.fcard-row { display: flex; align-items: center; gap: 10px; }

/* Icon badge — enlarged so icons read clearly inside the chip */
.fcard-icon-wrap {
  width: 40px; height: 40px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.fcard-icon-blue  { background: rgba(37, 99, 235, 0.10); }
.fcard-icon-green { background: rgba(22, 163, 74, 0.10); }
.fcard-icon-red   { background: var(--lp-brand-soft); }
.fcard-icon-blue-svg  { color: var(--lp-accent-text); }
.fcard-icon-green-svg { color: #16a34a; }
.fcard-icon-red-svg   { color: var(--lp-brand); }

.fcard-label {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--lp-muted);
  margin-bottom: 3px;
}
.fcard-value {
  font-size: 17px; font-weight: 700; color: var(--lp-text);
}
/* Impact — top right, over the photo */
.fcard-blood {
  top: 10px; right: -30px; min-width: 165px;
  animation-duration: 4.6s;
  animation-delay: 0s;
}

/* Donation time */
.fcard-fulfilled {
  top: 150px; left: -90px; min-width: 165px;
  animation-duration: 5.2s;
  animation-delay: 0.6s;
}
.fcard-fulfilled-body { min-width: 0; }
.progress-track { height: 4px; border-radius: 2px; background: var(--lp-border); margin-top: 7px; overflow: hidden; }
.progress-fill { width: 25%; height: 100%; background: #22c55e; border-radius: 2px; }

/* Blood types */
.fcard-donors {
  bottom: -32px; left: 30px; min-width: 170px;
  animation-duration: 4.2s;
  animation-delay: 1.1s;
}
.type-chips { display: flex; gap: 4px; margin-top: 8px; }
.type-chip {
  font-size: 10px; font-weight: 700; color: var(--lp-brand);
  background: var(--lp-brand-soft);
  border-radius: 6px; padding: 2px 6px;
}

/* Sample donor notification */
.fcard-alert {
  bottom: 20px;
  right: -40px;
  min-width: 200px;
  max-width: 230px;
  background: #10192F;
  border-color: transparent;
  color: #fff;
  padding: 14px 16px;
  animation-duration: 5.6s;
  animation-delay: 0.3s;
}
.fcard-alert-title {
  display: flex; align-items: center; gap: 6px;
  font-size: 13px; font-weight: 700; color: #fff;
  margin-bottom: 10px;
}
.alert-body { font-size: 12px; line-height: 1.5; color: #cbd5e1; }
.alert-meta {
  display: flex; align-items: center; gap: 6px;
  margin-top: 10px; font-size: 10.5px; color: #94a3b8;
}
.alert-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.alert-dot-red  { background: #f87171; }
.stats-bar {
  position: relative; z-index: 2;
  display: flex; max-width: 1280px; width: 100%;
  margin: 0 auto; padding: 0 2.5rem 3rem;
  gap: 2rem;
}
.stat {
  flex: 1;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12px;
  padding-right: 2rem;
  min-width: 0;
}
.stat + .stat { padding-left: 2rem; border-left: 1px solid var(--lp-border); }
.stat-icon  { color: var(--lp-muted); flex-shrink: 0; display: flex; }
.stat-text  { min-width: 0; }
.stat-num   { font-size: 34px; font-weight: 800; color: var(--lp-text); line-height: 1; }
.stat-label { font-size: 13px; color: var(--lp-muted); margin-top: 4px; white-space: nowrap; }

/* ── RESPONSIVE ── */
@media (max-width: 1150px) {
  .hero-content { flex-direction: column; padding: 60px 2.5rem 20px; }
  .hero-left { max-width: 100%; }
  .hero-title   { font-size: 38px; }
  .hero-right   { width: 100%; }
  .visual-scene { width: 420px; margin: 0 auto; }
  .visual-photo { height: 360px; }
  .stats-bar    { padding: 0 2.5rem 2rem; }
}

@media (max-width: 900px) {
  .fcard-blood     { top: -12px; right: 0; }
  .fcard-fulfilled { left: 0; top: 160px; }
  .fcard-donors    { left: 16px; bottom: -24px; }
  .fcard-alert     { right: 0; bottom: -16px; }
}

@media (max-width: 600px) {
  .hero-content { padding-left: 1.25rem; padding-right: 1.25rem; }
  .hero-title { font-size: 30px; }
  .visual-scene { width: 320px; }
  .visual-photo { height: 280px; border-radius: 16px; }

  .fcard { padding: 8px 10px; min-width: 130px; }
  .fcard-value { font-size: 14px; }
  .fcard-icon-wrap { width: 32px; height: 32px; }
  .fcard-blood,
  .fcard-fulfilled,
  .fcard-donors,
  .fcard-alert {
    position: static;
    margin: 12px auto 0;
    width: 100%;
    max-width: 320px;
    min-width: 0;
  }

  .stats-bar {
    padding: 0 1.25rem 2rem;
    gap: 0.75rem;
  }
  .stat {
    padding-right: 0.75rem;
    gap: 8px;
  }
  .stat + .stat { padding-left: 0.75rem; }
  .stat-num   { font-size: 19px; }
  .stat-label { font-size: 10px; white-space: normal; line-height: 1.25; }
}

@media (prefers-reduced-motion: reduce) {
  .hero-left, .hero-right, .stats-bar { opacity: 1; animation: none; }
  .fcard { animation: none; }
}
</style>