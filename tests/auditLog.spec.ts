import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { auditTypeTone } from '~/utils/auditLog'
import { useBloodCenterNav } from '~/composables/useBloodCenterNav'

/**
 * The Audit Log (project owner, 2026-10-21): the Blood Center Admin's read of
 * what the centre's staff did. What is locked in: only audit.view reaches it,
 * from the sidebar and the page alike, and a refused sign-in reads red.
 */

const root = fileURLToPath(new URL('..', import.meta.url))

// Line endings normalised: a Windows checkout (core.autocrlf) writes CRLF.
function source(relative: string): string {
  return readFileSync(path.join(root, relative), 'utf8').replace(/\r\n/g, '\n')
}

let abilities: string[] = []

beforeEach(() => {
  abilities = []
  vi.stubGlobal('computed', (getter: () => unknown) => ({ get value() { return getter() } }))
  vi.stubGlobal('useUser', () => ({
    user: { get value() { return { department: null, management_level: 'admin' } } },
    can: (required?: string | readonly string[]) => required === undefined
      || (Array.isArray(required) ? required.some((a) => abilities.includes(a)) : abilities.includes(required as string)),
  }))
})

function paths(): string[] {
  return useBloodCenterNav().navGroups.value.flatMap((group) => group.items.map((item) => item.path))
}

describe('who reaches the Audit Log', () => {
  it('is in the Admin\'s sidebar', () => {
    abilities = ['reports.view_all', 'staff.manage', 'center.configure', 'audit.view']

    expect(paths()).toContain('/blood-center/audit-log')
  })

  it('is not in a Supervisor\'s', () => {
    abilities = ['reports.view_all', 'inventory.view', 'requests.view', 'billing.view']

    expect(paths()).not.toContain('/blood-center/audit-log')
  })

  it('asks the page for the same ability as the link, so the link never bounces', () => {
    expect(source('app/pages/blood-center/audit-log.vue')).toContain("requires: 'audit.view'")
    expect(source('app/composables/useBloodCenterNav.ts')).toContain("path: '/blood-center/audit-log', icon: 'history', requires: 'audit.view'")
  })
})

describe('the action chip', () => {
  it('reads a refused sign-in, a removal and a rejection red', () => {
    expect(auditTypeTone('failed_sign_in')).toBe('crit')
    expect(auditTypeTone('delete')).toBe('crit')
    expect(auditTypeTone('cancel')).toBe('crit')
    expect(auditTypeTone('reject')).toBe('crit')
  })

  it('reads signing in and out blue, and a kind it does not know grey', () => {
    expect(auditTypeTone('sign_in')).toBe('info')
    expect(auditTypeTone('sign_out')).toBe('info')
    expect(auditTypeTone('view')).toBe('neutral')
    expect(auditTypeTone('something_new')).toBe('neutral')
  })
})
