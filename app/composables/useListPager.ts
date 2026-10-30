import { computed, ref, watch, type Ref } from 'vue'

/**
 * Page a list the server returns whole, for ListPager: "Showing 26–50 of 80",
 * page 2 of 4. The blood bank's lists read as the centre's Donor Management
 * does (project owner, 2026-10-30), whether the server pages them or not.
 *
 * A list that shrinks under the page (a filter, a removal) puts the page back
 * on its last one.
 */
export function useListPager<T>(items: Ref<T[]>, perPage = 25) {
  const page = ref(1)
  const total = computed(() => items.value.length)
  const lastPage = computed(() => Math.max(1, Math.ceil(total.value / perPage)))
  const from = computed(() => (total.value ? (page.value - 1) * perPage + 1 : 0))
  const to = computed(() => Math.min(page.value * perPage, total.value))
  const pageItems = computed(() => items.value.slice((page.value - 1) * perPage, page.value * perPage))

  watch(lastPage, (last) => {
    if (page.value > last) page.value = last
  })

  function go(target: number) {
    page.value = Math.min(Math.max(1, target), lastPage.value)
  }

  return { page, total, lastPage, from, to, pageItems, go }
}
