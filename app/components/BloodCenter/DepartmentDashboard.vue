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
          :class="[{ 'stat--link': stat.to }, stat.status ? `stat--${stat.status}` : '']"
        >
          <div class="stat__top">
            <p class="stat__label">{{ stat.label }}</p>
            <span class="stat__badge"><AssetIcon :name="stat.icon" :size="15" /></span>
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
 * stat:  { label, value, caption, icon, to?, status? }
 *        `status` is 'ok' | 'warning' | 'critical' and colours the icon only:
 *        every card keeps one surface and one border, whatever it reports.
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
/* A restrained operations surface. Every container is one charcoal surface
   with a hairline border; hierarchy comes from spacing, weight and grey ink.
   Blue is kept for what can be acted on (links, the primary button, focus).
   Red, amber and green appear only as small signals: an icon, a dot, a 3px
   edge marker, a number.

   Dark mode points the app's tokens at the charcoal palette on this root
   only, so everything a department page slots in follows. The selector sits
   whole inside :global(): Vue compiles `:global(.dark) .x` to plain `.dark`,
   which would repaint the whole app. */
.dept {
  --dept-ok: #15803D;
  --dept-warn: #B45309;
  --dept-crit: #B91C1C;
  --dept-elevated: var(--rb-surface-alt);
  --dept-bar: #94A3B8;

  font-family: var(--rb-font-sans);
  max-width: var(--rb-content-max, 1600px);
  margin: 0 auto;
  padding: 24px var(--rb-gutter, 24px) 40px;
  background: var(--rb-page-bg);
  /* The page background carried past the column to the content area's edges,
     so a wide screen shows no strip beside it. A shadow, not clip-path: a
     clip would also clip, and stack under the header, any fixed dialog a
     department page renders in place. */
  box-shadow: 0 0 0 100vmax var(--rb-page-bg);
  color: var(--rb-text-primary);
  transition: background-color 0.2s ease;
}

:global(.dark .dept) {
  --rb-page-bg: #0F1115;
  --rb-surface: #171A1F;
  --rb-surface-alt: #1D2128;
  --rb-surface-hover: #1D2128;
  --rb-border: #2B313A;
  --rb-border-strong: #2B313A;
  --rb-border-hover: #3A414C;
  --rb-text-primary: #F3F4F6;
  --rb-text-secondary: #9CA3AF;
  --rb-text-muted: #6B7280;
  --rb-skeleton-a: #171A1F;
  --rb-skeleton-b: #1D2128;
  --dept-ok: #4ADE80;
  --dept-warn: #FBBF24;
  --dept-crit: #F87171;
  --dept-bar: #6B7280;
  color-scheme: dark;
}

.dept__header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.dept__title {
  margin: 0;
  font-size: 20px;
  font-weight: 650;
  letter-spacing: -0.015em;
  color: var(--rb-text-primary);
}

.dept__subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--rb-text-secondary);
  max-width: 70ch;
}

.dept__actions { display: flex; gap: 10px; flex-shrink: 0; }

/* Stats: four identical cards. */
.dept__stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.stat {
  --stat-icon: var(--rb-text-secondary);

  display: flex;
  flex-direction: column;
  gap: 4px;
  background: var(--rb-surface);
  border: 1px solid var(--rb-border);
  border-radius: 12px;
  padding: 16px;
  color: inherit;
  text-decoration: none;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.stat--ok { --stat-icon: var(--dept-ok); }
.stat--warning { --stat-icon: var(--dept-warn); }
.stat--critical { --stat-icon: var(--dept-crit); }

.stat--link:hover { border-color: var(--rb-border-hover); background: var(--rb-surface-hover); }
.stat--link:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: 2px; }

.stat__top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }

.stat__badge {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--stat-icon);
  background: var(--dept-elevated);
  border: 1px solid var(--rb-border);
}

.stat__label {
  margin: 0;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--rb-text-secondary);
}

.stat__value {
  margin: 4px 0 0;
  font-size: 26px;
  font-weight: 600;
  line-height: 1.1;
  letter-spacing: -0.02em;
  color: var(--rb-text-primary);
  font-variant-numeric: tabular-nums;
}

.stat__value--empty { font-size: 15px; font-weight: 500; line-height: 28px; color: var(--rb-text-secondary); }

.stat__caption { margin: 0; font-size: 12px; color: var(--rb-text-secondary); }

.stat--skeleton {
  height: 104px;
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
  border-radius: 12px;
  padding: 18px 18px 20px;
  min-width: 0;
}

.panel--wide { grid-column: 1 / -1; }

.panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.panel__title {
  margin: 0;
  font-size: 14.5px;
  font-weight: 600;
  color: var(--rb-text-primary);
}

.panel__subtitle {
  margin: 3px 0 0;
  font-size: 12.5px;
  color: var(--rb-text-secondary);
}

/* Links are the one place blue appears in a panel. */
.panel__link {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--rb-primary-text);
  text-decoration: none;
  white-space: nowrap;
}

.panel__link:hover { text-decoration: underline; text-underline-offset: 3px; }
.panel__link:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: 2px; border-radius: 4px; }

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
  border-radius: 10px;
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
