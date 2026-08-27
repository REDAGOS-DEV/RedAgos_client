<template>
  <header class="navbar" :class="{ scrolled: isScrolled, 'menu-open': isMenuOpen }">
    <div class="nav-inner">
      <div class="nav-logo">
        <div class="logo-icon">
          <img :src="logo" alt="RedAgos Logo" class="logo-image" />
        </div>
        <div>
          <span class="logo-name">Red<span class="logo-accent">Agos</span></span>
          <span class="logo-sub">BLOOD BANK SYSTEM</span>
        </div>
      </div>

      <!-- Desktop navigation -->
      <ul class="nav-links" id="primary-navigation">
        <li v-for="item in navItems" :key="item.id">
          <a
            :href="`#${item.id}`"
            :class="{ active: activeSection === item.id }"
            :aria-current="activeSection === item.id ? 'page' : undefined"
            @click.prevent="scrollToSection(item.id)"
          >
            {{ item.label }}
          </a>
        </li>
      </ul>

      <div class="nav-actions">
        <button type="button" class="btn-login" @click="navigateTo('/auth/donor/login/')">
          Log In
        </button>
        <button type="button" class="btn-started" @click="goHome">Get Started</button>
      </div>

      <!-- Mobile hamburger -->
      <button
        type="button"
        class="nav-toggle"
        aria-controls="mobile-menu"
        :aria-expanded="isMenuOpen"
        :aria-label="isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'"
        @click="toggleMenu"
      >
        <svg v-if="!isMenuOpen" class="nav-toggle-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 7H20" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          <path d="M4 12H20" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          <path d="M4 17H20" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        </svg>
        <svg v-else class="nav-toggle-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 6L18 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          <path d="M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        </svg>
      </button>
    </div>

    <!-- Mobile menu panel + scrim -->
    <Teleport to="body">
      <transition name="scrim-fade">
        <div
          v-show="isMenuOpen"
          class="mobile-scrim"
          @click="closeMenu"
        ></div>
      </transition>

      <transition name="menu-fade">
        <div
          v-show="isMenuOpen"
          id="mobile-menu"
          class="mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          <ul class="mobile-links">
            <li v-for="item in navItems" :key="item.id">
              <a
                :href="`#${item.id}`"
                :class="{ active: activeSection === item.id }"
                :aria-current="activeSection === item.id ? 'page' : undefined"
                @click.prevent="handleMobileNavClick(item.id)"
              >
                {{ item.label }}
              </a>
            </li>
          </ul>

          <div class="mobile-divider"></div>

          <div class="mobile-actions">
            <button
              type="button"
              class="btn-started btn-started--mobile"
              @click="handleMobileAction(goHome)"
            >
              Get Started
            </button>
            <button
              type="button"
              class="btn-login btn-login--mobile"
              @click="handleMobileAction(() => navigateTo('/auth/donor/login/'))"
            >
              Sign In
            </button>
          </div>
        </div>
      </transition>
    </Teleport>
  </header>
</template>

<script setup>
import logo from '~/assets/images/RedAgosLogo.png'

const navItems = [
  { id: 'home', label: 'Home' },
  { id: 'features', label: 'Features' },
  { id: 'drives', label: 'Donation Drives' },
  { id: 'about', label: 'About' },
  { id: 'contact', label: 'Contact' },
]

const isScrolled = ref(false)
const isMenuOpen = ref(false)
const activeSection = ref('home')
const sectionIds = navItems.map((item) => item.id)

let scrollHandler
let resizeHandler
let ticking = false

const MOBILE_BREAKPOINT = 900

const goHome = () => {
  setTimeout(() => {
    navigateTo('/')
  }, 3000)
}

const getSections = () =>
  sectionIds
    .map((id) => document.getElementById(id))
    .filter(Boolean)

const updateActiveSection = () => {
  isScrolled.value = window.scrollY > 10

  const sections = getSections()
  const navOffset = 96
  let current = sections[0]?.id || 'home'

  for (const section of sections) {
    const rect = section.getBoundingClientRect()

    if (rect.top <= navOffset && rect.bottom > navOffset) {
      current = section.id
      break
    }

    if (rect.top <= navOffset) current = section.id
  }

  activeSection.value = current
}

const requestScrollUpdate = () => {
  if (ticking) return

  ticking = true
  window.requestAnimationFrame(() => {
    updateActiveSection()
    ticking = false
  })
}

const setActiveSection = (id) => {
  activeSection.value = id
}

const scrollToSection = (id) => {
  const section = document.getElementById(id)
  if (section) {
    section.scrollIntoView({ behavior: 'smooth' })
  }
  setActiveSection(id)

  const path = id === '' ? '/' : `/${id}`
  window.history.replaceState(null, '', path)
}

const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value
}

const closeMenu = () => {
  isMenuOpen.value = false
}

const handleMobileNavClick = (id) => {
  scrollToSection(id)
  closeMenu()
}

const handleMobileAction = (action) => {
  closeMenu()
  action()
}

const handleResize = () => {
  requestScrollUpdate()
  if (window.innerWidth > MOBILE_BREAKPOINT && isMenuOpen.value) {
    closeMenu()
  }
}

const handleKeydown = (event) => {
  if (event.key === 'Escape' && isMenuOpen.value) {
    closeMenu()
  }
}

watch(isMenuOpen, (open) => {
  document.documentElement.style.overflow = open ? 'hidden' : ''
})

onMounted(() => {
  scrollHandler = requestScrollUpdate
  resizeHandler = handleResize

  updateActiveSection()
  window.addEventListener('scroll', scrollHandler, { passive: true })
  window.addEventListener('resize', resizeHandler)
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('scroll', scrollHandler)
  window.removeEventListener('resize', resizeHandler)
  window.removeEventListener('keydown', handleKeydown)
  document.documentElement.style.overflow = ''
})
</script>

<style scoped>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:global(:root) {
  --rf-navy: #1A237E;
  --rf-blue: #3949AB;
  --rf-blue-bright: #2563EB;
  --rf-blue-bright-hover: #1D4ED8;
  --rf-white: #FFFFFF;
  --rf-text: #1F2937;
  --rf-text-secondary: #64748B;
  --rf-text-muted: #94A3B8;
  --rf-border: #E2E8F0;
  --rf-red: #D32F2F;
}

/* ── NAVBAR: floating rounded pill, inset from the viewport edges ── */
.navbar {
  position: fixed;
  top: 14px;
  left: 50%;
  transform: translateX(-50%);
  width: calc(100% - 32px);
  max-width: 1500px;
  z-index: 100;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid var(--rf-border);
  border-radius: 20px;
  backdrop-filter: blur(12px);
  box-shadow: 0 4px 20px rgba(15, 23, 42, 0.06);
  transition: box-shadow 200ms ease, background 200ms ease, top 200ms ease, border-radius 200ms ease;
}
.navbar.scrolled {
  top: 10px;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.12);
  border-color: #DCE3EC;
}

.nav-inner {
  height: 64px;
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

/* LOGO */
.nav-logo { display: flex; align-items: center; gap: 10px; min-width: 0; }
.logo-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: transform 150ms ease;
}
.logo-icon:hover { transform: scale(1.06); }
.logo-image { width: 100%; height: 100%; object-fit: contain; }
.logo-name {
  font-size: 16px;
  font-weight: 700;
  display: block;
  line-height: 1.15;
  color: var(--rf-text);
  white-space: nowrap;
}
.logo-accent { color: var(--rf-red); }
.logo-sub {
  font-size: 9px;
  font-weight: 500;
  color: var(--rf-text-muted);
  display: block;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
}

/* DESKTOP NAV */
.nav-links {
  display: flex;
  align-items: center;
  gap: 2px;
  list-style: none;
  background: #F8FAFC;
  border: 1px solid var(--rf-border);
  border-radius: 999px;
  padding: 4px;
}
.nav-links a {
  text-decoration: none;
  color: #475569;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  display: inline-block;
  padding: 7px 14px;
  border-radius: 999px;
  transition: background 150ms ease, color 150ms ease;
}
.nav-links a:hover { color: var(--rf-blue); background: #EEF2F7; }
.nav-links a.active {
  color: var(--rf-white);
  font-weight: 600;
  background: var(--rf-blue-bright);
}
.nav-links a:focus-visible {
  outline: 2px solid var(--rf-blue);
  outline-offset: 2px;
}

/* DESKTOP ACTIONS — pill buttons */
.nav-actions { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.btn-login {
  min-height: 40px;
  font-size: 13px;
  font-weight: 500;
  color: #475569;
  background: none;
  border: 1px solid transparent;
  cursor: pointer;
  padding: 0 16px;
  border-radius: 999px;
  transition: background 150ms ease, color 150ms ease, border-color 150ms ease;
}
.btn-login:hover { background: #F1F5F9; color: var(--rf-blue); border-color: var(--rf-border); }
.btn-login:focus-visible { outline: 2px solid var(--rf-blue); outline-offset: 2px; }

.btn-started {
  height: 40px;
  font-size: 13px;
  font-weight: 600;
  color: var(--rf-white);
  background: var(--rf-blue-bright);
  border: 1px solid var(--rf-blue-bright);
  cursor: pointer;
  padding: 0 20px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  box-shadow: 0 2px 8px rgba(37, 99, 235, 0.25);
  transition: background 150ms ease, transform 150ms ease, box-shadow 150ms ease;
}
.btn-started:hover {
  background: var(--rf-blue-bright-hover);
  border-color: var(--rf-blue-bright-hover);
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(37, 99, 235, 0.32);
}
.btn-started:active { transform: translateY(0); }
.btn-started:focus-visible { outline: 2px solid var(--rf-blue); outline-offset: 2px; }

/* MOBILE HAMBURGER */
.nav-toggle {
  display: none;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  background: var(--rf-white);
  border: 1px solid var(--rf-border);
  cursor: pointer;
  border-radius: 12px;
  align-items: center;
  justify-content: center;
  color: var(--rf-blue-bright);
  transition: border-color 150ms ease, background 150ms ease;
}
.nav-toggle:hover { background: #F8FAFC; border-color: #CBD5E1; }
.nav-toggle:focus-visible { outline: 2px solid var(--rf-blue); outline-offset: 2px; }
.nav-toggle-icon { width: 20px; height: 20px; }

/* MOBILE SCRIM — dim backdrop behind the panel, tap to close */
.mobile-scrim {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(2px);
  z-index: 199;
}

/* MOBILE MENU PANEL — floating rounded card, matching the navbar shell */
.mobile-menu {
  position: fixed;
  top: 88px;
  left: 12px;
  right: 12px;
  bottom: 12px;
  background: var(--rf-white);
  border: 1px solid var(--rf-border);
  border-radius: 20px;
  padding: 28px 24px 32px;
  overflow-y: auto;
  z-index: 200;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.2);
}
.mobile-links { list-style: none; display: flex; flex-direction: column; gap: 6px; }
.mobile-links a {
  display: block;
  min-height: 24px;
  text-decoration: none;
  font-size: 15px;
  font-weight: 500;
  color: var(--rf-text);
  padding: 10px 12px;
  border-radius: 12px;
  transition: background 150ms ease, color 150ms ease;
}
.mobile-links a:hover { background: #F1F5F9; color: var(--rf-blue-bright); }
.mobile-links a.active { color: var(--rf-blue-bright); background: #EFF6FF; font-weight: 600; }
.mobile-links a:focus-visible { outline: 2px solid var(--rf-blue); outline-offset: 2px; }

.mobile-divider {
  height: 1px;
  background: var(--rf-border);
  margin: 24px 0 20px;
}

.mobile-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.btn-login--mobile,
.btn-started--mobile {
  width: 100%;
  height: 52px;
  border-radius: 999px;
  font-size: 15px;
  justify-content: center;
}
.btn-started--mobile {
  background: var(--rf-blue-bright);
}
.btn-started--mobile:hover { background: var(--rf-blue-bright-hover); }
.btn-login--mobile {
  border: 1.5px solid var(--rf-blue-bright);
  color: var(--rf-blue-bright);
  background: var(--rf-white);
}
.btn-login--mobile:hover { background: #F8FAFC; }

.menu-fade-enter-active,
.menu-fade-leave-active { transition: opacity 200ms ease, transform 200ms ease; }
.menu-fade-enter-from,
.menu-fade-leave-to { opacity: 0; transform: translateY(-8px); }

.scrim-fade-enter-active,
.scrim-fade-leave-active { transition: opacity 200ms ease; }
.scrim-fade-enter-from,
.scrim-fade-leave-to { opacity: 0; }

/* RESPONSIVE BREAKPOINTS */
@media (max-width: 900px) {
  .nav-links,
  .nav-actions { display: none; }
  .nav-toggle { display: flex; }
}

@media (min-width: 901px) {
  .mobile-menu,
  .mobile-scrim { display: none; }
}

@media (max-width: 600px) {
  .navbar { top: 10px; width: calc(100% - 20px); border-radius: 16px; }
  .nav-inner { padding: 0 16px; }
  .mobile-menu { top: 82px; left: 10px; right: 10px; bottom: 10px; border-radius: 18px; }
}

@media (max-width: 360px) {
  .logo-name { font-size: 15px; }
}

@media (prefers-reduced-motion: reduce) {
  .navbar,
  .nav-links a,
  .logo-icon,
  .btn-started,
  .menu-fade-enter-active,
  .menu-fade-leave-active,
  .scrim-fade-enter-active,
  .scrim-fade-leave-active { transition: none; }
}
</style>