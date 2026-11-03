<template>
  <!-- One notification, the same in the inbox and in the bell's panel (2026-11-02). -->
  <div v-if="skeleton" class="nrow" :class="{ 'nrow--compact': compact }" aria-hidden="true">
    <div class="nrow__main nrow__main--still">
      <span class="sk nrow__icon" />
      <span class="nrow__text nrow__text--sk">
        <span class="sk sk--line" style="width: 42%" />
        <span class="sk sk--line" style="width: 76%" />
        <span class="sk sk--line" style="width: 24%" />
      </span>
    </div>
    <div v-if="!compact" class="nrow__actions">
      <span class="sk nrow__action-sk" />
    </div>
  </div>

  <article v-else class="nrow" :class="{ 'nrow--unread': !item.read, 'nrow--compact': compact }">
    <button type="button" class="nrow__main" :aria-label="mainLabel" @click="$emit('open', item)">
      <span class="nrow__icon" :class="`nrow__icon--${look.tone}`" aria-hidden="true">
        <AssetIcon :name="look.icon" :size="16" />
      </span>
      <span class="nrow__text">
        <span class="nrow__title">
          <span v-if="item.urgent" class="nrow__urgent">Urgent</span>
          {{ item.title || 'Notification' }}
        </span>
        <span v-if="item.description" class="nrow__desc">{{ item.description }}</span>
        <span class="nrow__meta">
          {{ notificationTime(item.created_at) }}
          <template v-if="item.meta"> · {{ item.meta }}</template>
          <template v-if="compact && item.action_label"> · {{ item.action_label }}</template>
        </span>
      </span>
      <span v-if="compact && !item.read" class="nrow__dot" aria-label="Unread" />
    </button>

    <div v-if="!compact" class="nrow__actions">
      <span v-if="!item.read" class="nrow__dot" aria-label="Unread" />
      <button v-if="item.action_label && item.action_path" type="button" class="ui-btn ui-btn--sm" @click="$emit('open', item)">
        {{ item.action_label }}
        <AssetIcon name="arrow-right" :size="14" />
      </button>
      <!-- The API can mark a notification read but not unread again. -->
      <button
        v-if="!item.read"
        type="button"
        class="ui-btn ui-btn--sm ui-btn--icon"
        :aria-label="`Mark ${item.title} as read`"
        title="Mark as read"
        @click="$emit('read', item)"
      >
        <AssetIcon name="check" :size="14" />
      </button>
    </div>
  </article>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import { notificationLook, notificationTime } from '~/utils/hospitalNotifications'

const props = defineProps({
  /** A HospitalNotificationView; absent on a skeleton. */
  item: { type: Object, default: null },
  /** The bell's panel: no room for buttons, the row itself is the action. */
  compact: { type: Boolean, default: false },
  skeleton: { type: Boolean, default: false },
})

defineEmits(['open', 'read'])

const look = computed(() => notificationLook(props.item ?? {}))
const mainLabel = computed(() => {
  const item = props.item
  if (!item) return ''
  const state = item.read ? '' : 'Unread. '
  const action = item.action_label && item.action_path ? ` ${item.action_label}.` : ''
  return `${state}${item.urgent ? 'Urgent. ' : ''}${item.title || 'Notification'}.${action}`
})
</script>

<style scoped>
.nrow { display: flex; align-items: center; gap: 12px; min-width: 0; padding: 12px 18px; border-top: 1px solid var(--rb-border); transition: background-color 0.12s ease; }
.nrow:hover { background: var(--rb-surface-hover); }
.nrow--unread { background: rgba(var(--rb-primary-rgb), 0.04); }
.nrow--compact { padding: 2px; border-top: 0; border-radius: 10px; }

.nrow__main {
  display: flex; flex: 1; align-items: flex-start; gap: 12px; min-width: 0; padding: 0;
  border: 0; border-radius: 8px; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer;
}
.nrow--compact .nrow__main { padding: 8px; }
.nrow__main--still { cursor: default; }
.nrow__main:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: 3px; }

.nrow__icon { display: grid; flex-shrink: 0; place-items: center; width: 34px; height: 34px; border-radius: 10px; background: var(--rb-surface-alt); color: var(--rb-text-secondary); }
.nrow__icon--info { background: rgba(var(--rb-primary-rgb), 0.1); color: var(--rb-primary-text); }
.nrow__icon--success { background: rgba(var(--rb-success-rgb), 0.12); color: var(--rb-success-text); }
.nrow__icon--warning { background: rgba(var(--rb-warning-rgb), 0.14); color: var(--rb-warning-text); }
.nrow__icon--danger { background: rgba(var(--rb-accent-rgb), 0.1); color: var(--rb-accent-text); }

.nrow__text { display: flex; flex: 1; flex-direction: column; gap: 2px; min-width: 0; }
.nrow__text--sk { gap: 8px; padding-block: 4px; }
.nrow__title { font-size: 13.5px; font-weight: 600; line-height: 1.35; color: var(--rb-text-secondary); }
.nrow--unread .nrow__title { font-weight: 700; color: var(--rb-text-primary); }
.nrow__urgent {
  display: inline-block; margin-right: 4px; padding: 0 7px; border-radius: 999px; vertical-align: 1px;
  background: rgba(var(--rb-accent-rgb), 0.1); color: var(--rb-accent-text); font-size: 11px; font-weight: 700; line-height: 18px;
}
.nrow__desc { font-size: 13px; line-height: 1.45; color: var(--rb-text-secondary); }
.nrow--compact .nrow__desc { font-size: 12.5px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.nrow__meta { margin-top: 1px; font-size: 12px; color: var(--rb-text-muted); }

.nrow__actions { display: flex; flex-shrink: 0; align-items: center; gap: 8px; }
.nrow__actions .ui-btn { white-space: nowrap; }
.nrow__dot { flex-shrink: 0; width: 8px; height: 8px; border-radius: 50%; background: var(--rb-primary); }
.nrow--compact .nrow__dot { margin-top: 5px; }
.nrow__action-sk { width: 118px; height: 32px; border-radius: 9px; }

@media (max-width: 640px) {
  .nrow { flex-direction: column; align-items: stretch; gap: 10px; padding-inline: 16px; }
  .nrow--compact { padding: 2px; gap: 0; }
  .nrow__actions { justify-content: flex-end; }
}
@media (prefers-reduced-motion: reduce) {
  .nrow { transition: none; }
}
</style>
