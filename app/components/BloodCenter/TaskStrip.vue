<template>
  <!--
    "Needs you": the top of every blood-centre dashboard. What waits for this
    person now, from their own abilities, each a link to the list that holds
    it. The same counts as the sidebar's badges (useBloodCenterTasks).
  -->
  <section class="tasks" aria-labelledby="tasks-title">
    <div class="tasks__head">
      <h2 id="tasks-title" class="tasks__title">Needs you</h2>
      <span v-if="loaded && tasks.length" class="tasks__count">{{ tasks.length }}</span>
    </div>

    <div v-if="!loaded" class="tasks__grid" aria-busy="true">
      <span v-for="n in 3" :key="n" class="task task--skeleton" />
    </div>

    <p v-else-if="!tasks.length" class="tasks__clear">
      <AssetIcon name="check" :size="15" />
      All clear. Nothing is waiting for you right now.
    </p>

    <div v-else class="tasks__grid">
      <NuxtLink v-for="task in tasks" :key="task.key" :to="task.to" class="task" :class="`task--${task.tone}`">
        <span class="task__icon" aria-hidden="true"><AssetIcon :name="task.icon" :size="18" /></span>
        <span class="task__body">
          <span class="task__line">
            <strong class="task__count">{{ task.count > 99 ? '99+' : task.count }}</strong>
            <span class="task__label">{{ task.label }}</span>
          </span>
          <span class="task__detail">{{ task.detail }}</span>
        </span>
        <AssetIcon name="arrow-right" :size="15" class="task__arrow" />
      </NuxtLink>
    </div>
  </section>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import { useBloodCenterTasks } from '~/composables/useBloodCenterTasks'

const { tasks, loaded, load } = useBloodCenterTasks()

// Fresh on every visit to a dashboard; the sidebar reads the same counts.
onMounted(load)
onActivated(load)
</script>

<style scoped>
.tasks { display: flex; flex-direction: column; gap: 10px; }
.tasks__head { display: flex; align-items: center; gap: 8px; }
.tasks__title { margin: 0; font-size: var(--rb-fs-section, 16px); font-weight: 700; color: var(--rb-text-primary); }
.tasks__count {
  min-width: 22px;
  padding: 1px 7px;
  border-radius: 999px;
  background: rgba(var(--rb-primary-rgb), 0.12);
  font-size: 12px;
  font-weight: 700;
  text-align: center;
  color: var(--rb-primary-text);
}

.tasks__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }

.task {
  --tone-bg: rgba(var(--rb-primary-rgb), 0.1);
  --tone-fg: var(--rb-primary-text);
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 74px;
  padding: 14px 16px;
  border: 1px solid var(--rb-border);
  border-radius: 16px;
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  text-decoration: none;
  transition: border-color 150ms ease, transform 150ms ease;
}
.task:hover { border-color: var(--tone-fg); transform: translateY(-1px); }
.task:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; }
.task:active { transform: translateY(0); }
.task--urgent { --tone-bg: rgba(211, 47, 47, 0.1); --tone-fg: #C62828; border-left: 3px solid #D32F2F; }
.task--warning { --tone-bg: rgba(245, 124, 0, 0.12); --tone-fg: #B45309; }
html.dark .task--urgent { --tone-bg: rgba(239, 83, 80, 0.16); --tone-fg: #EF9A9A; }
html.dark .task--warning { --tone-bg: rgba(255, 167, 38, 0.16); --tone-fg: #FFB74D; }

.task__icon {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--tone-bg);
  color: var(--tone-fg);
}
.task__body { display: flex; flex: 1; flex-direction: column; gap: 2px; min-width: 0; }
.task__line { display: flex; align-items: baseline; gap: 6px; min-width: 0; }
.task__count { font-size: 20px; font-weight: 800; line-height: 1; color: var(--tone-fg); font-variant-numeric: tabular-nums; }
.task__label { overflow: hidden; font-size: 14px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.task__detail { font-size: 12.5px; color: var(--rb-text-secondary); }
.task__arrow { flex-shrink: 0; color: var(--rb-text-muted); transition: transform 150ms ease, color 150ms ease; }
.task:hover .task__arrow { transform: translateX(2px); color: var(--tone-fg); }

.tasks__clear {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 12px 16px;
  border: 1px dashed var(--rb-border);
  border-radius: 14px;
  font-size: 13.5px;
  color: var(--rb-text-secondary);
}
.tasks__clear :deep(svg) { color: var(--rb-success-text, #2E7D32); }

.task--skeleton { min-height: 74px; border: 0; background: var(--rb-skeleton-a, #EEF1F5); }

@media (prefers-reduced-motion: reduce) {
  .task, .task__arrow { transition: none; }
}
</style>
