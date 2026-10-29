import { describe, it, expect, vi } from 'vitest'
import { withBase, withQuery } from 'ufo'

/**
 * The API base address as configured on a host (2026-10-29).
 *
 * The value was pasted into Cloudflare Pages with a trailing newline. Sign-in
 * worked, but every request with a query lost its path, because $fetch builds
 * the URL with ufo's withBase then withQuery: `…/api\n/blood-center/donations`
 * plus `?page=1` came out as `…/api?page=1`, and every list page failed.
 */

// --- Nuxt auto-imports the file expects ------------------------------------
const runtimeConfig = { public: { apiBaseURL: '' } }
vi.stubGlobal('useRuntimeConfig', () => runtimeConfig)

const { resolveApiBaseURL } = await import('~/api/BaseService')

describe('resolveApiBaseURL', () => {
  it('drops whitespace pasted around the configured address', () => {
    runtimeConfig.public.apiBaseURL = '  https://api.example.com/api\n'

    expect(resolveApiBaseURL()).toBe('https://api.example.com/api')
  })

  it('keeps the path of a request that carries a query', () => {
    runtimeConfig.public.apiBaseURL = 'https://api.example.com/api\n'

    const url = withQuery(withBase('/blood-center/donations', resolveApiBaseURL()), { page: 1 })

    expect(url).toBe('https://api.example.com/api/blood-center/donations?page=1')
  })
})
