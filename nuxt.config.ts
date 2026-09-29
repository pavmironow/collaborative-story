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
    anthropicApiKey: '',
    anthropicModel: 'claude-opus-5-5',
    /** Optional: point the SDK at another endpoint (e.g. a proxy). */
    anthropicBaseUrl: '',
    public: {
      supabaseUrl: '',
      supabaseAnonKey: ''
    }
  },

  // Room pages depend on the browser session (localStorage) and live data: render on the client.
  routeRules: {
    '/r/**': { ssr: false }
  },

  compatibilityDate: '2026-06-30',

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
