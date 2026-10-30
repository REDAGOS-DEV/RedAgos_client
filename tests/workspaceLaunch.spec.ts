import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { trackRequest } from '~/api/activity'
import { useWorkspaceLaunch } from '~/composables/useWorkspaceLaunch'

/**
 * When the "Launching Workspace" screen after sign-in goes away.
 *
 * Too soon and the user lands on skeletons (or sees it flash); too late, or
 * never, and a portal that is ready sits behind a screen nobody can close.
 */

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((r) => { resolve = r })
  return { promise, resolve }
}

describe('Launching Workspace screen', () => {
  const workspace = useWorkspaceLaunch()

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    workspace.cancel()
    vi.useRealTimers()
  })

  it('stays up long enough to read when the portal has nothing to load', async () => {
    workspace.begin()
    workspace.settle()

    await vi.advanceTimersByTimeAsync(650)
    expect(workspace.launching.value).toBe(true)

    await vi.advanceTimersByTimeAsync(100)
    expect(workspace.launching.value).toBe(false)
  })

  it("waits for the portal's first requests to answer", async () => {
    workspace.begin()
    const dashboard = deferred()
    const request = trackRequest(dashboard.promise)
    workspace.settle()

    await vi.advanceTimersByTimeAsync(3000)
    expect(workspace.launching.value).toBe(true)

    dashboard.resolve()
    await request
    await vi.advanceTimersByTimeAsync(350)
    expect(workspace.launching.value).toBe(true)

    await vi.advanceTimersByTimeAsync(100)
    expect(workspace.launching.value).toBe(false)
  })

  it('counts a failed request as answered', async () => {
    workspace.begin()
    const request = trackRequest(Promise.reject(new Error('500')))
    workspace.settle()

    await expect(request).rejects.toThrow('500')
    await vi.advanceTimersByTimeAsync(800)
    expect(workspace.launching.value).toBe(false)
  })

  it('gives up on a request that never answers', async () => {
    workspace.begin()
    void trackRequest(new Promise(() => {}))
    workspace.settle()

    await vi.advanceTimersByTimeAsync(11_900)
    expect(workspace.launching.value).toBe(true)

    await vi.advanceTimersByTimeAsync(200)
    expect(workspace.launching.value).toBe(false)
  })

  it('goes at once when sign-in fails after all', () => {
    workspace.begin()
    workspace.cancel()

    expect(workspace.launching.value).toBe(false)
  })
})
