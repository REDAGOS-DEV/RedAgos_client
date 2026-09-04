<template>
  <section id="home" class="hero">
    <div class="hero-bg"></div>
    <div class="hero-overlay"></div>

    <div class="hero-content">
      <!-- Left -->
      <div class="hero-left" :class="{ 'animate-in': mounted }">
        <div class="live-badge">
          <span class="live-dot"></span>
          Live &nbsp;·&nbsp; Davao City's Blood Bank Network
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
          <NuxtLink to="/auth/role-selection" class="btn-primary">Register Now →</NuxtLink>
          <button class="btn-secondary" @click="navigateTo('/auth/donor/login')">Sign In</button>
        </div>
      </div>

      <!-- blood-bank photo -->
      <div class="hero-right" :class="{ 'animate-in': mounted }">
        <div class="visual-scene">
          <img
            :src="heroImage"
            alt="Refrigerated blood bags labeled and stored in a blood bank facility"
            class="visual-photo"
            loading="eager"
            width="620"
            height="480"
          />

          <!-- Blood Available -->
          <div class="fcard fcard-blood">
            <div class="fcard-row">
              <div class="fcard-icon-wrap fcard-icon-blue">
                <AssetIcon name="activity" class="fcard-icon-blue-svg" :size="20" />
              </div>
              <div>
                <div class="fcard-label">Blood Available</div>
                <div class="fcard-value-row">
                  <span class="fcard-value">247 Units</span>
                  <span class="green-dot"></span>
                </div>
              </div>
            </div>
          </div>

          <!-- Request Fulfilled -->
          <div class="fcard fcard-fulfilled">
            <div class="fcard-row">
              <div class="fcard-icon-wrap fcard-icon-green">
                <AssetIcon name="shield" class="fcard-icon-green-svg" :size="20" />
              </div>
              <div class="fcard-fulfilled-body">
                <div class="fcard-label">Request Fulfilled</div>
                <div class="fcard-value">98.5%</div>
                <div class="progress-track">
                  <div class="progress-fill"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Active Donors -->
          <div class="fcard fcard-donors">
            <div class="fcard-row">
              <div class="fcard-icon-wrap fcard-icon-red">
                <AssetIcon name="users" class="fcard-icon-red-svg" :size="20" />
              </div>
              <div>
                <div class="fcard-label">Active Donors</div>
                <div class="fcard-value">1,240+</div>
                <div class="avatar-stack" aria-hidden="true">
                  <img
                    v-for="donor in donorAvatars"
                    :key="donor.id"
                    :src="donor.img"
                    :alt="donor.name"
                    class="avatar"
                    loading="lazy"
                  />
                  <span class="avatar avatar-more">+</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Real-time Alerts -->
          <div class="fcard fcard-alert">
            <div class="fcard-alert-title">
              <AssetIcon name="bolt-fill" :size="16" />
              Real-time Alerts
            </div>
            <ul class="alert-list">
              <li>
                <span class="alert-dot alert-dot-red"></span>
                <span class="alert-text">Low Stock: O&minus;</span>
                <span class="alert-value alert-value-red">5 Units Left</span>
              </li>
              <li>
                <span class="alert-dot alert-dot-gold"></span>
                <span class="alert-text">Expiring Soon</span>
                <span class="alert-value">12 Units</span>
              </li>
              <li>
                <span class="alert-dot alert-dot-blue"></span>
                <span class="alert-text">New Request</span>
                <span class="alert-value">SPMC Blood Bank</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- Stats bar -->
    <div class="stats-bar" :class="{ 'animate-in': mounted }">
      <div class="stat">
        <div class="stat-icon">
          <AssetIcon name="map-pin-simple" :size="22" />
        </div>
        <div class="stat-text">
          <div class="stat-num">100+</div>
          <div class="stat-label">Units Needed Daily</div>
        </div>
      </div>
      <div class="stat">
        <div class="stat-icon">
          <AssetIcon name="activity" :size="22" />
        </div>
        <div class="stat-text">
          <div class="stat-num">24/7</div>
          <div class="stat-label">Live Monitoring</div>
        </div>
      </div>
      <div class="stat">
        <div class="stat-icon">
          <AssetIcon name="shield" :size="22" />
        </div>
        <div class="stat-text">
          <div class="stat-num">98.5%</div>
          <div class="stat-label">Fulfillment Rate</div>
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

// Active-donors avatar stack. Swap `img` for real donor photos once you
// have them — either local assets:
//   import donor1 from '~/assets/images/donors/donor-1.jpg'
// or URLs coming back from `donorService`/`hospitalService` (whichever
// endpoint eventually returns recent/featured donors). Keep it at 4
// entries so it matches the "+" overflow chip after it.
const donorAvatars = ref([
  { id: 1, name: 'Donor 1', img: 'https://randomuser.me/api/portraits/men/32.jpg' },
  { id: 2, name: 'Donor 2', img: 'https://randomuser.me/api/portraits/women/44.jpg' },
  { id: 3, name: 'Donor 3', img: 'https://randomuser.me/api/portraits/men/65.jpg' },
  { id: 4, name: 'Donor 4', img: 'https://randomuser.me/api/portraits/women/68.jpg' },
])

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
@keyframes liveGlow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.5); }
  50%       { box-shadow: 0 0 0 5px rgba(34, 197, 94, 0); }
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

.live-dot    { animation: liveGlow   1.8s  ease-in-out infinite; }

/* ── HERO ── */
.hero {
  min-height: 100vh;
  padding-top: 60px;
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  overflow: hidden;
  background: #f8faff;
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
.hero-content {
  position: relative; z-index: 2;
  display: flex; align-items: center; gap: 3rem;
  padding: 80px 3rem 40px;
  max-width: 1200px; margin: 0 auto; width: 100%;
}
.hero-left { flex: 1; max-width: 480px; min-width: 0; }

/* ── LEFT COLUMN — unchanged: badge, heading, description, CTA ── */
.live-badge {
  display: inline-flex; align-items: center; gap: 8px;
  background: rgba(255,255,255,0.9); border: 1px solid #e5e7eb;
  border-radius: 20px; padding: 5px 14px; font-size: 12px;
  font-weight: 500; color: #374151; margin-bottom: 24px;
}
.live-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: #22c55e; display: inline-block; flex-shrink: 0;
}

.hero-title {
  font-size: 52px; font-weight: 800; line-height: 1.08;
  color: #111; margin-bottom: 18px;
}

.accent{
 position:relative;
 display:inline-block;
 color:#2563eb;
}

.accent::after{
 content:'';
 position:absolute;
 left:0;
 width:100%;
 bottom:-8px;
 height:12px;
 border-bottom:4px solid #e32636;
 border-radius:50%;

 transform:rotate(-2deg);

}

.hero-desc { font-size: 15px; color: #4b5563; line-height: 1.75; margin-bottom: 32px; }
.hero-desc strong { font-weight: 600; color: #111; }

.hero-btns { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.btn-primary {
  background: #2563eb; color: #fff; font-size: 14px; font-weight: 600;
  padding: 12px 24px; border-radius: 8px; border: none; cursor: pointer;
  text-decoration: none; display: inline-block;
  transition: background 0.2s, transform 0.15s, box-shadow 0.2s;
}
.btn-primary:hover { background: #1d4ed8; transform: translateY(-2px); box-shadow: 0 6px 20px rgba(37,99,235,0.3); }
.btn-secondary {
  background: #fff; color: #374151; font-size: 14px; font-weight: 500;
  padding: 11px 20px; border-radius: 8px; border: 1px solid #d1d5db; cursor: pointer;
  transition: background 0.2s, border-color 0.2s, transform 0.15s;
}
.btn-secondary:hover { background: #f9fafb; border-color: #2563eb; color: #2563eb; transform: translateY(-1px); }

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
  background: rgba(255, 255, 255, 0.97);
  border: 1px solid #e5e7eb;
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
.fcard-icon-red   { background: rgba(227, 38, 54, 0.10); }
.fcard-icon-blue-svg  { color: #2563eb; }
.fcard-icon-green-svg { color: #16a34a; }
.fcard-icon-red-svg   { color: #e32636; }

.fcard-label {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: #9ca3af;
  margin-bottom: 3px;
}
.fcard-value {
  font-size: 17px; font-weight: 700; color: #111;
}
.fcard-value-row {
  display: flex; align-items: center; gap: 6px;
}
.green-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: #22c55e; flex-shrink: 0;
}

/* Blood Available — top right, over the photo */
.fcard-blood {
  top: 10px; right: -30px; min-width: 165px;
  animation-duration: 4.6s;
  animation-delay: 0s;
}

/* Request Fulfilled */
.fcard-fulfilled {
  top: 150px; left: -90px; min-width: 165px;
  animation-duration: 5.2s;
  animation-delay: 0.6s;
}
.fcard-fulfilled-body { min-width: 0; }
.progress-track { height: 4px; border-radius: 2px; background: #e5e7eb; margin-top: 7px; overflow: hidden; }
.progress-fill { width: 98.5%; height: 100%; background: #22c55e; border-radius: 2px; }

/* Active Donors */
.fcard-donors {
  bottom: -32px; left: 30px; min-width: 170px;
  animation-duration: 4.2s;
  animation-delay: 1.1s;
}
.avatar-stack { display: flex; align-items: center; margin-top: 8px; }
.avatar {
  width: 22px; height: 22px; border-radius: 50%;
  border: 2px solid #fff;
  margin-left: -8px;
  flex-shrink: 0;
  object-fit: cover;
  background: #e5e7eb; /* shows while the photo loads */
  display: block;
}
.avatar:first-child { margin-left: 0; }
.avatar-more {
  background: #2563eb; color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 700;
}

/* Real-time AlertS */
.fcard-alert {
  bottom: 20px;
  right: -40px;
  min-width: 200px;
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
.alert-list { list-style: none; display: flex; flex-direction: column; gap: 9px; }
.alert-list li { display: flex; align-items: center; gap: 8px; font-size: 11.5px; }
.alert-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.alert-dot-red  { background: #f87171; }
.alert-dot-gold { background: #f4c430; }
.alert-dot-blue { background: #60a5fa; }
.alert-text { color: #cbd5e1; flex: 1; }
.alert-value { color: #e2e8f0; font-weight: 600; white-space: nowrap; }
.alert-value-red { color: #f87171; }
.stats-bar {
  position: relative; z-index: 2;
  display: flex; max-width: 1200px;
  margin: 0 auto; padding: 0 3rem 3rem;
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
.stat + .stat { padding-left: 2rem; border-left: 1px solid #e5e7eb; }
.stat-icon  { color: #9ca3af; flex-shrink: 0; display: flex; }
.stat-text  { min-width: 0; }
.stat-num   { font-size: 34px; font-weight: 800; color: #111; line-height: 1; }
.stat-label { font-size: 13px; color: #9ca3af; margin-top: 4px; white-space: nowrap; }

/* ── RESPONSIVE ── */
@media (max-width: 1150px) {
  .hero-content { flex-direction: column; padding: 60px 1.5rem 20px; }
  .hero-left { max-width: 100%; }
  .hero-title   { font-size: 38px; }
  .hero-right   { width: 100%; }
  .visual-scene { width: 420px; margin: 0 auto; }
  .visual-photo { height: 360px; }
  .stats-bar    { padding: 0 1.5rem 2rem; }
}

@media (max-width: 900px) {
  .fcard-blood     { top: -12px; right: 0; }
  .fcard-fulfilled { left: 0; top: 160px; }
  .fcard-donors    { left: 16px; bottom: -24px; }
  .fcard-alert     { right: 0; bottom: -16px; }
}

@media (max-width: 600px) {
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
  .live-dot { animation: none; }
  .hero-left, .hero-right, .stats-bar { opacity: 1; animation: none; }
  .fcard { animation: none; }
}
</style>