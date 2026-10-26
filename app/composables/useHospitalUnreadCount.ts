import { hospitalService } from '~/api/hospital/HospitalService'

const POLL_MS = 60_000

// Outside the composable so that however many callers start it, there is one
// interval, and whichever caller stops it stops that one.
let timer: ReturnType<typeof setInterval> | null = null

/**
 * The hospital bell's unread count, shared by the layout and the inbox page.
 *
 * The layout starts it once the user is known and stops it when the layout
 * goes; the inbox page only calls `refresh()` or `set()` after it changes
 * something, so the badge follows without waiting for the next poll.
 */
export function useHospitalUnreadCount() {
  const count = useState<number>('hospital-unread-count', () => 0)

  /** Read the count from the server. A missed poll keeps the last known number. */
  async function refresh(): Promise<void> {
    try {
      const res = await hospitalService.notificationsUnreadCount()
      count.value = Number(res?.unread_count ?? 0)
    } catch {
      // Not worth an error on every page; the next poll retries.
    }
  }

  /** Fetch now, then every minute. Safe to call twice: it never starts a second interval. */
  function start(): void {
    if (timer !== null) return

    void refresh()
    timer = setInterval(() => void refresh(), POLL_MS)
  }

  /** Stop polling. Called when the layout unmounts. */
  function stop(): void {
    if (timer === null) return

    clearInterval(timer)
    timer = null
  }

  /** Set the count from a response that already carries it. */
  function set(value: number): void {
    count.value = Math.max(0, value)
  }

  return { count, refresh, start, stop, set }
}
