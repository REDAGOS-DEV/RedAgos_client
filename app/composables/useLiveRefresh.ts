import { onActivated, onBeforeUnmount, onDeactivated, onMounted } from 'vue'
import { usePageHidden } from '~/composables/useKeptAlive'

/**
 * Keep a page's queue current while someone is looking at it.
 *
 * A kept-alive page reloads when you come back to it (onPageReturn), but not
 * while you stay on it: Staff A, sitting on Incoming Requests, would not see
 * the emergency request a hospital just sent. This adds the two refreshes a
 * page needs while it is open:
 *
 * - every `intervalMs`, while both the page and the browser tab are in view;
 * - when the tab comes back into view, at most once per `focusGapMs`.
 *
 * Both skip their turn while `pauseWhen()` is true (an action under way, a
 * payment being taken, a dialog that a reload would disturb), while the page
 * is kept but hidden, while the tab is hidden, and while a refresh is still
 * running: one started moments ago is as fresh as the one that would follow.
 * The timer is stopped outright while the page is hidden, so a hidden page
 * costs nothing.
 *
 * `run()` is for everything else, such as the page's own onPageReturn, or
 * after an action. It never skips: if a refresh is running, exactly one more
 * runs after it, so a change made meanwhile is always read.
 *
 * The refresh is the page's own load, and it must load only the queue the
 * page shows, quietly, leaving any open item, bill, form or dialog alone.
 * Only unthrottled routes that write no audit entry on a read may be
 * refreshed this way.
 *
 * Ordering is the page's part: a refresh started before a filter change or an
 * action can answer after it. Guard each load with createLatest().
 */

export interface LiveRefreshOptions {
  /** How often to refresh while the page and the tab are in view. */
  intervalMs: number
  /** While true, the timer and the tab-focus refresh skip their turn. */
  pauseWhen?: () => boolean
  /** The least time between two refreshes started by the tab coming back. Default 30 s. */
  focusGapMs?: number
}

export interface LiveRefresh {
  /** Refresh now; if a refresh is running, one more runs after it. Resolves when the last has finished. */
  run: () => Promise<void>
}

export function useLiveRefresh(refresh: () => unknown, options: LiveRefreshOptions): LiveRefresh {
  const pageHidden = usePageHidden()
  const focusGapMs = options.focusGapMs ?? 30_000

  let running: Promise<void> | null = null
  let again = false
  let timer: ReturnType<typeof setInterval> | null = null
  let lastFocusRefresh = 0
  let mounted = false

  function run(): Promise<void> {
    if (running) {
      again = true

      return running
    }

    running = (async () => {
      try {
        do {
          again = false

          try {
            await refresh()
          } catch (error) {
            // The page reports its own failures; a missed refresh is retried by the next.
            console.error(error)
          }
        } while (again)
      } finally {
        running = null
      }
    })()

    return running
  }

  function inView(): boolean {
    return !pageHidden.value
      && document.visibilityState === 'visible'
      && !(options.pauseWhen?.() ?? false)
  }

  function backgroundTurn(): void {
    if (running || !inView()) return

    void run()
  }

  function onVisibilityChange(): void {
    if (document.visibilityState !== 'visible') return
    if (Date.now() - lastFocusRefresh < focusGapMs) return

    lastFocusRefresh = Date.now()
    backgroundTurn()
  }

  function start(): void {
    if (timer !== null || options.intervalMs <= 0) return

    timer = setInterval(backgroundTurn, options.intervalMs)
  }

  function stop(): void {
    if (timer === null) return

    clearInterval(timer)
    timer = null
  }

  onMounted(() => {
    mounted = true
    start()
    document.addEventListener('visibilitychange', onVisibilityChange)
  })

  // Kept alive: no timer while the page is hidden, back on when it is shown.
  onActivated(() => {
    if (mounted) start()
  })
  onDeactivated(stop)

  onBeforeUnmount(() => {
    stop()
    document.removeEventListener('visibilitychange', onVisibilityChange)
  })

  return { run }
}

/**
 * Newest reply wins.
 *
 * Each load takes a ticket with begin() before it asks the server, and
 * applies its reply only if isCurrent(ticket) still holds when it lands. A
 * later load, a filter change or an action calling invalidate() makes every
 * earlier ticket stale, so a slow reply to an older question can never
 * overwrite a newer one. Use one per piece of data a page loads.
 */
export interface Latest {
  begin: () => number
  isCurrent: (ticket: number) => boolean
  invalidate: () => void
}

export function createLatest(): Latest {
  let current = 0

  return {
    begin: () => ++current,
    isCurrent: (ticket) => ticket === current,
    invalidate: () => {
      current++
    },
  }
}
