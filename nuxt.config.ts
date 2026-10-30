// https://nuxt.com/docs/api/configuration/nuxt-config

// Cloudflare Pages builds the app itself and has no dev proxy, so a missing or
// relative API base sends every call to the Pages site, or to :8000 on it.
// Fail the Pages build instead of shipping a portal where every request fails.
// CF_PAGES is set by Cloudflare's builder only; local and CI builds skip this.
const pagesApiBase = process.env.NUXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || ''

if (process.env.CF_PAGES && !/^https:\/\/[^/]+/i.test(pagesApiBase)) {
  throw new Error(
    'Cloudflare Pages build: set API_BASE_URL in the Pages project to the API\'s '
    + `https address, /api included (e.g. https://<app>.koyeb.app/api). Got "${pagesApiBase}".`,
  )
}

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss', '@nuxt/eslint'],

  eslint: {
    config: {
      // Ang standalone: false mao ang punto. Gi-generate niini ang globals para
      // sa tanan nga Nuxt auto-import (useState, navigateTo, defineNuxtPlugin,
      // ug ang tanan nga composable/util nato), so ang `no-undef` mahimong
      // kasaligan dinhi. Kung wala ni, ang undefined nga `useApi()` morag
      // auto-import ra pod ug dili ma-flag — mao gyud ni ang bug nga nakalusot.
      standalone: false,
    },
  },
  css: ['~/assets/css/main.css', '~/assets/css/ui.css'],

  app: {
    head: {
      // The tab's name wherever a page sets none; without it the browser shows the domain.
      title: 'RedAgos',
      link: [
        // The RedAgos drop, from assets/images/RedAgosLogo.png. The tab icon is
        // cropped to the solid shape so it stays crisp at 16-32 px; the home-screen
        // icon keeps the whole logo on black, which iOS would otherwise add itself.
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'icon', type: 'image/png', sizes: '192x192', href: '/icon-192.png' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
        // Preconnect sa duha ka origin: ang googleapis nagserve sa CSS, ang
        // gstatic sa mismong font files. Ang crossorigin kinahanglan sa gstatic
        // kay CORS ang font fetch — kung wala, mausik ang preconnect.
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          // Inter is the donor portal's UI font (body, labels, numbers); Plus Jakarta
          // Sans stays the brand / heading font everywhere.
          href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap',
        },
      ],
    },
  },

  runtimeConfig: {
    public: {
      // Kung wala ni na-set, ang BaseService na ang mo-derive sa host gikan
      // sa browser. Sa deploy, i-set ang NUXT_PUBLIC_API_BASE_URL.
      apiBaseURL: process.env.API_BASE_URL || '',

      // Sign in with Google (2026-10-30): the same Web client ID the server's
      // GOOGLE_CLIENT_ID holds. Unset, the Google button is not shown.
      googleClientId: process.env.GOOGLE_CLIENT_ID || '',

      // Ang hospital / blood-bank portal kay ABLI na by default.
      //
      // Naa nay `/hospital/*` nga route ang Laravel: availability search,
      // eligible facilities, blood-requests CRUD, track by reference, cancel,
      // confirm-receipt ug notifications. Mao nga ang default kay `true` karon
      // — i-set og `HOSPITAL_PORTAL_ENABLED=false` kung gusto nimo i-sirado
      // pag-usab (pananglitan sa usa ka demo nga walay blood-bank account).
      hospitalPortalEnabled: process.env.HOSPITAL_PORTAL_ENABLED !== 'false',

      // Ang mock data kay PATAY na by default para sa blood request workflow.
      //
      // Incoming Requests, Fulfillment ug Billing kay naa nay tinuod nga
      // endpoint, ug ang `useMockFulfillmentApi` composable gitangtang na.
      // Ang nahibilin nga mock kay Reports ug Drives ra — kadto pa ang walay
      // backend. I-set og `USE_MOCKS=true` kung kinahanglan nimo sila balikon
      // sa lokal nga dev.
      useMocks: process.env.USE_MOCKS === 'true'
    }
  },

  nitro: {
    devProxy: {
      '/api': {
        target: 'http://127.0.0.1:8000/api',
        changeOrigin: true,
      },
    },
  },
})
