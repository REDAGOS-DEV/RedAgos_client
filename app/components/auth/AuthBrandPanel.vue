<template>
  <aside class="brand-panel">
    <div class="particle particle1"></div>
    <div class="particle particle2"></div>
    <div class="particle particle3"></div>
    <div class="particle particle4"></div>

    <div class="circle circle-top"></div>
    <div class="circle circle-bottom"></div>

    <div class="top-ring"></div>
    <div class="top-ring-2"></div>

    <div class="brand-lockup">
      <div class="brand-mark">
        <img :src="logo" alt="RedAgos Logo" class="logo-image" />
      </div>

      <div>
        <p class="brand-name">
          Red<span>Agos</span>
        </p>
        <p class="brand-subtitle">Blood Bank System</p>
      </div>
    </div>

    <section class="brand-copy">
      <h2>
        Connecting Lives<br />
        Through Blood<br />
        Donation
      </h2>

      <p>
        Davao City's integrated blood bank management system<br />
        &mdash; connecting donors, hospitals, and blood centers.
      </p>
    </section>

    <div class="stats-row">
      <div>
        <strong>4</strong>
        <span>User Roles</span>
      </div>

      <div>
        <strong>24/7</strong>
        <span>Monitoring</span>
      </div>

      <div>
        <strong>100%</strong>
        <span>Digital</span>
      </div>
    </div>
    <div class="red-glow"></div>
  </aside>
</template>

<script setup>
import logo from '~/assets/images/RedAgosLogo.png'
</script>

<style scoped>
.brand-panel {
  position: relative;
  display: block;
  overflow: hidden;
  padding: 48px;
  background: #206fbd;
  color: #ffffff;
}
.top-ring {
  position: absolute;
  top: -120px;
  left: -120px;
  width: 320px;
  height: 320px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.15);
}

.top-ring-2 {
  position: absolute;
  top: -70px;
  left: -70px;
  width: 220px;
  height: 220px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.15);
}

.particle {
  position: absolute;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #ff5a74;
}

.particle1 {
  left: 60px;
  bottom: 260px;
  animation: float 6s infinite ease-in-out;
}

.particle2 {
  left: 200px;
  bottom: 340px;
  animation: float 8s infinite ease-in-out;
}

.particle3 {
  left: 500px;
  bottom: 220px;
  animation: float 7s infinite ease-in-out;
}

.particle4 {
  left: 420px;
  bottom: 160px;
  animation: float 9s infinite ease-in-out;
}

.circle {
  position: absolute;
  pointer-events: none;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.055);
}

.circle-top {
  top: -96px;
  right: -128px;
  width: 320px;
  height: 320px;
}

.circle-bottom {
  left: -96px;
  bottom: -96px;
  width: 384px;
  height: 384px;
}

.brand-lockup {
  animation: logoFloat 5s infinite ease-in-out;
}

.brand-mark {
  display: flex;
  width: 40px;
  height: 40px;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.2);
}

.brand-name {
  margin: 0;
  color: #ffffff;
  font-size: 24px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.02em;
}

.brand-name span {
  color: #ff2f55;
}

.brand-subtitle {
  margin: 8px 0 0;
  color: #ffffff;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 3px;
  line-height: 1;
  text-transform: uppercase;
}

.brand-copy {
  position: relative;
  z-index: 1;
  max-width: 390px;
  margin-top: 76px;
}

.brand-copy h2 {
  margin: 0;
  color: #ffffff;
  font-size: 37px;
  font-weight: 800;
  letter-spacing: 0;
  line-height: 1.62;
}

.brand-copy p {
  margin: 28px 0 0;
  color: rgba(255, 255, 255, 0.62);
  font-size: 14px;
  line-height: 2.15;
}

.red-glow {
  position: absolute;
  left: -120px;
  bottom: -250px;
  width: 650px;
  height: 650px;
  border-radius: 50%;
  background: radial-gradient(circle, #ff4d6d 0%, #ff2f55 20%, rgba(255, 47, 85, 0.4) 60%, transparent 85%);
  filter: blur(100px);
}

.stats-row {
  position: absolute;
  z-index: 1;
  left: 56px;
  bottom: 30px;
  display: grid;
  grid-template-columns: repeat(3, auto);
  gap: 42px;
}

.stats-row strong {
  display: block;
  color: #ffffff;
  font-size: 24px;
  font-weight: 800;
  line-height: 1;
}

.stats-row span {
  display: block;
  margin-top: 8px;
  color: rgba(255, 255, 255, 0.55);
  font-size: 11px;
  font-weight: 400;
}

@keyframes float {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-8px);
  }
}

@keyframes logoFloat {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-6px);
  }
}

@media (max-width: 1023px) {
  .brand-panel {
    display: none;
  }
}
</style>