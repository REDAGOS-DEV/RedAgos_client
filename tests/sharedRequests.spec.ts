import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * BaseService.requestShared: identical GETs in flight are sent once.
 *
 * Shared only when path, query and session all match; each caller gets its
 * own copy; nothing is kept once the request settles; and a write cuts off
 * every read sent before it.
 */

vi.stubGlobal('useRuntimeConfig', () => ({ public: { apiBaseURL: 'http://api.test/api' } }))

const fetchMock = vi.fn()
vi.stubGlobal('$fetch', fetchMock)

const { BaseService, sharedRequestKey, sharedRequestsInFlight, forgetSharedRequests } = await import('~/api/BaseService')

/** A request that stays out until the test answers it. */
function pendingReply<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

describe('requestShared', () => {
  let service: InstanceType<typeof BaseService>

  beforeEach(() => {
    fetchMock.mockReset()
    forgetSharedRequests()
    service = new BaseService()
  })

  it('sends one request for callers asking the same thing at the same time', async () => {
    const reply = pendingReply<any>()
    fetchMock.mockReturnValue(reply.promise)

    const a = service.requestShared('/summary')
    const b = service.requestShared('/summary')

    reply.resolve({ totals: { pending: 2 } })

    expect(await a).toEqual({ totals: { pending: 2 } })
    expect(await b).toEqual({ totals: { pending: 2 } })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('gives each caller its own copy', async () => {
    fetchMock.mockResolvedValue({ totals: { pending: 2 } })

    const [a, b] = await Promise.all([service.requestShared<any>('/summary'), service.requestShared<any>('/summary')])
    a.totals.pending = 99

    expect(b.totals.pending).toBe(2)
    expect(a).not.toBe(b)
  })

  it('keeps nothing once the request settles: the next call reaches the server', async () => {
    fetchMock.mockResolvedValueOnce({ n: 1 }).mockResolvedValueOnce({ n: 2 })

    expect(await service.requestShared('/summary')).toEqual({ n: 1 })
    expect(sharedRequestsInFlight()).toBe(0)
    expect(await service.requestShared('/summary')).toEqual({ n: 2 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not share between different queries', async () => {
    fetchMock.mockResolvedValue({})

    await Promise.all([
      service.requestShared('/summary', { trend: 0 }),
      service.requestShared('/summary'),
    ])

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('shares when only the order of the query keys differs', async () => {
    fetchMock.mockResolvedValue({})

    await Promise.all([
      service.requestShared('/list', { a: 1, b: 2 }),
      service.requestShared('/list', { b: 2, a: 1 }),
    ])

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('never shares between two sessions', () => {
    expect(sharedRequestKey('/summary', {}, 'token-a')).not.toBe(sharedRequestKey('/summary', {}, 'token-b'))
    expect(sharedRequestKey('/summary', {}, 'token-a')).toBe(sharedRequestKey('/summary', {}, 'token-a'))
    expect(sharedRequestKey('/summary', {}, null)).not.toBe(sharedRequestKey('/summary', {}, 'token-a'))
  })

  it('lets no read sent after a write join one sent before it', async () => {
    const before = pendingReply<any>()
    fetchMock
      .mockReturnValueOnce(before.promise) // the read sent before the write
      .mockResolvedValueOnce({ saved: true }) // the write
      .mockResolvedValueOnce({ state: 'after' }) // the read sent after

    const early = service.requestShared('/summary')
    await service.request('/thing', 'POST', {})
    const late = service.requestShared('/summary')

    before.resolve({ state: 'before' })

    expect(await early).toEqual({ state: 'before' })
    expect(await late).toEqual({ state: 'after' })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('passes a failure to every caller and forgets the request', async () => {
    const reply = pendingReply<any>()
    fetchMock.mockReturnValueOnce(reply.promise).mockResolvedValueOnce({ ok: true })

    const a = service.requestShared('/summary')
    const b = service.requestShared('/summary')
    reply.reject(Object.assign(new Error('down'), { response: { status: 503, _data: { message: 'Down.' } } }))

    await expect(a).rejects.toThrow('Down.')
    await expect(b).rejects.toThrow('Down.')
    expect(sharedRequestsInFlight()).toBe(0)
    expect(await service.requestShared('/summary')).toEqual({ ok: true })
  })
})
