<template>
  <!--
    Ang frame sa tanan nga auth page (login, donor registration, get started):
    light nga background, usa ka card, brand panel sa wala nga naay headline
    ug litrato, ug ang form sa tuo. Sa mobile, ang form ra ang makita sulod sa
    usa ka frosted-glass nga card.

    Ang mga form primitive (.au-field, .au-input, .au-btn, …) kay naa sa
    unscoped nga style sa ubos, naka-prefix og .auth-shell, para magamit sa
    bisan unsang page nga mosulod sa slot.
  -->
  <main class="auth-shell" :class="{ 'auth-shell--fit': fit }">
    <div class="auth-card" :class="{ 'auth-card--wide': wide }">
      <!-- ── Brand panel (desktop) ── -->
      <aside class="au-brand">
        <NuxtLink to="/" class="au-brand-lockup" aria-label="RedAgos home">
          <img :src="logo" alt="" class="au-brand-logo" width="40" height="40" />
          <span>
            <span class="au-brand-name">Red<span>Agos</span></span>
            <span class="au-brand-sub">Blood Bank System</span>
          </span>
        </NuxtLink>

        <div class="au-brand-copy">
          <h2>{{ hero.lead }} <span>{{ hero.accent }}</span></h2>
          <p>{{ hero.desc }}</p>
        </div>

        <slot name="brand-extra" />

        <div class="au-brand-photo">
          <img :src="hero.src" :alt="hero.alt" width="640" height="440" />
        </div>
      </aside>

      <!-- ── Form panel ── -->
      <section class="au-panel">
        <!--
          Top bar. Desktop: just the back link, top-left of the form.
          Mobile: one app-bar row, back button left and logo centred on the
          same line (a spacer on the right keeps the logo truly centred).
        -->
        <div class="au-topbar">
          <NuxtLink :to="backTo" class="au-back" :aria-label="backLabel">
            <AssetIcon name="arrow-left" :size="18" />
            <span class="au-back-text">{{ backLabel }}</span>
          </NuxtLink>

          <div class="au-mobile-brand">
            <img :src="logo" alt="" class="au-brand-logo" width="36" height="36" />
            <span class="au-brand-name">Red<span>Agos</span></span>
          </div>

          <span class="au-topbar-spacer" aria-hidden="true"></span>
        </div>

        <div class="au-inner">
          <slot />
        </div>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import AssetIcon from '~/components/common/AssetIcon.vue'
import logo from '~/assets/images/RedAgosLogo.png'

export interface AuthHero {
  /** Headline, plain part. */
  lead: string
  /** Headline, the blue part after `lead`. */
  accent: string
  desc: string
  src: string
  alt: string
}

withDefaults(defineProps<{
  hero: AuthHero
  backTo?: string
  backLabel?: string
  /** A wider form column, for long forms like donor registration. */
  wide?: boolean
  /** Fits the window and never scrolls: the sign-in screen (2026-10-24). */
  fit?: boolean
}>(), {
  backTo: '/',
  backLabel: 'Back to home',
  wide: false,
  fit: false,
})
</script>

<style>
/*
  Unscoped on purpose: these rules style the form markup that pages pass in
  through the slot. Every selector starts with .auth-shell so nothing leaks.

  Tokens follow the landing page (--lp-*): blue #1565C0 for every action, red
  for the brand only. Shape rule: card 28px, fields and buttons 12px. Always
  light, like the landing page; dark mode is for the portals behind sign-in.
*/
.auth-shell {
  --au-card: #FFFFFF;
  --au-panel: #EEF4FB;
  --au-text: #0B1F3A;
  --au-text-2: #475569;
  --au-muted: #64748B;
  --au-border: #DCE5F0;
  --au-field: #F8FAFD;
  --au-field-focus: #FFFFFF;
  --au-accent: #1565C0;
  --au-accent-hover: #0D47A1;
  --au-accent-text: #1565C0;
  --au-accent-soft: rgba(21, 101, 192, 0.12);
  --au-brand: #C62828;
  --au-danger: #B42318;
  --au-shadow: 0 1px 2px rgba(11, 31, 58, 0.04), 0 40px 80px -36px rgba(21, 101, 192, 0.35);
  --au-radius: 12px;
  --au-ease: cubic-bezier(0.16, 1, 0.3, 1);

  /* html.dark sets color-scheme: dark, which would draw autofill, date
     pickers and select menus dark on this light card. */
  color-scheme: light;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 24px;
  font-family: var(--rb-font-sans);
  color: var(--au-text);
  -webkit-font-smoothing: antialiased;
  /* Light, like the landing hero: a soft blue-white wash with a faint touch
     of brand red. */
  background:
    radial-gradient(45% 55% at 100% 0%, rgba(21, 101, 192, 0.16), transparent 70%),
    radial-gradient(40% 50% at 0% 100%, rgba(198, 40, 40, 0.08), transparent 70%),
    linear-gradient(180deg, #EAF2FC 0%, #F5F8FC 100%);
}

.auth-shell *,
.auth-shell *::before,
.auth-shell *::after { box-sizing: border-box; }

.auth-shell .auth-card {
  width: 100%;
  max-width: 1120px;
  min-height: 680px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr);
  /* Not overflow: hidden. A dropdown opened near the bottom of the form must
     be able to hang past the card's edge; the brand panel rounds its own
     corners instead. */
  background: var(--au-card);
  border: 1px solid var(--au-border);
  border-radius: 28px;
  box-shadow: var(--au-shadow);
}
.auth-shell .auth-card--wide {
  max-width: 1200px;
  grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.25fr);
}

@media (prefers-reduced-motion: no-preference) {
  .auth-shell .auth-card { animation: au-card-enter 520ms var(--au-ease) both; }
}
@keyframes au-card-enter {
  from { opacity: 0; transform: translateY(12px); }
}

/* ── Brand panel ── */
.auth-shell .au-brand {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 40px 44px 0;
  overflow: hidden;
  border-radius: 27px 0 0 27px;
  background: var(--au-panel);
}
/* Two soft discs, the panel's only decoration. */
.auth-shell .au-brand::before,
.auth-shell .au-brand::after {
  content: '';
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}
.auth-shell .au-brand::before {
  width: 320px;
  height: 320px;
  right: -120px;
  top: -120px;
  background: var(--au-accent-soft);
}
.auth-shell .au-brand::after {
  width: 220px;
  height: 220px;
  left: -90px;
  bottom: 120px;
  background: rgba(198, 40, 40, 0.07);
}

.auth-shell .au-brand-lockup {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  align-self: flex-start;
  border-radius: 10px;
  text-decoration: none;
}
.auth-shell .au-brand-logo { width: 40px; height: 40px; object-fit: contain; }
.auth-shell .au-brand-name {
  display: block;
  font-size: 20px;
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -0.01em;
  color: var(--au-text);
}
.auth-shell .au-brand-name span { color: var(--au-brand); }
.auth-shell .au-brand-sub {
  display: block;
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--au-muted);
}

.auth-shell .au-brand-copy { position: relative; margin: 48px 0 32px; }
.auth-shell .au-brand-copy h2 {
  max-width: 14ch;
  margin: 0 0 16px;
  font-size: clamp(30px, 3.2vw, 42px);
  font-weight: 800;
  line-height: 1.08;
  letter-spacing: -0.03em;
  color: var(--au-text);
  text-wrap: balance;
}
.auth-shell .au-brand-copy h2 span { color: var(--au-accent-text); }
.auth-shell .au-brand-copy p {
  max-width: 42ch;
  margin: 0;
  /* Avoids a lone last word on its own line. */
  text-wrap: pretty;
  font-size: 15px;
  line-height: 1.65;
  color: var(--au-text-2);
}

/* The photo takes whatever height the panel has left, so the gap under the
   copy stays fixed however tall the form makes the card. */
.auth-shell .au-brand-photo {
  position: relative;
  flex: 1;
  min-height: 220px;
}
.auth-shell .au-brand-photo img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 20px 20px 0 0;
  background: var(--au-border);
}

/* ── Form panel ── */
.auth-shell .au-panel {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 72px 56px 40px;
}

/* Desktop: the top bar is just the back link, pinned top-left. */
.auth-shell .au-topbar {
  position: absolute;
  top: 24px;
  left: 28px;
}
.auth-shell .au-topbar-spacer,
.auth-shell .au-mobile-brand { display: none; }

.auth-shell .au-back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px 6px 8px;
  border-radius: 999px;
  color: var(--au-muted);
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  transition: color 150ms ease, background-color 150ms ease;
}
.auth-shell .au-back:hover { color: var(--au-text); background: var(--au-accent-soft); }

.auth-shell .au-inner { width: 100%; max-width: 400px; }
.auth-shell .auth-card--wide .au-inner { max-width: 560px; }

/* ════════════ Form primitives (used by the pages in the slot) ════════════ */

.auth-shell .au-header { text-align: center; margin-bottom: 32px; }
.auth-shell .au-header h1 {
  margin: 0;
  font-size: clamp(26px, 2.4vw, 32px);
  font-weight: 800;
  line-height: 1.15;
  letter-spacing: -0.025em;
  color: var(--au-text);
  text-wrap: balance;
}
.auth-shell .au-header p {
  margin: 8px 0 0;
  font-size: 15px;
  line-height: 1.55;
  color: var(--au-text-2);
}

/* Small pill above a title, e.g. "Restricted access" on the admin login.
   Selector includes .au-header so it outranks `.au-header p` (the
   subtitle's grey and margin). */
.auth-shell .au-header .au-badge,
.auth-shell .au-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 14px;
  padding: 5px 12px 5px 10px;
  border-radius: 999px;
  background: #FDECEC;
  color: var(--au-brand);
  font-size: 12.5px;
  font-weight: 700;
}

.auth-shell .au-form { display: grid; gap: 18px; }
/* Two fields side by side; one column on phones (see the mobile block). */
.auth-shell .au-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px 16px;
}

.auth-shell .au-field { display: grid; gap: 8px; align-content: start; }
.auth-shell .au-label-row { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.auth-shell .au-field label,
.auth-shell .au-label {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--au-text);
}
.auth-shell .au-optional {
  margin-left: 4px;
  font-size: 12px;
  font-weight: 500;
  color: var(--au-muted);
}
.auth-shell .au-hint { margin: 0; font-size: 12.5px; line-height: 1.45; color: var(--au-muted); }
.auth-shell .au-error { margin: 0; font-size: 12.5px; line-height: 1.45; font-weight: 600; color: var(--au-danger); }

/* A field: icon (optional) + input/select + trailing button (optional). */
.auth-shell .au-input {
  position: relative;
  display: flex;
  align-items: center;
  height: 50px;
  padding: 0 6px 0 14px;
  background: var(--au-field);
  border: 1px solid var(--au-border);
  border-radius: var(--au-radius);
  transition: border-color 150ms ease, background-color 150ms ease, box-shadow 150ms ease;
}
.auth-shell .au-input:hover { border-color: #C3D3E6; }
.auth-shell .au-input:focus-within {
  background: var(--au-field-focus);
  border-color: var(--au-accent);
  box-shadow: 0 0 0 4px var(--au-accent-soft);
}
.auth-shell .au-input--invalid { border-color: var(--au-danger); }
.auth-shell .au-icon { flex-shrink: 0; margin-right: 10px; color: var(--au-muted); transition: color 150ms ease; }
.auth-shell .au-input:focus-within .au-icon { color: var(--au-accent-text); }

.auth-shell .au-input input,
.auth-shell .au-input select {
  flex: 1;
  min-width: 0;
  height: 100%;
  padding: 0 8px 0 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--au-text);
  font: inherit;
  font-size: 15px;
}
.auth-shell .au-input input::placeholder { color: var(--au-muted); }
/* Selects get their own chevron so they match the inputs. */
.auth-shell .au-input select {
  appearance: none;
  -webkit-appearance: none;
  padding-right: 28px;
  cursor: pointer;
}
.auth-shell .au-input--select::after {
  content: '';
  position: absolute;
  right: 16px;
  top: 50%;
  width: 8px;
  height: 8px;
  border-right: 2px solid var(--au-muted);
  border-bottom: 2px solid var(--au-muted);
  transform: translateY(-70%) rotate(45deg);
  pointer-events: none;
}
.auth-shell .au-input select:invalid,
.auth-shell .au-input select.is-empty { color: var(--au-muted); }

/* The shared DatePicker (components/common) takes the auth field look. */
.auth-shell .dp {
  --dp-field: var(--au-field);
  --dp-border: var(--au-border);
  --dp-text: var(--au-text);
  --dp-muted: var(--au-muted);
  --dp-accent: var(--au-accent);
  --dp-ring: var(--au-accent-soft);
}

.auth-shell .au-icon-btn {
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: var(--au-muted);
  cursor: pointer;
}
.auth-shell .au-icon-btn:hover { color: var(--au-text); background: var(--au-accent-soft); }

.auth-shell .au-link {
  padding: 2px 4px;
  margin-right: -4px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--au-accent-text);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
}
.auth-shell .au-link:hover { text-decoration: underline; text-underline-offset: 3px; }

.auth-shell .au-btn {
  width: 100%;
  height: 50px;
  margin-top: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border: 0;
  border-radius: var(--au-radius);
  background: var(--au-accent);
  color: #fff;
  font: inherit;
  font-size: 15px;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
  box-shadow: 0 12px 24px -12px rgba(21, 101, 192, 0.75);
  transition: background-color 150ms ease, transform 120ms var(--au-ease);
}
.auth-shell .au-btn:hover:not(:disabled) { background: var(--au-accent-hover); }
.auth-shell .au-btn:active:not(:disabled) { transform: scale(0.985); }
.auth-shell .au-btn:disabled { opacity: 0.6; cursor: not-allowed; box-shadow: none; }

.auth-shell .au-btn--outline {
  background: var(--au-card);
  color: var(--au-text);
  border: 1px solid var(--au-border);
  box-shadow: none;
}
.auth-shell .au-btn--outline:hover:not(:disabled) { background: var(--au-accent-soft); border-color: var(--au-accent); }

.auth-shell .au-spinner { animation: au-spin 900ms linear infinite; }
@keyframes au-spin { to { transform: rotate(360deg); } }

/* The form grid already spaces its children, so alerts lose their margin. */
.auth-shell .au-form > .login-alert,
.auth-shell .au-form > .session-notice { margin: 0; }

.auth-shell .au-divider {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 6px;
  color: var(--au-muted);
  font-size: 12.5px;
  font-weight: 500;
}
.auth-shell .au-divider::before,
.auth-shell .au-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--au-border);
}

/* Portal / role buttons: a row of outlined tiles with an icon. */
.auth-shell .au-roles {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.auth-shell .au-role {
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid var(--au-border);
  border-radius: var(--au-radius);
  background: var(--au-card);
  color: var(--au-text);
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  transition: border-color 150ms ease, background-color 150ms ease;
}
.auth-shell .au-role:hover { border-color: var(--au-accent); background: var(--au-accent-soft); }
.auth-shell .au-role-icon { color: var(--au-accent-text); }
.auth-shell .au-role--donor .au-role-icon { color: var(--au-brand); }

.auth-shell .au-footer {
  margin: 28px 0 0;
  text-align: center;
  font-size: 14px;
  color: var(--au-text-2);
}
.auth-shell .au-footer p { margin: 0; }
.auth-shell .au-footer a {
  margin-left: 2px;
  color: var(--au-accent-text);
  font-weight: 700;
  text-decoration: none;
}
.auth-shell .au-footer a:hover { text-decoration: underline; text-underline-offset: 3px; }

/* ── Focus ── */
.auth-shell .au-brand-lockup:focus-visible,
.auth-shell .au-back:focus-visible,
.auth-shell .au-link:focus-visible,
.auth-shell .au-icon-btn:focus-visible,
.auth-shell .au-btn:focus-visible,
.auth-shell .au-role:focus-visible,
.auth-shell .au-footer a:focus-visible {
  outline: 2px solid var(--au-accent);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .auth-shell .au-spinner,
  .auth-shell .au-btn,
  .auth-shell .au-role,
  .auth-shell .au-input { animation: none; transition: none; }
}

/* ── Tablet / mobile: a frosted-glass card on the light background ──
   Glass needs colour behind it to blur, so the page gains two soft discs
   (brand blue and a faint red) behind the card. Honest note: this is a web
   approximation (backdrop-filter), not Apple's native Liquid Glass. */
@media (max-width: 900px) {
  .auth-shell {
    position: relative;
    overflow: hidden;
    align-items: flex-start;
    padding: 0;
  }
  .auth-shell::before,
  .auth-shell::after {
    content: '';
    position: absolute;
    border-radius: 50%;
    pointer-events: none;
  }
  .auth-shell::before {
    width: 420px;
    height: 420px;
    top: 120px;
    right: -150px;
    background: radial-gradient(circle, rgba(21, 101, 192, 0.42), rgba(21, 101, 192, 0) 68%);
  }
  .auth-shell::after {
    width: 380px;
    height: 380px;
    top: 430px;
    left: -150px;
    background: radial-gradient(circle, rgba(229, 57, 53, 0.26), rgba(229, 57, 53, 0) 68%);
  }

  .auth-shell .auth-card,
  .auth-shell .auth-card--wide {
    position: relative;
    z-index: 1;
    min-height: 100dvh;
    grid-template-columns: 1fr;
    background: transparent;
    border: 0;
    border-radius: 0;
    box-shadow: none;
    overflow: visible;
    /* An ancestor that is mid-fade becomes the backdrop root, so the blur
       would see nothing and the glass would flash white. No entry fade here. */
    animation: none;
  }
  .auth-shell .au-brand { display: none; }

  .auth-shell .au-panel {
    flex-direction: column;
    justify-content: flex-start;
    padding: 12px 16px 32px;
  }

  /* One app-bar row: [back] [logo, centred] [spacer the back button's width]. */
  .auth-shell .au-topbar {
    position: static;
    width: 100%;
    max-width: 440px;
    display: grid;
    grid-template-columns: 44px 1fr 44px;
    align-items: center;
    margin-bottom: 16px;
  }
  .auth-shell .auth-card--wide .au-topbar { max-width: 560px; }
  .auth-shell .au-topbar-spacer { display: block; }

  /* Icon-only on phones; the aria-label still names the destination. */
  .auth-shell .au-back {
    width: 44px;
    height: 44px;
    justify-content: center;
    padding: 0;
    color: var(--au-text);
    background: rgba(255, 255, 255, 0.7);
    border: 1px solid var(--au-border);
    -webkit-backdrop-filter: blur(12px);
    backdrop-filter: blur(12px);
  }
  .auth-shell .au-back:hover { background: #fff; }
  .auth-shell .au-back-text {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }

  .auth-shell .au-mobile-brand {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  .auth-shell .au-mobile-brand .au-brand-logo { width: 36px; height: 36px; }
  .auth-shell .au-mobile-brand .au-brand-name { font-size: 19px; }

  /* The glass card. */
  .auth-shell .au-inner {
    max-width: 440px;
    padding: 28px 20px 24px;
    border-radius: 28px;
    border: 1px solid rgba(255, 255, 255, 0.8);
    background: linear-gradient(160deg, rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0.5));
    -webkit-backdrop-filter: blur(24px) saturate(160%);
    backdrop-filter: blur(24px) saturate(160%);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.95),
      0 24px 56px -28px rgba(21, 101, 192, 0.45);
  }
  .auth-shell .auth-card--wide .au-inner { max-width: 560px; }
  .auth-shell .au-header { margin-bottom: 24px; }
  .auth-shell .au-row { grid-template-columns: 1fr; }

  /* Fields sit slightly clearer than the card, so they read as wells. */
  .auth-shell .au-input { background: rgba(255, 255, 255, 0.8); border-color: rgba(11, 42, 85, 0.12); }
  .auth-shell .au-input:focus-within { background: #fff; }
  .auth-shell .dp { --dp-field: rgba(255, 255, 255, 0.8); --dp-border: rgba(11, 42, 85, 0.12); }
  .auth-shell .au-role,
  .auth-shell .au-btn--outline { background: rgba(255, 255, 255, 0.6); border-color: rgba(11, 42, 85, 0.12); }
  .auth-shell .au-divider::before,
  .auth-shell .au-divider::after { background: rgba(11, 42, 85, 0.12); }

  /* 16px so iOS Safari does not zoom in on focus. */
  .auth-shell .au-input input,
  .auth-shell .au-input select { font-size: 16px; }
}

/* No blur support at all: solid card, so text never sits on the raw page. */
@media (max-width: 900px) {
  @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
    .auth-shell .au-inner { background: var(--au-card); }
  }
}
/* "Reduce transparency" (on Windows: Settings > Personalization > Colors >
   Transparency effects off) keeps the frosted look but more opaque. */
@media (max-width: 900px) and (prefers-reduced-transparency: reduce) {
  .auth-shell .au-inner {
    background: linear-gradient(160deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.82));
  }
}

@media (max-width: 380px) {
  .auth-shell .au-inner { padding: 24px 16px 20px; }
  .auth-shell .au-roles { grid-template-columns: 1fr; }
}

/* ════════════ Fit: the sign-in screen never scrolls (2026-10-24) ════════════
   The page is the window's height, the card shrinks to it, and the brand
   panel's photo gives way first. A phone too short for the form still
   scrolls inside rather than cutting the Sign In button off. */
html:has(.auth-shell--fit),
body:has(.auth-shell--fit) { overflow: hidden; }
.auth-shell--fit { height: 100dvh; min-height: 0; padding: 20px 24px; overflow: hidden; }
.auth-shell--fit .auth-card { height: 100%; max-height: 720px; min-height: 0; }
.auth-shell--fit .au-brand { padding: 30px 36px 0; }
.auth-shell--fit .au-brand-copy { margin: 28px 0 20px; }
.auth-shell--fit .au-brand-copy h2 { font-size: clamp(28px, 2.8vw, 38px); }
.auth-shell--fit .au-brand-photo { min-height: 0; }
/* `safe`: a form taller than the panel starts below the back link, never under it. */
.auth-shell--fit .au-panel { align-items: safe center; padding: 64px 48px 28px; overflow-y: auto; }
.auth-shell--fit .au-header { margin-bottom: 28px; }
.auth-shell--fit .au-header p { margin-top: 10px; }
.auth-shell--fit .au-form { gap: 18px; }
.auth-shell--fit .au-footer { margin-top: 22px; line-height: 1.5; }

/* A shorter window: the fields and the type a step smaller, the spacing kept,
   so the screen still fits without anything crowding. */
@media (max-height: 700px) and (min-width: 901px) {
  .auth-shell--fit { padding: 14px 24px; }
  .auth-shell--fit .au-brand-copy p { display: none; }
  .auth-shell--fit .au-panel { padding: 58px 48px 18px; }
  .auth-shell--fit .au-header { margin-bottom: 22px; }
  .auth-shell--fit .au-header h1 { font-size: 27px; }
  .auth-shell--fit .au-header p { margin-top: 8px; font-size: 14px; }
  .auth-shell--fit .au-form { gap: 16px; }
  .auth-shell--fit .au-input { height: 44px; }
  .auth-shell--fit .au-btn { height: 46px; }
  .auth-shell--fit .au-footer { margin-top: 18px; font-size: 13.5px; }
}
@media (max-height: 600px) and (min-width: 901px) {
  .auth-shell--fit .au-panel { padding-top: 66px; }
  .auth-shell--fit .au-header { margin-bottom: 18px; }
  .auth-shell--fit .au-header h1 { font-size: 25px; }
  .auth-shell--fit .au-form { gap: 13px; }
  .auth-shell--fit .au-footer { margin-top: 14px; }
  .auth-shell.auth-shell--fit .au-footer__note { display: none; }
}
@media (max-width: 900px) {
  .auth-shell--fit { padding: 0; }
  .auth-shell--fit .auth-card { max-height: none; min-height: 0; }
  .auth-shell--fit .au-panel { height: 100%; padding: 12px 16px 16px; overflow-y: auto; }
  .auth-shell--fit .au-inner { padding: 24px 20px 22px; }
  .auth-shell--fit .au-header { margin-bottom: 20px; }
}

/* Log in as: User or Admin, as role buttons; the one picked in blue. */
.auth-shell button.au-role { width: 100%; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; }
/* On the sign-in screen the two are small and side by side, under the divider. */
.auth-shell .au-roles--compact { display: flex; justify-content: center; gap: 10px; margin-top: -4px; }
.auth-shell .au-roles--compact .au-role { width: auto; min-width: 116px; height: 38px; padding: 0 16px; gap: 7px; border-radius: 999px; font-size: 13.5px; }
.auth-shell .au-role--on,
.auth-shell .au-role--on:hover { border-color: var(--au-accent); background: var(--au-accent-soft); color: var(--au-accent-text); box-shadow: inset 0 0 0 1px var(--au-accent); }
.auth-shell button.au-role:disabled { cursor: not-allowed; opacity: 0.6; }
.auth-shell button.au-role:focus-visible { outline: 2px solid var(--au-accent); outline-offset: 2px; }
.auth-shell .au-footer__note { display: block; margin-top: 8px; font-size: 12.5px; color: var(--au-muted); }
</style>
