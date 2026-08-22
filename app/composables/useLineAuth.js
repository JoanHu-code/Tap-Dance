import {
  storeToRefs,
} from 'pinia'

export const useLineAuth =
  () => {
    const authStore =
      useAuthStore()

    const {
      user,
      authenticated,
      initialized,
      loading,
      error,
    } = storeToRefs(
      authStore
    )

    const initializeLineAuth =
      async () => {
        if (
          import.meta.server
        ) {
          return false
        }

        loading.value =
          true

        error.value =
          null

        try {
          // --------------------------------------------------
          // 先看看自己的 Session 還在不在
          // --------------------------------------------------

          await authStore
            .checkSession()

          if (
            authenticated.value
          ) {
            initialized.value =
              true

            return true
          }

          const {
            $liff,
          } = useNuxtApp()

          if (!$liff) {
            throw new Error(
              'LIFF 尚未初始化'
            )
          }

          // --------------------------------------------------
          // 尚未登入 LINE
          // --------------------------------------------------

          if (
            !$liff.isLoggedIn()
          ) {
            $liff.login({
              redirectUri:
                window.location.href,
            })

            return false
          }

          // --------------------------------------------------
          // 取得 ID Token
          // --------------------------------------------------

          const idToken =
            $liff.getIDToken()

          if (!idToken) {
            throw new Error(
              '無法取得 LINE ID Token'
            )
          }

          // --------------------------------------------------
          // 交給後端驗證
          // --------------------------------------------------

          const result =
            await authStore
              .loginWithLineToken(
                idToken,
                new URLSearchParams(
                  window.location.search
                ).get('link')
              )

          if (
            !result.authorized
          ) {
            error.value =
              result.message

            initialized.value =
              true

            return false
          }

          initialized.value =
            true

          return true
        } catch (err) {
          console.error(
            'LINE 登入失敗：',
            err
          )

          error.value =
            err?.data
              ?.statusMessage ||
            err?.message ||
            'LINE 登入失敗'

          initialized.value =
            true

          return false
        } finally {
          loading.value =
            false
        }
      }

    return {
      user,
      authenticated,
      initialized,
      loading,
      error,

      initializeLineAuth,
    }
  }
