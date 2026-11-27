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
    <!-- One plain value a column (project owner, 2026-11-27); the eye shows the rest. -->
    <table v-else class="recent__table">
      <caption class="sr-only">Bags booked in lately, newest first</caption>
      <thead>
        <tr>
          <th scope="col">Unit ID</th>
          <th scope="col">Type</th>
          <th scope="col">When</th>
          <th scope="col"><span class="sr-only">View</span></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in items" :key="item.id">
          <td class="recent__unit">{{ item.unit_id }}</td>
          <td>{{ item.blood_type || '—' }}</td>
          <td :title="formatDateTime(item.at)">{{ timeAgo(item.at) }}</td>
          <td class="recent__view"><RowViewButton :label="`View ${item.unit_id}`" @view="viewing = item" /></td>
        </tr>
      </tbody>
    </table>

    <!-- Everything about the booking, read only. -->
    <RecordDialog :open="Boolean(viewing)" :title="viewing?.unit_id || 'Unit'" eyebrow="Booked in" :sections="viewSections" @close="viewing = null" />
  </section>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import RecordDialog from '~/components/ui/RecordDialog.vue'
import RowViewButton from '~/components/ui/RowViewButton.vue'

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

/* VIEW: a booking's eye opens everything the table leaves out (project owner, 2026-11-27) */
const viewing = ref(null)
const viewSections = computed(() => {
  const item = viewing.value
  if (!item) return []
  return [{ rows: [
    { label: 'Unit ID', value: item.unit_id, mono: true },
    { label: 'Blood type', value: item.blood_type || 'Not recorded' },
    { label: 'Component', value: item.component || 'Not recorded' },
    { label: 'Booked in by', value: item.actor },
    { label: 'Booked in', value: formatDateTime(item.at) },
  ] }]
})
</script>

<style scoped>
.recent { border: 1px solid var(--rb-border); border-radius: 16px; background: var(--rb-surface); box-shadow: var(--rb-shadow-sm); }
.recent__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 16px; border-bottom: 1px solid var(--rb-border); }
.recent__title { display: inline-flex; align-items: center; gap: 8px; margin: 0; font-size: 14px; font-weight: 700; color: var(--rb-text-primary); }
.recent__title :deep(.asset-icon) { color: var(--rb-text-secondary); }
.recent__all { display: inline-flex; align-items: center; gap: 4px; font-size: 12.5px; font-weight: 600; color: var(--rb-primary-text); text-decoration: none; }
.recent__all:hover { text-decoration: underline; text-underline-offset: 3px; }
.recent__all:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); border-radius: 6px; }

/* One column, beside the queue: the skeleton's rows. */
.recent__list { margin: 0; padding: 0; list-style: none; }
.recent__item { display: flex; align-items: center; gap: 12px; min-width: 0; padding: 11px 16px; border-bottom: 1px solid var(--rb-border); }
.recent__item:last-child { border-bottom: 0; }

.recent__table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.recent__table th {
  padding: 9px 10px; border-bottom: 1px solid var(--rb-border); background: var(--rb-surface-alt);
  font-size: 10.5px; font-weight: 700; letter-spacing: .04em; text-align: left; text-transform: uppercase; white-space: nowrap; color: var(--rb-text-secondary);
}
.recent__table td { padding: 9px 10px; border-bottom: 1px solid var(--rb-border); color: var(--rb-text-primary); white-space: nowrap; vertical-align: middle; }
.recent__table th:first-child, .recent__table td:first-child { padding-left: 16px; }
.recent__table tbody tr:last-child td { border-bottom: 0; }
.recent__unit { font-family: var(--rb-font-mono); font-weight: 700; }
.recent__view { width: 1%; padding-right: 12px !important; text-align: right; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
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
