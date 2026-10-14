<template>
  <!-- Nothing to show: an icon in a soft circle, what is missing, what to do next. -->
  <div class="es" :class="{ 'es--compact': compact }">
    <span class="es__icon" aria-hidden="true"><AssetIcon :name="icon" :size="compact ? 20 : 24" /></span>
    <p class="es__title">{{ title }}</p>
    <p v-if="description" class="es__desc">{{ description }}</p>
    <div v-if="$slots.default" class="es__actions"><slot /></div>
  </div>
</template>

<script setup lang="ts">
import AssetIcon from '~/components/common/AssetIcon.vue'

withDefaults(defineProps<{
  icon?: string
  title: string
  description?: string
  /** Less padding, for a small card. */
  compact?: boolean
}>(), { icon: 'inbox', description: undefined, compact: false })
</script>

<style scoped>
.es { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: var(--rb-space-12) var(--rb-space-5); text-align: center; }
.es--compact { padding: var(--rb-space-8) var(--rb-space-4); }
.es__icon { width: 52px; height: 52px; display: grid; place-items: center; margin-bottom: 4px; border-radius: 50%; color: var(--rb-primary-text); background: rgba(var(--rb-primary-rgb), .08); }
.es--compact .es__icon { width: 44px; height: 44px; }
.es__title { margin: 0; font-size: var(--rb-fs-body); font-weight: 700; color: var(--rb-text-primary); }
.es__desc { margin: 0; max-width: 48ch; font-size: var(--rb-fs-small); line-height: 1.5; color: var(--rb-text-secondary); }
.es__actions { display: flex; gap: var(--rb-space-2); margin-top: var(--rb-space-2); }
</style>
