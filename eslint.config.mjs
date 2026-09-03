import js from '@eslint/js'
import globals from 'globals'
import pluginVue from 'eslint-plugin-vue'
import vueParser from 'vue-eslint-parser'
import tsParser from '@typescript-eslint/parser'
import { configs as nuxtConfigs } from './.nuxt/eslint.config.mjs'

/**
 * The check that would have caught `useApi()`.
 *
 * `no-undef` is only trustworthy in a Nuxt app if the linter knows every
 * auto-import. Without that list an undefined symbol looks exactly like a
 * composable whose global has not been generated yet — which is why six calls
 * to a function that does not exist reached `develop` unnoticed.
 *
 * @nuxt/eslint generates that list. Its own flat preset does not currently
 * resolve `eslint-plugin-vue` for us (it declares `vue/*` rules in config
 * objects that report no plugin, and ESLint then refuses the entire run), so
 * this file borrows only the generated globals and wires Vue up directly.
 * Everything here is explicit, which is worth more than the preset's defaults
 * for a codebase this far from them.
 *
 * Regenerate the globals with `nuxt prepare` after adding a composable or util.
 */
const resolved = await nuxtConfigs.toConfigs()
const nuxtGlobals =
  resolved.find((c) => c.name === 'nuxt/import-globals')?.languageOptions?.globals ?? {}

if (!Object.keys(nuxtGlobals).length) {
  throw new Error(
    'No Nuxt auto-import globals found. Run `nuxt prepare` first — without them ' +
    '`no-undef` would flag every composable and the run would be useless.',
  )
}

const languageOptions = {
  ecmaVersion: 'latest',
  sourceType: 'module',
  globals: {
    ...globals.browser,
    ...globals.node,
    ...nuxtGlobals,
  },
}

export default [
  {
    name: 'redagos/ignores',
    ignores: [
      '.nuxt/**',
      '.output/**',
      'dist/**',
      'node_modules/**',
      'dev/**',
      'public/**',
      // Vendored agent/skill tooling, not this project's source. Linting it
      // buries the app's own findings — it accounted for 179 of the first
      // run's 186 `no-undef` hits.
      '.agents/**',
      '.claude/**',
      '.codex/**',
      '.github/**',
      '.impeccable/**',
    ],
  },

  js.configs.recommended,

  ...pluginVue.configs['flat/essential'],

  {
    name: 'redagos/js',
    files: ['**/*.{js,mjs}'],
    languageOptions,
  },

  {
    // Nuxt's config-file macros are not part of the app's auto-import registry.
    name: 'redagos/config-files',
    files: ['nuxt.config.ts', 'tailwind.config.js', 'eslint.config.mjs'],
    languageOptions: {
      ...languageOptions,
      globals: { ...languageOptions.globals, defineNuxtConfig: 'readonly' },
    },
  },

  {
    name: 'redagos/ts',
    files: ['**/*.ts'],
    languageOptions: { ...languageOptions, parser: tsParser },
    rules: {
      // TypeScript's own checker owns undefined symbols in .ts files, and it
      // understands `declare` and type-only names that no-undef does not.
      'no-undef': 'off',
      // Duplicated by the compiler, and it misfires on declaration merging.
      'no-unused-vars': 'off',
    },
  },

  {
    name: 'redagos/vue',
    files: ['**/*.vue'],
    languageOptions: {
      ...languageOptions,
      parser: vueParser,
      parserOptions: { parser: tsParser, ecmaVersion: 'latest', sourceType: 'module' },
    },
  },

  {
    name: 'redagos/rules',
    rules: {
      // The point of the whole setup.
      'no-undef': 'error',

      // Unused imports and variables are how dead code survives review.
      // `_`-prefixed args stay allowed for signature-shaped callbacks.
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrors: 'none',
      }],

      // `console.error` is legitimate diagnostics and there are 113 of them;
      // flagging those would bury the signal. `console.log` is debug residue.
      'no-console': ['warn', { allow: ['error', 'warn', 'info'] }],

      // Page and component files are named for their route (Dashboard.vue,
      // Settings.vue). Renaming for the linter was explicitly out of scope.
      'vue/multi-word-component-names': 'off',

      /**
       * Eight skeleton-loader blocks put `v-if="loading"` and `v-for="n in 4"`
       * on one element, in Appointments.vue, Donors.vue and Reports.vue.
       *
       * Held at `warn` rather than fixed now. All eight conditions are
       * loop-invariant, so `v-if` winning priority is harmless and the pages
       * render correctly today. The correct fix is paired `<template v-if>` /
       * `<template v-else>` wrappers, and at several sites the `v-else` branch
       * carries its own `v-for`, so it is real template surgery — inside three
       * files already queued for decomposition in Phase 3.
       *
       * Restore to `error` when those files are split, at which point the fix
       * is part of restructuring rather than blind edits to a 2,000-line SFC.
       */
      'vue/no-use-v-if-with-v-for': 'warn',
    },
  },

  {
    /**
     * Known-bad baseline, not an exemption.
     *
     * These files call `useApi()` and `useBloodRequests()`, which are defined
     * nowhere — the C1 finding. They sit in the hospital portal, which is
     * disabled behind `hospitalPortalEnabled` because the backend serves no
     * `/hospital/*` route at all, so the calls are unreachable rather than
     * merely broken. Fixing them means Phase P, not a rename.
     *
     * Held at `warn` so CI stays green on everything else. A permanently red
     * pipeline is one nobody reads, and this rule's whole value is that a *new*
     * undefined symbol fails the build loudly.
     *
     * DELETE THIS BLOCK when the hospital portal is re-enabled. If the lint
     * then passes, the calls were fixed; if it fails, they were not, and the
     * portal is not ready to turn on.
     */
    name: 'redagos/known-undefined-phase-p',
    files: [
      'app/composables/useTrackRequests.js',
      'app/composables/useBloodRequestDetails.js',
      'app/pages/hospital/**/*.vue',
    ],
    rules: {
      'no-undef': 'warn',
    },
  },
]
