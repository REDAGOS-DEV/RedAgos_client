<template>
  <div class="dept">
    <header class="dept__header">
      <div>
        <h1 class="dept__title">{{ title }}</h1>
        <p v-if="subtitle" class="dept__subtitle">{{ subtitle }}</p>
      </div>
      <!-- Page-level actions (e.g. a primary button), when a department has one. -->
      <div v-if="$slots.actions" class="dept__actions">
        <slot name="actions" />
      </div>
    </header>

    <section class="dept__stats" :aria-busy="loading">
      <template v-if="loading">
        <div v-for="n in stats.length || 4" :key="n" class="stat stat--skeleton" />
      </template>
      <template v-else>
        <component
          :is="stat.to ? NuxtLink : 'article'"
          v-for="stat in stats"
          :key="stat.label"
          :to="stat.to"
          class="stat"
          :class="{ 'stat--link': stat.to, 'stat--alert': stat.alert }"
          :style="{ '--tone': stat.tone }"
        >
          <div class="stat__top">
            <p class="stat__label">{{ stat.label }}</p>
            <span class="stat__badge"><AssetIcon :name="stat.icon" :size="14" /></span>
          </div>
          <p class="stat__value" :class="{ 'stat__value--empty': stat.value === null || stat.value === undefined }">
            {{ stat.value ?? 'No data' }}
          </p>
          <p class="stat__caption">{{ stat.caption }}</p>
        </component>
      </template>
    </section>

    <section class="dept__panels">
      <article
        v-for="panel in panels"
        :key="panel.key || panel.title"
        class="panel"
        :class="{ 'panel--wide': panel.wide }"
      >
        <header class="panel__header">
          <div>
            <h2 class="panel__title">{{ panel.title }}</h2>
            <p v-if="panel.subtitle" class="panel__subtitle">{{ panel.subtitle }}</p>
          </div>
          <NuxtLink v-if="panel.link" :to="panel.link" class="panel__link">
            {{ panel.linkLabel || 'Open' }}
            <AssetIcon name="chevron-right" :size="13" />
          </NuxtLink>
        </header>

        <div v-if="loading" class="panel__skeleton" />

        <!-- A page fills a panel through a slot named after its key. -->
        <slot v-else-if="panel.key && $slots[panel.key] && !panel.empty" :name="panel.key" />

        <!-- Otherwise, an empty state written for the people using the page. -->
        <div v-else class="panel__empty">
          <AssetIcon :name="panel.icon" :size="24" />
          <p class="panel__empty-title">{{ panel.emptyTitle }}</p>
          <p v-if="panel.emptyBody" class="panel__empty-body">{{ panel.emptyBody }}</p>
        </div>
      </article>
    </section>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'

// Stat cards with a `to` render as links; the rest as plain articles.
const NuxtLink = resolveComponent('NuxtLink')

/**
 * The shared shell behind each department dashboard.
 *
 * The departments differ in which numbers and panels they show, not in how
 * they show them, so the chrome lives here once. Each page passes its stats
 * and panels, and fills a panel with real content through a slot named after
 * the panel's `key`. A panel with no slot, or with `empty: true`, shows its
 * empty state.
 *
 * stat:  { label, value, caption, icon, tone, to?, alert? }
 * panel: { key?, title, subtitle?, icon, link?, linkLabel?, emptyTitle, emptyBody?, empty?, wide? }
 */
defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  loading: { type: Boolean, default: false },
  stats: { type: Array, default: () => [] },
  panels: { type: Array, default: () => [] },
})
</script>

<style scoped>
.dept {
  font-family: var(--rb-font-sans);
  max-width: var(--rb-content-max, 1600px);
  margin: 0 auto;
  padding: 24px var(--rb-gutter, 24px) 40px;
  background: var(--rb-page-bg);
  transition: background-color 0.2s ease;
}

.dept__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.dept__title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--rb-text-primary);
}

.dept__subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--rb-text-secondary);
  max-width: 70ch;
}

.dept__actions { display: flex; gap: 10px; flex-shrink: 0; }

/* Stats */
.dept__stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 14px;
  margin-bottom: 20px;
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: var(--rb-surface);
  border: 1px solid var(--rb-border);
  border-radius: 14px;
  padding: 16px;
  color: inherit;
  text-decoration: none;
  box-shadow: 0 1px 2px rgba(var(--rb-shadow-rgb), 0.03);
  transition: border-color 0.15s ease;
}

.stat--link:hover { border-color: var(--rb-border-hover); }
.stat--link:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: 2px; }

.stat--alert {
  border-color: color-mix(in srgb, var(--tone) 35%, transparent);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--tone) 14%, transparent);
}

.stat__top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }

.stat__badge {
  width: 26px;
  height: 26px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--tone, var(--rb-primary-text));
  background: color-mix(in srgb, var(--tone, var(--rb-primary-text)) 12%, transparent);
}

.stat__label {
  margin: 0;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--rb-text-secondary);
}

.stat__value {
  margin: 2px 0 0;
  font-size: 24px;
  font-weight: 800;
  line-height: 1.1;
  color: var(--rb-text-primary);
  font-variant-numeric: tabular-nums;
}

.stat__value--empty { font-size: 15px; font-weight: 600; line-height: 26px; color: var(--rb-text-secondary); }

.stat__caption { margin: 0; font-size: 12px; color: var(--rb-text-secondary); }

.stat--skeleton {
  height: 108px;
  border: 0;
  background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 37%, var(--rb-skeleton-a) 63%);
  background-size: 400% 100%;
  animation: dept-shimmer 1.4s ease infinite;
}

/* Panels */
.dept__panels {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
  gap: 16px;
  align-items: start;
}

.panel {
  background: var(--rb-surface);
  border: 1px solid var(--rb-border);
  border-radius: 14px;
  padding: 16px 18px 18px;
  box-shadow: 0 1px 2px rgba(var(--rb-shadow-rgb), 0.03);
  min-width: 0;
}

.panel--wide { grid-column: 1 / -1; }

.panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.panel__title {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: var(--rb-text-primary);
}

.panel__subtitle {
  margin: 3px 0 0;
  font-size: 12px;
  color: var(--rb-text-secondary);
}

.panel__link {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--rb-primary-text);
  text-decoration: none;
  white-space: nowrap;
}

.panel__link:hover { text-decoration: underline; }

.panel__skeleton {
  height: 140px;
  border-radius: 10px;
  background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 37%, var(--rb-skeleton-a) 63%);
  background-size: 400% 100%;
  animation: dept-shimmer 1.4s ease infinite;
}

.panel__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 6px;
  padding: 24px 12px;
  border: 1px dashed var(--rb-border-strong);
  border-radius: 12px;
  color: var(--rb-text-secondary);
}

.panel__empty-title {
  margin: 4px 0 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--rb-text-primary);
}

.panel__empty-body {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  max-width: 44ch;
}

@keyframes dept-shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}

@media (prefers-reduced-motion: reduce) {
  .stat--skeleton,
  .panel__skeleton { animation: none; }
}

@media (max-width: 640px) {
  .dept { padding: 20px 16px 32px; }
  .dept__stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .dept__panels { grid-template-columns: 1fr; }
}
</style>
