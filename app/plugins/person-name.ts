/**
 * `v-person-name` — a name input that will not take emoji, digits or symbols.
 *
 *   <input v-model="form.first_name" v-person-name>
 *
 * Whatever is typed or pasted is cleaned to what a name may hold
 * (utils/personName), so the character never appears. The server refuses the
 * same characters (App\Rules\PersonName); this only saves the round trip.
 *
 * v-model's listener runs first and takes the raw value, so the cleaned one is
 * handed back through a second `input` event. That one is already clean, so it
 * stops there. Input mid-composition (an IME, a dead key) is left alone until
 * it is committed — v-model ignores it too, then re-dispatches on commit.
 *
 * Universal, not `.client`, for the reason given in focus-trap.ts: a directive
 * in server-rendered markup must exist during SSR.
 */
import { cleanedNameInput } from '~/utils/personName'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.directive('person-name', {
    getSSRProps: () => ({}),

    mounted(el: HTMLInputElement) {
      el.addEventListener('input', (e) => {
        if ((e as InputEvent).isComposing) return

        const next = cleanedNameInput(el.value, el.selectionStart)
        if (!next) return

        el.value = next.value
        el.setSelectionRange(next.caret, next.caret)
        el.dispatchEvent(new Event('input'))
      })
    },
  })
})
