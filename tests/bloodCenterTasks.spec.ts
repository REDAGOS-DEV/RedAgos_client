import { computed, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * useBloodCenterTasks: the sidebar's and the dashboards' counts.
 *
 * One load at a time, shared by callers that arrive together; a caller that
 * has just changed something gets a fresh load after the running one; the
 * sidebar's background refresh never reads a throttled list; and the
 * near-expiry count comes from its own small read, not the inventory summary.
 */

const states = new Map<string, { value: unknown }>()
vi.stubGlobal('useState', (key: string, init: () => unknown) => {
  if (!states.has(key)) states.set(key, ref(init()))
  return states.get(key)!
})
vi.stubGlobal('computed', computed)

const service = {
  incomingRequestsSummary: vi.fn(),
  billingSummary: vi.fn(),
  corrections: vi.fn(),
  serologyResults: vi.fn(),
  counsellingReferralsSummary: vi.fn(),
  processedDonations: vi.fn(),
  stockThresholds: vi.fn(),
  inventoryNearExpiry: vi.fn(),
  inventorySummary: vi.fn(),
  adminOverview: vi.fn(),
  drives: vi.fn(),
}

vi.mock('~/api/bloodcenter/BloodCenterService', () => ({ bloodCenterService: service }))
vi.mock('~/composables/useUser', () => ({ useUser: () => ({ can: () => true }) }))

const { useBloodCenterTasks } = await import('~/composables/useBloodCenterTasks')

/** A reply the test settles when it chooses. */
function held<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => { resolve = r })
  return { promise, resolve }
}

beforeEach(() => {
  states.clear()
  for (const fn of Object.values(service)) fn.mockReset()
  service.incomingRequestsSummary.mockResolvedValue({ totals: { pending: 3 }, open_emergencies: 1 })
  service.billingSummary.mockResolvedValue({ outstanding: { count: 2 } })
  service.corrections.mockResolvedValue({ total: 0 })
  service.serologyResults.mockResolvedValue({ total: 4 })
  service.counsellingReferralsSummary.mockResolvedValue({ pending_count: 0 })
  service.processedDonations.mockResolvedValue({ total: 5 })
  service.stockThresholds.mockResolvedValue({ totals: { low: 1 } })
  service.inventoryNearExpiry.mockResolvedValue({ near_expiry: { within_3_days: 6 } })
  service.adminOverview.mockResolvedValue({ needs: {} })
  service.drives.mockResolvedValue([])
})

describe('useBloodCenterTasks', () => {
  it('reads near-expiry from its own small read, never the whole inventory summary', async () => {
    const { counts, load } = useBloodCenterTasks()

    await load()

    expect(counts.value.expiring).toBe(6)
    expect(service.inventoryNearExpiry).toHaveBeenCalledTimes(1)
    expect(service.inventorySummary).not.toHaveBeenCalled()
  })

  it('sends each request once when the sidebar and a dashboard load together', async () => {
    const sidebar = useBloodCenterTasks()
    const strip = useBloodCenterTasks()

    await Promise.all([sidebar.load(), strip.load()])

    expect(service.incomingRequestsSummary).toHaveBeenCalledTimes(1)
    expect(service.inventoryNearExpiry).toHaveBeenCalledTimes(1)
  })

  it('queues one fresh load for a caller that has just changed something', async () => {
    const reply = held<any>()
    service.serologyResults.mockReturnValueOnce(reply.promise).mockResolvedValue({ total: 0 })
    const { counts, load } = useBloodCenterTasks()

    const first = load()
    // A result was verified while the first count was out: it may have counted it.
    const afterChange = load({ afterChange: true })

    reply.resolve({ total: 4 })
    await Promise.all([first, afterChange])

    // Two results lists per load (awaiting and correction pending), two loads.
    expect(service.serologyResults).toHaveBeenCalledTimes(4)
    expect(counts.value.verification).toBe(0)
  })

  it('never reads a throttled list in the background, and keeps those counts as they were', async () => {
    const { counts, load } = useBloodCenterTasks()
    await load()
    expect(counts.value.verification).toBe(8)
    expect(counts.value.handover).toBe(5)

    service.serologyResults.mockClear()
    service.processedDonations.mockClear()
    service.incomingRequestsSummary.mockResolvedValue({ totals: { pending: 9 }, open_emergencies: 2 })

    await load({ background: true })

    expect(service.serologyResults).not.toHaveBeenCalled()
    expect(service.processedDonations).not.toHaveBeenCalled()
    expect(counts.value.pending).toBe(9)
    expect(counts.value.verification).toBe(8)
    expect(counts.value.handover).toBe(5)
  })

  it('gives a full load asked for during a background one the throttled counts too', async () => {
    const reply = held<any>()
    service.incomingRequestsSummary.mockReturnValueOnce(reply.promise)
    const { load } = useBloodCenterTasks()

    const background = load({ background: true })
    const full = load()

    reply.resolve({ totals: { pending: 1 } })
    await Promise.all([background, full])

    expect(service.serologyResults).toHaveBeenCalledTimes(2)
    expect(service.processedDonations).toHaveBeenCalledTimes(1)
  })
})

describe('what a session leaves behind', () => {
  it('names, for clearSession() to reset, keys their owners actually use', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ public: { apiBaseURL: '/api' } }))
    const { PER_USER_STATE } = await vi.importActual<typeof import('~/composables/useUser')>('~/composables/useUser')
    const root = path.resolve(__dirname, '..')
    const owners = [
      'app/composables/useBloodCenterTasks.ts',
      'app/composables/useHospitalUnreadCount.ts',
      'app/layouts/donordashboard.vue',
    ].map((file) => readFileSync(path.join(root, file), 'utf8')).join('\n')

    for (const key of Object.keys(PER_USER_STATE)) {
      expect(owners, key).toMatch(new RegExp(`useState(<[^>]+>)?\\('${key}'`))
    }
  })
})
