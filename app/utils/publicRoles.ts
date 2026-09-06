/**
 * The account types a member of the public may choose on `/auth/role-selection`.
 *
 * Deliberately short. Hospital Blood Bank and Blood Center used to be here, and
 * a Blood Center card led to a real public registration form that created a
 * facility. That is gone: both facility types are onboarded by a Super Admin
 * through Facility Management, and the server has no public route that creates
 * one, so offering the choice would only lead somewhere that refuses.
 *
 * Kept in its own module rather than inline in the page so the list can be
 * asserted on without booting a Nuxt runtime — the page is 500 lines of
 * template and styling around this handful of facts.
 */

/** Role ids the selection screen understands. */
export type PublicRoleId = 'donor' | 'admin'

export interface PublicRole {
  id: PublicRoleId
  name: string
  description: string
  colorClass: string
  iconClass: string
}

export const PUBLIC_ROLES: PublicRole[] = [
  {
    id: 'donor',
    name: 'Donor',
    description: 'Register to donate blood and book appointments.',
    colorClass: 'role-donor',
    iconClass: 'icon-donor',
  },
  {
    id: 'admin',
    name: 'Administrator',
    description: 'Manage the system, users, and overall operations.',
    colorClass: 'role-admin',
    iconClass: 'icon-admin',
  },
]

/**
 * Facility roles, listed here only so the removal is testable.
 *
 * Nothing renders these. They are the ids that must never reappear as a public
 * sign-up choice, and the guard against someone re-adding a card because the
 * portal exists.
 */
export const FACILITY_ROLE_IDS = ['blood-center', 'hospital', 'blood_center', 'blood_bank'] as const

/**
 * Where the Continue button sends each role.
 *
 * Neither of these is a facility. Administrators have never self-registered —
 * their accounts are created by another administrator through `POST /users` —
 * so they go straight to sign-in rather than to a registration form that would
 * have nothing to submit to.
 */
export function destinationFor(roleId: PublicRoleId): string {
  return roleId === 'admin' ? '/auth/admin/login' : `/register/${roleId}`
}
