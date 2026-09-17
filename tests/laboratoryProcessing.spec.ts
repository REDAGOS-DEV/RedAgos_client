import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * The laboratory's side of a donation.
 *
 * What is worth locking in here is the route each action takes. `completed` on
 * a donation means *cleared for issue to a patient*, and it is only ever set
 * through the laboratory status route — if one of these URLs drifted onto a
 * collection endpoint, the counter would gain the ability to put untested
 * blood into issuable stock.
 */

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

const { bloodCenterService } = await import('~/api/bloodcenter/BloodCenterService')

beforeEach(() => {
  fetchMock.mockReset()
})

describe('BloodCenterService laboratory endpoints', () => {
  const service = bloodCenterService

  it('reads the laboratory queue, not the collection one', async () => {
    fetchMock.mockResolvedValueOnce({ data: [] })
    await service.laboratoryQueue()

    const [url, config] = fetchMock.mock.calls[0]!

    expect(url).toBe('/blood-center/laboratory/queue')
    expect(config.method).toBe('GET')
  })

  it('records a test result against the donation it belongs to', async () => {
    fetchMock.mockResolvedValueOnce({})
    await service.recordTestResult(42, { result: 'passed', blood_type_id: 3 })

    const [url, config] = fetchMock.mock.calls[0]!

    expect(url).toBe('/blood-center/laboratory/donations/42/results')
    expect(config.method).toBe('POST')
    // `recorded_by` is never sent: the server takes it from the bearer token,
    // so a result cannot be attributed to someone who did not record it.
    expect(config.body).toEqual({ result: 'passed', blood_type_id: 3 })
  })

  it('declares components on their own endpoint', async () => {
    fetchMock.mockResolvedValueOnce({})
    await service.declareComponents(42, { components: [{ component_id: 1, quantity: 2 }] })

    const [url, config] = fetchMock.mock.calls[0]!

    expect(url).toBe('/blood-center/laboratory/donations/42/components')
    expect(config.method).toBe('POST')
    expect(config.body).toEqual({ components: [{ component_id: 1, quantity: 2 }] })
  })

  it('clears for issue through the laboratory status route', async () => {
    fetchMock.mockResolvedValueOnce({})
    await service.updateLaboratoryStatus(42, { status: 'completed' })

    const [url, config] = fetchMock.mock.calls[0]!

    expect(url).toBe('/blood-center/laboratory/donations/42/status')
    expect(config.method).toBe('PATCH')
    expect(config.body).toEqual({ status: 'completed' })
  })

  it('carries the reason when a unit is rejected', async () => {
    fetchMock.mockResolvedValueOnce({})
    await service.updateLaboratoryStatus(42, { status: 'rejected', rejection_reason: 'Reactive for HBsAg' })

    const [, config] = fetchMock.mock.calls[0]!

    expect(config.body).toEqual({ status: 'rejected', rejection_reason: 'Reactive for HBsAg' })
  })

  it('reads one donation from the laboratory namespace', async () => {
    fetchMock.mockResolvedValueOnce({})
    await service.laboratoryDonation(42)

    expect(fetchMock.mock.calls[0]![0]).toBe('/blood-center/laboratory/donations/42')
  })
})
