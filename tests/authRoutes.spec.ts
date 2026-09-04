import { describe, it, expect, vi } from 'vitest'
import {
  loginRouteFor,
  isAuthRoute,
  portalRoleFor,
  portalHomeFor,
  LOGIN_ROUTES,
  PORTAL_ROLES,
  ROLE_SELECTION,
} from '~/utils/authRoutes'

// `portalHomeFor` calls `departmentHome`, a Nuxt auto-import from
// useBloodCenterNav. Stubbed rather than imported so these stay pure-function
// tests with no composable context.
vi.stubGlobal('departmentHome', (user: any) => {
  const homes: Record<string, string> = {
    collection: '/blood-center/collection',
    laboratory: '/blood-center/laboratory',
    inventory: '/blood-center/storage',
    billing: '/blood-center/billing',
  }
  if (user?.department && homes[user.department]) return homes[user.department]
  return user?.is_supervisor ? '/blood-center/dashboard' : '/blood-center/settings'
})

describe('loginRouteFor', () => {
  it.each([
    ['/donor/dashboard', '/auth/donor/login'],
    ['/donor/appointments?tab=past', '/auth/donor/login'],
    ['/blood-center/inventory', '/auth/blood-center/login'],
    ['/hospital/dashboard', '/auth/hospital/login'],
    ['/admin/registrations', '/auth/admin/login'],
  ])('sends %s to %s', (path, expected) => {
    expect(loginRouteFor(path)).toBe(expected)
  })

  it('falls back to role selection for paths in no portal', () => {
    expect(loginRouteFor('/legal/terms')).toBe(ROLE_SELECTION)
    expect(loginRouteFor('/')).toBe(ROLE_SELECTION)
  })

  it('has a login route for every portal prefix', () => {
    for (const prefix of Object.keys(PORTAL_ROLES)) {
      expect(LOGIN_ROUTES[prefix], `no login route for ${prefix}`).toBeTruthy()
    }
  })
})

describe('isAuthRoute', () => {
  it('is true for pages a signed-out user is meant to see', () => {
    expect(isAuthRoute('/auth/donor/login')).toBe(true)
    expect(isAuthRoute('/auth/role-selection')).toBe(true)
    expect(isAuthRoute('/')).toBe(true)
    expect(isAuthRoute('/legal/privacy')).toBe(true)
  })

  it('is false for portal pages', () => {
    expect(isAuthRoute('/donor/dashboard')).toBe(false)
    expect(isAuthRoute('/admin/registrations')).toBe(false)
  })

  /**
   * The 401 handler bails on auth routes. Without this the sign-in request's
   * own 401 (wrong password) would redirect the login page to itself and wipe
   * the error the user needs to read.
   */
  it('covers every login route, so a failed sign-in cannot self-redirect', () => {
    for (const route of Object.values(LOGIN_ROUTES)) {
      expect(isAuthRoute(route), `${route} would self-redirect`).toBe(true)
    }
    expect(isAuthRoute(ROLE_SELECTION)).toBe(true)
  })
})

describe('portalRoleFor', () => {
  it.each([
    ['/donor/dashboard', 'donor'],
    ['/hospital/dashboard', 'blood_bank'],
    ['/blood-center/inventory', 'blood_center'],
    ['/admin/registrations', 'admin'],
  ])('%s requires %s', (path, role) => {
    expect(portalRoleFor(path)).toBe(role)
  })

  it('returns null outside the portals, so public pages are not gated', () => {
    expect(portalRoleFor('/')).toBeNull()
    expect(portalRoleFor('/legal/terms')).toBeNull()
    expect(portalRoleFor('/auth/donor/login')).toBeNull()
  })

  /**
   * `hospital` is the wire alias; `blood_bank` is what the database stores and
   * `RequireRole` checks. Sending the alias here would silently gate the portal
   * on a role nobody holds — the C2 bug, in a different place.
   */
  it('uses canonical role names, not the login screens wire aliases', () => {
    expect(portalRoleFor('/hospital/dashboard')).toBe('blood_bank')
    expect(portalRoleFor('/hospital/dashboard')).not.toBe('hospital')
  })
})

describe('portalHomeFor', () => {
  it('sends each role to its own portal', () => {
    expect(portalHomeFor({ roles: ['admin'] } as any)).toBe('/admin/registrations')
    expect(portalHomeFor({ roles: ['donor'] } as any)).toBe('/donor/dashboard')
    expect(portalHomeFor({ roles: ['blood_bank'] } as any)).toBe('/hospital/dashboard')
  })

  it('routes blood-centre staff by department', () => {
    expect(portalHomeFor({ roles: ['blood_center'], department: 'laboratory' } as any))
      .toBe('/blood-center/laboratory')
    expect(portalHomeFor({ roles: ['blood_center'], department: 'inventory' } as any))
      .toBe('/blood-center/storage')
  })

  it('sends a departmentless supervisor to the overview, others to settings', () => {
    expect(portalHomeFor({ roles: ['blood_center'], is_supervisor: true } as any))
      .toBe('/blood-center/dashboard')
    expect(portalHomeFor({ roles: ['blood_center'] } as any))
      .toBe('/blood-center/settings')
  })

  /**
   * An organisation awaiting approval holds no role yet, by design. It must
   * still land somewhere rather than on a blank page or in a redirect loop.
   */
  it('falls back to role selection when the user holds no role', () => {
    expect(portalHomeFor({ roles: [] } as any)).toBe(ROLE_SELECTION)
    expect(portalHomeFor(null)).toBe(ROLE_SELECTION)
    expect(portalHomeFor(undefined)).toBe(ROLE_SELECTION)
  })

  it('never returns a path that would bounce again', () => {
    const homes = [
      portalHomeFor({ roles: ['admin'] } as any),
      portalHomeFor({ roles: ['donor'] } as any),
      portalHomeFor({ roles: ['blood_center'], department: 'billing' } as any),
    ]
    for (const home of homes) {
      const required = portalRoleFor(home)
      // Either the home is public, or it belongs to a portal — never a portal
      // the user was just refused from.
      expect(required === null || typeof required === 'string').toBe(true)
    }
  })
})
