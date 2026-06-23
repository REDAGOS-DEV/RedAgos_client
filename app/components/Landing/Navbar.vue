<template>
  <nav class="navbar" :class="{ scrolled: isScrolled }">
    <div class="nav-logo">
        <div class="logo-icon">
            <img :src="logo" alt="RedAgos Logo" class="logo-image">
        </div>
      <div>
        <span class="logo-name">Red<span style="color:#e32636">Agos</span></span>
        <span class="logo-sub">BLOOD BANK SYSTEM</span>
      </div>
    </div>

    <ul class="nav-links">
      <li>
        <a
          href="#home"
          :class="{ active: activeSection === 'home' }"
          @click="setActiveSection('home')"
        >
          Home
        </a>
      </li>
      <li>
        <a
          href="#features"
          :class="{ active: activeSection === 'features' }"
          @click="setActiveSection('features')"
        >
          Features
        </a>
      </li>
      <li>
        <a
          href="#drives"
          :class="{ active: activeSection === 'donation-drives' }"
          @click="setActiveSection('donation-drives')"
        >
          Donation Drives
        </a>
      </li>
      <li>
        <a
          href="#about"
          :class="{ active: activeSection === 'about' }"
          @click="setActiveSection('about')"
        >
          About
        </a>
      </li>
      <li>
        <a
          href="#contact"
          :class="{ active: activeSection === 'contact' }"
          @click="setActiveSection('contact')"
        >
          Contact
        </a>
      </li>
    </ul>

    <div class="nav-actions">
      <button class="btn-login" @click="navigateTo('/login')">Log In</button>
      <button class="btn-started" @click="navigateTo('/login')">Get Started ›</button>
    </div>
  </nav>
</template>

<script setup>
import logo from '~/assets/images/RedAgosLogo.png'

const isScrolled = ref(false)
const activeSection = ref('home')
const sectionIds = ['home', 'features', 'donation-drives', 'about', 'contact']

let scrollHandler
let resizeHandler
let ticking = false

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

onMounted(() => {
  scrollHandler = requestScrollUpdate
  resizeHandler = requestScrollUpdate

  updateActiveSection()
  window.addEventListener('scroll', scrollHandler, { passive: true })
  window.addEventListener('resize', resizeHandler)
})

onUnmounted(() => {
  window.removeEventListener('scroll', scrollHandler)
  window.removeEventListener('resize', resizeHandler)
})
</script>

<style scoped>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

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
.logo-icon{
  width:48px;
  height:48px;
  display:flex;
  align-items:center;
  justify-content:center;
  flex-shrink:0;
  transition:transform .2s ease;
}
.logo-icon:hover { transform: scale(1.08); }
.logo-name { font-size: 18px; font-weight: 800; display: block; line-height: 1.1; color: #1a1a1a; }
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

@media (max-width: 900px) { .nav-links { display: none; } }
@media (max-width: 600px) { .navbar { padding: 0 1rem; } }
</style>
