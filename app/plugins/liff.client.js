import liff from '@line/liff'

export default defineNuxtPlugin(
  async () => {
    const config =
      useRuntimeConfig()

    const liffId =
      config.public.liffId

    console.log(
      'LIFF ID loaded:',
      Boolean(liffId)
    )

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

      console.log(
        'LIFF 初始化成功'
      )
    } catch (error) {
      console.error(
        'LIFF 初始化失敗：',
        error
      )

      return {
        provide: {
          liff: null,
        },
      }
    }

    return {
      provide: {
        liff,
      },
    }
  }
)