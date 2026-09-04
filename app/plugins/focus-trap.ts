/**
 * `v-focus-trap` — keyboard containment for modal dialogs.
 *
 * The app has 13 elements with `role="dialog"`. Most carried `aria-modal`, but
 * none managed focus, so for a keyboard or screen-reader user a dialog was
 * decoration: Tab walked straight out of it into the page behind, which is
 * still rendered and still interactive, and on close focus was lost to the top
 * of the document.
 *
 * Written as a directive rather than a composable because wiring it is then one
 * attribute per dialog instead of script changes inside eight files of 1,500+
 * lines each.
 *
 *   <div role="dialog" aria-modal="true" v-focus-trap @dialog-escape="close">
 *
 * Escape dispatches a `dialog-escape` CustomEvent rather than closing the
 * dialog itself — the directive has no idea what "closed" means here, and
 * guessing would fight each page's own state.
 *
 * Registered universally, not `.client`, even though every hook is
 * client-side. A directive used in server-rendered markup must exist during SSR
 * so Vue can ask it for `getSSRProps`; a client-only plugin leaves it undefined
 * and the render dies with "Cannot read properties of undefined (reading
 * 'getSSRProps')" — which is what the landing page's nav dialog did.
 *
 * `mounted` and `unmounted` never run on the server, so guarding them is
 * unnecessary; supplying `getSSRProps` is.
 */

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function focusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE))
    // A focusable element inside a hidden branch cannot take focus; offsetParent
    // is null for anything `display: none`, which is how most of these dialogs
    // hide their inactive steps.
    .filter((el) => el.offsetParent !== null || el === document.activeElement)
}

interface TrapState {
  onKeydown: (e: KeyboardEvent) => void
  previouslyFocused: Element | null
}

const states = new WeakMap<HTMLElement, TrapState>()

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.directive('focus-trap', {
    // Adds no attributes to the server-rendered markup. Required for the
    // directive to be usable in any SSR'd template.
    getSSRProps: () => ({}),

    mounted(el: HTMLElement) {
      const previouslyFocused = document.activeElement

      const onKeydown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          el.dispatchEvent(new CustomEvent('dialog-escape', { bubbles: false }))
          return
        }

        if (e.key !== 'Tab') return

        const items = focusable(el)
        if (!items.length) {
          // Nothing to focus inside: keep the caret in the dialog rather than
          // letting Tab escape to the page behind it.
          e.preventDefault()
          return
        }

        const first = items[0]!
        const last = items[items.length - 1]!
        const active = document.activeElement

        if (e.shiftKey && (active === first || !el.contains(active))) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && active === last) {
          e.preventDefault()
          first.focus()
        }
      }

      el.addEventListener('keydown', onKeydown)
      states.set(el, { onKeydown, previouslyFocused })

      // Move focus in on the next tick — the dialog's children are often still
      // being rendered by a v-if in the same flush.
      nextTick(() => {
        const items = focusable(el)
        // Prefer the dialog itself if it is programmatically focusable, so a
        // screen reader announces the dialog before its first control.
        if (el.hasAttribute('tabindex')) {
          el.focus()
        } else {
          items[0]?.focus()
        }
      })
    },

    unmounted(el: HTMLElement) {
      const state = states.get(el)
      if (!state) return

      el.removeEventListener('keydown', state.onKeydown)
      states.delete(el)

      // Return focus to whatever opened the dialog. Without this the user is
      // dropped at the top of the document and has to tab back through the
      // whole page.
      const previous = state.previouslyFocused as HTMLElement | null
      if (previous && typeof previous.focus === 'function' && document.contains(previous)) {
        previous.focus()
      }
    },
  })
})
