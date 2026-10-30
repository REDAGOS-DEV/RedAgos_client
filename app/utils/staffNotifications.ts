/**
 * The blood-centre inbox, shared by the header bell and the Notifications page
 * (2026-10-31): its tabs, how the day groups read, and the order within them.
 * The categories are the ones the server's notifications carry.
 */
export interface StaffNotification {
  id: string
  category: string
  title: string | null
  desc: string | null
  meta: string | null
  icon: string | null
  tone: string | null
  action_label: string | null
  action_route: string | null
  urgent?: boolean
  read: boolean
  created_at: string | null
}

export const NOTIFICATION_TABS = [
  { key: '', label: 'All', icon: 'bell' },
  { key: 'request', label: 'Requests', icon: 'inbox' },
  { key: 'inventory', label: 'Stock', icon: 'package' },
  { key: 'laboratory', label: 'Laboratory', icon: 'flask-conical' },
  { key: 'collection', label: 'Collection', icon: 'droplets' },
  { key: 'correction', label: 'Corrections', icon: 'pencil' },
] as const

/**
 * Which kind of notification each topic sends (the server's
 * StaffNotificationTopics keys and the categories its notifications carry).
 */
export const TOPIC_CATEGORY: Record<string, string> = {
  blood_requests: 'request',
  serology_verification: 'laboratory',
  referrals: 'laboratory',
  corrections: 'correction',
  low_stock: 'inventory',
  expiring_units: 'inventory',
  morning_briefing: 'collection',
  drive_reminders: 'collection',
  deferrals_ending: 'collection',
}

/**
 * The tabs for this person (2026-10-31): All, then only the kinds their role
 * and department receive, from the topics the server says are theirs.
 */
export function tabsFor(topicKeys: string[]): typeof NOTIFICATION_TABS[number][] {
  const kinds = new Set(topicKeys.map(k => TOPIC_CATEGORY[k]).filter(Boolean))
  return NOTIFICATION_TABS.filter(t => t.key === '' || kinds.has(t.key))
}

/** What each department's inbox is for, said when it is empty. */
export const EMPTY_BY_DEPARTMENT: Record<string, string> = {
  collection: 'Bookings, deferrals ending and drive reminders appear here.',
  testing: 'Results to verify, referrals waiting and corrections appear here.',
  processing: 'Corrections to decide and units waiting for their hand-over appear here.',
  issuance: 'New and emergency requests, low stock and units about to expire appear here.',
  billing: 'Invoices and corrections to payments appear here.',
}

/** Unread emergencies first, then newest first. */
export function inboxOrder(items: StaffNotification[]): StaffNotification[] {
  const pinned = (n: StaffNotification) => (n.urgent && !n.read ? 0 : 1)
  return [...items].sort((a, b) => pinned(a) - pinned(b)
    || new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
}

/** Today, Yesterday, then the date; an unread emergency heads the list on its own. */
export function groupByDay(items: StaffNotification[], now = new Date()): { label: string, items: StaffNotification[] }[] {
  const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
  const today = dayKey(now)
  const yesterday = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))
  const groups: { label: string, items: StaffNotification[] }[] = []

  for (const item of inboxOrder(items)) {
    let label: string
    if (item.urgent && !item.read) {
      label = 'Needs attention'
    } else {
      const at = item.created_at ? new Date(item.created_at) : null
      const key = at ? dayKey(at) : ''
      label = key === today ? 'Today' : key === yesterday ? 'Yesterday'
        : at ? at.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : 'Earlier'
    }
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.items.push(item)
    else groups.push({ label, items: [item] })
  }

  return groups
}

export function timeAgo(iso: string | null, now = Date.now()): string {
  const at = iso ? new Date(iso).getTime() : Number.NaN
  if (Number.isNaN(at)) return ''
  const minutes = Math.round((now - at) / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
  return new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** A route inside the app, never a link elsewhere. */
export function safeRoute(route: string | null | undefined): string | null {
  return typeof route === 'string' && route.startsWith('/') && !route.startsWith('//') ? route : null
}
