import { onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * One clock for every "5 min ago" on screen (2026-11-20).
 *
 * Ticks once a minute while anything that reads it is mounted, and stops when
 * the last one goes, so the notification lists and bells of every portal keep
 * their times current without each running its own timer.
 */
const now = ref(Date.now())
let readers = 0
let timer: ReturnType<typeof setInterval> | null = null

export function useNow() {
  onMounted(() => {
    now.value = Date.now()
    if (readers++ === 0) timer = setInterval(() => { now.value = Date.now() }, 60_000)
  })

  onBeforeUnmount(() => {
    if (--readers === 0 && timer) {
      clearInterval(timer)
      timer = null
    }
  })

  return now
}

/** The exact moment, for a tooltip beside a relative time. */
export function exactTime(iso: string | null | undefined): string {
  const at = iso ? new Date(iso) : null
  return at && !Number.isNaN(at.getTime())
    ? at.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : ''
}
