<template>
  <div class="landing">
    <!-- NAV -->
    <nav class="navbar">
      <div class="nav-logo">
        <div class="logo-icon">
          <svg viewBox="0 0 24 24" fill="white" width="20" height="20">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
        </div>
        <div>
          <span class="logo-name">RedAgos</span>
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
        <button class="btn-login">Log In</button>
        <button class="btn-started">Get Started ›</button>
      </div>
    </nav>

    <!-- HERO -->
    <section class="hero">
      <div class="hero-bg-image"></div>
      <div class="hero-overlay"></div>

      <div class="hero-content">
        <!-- Left -->
        <div class="hero-left">
          <div class="live-badge">
            <span class="live-dot"></span>
            Live &nbsp;·&nbsp; Davao City's Blood Bank Network
          </div>

          <h1 class="hero-title">
            Saving Lives<br />
            Through<br />
            <span class="accent">Smart Blood</span><br />
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
            <button class="btn-primary">Register Now →</button>
            <button class="btn-secondary">Sign In</button>
          </div>
        </div>

        <!-- Right: Ring Visual -->
        <div class="hero-right">
          <div class="fcard fcard-alert">
            <span class="alert-dot"></span> Real-time Alerts
          </div>

          <div class="fcard fcard-top-right">
            <div class="fcard-label">Blood Available</div>
            <div class="fcard-value green">247 Units ▲</div>
          </div>

          <div class="ring-wrap">
            <div class="ring ring-1"></div>
            <div class="ring ring-2"></div>
            <div class="ring ring-3"></div>
            <div class="heart-center">
              <svg viewBox="0 0 24 24" fill="white" width="36" height="36">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
            </div>
            <span class="dot dot-blue" style="top: 10px; left: 140px;"></span>
            <span class="dot dot-red" style="top: 205px; left: 290px;"></span>
            <span class="dot dot-blue" style="top: 260px; left: 50px;"></span>
            <span class="dot dot-green" style="top: 55px; left: 25px;"></span>
          </div>

          <div class="fcard fcard-mid-left">
            <div class="fcard-label">Request Fulfilled</div>
            <div class="fcard-value">98.5%</div>
          </div>

          <div class="fcard fcard-bottom-right">
            <div class="fcard-label">Active Donors</div>
            <div class="fcard-value">1,240+</div>
          </div>
        </div>
      </div>

      <!-- Stats bar -->
      <div class="stats-bar">
        <div class="stat">
          <div class="stat-icon">○</div>
          <div class="stat-num">100+</div>
          <div class="stat-label">Units Needed Daily</div>
        </div>
        <div class="stat">
          <div class="stat-icon">〜</div>
          <div class="stat-num">24/7</div>
          <div class="stat-label">Live Monitoring</div>
        </div>
        <div class="stat">
          <div class="stat-icon">◯</div>
          <div class="stat-num">98.5%</div>
          <div class="stat-label">Fulfillment Rate</div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
// No props needed for static landing page
</script>

<style scoped>
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

.landing {
  font-family: 'Inter', 'Segoe UI', sans-serif;
  color: #1a1a1a;
  overflow-x: hidden;
}

/* NAVBAR */
.navbar {
  position: fixed;
  top: 0; left: 0; right: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2rem;
  height: 60px;
  background: rgba(255, 255, 255, 0.93);
  border: 1.5px solid #2563eb;
  backdrop-filter: blur(8px);
}

.nav-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #1a1a1a;
}

.logo-icon {
  width: 36px; height: 36px;
  border-radius: 8px;
  background: #e32636;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.logo-name {
  font-size: 18px;
  font-weight: 700;
  display: block;
  line-height: 1.1;
}

.logo-sub {
  font-size: 9px;
  font-weight: 400;
  color: #888;
  display: block;
  letter-spacing: 0.08em;
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 2rem;
  list-style: none;
}

.nav-links a {
  text-decoration: none;
  color: #374151;
  font-size: 14px;
  font-weight: 500;
}

.nav-links a:hover,
.nav-links a.active {
  color: #2563eb;
}

.nav-links a.active {
  border-bottom: 2px solid #2563eb;
  padding-bottom: 2px;
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.btn-login {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px 14px;
  border-radius: 6px;
}

.btn-login:hover { background: #f3f4f6; }

.btn-started {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  background: #2563eb;
  border: none;
  cursor: pointer;
  padding: 9px 18px;
  border-radius: 6px;
}

.btn-started:hover { background: #1d4ed8; }

/* HERO */
.hero {
  min-height: 100vh;
  padding-top: 60px;
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  overflow: hidden;
}

.hero-bg-image {
  position: absolute;
  inset: 0;
  background: url('https://images.unsplash.com/photo-1615461066841-6116e61058f4?w=1400&q=60') center / cover no-repeat;
  opacity: 0.13;
  z-index: 0;
}

.hero-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    135deg,
    rgba(219, 234, 254, 0.55) 0%,
    rgba(255, 255, 255, 0.35) 40%,
    rgba(254, 226, 226, 0.45) 100%
  );
  z-index: 1;
}

.hero-content {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 3rem;
  padding: 80px 3rem 40px;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

.hero-left {
  flex: 1;
  max-width: 480px;
}

.live-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid #e5e7eb;
  border-radius: 20px;
  padding: 5px 14px;
  font-size: 12px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 24px;
}

.live-dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: #22c55e;
  display: inline-block;
  flex-shrink: 0;
}

.hero-title {
  font-size: 52px;
  font-weight: 800;
  line-height: 1.08;
  color: #111;
  margin-bottom: 18px;
}

.hero-title .accent {
  color: #e32636;
  text-decoration: underline;
  text-underline-offset: 5px;
  text-decoration-thickness: 3px;
}

.hero-desc {
  font-size: 15px;
  color: #4b5563;
  line-height: 1.75;
  margin-bottom: 32px;
}

.hero-desc strong {
  font-weight: 600;
  color: #111;
}

.hero-btns {
  display: flex;
  align-items: center;
  gap: 14px;
}

.btn-primary {
  background: #2563eb;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  padding: 12px 24px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
}

.btn-primary:hover { background: #1d4ed8; }

.btn-secondary {
  background: #fff;
  color: #374151;
  font-size: 14px;
  font-weight: 500;
  padding: 11px 20px;
  border-radius: 8px;
  border: 1px solid #d1d5db;
  cursor: pointer;
}

.btn-secondary:hover { background: #f9fafb; }

/* RING VISUAL */
.hero-right {
  flex: 1;
  position: relative;
  height: 380px;
}

.ring-wrap {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -52%);
  width: 300px; height: 300px;
}

.ring {
  position: absolute;
  border-radius: 50%;
  border: 1px solid rgba(37, 99, 235, 0.18);
}

.ring-1 { width: 300px; height: 300px; top: 0; left: 0; }
.ring-2 { width: 220px; height: 220px; top: 40px; left: 40px; }
.ring-3 {
  width: 140px; height: 140px;
  top: 80px; left: 80px;
  background: rgba(37, 99, 235, 0.05);
}

.heart-center {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 72px; height: 72px;
  border-radius: 50%;
  background: linear-gradient(135deg, #e32636 0%, #c0392b 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 20px rgba(227, 38, 54, 0.3);
}

.dot {
  position: absolute;
  width: 10px; height: 10px;
  border-radius: 50%;
}

.dot-blue  { background: #2563eb; }
.dot-red   { background: #e32636; }
.dot-green { background: #22c55e; }

/* FLOATING CARDS */
.fcard {
  position: absolute;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 10px 14px;
  backdrop-filter: blur(6px);
  min-width: 130px;
}

.fcard-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #9ca3af;
  margin-bottom: 4px;
}

.fcard-value {
  font-size: 18px;
  font-weight: 700;
  color: #111;
}

.fcard-value.green { color: #16a34a; }

.fcard-alert {
  top: 10px; right: 70px;
  background: #e32636;
  border-color: transparent;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  padding: 7px 14px;
  min-width: unset;
  display: flex;
  align-items: center;
  gap: 7px;
}

.alert-dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: #fff;
  display: inline-block;
  flex-shrink: 0;
}

.fcard-top-right  { top: 55px; right: 0; }
.fcard-mid-left   { top: 38%; left: 0; }
.fcard-bottom-right { bottom: 15px; right: 10px; }

/* STATS BAR */
.stats-bar {
  position: relative;
  z-index: 2;
  display: flex;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 3rem 3rem;
}

.stat {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding-right: 2rem;
}

.stat + .stat {
  padding-left: 2rem;
  border-left: 1px solid #e5e7eb;
}

.stat-icon {
  color: #9ca3af;
  font-size: 16px;
  margin-bottom: 6px;
}

.stat-num {
  font-size: 34px;
  font-weight: 800;
  color: #111;
  line-height: 1;
}

.stat-label {
  font-size: 13px;
  color: #9ca3af;
  margin-top: 4px;
}

/* RESPONSIVE */
@media (max-width: 900px) {
  .hero-content {
    flex-direction: column;
    padding: 60px 1.5rem 20px;
  }
  .hero-left { max-width: 100%; }
  .hero-title { font-size: 38px; }
  .hero-right { width: 100%; height: 300px; }
  .nav-links { display: none; }
  .stats-bar { padding: 0 1.5rem 2rem; }
}

@media (max-width: 600px) {
  .navbar { padding: 0 1rem; }
  .hero-title { font-size: 30px; }
  .stats-bar { flex-direction: column; gap: 1.5rem; }
  .stat + .stat {
    border-left: none;
    border-top: 1px solid #e5e7eb;
    padding-left: 0;
    padding-top: 1.5rem;
  }
}
</style>