<template>
  <!--
    The last bags booked in, newest first (2026-11-11), under the Stock Intake
    queue: what went on the shelf lately, by whom and when. Read-only; the
    page hands over the newest stock movements.
  -->
  <section class="recent" aria-labelledby="recent-title">
    <header class="recent__head">
      <h2 id="recent-title" class="recent__title">
        <AssetIcon name="history" :size="15" />
        Recently booked in
      </h2>
      <NuxtLink v-if="canViewAll" to="/blood-center/inventory-history" class="recent__all">
        View all
        <AssetIcon name="arrow-right" :size="13" />
      </NuxtLink>
    </header>

    <ul v-if="loading && !items.length" class="recent__list" aria-busy="true">
      <li v-for="n in 4" :key="n" class="recent__item">
        <span class="recent__skeleton" />
      </li>
    </ul>
    <div v-else-if="!items.length" class="recent__empty">
      <span class="recent__empty-icon"><AssetIcon name="package" :size="18" /></span>
      <p class="recent__empty-title">Nothing booked in yet</p>
      <p class="recent__empty-text">Each bag shows here as it goes on the shelf, with who booked it in and when.</p>
    </div>
    <ul v-else class="recent__list">
      <li v-for="item in items" :key="item.id" class="recent__item">
        <span class="recent__type" :class="{ 'recent__type--unknown': !item.blood_type }">{{ item.blood_type || '?' }}</span>
        <span class="recent__main">
          <span class="recent__unit">{{ item.unit_id }}</span>
          <span class="recent__sub">{{ item.component || 'Component not recorded' }}<template v-if="item.actor"> · {{ item.actor }}</template></span>
        </span>
        <span class="recent__when" :title="formatDateTime(item.at)">{{ timeAgo(item.at) }}</span>
      </li>
    </ul>
  </section>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'

defineProps({
  // Stock movements of kind booked_in: { id, unit_id, blood_type, component, actor, at }.
  items: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  canViewAll: { type: Boolean, default: false },
})

function timeAgo(iso) {
  const at = iso ? new Date(iso).getTime() : NaN
  if (Number.isNaN(at)) return ''
  const minutes = Math.max(0, Math.floor((Date.now() - at) / 60000))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDateTime(iso) {
  return iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : ''
}
</script>

<style scoped>
.recent { border: 1px solid var(--rb-border); border-radius: 16px; background: var(--rb-surface); box-shadow: var(--rb-shadow-sm); }
.recent__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 16px; border-bottom: 1px solid var(--rb-border); }
.recent__title { display: inline-flex; align-items: center; gap: 8px; margin: 0; font-size: 14px; font-weight: 700; color: var(--rb-text-primary); }
.recent__title :deep(.asset-icon) { color: var(--rb-text-secondary); }
.recent__all { display: inline-flex; align-items: center; gap: 4px; font-size: 12.5px; font-weight: 600; color: var(--rb-primary-text); text-decoration: none; }
.recent__all:hover { text-decoration: underline; text-underline-offset: 3px; }
.recent__all:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); border-radius: 6px; }

/* One column, beside the queue. */
.recent__list { margin: 0; padding: 0; list-style: none; }
.recent__item { display: flex; align-items: center; gap: 12px; min-width: 0; padding: 11px 16px; border-bottom: 1px solid var(--rb-border); }
.recent__item:last-child { border-bottom: 0; }

.recent__type {
  display: inline-flex; flex-shrink: 0; justify-content: center; width: 44px; padding: 2px 0; border-radius: 999px;
  background: rgba(var(--rb-accent-rgb), 0.1); color: var(--rb-accent-text); font-size: 12px; font-weight: 700;
}
.recent__type--unknown { background: var(--rb-surface-alt); color: var(--rb-text-secondary); }
.recent__main { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.recent__unit { font-family: var(--rb-font-mono); font-size: 12.5px; font-weight: 700; color: var(--rb-text-primary); }
.recent__sub { margin-top: 2px; font-size: 12px; color: var(--rb-text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.recent__when { flex-shrink: 0; font-size: 12px; color: var(--rb-text-secondary); white-space: nowrap; }
.recent__empty { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 32px 20px; text-align: center; }
.recent__empty-icon {
  display: grid; place-items: center; width: 40px; height: 40px; margin-bottom: 6px; border-radius: 50%;
  background: var(--rb-surface-alt); border: 1px solid var(--rb-border); color: var(--rb-text-secondary);
}
.recent__empty-title { margin: 0; font-size: 13.5px; font-weight: 700; color: var(--rb-text-primary); }
.recent__empty-text { margin: 0; max-width: 30ch; font-size: 12.5px; line-height: 1.5; color: var(--rb-text-secondary); }

.recent__skeleton {
  flex: 1; height: 14px; border-radius: 6px;
  background: linear-gradient(90deg, var(--rb-surface-alt) 25%, var(--rb-surface-hover) 37%, var(--rb-surface-alt) 63%);
  background-size: 400% 100%; animation: recent-shimmer 1.4s ease infinite;
}
@keyframes recent-shimmer { from { background-position: 100% 50%; } to { background-position: 0 50%; } }
@media (prefers-reduced-motion: reduce) { .recent__skeleton { animation: none; } }
</style>
