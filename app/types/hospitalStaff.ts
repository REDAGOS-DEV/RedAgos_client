/**
 * A hospital blood bank's staff and roles (project owner, 2026-10-11).
 *
 * The Head keeps the roster; requesting staff raise requests and confirm
 * dispatched blood arrived; inventory staff stock bags in and handle them.
 */

export type HospitalRole = 'head' | 'inventory_staff' | 'requesting_staff'

export interface HospitalRoleOption {
  value: HospitalRole
  label: string
  description: string
}

export interface HospitalStaffMember {
  uuid: string
  first_name: string
  last_name: string
  full_name: string
  email: string
  phone: string | null
  position: string | null
  hospital_role: HospitalRole | null
  hospital_role_label: string | null
  account_status: string | null
  email_verified: boolean
  /** The signed-in Head's own account. */
  is_you: boolean
  deleted_at: string | null
  created_at: string | null
}
