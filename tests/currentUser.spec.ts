import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * The donor's profile photo on the current user.
 *
 * `fetchUser()` rebuilds the user from `/user` on login, on refresh and on the
 * sidebar's reload, and it used to rebuild it without the photo: only the
 * upload handler ever set `avatar`, so the header fell back to initials the
 * next time anything re-read the user.
 *
 * The server signs the link as a path, not a full URL. A full one carried the
 * host Laravel saw behind the dev proxy (127.0.0.1:8000), which a phone on the
 * LAN cannot reach, so the photo turned into an empty blue circle there.
 */

// --- Nuxt auto-imports the file expects ------------------------------------
const runtimeConfig = { public: { apiBaseURL: '/api' } }
vi.stubGlobal('useRuntimeConfig', () => runtimeConfig)

const states = new Map<string, { value: unknown }>()
vi.stubGlobal('useState', (key: string, init: () => unknown) => {
  if (!states.has(key)) states.set(key, { value: init() })
  return states.get(key)!
})

const fetchMock = vi.fn()
vi.stubGlobal('$fetch', fetchMock)

const { useUser } = await import('~/composables/useUser')
const { resolveApiAssetURL } = await import('~/api/BaseService')

const UUID = '9d3c1a6e-4b7f-4c2a-8e1d-2f5a6b7c8d9e'

/** The shape `DonorAvatar::urlFor()` returns: relative, signed. */
function signedAvatar(expires: number): string {
  return `/api/donors/${UUID}/avatar?expires=${expires}&signature=abc123`
}

/** `/user` returns a JsonResource, so Laravel wraps it in `data`. */
function donorPayload(extra: Record<string, unknown> = {}) {
  return { data: { uuid: UUID, email: 'donor@example.com', roles: ['donor'], ...extra } }
}

describe('useUser profile photo', () => {
  beforeEach(() => {
    states.clear()
    fetchMock.mockReset()
    runtimeConfig.public.apiBaseURL = '/api'
  })

  it('maps avatar_url from /user onto user.avatar', async () => {
    fetchMock.mockResolvedValue(donorPayload({ avatar_url: signedAvatar(1760000000) }))
    const { user, fetchUser } = useUser()

    await fetchUser()

    expect(user.value?.avatar).toBe(signedAvatar(1760000000))
  })

  it('is null when the donor has no photo', async () => {
    fetchMock.mockResolvedValue(donorPayload({ avatar_url: null }))
    const { user, fetchUser } = useUser()

    await fetchUser()

    expect(user.value?.avatar).toBeNull()
  })

  it('is null rather than undefined when the resource leaves the field out', async () => {
    // Staff accounts, and any caller that did not eager-load the donor profile.
    fetchMock.mockResolvedValue(donorPayload())
    const { user, fetchUser } = useUser()

    await fetchUser()

    expect(user.value?.avatar).toBeNull()
  })

  it('keeps the photo across a reload after an upload, with the fresh link', async () => {
    fetchMock.mockResolvedValueOnce(donorPayload({ avatar_url: null }))
    const { user, fetchUser, updateAvatar } = useUser()
    await fetchUser()

    updateAvatar(signedAvatar(1760000000))
    fetchMock.mockResolvedValueOnce(donorPayload({ avatar_url: signedAvatar(1760001800) }))
    await fetchUser()

    expect(user.value?.avatar).toBe(signedAvatar(1760001800))
  })

  it('points the photo at an API on another host when the base is absolute', async () => {
    runtimeConfig.public.apiBaseURL = 'https://api.example.com/api'
    fetchMock.mockResolvedValue(donorPayload({ avatar_url: signedAvatar(1760000000) }))
    const { user, fetchUser } = useUser()

    await fetchUser()

    expect(user.value?.avatar).toBe(`https://api.example.com${signedAvatar(1760000000)}`)
  })
})

describe('resolveApiAssetURL', () => {
  beforeEach(() => {
    runtimeConfig.public.apiBaseURL = '/api'
  })

  it('leaves the path alone behind a relative base, so it rides the same proxy as the API', () => {
    expect(resolveApiAssetURL(signedAvatar(1))).toBe(signedAvatar(1))
  })

  it('keeps the signature intact when resolving against an absolute base', () => {
    runtimeConfig.public.apiBaseURL = 'http://192.168.1.21:8000/api'

    expect(resolveApiAssetURL(signedAvatar(1)))
      .toBe(`http://192.168.1.21:8000/api/donors/${UUID}/avatar?expires=1&signature=abc123`)
  })

  it('is null for a missing path', () => {
    expect(resolveApiAssetURL(null)).toBeNull()
    expect(resolveApiAssetURL(undefined)).toBeNull()
    expect(resolveApiAssetURL('')).toBeNull()
  })
})
