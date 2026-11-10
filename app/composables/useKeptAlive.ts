import { onActivated, onDeactivated, readonly, ref, type Ref } from 'vue'

/**
 * Helpers for pages kept alive between visits (`definePageMeta({ keepalive: true })`).
 *
 * A kept-alive page is not destroyed when you leave it. Nuxt holds it in
 * memory, hidden, and shows it again on return, so the page comes back at once
 * with its filters, scroll and typed-in fields as they were. Two things follow:
 *
 * - Its data would go stale. `onMounted` runs only on the first visit, so a
 *   page must also reload on every return — quietly, over what is already on
 *   screen, or the cache buys nothing visible. That is `onPageReturn`.
 * - It is still running. Timers keep ticking, window listeners keep firing,
 *   and anything teleported to <body> (an open dialog, an open dropdown) stays
 *   on screen over the next page, because Vue leaves teleported content where
 *   it is when a kept-alive page is hidden (checked on Vue 3.5.44). That is
 *   `usePageHidden`, plus `onActivated`/`onDeactivated` for timers.
 *
 * Both work in any component on the page, not only the page itself: a panel
 * that loads its own data refreshes itself.
 *
 * The cache lasts while you stay in one portal. Signing out goes to a page with
 * another layout, which discards it, so nothing cached reaches the next person
 * to sign in.
 */

/**
 * Run `refresh` each time the page is shown again after being left.
 *
 * Never on the first visit — `onMounted` owns that. The guard is "has been
 * hidden since", not "skip the first activation": a component mounted later
 * (behind a v-if) is never sent that first activation, so skipping it would
 * swallow its first real return instead.
 */
export function onPageReturn(refresh: () => unknown): void {
  let away = false

  onDeactivated(() => {
    away = true
  })

  onActivated(() => {
    if (!away) return
    away = false
    void refresh()
  })
}

/**
 * True while the page this component sits on is kept but not shown.
 *
 * Bind it to a teleport, `<Teleport to="body" :disabled="pageHidden">`, so an
 * open dialog or dropdown goes back inside the hidden page instead of staying
 * over the next one, and comes back when you return. Read it before touching
 * anything page-wide, such as the body's scroll lock.
 */
export function usePageHidden(): Readonly<Ref<boolean>> {
  const hidden = ref(false)

  onDeactivated(() => {
    hidden.value = true
  })

  onActivated(() => {
    hidden.value = false
  })

  return readonly(hidden)
}
