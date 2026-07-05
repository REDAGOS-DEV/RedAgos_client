<template>
  <section id="drives" class="drives" ref="sectionRef">
    <div class="section-inner">
      <div class="badge" :class="{ 'animate-in': visible }">
        <span class="badge-dot"></span>
        DONATION DRIVES
      </div>

      <div class="heading-wrap" :class="{ 'animate-in': visible }">
        <h2 class="heading-top">Upcoming Donation Drives</h2>
        <p class="subheading">Join a mobile blood donation drive near you and help save lives.</p>
      </div>

      <div v-if="drives.length === 0" class="empty-state">
        <IconCalendar />
        <p>No upcoming drives at the moment. Check back soon!</p>
      </div>

      <div v-else class="drive-grid">
        <article
          v-for="(drive, index) in drives"
          :key="drive.title"
          class="drive-card"
          :class="{ 'animate-in': visible }"
          :style="{ '--drive-delay': `${index * 0.08}s` }"
        >
          <div class="card-top">
            <span class="status-pill">Upcoming</span>
            <span class="capacity">
              <IconUsers />
              {{ drive.registered }}/{{ drive.capacity }}
            </span>
          </div>

          <div class="card-body">
            <h3>{{ drive.title }}</h3>

            <ul class="drive-details">
              <li>
                <IconMapPin />
                <span>{{ drive.location }}</span>
              </li>
              <li>
                <IconCalendar />
                <span>{{ drive.date }}</span>
              </li>
              <li>
                <IconClock />
                <span>{{ drive.time }}</span>
              </li>
            </ul>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted, onUnmounted, defineComponent, h } from 'vue'

const sectionRef = ref(null)
const visible = ref(false)

const drives = [
  {
    title: 'Davao City Hall Community Drive',
    location: 'Davao City Hall, San Pedro St.',
    date: 'August 5, 2026',
    time: '7:00 AM – 12:00 PM',
    registered: 8,
    capacity: 60,
  },
  {
    title: 'SM Lanang Blood Donation',
    location: 'SM Lanang Premier, J.P. Laurel Ave.',
    date: 'July 22, 2026',
    time: '9:00 AM – 5:00 PM',
    registered: 15,
    capacity: 80,
  },
  {
    title: 'Ateneo de Davao Blood Drive',
    location: 'Ateneo de Davao University, Jacinto St.',
    date: 'July 15, 2026',
    time: '8:00 AM – 3:00 PM',
    registered: 42,
    capacity: 100,
  },
]

const svgProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': '2.2',
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
  width: '16',
  height: '16',
}

const IconUsers = defineComponent({
  setup() {
    return () => h('svg', svgProps, [
      h('path', { d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' }),
      h('circle', { cx: '9', cy: '7', r: '4' }),
      h('path', { d: 'M22 21v-2a4 4 0 0 0-3-3.87' }),
      h('path', { d: 'M16 3.13a4 4 0 0 1 0 7.75' }),
    ])
  },
})

const IconMapPin = defineComponent({
  setup() {
    return () => h('svg', svgProps, [
      h('path', { d: 'M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z' }),
      h('circle', { cx: '12', cy: '10', r: '3' }),
    ])
  },
})

const IconCalendar = defineComponent({
  setup() {
    return () => h('svg', svgProps, [
      h('rect', { x: '3', y: '4', width: '18', height: '18', rx: '2' }),
      h('path', { d: 'M16 2v4' }),
      h('path', { d: 'M8 2v4' }),
      h('path', { d: 'M3 10h18' }),
    ])
  },
})

const IconClock = defineComponent({
  setup() {
    return () => h('svg', svgProps, [
      h('circle', { cx: '12', cy: '12', r: '10' }),
      h('path', { d: 'M12 6v6l4 2' }),
    ])
  },
})

let observer

onMounted(() => {
  observer = new IntersectionObserver(
    ([entry]) => { if (entry.isIntersecting) visible.value = true },
    { threshold: 0.18 }
  )
  if (sectionRef.value) observer.observe(sectionRef.value)
})

onUnmounted(() => observer?.disconnect())
</script>

<style scoped>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes cardRise {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}

.donation-drives {
  padding: 50px 0 80px;       
  background: #f9fafb;
  border-radius:60px;               
  font-family: 'Inter', 'Segoe UI', sans-serif;
}

.section-inner{
  width: 100%;
  max-width:1700px;
  margin:0 auto;
  padding:0 80px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* ── Badge ── */
.badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  border-radius: 999px;
  background: rgba(37, 99, 235, 0.08); 
  color: #2563eb;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.18em;
  border: 1px solid rgba(37, 99, 235, 0.2);
  opacity: 0;
}
.badge.animate-in {
  animation: fadeUp 0.55s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}
.badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #2563eb;
}

/* ── Heading ── */
.heading-wrap {
  text-align: center;
  margin-top: 28px;   
  margin-bottom: 70px;               
  opacity: 0;
}
.heading-wrap.animate-in {
  animation: fadeUp 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.06s forwards;
}
.heading-top {
  font-size: 44px;                    
  font-weight: 800;
  color: #111827;                   
  line-height: 1.2;
}
.subheading {
  margin-top: 12px;                   
  color: #6b7280;                      
  font-size: 17px;
  max-width: 680px;
}

/* ── Empty state ── */
.empty-state {
  text-align: center;
  padding: 64px 0;
  color: #9ca3af;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  font-size: 15px;
}

/* ── Grid ── */
.drive-grid {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr)); 
  gap: 24px;                          
  margin-top: 50px;
}

/* ── Card ── */
.drive-card {
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.08);  
  border-radius: 16px;                    
  padding: 24px;                         
  display: flex;
  flex-direction: column;
  opacity: 0;
  transition: box-shadow 0.25s ease, border-color 0.25s ease;
}
.drive-card.animate-in {
  animation: cardRise 0.55s cubic-bezier(0.22, 1, 0.36, 1) var(--drive-delay) forwards;
}
.drive-card:hover {
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);  
}

/* ── Card top row ── */
.card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;                  
}

.status-pill {
  background: rgba(37, 99, 235, 0.08);
  color: #2563eb;
  font-size: 11px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 999px;
  cursor: pointer;
  transition: all .3s ease;
}

.status-pill:hover {
  background: #2563eb;
  color: white;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(37,99,235,.25);

}

.capacity {
  display: flex;
  align-items: center;
  gap: 5px;
  color: #9ca3af;                      
  font-size: 12px;                     
}

/* ── Card body ── */
.card-body h3 {
  font-size: 17px;                      
  font-weight: 600;
  color: #111827;                       
  margin-bottom: 14px;                  
  line-height: 1.35;
}

.drive-details {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;                            
}

.drive-details li {
  display: flex;
  align-items: center;
  gap: 10px;                            
  font-size: 13px;                    
  color: #6b7280;                       
}

.drive-details svg {
  color: #2563eb;                      
  flex-shrink: 0;
}

/* ── Responsive ── */
@media (max-width: 1024px) {
  .drive-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));  
  }
}

@media (max-width: 640px) {
  .donation-drives {
    padding: 56px 1rem 72px;
  }
  .heading-top {
    font-size: 28px;
  }
  .drive-grid {
    grid-template-columns: 1fr;
    margin-top: 36px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .badge, .heading-wrap, .drive-card {
    opacity: 1;
    transform: none;
    animation: none;
  }
  .drive-card:hover { box-shadow: none; }
}
</style>