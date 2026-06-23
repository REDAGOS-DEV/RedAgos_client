<template>
  <section id="features" class="features" ref="sectionRef">
    <!-- Badge -->
    <div class="badge" :class="{ 'animate-in': visible }">
      <span class="badge-dot"></span>
      PLATFORM FEATURES
    </div>

    <!-- Heading -->
    <div class="heading-wrap" :class="{ 'animate-in': visible }">
      <h2 class="heading-top">Everything You Need for</h2>
      <h2 class="heading-blue">Blood Service Management</h2>
      <p class="subheading">
        A comprehensive platform designed to streamline every aspect of blood
        donation, inventory control, and request coordination.
      </p>
    </div>

    <!-- Cards Grid -->
    <div class="cards-grid">
      <div
        v-for="(feature, i) in features"
        :key="feature.title"
        class="card"
        :class="{ 'animate-in': visible }"
        :style="{ '--card-delay': `${0.12 + i * 0.08}s` }"
      >
        <div class="card-icon-wrap" :style="{ background: feature.iconBg }">
          <component :is="feature.icon" :color="feature.iconColor" />
        </div>
        <h3 class="card-title">{{ feature.title }}</h3>
        <p class="card-desc">{{ feature.desc }}</p>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted, onUnmounted, defineComponent, h } from 'vue'

const sectionRef = ref(null)
const visible    = ref(false)

const IconSearch = defineComponent({
  props: ['color'],
  setup(p) { return () => h('svg', { viewBox:'0 0 24 24', fill:'none', stroke: p.color, 'stroke-width':'2', width:'22', height:'22' }, [
    h('circle', { cx:'11', cy:'11', r:'8' }),
    h('line', { x1:'21', y1:'21', x2:'16.65', y2:'16.65' })
  ]) }
})
const IconClipboard = defineComponent({
  props: ['color'],
  setup(p) { return () => h('svg', { viewBox:'0 0 24 24', fill:'none', stroke: p.color, 'stroke-width':'2', width:'22', height:'22' }, [
    h('path', { d:'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2' }),
    h('rect', { x:'8', y:'2', width:'8', height:'4', rx:'1', ry:'1' })
  ]) }
})
const IconBox = defineComponent({
  props: ['color'],
  setup(p) { return () => h('svg', { viewBox:'0 0 24 24', fill:'none', stroke: p.color, 'stroke-width':'2', width:'22', height:'22' }, [
    h('path', { d:'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z' }),
    h('polyline', { points:'3.27 6.96 12 12.01 20.73 6.96' }),
    h('line', { x1:'12', y1:'22.08', x2:'12', y2:'12' })
  ]) }
})
const IconDollar = defineComponent({
  props: ['color'],
  setup(p) { return () => h('svg', { viewBox:'0 0 24 24', fill:'none', stroke: p.color, 'stroke-width':'2', width:'22', height:'22' }, [
    h('line', { x1:'12', y1:'1', x2:'12', y2:'23' }),
    h('path', { d:'M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' })
  ]) }
})
const IconUsers = defineComponent({
  props: ['color'],
  setup(p) { return () => h('svg', { viewBox:'0 0 24 24', fill:'none', stroke: p.color, 'stroke-width':'2', width:'22', height:'22' }, [
    h('path', { d:'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' }),
    h('circle', { cx:'9', cy:'7', r:'4' }),
    h('path', { d:'M23 21v-2a4 4 0 0 0-3-3.87' }),
    h('path', { d:'M16 3.13a4 4 0 0 1 0 7.75' })
  ]) }
})
const IconCalendar = defineComponent({
  props: ['color'],
  setup(p) { return () => h('svg', { viewBox:'0 0 24 24', fill:'none', stroke: p.color, 'stroke-width':'2', width:'22', height:'22' }, [
    h('rect', { x:'3', y:'4', width:'18', height:'18', rx:'2', ry:'2' }),
    h('line', { x1:'16', y1:'2', x2:'16', y2:'6' }),
    h('line', { x1:'8',  y1:'2', x2:'8',  y2:'6' }),
    h('line', { x1:'3',  y1:'10',x2:'21', y2:'10' })
  ]) }
})
const IconBell = defineComponent({
  props: ['color'],
  setup(p) { return () => h('svg', { viewBox:'0 0 24 24', fill:'none', stroke: p.color, 'stroke-width':'2', width:'22', height:'22' }, [
    h('path', { d:'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9' }),
    h('path', { d:'M13.73 21a2 2 0 0 1-3.46 0' })
  ]) }
})
const IconBarChart = defineComponent({
  props: ['color'],
  setup(p) { return () => h('svg', { viewBox:'0 0 24 24', fill:'none', stroke: p.color, 'stroke-width':'2', width:'22', height:'22' }, [
    h('line', { x1:'18', y1:'20', x2:'18', y2:'10' }),
    h('line', { x1:'12', y1:'20', x2:'12', y2:'4'  }),
    h('line', { x1:'6',  y1:'20', x2:'6',  y2:'14' }),
    h('line', { x1:'2',  y1:'20', x2:'22', y2:'20' })
  ]) }
})

const features = [
  {
    icon: IconSearch,
    iconBg: 'rgba(37,99,235,0.08)',
    iconColor: '#2563eb',
    title: 'Blood Search & Request',
    desc: 'Search available blood across partner facilities and submit digital blood requests instantly.',
  },
  {
    icon: IconClipboard,
    iconBg: 'rgba(37,99,235,0.08)',
    iconColor: '#2563eb',
    title: 'Request Processing',
    desc: 'Review, process, dispatch, and track blood requests with complete status visibility.',
  },
  {
    icon: IconBox,
    iconBg: 'rgba(227,38,54,0.08)',
    iconColor: '#e32636',
    title: 'Inventory Management',
    desc: 'Real-time blood stock monitoring with FEFO method, expiration alerts, and critical-level notifications.',
  },
  {
    icon: IconDollar,
    iconBg: 'rgba(22,163,74,0.08)',
    iconColor: '#16a34a',
    title: 'Supply Coordination',
    desc: 'Hospitals request blood supplies from partnered blood centers when stock falls below threshold.',
  },
  {
    icon: IconUsers,
    iconBg: 'rgba(234,88,12,0.08)',
    iconColor: '#ea580c',
    title: 'Donor Management',
    desc: 'Register donors, manage profiles, record donation history, and organize mobile blood drives.',
  },
  {
    icon: IconCalendar,
    iconBg: 'rgba(37,99,235,0.08)',
    iconColor: '#2563eb',
    title: 'Donor Portal',
    desc: 'Donors register, book appointments, complete eligibility screening, and track donation history.',
  },
  {
    icon: IconBell,
    iconBg: 'rgba(37,99,235,0.08)',
    iconColor: '#2563eb',
    title: 'Smart Notifications',
    desc: 'Automated alerts for appointment reminders, request updates, low inventory, and drive announcements.',
  },
  {
    icon: IconBarChart,
    iconBg: 'rgba(227,38,54,0.08)',
    iconColor: '#e32636',
    title: 'Reports & Analytics',
    desc: 'Generate usage reports, analyze consumption trends, and make data-driven decisions.',
  },
]

let observer
onMounted(() => {
  observer = new IntersectionObserver(
    ([entry]) => { if (entry.isIntersecting) visible.value = true },
    { threshold: 0.15 }
  )
  if (sectionRef.value) observer.observe(sectionRef.value)
})
onUnmounted(() => observer?.disconnect())
</script>

<style scoped>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

/* ── KEYFRAMES ── */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(28px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes cardReveal {
  0% {
    opacity: 0;
    transform: translateY(34px) scale(0.96);
    filter: blur(4px);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
    filter: blur(0);
  }
}
@keyframes iconPop {
  0% { transform: scale(0.78) rotate(-8deg); }
  70% { transform: scale(1.08) rotate(3deg); }
  100% { transform: scale(1) rotate(0); }
}

/* ── SECTION ── */
.features {
  background: #eef2fb;
  padding: 90px 3rem 100px;
  display: flex;
  flex-direction: column;
  align-items: center;
  font-family: 'Inter', 'Segoe UI', sans-serif;
  scroll-margin-top: 76px;
}

/* ── BADGE ── */
.badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.75);
  border: 1px solid rgba(37, 99, 235, 0.2);
  border-radius: 20px;
  padding: 6px 18px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: #374151;
  margin-bottom: 32px;
  opacity: 0;
}
.badge.animate-in { animation: fadeUp 0.6s cubic-bezier(0.22,1,0.36,1) 0.05s forwards; }
.badge-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: #2563eb; flex-shrink: 0;
}

/* ── HEADINGS ── */
.heading-wrap {
  text-align: center;
  max-width: 780px;
  margin-bottom: 60px;
  opacity: 0;
}
.heading-wrap.animate-in { animation: fadeUp 0.65s cubic-bezier(0.22,1,0.36,1) 0.12s forwards; }

.heading-top {
  font-size: 44px;
  font-weight: 800;
  color: #111;
  line-height: 1.1;
}
.heading-blue {
  font-size: 44px;
  font-weight: 800;
  color: #2563eb;
  line-height: 1.15;
  margin-bottom: 20px;
}
.subheading {
  font-size: 17px;
  color: #4b5563;
  line-height: 1.7;
  max-width: 680px;
  margin: 0 auto;
}

/* ── GRID ── */
.cards-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  width: 100%;
  max-width: 1200px;
}

/* ── CARD ── */
.card {
  background: #fff;
  border-radius: 16px;
  padding: 28px 24px 32px;
  display: flex;
  flex-direction: column;
  gap: 0;
  position: relative;
  overflow: hidden;
  opacity: 0;
  transform: translateY(34px) scale(0.96);
  transition: box-shadow 0.28s ease, transform 0.28s ease, border-color 0.28s ease;
  cursor: default;
  border: 1px solid rgba(255, 255, 255, 0.75);
}
.card::before {
  content: '';
  position: absolute;
  inset: 0 0 auto 0;
  height: 4px;
  background: linear-gradient(90deg, #2563eb, #e32636);
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.28s ease;
}
.card.animate-in {
  animation: cardReveal 0.72s cubic-bezier(0.22,1,0.36,1) var(--card-delay) forwards;
}
.card.animate-in .card-icon-wrap {
  animation: iconPop 0.52s cubic-bezier(0.22,1,0.36,1) calc(var(--card-delay) + 0.16s) both;
}
.card:hover {
  box-shadow: 0 18px 44px rgba(37, 99, 235, 0.14);
  transform: translateY(-8px) scale(1.015);
  border-color: rgba(37, 99, 235, 0.16);
}
.card:hover::before {
  transform: scaleX(1);
}

.card-icon-wrap {
  width: 44px; height: 44px;
  border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 20px;
  flex-shrink: 0;
  transition: transform 0.28s ease;
}
.card:hover .card-icon-wrap {
  transform: translateY(-2px) rotate(-3deg);
}

.card-title {
  font-size: 15px;
  font-weight: 700;
  color: #111;
  margin-bottom: 10px;
  line-height: 1.3;
}
.card-desc {
  font-size: 13px;
  color: #6b7280;
  line-height: 1.65;
}

/* ── RESPONSIVE ── */
@media (max-width: 1024px) {
  .cards-grid { grid-template-columns: repeat(2, 1fr); }
  .heading-top, .heading-blue { font-size: 36px; }
}
@media (max-width: 640px) {
  .features { padding: 60px 1.25rem 70px; }
  .cards-grid { grid-template-columns: 1fr; }
  .heading-top, .heading-blue { font-size: 28px; }
  .subheading { font-size: 15px; }
}

@media (prefers-reduced-motion: reduce) {
  .badge, .heading-wrap, .card {
    opacity: 1;
    animation: none;
    filter: none;
    transform: none;
  }
  .card.animate-in .card-icon-wrap { animation: none; }
  .card:hover { transform: none; }
}
</style>
