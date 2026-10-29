/**
 * Billing as the two portals show it: statements, receipts and payments.
 *
 * The server decides everything that matters — what is owed, what was paid,
 * whether units may be released. These helpers only turn its answers into
 * words and decide what the screen offers.
 *
 * Pure functions, so the rules can be tested without mounting a page.
 */

import type {
  Billing,
  BillingStatus,
  BillingTransaction,
  PaymentMethod,
  PaymentReceiptSummary,
  StatementDetail,
  StatementRevision,
  TransactionType,
} from '~/types/bloodRequest'

/**
 * The methods a payment is recorded under by hand, in the counter's order.
 * Card and bank transfer were added by the project owner on 2026-10-11.
 */
export const RECORDED_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'gcash', label: 'GCash' },
  { value: 'bank_transfer', label: 'Bank transfer' },
]

/** What each method's reference is called on a form. Cash has none. */
const REFERENCE_NAMES: Record<PaymentMethod, string | null> = {
  cash: null,
  card: 'Card terminal reference',
  gcash: 'GCash reference',
  bank_transfer: 'Bank transfer reference',
}

/**
 * Whether a payment by this method must carry its reference: every method but
 * cash. RedAgos checks none of them with the provider, so the reference is the
 * only evidence the money moved; the server refuses the payment without it.
 */
export function needsReference(method: string | null | undefined): boolean {
  return Boolean(method && REFERENCE_NAMES[method as PaymentMethod])
}

/** The label for a method's reference field, or null for cash and anything unknown. */
export function referenceName(method: string | null | undefined): string | null {
  return (method && REFERENCE_NAMES[method as PaymentMethod]) || null
}

/** Where the amount being entered leaves a payment that may be split across methods. */
export interface SplitEntry {
  /** What is left to pay after the parts already added. */
  remaining: number
  /** How much of the amount entered is recorded as this part. */
  paid: number
  /** Cash handed over beyond what is left. */
  change: number
  /** What would still be left after this part: paid another way. */
  short: number
  /** A card, GCash or transfer amount beyond what is left, which cannot be recorded. */
  over: number
}

/**
 * Work out the part being entered of a payment split across methods (asked for
 * by the project owner on 2026-10-11): ₱10,000 cash against ₱25,000 due is a
 * part of 10,000 with 15,000 left for another method. Cash handed over beyond
 * what is left is change; any other method is for the amount itself. Counted
 * in centavos, so the parts always add up.
 */
export function splitEntry(
  target: string | number | null | undefined,
  partsTotal: string | number | null | undefined,
  method: string,
  entered: string | number | null | undefined,
): SplitEntry {
  const centavos = (value: string | number | null | undefined) => Math.round((Number(value) || 0) * 100)
  const remaining = Math.max(centavos(target) - centavos(partsTotal), 0)
  const amount = Math.max(centavos(entered), 0)
  const paid = Math.min(amount, remaining)
  const beyond = Math.max(amount - remaining, 0)

  return {
    remaining: remaining / 100,
    paid: paid / 100,
    change: method === 'cash' ? beyond / 100 : 0,
    short: amount > 0 ? (remaining - paid) / 100 : 0,
    over: method === 'cash' ? 0 : beyond / 100,
  }
}

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

/** The totals block of the live statement, in pesos: what its page shows before anything is issued. */
export interface LiveStatementTotals {
  subtotal: number
  /** The whole charge when the government subsidy met it, otherwise nothing. */
  subsidy: number
  paid: number
  balance: number
}

/**
 * The live statement's totals, from the server's own figures.
 *
 * The balance is the server's outstanding amount, never worked out here: a
 * statement that collects nothing (subsidised, weekly, void) owes nothing
 * at the counter, whatever its total says.
 */
export function liveStatementTotals(
  statement: Pick<StatementDetail, 'status' | 'total_amount' | 'collected' | 'outstanding'>,
): LiveStatementTotals {
  const subtotal = centavos(statement.total_amount)

  return {
    subtotal: subtotal / 100,
    subsidy: statement.status === 'subsidised' ? subtotal / 100 : 0,
    paid: centavos(statement.collected) / 100,
    balance: centavos(statement.outstanding) / 100,
  }
}

/** A receipt's figures, in pesos, from its frozen snapshot. */
export interface ReceiptFigures {
  /** The statement total the payment was made against; null on a receipt with no statement. */
  total: number | null
  /** Paid before this receipt, worked out from the balance it was made against. */
  paidBefore: number | null
  paid: number
  remaining: number
}

export function receiptFigures(
  receipt: Pick<PaymentReceiptSummary, 'amount_paid' | 'balance_before' | 'balance_after' | 'statement'>,
): ReceiptFigures {
  const total = receipt.statement ? centavos(receipt.statement.total_amount) : null
  const before = centavos(receipt.balance_before)

  return {
    total: total === null ? null : total / 100,
    paidBefore: total === null ? null : Math.max(total - before, 0) / 100,
    paid: centavos(receipt.amount_paid) / 100,
    remaining: Math.max(centavos(receipt.balance_after), 0) / 100,
  }
}

/** One status in the counter's bar of this month's patient bills. */
export interface BillShare {
  key: 'paid' | 'subsidised' | 'partial' | 'unpaid'
  label: string
  count: number
  /** Of all the bills counted, 0 to 1; every share is 0 when there are none. */
  share: number
}

/**
 * This month's patient bills by status, in the bar's fixed order.
 *
 * The order never follows the counts, so a colour always means the same
 * status: settled first (paid, subsidised), then what is still owed.
 */
export function billStatusShares(
  counts: { paid: number; subsidised: number; partial: number; unpaid: number } | null | undefined,
): BillShare[] {
  const order: Array<[BillShare['key'], string]> = [
    ['paid', 'Paid'],
    ['subsidised', 'Subsidised'],
    ['partial', 'Part paid'],
    ['unpaid', 'Unpaid'],
  ]
  const total = order.reduce((sum, [key]) => sum + Math.max(Number(counts?.[key] ?? 0), 0), 0)

  return order.map(([key, label]) => {
    const count = Math.max(Number(counts?.[key] ?? 0), 0)

    return { key, label, count, share: total > 0 ? count / total : 0 }
  })
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

/** Rows that raise a bill rather than settle it; the counter's day leaves them out. */
const CHARGE_TYPES: TransactionType[] = ['charge', 'charge_adjustment', 'opening_balance']

/** Whether a journal row is something that happened at the counter: money in, a void, a subsidy, a settlement. */
export function isCounterEvent(row: Pick<BillingTransaction, 'type'>): boolean {
  return !CHARGE_TYPES.includes(row.type)
}

/**
 * Where a journal row left its bill, as the counter's list labels it.
 *
 * A payment that leaves a balance is a part payment; one that clears it, paid.
 */
export function journalStatus(
  row: Pick<BillingTransaction, 'type' | 'balance_after'>,
): { label: string; tone: 'success' | 'warning' | 'danger' | 'info' | 'muted' | 'purple' } {
  switch (row.type) {
    case 'payment':
      return centavos(row.balance_after) > 0 ? { label: 'Part paid', tone: 'warning' } : { label: 'Paid', tone: 'success' }
    case 'payment_correction':
      return { label: 'Corrected', tone: 'warning' }
    case 'payment_void':
      return { label: 'Voided', tone: 'muted' }
    case 'subsidy':
      return { label: 'Subsidised', tone: 'purple' }
    case 'external_settlement':
      return { label: 'Settled', tone: 'success' }
    default:
      return { label: 'Charged', tone: 'info' }
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
