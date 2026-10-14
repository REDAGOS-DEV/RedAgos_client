<template>
  <footer class="footer">
    <div class="footer-inner">
      <div class="footer-brand">
        <div class="footer-logo">
          <img :src="logo" alt="" class="footer-logo-image" width="40" height="40" />
          <span>
            <span class="logo-text">Red<span class="logo-accent">Agos</span></span>
            <span class="logo-sub">Blood Bank System</span>
          </span>
        </div>
        <p class="footer-desc">
          An Integrated Online Blood Bank Information Management and Inventory
          Control System for Davao City's blood service network.
        </p>
        <p class="footer-cap">
          <AssetIcon name="heart" class="cap-icon" :size="14" />
          A capstone project of STI College Davao, BSIT 2026
        </p>
      </div>

      <nav class="footer-col" aria-label="Footer">
        <h2 class="footer-title">Quick links</h2>
        <ul>
          <li v-for="link in quickLinks" :key="link.label">
            <a :href="link.to">{{ link.label }}</a>
          </li>
        </ul>
      </nav>

      <div class="footer-col">
        <h2 class="footer-title">Contact</h2>
        <ul class="contact-list">
          <li>
            <AssetIcon name="map-pin" class="contact-icon" :size="16" />
            <span>STI College Davao, Davao City, Philippines</span>
          </li>
          <li>
            <AssetIcon name="mail" class="contact-icon" :size="16" />
            <a href="mailto:support@redagos.ph">support@redagos.ph</a>
          </li>
          <li>
            <AssetIcon name="phone" class="contact-icon" :size="16" />
            <!-- TODO: placeholder number, replace before launch -->
            <span>+63 (82) 000-0000</span>
          </li>
        </ul>
      </div>
    </div>

    <div class="footer-bottom">
      <span>© 2026 RedAgos. All rights reserved.</span>
      <div class="footer-bottom-links">
        <NuxtLink to="/legal/privacy">Privacy Policy</NuxtLink>
        <NuxtLink to="/legal/terms">Terms of Service</NuxtLink>
        <!-- Staff portals (hospital, blood center, administrator) are kept out
             of the main menu; the Get started page lists every sign-in. -->
        <NuxtLink to="/auth/role-selection">Staff sign in</NuxtLink>
      </div>
    </div>
  </footer>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import logo from '~/assets/images/RedAgosLogo.png'

const quickLinks = [
  { label: 'Home', to: '#home' },
  { label: 'How It Works', to: '#features' },
  { label: "Who It's For", to: '#roles' },
  { label: 'Donation Drives', to: '#drives' },
  { label: 'About', to: '#about' },
  { label: 'Contact', to: '#contact' },
]
</script>

<style scoped>
/* Deep brand navy, the page's closing frame. Every text colour below is
   checked against #0B2A55: the lightest grey used is 5.6:1. */
.footer {
  --ft-text: #F1F5FB;
  --ft-text-2: #B7C6DB;
  --ft-muted: #93A7C2;
  --ft-line: rgba(255, 255, 255, 0.12);
  padding: 72px 1.5rem 0;
  background: var(--lp-navy);
}

.footer-inner {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 2fr 1fr 1.4fr;
  gap: 56px;
  padding-bottom: 48px;
}

/* ── Brand ── */
.footer-logo { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.footer-logo-image { width: 40px; height: 40px; object-fit: contain; }
.logo-text {
  display: block;
  font-size: 20px;
  font-weight: 800;
  line-height: 1.1;
  color: var(--ft-text);
}
.logo-accent { color: #FF6B6B; }
.logo-sub {
  display: block;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ft-muted);
}
.footer-desc {
  max-width: 36ch;
  margin: 0 0 16px;
  font-size: 14px;
  line-height: 1.65;
  color: var(--ft-text-2);
}
.footer-cap {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 13px;
  color: var(--ft-muted);
}
.cap-icon { color: #FF6B6B; }

/* ── Columns ── */
.footer-title {
  margin: 0 0 16px;
  font-size: 13px;
  font-weight: 700;
  color: var(--ft-text);
}
.footer-col ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
}
.footer-col a {
  font-size: 14px;
  color: var(--ft-text-2);
  text-decoration: none;
  transition: color 0.2s ease;
}
.footer-col a:hover { color: #fff; }
.footer-col a:focus-visible { outline: 2px solid #fff; outline-offset: 2px; border-radius: 4px; }

.contact-list li {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 14px;
  line-height: 1.5;
  color: var(--ft-text-2);
}
.contact-icon { flex-shrink: 0; margin-top: 2px; color: #7AB0FF; }

/* ── Bottom bar ── */
.footer-bottom {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  border-top: 1px solid var(--ft-line);
  font-size: 13px;
  color: var(--ft-muted);
}
.footer-bottom-links { display: flex; gap: 24px; }
.footer-bottom-links a { color: var(--ft-muted); text-decoration: none; }
.footer-bottom-links a:hover { color: #fff; }

@media (max-width: 960px) {
  .footer-inner { grid-template-columns: 1fr 1fr; gap: 40px; }
  .footer-brand { grid-column: 1 / -1; }
}
/* Phones: same content, packed tighter. Links go two per row, spacing and
   type step down, and the bottom bar shrinks to two short lines. */
@media (max-width: 600px) {
  .footer { padding: 32px 1rem 0; }
  .footer-inner { grid-template-columns: 1fr; gap: 22px; padding-bottom: 24px; }

  .footer-logo { margin-bottom: 10px; }
  .footer-logo-image { width: 34px; height: 34px; }
  .logo-text { font-size: 18px; }
  .footer-desc { margin-bottom: 10px; font-size: 13px; line-height: 1.55; }
  .footer-cap { font-size: 12px; }

  .footer-title { margin-bottom: 10px; }
  .footer-col ul { gap: 8px; }
  nav.footer-col ul { grid-template-columns: 1fr 1fr; column-gap: 16px; }
  .footer-col a,
  .contact-list li { font-size: 13px; }

  .footer-bottom {
    flex-direction: column;
    gap: 6px;
    padding: 14px 0 18px;
    font-size: 12px;
    text-align: center;
  }
  .footer-bottom-links { flex-wrap: wrap; justify-content: center; gap: 4px 16px; }
}
</style>
