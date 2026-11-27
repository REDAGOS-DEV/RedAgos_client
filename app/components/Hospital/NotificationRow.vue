<template>
  <!-- One notification, the same in the inbox and in the bell's panel (2026-11-02). -->
  <div v-if="skeleton" class="nrow" :class="{ 'nrow--compact': compact, 'nrow--feed': !compact }" aria-hidden="true">
    <span class="sk nrow__icon" />
    <span class="nrow__text nrow__text--sk">
      <span class="sk sk--line" style="width: 42%" />
      <span class="sk sk--line" style="width: 76%" />
      <span class="sk sk--line" style="width: 24%" />
    </span>
  </div>

  <!--
    The inbox row, as the blood centre's Notifications page draws it
    (project owner, 2026-11-27): its icon in its tone, what happened, then
    the time at the left and the thing to do as a pill at the right; unread
    is a dot, an unread urgent one is red.
  -->
  <article
    v-else-if="!compact"
    class="nrow nrow--feed"
    :class="{ 'nrow--unread': !item.read, 'nrow--urgent': item.urgent && !item.read }"
    role="button"
    tabindex="0"
    :aria-label="mainLabel"
    @click="$emit('open', item)"
    @keydown.enter.self.prevent="$emit('open', item)"
    @keydown.space.self.prevent="$emit('open', item)"
  >
    <span class="nrow__icon" :class="`nrow__icon--${item.urgent && !item.read ? 'danger' : look.tone}`" aria-hidden="true">
      <AssetIcon :name="item.urgent && !item.read ? 'triangle-alert' : look.icon" :size="17" />
    </span>
    <span class="nrow__text">
      <span class="nrow__title">
        <span v-if="item.urgent && !item.read" class="nrow__flag">Urgent</span>
        {{ item.title || 'Notification' }}
      </span>
      <span v-if="item.description" class="nrow__desc">{{ item.description }}</span>
      <span class="nrow__foot">
        <span class="nrow__time">
          <time v-if="item.created_at" :datetime="item.created_at" :title="exactTime(item.created_at)">{{ notificationTime(item.created_at, now) }}</time>
          <template v-if="item.meta">{{ item.created_at ? ' · ' : '' }}{{ item.meta }}</template>
        </span>
        <span class="nrow__acts">
          <button
            v-if="item.action_label && item.action_path"
            type="button"
            class="nrow__action"
            :class="{ 'nrow__action--urgent': item.urgent && !item.read }"
            @click.stop="$emit('open', item)"
          >
            {{ item.action_label }}
            <AssetIcon name="arrow-right" :size="12" />
          </button>
          <!-- The API can mark a notification read but not unread again. -->
          <button
            v-if="!item.read"
            type="button"
            class="nrow__read"
            :aria-label="`Mark ${item.title} as read`"
            title="Mark as read"
            @click.stop="$emit('read', item)"
          >
            <AssetIcon name="check" :size="13" />
          </button>
        </span>
      </span>
    </span>
    <span v-if="!item.read" class="nrow__dot" aria-label="Unread" />
  </article>

  <!-- The bell's panel: no room for buttons, the row itself is the action. -->
  <article v-else class="nrow nrow--compact" :class="{ 'nrow--unread': !item.read }">
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
          <time v-if="item.created_at" :datetime="item.created_at" :title="exactTime(item.created_at)">{{ notificationTime(item.created_at, now) }}</time>
          <template v-if="item.meta"> · {{ item.meta }}</template>
          <template v-if="item.action_label"> · {{ item.action_label }}</template>
        </span>
      </span>
      <span v-if="!item.read" class="nrow__dot" aria-label="Unread" />
    </button>
  </article>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import { notificationLook, notificationTime } from '~/utils/hospitalNotifications'
import { exactTime, useNow } from '~/composables/useNow'

// Keeps "5 min ago" current while the list is open.
const now = useNow()

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
.nrow { position: relative; display: flex; align-items: flex-start; gap: 12px; min-width: 0; color: inherit; text-align: left; transition: background-color 0.12s ease; }

.nrow__icon { display: grid; flex-shrink: 0; place-items: center; width: 34px; height: 34px; border-radius: 10px; background: var(--rb-surface-alt); color: var(--rb-text-secondary); }
.nrow__icon--info { background: rgba(var(--rb-primary-rgb), 0.1); color: var(--rb-primary-text); }
.nrow__icon--success { background: rgba(var(--rb-success-rgb), 0.12); color: var(--rb-success-text); }
.nrow__icon--warning { background: rgba(var(--rb-warning-rgb), 0.14); color: var(--rb-warning-text); }
.nrow__icon--danger { background: rgba(var(--rb-accent-rgb), 0.12); color: var(--rb-accent-text); }

.nrow__text { display: flex; flex: 1; flex-direction: column; gap: 3px; min-width: 0; }
.nrow__text--sk { gap: 8px; padding-block: 4px; }
.nrow__dot { flex-shrink: 0; width: 8px; height: 8px; margin-top: 6px; border-radius: 50%; background: var(--rb-primary); }

/* ── The inbox row: the blood centre's item, roomy (2026-11-27) ── */
.nrow--feed { gap: 14px; padding: 14px 16px; border-radius: 12px; cursor: pointer; }
.nrow--feed:hover { background: var(--rb-surface-hover); }
.nrow--feed:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: -2px; }
.nrow--feed.nrow--unread { background: rgba(var(--rb-primary-rgb), 0.05); }
.nrow--feed.nrow--urgent, .nrow--feed.nrow--urgent:hover { background: rgba(var(--rb-accent-rgb), 0.07); box-shadow: inset 0 0 0 1px rgba(var(--rb-accent-rgb), 0.25); }
.nrow--feed .nrow__icon { width: 38px; height: 38px; border-radius: 11px; }
.nrow--feed .nrow__title { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 14px; font-weight: 600; color: var(--rb-text-primary); }
.nrow--feed.nrow--unread .nrow__title { font-weight: 700; }
.nrow__flag { padding: 1px 7px; border-radius: 999px; background: var(--rb-accent); color: #fff; font-size: 10.5px; font-weight: 800; letter-spacing: 0.02em; }
.nrow--feed .nrow__desc { display: -webkit-box; overflow: hidden; font-size: 13px; line-height: 1.45; color: var(--rb-text-secondary); -webkit-box-orient: vertical; -webkit-line-clamp: 3; line-clamp: 3; }
.nrow__foot { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px 10px; margin-top: 2px; }
.nrow__time { font-size: 11.5px; color: var(--rb-text-secondary); font-variant-numeric: tabular-nums; }
.nrow__acts { display: inline-flex; align-items: center; gap: 6px; }
.nrow__action { display: inline-flex; align-items: center; gap: 4px; height: 26px; padding: 0 10px; border: 1px solid rgba(var(--rb-primary-rgb), 0.35); border-radius: 999px; background: var(--rb-surface); font: inherit; font-size: 12px; font-weight: 700; color: var(--rb-primary-text); cursor: pointer; }
.nrow__action:hover { background: rgba(var(--rb-primary-rgb), 0.08); }
.nrow__action:focus-visible, .nrow__read:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }
.nrow__action--urgent { border-color: var(--rb-accent); background: var(--rb-accent); color: #fff; }
.nrow__action--urgent:hover { background: color-mix(in srgb, var(--rb-accent) 88%, #000); }
.nrow__read { display: grid; place-items: center; width: 26px; height: 26px; border: 1px solid var(--rb-border-strong); border-radius: 999px; background: var(--rb-surface); color: var(--rb-text-secondary); cursor: pointer; }
.nrow__read:hover { border-color: rgba(var(--rb-success-rgb), .5); background: rgba(var(--rb-success-rgb), .1); color: var(--rb-success-text); }
.nrow--urgent .nrow__dot { background: var(--rb-accent); }

/* ── The bell's row (unchanged) ── */
.nrow--compact { align-items: center; padding: 2px; border-radius: 10px; }
.nrow--compact:hover { background: var(--rb-surface-hover); }
.nrow--compact.nrow--unread { background: rgba(var(--rb-primary-rgb), 0.04); }
.nrow__main {
  display: flex; flex: 1; align-items: flex-start; gap: 12px; min-width: 0; padding: 8px;
  border: 0; border-radius: 8px; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer;
}
.nrow__main:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: 3px; }
.nrow--compact .nrow__title { font-size: 13.5px; font-weight: 600; line-height: 1.35; color: var(--rb-text-secondary); }
.nrow--compact.nrow--unread .nrow__title { font-weight: 700; color: var(--rb-text-primary); }
.nrow__urgent {
  display: inline-block; margin-right: 4px; padding: 0 7px; border-radius: 999px; vertical-align: 1px;
  background: rgba(var(--rb-accent-rgb), 0.1); color: var(--rb-accent-text); font-size: 11px; font-weight: 700; line-height: 18px;
}
.nrow--compact .nrow__desc { display: -webkit-box; overflow: hidden; font-size: 12.5px; line-height: 1.45; color: var(--rb-text-secondary); -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.nrow__meta { margin-top: 1px; font-size: 12px; color: var(--rb-text-muted); }
.nrow--compact .nrow__dot { margin-top: 5px; }

@media (prefers-reduced-motion: reduce) {
  .nrow { transition: none; }
}
</style>
