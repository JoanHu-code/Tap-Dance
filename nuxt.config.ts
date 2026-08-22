// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
    modules: ["@pinia/nuxt"],
  imports: {
    dirs: ["stores"],
  },
    runtimeConfig: {
      lineChannelId:
        process.env.LINE_CHANNEL_ID,
    public: {
      liffId: process.env.NUXT_PUBLIC_LIFF_ID,
    },
  },
})
