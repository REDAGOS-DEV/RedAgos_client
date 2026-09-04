<template>
  <aside class="brand-panel">
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

@media (max-width: 1023px) {
  .brand-panel {
    display: none;
  }
}
</style>
