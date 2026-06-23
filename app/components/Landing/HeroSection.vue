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
          <NuxtLink to="/signup" class="btn-primary">Register Now →</NuxtLink>
          <button class="btn-secondary" @click="navigateTo('/login')">Sign In</button>
        </div>
      </div>

      <!-- Right: Ring Visual -->
      <div class="hero-right" :class="{ 'animate-in': mounted }">
        <div class="ring-scene">

          <!-- TOP-CENTER-RIGHT: Real-time Alerts -->
          <div class="fcard fcard-alert float-anim">
            <AssetIcon name="bolt-fill" :size="14" />
            Real-time Alerts
          </div>

          <!-- TOP-RIGHT: Blood Available -->
          <div class="fcard fcard-blood float-anim" style="animation-delay: 0.4s">
            <div class="fcard-row">
              <div class="fcard-icon-wrap fcard-icon-blue">
                <AssetIcon name="activity" class="fcard-icon-blue-svg" :size="15" />
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

          <!-- Ring -->
          <div class="ring-wrap">
            <div class="ring ring-1 spin-cw"></div>
            <div class="ring ring-2 spin-ccw"></div>
            <div class="ring ring-3"></div>
            <div class="heart-center pulse-heart">
              <AssetIcon name="heart-fill" :size="44" />
            </div>
            <!-- 6 orbit dots -->
            <span class="dot dot-blue  orbit-dot" style="top: -5px;  left: 175px;"></span>
            <span class="dot dot-red   orbit-dot" style="top: 100px; left: 350px; animation-delay: 1.5s"></span>
            <span class="dot dot-blue  orbit-dot" style="top: 200px; left: 260px; animation-delay: 1.0s"></span>
            <span class="dot dot-blue  orbit-dot" style="top: 330px; left: 275px; animation-delay: 1.5s"></span>
            <span class="dot dot-red   orbit-dot" style="top: 295px; left: 40px;  animation-delay: 0.8s"></span>
            <span class="dot dot-green orbit-dot" style="top: 110px; left: 5px;   animation-delay: 1.8s"></span>
          </div>

          <!-- LEFT: Request Fulfilled -->
          <div class="fcard fcard-fulfilled float-anim" style="animation-delay: 0.8s">
            <div class="fcard-row">
              <div class="fcard-icon-wrap fcard-icon-green">
                <AssetIcon name="shield" class="fcard-icon-green-svg" :size="15" />
              </div>
              <div>
                <div class="fcard-label">Request Fulfilled</div>
                <div class="fcard-value">98.5%</div>
              </div>
            </div>
          </div>

          <!-- BOTTOM-RIGHT: Active Donors -->
          <div class="fcard fcard-donors float-anim" style="animation-delay: 1.2s">
            <div class="fcard-row">
              <div class="fcard-icon-wrap fcard-icon-red">
                <AssetIcon name="users" class="fcard-icon-red-svg" :size="15" />
              </div>
              <div>
                <div class="fcard-label">Active Donors</div>
                <div class="fcard-value">1,240+</div>
              </div>
            </div>
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
        <div class="stat-num">100+</div>
        <div class="stat-label">Units Needed Daily</div>
      </div>
      <div class="stat">
        <div class="stat-icon">
          <AssetIcon name="activity" :size="22" />
        </div>
        <div class="stat-num">24/7</div>
        <div class="stat-label">Live Monitoring</div>
      </div>
      <div class="stat">
        <div class="stat-icon">
          <AssetIcon name="shield" :size="22" />
        </div>
        <div class="stat-num">98.5%</div>
        <div class="stat-label">Fulfillment Rate</div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import AssetIcon from '~/components/common/AssetIcon.vue'

const mounted = ref(false)

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
@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50%       { transform: translateY(-10px); }
}
@keyframes spinCW {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
@keyframes spinCCW {
  from { transform: rotate(0deg); }
  to   { transform: rotate(-360deg); }
}
@keyframes pulseHeart {
  0%, 100% { transform: translate(-50%, -50%) scale(1); }
  14%       { transform: translate(-50%, -50%) scale(1.15); }
  28%       { transform: translate(-50%, -50%) scale(1); }
  42%       { transform: translate(-50%, -50%) scale(1.08); }
  56%       { transform: translate(-50%, -50%) scale(1); }
}
@keyframes dotPop {
  0%, 100% { transform: scale(1); opacity: 1; }
  50%       { transform: scale(1.6); opacity: 0.7; }
}
@keyframes statSlideUp {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes liveGlow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.5); }
  50%       { box-shadow: 0 0 0 5px rgba(34, 197, 94, 0); }
}

/* ── ENTER ANIMATIONS ── */
.hero-left  { opacity: 0; }
.hero-right { opacity: 0; }
.stats-bar  { opacity: 0; }

.hero-left.animate-in  { animation: fadeSlideUp   0.75s cubic-bezier(0.22, 1, 0.36, 1) 0.1s forwards; }
.hero-right.animate-in { animation: fadeSlideRight 0.85s cubic-bezier(0.22, 1, 0.36, 1) 0.3s forwards; }
.stats-bar.animate-in  { animation: statSlideUp    0.6s  ease                           0.7s forwards; }

/* ── ANIMATION CLASSES ── */
.float-anim  { animation: float      4s    ease-in-out infinite; }
.spin-cw     { animation: spinCW     22s   linear      infinite; }
.spin-ccw    { animation: spinCCW    18s   linear      infinite; }
.pulse-heart { animation: pulseHeart 2.4s  ease-in-out infinite; }
.orbit-dot   { animation: dotPop     2.5s  ease-in-out infinite; }
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
.hero-left { flex: 1; max-width: 480px; }

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

.hero-btns { display: flex; align-items: center; gap: 14px; }
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

/* ── RING SCENE ── */
.hero-right {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ring-scene {
  position: relative;
  width: 500px;
  height: 480px;
  flex-shrink: 0;
}
.ring-wrap {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 360px; height: 360px;
}
.ring-wrap::after {
  content: '';
  position: absolute;
  bottom: -40px; left: -40px;
  width: 220px; height: 220px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(227, 38, 54, 0.22) 0%, rgba(227, 38, 54, 0) 70%);
  pointer-events: none;
  z-index: 0;
}
.ring { position: absolute; border-radius: 50%; }
.ring-1 { width: 360px; height: 360px; top: 0;    left: 0;    transform-origin: 180px 180px; border: 1px solid rgba(37, 99, 235, 0.09); }
.ring-2 { width: 270px; height: 270px; top: 45px; left: 45px; transform-origin: 135px 135px; border: 1.5px solid rgba(37, 99, 235, 0.20); }
.ring-3 { width: 170px; height: 170px; top: 95px; left: 95px; border: 2px solid rgba(37, 99, 235, 0.30); background: radial-gradient(circle, rgba(200,210,255,0.15) 0%, rgba(255,200,210,0.15) 100%); }

.heart-center {
  position: absolute; top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 88px; height: 88px; border-radius: 50%;
  background: linear-gradient(135deg, #e32636 0%, #c0392b 100%);
  color: #fff;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 6px 28px rgba(227, 38, 54, 0.35);
  z-index: 2;
}

.dot { position: absolute; width: 10px; height: 10px; border-radius: 50%; }
.dot-blue  { background: #2563eb; }
.dot-red   { background: #e32636; }
.dot-green { background: #22c55e; }

/* ── FLOATING CARDS ── */
.fcard {
  position: absolute;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 10px 14px;
  backdrop-filter: blur(6px);
  min-width: 130px;
  transition: box-shadow 0.2s;
  box-shadow: 0 4px 16px rgba(0,0,0,0.07);
}
.fcard:hover { box-shadow: 0 8px 28px rgba(0, 0, 0, 0.12); }

/* Row layout for cards with icon */
.fcard-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* Icon badge */
.fcard-icon-wrap {
  width: 32px; height: 32px; border-radius: 8px;
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

/* Real-time Alerts */
.fcard-alert {
  top: 50px;
  left: 5%;
  transform: translateX(-20%);
  background: #e32636;
  border-color: transparent;
  color: #fff;
  font-size: 12px; font-weight: 600;
  padding: 8px 16px;
  min-width: unset;
  white-space: nowrap;
  display: flex; align-items: center; gap: 7px;
  border-radius: 20px;
  box-shadow: 0 4px 14px rgba(227,38,54,0.35);
}

/* Blood Available */
.fcard-blood { top: 70px; right: -50px; min-width: 160px; }

/* Request Fulfilled */
.fcard-fulfilled { top: 50%; left: -80px; transform: translateY(-50%); min-width: 160px; }

/* Active Donors */
.fcard-donors { bottom: 10px; left: 110px; min-width: 150px; }

/* ── STATS BAR ── */
.stats-bar {
  position: relative; z-index: 2;
  display: flex; max-width: 1200px;
  margin: 0 auto; padding: 0 3rem 3rem;
}
.stat { flex: 1; display: flex; flex-direction: column; padding-right: 2rem; }
.stat + .stat { padding-left: 2rem; border-left: 1px solid #e5e7eb; }
.stat-icon  { color: #9ca3af; margin-bottom: 6px; }
.stat-num   { font-size: 34px; font-weight: 800; color: #111; line-height: 1; }
.stat-label { font-size: 13px; color: #9ca3af; margin-top: 4px; }

/* ── RESPONSIVE ── */
@media (max-width: 900px) {
  .hero-content { flex-direction: column; padding: 60px 1.5rem 20px; }
  .hero-left    { max-width: 100%; }
  .hero-title   { font-size: 38px; }
  .hero-right   { width: 100%; }
  .ring-scene   { width: 340px; height: 340px; }
  .stats-bar    { padding: 0 1.5rem 2rem; }
}
@media (max-width: 600px) {
  .hero-title { font-size: 30px; }
  .ring-scene { width: 300px; height: 300px; }
  .stats-bar  { flex-direction: column; gap: 1.5rem; }
  .stat + .stat { border-left: none; border-top: 1px solid #e5e7eb; padding-left: 0; padding-top: 1.5rem; }
}
@media (prefers-reduced-motion: reduce) {
  .float-anim, .spin-cw, .spin-ccw, .pulse-heart, .orbit-dot, .live-dot { animation: none; }
  .hero-left, .hero-right, .stats-bar { opacity: 1; animation: none; }
  .accent::after { animation: none; }
}
</style>
