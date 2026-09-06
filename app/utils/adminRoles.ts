/**
 * Display names for the server's admin privilege presets.
 *
 * The presets themselves live in `App\Support\AdminPrivileges` and reach the
 * client as `admin_role` on the user resource, already derived from the stored
 * privilege list. Only the wording is here — adding a preset server-side and
 * forgetting this file degrades to showing the raw key, not to a wrong claim
 * about what someone can do.
 */
export const ADMIN_ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Administrator',
  verification_officer: 'Verification Officer',
  network_admin: 'Network Administrator',
  auditor: 'Auditor',
}

/**
 * Name an admin account's access level.
 *
 * `null` is the server saying the granted privileges match no preset, which is
 * a real and expected state rather than an error — it is what hand-picking
 * produces. "Custom Access" is deliberately not blank: an account with an
 * unnamed set still has one, and showing nothing reads as "no access".
 */
export function adminRoleLabel(role: string | null | undefined): string {
  if (!role) return 'Custom Access'

  return ADMIN_ROLE_LABELS[role] ?? role
}
