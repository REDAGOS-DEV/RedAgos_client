<template>
  <!--
    One figure in a StatStrip: an icon in its tone, the label, the number, a
    short note. With `to`, the whole figure is a link to the page that owns it.
  -->
  <component :is="to ? NuxtLink : 'div'" :to="to" class="si" :class="[`si--${tone}`, { 'si--alert': alert, 'si--link': to }]">
    <span v-if="icon" class="si__icon" :class="`si__icon--${tone}`" aria-hidden="true">
      <AssetIcon :name="icon" :size="16" />
    </span>
    <div class="si__body">
      <dt class="si__label">{{ label }}</dt>
      <dd class="si__value" :class="{ 'si__value--empty': value === null || value === undefined }">
        <slot>{{ value ?? 'No data' }}</slot>
      </dd>
      <span v-if="hint || $slots.hint" class="si__hint"><slot name="hint">{{ hint }}</slot></span>
    </div>
    <AssetIcon v-if="to" name="chevron-right" :size="15" class="si__go" />
  </component>
</template>

<script setup lang="ts">
import AssetIcon from '~/components/common/AssetIcon.vue'

const NuxtLink = resolveComponent('NuxtLink')

withDefaults(defineProps<{
  label: string
  value?: string | number | null
  hint?: string
  icon?: string
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'purple' | 'neutral'
  /** Draws the number in its tone's colour: something needs looking at. */
  alert?: boolean
  /** Makes the figure a link to the page that owns the number. */
  to?: string
}>(), { value: undefined, hint: undefined, icon: undefined, tone: 'primary', alert: false, to: undefined })
</script>

<style scoped>
.si { display: flex; align-items: flex-start; gap: var(--rb-space-3); padding: var(--rb-space-4) var(--rb-space-5); min-width: 0; }
.si__icon { width: 34px; height: 34px; flex: none; display: grid; place-items: center; border-radius: 10px; }
.si__icon--primary { color: var(--rb-primary-text); background: rgba(var(--rb-primary-rgb), .1); }
.si__icon--success { color: var(--rb-success-text); background: rgba(var(--rb-success-rgb), .1); }
.si__icon--warning { color: var(--rb-warning-text); background: rgba(var(--rb-warning-rgb), .14); }
.si__icon--danger { color: var(--rb-accent-text); background: rgba(var(--rb-accent-rgb), .09); }
.si__icon--purple { color: var(--rb-purple-text); background: rgba(var(--rb-purple-rgb), .1); }
.si__icon--neutral { color: var(--rb-text-secondary); background: var(--rb-surface-alt); }
.si__body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.si__label { font-size: var(--rb-fs-caption); font-weight: 600; color: var(--rb-text-secondary); }
.si__value { margin: 0; font-size: 22px; font-weight: 800; line-height: 1.2; color: var(--rb-text-primary); font-variant-numeric: tabular-nums; }
.si__value--empty { font-size: var(--rb-fs-section); font-weight: 600; color: var(--rb-text-muted); }
.si--alert .si__value { color: var(--rb-primary-text); }
.si--alert.si--warning .si__value { color: var(--rb-warning-text); }
.si--alert.si--danger .si__value { color: var(--rb-accent-text); }
.si--alert.si--success .si__value { color: var(--rb-success-text); }
.si--alert.si--purple .si__value { color: var(--rb-purple-text); }
.si--link { position: relative; color: inherit; text-decoration: none; transition: background-color .15s var(--rb-ease-out); }
.si--link:hover { background: var(--rb-surface-hover); }
.si--link:focus-visible { outline: none; box-shadow: inset var(--rb-focus-ring); }
.si__go { position: absolute; top: 50%; right: 14px; transform: translateY(-50%); color: var(--rb-text-muted); opacity: 0; transition: opacity .15s ease; }
.si--link:hover .si__go, .si--link:focus-visible .si__go { opacity: 1; }
.si__hint { display: inline-flex; align-items: center; gap: 4px; font-size: var(--rb-fs-caption); color: var(--rb-text-secondary); }
</style>
