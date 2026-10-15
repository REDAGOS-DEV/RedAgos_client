/**
 * `v-reveal` — fade an element up the first time it scrolls into view.
 *
 *   <div v-reveal>…</div>
 *   <li v-reveal="120">…</li>   // delay in ms, for staggering siblings
 *
 * Each landing section used to own an IntersectionObserver and a `visible`
 * ref, then hide its content with `opacity: 0` in scoped CSS. That left the
 * page blank in the server render and for anyone without JavaScript. Here
 * the hidden state is only added on the client, at mount.
 *
 * Universal rather than `.client` for the same reason as focus-trap: a
 * directive in server-rendered markup must exist during SSR.
 */
export default defineNuxtPlugin((nuxtApp) => {
  let observer: IntersectionObserver | null = null

  const getObserver = () => {
    if (observer) return observer
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.add('is-revealed')
          observer?.unobserve(entry.target)
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    )
    return observer
  }

  nuxtApp.vueApp.directive('reveal', {
    getSSRProps: () => ({}),

    mounted(el: HTMLElement, binding) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (reduce || typeof IntersectionObserver === 'undefined') return

      if (typeof binding.value === 'number') {
        el.style.transitionDelay = `${binding.value}ms`
      }
      el.classList.add('reveal')
      getObserver().observe(el)
    },

    unmounted(el: HTMLElement) {
      observer?.unobserve(el)
    },
  })
})
