import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

/**
 * Sign in with Google, no account (2026-11-22).
 *
 * When Google confirms an address no RedAgos account uses, the sign-in screen
 * offers to register a donor account with it instead of showing a warning, and
 * the register page starts with that address filled in.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (file: string) => readFileSync(path.join(root, file), 'utf8')

describe('the Google register offer', () => {
  const composable = read('app/composables/useAuthLogin.ts')
  const layout = read('app/components/auth/AuthLoginLayout.vue')
  const register = read('app/pages/auth/donor/register.vue')

  it('keeps the address from the refusal instead of an error message', () => {
    expect(composable).toMatch(/google && error\?\.data\?\.code === 'google_account_not_found'/)
    expect(composable).toMatch(/googleSignUpEmail\.value = String\(error\.data\.email\)/)
  })

  it('offers registration with that address, in place of the warning', () => {
    expect(layout).toMatch(/v-if="googleSignUpEmail"/)
    expect(layout).toMatch(/<LoginAlert v-else/)
    expect(layout).toContain("path: '/auth/donor/register', query: { email: googleSignUpEmail }")
    expect(layout).toContain('Register with this email')
  })

  it('fills the register form with the offered address', () => {
    expect(register).toMatch(/route\.query\.email/)
    expect(register).toMatch(/form\.email = offered\.trim\(\)/)
  })
})
