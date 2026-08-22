import liff from '@line/liff'

export default defineNuxtPlugin(
  async () => {
    const config =
      useRuntimeConfig()

    const liffId =
      config.public.liffId

    if (!liffId) {
      console.error(
        '找不到 NUXT_PUBLIC_LIFF_ID'
      )

      return {
        provide: {
          liff: null,
        },
      }
    }

    try {
      await liff.init({
        liffId,
      })
    } catch (error) {
      console.error(
        'LIFF 初始化失敗：',
        error
      )
    }

    return {
      provide: {
        liff,
      },
    }
  }
)