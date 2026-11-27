<template>
  <!--
    Everything about one list row, read only (project owner, 2026-11-27): the
    lists show one plain value per column, and the row's eye opens this. Laid
    out as the Staff Profile; CenterModal brings the focus trap, Escape and
    the Close. A fact with no value is left out, and so is an empty section.
  -->
  <CenterModal :open="open" :title="title" :eyebrow="eyebrow" @close="$emit('close')">
    <div class="rd">
      <section v-for="section in shown" :key="section.key" class="rd-section" :aria-label="section.title || title">
        <h3 v-if="section.title" class="rd-section__title">{{ section.title }}</h3>
        <dl class="rd-facts">
          <div v-for="row in section.rows" :key="row.label" class="rd-fact" :class="{ 'rd-fact--wide': row.wide }">
            <dt>{{ row.label }}</dt>
            <dd :class="{ mono: row.mono }">
              <NuxtLink v-if="row.to" :to="row.to" class="rd-link" @click="$emit('close')">{{ row.value }}</NuxtLink>
              <template v-else>{{ row.value }}</template>
            </dd>
          </div>
        </dl>
      </section>
    </div>

    <template #actions>
      <slot name="actions" />
      <button type="button" class="ui-btn" @click="$emit('close')">Close</button>
    </template>
  </CenterModal>
</template>

<script setup>
import CenterModal from '~/components/ui/CenterModal.vue'

/**
 * sections: [{ title?, rows: [{ label, value, mono?, wide?, to? }] }]
 * A row's `to` makes its value a link; following it closes the dialog.
 */
const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, required: true },
  eyebrow: { type: String, default: '' },
  sections: { type: Array, default: () => [] },
})

defineEmits(['close'])

const blank = (value) => value === null || value === undefined || value === ''

const shown = computed(() => props.sections
  .map((section, i) => ({
    key: section.title || `section-${i}`,
    title: section.title || '',
    rows: (section.rows || []).filter((row) => row && !blank(row.value)).map((row) => ({ ...row, value: String(row.value) })),
  }))
  .filter((section) => section.rows.length))
</script>

<style scoped>
.rd { display: flex; flex-direction: column; gap: 20px; }
.rd-section { display: flex; flex-direction: column; gap: 10px; }
.rd-section + .rd-section { padding-top: 18px; border-top: 1px solid var(--rb-border); }
.rd-section__title { margin: 0; font-size: 13px; font-weight: 700; color: var(--rb-text-primary); }
.rd-facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 18px; margin: 0; }
.rd-fact { min-width: 0; }
.rd-fact--wide { grid-column: 1 / -1; }
.rd-fact dt {
  margin: 0 0 3px;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--rb-text-secondary);
}
.rd-fact dd { margin: 0; font-size: 13px; font-weight: 600; line-height: 1.45; color: var(--rb-text-primary); overflow-wrap: anywhere; white-space: pre-line; }
.rd-fact dd.mono { font-family: var(--rb-font-mono); font-size: 12.5px; }
.rd-link { color: var(--rb-primary-text); text-decoration: none; }
.rd-link:hover { text-decoration: underline; text-underline-offset: 3px; }
.rd-link:focus-visible { outline: none; border-radius: 4px; box-shadow: var(--rb-focus-ring); }
@media (max-width: 480px) {
  .rd-facts { grid-template-columns: 1fr; }
}
</style>
