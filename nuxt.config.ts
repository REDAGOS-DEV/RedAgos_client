// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss'],
  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    public: {
      // Kung wala ni na-set, ang BaseService na ang mo-derive sa host gikan
      // sa browser. Sa deploy, i-set ang NUXT_PUBLIC_API_BASE_URL.
      apiBaseURL: process.env.API_BASE_URL || '',

      // Ang hospital / blood-bank portal kay naka-off hangtod naa nay backend.
      // Walay `/hospital/*` nga route ang Laravel karon ug walay registration
      // endpoint para sa blood bank, so ang mga page mo-render og shell unya
      // mo-404 ang tanan nga call. I-on ra ni kung human na ang Phase P.
      // Set NUXT_PUBLIC_HOSPITAL_PORTAL_ENABLED=true para i-abli.
      hospitalPortalEnabled: process.env.HOSPITAL_PORTAL_ENABLED === 'true',

      // Ang Reports, Fulfillment, Incoming Requests, Billing ug Drives kay walay
      // backend gihapon — walay katugbang nga route sa Laravel. Nagdagan sila sa
      // fixture data. Default `true` kay kon i-off nimo karon, blangko ang mga
      // page; ang punto sa flag kay makita ug ma-flip ang mock, dili nga tago.
      //
      // I-set og false kada domain nga mahuman, ug tangtangon ni sa dihang wala
      // nay mock. Tan-awa ang endpoint matrix para sa kinsa ang nag-utang unsa.
      useMocks: process.env.USE_MOCKS !== 'false'
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
