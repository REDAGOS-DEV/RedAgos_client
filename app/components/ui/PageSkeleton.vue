<template>
  <!--
    A page's first load (project owner, 2026-11-01): the real title, then cards
    in the shape of the ones on their way, so nothing jumps when the data lands.
    Every blood center page draws its loading with this and SkeletonRows; the
    look (.sk) is one rule in bc-ui.css.
  -->
  <div class="psk" role="status" aria-busy="true" aria-label="Loading">
    <PageHeader v-if="title" :title="title" />

    <div v-if="tiles" class="psk__tiles" :style="{ '--psk-tiles': tiles }">
      <div v-for="n in tiles" :key="n" class="psk__card psk__tile">
        <span class="sk sk--icon" />
        <span class="sk psk__tile-label" />
        <span class="sk psk__tile-value" />
        <span class="sk psk__tile-note" />
      </div>
    </div>

    <div v-for="(row, r) in sections" :key="r" class="psk__row" :class="`psk__row--${row.length}`">
      <div v-for="(kind, k) in row" :key="k" class="psk__card" :class="`psk__card--${kind}`">
        <!-- A filter bar over a list, as on the list pages. -->
        <template v-if="kind === 'table'">
          <div v-if="toolbar" class="psk__toolbar">
            <span class="sk psk__search" />
            <span class="sk psk__filter" />
            <span class="sk psk__filter" />
          </div>
          <div class="psk__table" :style="{ '--psk-columns': columns }">
            <div v-for="c in columns" :key="`h-${c}`" class="psk__cell psk__cell--head"><span class="sk sk--line" style="width: 56%" /></div>
            <template v-for="n in rows" :key="n">
              <div v-for="c in columns" :key="c" class="psk__cell">
                <span class="sk sk--line" :style="{ width: `${widthOf(n, c)}%` }" />
              </div>
            </template>
          </div>
        </template>

        <template v-else-if="kind === 'chart'">
          <span class="sk psk__heading" />
          <SkeletonChart />
        </template>

        <template v-else-if="kind === 'form'">
          <span class="sk psk__heading" />
          <div class="psk__fields">
            <div v-for="n in 4" :key="n" class="psk__field">
              <span class="sk sk--line" style="width: 34%" />
              <span class="sk psk__input" />
            </div>
          </div>
        </template>

        <template v-else-if="kind === 'banner'">
          <span class="sk sk--avatar" />
          <div class="psk__lines">
            <span class="sk psk__heading" />
            <span class="sk sk--line" style="width: 44%" />
          </div>
        </template>

        <template v-else>
          <span class="sk psk__heading" />
          <SkeletonList />
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import PageHeader from '~/components/ui/PageHeader.vue'
import SkeletonChart from '~/components/ui/SkeletonChart.vue'
import SkeletonList from '~/components/ui/SkeletonList.vue'

defineProps({
  // The page's own title. Leave it out where the page already shows its heading.
  title: { type: String, default: '' },
  // How many figure tiles head the page.
  tiles: { type: Number, default: 0 },
  // Rows of cards, each 'table', 'chart', 'list', 'form' or 'banner'.
  sections: { type: Array, default: () => [] },
  // For a 'table': its filter bar, columns and rows.
  toolbar: { type: Boolean, default: false },
  columns: { type: Number, default: 6 },
  rows: { type: Number, default: 7 },
})

const WIDTHS = [72, 54, 86, 62, 78, 48, 68]
const widthOf = (row, column) => WIDTHS[(row * 3 + column) % WIDTHS.length]
</script>

<style scoped>
.psk { display: flex; flex-direction: column; gap: 16px; width: 100%; }

.psk__card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
  padding: 18px 20px;
  border: 1px solid var(--rb-border);
  border-radius: 16px;
  background: var(--rb-surface);
}

.psk__tiles { display: grid; grid-template-columns: repeat(var(--psk-tiles), minmax(0, 1fr)); gap: 12px; }
.psk__tile { gap: 8px; padding: 16px; }
.psk__tile .sk--icon { margin-bottom: 6px; }
.psk__tile-label { width: 58%; height: 12px; border-radius: 6px; }
.psk__tile-value { width: 42%; height: 26px; border-radius: 8px; }
.psk__tile-note { width: 72%; height: 11px; border-radius: 6px; }

.psk__row { display: grid; gap: 16px; }
.psk__row--2 { grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); }
.psk__row--3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }

.psk__heading { width: 38%; height: 16px; border-radius: 6px; }
.psk__lines { display: flex; flex: 1; flex-direction: column; gap: 8px; min-width: 0; }

.psk__toolbar { display: flex; flex-wrap: wrap; gap: 10px; }
.psk__search { flex: 1 1 240px; height: 38px; border-radius: 10px; }
.psk__filter { width: 130px; height: 38px; border-radius: 10px; }

.psk__table { display: grid; grid-template-columns: repeat(var(--psk-columns), minmax(0, 1fr)); margin: 0 -20px -18px; }
.psk__cell { padding: 15px 20px; border-top: 1px solid var(--rb-border); }
.psk__cell--head { padding-block: 11px; }

.psk__fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px 20px; }
.psk__field { display: flex; flex-direction: column; gap: 8px; }
.psk__input { height: 40px; border-radius: 10px; }

.psk__card--banner { flex-direction: row; align-items: center; }

@media (max-width: 900px) {
  .psk__tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .psk__row--2,
  .psk__row--3,
  .psk__fields { grid-template-columns: minmax(0, 1fr); }
}
</style>
