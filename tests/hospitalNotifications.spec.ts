import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import type { HospitalNotification } from '~/types/hospitalNotification'
import { hasMorePages, normalizeHospitalNotification } from '~/utils/hospitalNotifications'

/**
 * The hospital inbox, read the way the server actually sends it.
 *
 * The page was written against an imagined payload (`data`, `has_more`,
 * `description`, `action_path`) and so could not show a single real
 * notification. What is locked in: the server's names are mapped to the page's
 * in one place, pagination follows `meta`, `page` is sendable, and the bell's
 * count is fetched at once, every minute, and stopped when the layout goes.
 */

const root = fileURLToPath(new URL('..', import.meta.url))

function source(relative: string): string {
  return readFileSync(path.join(root, relative), 'utf8')
}

const runtimeConfig = { public: { apiBaseURL: 'http://api.test/api' } }
vi.stubGlobal('useRuntimeConfig', () => runtimeConfig)

const states = new Map<string, { value: unknown }>()
vi.stubGlobal('useState', (key: string, init: () => unknown) => {
  if (!states.has(key)) states.set(key, { value: init() })
  return states.get(key)!
})

const fetchMock = vi.fn()
vi.stubGlobal('$fetch', fetchMock)

vi.stubGlobal('localStorage', {
  store: new Map<string, string>(),
  getItem(k: string) { return this.store.get(k) ?? null },
  setItem(k: string, v: string) { this.store.set(k, v) },
  removeItem(k: string) { this.store.delete(k) },
})

const { hospitalService } = await import('~/api/hospital/HospitalService')
const { useHospitalUnreadCount } = await import('~/composables/useHospitalUnreadCount')

/** What LowStockAlert stores and DonorNotificationService::format() returns. */
const lowStock: HospitalNotification = {
  id: '5b1c0f64-7f69-4d3f-a1b8-0d3d2c7d9a10',
  category: 'inventory',
  title: 'Low stock: O+ Packed RBC',
  desc: 'O+ Packed RBC 0 of 5',
  meta: null,
  icon: 'triangle-alert',
  tone: 'danger',
  action_label: 'View thresholds',
  action_route: '/hospital/stock-thresholds',
  read: false,
  created_at: '2026-10-10T02:30:00+00:00',
}

describe('reading a notification', () => {
  it('maps the server\'s desc to description and action_route to action_path', () => {
    const view = normalizeHospitalNotification(lowStock)

    expect(view.description).toBe('O+ Packed RBC 0 of 5')
    expect(view.action_path).toBe('/hospital/stock-thresholds')
    expect(view.action_label).toBe('View thresholds')
    expect(view.category).toBe('inventory')
    expect(view.title).toBe('Low stock: O+ Packed RBC')
    expect(view.tone).toBe('danger')
    expect(view.read).toBe(false)
    expect(view.created_at).toBe('2026-10-10T02:30:00+00:00')
  })

  it('survives a notification with no body, link or category', () => {
    const view = normalizeHospitalNotification({
      ...lowStock,
      desc: null,
      action_route: null,
      action_label: null,
      category: '',
      title: null,
    })

    expect(view.description).toBe('')
    expect(view.action_path).toBeNull()
    expect(view.category).toBe('system')
    expect(view.title).toBe('')
  })

  it('carries the read flag through as a boolean', () => {
    expect(normalizeHospitalNotification({ ...lowStock, read: true }).read).toBe(true)
  })
})

describe('paging the inbox', () => {
  it('has more only while the current page is before the last', () => {
    expect(hasMorePages({ page: 1, per_page: 20, total: 40, last_page: 2 })).toBe(true)
    expect(hasMorePages({ page: 2, per_page: 20, total: 40, last_page: 2 })).toBe(false)
    expect(hasMorePages({ page: 1, per_page: 20, total: 3, last_page: 1 })).toBe(false)
  })

  it('has no more when the server sent no meta', () => {
    expect(hasMorePages(undefined)).toBe(false)
    expect(hasMorePages(null)).toBe(false)
  })

  it('sends the page it is asked for, to the hospital inbox', async () => {
    fetchMock.mockResolvedValueOnce({ notifications: [], unread_count: 0, meta: { page: 2, per_page: 20, total: 0, last_page: 2 } })

    await hospitalService.listNotifications({ page: 2, per_page: 20 })

    const [url, config] = fetchMock.mock.calls[0]!

    expect(url).toBe('/hospital/notifications')
    expect(config.method).toBe('GET')
    expect(config.query ?? config.params).toMatchObject({ page: 2, per_page: 20 })
  })
})

describe('the bell\'s unread count', () => {
  beforeEach(() => {
    states.clear()
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({ unread_count: 3 })
    vi.useFakeTimers()
  })

  afterEach(() => {
    useHospitalUnreadCount().stop()
    vi.useRealTimers()
  })

  const unreadCalls = () => fetchMock.mock.calls.filter(([url]) => url === '/hospital/notifications/unread-count')

  it('fetches at once, not after the first minute', async () => {
    const { start, count } = useHospitalUnreadCount()

    start()
    await vi.advanceTimersByTimeAsync(0)

    expect(unreadCalls()).toHaveLength(1)
    expect(count.value).toBe(3)
  })

  it('then polls every minute', async () => {
    const { start } = useHospitalUnreadCount()

    start()
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(59_000)
    expect(unreadCalls()).toHaveLength(1)

    await vi.advanceTimersByTimeAsync(1_000)
    expect(unreadCalls()).toHaveLength(2)

    await vi.advanceTimersByTimeAsync(60_000)
    expect(unreadCalls()).toHaveLength(3)
  })

  it('stops polling, and the interval is cleared rather than left running', async () => {
    const { start, stop } = useHospitalUnreadCount()

    start()
    await vi.advanceTimersByTimeAsync(0)
    stop()

    expect(vi.getTimerCount()).toBe(0)

    await vi.advanceTimersByTimeAsync(300_000)
    expect(unreadCalls()).toHaveLength(1)
  })

  it('never runs two intervals, however many times it is started', async () => {
    const first = useHospitalUnreadCount()
    const second = useHospitalUnreadCount()

    first.start()
    second.start()
    first.start()
    await vi.advanceTimersByTimeAsync(0)

    expect(unreadCalls()).toHaveLength(1)
    expect(vi.getTimerCount()).toBe(1)

    await vi.advanceTimersByTimeAsync(60_000)
    expect(unreadCalls()).toHaveLength(2)
  })

  it('can be stopped by a different caller than the one that started it', async () => {
    useHospitalUnreadCount().start()
    await vi.advanceTimersByTimeAsync(0)

    useHospitalUnreadCount().stop()

    expect(vi.getTimerCount()).toBe(0)
  })

  it('can be restarted after it was stopped', async () => {
    const { start, stop } = useHospitalUnreadCount()

    start()
    await vi.advanceTimersByTimeAsync(0)
    stop()
    start()
    await vi.advanceTimersByTimeAsync(0)

    expect(unreadCalls()).toHaveLength(2)
    expect(vi.getTimerCount()).toBe(1)
  })

  it('keeps the last count when a poll fails', async () => {
    const { refresh, count } = useHospitalUnreadCount()

    await refresh()
    expect(count.value).toBe(3)

    fetchMock.mockRejectedValueOnce(new Error('offline'))
    await refresh()

    expect(count.value).toBe(3)
  })

  it('lets the inbox set the count it already knows, never below zero', () => {
    const { set, count } = useHospitalUnreadCount()

    set(7)
    expect(count.value).toBe(7)

    set(-2)
    expect(count.value).toBe(0)
  })
})

describe('the inbox page and its layout', () => {
  const page = source('app/pages/hospital/notifications.vue')
  const layout = source('app/layouts/hospitaldashboard.vue')

  it('reads the server\'s payload and no longer the imagined one', () => {
    expect(page).toContain('res?.notifications')
    expect(page).toContain('normalizeHospitalNotification')
    expect(page).toContain('hasMorePages(res?.meta)')

    expect(page).not.toContain('res?.data')
    expect(page).not.toContain('has_more')
    expect(page).not.toContain('Array.isArray(res)')
  })

  it('no longer calls a method the service does not have', () => {
    expect(page).not.toContain('markNotificationUnread')
    expect(page).not.toContain('toggleRead')
  })

  it('uses the server\'s category names, and has a chip for stock alerts', () => {
    expect(page).toContain("{ key: 'request', label: 'Blood Requests' }")
    expect(page).toContain("{ key: 'inventory', label: 'Stock Alerts' }")
    expect(page).not.toContain("key: 'blood_request'")
  })

  it('tells the bell what it changed', () => {
    expect(page).toContain('useHospitalUnreadCount()')
    expect(page).toContain('sharedUnread.set(0)')
    expect(page).toContain('sharedUnread.refresh()')
  })

  it('starts the bell\'s poll once the user is known, and stops it with the layout', () => {
    expect(layout).toContain('useHospitalUnreadCount()')
    expect(layout).toContain('const signedIn = user.value ?? await ensureUser()')
    expect(layout).toContain('if (signedIn) startUnreadPolling()')
    expect(layout).toContain('onUnmounted(stopUnreadPolling)')
    // The count used to be a ref nothing ever filled.
    expect(layout).not.toContain('const unreadCount = ref(0)')
  })
})
