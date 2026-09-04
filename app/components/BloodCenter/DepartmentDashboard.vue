<template>
  <div class="dept">
    <header class="dept__header">
      <div>
        <p class="dept__eyebrow">{{ eyebrow }}</p>
        <h1 class="dept__title">{{ title }}</h1>
        <p class="dept__subtitle">{{ subtitle }}</p>
      </div>

      <div v-if="facilityLabel" class="dept__facility">
        <AssetIcon name="building-2" :size="14" />
        {{ facilityLabel }}
      </div>
    </header>

    <section class="dept__stats">
      <article v-for="stat in stats" :key="stat.label" class="stat" :style="{ '--tone': stat.tone }">
        <div class="stat__badge">
          <AssetIcon :name="stat.icon" :size="14" />
        </div>
        <p class="stat__label">{{ stat.label }}</p>
        <p class="stat__value">{{ stat.value ?? '—' }}</p>
        <p class="stat__caption">{{ stat.caption }}</p>
      </article>
    </section>

    <section class="dept__panels">
      <article v-for="panel in panels" :key="panel.title" class="panel">
        <header class="panel__header">
          <div>
            <h2 class="panel__title">{{ panel.title }}</h2>
            <p class="panel__subtitle">{{ panel.subtitle }}</p>
          </div>
          <NuxtLink v-if="panel.link" :to="panel.link" class="panel__link">
            {{ panel.linkLabel || 'Open' }}
          </NuxtLink>
        </header>

        <!--
          Empty states are honest: this department's endpoints are not built
          yet, so the panel says so rather than rendering sample data that
          would read as real.
        -->
        <div class="panel__empty">
          <AssetIcon :name="panel.icon" :size="28" />
          <p class="panel__empty-title">{{ panel.emptyTitle }}</p>
          <p class="panel__empty-body">{{ panel.emptyBody }}</p>
        </div>
      </article>
    </section>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'

/**
 * The shared shell behind each of the four department dashboards.
 *
 * The departments differ in which numbers and panels they show, not in how
 * they show them, so the chrome lives here once. Each page passes its own
 * stats and panels.
 */
defineProps({
  eyebrow: { type: String, default: 'Blood Center' },
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  facilityLabel: { type: String, default: '' },
  stats: { type: Array, default: () => [] },
  panels: { type: Array, default: () => [] },
})
</script>

<style scoped>
.dept {
  font-family: var(--rb-font-sans);
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px 32px 40px;
  background: var(--rb-page-bg);
  transition: background-color 0.2s ease;
}

.dept__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 24px;
}

.dept__eyebrow {
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--rb-text-secondary);
}

.dept__title {
  margin: 4px 0 0;
  font-size: 24px;
  font-weight: 800;
  color: var(--rb-text-primary);
}

.dept__subtitle {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--rb-text-secondary);
  max-width: 62ch;
}

.dept__facility {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border-radius: 999px;
  border: 1px solid var(--rb-border);
  background: var(--rb-surface);
  font-size: 12px;
  font-weight: 600;
  color: var(--rb-text-secondary);
}

.dept__stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 14px;
  margin-bottom: 22px;
}

.stat {
  background: var(--rb-surface);
  border: 1px solid var(--rb-border);
  border-radius: 14px;
  padding: 16px 18px;
}

.stat__badge {
  width: 30px;
  height: 30px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
  color: var(--tone, var(--rb-primary));
  background: color-mix(in srgb, var(--tone, var(--rb-primary)) 10%, transparent);
}

.stat__label {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--rb-text-secondary);
}

.stat__value {
  margin: 4px 0 0;
  font-size: 26px;
  font-weight: 800;
  color: var(--rb-text-primary);
}

.stat__caption {
  margin: 4px 0 0;
  font-size: 11px;
  color: var(--rb-text-secondary);
}

.dept__panels {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 16px;
}

.panel {
  background: var(--rb-surface);
  border: 1px solid var(--rb-border);
  border-radius: 14px;
  padding: 18px 20px 22px;
}

.panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.panel__title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--rb-text-primary);
}

.panel__subtitle {
  margin: 3px 0 0;
  font-size: 12px;
  color: var(--rb-text-secondary);
}

.panel__link {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--rb-primary);
  text-decoration: none;
}

.panel__link:hover {
  text-decoration: underline;
}

.panel__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 6px;
  padding: 26px 12px;
  border: 1px dashed var(--rb-border-strong);
  border-radius: 12px;
  color: var(--rb-text-secondary);
}

.panel__empty-title {
  margin: 6px 0 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--rb-text-primary);
}

.panel__empty-body {
  margin: 0;
  font-size: 12px;
  max-width: 42ch;
}

@media (max-width: 640px) {
  .dept {
    padding: 20px 16px 32px;
  }
}
</style>
