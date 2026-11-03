import type {
  HospitalNotification,
  HospitalNotificationList,
  HospitalNotificationView,
} from '~/types/hospitalNotification'

/**
 * Turns the server's notification payload into what the inbox page shows.
 *
 * The server names a message's body `desc` and its link `action_route`; the
 * page and its template read `description` and `action_path`. The mapping
 * lives here, in one tested place, so the two cannot drift apart again.
 */
export function normalizeHospitalNotification(n: HospitalNotification): HospitalNotificationView {
  return {
    id: n.id,
    category: n.category || 'system',
    title: n.title ?? '',
    description: n.desc ?? '',
    created_at: n.created_at,
    read: !!n.read,
    tone: n.tone,
    meta: n.meta ?? null,
    urgent: !!n.urgent,
    action_label: n.action_label,
    action_path: n.action_route,
  }
}

const CATEGORY_ICONS: Record<string, string> = {
  request: 'clipboard-list',
  inventory: 'triangle-alert',
}
const CATEGORY_TONES: Record<string, string> = { request: 'info', inventory: 'warning' }
const TONE_NAMES: Record<string, string> = { accent: 'danger', primary: 'info' }

/**
 * The icon and colour of a notification, by its category and the tone the
 * server gave it, so the inbox and the bell draw the same one. Urgent is always
 * the danger colour.
 */
export function notificationLook(n: Partial<Pick<HospitalNotificationView, 'category' | 'tone' | 'urgent'>>): { icon: string; tone: string } {
  const tone = n.urgent ? 'danger' : n.tone || CATEGORY_TONES[n.category ?? ''] || 'neutral'
  return { icon: CATEGORY_ICONS[n.category ?? ''] ?? 'bell', tone: TONE_NAMES[tone] ?? tone }
}

/** "Just now", "5 min ago", "2 hours ago", then the date. */
export function notificationTime(iso: string | null | undefined, now: number = Date.now()): string {
  const at = iso ? new Date(iso).getTime() : NaN
  if (Number.isNaN(at)) return ''
  const minutes = Math.floor((now - at) / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  return new Date(at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export interface NotificationGroup {
  key: string
  label: string
  items: HospitalNotificationView[]
}

/**
 * The inbox's sections: unread urgent ones first, under Needs Action, then the
 * rest by day. Order inside a section stays the server's, newest first.
 */
export function groupNotifications(list: HospitalNotificationView[], now: number = Date.now()): NotificationGroup[] {
  const dayStart = (time: number) => new Date(time).setHours(0, 0, 0, 0)
  const today = dayStart(now)
  const yesterday = dayStart(today - 1)
  const sections: NotificationGroup[] = [
    { key: 'action', label: 'Needs Action', items: [] },
    { key: 'today', label: 'Today', items: [] },
    { key: 'yesterday', label: 'Yesterday', items: [] },
    { key: 'earlier', label: 'Earlier', items: [] },
  ]
  const [action, todays, yesterdays, earlier] = sections as [NotificationGroup, NotificationGroup, NotificationGroup, NotificationGroup]

  for (const n of list) {
    const at = n.created_at ? new Date(n.created_at).getTime() : NaN
    if (n.urgent && !n.read) action.items.push(n)
    else if (Number.isNaN(at) || at < yesterday) earlier.items.push(n)
    else if (at < today) yesterdays.items.push(n)
    else todays.items.push(n)
  }

  return sections.filter((section) => section.items.length)
}

/** The bell's short list: an unread urgent one never sits under the fold. */
export function urgentFirst(list: HospitalNotificationView[]): HospitalNotificationView[] {
  const first = (n: HospitalNotificationView) => (n.urgent && !n.read ? 0 : 1)
  return [...list].sort((a, b) => first(a) - first(b))
}

/** Whether another page exists after the one just loaded. */
export function hasMorePages(meta: HospitalNotificationList['meta'] | undefined | null): boolean {
  return !!meta && meta.page < meta.last_page
}
