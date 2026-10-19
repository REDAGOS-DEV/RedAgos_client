<template>
  <!--
    The top of a staff page: the title and a one-line subtitle on the left,
    the page's actions on the right. Two columns, so the actions never wrap
    under the text; only the text column narrows.
  -->
  <header class="ph">
    <div class="ph__text">
      <h1 class="ph__title">{{ title }}</h1>
      <p v-if="subtitle || $slots.subtitle" class="ph__sub">
        <slot name="subtitle">{{ subtitle }}</slot>
      </p>
    </div>
    <div v-if="$slots.actions" class="ph__actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  /** One line; the longer explanation belongs in the Help Center. */
  subtitle?: string
}>()
</script>

<style scoped>
.ph { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: start; gap: var(--rb-space-4); }
.ph__text { min-width: 0; }
.ph__title { margin: 0; font-size: 24px; font-weight: 800; line-height: 1.2; letter-spacing: -0.01em; color: var(--rb-text-primary); }
.ph__sub { margin: 4px 0 0; font-size: var(--rb-fs-small); line-height: 1.5; color: var(--rb-text-secondary); max-width: 72ch; }
.ph__actions { display: flex; align-items: center; justify-content: flex-end; gap: var(--rb-space-2); }
</style>
