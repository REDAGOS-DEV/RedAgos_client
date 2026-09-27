<template>
  <div v-if="parent || followUps.length" class="chain">
    <p v-if="parent" class="chain__row">
      <AssetIcon name="route" :size="14" />
      <span>
        Follow-up of
        <NuxtLink v-if="linkBase" :to="`${linkBase}${parent.id}`" class="chain__ref">{{ parent.reference_number }}</NuxtLink>
        <span v-else class="chain__ref">{{ parent.reference_number }}</span>
        <template v-if="parent.facility"> at {{ parent.facility.name }}</template>
        — this request carries part of what that one could not supply.
      </span>
    </p>

    <div v-if="followUps.length" class="chain__row chain__row--list">
      <AssetIcon name="route" :size="14" />
      <div>
        <span>Remaining quantity forwarded to:</span>
        <ul class="chain__list">
          <li v-for="followUp in followUps" :key="followUp.id">
            <NuxtLink v-if="linkBase" :to="`${linkBase}${followUp.id}`" class="chain__ref">{{ followUp.reference_number }}</NuxtLink>
            <span v-else class="chain__ref">{{ followUp.reference_number }}</span>
            <template v-if="followUp.facility"> · {{ followUp.facility.name }}</template>
            · {{ requestStatusLabel(followUp) }}
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * The requests a remainder travelled between.
 *
 * A request part-filled at one centre can be continued at another through a
 * follow-up. Links are offered only where the viewer may open the other
 * request — the hospital, which raised both; a centre sees the reference only.
 */

import AssetIcon from '~/components/common/AssetIcon.vue'
import { requestStatusLabel } from '~/types/bloodRequest'

defineProps({
  parent: { type: Object, default: null },
  followUps: { type: Array, default: () => [] },
  /** e.g. '/hospital/bloodrequests/'. Omit to show references without links. */
  linkBase: { type: String, default: '' },
})
</script>

<style scoped>
.chain {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.chain__row {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
  margin: 0;
  padding: 0.55rem 0.7rem;
  border-radius: 8px;
  background: rgba(var(--rb-primary-rgb), 0.08);
  color: var(--rb-text-primary);
  font-size: 0.82rem;
  line-height: 1.45;
}

.chain__list {
  margin: 0.25rem 0 0;
  padding-left: 1rem;
}

.chain__ref {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-weight: 700;
  color: var(--rb-primary-text);
}
</style>
