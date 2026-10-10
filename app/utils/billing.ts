/**
 * Billing as the two portals show it: statements, receipts and GCash checkouts.
 *
 * The server decides everything that matters — what is owed, whether a
 * checkout was paid, whether units may be released. These helpers only turn
 * its answers into words and decide what the screen offers. In particular a
 * checkout is never shown as paid because the payer's phone came back from
 * Xendit: only the server's attempt status says that.
 *
 * Pure functions, so the rules can be tested without mounting a page.
 */

import type { Billing, BillingStatus, PaymentAttempt, PaymentAttemptStatus, StatementRevision } from '~/types/bloodRequest'

/** Statuses after which a checkout will never change again. */
const SETTLED_ATTEMPTS: PaymentAttemptStatus[] = ['completed', 'expired', 'canceled', 'failed', 'superseded']

/**
 * Format an amount as pesos. Amounts arrive as decimal strings from the new
 * billing endpoints and as numbers from the older statement fields; both read
 * the same here.
 */
export function pesos(value: string | number | null | undefined): string {
  const amount = Number(value ?? 0)

  return `₱${(Number.isFinite(amount) ? amount : 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

/** Whether a checkout has reached a state it will never leave, so polling can stop. */
export function isAttemptSettled(status: PaymentAttemptStatus | null | undefined): boolean {
  return status != null && SETTLED_ATTEMPTS.includes(status)
}

/** Whether a checkout can still be paid, and so its link or QR code may be shown. */
export function isAttemptPayable(attempt: Pick<PaymentAttempt, 'status' | 'checkout_url'> | null | undefined): boolean {
  return attempt?.status === 'active' && !!attempt.checkout_url
}

/** The badge tone for a checkout's status. */
export function attemptTone(status: PaymentAttemptStatus): 'success' | 'warning' | 'danger' | 'muted' | 'info' {
  switch (status) {
    case 'completed':
      return 'success'
    case 'awaiting_verification':
      return 'warning'
    case 'failed':
      return 'danger'
    case 'active':
    case 'creating':
      return 'info'
    default:
      return 'muted'
  }
}

/** What to tell billing staff when a checkout cannot be opened, from the server's reason code. */
export function checkoutUnavailableMessage(reason: string | null | undefined): string {
  switch (reason) {
    case 'checkout_disabled':
      return 'GCash checkout is switched off at the moment. Take the payment in cash.'
    case 'merchant_not_configured':
      return 'This blood centre has no GCash merchant account set up yet. Take the payment in cash.'
    case 'billing_not_collectible':
      return 'This is a weekly order, billed by statement only. No payment is taken in RedAgos.'
    case 'billing_settled_by_decision':
      return 'This statement was settled by a decision (voided or subsidised). Nothing is to be paid.'
    case 'billing_settled':
      return 'Nothing is outstanding on this statement.'
    case 'payment_in_progress':
      return 'A GCash checkout is already open for this statement.'
    case 'exceeds_channel_limit':
      return 'The balance is above the GCash limit per payment. Take it in cash, or in parts.'
    default:
      return 'GCash checkout is not available for this statement.'
  }
}

/** What a checkout flagged for review needs, in words a supervisor can act on. */
export function reviewReasonMessage(reason: string | null | undefined): string {
  switch (reason) {
    case 'verification_timeout':
      return 'The provider said this was paid, but it could not be confirmed in time. Check the Xendit dashboard, then re-check or close it.'
    case 'amount_mismatch':
    case 'currency_mismatch':
    case 'reference_mismatch':
    case 'payment_missing':
      return 'The provider reported figures that do not match this checkout. Nothing was recorded; check the Xendit dashboard.'
    case 'late_completion':
      return 'Paid after the checkout had closed. The money was recorded; check whether a refund is due.'
    case 'statement_settled_by_decision':
    case 'nothing_outstanding':
    case 'statement_changed':
      return 'Paid against a statement that had already changed. The money was recorded; check for an overpayment or refund.'
    case 'session_unknown':
      return 'The checkout may have opened at the provider without RedAgos hearing back. Check the Xendit dashboard.'
    case 'processing_failed':
    case 'verification_failed':
      return 'The payment notice could not be processed. Re-check it with the provider.'
    default:
      return 'This checkout needs a supervisor to look at it.'
  }
}

/** Whether billing staff may take a payment (cash, GCash, subsidy) on a statement at all. */
export function takesPayment(billing: Pick<Billing, 'collects_payment' | 'clears_release'>): boolean {
  return billing.collects_payment && !billing.clears_release
}

/** An amount the server sent as a decimal string, in whole centavos, so sums never drift. */
function centavos(value: string | number | null | undefined): number {
  const amount = Number(value ?? 0)

  return Number.isFinite(amount) ? Math.round(amount * 100) : 0
}

/** The totals block of a statement, in pesos, as the document lays it out. */
export interface StatementFigures {
  subtotal: number
  /** The government subsidy waives the whole charge, so it is the subtotal or nothing. */
  subsidy: number
  /** What the statement charges once the subsidy is taken off. */
  payable: number
  /** Received before the statement was issued. */
  paid: number
  /** What the statement leaves to be paid. */
  balance: number
}

/**
 * The figures a frozen statement prints, from its own amounts only.
 *
 * A subsidised statement shows the subsidy as a deduction of the whole charge;
 * anything collected before it stays recorded and is refunded, if at all,
 * outside RedAgos, so it never turns into a balance here.
 */
export function statementFigures(
  revision: Pick<StatementRevision, 'billing_status' | 'total_amount' | 'collected_at_issue' | 'amount_due'>,
): StatementFigures {
  const subtotal = centavos(revision.total_amount)
  const subsidy = revision.billing_status === 'subsidised' ? subtotal : 0

  return {
    subtotal: subtotal / 100,
    subsidy: subsidy / 100,
    payable: (subtotal - subsidy) / 100,
    paid: centavos(revision.collected_at_issue) / 100,
    balance: centavos(revision.amount_due) / 100,
  }
}

/** The stamp a statement's status prints under its number. */
export function statementStamp(status: BillingStatus): { label: string; tone: 'success' | 'danger' | 'info' | 'muted' | 'warning' } {
  switch (status) {
    case 'paid':
      return { label: 'PAID', tone: 'success' }
    case 'partial':
      return { label: 'PARTIALLY PAID', tone: 'warning' }
    case 'subsidised':
      return { label: 'GOVERNMENT SUBSIDISED', tone: 'info' }
    case 'statement_only':
      return { label: 'STATEMENT ONLY', tone: 'info' }
    case 'void':
      return { label: 'VOID', tone: 'muted' }
    default:
      return { label: 'UNPAID', tone: 'danger' }
  }
}

/** Save a downloaded document under the given name. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
