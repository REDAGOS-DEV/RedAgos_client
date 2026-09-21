import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  rememberPendingVerification,
  readPendingVerification,
  markEmailVerified,
  hasVerifiedSignal,
  clearVerificationHandoff,
  onEmailVerified,
} from '~/utils/emailVerification'

/**
 * The hand-off between the tab that registered and the tab that verified.
 *
 * What is worth pinning down here is the decision it drives: a donor is only
 * sent on to login on a marker the verify page wrote after the API confirmed
 * the address, and a *stale* marker must never send someone registering a
 * second account straight past their own "check your email" step.
 */
function fakeStorage(): Storage {
  const data = new Map<string, string>()

  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
    key: (i: number) => [...data.keys()][i] ?? null,
    get length() { return data.size },
  } as Storage
}

beforeEach(() => {
  vi.stubGlobal('localStorage', fakeStorage())
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('the pending registration', () => {
  it('survives a reload so the panel can be restored', () => {
    rememberPendingVerification('donor@example.com')

    expect(readPendingVerification()?.email).toBe('donor@example.com')
  })

  it('is absent before anyone registers', () => {
    expect(readPendingVerification()).toBeNull()
  })

  it('goes stale after a day rather than greeting someone who moved on', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    rememberPendingVerification('donor@example.com')

    vi.setSystemTime(new Date('2026-01-02T00:00:01Z'))

    expect(readPendingVerification()).toBeNull()
  })

  it('survives unreadable storage instead of throwing', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
      removeItem: () => { throw new Error('blocked') },
    })

    expect(() => rememberPendingVerification('donor@example.com')).not.toThrow()
    expect(readPendingVerification()).toBeNull()
    expect(hasVerifiedSignal()).toBe(false)
  })

  it('reports nothing when the stored value is not the shape we wrote', () => {
    localStorage.setItem('_pending_verification', 'not json')

    expect(readPendingVerification()).toBeNull()
  })
})

describe('the verified signal', () => {
  it('is only raised once the verify page records a confirmed verification', () => {
    rememberPendingVerification('donor@example.com')
    expect(hasVerifiedSignal()).toBe(false)

    markEmailVerified()

    expect(hasVerifiedSignal()).toBe(true)
  })

  it('does not survive into a second registration', () => {
    rememberPendingVerification('first@example.com')
    markEmailVerified()

    // Somebody signs up again on the same browser. Carrying the old marker over
    // would skip them straight past their own verification step.
    rememberPendingVerification('second@example.com')

    expect(hasVerifiedSignal()).toBe(false)
    expect(readPendingVerification()?.email).toBe('second@example.com')
  })

  it('is forgotten once acted on', () => {
    rememberPendingVerification('donor@example.com')
    markEmailVerified()

    clearVerificationHandoff()

    expect(hasVerifiedSignal()).toBe(false)
    expect(readPendingVerification()).toBeNull()
  })
})

describe('onEmailVerified', () => {
  const listeners = new Set<(_e: StorageEvent) => void>()

  beforeEach(() => {
    listeners.clear()
    vi.stubGlobal('window', {
      addEventListener: (_: string, fn: (_e: StorageEvent) => void) => void listeners.add(fn),
      removeEventListener: (_: string, fn: (_e: StorageEvent) => void) => void listeners.delete(fn),
    })
  })

  function emit(key: string, newValue: string | null) {
    for (const fn of listeners) fn({ key, newValue } as StorageEvent)
  }

  it('fires when another tab records a verification', () => {
    const handler = vi.fn()
    onEmailVerified(handler)

    emit('_email_verified', String(Date.now()))

    expect(handler).toHaveBeenCalledOnce()
  })

  it('ignores unrelated keys and our own clean-up removal', () => {
    const handler = vi.fn()
    onEmailVerified(handler)

    emit('_token', 'abc')
    emit('_email_verified', null)

    expect(handler).not.toHaveBeenCalled()
  })

  it('stops listening once unsubscribed', () => {
    const handler = vi.fn()
    const stop = onEmailVerified(handler)

    stop()
    emit('_email_verified', String(Date.now()))

    expect(handler).not.toHaveBeenCalled()
  })
})
