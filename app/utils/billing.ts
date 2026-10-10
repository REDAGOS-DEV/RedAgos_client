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

import type {
  Billing,
  BillingStatus,
  BillingTransaction,
  PaymentAttempt,
  PaymentAttemptStatus,
  StatementRevision,
  TransactionType,
} from '~/types/bloodRequest'

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
    case 'settled_outside':
      return { label: 'SETTLED BY HOSPITAL', tone: 'success' }
    case 'void':
      return { label: 'VOID', tone: 'muted' }
    default:
      return { label: 'UNPAID', tone: 'danger' }
  }
}

/* ------------------------------------------------------------------ *
 * The counter: cash tendered, change, and the drawer count
 * ------------------------------------------------------------------ */

/**
 * The peso notes and coins a drawer count lists, largest first.
 *
 * The same list the server accepts (CashSessionService::DENOMINATIONS).
 */
export const CASH_DENOMINATIONS = ['1000', '500', '200', '100', '50', '20', '10', '5', '1', '0.25'] as const

/**
 * The change owed back for cash handed over against what is being paid, in pesos.
 *
 * Null when what was handed over does not cover it: the screen asks for more
 * rather than recording less. Worked in centavos, so ₱0.30 of change is
 * never ₱0.29999.
 */
export function changeDue(tendered: string | number | null | undefined, paying: string | number | null | undefined): number | null {
  const handed = centavos(tendered)
  const owed = centavos(paying)

  if (handed < owed) return null

  return (handed - owed) / 100
}

/**
 * The amounts a cashier is most likely handed for a balance: the exact sum,
 * then the next round ₱100, ₱500 and ₱1,000 above it.
 */
export function quickTenderAmounts(owed: string | number | null | undefined): number[] {
  const exact = centavos(owed)
  if (exact <= 0) return []

  const roundUp = (step: number) => Math.ceil(exact / step) * step
  const amounts = [exact, roundUp(10_000), roundUp(50_000), roundUp(100_000)]

  return [...new Set(amounts)].sort((a, b) => a - b).map((value) => value / 100)
}

/** Add up a drawer count — denomination to how many — in pesos, exactly. */
export function cashCountTotal(breakdown: Record<string, number | string | null | undefined>): number {
  let total = 0

  for (const [denomination, count] of Object.entries(breakdown)) {
    const pieces = Math.max(0, Math.floor(Number(count) || 0))
    total += centavos(denomination) * pieces
  }

  return total / 100
}

/** What a shift's difference between counted and expected cash reads as. */
export function shiftVariance(variance: string | number | null | undefined): { label: string; tone: 'success' | 'warning' | 'danger' } {
  const amount = centavos(variance)

  if (amount === 0) return { label: 'Balanced', tone: 'success' }

  return amount > 0
    ? { label: `Over by ${pesos(amount / 100)}`, tone: 'warning' }
    : { label: `Short by ${pesos(-amount / 100)}`, tone: 'danger' }
}

/* ------------------------------------------------------------------ *
 * The billing journal
 * ------------------------------------------------------------------ */

/** The badge tone for a journal row's type. */
export function transactionTone(type: TransactionType): 'success' | 'warning' | 'danger' | 'muted' | 'info' {
  switch (type) {
    case 'payment':
    case 'external_settlement':
      return 'success'
    case 'payment_void':
      return 'danger'
    case 'payment_correction':
    case 'charge_adjustment':
      return 'warning'
    case 'subsidy':
      return 'info'
    default:
      return 'muted'
  }
}

/**
 * A journal row's amount as it reads in a list: a charge raises the bill (+),
 * anything that settles it lowers it (−).
 */
export function journalAmount(row: Pick<BillingTransaction, 'amount'>): string {
  const amount = centavos(row.amount)

  if (amount === 0) return pesos(0)

  return `${amount > 0 ? '+' : '−'}${pesos(Math.abs(amount) / 100)}`
}

/** Words that are never an initial: "Bureau of Blood" is "BB", not "BO". */
const MONOGRAM_SKIPPED = ['of', 'the', 'and', 'de', 'del', 'ng', 'sa', 'for']

/**
 * The initials a centre's billing documents carry when it has uploaded no logo.
 *
 * The same rule as the server's FacilityMonogram, so the screen and the PDF
 * show the same mark: up to two initials, skipping the small joining words.
 */
export function facilityInitials(name: string | null | undefined): string {
  return (name ?? '')
    .trim()
    .split(/[\s-]+/u)
    .filter((word) => /^\p{L}/u.test(word) && !MONOGRAM_SKIPPED.includes(word.toLowerCase()))
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('')
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
