// https://nuxt.com/docs/api/configuration/nuxt-config
import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
    modules: ["@pinia/nuxt"],
  imports: {
    dirs: ["stores"],
  },
 runtimeConfig: {
    teacherLineChannelId: '',

    studentLineChannelId: '',

    public: {
      teacherLiffId: '',
      studentLiffId: '',
    },
  },
    app: {
    head: {
      title: 'TapLife 課程管理系統',

      meta: [
        {
          name: 'viewport',
          content: 'width=device-width, initial-scale=1',
        },
        {
          name: 'theme-color',
          content: '#ffffff',
        },
      ],
    },
  },
})
