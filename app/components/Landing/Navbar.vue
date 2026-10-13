<template>
  <div ref="sentinel" class="scroll-sentinel" aria-hidden="true"></div>

  <header class="navbar" :class="{ scrolled: isScrolled }">
    <div class="nav-inner">
      <a href="#home" class="nav-logo" @click.prevent="scrollToSection('home')">
        <img :src="logo" alt="" class="logo-image" width="36" height="36" />
        <span class="logo-text">
          <span class="logo-name">Red<span class="logo-accent">Agos</span></span>
          <span class="logo-sub">Blood Bank System</span>
        </span>
      </a>

      <nav class="nav-desktop" aria-label="Primary">
        <ul class="nav-links">
          <li v-for="item in navItems" :key="item.id">
            <a
              :href="`#${item.id}`"
              :class="{ active: activeSection === item.id }"
              :aria-current="activeSection === item.id ? 'location' : undefined"
              @click.prevent="scrollToSection(item.id)"
            >
              {{ item.label }}
            </a>
          </li>
        </ul>
      </nav>

      <div class="nav-actions">
        <NuxtLink to="/auth/donor/login" class="btn-ghost">Sign In</NuxtLink>
        <NuxtLink to="/auth/donor/register" class="lp-btn lp-btn--primary lp-btn--sm">Register Now</NuxtLink>
      </div>

      <button
        type="button"
        class="icon-btn nav-toggle"
        aria-controls="mobile-menu"
        :aria-expanded="isMenuOpen"
        :aria-label="isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'"
        @click="isMenuOpen = !isMenuOpen"
      >
        <AssetIcon :name="isMenuOpen ? 'x' : 'menu'" :size="20" />
      </button>
    </div>

    <Teleport to="body">
      <transition name="fade">
        <div v-show="isMenuOpen" class="mobile-scrim" @click="closeMenu"></div>
      </transition>

      <transition name="menu">
        <div
          v-show="isMenuOpen"
          id="mobile-menu"
          v-focus-trap
          class="mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
          @dialog-escape="closeMenu"
        >
          <ul class="mobile-links">
            <li v-for="item in navItems" :key="item.id">
              <a
                :href="`#${item.id}`"
                :class="{ active: activeSection === item.id }"
                :aria-current="activeSection === item.id ? 'location' : undefined"
                @click.prevent="handleMobileNavClick(item.id)"
              >
                {{ item.label }}
              </a>
            </li>
          </ul>

          <div class="mobile-actions">
            <NuxtLink to="/auth/donor/register" class="lp-btn lp-btn--primary" @click="closeMenu">
              Register Now
            </NuxtLink>
            <NuxtLink to="/auth/donor/login" class="lp-btn lp-btn--secondary" @click="closeMenu">
              Sign In
            </NuxtLink>
          </div>
        </div>
      </transition>
    </Teleport>
  </header>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import logo from '~/assets/images/RedAgosLogo.png'

const navItems = [
  { id: 'home', label: 'Home' },
  { id: 'features', label: 'Features' },
  { id: 'roles', label: "Who It's For" },
  { id: 'drives', label: 'Donation Drives' },
  { id: 'about', label: 'About' },
  { id: 'contact', label: 'Contact' },
]

const sentinel = ref(null)
const isScrolled = ref(false)
const isMenuOpen = ref(false)
const activeSection = ref('home')

// Matches the breakpoint in the styles below.
const desktopQuery = '(min-width: 1121px)'

let sectionObserver
let scrollObserver
let mediaList

const scrollToSection = (id) => {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  activeSection.value = id
  // A hash, not `/${id}`: there is no /features route, so the old path 404'd
  // on reload or when the link was shared.
  window.history.replaceState(null, '', id === 'home' ? '/' : `#${id}`)
}

const closeMenu = () => {
  isMenuOpen.value = false
}

const handleMobileNavClick = (id) => {
  closeMenu()
  scrollToSection(id)
}

const onBreakpointChange = (e) => {
  if (e.matches) closeMenu()
}

watch(isMenuOpen, (open) => {
  document.documentElement.style.overflow = open ? 'hidden' : ''
})

onMounted(() => {
  // A section is "current" while it crosses a band just under the navbar.
  // IntersectionObserver instead of a scroll listener: no work per frame.
  // Track every section inside the band and highlight the first one in page
  // order. Taking "the last entry reported" instead left the wrong link lit
  // (Features while at the top) when several sections changed at once.
  const inBand = new Set()
  sectionObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) inBand.add(entry.target.id)
        else inBand.delete(entry.target.id)
      }
      const current = navItems.find(({ id }) => inBand.has(id))
      if (current) activeSection.value = current.id
    },
    { rootMargin: '-96px 0px -55% 0px' },
  )
  navItems
    .map(({ id }) => document.getElementById(id))
    .filter(Boolean)
    .forEach((el) => sectionObserver.observe(el))

  scrollObserver = new IntersectionObserver(([entry]) => {
    isScrolled.value = !entry.isIntersecting
  })
  if (sentinel.value) scrollObserver.observe(sentinel.value)

  mediaList = window.matchMedia(desktopQuery)
  mediaList.addEventListener('change', onBreakpointChange)
})

onUnmounted(() => {
  sectionObserver?.disconnect()
  scrollObserver?.disconnect()
  mediaList?.removeEventListener('change', onBreakpointChange)
  document.documentElement.style.overflow = ''
})
</script>

<style scoped>
.scroll-sentinel {
  position: absolute;
  top: 0;
  left: 0;
  width: 1px;
  height: 12px;
  pointer-events: none;
}

.navbar {
  position: fixed;
  top: 14px;
  left: 50%;
  transform: translateX(-50%);
  width: calc(100% - 32px);
  max-width: 1240px;
  z-index: 100;
  background: color-mix(in srgb, var(--lp-surface) 80%, transparent);
  border: 1px solid var(--lp-border);
  border-radius: var(--lp-radius);
  backdrop-filter: blur(14px) saturate(160%);
  -webkit-backdrop-filter: blur(14px) saturate(160%);
  transition: box-shadow 200ms ease, background 200ms ease;
}
.navbar.scrolled {
  background: color-mix(in srgb, var(--lp-surface) 95%, transparent);
  box-shadow: var(--lp-shadow);
}

.nav-inner {
  height: 64px;
  padding: 0 12px 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

/* ── Logo ── */
.nav-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  border-radius: 10px;
  text-decoration: none;
}
.nav-logo:focus-visible { outline: 2px solid var(--lp-accent); outline-offset: 4px; }
.logo-image { width: 36px; height: 36px; object-fit: contain; flex-shrink: 0; }
.logo-text { display: flex; flex-direction: column; }
.logo-name {
  font-size: 16px;
  font-weight: 800;
  line-height: 1.15;
  letter-spacing: -0.01em;
  color: var(--lp-text);
  white-space: nowrap;
}
.logo-accent { color: var(--lp-brand); }
.logo-sub {
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--lp-muted);
  white-space: nowrap;
}

/* ── Links ── */
.nav-links {
  display: flex;
  align-items: center;
  gap: 2px;
  margin: 0;
  padding: 4px;
  list-style: none;
  background: var(--lp-surface-alt);
  border-radius: 999px;
}
.nav-links a {
  display: inline-block;
  padding: 7px 14px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  color: var(--lp-text-2);
  text-decoration: none;
  white-space: nowrap;
  transition: background 150ms ease, color 150ms ease;
}
.nav-links a:hover { color: var(--lp-text); background: var(--lp-surface); }
.nav-links a.active { color: var(--lp-on-accent); font-weight: 600; background: var(--lp-accent); }
.nav-links a:focus-visible { outline: 2px solid var(--lp-accent); outline-offset: 2px; }

/* ── Actions ── */
.nav-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

.icon-btn {
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 999px;
  border: 1px solid var(--lp-border);
  background: var(--lp-surface);
  color: var(--lp-text-2);
  cursor: pointer;
  transition: color 150ms ease, border-color 150ms ease;
}
.icon-btn:hover { color: var(--lp-accent-text); border-color: var(--lp-accent); }
.icon-btn:focus-visible { outline: 2px solid var(--lp-accent); outline-offset: 2px; }

.btn-ghost {
  height: 40px;
  padding: 0 14px;
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 600;
  color: var(--lp-text-2);
  text-decoration: none;
  transition: background 150ms ease, color 150ms ease;
}
.btn-ghost:hover { color: var(--lp-text); background: var(--lp-surface-alt); }
.btn-ghost:focus-visible { outline: 2px solid var(--lp-accent); outline-offset: 2px; }

.nav-toggle { display: none; color: var(--lp-text); }

/* ── Mobile panel ── */
.mobile-scrim {
  position: fixed;
  inset: 0;
  z-index: 199;
  background: rgba(11, 18, 32, 0.45);
}
.mobile-menu {
  position: fixed;
  top: 88px;
  left: 12px;
  right: 12px;
  z-index: 200;
  max-height: calc(100dvh - 100px);
  overflow-y: auto;
  padding: 16px;
  background: var(--lp-surface);
  border: 1px solid var(--lp-border);
  border-radius: var(--lp-radius);
  box-shadow: var(--lp-shadow-lg);
  font-family: var(--rb-font-sans);
}
.mobile-links { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.mobile-links a {
  display: block;
  padding: 12px 14px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 500;
  color: var(--lp-text);
  text-decoration: none;
}
.mobile-links a:hover { background: var(--lp-surface-alt); }
.mobile-links a.active { color: var(--lp-accent-text); background: var(--lp-accent-soft); font-weight: 600; }
.mobile-links a:focus-visible { outline: 2px solid var(--lp-accent); outline-offset: 2px; }

.mobile-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--lp-border);
}

.menu-enter-active,
.menu-leave-active { transition: opacity 200ms ease, transform 200ms var(--lp-ease); }
.menu-enter-from,
.menu-leave-to { opacity: 0; transform: translateY(-8px); }
.fade-enter-active,
.fade-leave-active { transition: opacity 200ms ease; }
.fade-enter-from,
.fade-leave-to { opacity: 0; }

/* Six links plus the actions need ~1100px to stay on one line. */
@media (max-width: 1120px) {
  .nav-desktop,
  .nav-actions { display: none; }
  .nav-toggle { display: inline-flex; }
}
@media (min-width: 1121px) {
  .mobile-menu,
  .mobile-scrim { display: none; }
}
@media (max-width: 600px) {
  .navbar { top: 10px; width: calc(100% - 20px); }
  .mobile-menu { top: 82px; left: 10px; right: 10px; }
}

@media (prefers-reduced-motion: reduce) {
  .navbar,
  .nav-links a,
  .menu-enter-active,
  .menu-leave-active,
  .fade-enter-active,
  .fade-leave-active { transition: none; }
}
</style>
