/**
 * Seconds until a "Resend code" button unlocks again.
 *
 * The resend endpoints allow three sends per ten minutes; without a wait
 * between them a few clicks hit the 429. The timer stops with the component.
 */
export function useResendCooldown() {
  const cooldown = ref(0)
  let timer: ReturnType<typeof setInterval> | null = null

  function stop() {
    if (timer) clearInterval(timer)
    timer = null
  }

  function start(seconds: number) {
    stop()
    cooldown.value = seconds
    timer = setInterval(() => {
      cooldown.value -= 1
      if (cooldown.value <= 0) stop()
    }, 1000)
  }

  /** "0:42", for the button. */
  const label = computed(() => {
    const m = Math.floor(cooldown.value / 60)
    const s = String(cooldown.value % 60).padStart(2, '0')
    return `${m}:${s}`
  })

  onScopeDispose(stop)

  return { cooldown, label, start }
}
