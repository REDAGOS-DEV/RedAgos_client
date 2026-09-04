/**
 * Content globs must point at `app/`.
 *
 * These previously read `./components`, `./pages`, … — the Nuxt 3 layout. This
 * project uses Nuxt 4, where everything lives under `app/`, so the globs matched
 * nothing and the file was dead configuration. The @nuxtjs/tailwindcss module
 * supplies its own defaults from the Nuxt dirs, which is why nothing visibly
 * broke, but anything added here would silently have had no effect.
 */
export default {
  darkMode: 'class',
  content: [
    './app/components/**/*.{vue,js,ts}',
    './app/layouts/**/*.vue',
    './app/pages/**/*.vue',
    './app/composables/**/*.{js,ts}',
    './app/utils/**/*.{js,ts}',
    './app/plugins/**/*.{js,ts}',
    './app/app.vue',
    './app/error.vue',
  ],
}
