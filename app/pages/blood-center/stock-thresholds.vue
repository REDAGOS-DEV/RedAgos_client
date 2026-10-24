<template>
  <!-- st-quiet: this centre's page in the neutral operations palette; the
       hospital page shares the panel and keeps its own look. -->
  <StockThresholdsPanel
    class="st-quiet"
    :fetch-status="() => bloodCenterService.stockThresholds()"
    :save-status="(payload) => bloodCenterService.saveStockThresholds(payload)"
    :editable="can('inventory.thresholds')"
    facility-noun="centre"
    read-only-note="You can see the levels and how stock stands against them. The Inventory Control Officer sets them."
  />
</template>

<script setup lang="ts">
/**
 * A blood centre's PAR and critical stock levels per blood type and component.
 *
 * Anyone who can see the inventory reads how it stands against its levels.
 * Setting them takes `inventory.thresholds`, held by the Inventory Control
 * Officer alone; the server re-checks it on every save.
 */
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import StockThresholdsPanel from '~/components/common/StockThresholdsPanel.vue'

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  requires: 'inventory.view',
})

useHead({ title: 'Stock Thresholds · RedAgos' })

const { can } = useUser()
</script>

<style scoped>
/* The shared panel, quieted for the centre: one charcoal surface with
   hairline borders, blue only for what can be acted on (saving, focus, the
   alert toggle), and red, amber and green only as small signals: an icon, a
   number, a 3px edge marker. Every rule is anchored on .st-quiet, so the
   hospital page, which uses the same components, is untouched.

   The dark selector sits whole inside :global(): Vue compiles
   `:global(.dark) .x` to plain `.dark`, which would repaint the whole app. */
.st-quiet {
  --q-ok: #15803D;
  --q-warn: #B45309;
  --q-crit: #B91C1C;
  --q-elevated: var(--rb-surface-alt);

  /* The page background carried past the column to the content area's edges. */
  box-shadow: 0 0 0 100vmax var(--rb-page-bg);
}

/* Dark mode reads the app's own navy tokens (2026-10-24); the page had a
   charcoal palette of its own that stood apart from the sidebar. Only the
   state colours lift. */
:global(.dark .st-quiet) {
  --q-ok: #4ADE80;
  --q-warn: #FBBF24;
  --q-crit: #F87171;
  color-scheme: dark;
}


/* Heading and guide */
.st-quiet :deep(.page-head__title) { font-size: 22px; font-weight: 650; letter-spacing: -0.015em; }
.st-quiet :deep(.scope__item--note) {
  border: 1px solid var(--rb-border);
  background: var(--q-elevated);
  color: var(--rb-text-secondary);
  font-weight: 500;
}
.st-quiet :deep(.refresh) { font-weight: 500; }
.st-quiet :deep(.guide) { border-color: var(--rb-border); background: var(--rb-surface); }
.st-quiet :deep(.guide__icon) { background: var(--q-elevated); border: 1px solid var(--rb-border); color: var(--rb-text-secondary); }
.st-quiet :deep(.guide__list dt) { font-weight: 600; color: var(--rb-text-primary); }

/* Messages: a neutral row; the state is in the icon. */
.st-quiet :deep(.alert),
.st-quiet :deep(.callout) { border-color: var(--rb-border); background: var(--rb-surface); color: var(--rb-text-primary); }
.st-quiet :deep(.alert .asset-icon) { color: var(--q-crit); }
.st-quiet :deep(.callout .asset-icon) { color: var(--rb-text-secondary); }

/* The two level tables. Both act in the one blue; the critical table is told
   apart by its icon and its words, not by turning the card red. */
.st-quiet :deep(.st-card) { border-color: var(--rb-border); box-shadow: none; }
.st-quiet :deep(.st-card--critical) {
  --st-level: var(--rb-primary);
  --st-level-rgb: var(--rb-primary-rgb);
  --st-level-text: var(--rb-primary-text);
  --st-level-hover: #0D47A1;
}
.st-quiet :deep(.st-card__icon) { background: var(--q-elevated); border: 1px solid var(--rb-border); color: var(--rb-text-secondary); }
.st-quiet :deep(.st-card--critical .st-card__icon) { color: var(--q-crit); }
.st-quiet :deep(.st-card__title) { font-weight: 600; }
.st-quiet :deep(.st-card--critical .st-card__title) { color: var(--rb-text-primary); }
.st-quiet :deep(.st-btn) { font-weight: 600; }
.st-quiet :deep(.st-bell) { background: var(--q-elevated); }
.st-quiet :deep(.st-bell:hover:not(:disabled)) { background: var(--rb-surface-hover); }
/* A level the server will refuse: a red edge on the field, not a red box. */
.st-quiet :deep(.st-field--invalid),
.st-quiet :deep(.st-field--invalid:hover) { border-color: var(--st-input-border); box-shadow: inset 3px 0 0 var(--q-crit); }
.st-quiet :deep(.st-note--success),
.st-quiet :deep(.st-note--error) { border: 1px solid var(--rb-border); background: var(--rb-surface); color: var(--rb-text-primary); }
.st-quiet :deep(.st-note--success .asset-icon) { color: var(--q-ok); }
.st-quiet :deep(.st-note--error .asset-icon) { color: var(--q-crit); }

/* Current stock */
.st-quiet :deep(.grid-card) { border-color: var(--rb-border); box-shadow: none; }
.st-quiet :deep(.grid-card__icon) { background: var(--q-elevated); border: 1px solid var(--rb-border); color: var(--rb-text-secondary); }
.st-quiet :deep(.grid-card__title) { font-weight: 600; }
.st-quiet :deep(.kpi) { border-color: var(--rb-border); background: var(--q-elevated); }
.st-quiet :deep(.kpi dt) { font-size: 11.5px; font-weight: 500; letter-spacing: 0; text-transform: none; }
.st-quiet :deep(.kpi dd) { font-weight: 600; }
/* Only the shortfalls take a colour; healthy and PAR counts read as plain numbers. */
.st-quiet :deep(.kpi--ok dd),
.st-quiet :deep(.kpi--par dd) { color: var(--rb-text-primary); }
.st-quiet :deep(.kpi--low dd) { color: var(--q-warn); }
.st-quiet :deep(.kpi--critical dd) { color: var(--q-crit); }

.st-quiet :deep(.stock-table th) { font-weight: 600; color: var(--rb-text-secondary); }
.st-quiet :deep(.stock-table__type) { font-weight: 600 !important; color: var(--rb-text-primary); }
/* A short cell keeps the table's surface and carries a 3px edge marker. */
.st-quiet :deep(.cell--low),
.st-quiet :deep(.cell--critical) { background: transparent; }
.st-quiet :deep(.cell--low) { box-shadow: inset 3px 0 0 var(--q-warn); }
.st-quiet :deep(.cell--critical) { box-shadow: inset 3px 0 0 var(--q-crit); }
.st-quiet :deep(.cell__available) { font-weight: 600; }
.st-quiet :deep(.cell--low .cell__available) { color: var(--q-warn); }
.st-quiet :deep(.cell--critical .cell__available) { color: var(--q-crit); }
.st-quiet :deep(.cell__badge) {
  border: 1px solid var(--rb-border);
  background: var(--q-elevated);
  color: var(--rb-text-secondary);
  font-weight: 500;
}
.st-quiet :deep(.cell--low .cell__badge),
.st-quiet :deep(.cell--critical .cell__badge) { color: var(--rb-text-primary); }
.st-quiet :deep(.cell--low .cell__badge .asset-icon) { color: var(--q-warn); }
.st-quiet :deep(.cell--critical .cell__badge .asset-icon) { color: var(--q-crit); }
.st-quiet :deep(.cell__muted) { border: 1px solid var(--rb-border); background: transparent; font-weight: 500; }
.st-quiet :deep(.cell__to-par) { font-weight: 500; color: var(--rb-text-secondary); }
.st-quiet :deep(.legend__swatch) { width: 8px; height: 8px; border-radius: 999px; }
.st-quiet :deep(.legend__swatch--ok) { background: var(--rb-text-muted); }
.st-quiet :deep(.legend__swatch--low) { background: var(--q-warn); }
.st-quiet :deep(.legend__swatch--critical) { background: var(--q-crit); }

/* The low-stock banner, on the page's surface: the state is in the icon and a
   dot on each chip. */
.st-quiet :deep(.low-banner) { background: var(--rb-surface); border-color: var(--rb-border); border-radius: 10px; }
.st-quiet :deep(.low-banner__icon) { background: var(--q-elevated); border: 1px solid var(--rb-border); color: var(--q-warn); }
.st-quiet :deep(.low-banner--critical .low-banner__icon) { color: var(--q-crit); }
.st-quiet :deep(.low-banner__title) { font-weight: 600; color: var(--rb-text-primary); }
.st-quiet :deep(.low-banner__chip) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--rb-border);
  background: var(--q-elevated);
  color: var(--rb-text-primary);
  font-weight: 500;
}
.st-quiet :deep(.low-banner__chip::before) { content: ''; width: 6px; height: 6px; border-radius: 999px; background: var(--q-warn); }
.st-quiet :deep(.low-banner__chip--critical::before) { background: var(--q-crit); }
.st-quiet :deep(.low-banner__chip--more) { color: var(--rb-text-secondary); }
.st-quiet :deep(.low-banner__chip--more::before) { display: none; }

/* ===== Refresh (project owner, 2026-10-24) =====
   The stock now and the two level tables are tabs in the panel, one view at
   a time. Each tab says what its level means, so the guide box beside the
   title would repeat it. */
.st-quiet :deep(.guide) { display: none; }

/* With the grid's own empty state showing, the callout above it would repeat it. */
.st-quiet:has(.setup) :deep(.callout) { display: none; }

/* A healthy stock is the rule, so it says nothing: only a shortage wears a badge.
   The meter and the legend carry the rest. */
.st-quiet :deep(.cell--ok .cell__badge) { display: none; }
.st-quiet :deep(.cell__fill) { background: var(--rb-text-muted); }
.st-quiet :deep(.cell--ok .cell__fill) { background: var(--q-ok); }
.st-quiet :deep(.cell--low .cell__fill) { background: var(--q-warn); }
.st-quiet :deep(.cell--critical .cell__fill) { background: var(--q-crit); }
.st-quiet :deep(.legend__swatch--ok) { background: var(--q-ok); }
.st-quiet :deep(.cell--low), .st-quiet :deep(.cell--critical) { background: color-mix(in srgb, var(--q-warn) 5%, transparent); }
.st-quiet :deep(.cell--critical) { background: color-mix(in srgb, var(--q-crit) 5%, transparent); }

/* The counts above the grid: each a small tile, its number in its state. */
.st-quiet :deep(.kpi) { min-width: 96px; border-radius: 12px; background: var(--rb-surface); }
.st-quiet :deep(.kpi--low:not(.kpi--zero)) { border-color: color-mix(in srgb, var(--q-warn) 35%, var(--rb-border)); }
.st-quiet :deep(.kpi--critical:not(.kpi--zero)) { border-color: color-mix(in srgb, var(--q-crit) 35%, var(--rb-border)); }
/* Nothing short: the count reads plain. */
.st-quiet :deep(.kpi--zero dd) { color: var(--rb-text-primary); }
.st-quiet :deep(.kpi--par dd) { color: var(--rb-primary-text); }

/* Headings of the level tables and the grid: icons in a tint of what they mean. */
.st-quiet :deep(.grid-card__icon) { border: 0; background: rgba(var(--rb-primary-rgb), 0.1); color: var(--rb-primary-text); }
.st-quiet :deep(.st-card__icon) { border: 0; background: rgba(var(--rb-primary-rgb), 0.1); color: var(--rb-primary-text); }
.st-quiet :deep(.st-card--critical .st-card__icon) { background: color-mix(in srgb, var(--q-crit) 12%, transparent); }
.st-quiet :deep(.guide__icon) { border: 0; background: rgba(var(--rb-primary-rgb), 0.1); color: var(--rb-primary-text); }
</style>
