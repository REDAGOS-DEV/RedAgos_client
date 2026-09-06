import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import { PUBLIC_ROLES, FACILITY_ROLE_IDS, destinationFor } from '~/utils/publicRoles'
import { portalRoleFor, portalHomeFor, loginRouteFor } from '~/utils/authRoutes'

/**
 * Facility onboarding moved from the public to the Super Admin.
 *
 * Three things have to hold together for that to be true on the client, and
 * each has already been wrong once in this codebase:
 *
 *  - the public sign-up screen must not offer a facility role, because the
 *    endpoint behind that choice no longer exists;
 *  - Facility Management must be gated on the admin role, not merely on
 *    holding a token;
 *  - the create call must go to the admin endpoint with the payload the server
 *    validates, including the nested primary account.
 *
 * The rendering is out of scope, as everywhere else in this suite. What is
 * covered is the data and the routing behind it.
 */

const root = fileURLToPath(new URL('..', import.meta.url))

function source(relative: string): string {
  return readFileSync(path.join(root, relative), 'utf8')
}

// `portalHomeFor` calls `departmentHome`, a Nuxt auto-import from
// useBloodCenterNav. Stubbed rather than imported so these stay pure-function
// tests with no composable context.
vi.stubGlobal('departmentHome', () => '/blood-center/dashboard')

describe('public role selection', () => {
  it('offers only donor and administrator', () => {
    expect(PUBLIC_ROLES.map((role) => role.id)).toEqual(['donor', 'admin'])
  })

  it('offers no facility role, whatever it is called', () => {
    const offered = PUBLIC_ROLES.map((role) => role.id) as string[]

    for (const facilityRole of FACILITY_ROLE_IDS) {
      expect(offered, `${facilityRole} is a public sign-up choice again`)
        .not.toContain(facilityRole)
    }
  })

  it('sends donors to registration and administrators straight to sign-in', () => {
    expect(destinationFor('donor')).toBe('/register/donor')
    // Administrators have never self-registered; their accounts are created by
    // another administrator.
    expect(destinationFor('admin')).toBe('/auth/admin/login')
  })

  /**
   * The `/register/:role` aliases were what made the public forms reachable by
   * a typed URL as well as by the cards. Deleting the cards is not enough if
   * the pages are still there.
   */
  it.each([
    'app/pages/auth/blood-center/register.vue',
    'app/pages/auth/blood-center/registration-status.vue',
    'app/pages/auth/hospital/register.vue',
  ])('has removed the page at %s', (page) => {
    expect(existsSync(path.join(root, page)), `${page} still exists`).toBe(false)
  })

  it('leaves no link pointing at a removed registration page', () => {
    const pages = [
      'app/pages/auth/role-selection.vue',
      'app/pages/auth/blood-center/login.vue',
      'app/pages/auth/hospital/login.vue',
      'app/pages/index.vue',
    ]

    for (const page of pages) {
      const text = source(page)

      expect(text, `${page} links to blood center registration`)
        .not.toMatch(/auth\/blood-center\/register|register\/blood-center/)
      expect(text, `${page} links to hospital registration`)
        .not.toMatch(/auth\/hospital\/register|register\/hospital/)
    }
  })
})

describe('facility management access', () => {
  it('is inside the admin portal, so a non-admin is bounced by portal.global', () => {
    expect(portalRoleFor('/admin/facilities')).toBe('admin')
  })

  it('is where an administrator lands', () => {
    expect(portalHomeFor({ roles: ['admin'] } as any)).toBe('/admin/facilities')
  })

  it('sends a signed-out visitor to the admin login, not role selection', () => {
    expect(loginRouteFor('/admin/facilities')).toBe('/auth/admin/login')
  })

  it('is not where any facility or donor role lands', () => {
    expect(portalHomeFor({ roles: ['donor'] } as any)).not.toBe('/admin/facilities')
    expect(portalHomeFor({ roles: ['blood_center'] } as any)).not.toBe('/admin/facilities')
    expect(portalHomeFor({ roles: ['blood_bank'] } as any)).not.toBe('/admin/facilities')
  })

  it('carries the auth middleware on the page itself', () => {
    // Belt as well as braces: portal.global keys on the path prefix, and this
    // is what stops the page rendering at all without a token.
    expect(source('app/pages/admin/facilities.vue')).toMatch(/middleware:\s*'auth'/)
  })
})

// --- AdminService ------------------------------------------------------------

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

const { adminService } = await import('~/api/admin/AdminService')

function payloadFor(type: 'blood_center' | 'blood_bank') {
  return {
    facility_type: type,
    name: type === 'blood_bank' ? 'SPMC Hospital Blood Bank' : 'Davao Regional Blood Center',
    doh_license_number: type === 'blood_bank' ? 'DOH-BB-1' : 'DOH-BC-1',
    address: 'Davao City',
    email: 'facility@example.ph',
    phone: '09171234567',
    primary_account: {
      first_name: 'Maria',
      last_name: 'Santos',
      position: 'Supervisor',
      email: 'maria@example.ph',
      phone: '09181234567',
      password: 'SecurePass1',
      password_confirmation: 'SecurePass1',
    },
  }
}

describe('AdminService', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({ data: [] })
  })

  it.each(['blood_center', 'blood_bank'] as const)('creates a %s at the admin endpoint', async (type) => {
    const payload = payloadFor(type)

    await adminService.create(payload)

    const [url, config] = fetchMock.mock.calls[0]!

    expect(url).toBe('/admin/facilities')
    expect(config.method).toBe('POST')
    expect(config.body).toEqual(payload)
    expect(config.body.primary_account.password_confirmation).toBe('SecurePass1')
  })

  it('lists facilities with the type and status filters the server accepts', async () => {
    await adminService.list({ facility_type: 'blood_bank', status: 'approved', page: 2 })

    const [url, config] = fetchMock.mock.calls[0]!

    expect(url).toBe('/admin/facilities')
    expect(config.method).toBe('GET')
    expect(config.params).toEqual({ facility_type: 'blood_bank', status: 'approved', page: 2 })
  })

  /**
   * These two only apply to facilities left pending by the removed public
   * flow, but they still have to reach the renamed prefix.
   */
  it.each([
    ['approve', () => adminService.approve(7), '/admin/facilities/7/approve', undefined],
    ['reject', () => adminService.reject(7, 'No.'), '/admin/facilities/7/reject', { reason: 'No.' }],
  ])('posts %s to the facilities prefix', async (_name, call, expectedUrl, expectedBody) => {
    await (call as () => Promise<unknown>)()

    const [url, config] = fetchMock.mock.calls[0]!

    expect(url).toBe(expectedUrl)
    expect(config.method).toBe('POST')

    if (expectedBody) {
      expect(config.body).toEqual(expectedBody)
    }
  })

  /**
   * Suspension and reinstatement were removed from the API. A method that
   * survives the endpoint is worse than no method: the button renders, the
   * call 404s, and the page reports it as a server fault.
   */
  it.each(['suspend', 'reinstate'])('no longer exposes %s', (method) => {
    expect(
      (adminService as unknown as Record<string, unknown>)[method],
      `AdminService.${method} is back`
    ).toBeUndefined()
  })

  it('no longer exposes the removed blood-centre registration calls', async () => {
    const { bloodCenterService } = await import('~/api/bloodcenter/BloodCenterService')

    for (const method of ['register', 'registrationStatus', 'resubmitRegistration']) {
      expect(
        (bloodCenterService as Record<string, unknown>)[method],
        `BloodCenterService.${method} is back`
      ).toBeUndefined()
    }
  })
})
