<template>
  <div class="deferral-notice" role="status">
    <AssetIcon name="circle-alert" :size="18" class="deferral-notice__icon" />

    <p class="deferral-notice__text">
      <strong>This donor has {{ article }} {{ label }} recorded{{ onDate }}.</strong>
      Review their record before proceeding.
    </p>
  </div>
</template>

<script setup>
/**
 * A permanent or indefinite deferral already on the donor's record.
 *
 * States a fact and blocks nothing — the officer decides, the same way they
 * decide everything else in Section I-D. It exists because a counter that
 * cannot see a colleague's decision may draw blood from someone who was told
 * they must never donate again.
 *
 * Carries no reason. That is clinical detail and lives behind the donor's
 * history, which is separately gated; what check-in needs is that a decision
 * exists and when it was made.
 */

import AssetIcon from '~/components/common/AssetIcon.vue'

const props = defineProps({
  deferral: { type: Object, required: true },
})

const label = computed(() => (props.deferral.outcome_label || 'deferral').toLowerCase())

// "an indefinite deferral" / "a permanently deferred" — the labels come from
// the server so the article is decided here rather than baked into either.
const article = computed(() => (/^[aeiou]/i.test(label.value) ? 'an' : 'a'))

const onDate = computed(() => {
  if (!props.deferral.recorded_on) return ''

  const when = new Date(props.deferral.recorded_on)

  if (Number.isNaN(when.getTime())) return ''

  return ` on ${when.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' })}`
})
</script>

<style scoped>
/*
 * Reads as part of the pinned donor band above it, like the questionnaire
 * strip: no accent stripe, for the reason .donor-bar in collection.vue gives
 * for carrying none itself. The tint and the icon are what make it land.
 */
.deferral-notice {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  padding: 0.7rem 1rem;
  border: 1px solid rgba(var(--rb-accent-rgb), 0.4);
  border-radius: 10px;
  background: rgba(var(--rb-accent-rgb), 0.08);
  font-family: var(--rb-font-sans);
}

.deferral-notice__icon {
  flex: none;
  margin-top: 0.05rem;
  color: var(--rb-accent-text);
}

.deferral-notice__text {
  margin: 0;
  font-size: 0.85rem;
  line-height: 1.5;
  color: var(--rb-accent-text);
}
</style>
