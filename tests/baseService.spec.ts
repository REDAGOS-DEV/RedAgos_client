import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * `BaseService` error mapping and the 401 hand-off.
 *
 * These matter because every service in the app inherits them. A wrong answer
 * here either loses the field errors a form needs to render, or fails to notice
 * that the session is dead — which is what used to leave users on a dashboard
 * where nothing worked and nothing explained why.
 */

// --- Nuxt auto-imports the file expects ------------------------------------
const runtimeConfig = { public: { apiBaseURL: 'http://api.test/api' } }
vi.stubGlobal('useRuntimeConfig', () => runtimeConfig)

const fetchMock = vi.fn()
vi.stubGlobal('$fetch', fetchMock)

vi.stubGlobal('localStorage', {
  store: new Map<string, string>(),
  getItem(k: string) { return this.store.get(k) ?? null },
  setItem(k: string, v: string) { this.store.set(k, v) },
  removeItem(k: string) { this.store.delete(k) },
})

const { reportUnauthorized, onUnauthorized } = await import('~/api/unauthorized')
const { BaseService } = await import('~/api/BaseService')

/** Shape ofetch throws: the parsed body hangs off `response._data`. */
function httpError(status: number, data: any = {}) {
  return Object.assign(new Error('fetch failed'), { response: { status, _data: data } })
}

describe('BaseService error mapping', () => {
  let service: any

  beforeEach(() => {
    fetchMock.mockReset()
    service = new BaseService()
  })

  afterEach(() => {
    onUnauthorized(null)
  })

  it('surfaces the server message rather than a generic one', async () => {
    fetchMock.mockRejectedValue(httpError(422, { message: 'The email has already been taken.' }))

    await expect(service.request('/x')).rejects.toThrow('The email has already been taken.')
  })

  it('keeps field errors so forms can render them per input', async () => {
    fetchMock.mockRejectedValue(httpError(422, {
      message: 'Validation failed.',
      errors: { email: ['The email field is required.'] },
    }))

    await expect(service.request('/x')).rejects.toMatchObject({
      status: 422,
      errors: { email: ['The email field is required.'] },
    })
  })

  /**
   * Callers read `code` and `screening_valid_until` off the body — a status
   * code alone is not enough, which is why the whole payload is attached.
   */
  it('attaches the whole response body, not just status and message', async () => {
    fetchMock.mockRejectedValue(httpError(403, {
      message: 'Not verified.',
      code: 'email_not_verified',
    }))

    await expect(service.request('/x')).rejects.toMatchObject({
      data: { code: 'email_not_verified' },
    })
  })

  it('replaces an empty 500 body with something a user can act on', async () => {
    fetchMock.mockRejectedValue(httpError(500, {}))

    await expect(service.request('/x')).rejects.toThrow(/Server error/)
  })

  it('falls back to a generic message when the server sends nothing usable', async () => {
    fetchMock.mockRejectedValue({ response: { status: 502, _data: {} } })

    await expect(service.request('/x')).rejects.toThrow(/Something went wrong/)
  })
})

describe('BaseService 401 hand-off', () => {
  let service: any

  beforeEach(() => {
    fetchMock.mockReset()
    service = new BaseService()
  })

  afterEach(() => {
    onUnauthorized(null)
  })

  it('reports a 401 so the session-expiry plugin can redirect', async () => {
    const handler = vi.fn()
    onUnauthorized(handler)
    fetchMock.mockRejectedValue(httpError(401, { message: 'Unauthenticated.' }))

    await expect(service.request('/x')).rejects.toThrow()

    expect(handler).toHaveBeenCalledOnce()
    expect(handler.mock.calls[0]![0]).toMatchObject({ status: 401 })
  })

  /**
   * Reporting must not swallow the error. Existing callers all have their own
   * catch blocks and would otherwise hang on a promise that never settles.
   */
  it('still throws after reporting', async () => {
    onUnauthorized(vi.fn())
    fetchMock.mockRejectedValue(httpError(401, {}))

    await expect(service.request('/x')).rejects.toBeInstanceOf(Error)
  })

  it('does not report anything else as a dead session', async () => {
    const handler = vi.fn()
    onUnauthorized(handler)

    for (const status of [400, 403, 404, 422, 429, 500]) {
      fetchMock.mockRejectedValue(httpError(status, {}))
      await expect(service.request('/x')).rejects.toThrow()
    }

    expect(handler).not.toHaveBeenCalled()
  })

  /**
   * A throwing handler must not replace the original error — the caller is
   * about to render it.
   */
  it('survives a handler that throws', async () => {
    onUnauthorized(() => { throw new Error('handler exploded') })
    fetchMock.mockRejectedValue(httpError(401, { message: 'Unauthenticated.' }))

    await expect(service.request('/x')).rejects.toThrow('Unauthenticated.')
  })

  it('is a no-op when nothing is registered, as during SSR', () => {
    expect(() => reportUnauthorized(new Error('x'))).not.toThrow()
  })
})
