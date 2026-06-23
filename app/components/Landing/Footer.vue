<template>
  <footer class="footer">
    <div class="footer-inner">
      <div class="footer-brand">
        <div class="footer-logo">
          <img :src="logo" alt="RedAgos Logo" class="footer-logo-image" />
          <span class="logo-text">Red<span class="logo-accent">Agos</span></span>
        </div>
        <p class="logo-sub">BLOOD BANK SYSTEM</p>
        <p class="footer-desc">
          An Integrated Online Blood Bank Information Management and Inventory
          Control System for Davao City's blood service network.
        </p>
        <p class="footer-cap">
          <AssetIcon name="heart" class="cap-icon" :size="12" />
          A Capstone Project — STI College Davao · BSIT 2026
        </p>
      </div>

      <!-- Quick Links -->
      <div class="footer-links">
        <h4>QUICK LINKS</h4>
        <ul>
          <li v-for="link in quickLinks" :key="link.label">
            <NuxtLink :to="link.to">{{ link.label }}</NuxtLink>
          </li>
        </ul>
      </div>

      <!-- Contact -->
      <div class="footer-contact">
        <h4>CONTACT</h4>
        <ul>
          <li>
            <AssetIcon name="map-pin" class="contact-icon" :size="18" />
            <span>STI College Davao, Davao City, Philippines</span>
          </li>
          <li>
            <AssetIcon name="mail" class="contact-icon" :size="18" />
            <a href="mailto:support@redagos.ph">support@redagos.ph</a>
          </li>
          <li>
            <AssetIcon name="phone" class="contact-icon" :size="18" />
            <span>+63 (82) 000-0000</span>
          </li>
        </ul>
      </div>

    </div>

    <!-- Bottom bar -->
    <div class="footer-bottom">
      <span>© 2026 RedAgos. All rights reserved.</span>
      <div class="footer-bottom-links">
        <a href="#">Privacy Policy</a>
        <a href="#">Terms of Service</a>
      </div>
    </div>
  </footer>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import logo from '~/assets/images/RedAgosLogo.png'

const quickLinks = [
  { label: 'Home',            to: '#' },
  { label: 'Features',        to: '#features' },
  { label: 'Donation Drives', to: '#drives' },
  { label: 'About',           to: '#about' },
  { label: 'Contact',         to: '#contact' },
]
</script>

<style scoped>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

.footer {
  background: #0d1117;
  padding: 56px 2.5rem 0;
  font-family: 'Inter', 'Segoe UI', sans-serif;
}

.footer-inner {
  max-width: 1280px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 2fr 1fr 1.5fr;
  gap: 64px;
  padding-bottom: 48px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

/* ── Brand ── */
.footer-logo{
  display:flex;
  align-items:center;
  gap:12px;
}

.footer-logo-image { width:42px; height:42px; object-fit:contain;}
.logo-text   { font-size: 20px; font-weight: 800; color: #ffffff; }
.logo-accent { color: #e53935; }

.logo-sub {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: rgba(255, 255, 255, 0.4);
  margin-bottom: 14px;
}

.footer-desc {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
  line-height: 1.7;
  max-width: 240px;
  margin-bottom: 20px;
}

.footer-cap {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.35);
}
.cap-icon { color: #e53935; }

/* ── Quick Links ── */
.footer-links h4,
.footer-contact h4 {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 16px;
}

.footer-links ul {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.footer-links li {
  display: flex;
  align-items: center;
  gap: 0;
}
.footer-links li::before {
  content: '•';
  color: rgba(255, 255, 255, 0.25);
  margin-right: 8px;
  font-size: 10px;
}
.footer-links a {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.55);
  text-decoration: none;
  transition: color 0.2s;
}
.footer-links a:hover { color: #ffffff; }

/* ── Contact ── */
.footer-contact ul {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.footer-contact li {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.55);
  line-height: 1.5;
}
.contact-icon { color: #2563eb; flex-shrink: 0; margin-top: 2px; }
.footer-contact a {
  color: rgba(255, 255, 255, 0.55);
  text-decoration: none;
  transition: color 0.2s;
}
.footer-contact a:hover { color: #ffffff; }

/* ── Bottom bar ── */
.footer-bottom {
  max-width: 1280px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.3);
}
.footer-bottom-links {
  display: flex;
  gap: 24px;
}
.footer-bottom-links a {
  color: rgba(255, 255, 255, 0.3);
  text-decoration: none;
  transition: color 0.2s;
}
.footer-bottom-links a:hover { color: rgba(255, 255, 255, 0.7); }

/* ── Responsive ── */
@media (max-width: 1024px) {
  .footer-inner {
    grid-template-columns: 1fr 1fr;
    gap: 40px;
  }
  .footer-brand { grid-column: 1 / -1; }
}

@media (max-width: 640px) {
  .footer         { padding: 48px 1.25rem 0; }
  .footer-inner   { grid-template-columns: 1fr; gap: 32px; }
  .footer-bottom  { flex-direction: column; gap: 12px; text-align: center; }
}
</style>
