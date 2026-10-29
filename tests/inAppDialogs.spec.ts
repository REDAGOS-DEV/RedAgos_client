import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

/**
 * Every question the portal asks is asked in a dialog of its own, never the
 * browser's alert, confirm or prompt (project owner, 2026-10-26).
 *
 * Asserted against the source, as the other page specs are: the project has
 * no component-testing harness. The sweep keeps a new native dialog from
 * creeping back in; the per-dialog checks guard the three that replaced them,
 * each keyboard-contained by v-focus-trap and closed by its Escape.
 */

const root = fileURLToPath(new URL('..', import.meta.url))

// Line endings normalised: a Windows checkout (core.autocrlf) writes CRLF.
function source(relative: string): string {
  return readFileSync(path.join(root, relative), 'utf8').replace(/\r\n/g, '\n')
}

function sourceFiles(dir: string): string[] {
  return readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(relative)

    return /\.(vue|ts|js)$/.test(entry.name) ? [relative] : []
  })
}

// A call to the browser's own dialog: bare or through window, not a method
// (`dialog.confirm(`) nor a function of the same name being declared. Nor an
// awaited one: the browser's never return a promise, and the donor portal's
// `const { confirm } = useConfirmDialog()` is used as `await confirm({...})`.
const NATIVE_DIALOG = /(?<![\w.])(?<!await )(?:window\.)?(?:alert|confirm|prompt)\(/
const DECLARATION = /function (?:alert|confirm|prompt)\(/

describe("the browser's own dialogs", () => {
  it('are used nowhere in the portal', () => {
    const offenders = sourceFiles('app').flatMap((file) =>
      source(file)
        .split('\n')
        .filter((line) => !/^\s*(\/\/|\*)/.test(line) && !DECLARATION.test(line) && NATIVE_DIALOG.test(line))
        .map((line) => `${file}: ${line.trim()}`)
    )

    expect(offenders).toEqual([])
  })
})

describe('Remove on Staff Accounts', () => {
  const page = source('app/pages/blood-center/staff.vue')

  it("asks in the page's own dialog, which keeps a refusal in it", () => {
    expect(page).toContain('@click="askRemove(row)"')
    expect(page).toContain('aria-labelledby="remove-modal-title"')
    expect(page).toContain('@dialog-escape="cancelRemove"')
    expect(page).toContain("removing.error = error?.message || 'Could not remove that account.'")
  })

  it('removes only once the dialog is confirmed', () => {
    expect(page).toContain('@click="confirmRemove"')
    expect(page).toContain('await bloodCenterService.deleteStaff(removing.row.uuid)')
  })
})

describe('closing the onsite questionnaire', () => {
  const onsite = source('app/components/BloodCenter/OnsiteQuestionnaire.vue')

  it('asks before discarding answers given, in a confirm over the form', () => {
    expect(onsite).toContain('if (dirty.value) {\n    discarding.value = true\n    return\n  }')
    expect(onsite).toContain('aria-labelledby="onsite-discard-title"')
    expect(onsite).toContain('@dialog-escape="discarding = false"')
    expect(onsite).toContain('@click="discard"')
  })

  it('keeps the confirm outside the form, so its Escape does not ask again', () => {
    const [form, rest] = onsite.split('</section>\n\n      <!-- Closing with answers given')

    expect(form).toContain('@keydown.esc="requestClose"')
    expect(rest).toContain('class="onsite-confirm"')
  })
})

describe('Collection unsuccessful', () => {
  const page = source('app/pages/blood-center/donation.vue')

  it('is keyboard-contained and closed by Escape, with the reason focused', () => {
    expect(page).toContain('@dialog-escape="cancelAbandon"')
    expect(page).toContain('setTimeout(() => abandonReason.value?.focus())')
  })
})
