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
    action_label: n.action_label,
    action_path: n.action_route,
  }
}

/** Whether another page exists after the one just loaded. */
export function hasMorePages(meta: HospitalNotificationList['meta'] | undefined | null): boolean {
  return !!meta && meta.page < meta.last_page
}
