<template>
  <!--
    One notification, in the bell and on the Notifications page alike
    (2026-10-31): its icon in its tone, what happened, when, and the thing to
    do about it as a button. An unread emergency is marked in red.
  -->
  <div
    class="ni"
    :class="{ 'ni--unread': !item.read, 'ni--urgent': item.urgent && !item.read, 'ni--roomy': roomy }"
    role="button"
    tabindex="0"
    @click="$emit('open', item)"
    @keydown.enter.prevent="$emit('open', item)"
    @keydown.space.prevent="$emit('open', item)"
  >
    <span class="ni__icon" :class="`ni__icon--${item.urgent && !item.read ? 'urgent' : (item.tone || 'neutral')}`" aria-hidden="true">
      <AssetIcon :name="item.urgent && !item.read ? 'triangle-alert' : (item.icon || 'bell')" :size="roomy ? 17 : 15" />
    </span>
    <span class="ni__text">
      <span class="ni__title">
        <span v-if="item.urgent && !item.read" class="ni__flag">Emergency</span>
        {{ item.title || 'Notification' }}
      </span>
      <span v-if="item.desc" class="ni__desc">{{ item.desc }}</span>
      <span class="ni__foot">
        <span class="ni__time">{{ timeAgo(item.created_at) }}<template v-if="item.meta"> · <span class="ni__meta">{{ item.meta }}</span></template></span>
        <button
          v-if="item.action_label && safeRoute(item.action_route)"
          type="button"
          class="ni__action"
          :class="{ 'ni__action--urgent': item.urgent && !item.read }"
          @click.stop="$emit('open', item)"
        >
          {{ item.action_label }}
          <AssetIcon name="arrow-right" :size="12" />
        </button>
      </span>
    </span>
    <span v-if="!item.read" class="ni__dot" aria-label="Unread" />
  </div>
</template>

<script setup lang="ts">
import AssetIcon from '~/components/common/AssetIcon.vue'
import { safeRoute, timeAgo, type StaffNotification } from '~/utils/staffNotifications'

defineProps<{ item: StaffNotification, roomy?: boolean }>()
defineEmits<{ open: [item: StaffNotification] }>()
</script>

<style scoped>
.ni { position: relative; display: flex; align-items: flex-start; gap: 12px; width: 100%; padding: 10px; border-radius: 10px; color: inherit; text-align: left; cursor: pointer; transition: background-color 0.12s ease; }
.ni--roomy { gap: 14px; padding: 14px 16px; border-radius: 12px; }
.ni:hover { background: var(--rb-surface-hover); }
.ni:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: -2px; }
.ni--unread { background: rgba(var(--rb-primary-rgb), 0.05); }
.ni--urgent, .ni--urgent:hover { background: rgba(var(--rb-accent-rgb), 0.07); box-shadow: inset 0 0 0 1px rgba(var(--rb-accent-rgb), 0.25); }

.ni__icon { display: grid; place-items: center; flex-shrink: 0; width: 32px; height: 32px; border-radius: 10px; background: var(--rb-surface-alt); color: var(--rb-text-secondary); }
.ni--roomy .ni__icon { width: 38px; height: 38px; border-radius: 11px; }
.ni__icon--primary, .ni__icon--info { background: rgba(var(--rb-primary-rgb), 0.1); color: var(--rb-primary-text); }
.ni__icon--success { background: rgba(var(--rb-success-rgb), 0.12); color: var(--rb-success-text); }
.ni__icon--warning { background: rgba(var(--rb-warning-rgb), 0.12); color: var(--rb-warning-text); }
.ni__icon--danger, .ni__icon--accent, .ni__icon--urgent { background: rgba(var(--rb-accent-rgb), 0.12); color: var(--rb-accent-text); }

.ni__text { display: flex; flex: 1; flex-direction: column; gap: 3px; min-width: 0; }
.ni__title { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: var(--rb-text-primary); }
.ni--roomy .ni__title { font-size: 14px; }
.ni--unread .ni__title { font-weight: 700; }
.ni__flag { padding: 1px 7px; border-radius: 999px; background: var(--rb-accent); color: #fff; font-size: 10.5px; font-weight: 800; letter-spacing: 0.02em; }
.ni__desc { display: -webkit-box; overflow: hidden; font-size: 12.5px; line-height: 1.45; color: var(--rb-text-secondary); -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; }
.ni--roomy .ni__desc { font-size: 13px; -webkit-line-clamp: 3; line-clamp: 3; }
.ni__foot { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px 10px; margin-top: 2px; }
.ni__time { font-size: 11.5px; color: var(--rb-text-secondary); }
.ni__meta { font-family: var(--rb-font-mono); }
.ni__action { display: inline-flex; align-items: center; gap: 4px; height: 26px; padding: 0 10px; border: 1px solid rgba(var(--rb-primary-rgb), 0.35); border-radius: 999px; background: var(--rb-surface); font: inherit; font-size: 12px; font-weight: 700; color: var(--rb-primary-text); cursor: pointer; }
.ni__action:hover { background: rgba(var(--rb-primary-rgb), 0.08); }
.ni__action:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }
.ni__action--urgent { border-color: var(--rb-accent); background: var(--rb-accent); color: #fff; }
.ni__action--urgent:hover { background: color-mix(in srgb, var(--rb-accent) 88%, #000); }
.ni__dot { flex-shrink: 0; width: 8px; height: 8px; margin-top: 6px; border-radius: 999px; background: var(--rb-primary); }
.ni--urgent .ni__dot { background: var(--rb-accent); }

@media (prefers-reduced-motion: reduce) { .ni { transition: none; } }
</style>
