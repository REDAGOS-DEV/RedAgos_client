import { ref, watch, type Ref } from 'vue'

/**
 * One success and failure message for every portal (project owner, 2026-11-01),
 * drawn once by components/common/AppToaster.vue, above every layout.
 *
 * Kept outside the composable, as useWorkspaceLaunch's state: a message outlives
 * the page that raised it. Only ever filled on the client, from what someone did.
 * What is wrong with a field stays beside that field; this is for what happened.
 */
export type ToastTone = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: number
  tone: ToastTone
  title: string
  message: string
  duration: number
}

const MAX_SHOWN = 4
// A failure stays longer: it has more to read and something to do about it.
const DURATIONS: Record<ToastTone, number> = { success: 4000, info: 4000, warning: 6000, error: 7000 }
const TONES: Record<string, ToastTone> = {
  success: 'success',
  ok: 'success',
  error: 'error',
  danger: 'error',
  warning: 'warning',
  warn: 'warning',
  info: 'info',
  notice: 'info',
}

const toasts = ref<Toast[]>([])
let nextId = 0

function dismiss(id: number) {
  toasts.value = toasts.value.filter((toast) => toast.id !== id)
}

/** The pages' own word for a tone ('danger', 'notice'…) is taken as it comes. */
function notify(title: string, tone: string = 'success', message: string = '') {
  if (!title) return
  const resolved = TONES[tone] ?? 'success'
  // The same message twice in a row is one message, restarted.
  const same = toasts.value.find((toast) => toast.title === title && toast.tone === resolved)
  if (same) dismiss(same.id)
  toasts.value = [...toasts.value, { id: ++nextId, tone: resolved, title, message, duration: DURATIONS[resolved] }].slice(-MAX_SHOWN)
}

export function useToast() {
  return {
    toasts,
    dismiss,
    notify,
    success: (title: string, message = '') => notify(title, 'success', message),
    error: (title: string, message = '') => notify(title, 'error', message),
    warning: (title: string, message = '') => notify(title, 'warning', message),
    info: (title: string, message = '') => notify(title, 'info', message),
  }
}

type NoticeValue = string | { tone?: string, text?: string } | null | undefined

/**
 * Sends a page's own message ref to the toast: whatever it sets, a string or
 * { tone, text }, shows in the one design and the ref empties again, so the
 * page's own markup for it never draws. `keepWhile` leaves it on the page for a
 * failure that belongs there, such as the list itself not loading.
 */
export function useNoticeToast(
  source: Ref<NoticeValue>,
  options: { kind?: Ref<string>, tone?: () => string, keepWhile?: () => boolean } = {},
) {
  watch(source, (value) => {
    if (!value || options.keepWhile?.()) return
    const isText = typeof value === 'string'
    const title = isText ? value : value.text ?? ''
    const tone = (isText ? undefined : value.tone) ?? options.kind?.value ?? options.tone?.() ?? 'success'
    notify(title, tone)
    source.value = isText ? '' : null
  })
}
