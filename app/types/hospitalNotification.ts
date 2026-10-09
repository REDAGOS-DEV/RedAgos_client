/**
 * What GET /hospital/notifications actually returns.
 *
 * The page was originally written against an imagined shape (`data`,
 * `has_more`, `description`, `action_path`). The server sends the fields below,
 * so the page reads them through `normalizeHospitalNotification`.
 */

export interface HospitalNotification {
  id: string
  /** `request`, `inventory`, `system`, … — whatever the sending class set. */
  category: string
  title: string | null
  desc: string | null
  meta: string | null
  icon: string | null
  tone: string | null
  action_label: string | null
  action_route: string | null
  read: boolean
  created_at: string | null
}

export interface HospitalNotificationList {
  notifications: HospitalNotification[]
  unread_count: number
  meta: { page: number; per_page: number; total: number; last_page: number }
}

/** A notification as the page shows it. */
export interface HospitalNotificationView {
  id: string
  category: string
  title: string
  description: string
  created_at: string | null
  read: boolean
  tone: string | null
  action_label: string | null
  action_path: string | null
}
