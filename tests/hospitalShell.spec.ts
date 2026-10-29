import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '..')
const source = (file: string) => readFileSync(path.join(root, file), 'utf8')

/**
 * The hospital portal on the blood center's UI (project owner, 2026-10-28):
 * its shell, its sidebar, its theme and its Settings.
 */
describe('the hospital shell', () => {
  const layout = source('app/layouts/hospitaldashboard.vue')

  it('takes the blood center\'s palette and page finish', () => {
    expect(layout).toContain('<div class="bc-shell">')
    expect(layout).toContain("document.documentElement.classList.add('portal-bc')")
    expect(layout).toContain("document.documentElement.classList.remove('portal-bc')")
    expect(layout).toContain("import '~/assets/css/bc-ui.css'")
    expect(layout).not.toContain('staff-glass')
  })

  it('opens the rail from a menu button in a full-width top bar', () => {
    expect(layout).toContain('data-rail-toggle')
    expect(layout).toContain('aria-controls="hospital-sidebar"')
    expect(layout).toContain('class="topbar fixed top-0 left-0 right-0')
  })

  it('keeps the theme in the account menu, Light, Dark or System', () => {
    expect(layout).toContain("{ value: 'system', label: 'System (same as your browser)', icon: 'monitor' }")
    expect(layout).toContain('@click="setThemeMode(option.value)"')
    expect(layout).not.toContain('toggleTheme')
  })

  it('drops the hospital\'s notifications into a bell, sharing the inbox\'s count', () => {
    expect(layout).toContain('<HospitalNotificationBell />')

    const bell = source('app/components/Hospital/NotificationBell.vue')
    expect(bell).toContain('useHospitalUnreadCount()')
    expect(bell).toContain('hospitalService.listNotifications({ per_page: PAGE_SIZE })')
    expect(bell).toContain('hospitalService.markAllNotificationsRead()')
    expect(bell).toContain('to="/hospital/notifications"')
  })
})

describe('the hospital sidebar', () => {
  const sidebar = source('app/components/Hospital/Sidebar.vue')

  it('is the blood center\'s rail, under the top bar, with the agos line', () => {
    expect(sidebar).toContain('id="hospital-sidebar"')
    expect(sidebar).toContain('lg:top-16 lg:h-[calc(100vh-4rem)]')
    expect(sidebar).toContain('class="agos"')
    expect(sidebar).toContain("var(--rb-chrome, #FFFFFF)")
  })

  it('still offers each role only the pages it holds', () => {
    expect(sidebar).toContain('!item.requires || !hydrated.value || can(item.requires)')
  })
})

describe('the hospital Settings', () => {
  const page = source('app/pages/hospital/settings.vue')
  const service = source('app/api/hospital/HospitalService.ts')

  it('has the blood center\'s tabs, all of them working', () => {
    for (const tab of ["id: 'profile'", "id: 'security'", "id: 'appearance'", "id: 'account'", "id: 'hospital'"]) {
      expect(page).toContain(tab)
    }
    expect(page).toContain('<AppearancePicker class="card__picker" />')
  })

  it('saves through routes that exist, and no longer through ones that do not', () => {
    for (const call of ['profile()', 'updateProfile(', 'uploadAvatar(', 'updatePassword(']) {
      expect(page).toContain(`hospitalService.${call}`)
    }
    expect(page).toContain('authService.logoutFromAllDevices()')

    for (const gone of ['updateHospitalInfo', 'updateNotificationPreferences', 'updateSystemPreferences']) {
      expect(page).not.toContain(gone)
    }

    expect(service).toContain("'/hospital/profile'")
    expect(service).toContain("'/hospital/profile/avatar'")
    expect(service).toContain("'/hospital/password'")
  })

  it('sends the password the way the server reads it, and signs out after', () => {
    expect(page).toContain('current_password: passwordForm.current')
    expect(page).toContain('password_confirmation: passwordForm.confirm')
    expect(page).toContain("{ label: 'Upper and lower case letters'")
    expect(page).toContain("await logout('/auth/login')")
  })

  it('confirms signing out everywhere in its own dialog', () => {
    expect(page).toContain('v-focus-trap')
    expect(page).toContain('@dialog-escape="confirmLogoutOthers = false"')
  })
})
