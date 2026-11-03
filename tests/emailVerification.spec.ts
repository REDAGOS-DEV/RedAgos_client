import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  rememberPendingVerification,
  readPendingVerification,
  clearPendingVerification,
} from '~/utils/emailVerification'

/**
 * The registration waiting on its verification code, kept across a reload so
 * the register page can put the code step back instead of an empty form.
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
  it('survives a reload so the code step can be restored', () => {
    rememberPendingVerification('donor@example.com')

    expect(readPendingVerification()?.email).toBe('donor@example.com')
  })

  it('is absent before anyone registers', () => {
    expect(readPendingVerification()).toBeNull()
  })

  it('is replaced by a second registration', () => {
    rememberPendingVerification('first@example.com')
    rememberPendingVerification('second@example.com')

    expect(readPendingVerification()?.email).toBe('second@example.com')
  })

  it('is forgotten once the address is verified', () => {
    rememberPendingVerification('donor@example.com')

    clearPendingVerification()

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
    expect(() => clearPendingVerification()).not.toThrow()
  })

  it('reports nothing when the stored value is not the shape we wrote', () => {
    localStorage.setItem('_pending_verification', 'not json')

    expect(readPendingVerification()).toBeNull()
  })
})
