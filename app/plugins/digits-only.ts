/**
 * `v-digits-only` — an input that will not take anything but 0–9.
 *
 *   <input v-model="form.donation_barcode" v-digits-only inputmode="numeric">
 *
 * Whatever is typed, pasted or scanned is cleaned to its digits
 * (utils/digitsOnly), so a letter or dash never appears. Works the way
 * v-person-name does: v-model takes the raw value first, so the cleaned one is
 * handed back through a second `input` event, which is already clean and stops
 * there. Input mid-composition is left alone until it is committed.
 *
 * Universal, not `.client`, for the reason given in focus-trap.ts: a directive
 * in server-rendered markup must exist during SSR.
 */
import { cleanedDigitsInput } from '~/utils/digitsOnly'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.directive('digits-only', {
    getSSRProps: () => ({}),

    mounted(el: HTMLInputElement) {
      el.addEventListener('input', (e) => {
        if ((e as InputEvent).isComposing) return

        const next = cleanedDigitsInput(el.value, el.selectionStart)
        if (!next) return

        el.value = next.value
        el.setSelectionRange(next.caret, next.caret)
        el.dispatchEvent(new Event('input'))
      })
    },
  })
})
