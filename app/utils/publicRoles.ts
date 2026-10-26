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

/**
 * Role ids the selection screen offers for sign-up.
 *
 * Donor only. Administrator used to sit here too, but its card led straight
 * to sign-in, never to a form: administrator accounts are created by another
 * administrator (`POST /users`). A sign-in disguised as a sign-up choice was
 * confusing, so administrators now appear only in the screen's "Sign in"
 * list, like every other portal.
 */
export type PublicRoleId = 'donor'

export interface PublicRole {
  id: PublicRoleId
  name: string
  description: string
}

export const PUBLIC_ROLES: PublicRole[] = [
  {
    id: 'donor',
    name: 'Create a donor account',
    description: 'Book donations, check your eligibility, and track your history.',
  },
]

/**
 * Roles that must never be offered as a public sign-up choice, listed so the
 * rule is testable. Administrators are created by another administrator.
 */
export const NON_PUBLIC_ROLE_IDS = ['admin', 'administrator'] as const

/**
 * Facility roles, listed here only so the removal is testable.
 *
 * Nothing renders these. They are the ids that must never reappear as a public
 * sign-up choice, and the guard against someone re-adding a card because the
 * portal exists.
 */
export const FACILITY_ROLE_IDS = ['blood-center', 'hospital', 'blood_center', 'blood_bank'] as const

/** Where each sign-up choice leads: its registration form. */
export function destinationFor(roleId: PublicRoleId): string {
  return `/register/${roleId}`
}
