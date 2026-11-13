import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

/**
 * The read-only Staff Profile on Staff Accounts (2026-11-13): an eye on every
 * roster row, before Edit, opens it; it reads the staff-detail endpoint.
 *
 * Asserted against the source, as the other page specs are: the project has
 * no component-testing harness.
 */

const root = fileURLToPath(new URL('..', import.meta.url))

// Line endings normalised: a Windows checkout (core.autocrlf) writes CRLF.
function source(relative: string): string {
  return readFileSync(path.join(root, relative), 'utf8').replace(/\r\n/g, '\n')
}

const page = source('app/pages/blood-center/staff.vue')
const template = page.slice(0, page.indexOf('<script setup>'))
const profileMarkup = template.slice(template.indexOf('<CenterModal'), template.indexOf('</CenterModal>'))

describe('the eye on each roster row', () => {
  it('names the person and says what it does', () => {
    expect(template).toContain(':aria-label="`View ${row.full_name}\'s profile`"')
    expect(template).toContain('title="View profile"')
    expect(template).toContain('@click="openProfile(row)"')
  })

  it('comes before Edit and is not limited to live accounts', () => {
    const actions = template.slice(template.indexOf('<div class="actions">'))
    const eye = actions.indexOf('@click="openProfile(row)"')

    expect(eye).toBeGreaterThan(-1)
    expect(eye).toBeLessThan(actions.indexOf('@click="openEdit(row)"'))
    expect(eye).toBeLessThan(actions.indexOf('@click="restore(row)"'))

    const eyeButton = actions.slice(actions.lastIndexOf('<button', eye), eye)
    expect(eyeButton).not.toContain('v-if')
  })
})

describe('the Staff Profile', () => {
  it('loads the staff-detail endpoint, latest answer only', () => {
    expect(page).toContain('await bloodCenterService.showStaff(uuid)')
    expect(page).toContain('if (!profileLatest.isCurrent(ticket)) return')
  })

  it('is a dialog with a Close, Escape and a focus trap (CenterModal)', () => {
    expect(template).toContain('<CenterModal :open="profileView.open" title="Staff Profile" @close="closeProfile">')
    expect(profileMarkup).toContain('@click="closeProfile"')

    const modal = source('app/components/ui/CenterModal.vue')
    expect(modal).toContain('v-focus-trap')
    expect(modal).toContain('role="dialog"')
    expect(modal).toContain('aria-modal="true"')
    expect(modal).toContain('@dialog-escape="$emit(\'close\')"')
  })

  it('shows a loading skeleton, and an error with Retry that keeps focus in the dialog', () => {
    expect(profileMarkup).toContain('<div v-if="profileView.loading" class="skeleton skeleton--hero" />')
    expect(profileMarkup).toContain('class="banner banner--error" role="alert"')
    expect(profileMarkup).toContain('@click="retryProfile"')
    expect(page).toContain('profileBody.value?.focus()')
  })

  it('reads only: no form, no input, no action beyond Close', () => {
    expect(profileMarkup).not.toMatch(/<(form|input|select|textarea)\b/)
    expect(profileMarkup.match(/<button\b/g)).toHaveLength(2) // Retry and Close
  })

  it('shows every field asked for', () => {
    for (const label of [
      'Email', 'Username', 'Employee ID', 'Phone', 'Title',
      'Department', 'Access level', 'Main role', 'Additional roles', 'Custom role', 'Privileges',
      'Account status', 'Email verification', 'Activated',
    ]) {
      expect(profileMarkup).toContain(`<dt>${label}</dt>`)
    }
  })

  it('never shows a password, a token or a verification code', () => {
    expect(profileMarkup).not.toMatch(/password|token|verification_code|code\b/i)
  })
})
