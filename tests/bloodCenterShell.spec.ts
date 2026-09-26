import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// `useSidebar` reaches for Nuxt's auto-imported `useState` and `computed` at
// call time, not import time, so stubbing them per-test is enough — no Nuxt
// runtime needed, same as the rest of this suite.
import { useSidebar } from '~/composables/useSidebar.js'

/**
 * The Blood Center shell: the hover-expand rail, the content column that
 * reflows beside it, and the page gutters they share.
 *
 * Rendering the 2,000-line pages stays out of scope, as everywhere else in
 * this suite. What is covered is the handful of facts that are split across
 * two files and silently break when only one of them is edited — each of which
 * has already been wrong in this codebase:
 *
 *  - the rail was 270px wide while the layout reserved 256px, so the sidebar
 *    sat 14px over the content at every width;
 *  - the header offset and the content padding have to move with the rail, and
 *    they are written in three different files;
 *  - `:global(.dark) .x` compiles, in this toolchain, to a bare `.dark { … }`
 *    — the declaration lands on <html> and the intended element gets nothing;
 *  - two chrome surfaces linked to /blood-center/notifications, which has no
 *    page, so the link 404'd.
 */

const root = fileURLToPath(new URL('..', import.meta.url))

function source(relative: string): string {
  return readFileSync(path.join(root, relative), 'utf8')
}

const SIDEBAR = 'app/components/BloodCenter/sidebar.vue'
const LAYOUT = 'app/layouts/blood-centerdashboard.vue'

describe('rail width and the space reserved for it', () => {
  const sidebar = source(SIDEBAR)
  const layout = source(LAYOUT)

  /*
   * Tailwind's scale is the shared unit: w-20 is 5rem and pl-20/left-20 reserve
   * exactly that, w-64 is 16rem and pl-64/left-64 match it. Asserting on the
   * class names is asserting that the two files picked the same step.
   */
  it('gives the collapsed rail a width the content column also reserves', () => {
    expect(sidebar).toContain('lg:w-20')
    expect(layout).toContain('lg:pl-20')
    expect(layout).toContain('lg:left-20')
  })

  it('gives the expanded rail a width the content column also reserves', () => {
    expect(sidebar).toContain('lg:w-64')
    expect(layout).toContain('lg:pl-64')
    expect(layout).toContain('lg:left-64')
  })

  it('drives both widths from the one railExpanded flag', () => {
    expect(sidebar).toContain("railCollapsed ? 'lg:w-20' : 'lg:w-64'")
    expect(layout).toContain("railExpanded ? 'lg:pl-64' : 'lg:pl-20'")
    expect(layout).toContain("railExpanded ? 'lg:left-64' : 'lg:left-20'")
  })

  it('reads that flag from the blood-centre bucket, not the donor one', () => {
    expect(sidebar).toContain("useSidebar('blood-center')")
    expect(layout).toContain("useSidebar('blood-center')")
  })

  /*
   * The rail animates its width and the content column animates its padding.
   * If the two durations drift apart the sidebar and the page separate mid
   * transition, which is the "layout jumping" this was meant to remove.
   */
  it('moves the rail and the content column over the same duration', () => {
    expect(sidebar).toContain('transition: width 200ms ease-out')
    expect(layout).toContain('transition: padding-left 200ms ease-out')
    expect(layout).toContain('transition: left 200ms ease-out')
  })

  it('reflows the content rather than floating the rail over it', () => {
    // Padding on the column that holds the page — not a margin on the aside,
    // and not a transform — is what makes the children re-lay-out.
    expect(layout).toMatch(/class="content-shift"[\s\S]{0,120}lg:pl-64/)
  })
})

describe('scoped dark-mode rules', () => {
  /*
   * `:global(.dark) .thing { … }` looks right and compiles to `.dark { … }`:
   * the descendant half is dropped and the declaration is applied to the
   * element carrying the theme class, which is <html>. That is how a header's
   * box-shadow ended up painted across the whole document. Either write the
   * whole selector inside :global(), or — better — use a token that already
   * flips.
   */
  const BROKEN = /:global\(\.dark\)\s*[.#a-zA-Z[]/

  for (const file of [SIDEBAR, LAYOUT]) {
    it(`does not use the :global(.dark) descendant form in ${path.basename(file)}`, () => {
      const withoutComments = source(file).replace(/\/\*[\s\S]*?\*\//g, '')
      expect(BROKEN.test(withoutComments)).toBe(false)
    })
  }

  /*
   * The other half of the same trap. `:global(.dark .form-input)` compiles
   * fine, but it is not scoped to anything — it applies on every page in the
   * app the moment that route's stylesheet is fetched, and .form-input,
   * .panel, .stat-card and .modal-card are names four portals share.
   *
   * Anchoring on the page root is what makes it safe, so these files must
   * never emit `:global(.dark <generic class>)` with no ancestor in front.
   */
  const PAGE_ROOTS: Record<string, string> = {
    'app/pages/blood-center/appointments.vue': '.appointments-page',
    'app/pages/blood-center/donors.vue': '.donors-page',
    'app/pages/blood-center/bloodrequests.vue': '.page',
  }

  for (const [file, root] of Object.entries(PAGE_ROOTS)) {
    it(`anchors every global dark rule on ${root}`, () => {
      const style = source(file).split('<style scoped>')[1]!.replace(/\/\*[\s\S]*?\*\//g, '')
      const unanchored = [...style.matchAll(/:global\(\.dark ([^)]*)\)/g)]
        .map((m) => m[1]!.trim())
        .filter((sel) => sel !== root && !sel.startsWith(`${root} `) && !sel.startsWith(`${root}.`))

      expect(unanchored).toEqual([])
    })
  }

  /*
   * A caret drawn with background-image needs background-repeat with it. The
   * donor profile page set the image alone and took repeat/position/size from
   * a *scoped* sibling rule — on any other page that sibling does not match,
   * so the chevron tiled a dozen times across the control and struck through
   * its own label. Every rule that paints one must be self-contained.
   */
  const CARET_FILES = [
    'app/pages/blood-center/appointments.vue',
    'app/pages/blood-center/donors.vue',
    'app/pages/blood-center/reports.vue',
    'app/pages/blood-center/inventory.vue',
    'app/pages/blood-center/dashboard.vue',
    'app/pages/donor/profile.vue',
    'app/components/profile/IdentityVerification.vue',
  ]

  for (const file of CARET_FILES) {
    it(`never paints a caret without saying no-repeat in ${path.basename(file)}`, () => {
      const style = source(file).split('<style')[1] ?? ''
      const leaky = [...style.matchAll(/[^;{}]*url\("data:image\/svg[^"]*"\)[^;{}]*;?/g)]
        .map((m) => m[0])
        .filter((decl) => !/no-repeat/.test(decl))
        .filter((decl) => {
          // A bare `background-image:` is fine as long as the same block also
          // sets background-repeat.
          const block = style.slice(Math.max(0, style.indexOf(decl) - 400), style.indexOf(decl) + 600)
          return !/background-repeat:\s*no-repeat/.test(block)
        })

      expect(leaky).toEqual([])
    })
  }
})

describe('page gutters', () => {
  /*
   * Every page sits in the same centred column as the donor portal. When one
   * page picks its own width the content visibly shifts as you move between
   * them, and two of these pages had no column at all: collection.vue ran
   * flush into the layout edges and fulfillment.vue was full-bleed.
   */
  const PAGES = [
    'appointments', 'bloodrequests', 'collection', 'dashboard', 'donors',
    'drives', 'fulfillment', 'inventory', 'reports', 'settings', 'staff',
    'laboratory', 'testing', 'stock-report',
  ]

  for (const page of PAGES) {
    it(`${page}.vue sits in the shared 1152px column`, () => {
      const css = source(`app/pages/blood-center/${page}.vue`)
      expect(css).toContain('max-width: 1152px')
      expect(css).toMatch(/padding:\s*24px 32px 40px/)
    })
  }

  it('the four department dashboards inherit it from their shared shell', () => {
    const shell = source('app/components/BloodCenter/DepartmentDashboard.vue')
    expect(shell).toContain('max-width: 1152px')
    expect(shell).toMatch(/padding:\s*24px 32px 40px/)
  })

  /*
   * A page that also sets min-height:100vh inside a <main> already offset by
   * the header is 100vh + 64px tall, so every screen scrolls by the height of
   * the header with nothing under it.
   */
  it('leaves the full-height guarantee to the layout', () => {
    for (const page of PAGES) {
      const css = source(`app/pages/blood-center/${page}.vue`).replace(/\/\*[\s\S]*?\*\//g, '')
      expect(css, `${page}.vue`).not.toMatch(/min-height:\s*100vh/)
    }
  })
})

describe('chrome links resolve to a page', () => {
  /*
   * The sidebar, the ⌘F index, the profile menu and the header all offer
   * routes. A route with no page file is a 404 the user finds by clicking.
   */
  function pageExists(route: string): boolean {
    const rest = route.replace('/blood-center/', '')
    return existsSync(path.join(root, 'app/pages/blood-center', `${rest}.vue`))
  }

  it('every nav destination has a page', () => {
    const nav = source('app/composables/useBloodCenterNav.ts')
    const routes = [...nav.matchAll(/path:\s*'(\/blood-center\/[^']+)'/g)].map((m) => m[1]!)

    expect(routes.length).toBeGreaterThan(5)
    expect(routes.filter((r) => !pageExists(r))).toEqual([])
  })

  it('the layout header links nowhere that has no page', () => {
    const layout = source(LAYOUT)
    const routes = [...layout.matchAll(/to="(\/blood-center\/[^"]+)"/g)].map((m) => m[1]!)

    expect(routes.filter((r) => !pageExists(r))).toEqual([])
  })

  it('no page links to a blood-centre route that has no page', () => {
    const broken: string[] = []

    for (const page of ['appointments', 'bloodrequests', 'dashboard', 'donors', 'drives', 'fulfillment', 'inventory', 'reports', 'settings', 'staff']) {
      const text = source(`app/pages/blood-center/${page}.vue`)
      for (const m of text.matchAll(/to="(\/blood-center\/[^"]+)"/g)) {
        if (!pageExists(m[1]!)) broken.push(`${page}.vue -> ${m[1]}`)
      }
    }

    expect(broken).toEqual([])
  })
})

describe('useSidebar namespacing', () => {
  /*
   * The donor and admin builds were written against one unnamespaced set of
   * keys. The blood centre needs its own, because its layout follows the hover
   * — a hover latched in one portal must not widen the other's content column.
   */
  const states = new Map<string, { value: unknown }>()

  beforeEach(() => {
    states.clear()
    vi.stubGlobal('useState', (key: string, init: () => unknown) => {
      if (!states.has(key)) states.set(key, { value: init() })
      return states.get(key)!
    })
    vi.stubGlobal('computed', (getter: () => unknown) => ({
      get value() { return getter() },
    }))
  })

  it('keeps the donor keys when no namespace is given', () => {
    useSidebar()

    expect([...states.keys()]).toEqual([
      'donor-sidebar-collapsed',
      'donor-sidebar-hover-expanded',
      'donor-sidebar-mobile-open',
    ])
  })

  it('gives a namespace its own keys', () => {
    useSidebar('blood-center')

    expect([...states.keys()]).toEqual([
      'blood-center-sidebar-collapsed',
      'blood-center-sidebar-hover-expanded',
      'blood-center-sidebar-mobile-open',
    ])
  })

  it('does not let one portal\'s hover widen another\'s', () => {
    const donor = useSidebar()
    const centre = useSidebar('blood-center')

    centre.expandOnHover()

    expect(centre.railExpanded.value).toBe(true)
    expect(donor.railExpanded.value).toBe(false)
  })

  it('starts collapsed and widens only while hovered', () => {
    const rail = useSidebar('blood-center')

    expect(rail.collapsed.value).toBe(true)
    expect(rail.railExpanded.value).toBe(false)

    rail.expandOnHover()
    expect(rail.railExpanded.value).toBe(true)

    rail.collapseOnHover()
    expect(rail.railExpanded.value).toBe(false)
  })
})
