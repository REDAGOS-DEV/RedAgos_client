import { describe, it, expect } from 'vitest'
import {
  attemptTone,
  checkoutUnavailableMessage,
  isAttemptPayable,
  isAttemptSettled,
  pesos,
  reviewReasonMessage,
  takesPayment,
} from '~/utils/billing'

/**
 * Billing on screen.
 *
 * What is locked in: a checkout is shown as payable only while the server says
 * it is active and gave a link; polling stops only on a state the server will
 * never move out of; a weekly (statement-only) order never offers a payment;
 * and every reason the server can give for "no checkout" reads as something
 * billing staff can act on.
 */
describe('pesos', () => {
  it('reads decimal strings and numbers the same', () => {
    expect(pesos('1500.00')).toBe(pesos(1500))
    expect(pesos('0.30')).toBe('₱0.30')
  })

  it('treats a missing or broken amount as zero rather than NaN', () => {
    expect(pesos(null)).toBe('₱0.00')
    expect(pesos('not a number')).toBe('₱0.00')
  })
})

describe('checkout state', () => {
  it('is payable only while active with a link', () => {
    expect(isAttemptPayable({ status: 'active', checkout_url: 'https://checkout.xendit.co/ps-1' })).toBe(true)
    expect(isAttemptPayable({ status: 'active', checkout_url: null })).toBe(false)
    expect(isAttemptPayable({ status: 'awaiting_verification', checkout_url: 'https://checkout.xendit.co/ps-1' })).toBe(false)
    expect(isAttemptPayable(null)).toBe(false)
  })

  it('keeps polling while the server may still change its answer', () => {
    expect(isAttemptSettled('creating')).toBe(false)
    expect(isAttemptSettled('active')).toBe(false)
    expect(isAttemptSettled('awaiting_verification')).toBe(false)
  })

  it('stops polling once the checkout can never change again', () => {
    for (const status of ['completed', 'expired', 'canceled', 'failed', 'superseded'] as const) {
      expect(isAttemptSettled(status)).toBe(true)
    }
  })

  it('marks a payment being confirmed as a warning, not a success', () => {
    expect(attemptTone('awaiting_verification')).toBe('warning')
    expect(attemptTone('completed')).toBe('success')
  })
})

describe('which statements take a payment', () => {
  it('offers payment only on a collectible statement that still blocks release', () => {
    expect(takesPayment({ collects_payment: true, clears_release: false })).toBe(true)
    expect(takesPayment({ collects_payment: true, clears_release: true })).toBe(false)
  })

  it('never offers payment on a weekly statement-only order, even if it were blocking', () => {
    expect(takesPayment({ collects_payment: false, clears_release: false })).toBe(false)
  })
})

describe('messages', () => {
  it('explains every reason the server gives for no checkout', () => {
    const reasons = [
      'checkout_disabled',
      'merchant_not_configured',
      'billing_not_collectible',
      'billing_settled_by_decision',
      'billing_settled',
      'payment_in_progress',
      'exceeds_channel_limit',
    ]

    const messages = reasons.map(checkoutUnavailableMessage)

    expect(new Set(messages).size).toBe(reasons.length)
    expect(checkoutUnavailableMessage('billing_not_collectible')).toMatch(/weekly/i)
  })

  it('tells a supervisor what to do with a checkout flagged for review', () => {
    expect(reviewReasonMessage('verification_timeout')).toMatch(/dashboard/i)
    expect(reviewReasonMessage('late_completion')).toMatch(/refund/i)
    expect(reviewReasonMessage('something_new')).toMatch(/supervisor/i)
  })
})
