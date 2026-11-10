// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, KeepAlive, nextTick, ref } from 'vue'
import { createLatest, useLiveRefresh, type LiveRefresh } from '~/composables/useLiveRefresh'

/**
 * useLiveRefresh and createLatest: a page's queue kept current while it is
 * open, without ever letting an older reply overwrite a newer one.
 */

let visibility: 'visible' | 'hidden' = 'visible'

function setTabVisible(visible: boolean) {
  visibility = visible ? 'visible' : 'hidden'
  document.dispatchEvent(new Event('visibilitychange'))
}

/** A kept-alive page using useLiveRefresh, beside another page to switch to. */
function mountPage(refresh: () => unknown, options: Parameters<typeof useLiveRefresh>[1]) {
  let live!: LiveRefresh
  const PageA = defineComponent({
    name: 'PageA',
    setup() {
      live = useLiveRefresh(refresh, options)
      return () => h('p', 'A')
    },
  })
  const PageB = defineComponent({ name: 'PageB', setup: () => () => h('p', 'B') })
  const current = ref<'a' | 'b'>('a')
  const root = document.createElement('div')
  document.body.appendChild(root)
  const app = createApp({ setup: () => () => h(KeepAlive, null, [current.value === 'a' ? h(PageA) : h(PageB)]) })
  app.mount(root)

  return {
    live: () => live,
    async show(page: 'a' | 'b') {
      current.value = page
      await nextTick()
      await nextTick()
    },
    unmount() {
      app.unmount()
      root.remove()
    },
  }
}

/** A promise settled from outside, for a request that is still out. */
function deferred<T = void>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => { resolve = r })
  return { promise, resolve }
}

beforeEach(() => {
  vi.useFakeTimers()
  visibility = 'visible'
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useLiveRefresh: when it refreshes', () => {
  it('refreshes on its interval while the page and the tab are in view', async () => {
    const refresh = vi.fn()
    const page = mountPage(refresh, { intervalMs: 15_000 })
    await nextTick()

    await vi.advanceTimersByTimeAsync(14_999)
    expect(refresh).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(refresh).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(15_000)
    expect(refresh).toHaveBeenCalledTimes(2)
    page.unmount()
  })

  it('stops entirely while the page is kept but hidden, and starts again when it is shown', async () => {
    const refresh = vi.fn()
    const page = mountPage(refresh, { intervalMs: 15_000 })
    await nextTick()

    await page.show('b')
    await vi.advanceTimersByTimeAsync(60_000)
    expect(refresh).not.toHaveBeenCalled()

    await page.show('a')
    await vi.advanceTimersByTimeAsync(15_000)
    expect(refresh).toHaveBeenCalledTimes(1)
    page.unmount()
  })

  it('skips its turn while the browser tab is hidden, and refreshes when the tab comes back', async () => {
    const refresh = vi.fn()
    const page = mountPage(refresh, { intervalMs: 15_000, focusGapMs: 30_000 })
    await nextTick()

    setTabVisible(false)
    await vi.advanceTimersByTimeAsync(45_000)
    expect(refresh).not.toHaveBeenCalled()

    setTabVisible(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(refresh).toHaveBeenCalledTimes(1)

    // Back again within the gap: no second refresh from the tab alone.
    setTabVisible(false)
    setTabVisible(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(refresh).toHaveBeenCalledTimes(1)
    page.unmount()
  })

  it('does nothing when the tab comes back while the page itself is hidden', async () => {
    const refresh = vi.fn()
    const page = mountPage(refresh, { intervalMs: 15_000 })
    await nextTick()
    await page.show('b')

    setTabVisible(false)
    setTabVisible(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(refresh).not.toHaveBeenCalled()
    page.unmount()
  })

  it('skips its turn while paused, as during an action or an open payment', async () => {
    const refresh = vi.fn()
    const busy = ref(true)
    const page = mountPage(refresh, { intervalMs: 15_000, pauseWhen: () => busy.value })
    await nextTick()

    await vi.advanceTimersByTimeAsync(30_000)
    expect(refresh).not.toHaveBeenCalled()

    busy.value = false
    await vi.advanceTimersByTimeAsync(15_000)
    expect(refresh).toHaveBeenCalledTimes(1)
    page.unmount()
  })

  it('stops for good when the page is unmounted', async () => {
    const refresh = vi.fn()
    const page = mountPage(refresh, { intervalMs: 15_000 })
    await nextTick()
    page.unmount()

    setTabVisible(false)
    setTabVisible(true)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(refresh).not.toHaveBeenCalled()
  })
})

describe('useLiveRefresh: overlapping refreshes', () => {
  it('lets a timer turn pass while a refresh is still running', async () => {
    const slow = deferred()
    const refresh = vi.fn(() => slow.promise)
    const page = mountPage(refresh, { intervalMs: 15_000 })
    await nextTick()

    await vi.advanceTimersByTimeAsync(15_000)
    await vi.advanceTimersByTimeAsync(15_000)
    expect(refresh).toHaveBeenCalledTimes(1)

    slow.resolve()
    await vi.advanceTimersByTimeAsync(0)
    page.unmount()
  })

  it('never drops a run asked for while one is running: exactly one more follows, and it reads the latest state', async () => {
    const first = deferred()
    const filter = ref('all')
    const seen: string[] = []
    const refresh = vi.fn(async () => {
      seen.push(filter.value)
      if (seen.length === 1) await first.promise
    })
    const page = mountPage(refresh, { intervalMs: 15_000 })
    await nextTick()

    const running = page.live().run()

    // The filter changes and two more runs are asked for while the first is out.
    filter.value = 'emergency'
    const second = page.live().run()
    const third = page.live().run()
    expect(second).toBe(running)
    expect(third).toBe(running)

    first.resolve()
    await running

    expect(seen).toEqual(['all', 'emergency'])
    page.unmount()
  })

  it('keeps going after a refresh fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const refresh = vi.fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValue(undefined)
    const page = mountPage(refresh, { intervalMs: 15_000 })
    await nextTick()

    await vi.advanceTimersByTimeAsync(15_000)
    await vi.advanceTimersByTimeAsync(15_000)
    expect(refresh).toHaveBeenCalledTimes(2)
    page.unmount()
  })
})

describe('createLatest: newest reply wins', () => {
  /** A list loaded the way the pages load it: ticket first, applied only if still current. */
  function list() {
    const latest = createLatest()
    const rows = ref<string[]>([])

    async function load(reply: Promise<string[]>) {
      const ticket = latest.begin()
      const data = await reply
      if (latest.isCurrent(ticket)) rows.value = data
    }

    return { latest, rows, load }
  }

  it('drops a background refresh that answers after a filter change was loaded', async () => {
    const { rows, load } = list()
    const poll = deferred<string[]>()
    const filtered = deferred<string[]>()

    const polling = load(poll.promise)
    const filtering = load(filtered.promise)

    filtered.resolve(['emergency only'])
    await filtering
    poll.resolve(['everything, as it was'])
    await polling

    expect(rows.value).toEqual(['emergency only'])
  })

  it('drops a refresh that answers after an action has landed', async () => {
    const { latest, rows, load } = list()
    const poll = deferred<string[]>()

    const polling = load(poll.promise)

    // The action's own reply is applied, and everything asked before it is now stale.
    latest.invalidate()
    rows.value = ['request released']

    poll.resolve(['request still waiting'])
    await polling

    expect(rows.value).toEqual(['request released'])
  })

  it('applies a reply when nothing newer was asked for', async () => {
    const { rows, load } = list()

    await load(Promise.resolve(['one']))

    expect(rows.value).toEqual(['one'])
  })
})
