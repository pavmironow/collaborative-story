// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui'
  ],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    supabaseServiceRoleKey: '',
    openaiApiKey: '',
    /** Models are configurable so they can match what the account has access to. */
    openaiTextModel: 'gpt-5.5',
    openaiFastModel: 'gpt-5.4-mini',
    openaiImageModel: 'gpt-image-2',
    /** Optional: point the SDK at another endpoint (e.g. a proxy). */
    openaiBaseUrl: '',
    /** Total time for the AI merge incl. one retry; keep under the host's function timeout. */
    mergeBudgetMs: 20000,
    /** Time allowed for the cover image request; keep under the host's function timeout. */
    coverBudgetMs: 25000,
    public: {
      supabaseUrl: '',
      supabaseAnonKey: ''
    }
  },

  // Room pages depend on the browser session (localStorage) and live data: render on the client.
  routeRules: {
    '/r/**': { ssr: false },
    '/stories': { ssr: false }
  },

  compatibilityDate: '2026-06-30',

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },

  // Playful ink: rounded display headings, friendly body text (see main.css).
  fonts: {
    families: [
      { name: 'Nunito', weights: [400, 600, 700, 800] },
      { name: 'Baloo 2', weights: [500, 600, 700, 800] }
    ]
  }
})
