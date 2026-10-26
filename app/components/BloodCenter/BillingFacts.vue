<template>
  <section class="facts" :aria-label="title">
    <h3 class="facts-title">{{ title }}</h3>
    <slot name="lead" />
    <dl class="facts-list">
      <div v-for="row in visibleRows" :key="row.label" class="fact">
        <dt>{{ row.label }}</dt>
        <dd :class="{ mono: row.mono }">{{ row.value }}</dd>
      </div>
    </dl>
    <slot />
  </section>
</template>

<script setup lang="ts">
/**
 * One of the three cards at the top of a statement or receipt: who issued it,
 * who it is for, and its details. A row with no value is left out rather than
 * shown as a dash, so each card lists only what the record actually holds.
 */
interface BillingFact {
  label: string
  value: string | number | null | undefined
  mono?: boolean
}

const props = defineProps<{
  title: string
  rows?: BillingFact[]
}>()

const visibleRows = computed(() => (props.rows ?? []).filter((row) => row.value !== null && row.value !== undefined && row.value !== ''))
</script>

<style scoped>
.facts {
  display: flex; flex-direction: column; gap: 10px; padding: 16px 18px; min-width: 0;
  background: var(--rb-surface); border: 1px solid var(--rb-border); border-radius: 14px;
}
.facts-title { margin: 0; font-size: 12px; font-weight: 700; color: var(--rb-text-secondary); }
.facts-list { margin: 0; display: flex; flex-direction: column; gap: 6px; }
.fact { display: grid; grid-template-columns: minmax(96px, auto) 1fr; gap: 10px; font-size: 13px; }
.fact dt { color: var(--rb-text-secondary); }
.fact dd { margin: 0; color: var(--rb-text-primary); font-weight: 600; overflow-wrap: anywhere; }
.mono { font-family: var(--rb-font-mono); font-size: 12.5px; }
</style>
