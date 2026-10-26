/**
 * Shaping helpers for the Audit Log (blood-center/audit-log.vue).
 *
 * Every row's wording is the server's (App\Support\AuditActions); these only
 * decide how an action's chip reads.
 */

export type AuditTone = 'info' | 'ok' | 'warn' | 'crit' | 'neutral'

/**
 * The chip colour for a kind of action. Anything that removes, refuses or
 * fails reads red; creating and approving green; units going out and messages
 * sent amber; signing in, out and editing blue; looking, exporting and
 * printing grey.
 */
export function auditTypeTone(type: string): AuditTone {
  switch (type) {
    case 'failed_sign_in':
    case 'delete':
    case 'cancel':
    case 'reject': return 'crit'
    case 'create':
    case 'approve': return 'ok'
    case 'issue':
    case 'send': return 'warn'
    case 'sign_in':
    case 'sign_out':
    case 'edit': return 'info'
    default: return 'neutral'
  }
}
