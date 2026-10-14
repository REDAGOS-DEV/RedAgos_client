<template>
  <!--
    A card with a title row: the title (and a short line under it) on the
    left, its own controls on the right. `flush` drops the body padding for a
    table or list that runs edge to edge.
  -->
  <section class="sc" :class="{ 'sc--flush': flush }" :aria-labelledby="hasTitle ? headingId : undefined">
    <div v-if="hasTitle || $slots.actions" class="sc__head">
      <div class="sc__titles">
        <h2 v-if="hasTitle" :id="headingId" class="sc__title"><slot name="title">{{ title }}</slot></h2>
        <p v-if="subtitle || $slots.subtitle" class="sc__sub">
          <slot name="subtitle">{{ subtitle }}</slot>
        </p>
      </div>
      <div v-if="$slots.actions" class="sc__actions">
        <slot name="actions" />
      </div>
    </div>
    <div class="sc__body">
      <slot />
    </div>
    <div v-if="$slots.footer" class="sc__foot">
      <slot name="footer" />
    </div>
  </section>
</template>

<script setup lang="ts">
const props = defineProps<{
  title?: string
  subtitle?: string
  flush?: boolean
}>()

const slots = useSlots()
const hasTitle = computed(() => Boolean(props.title || slots.title))
const headingId = `sc-${useId()}`
</script>

<style scoped>
.sc {
  min-width: 0;
  background: var(--rb-surface);
  border: 1px solid var(--rb-border);
  border-radius: var(--rb-radius-lg);
  box-shadow: var(--rb-shadow-sm);
}
.sc__head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--rb-space-3);
  padding: var(--rb-space-4) var(--rb-space-5);
}
.sc__titles { min-width: 0; }
.sc__title { display: flex; align-items: center; gap: 8px; margin: 0; font-size: var(--rb-fs-section); font-weight: 700; color: var(--rb-text-primary); }
.sc__sub { margin: 2px 0 0; font-size: var(--rb-fs-caption); color: var(--rb-text-secondary); }
.sc__actions { display: flex; align-items: center; justify-content: flex-end; gap: var(--rb-space-2); }
.sc__body { padding: 0 var(--rb-space-5) var(--rb-space-5); }
.sc--flush .sc__body { padding: 0; }
.sc--flush .sc__head { border-bottom: 1px solid var(--rb-border); }
.sc__foot { padding: var(--rb-space-3) var(--rb-space-5); border-top: 1px solid var(--rb-border); }
</style>
