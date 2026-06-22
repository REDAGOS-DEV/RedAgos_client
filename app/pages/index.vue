<template>
  <div class="landing">
    <!-- NAV -->
    <nav class="navbar" :class="{ scrolled: isScrolled }">
      <div class="nav-logo">
        <div class="logo-icon">
          <svg viewBox="0 0 24 24" fill="white" width="22" height="22">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
        </div>
        <div>
          <span class="logo-name">Red<span style="color:#e32636">Agos</span></span>
          <span class="logo-sub">BLOOD BANK SYSTEM</span>
        </div>
      </div>

      <ul class="nav-links">
        <li><a href="#" class="active">Home</a></li>
        <li><a href="#">Features</a></li>
        <li><a href="#">Donation Drives</a></li>
        <li><a href="#">About</a></li>
        <li><a href="#">Contact</a></li>
      </ul>

      <div class="nav-actions">
        <button class="btn-login" @click="navigateTo('/login')">Log In</button>
        <button class="btn-started" @click="navigateTo('/login')">Get Started ›</button>
      </div>
    </nav>

    <!-- HERO -->
    <section class="hero">
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

            <!-- TOP-CENTER: Real-time Alerts -->
            <div class="fcard fcard-alert float-anim">
              <span class="alert-dot"></span> Real-time Alerts
            </div>

            <!-- TOP-RIGHT: Blood Available -->
            <div class="fcard fcard-blood float-anim" style="animation-delay: 0.4s">
              <div class="fcard-label">Blood Available</div>
              <div class="fcard-value green">247 Units ▲</div>
            </div>

            <!-- Ring -->
            <div class="ring-wrap">
              <div class="ring ring-1 spin-cw"></div>
              <div class="ring ring-2 spin-ccw"></div>
              <div class="ring ring-3"></div>
              <div class="heart-center pulse-heart">
                <svg viewBox="0 0 24 24" fill="white" width="36" height="36">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                </svg>
              </div>
              <span class="dot dot-blue orbit-dot"  style="top: 10px;  left: 130px;"></span>
              <span class="dot dot-red  orbit-dot"  style="top: 195px; left: 275px; animation-delay: 1.2s"></span>
              <span class="dot dot-blue orbit-dot"  style="top: 248px; left: 45px;  animation-delay: 0.6s"></span>
              <span class="dot dot-green orbit-dot" style="top: 50px;  left: 22px;  animation-delay: 1.8s"></span>
            </div>

            <!-- LEFT: Request Fulfilled -->
            <div class="fcard fcard-fulfilled float-anim" style="animation-delay: 0.8s">
              <div class="fcard-label">Request Fulfilled</div>
              <div class="fcard-value">98.5%</div>
            </div>

            <!-- BOTTOM-RIGHT: Active Donors -->
            <div class="fcard fcard-donors float-anim" style="animation-delay: 1.2s">
              <div class="fcard-label">Active Donors</div>
              <div class="fcard-value">1,240+</div>
            </div>

          </div>
        </div>
      </div>

      <!-- Stats bar -->
      <div class="stats-bar" :class="{ 'animate-in': mounted }">
        <div class="stat">
          <div class="stat-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.8" width="22" height="22">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
            </svg>
          </div>
          <div class="stat-num">100+</div>
          <div class="stat-label">Units Needed Daily</div>
        </div>
        <div class="stat">
          <div class="stat-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.8" width="22" height="22">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
          </div>
          <div class="stat-num">24/7</div>
          <div class="stat-label">Live Monitoring</div>
        </div>
        <div class="stat">
          <div class="stat-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.8" width="22" height="22">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <div class="stat-num">98.5%</div>
          <div class="stat-label">Fulfillment Rate</div>
        </div>
      </div>
    </section>

  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const mounted    = ref(false)
const isScrolled = ref(false)

let scrollHandler

onMounted(() => {
  setTimeout(() => { mounted.value = true }, 80)
  scrollHandler = () => { isScrolled.value = window.scrollY > 10 }
  window.addEventListener('scroll', scrollHandler)
})

onUnmounted(() => {
  window.removeEventListener('scroll', scrollHandler)
})
</script>

<style scoped>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

.landing {
  font-family: 'Inter', 'Segoe UI', sans-serif;
  color: #1a1a1a;
  overflow-x: hidden;
}

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
 
/* ── HERO ENTER ANIMATIONS ── */
.hero-left  { opacity: 0; }
.hero-right { opacity: 0; }
.stats-bar  { opacity: 0; }
 
.hero-left.animate-in {
  animation: fadeSlideUp 0.75s cubic-bezier(0.22, 1, 0.36, 1) 0.1s forwards;
}
.hero-right.animate-in {
  animation: fadeSlideRight 0.85s cubic-bezier(0.22, 1, 0.36, 1) 0.3s forwards;
}
.stats-bar.animate-in {
  animation: statSlideUp 0.6s ease 0.7s forwards;
}
 
/* ── FLOATING CARDS ── */
.float-anim { animation: float 4s ease-in-out infinite; }
 
/* ── RINGS ── */
.spin-cw  { animation: spinCW  22s linear infinite; }
.spin-ccw { animation: spinCCW 18s linear infinite; }
 
/* ── HEART ── */
.pulse-heart { animation: pulseHeart 2.4s ease-in-out infinite; }
 
/* ── ORBIT DOTS ── */
.orbit-dot { animation: dotPop 2.5s ease-in-out infinite; }
 
/* ── LIVE DOT ── */
.live-dot { animation: liveGlow 1.8s ease-in-out infinite; }
 
/* ── NAVBAR ── */
.navbar {
  position: fixed;
  top: 0; left: 0; right: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2rem;
  height: 60px;
  background: rgba(255, 255, 255, 0.95);
  border-bottom: 1.5px solid #2563eb;
  backdrop-filter: blur(8px);
  transition: box-shadow 0.3s ease, background 0.3s ease;
}
.navbar.scrolled {
  box-shadow: 0 4px 20px rgba(37, 99, 235, 0.10);
  background: rgba(255, 255, 255, 0.98);
}
 
.nav-logo { display: flex; align-items: center; gap: 10px; }
.logo-icon {
  width: 40px; height: 40px; border-radius: 10px;
  background: #e32636; display: flex;
  align-items: center; justify-content: center; flex-shrink: 0;
  transition: transform 0.2s ease;
}
.logo-icon:hover { transform: scale(1.08); }
.logo-name { font-size: 18px; font-weight: 700; display: block; line-height: 1.1; color: #1a1a1a; }
.logo-sub  { font-size: 9px; font-weight: 400; color: #888; display: block; letter-spacing: 0.08em; }
 
.nav-links { display: flex; align-items: center; gap: 2rem; list-style: none; }
.nav-links a {
  text-decoration: none; color: #374151; font-size: 14px; font-weight: 500;
  transition: color 0.2s ease;
  position: relative; padding-bottom: 3px;
}
.nav-links a::after {
  content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 2px;
  background: #2563eb; transform: scaleX(0); transform-origin: left;
  transition: transform 0.25s ease;
}
.nav-links a:hover::after,
.nav-links a.active::after { transform: scaleX(1); }
.nav-links a:hover,
.nav-links a.active { color: #2563eb; }
 
.nav-actions { display: flex; align-items: center; gap: 10px; }
.btn-login {
  font-size: 14px; font-weight: 500; color: #374151;
  background: none; border: none; cursor: pointer;
  padding: 8px 14px; border-radius: 6px;
  transition: background 0.2s ease, color 0.2s ease;
}
.btn-login:hover { background: #f3f4f6; color: #2563eb; }
.btn-started {
  font-size: 14px; font-weight: 600; color: #fff;
  background: #2563eb; border: none; cursor: pointer;
  padding: 9px 18px; border-radius: 6px;
  transition: background 0.2s ease, transform 0.15s ease;
}
.btn-started:hover { background: #1d4ed8; transform: translateY(-1px); }
.btn-started:active { transform: translateY(0); }
 
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
.accent {
  color: #2563eb;
  text-decoration: underline;
  text-underline-offset: 5px;
  text-decoration-thickness: 3px;
  text-decoration-color: #e32636;
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
 
/* Ring centered in scene */
.ring-wrap {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 360px; height: 360px;
}
 
/* Red glow bottom-left */
.ring-wrap::after {
  content: '';
  position: absolute;
  bottom: -40px;
  left: -40px;
  width: 220px;
  height: 220px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(227, 38, 54, 0.18) 0%, rgba(227, 38, 54, 0) 70%);
  pointer-events: none;
  z-index: 0;
}
.ring {
  position: absolute; border-radius: 50%;
}
.ring-1 { width: 360px; height: 360px; top: 0;    left: 0;    transform-origin: 180px 180px; border: 1.5px solid rgba(37, 99, 235, 0.10); }
.ring-2 { width: 270px; height: 270px; top: 45px; left: 45px; transform-origin: 135px 135px; border: 1.5px solid rgba(37, 99, 235, 0.20); }
.ring-3 { width: 170px; height: 170px; top: 95px; left: 95px; border: 1.5px solid rgba(37, 99, 235, 0.35); background: rgba(37, 99, 235, 0.04); }
 
.heart-center {
  position: absolute; top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 72px; height: 72px; border-radius: 50%;
  background: linear-gradient(135deg, #e32636 0%, #c0392b 100%);
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 20px rgba(227, 38, 54, 0.3);
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
  border-radius: 10px;
  padding: 10px 14px;
  backdrop-filter: blur(6px);
  min-width: 130px;
  transition: box-shadow 0.2s;
}
.fcard:hover { box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1); }
.fcard-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #9ca3af; margin-bottom: 4px; }
.fcard-value { font-size: 18px; font-weight: 700; color: #111; }
.fcard-value.green { color: #16a34a; }

/* Real-time Alerts — top center above ring */
.fcard-alert {
  top: 32px;
  right: 60%;
  transform: translateX(-50%);
  background: #e32636;
  border-color: transparent;
  color: #fff;
  font-size: 12px; font-weight: 600;
  padding: 7px 16px;
  min-width: unset;
  white-space: nowrap;
  display: flex; align-items: center; gap: 7px;
}
.alert-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: #fff; display: inline-block; flex-shrink: 0;
}

/* Blood Available — top right */
.fcard-blood { top: 60px; right: -20px; }

/* Request Fulfilled — middle left */
.fcard-fulfilled {
  top: 50%;
  left: -25px;
  transform: translateY(-50%);
}

/* Active Donors — bottom right */
.fcard-donors { bottom: 30px; right: 10px; }

/* ── STATS BAR ── */
.stats-bar {
  position: relative; z-index: 2;
  display: flex; max-width: 1200px;
  margin: 0 auto; padding: 0 3rem 3rem;
}
.stat { flex: 1; display: flex; flex-direction: column; padding-right: 2rem; }
.stat + .stat { padding-left: 2rem; border-left: 1px solid #e5e7eb; }
.stat-icon { color: #9ca3af; margin-bottom: 6px; }
.stat-num  { font-size: 34px; font-weight: 800; color: #111; line-height: 1; }
.stat-label { font-size: 13px; color: #9ca3af; margin-top: 4px; }

/* ── RESPONSIVE ── */
@media (max-width: 900px) {
  .hero-content { flex-direction: column; padding: 60px 1.5rem 20px; }
  .hero-left    { max-width: 100%; }
  .hero-title   { font-size: 38px; }
  .hero-right   { width: 100%; }
  .ring-scene   { width: 340px; height: 340px; }
  .nav-links    { display: none; }
  .stats-bar    { padding: 0 1.5rem 2rem; }
}
@media (max-width: 600px) {
  .navbar     { padding: 0 1rem; }
  .hero-title { font-size: 30px; }
  .ring-scene { width: 300px; height: 300px; }
  .stats-bar  { flex-direction: column; gap: 1.5rem; }
  .stat + .stat { border-left: none; border-top: 1px solid #e5e7eb; padding-left: 0; padding-top: 1.5rem; }
}

@media (prefers-reduced-motion: reduce) {
  .float-anim, .spin-cw, .spin-ccw, .pulse-heart, .orbit-dot, .live-dot { animation: none; }
  .hero-left, .hero-right, .stats-bar { opacity: 1; animation: none; }
}
</style>