import {
  defineStore,
} from 'pinia'

export const useAuthStore =
  defineStore(
    'auth',
    () => {
      // ======================================================
      // State
      // ======================================================

      const user =
        ref(null)

      const role =
        ref(null)

      const student =
        ref(null)

      const linked =
        ref(false)

      const initialized =
        ref(false)

      const loading =
        ref(false)

      const error =
        ref(null)

      // ======================================================
      // Computed
      // ======================================================

      const isAuthenticated =
        computed(() => {
          return Boolean(
            user.value
          )
        })

      const isTeacher =
        computed(() => {
          return (
            role.value ===
            'TEACHER'
          )
        })

      const isStudent =
        computed(() => {
          return (
            role.value ===
            'STUDENT'
          )
        })

      const displayName =
        computed(() => {
          return (
            student.value
              ?.name ||
            user.value
              ?.display_name ||
            ''
          )
        })

      const pictureUrl =
        computed(() => {
          return (
            user.value
              ?.picture_url ||
            null
          )
        })

      // ======================================================
      // 清除登入狀態
      // ======================================================

      const clearAuth = () => {
        user.value = null

        role.value = null

        student.value = null

        linked.value = false

        initialized.value =
          false

        error.value = null
      }

      // ======================================================
      // 設定 Auth
      // ======================================================

      const setAuth = (
        payload
      ) => {
        user.value =
          payload?.user ||
          null

        role.value =
          payload?.role ||
          payload?.user
            ?.role ||
          null

        student.value =
          payload?.student ||
          null

        linked.value =
          Boolean(
            payload?.linked
          )

        initialized.value =
          true

        error.value = null
      }

      // ======================================================
      // 取得 SSR Cookie Header
      // ======================================================

      const getRequestOptions =
        () => {
          if (
            import.meta.client
          ) {
            return {}
          }

          const headers =
            useRequestHeaders([
              'cookie',
            ])

          return {
            headers,
          }
        }

      // ======================================================
      // 檢查老師 Session
      // ======================================================

      const fetchTeacherMe =
        async ({
          force = false,
        } = {}) => {
          if (
            loading.value
          ) {
            return {
              success: false,
            }
          }

          if (
            !force &&
            initialized.value &&
            isTeacher.value
          ) {
            return {
              success: true,

              user:
                user.value,

              role:
                role.value,
            }
          }

          loading.value = true

          error.value = null

          try {
            const response =
              await $fetch(
                '/api/auth/teacher/me',
                getRequestOptions()
              )

            setAuth(
              response
            )

            return response
          } catch (
            requestError
          ) {
            clearAuth()

            error.value =
              requestError

            return {
              success: false,

              error:
                requestError,
            }
          } finally {
            loading.value =
              false
          }
        }

      // ======================================================
      // 檢查學生 Session
      // ======================================================

      const fetchStudentMe =
        async ({
          force = false,
        } = {}) => {
          if (
            loading.value
          ) {
            return {
              success: false,
            }
          }

          if (
            !force &&
            initialized.value &&
            isStudent.value
          ) {
            return {
              success: true,

              user:
                user.value,

              role:
                role.value,

              student:
                student.value,

              linked:
                linked.value,
            }
          }

          loading.value = true

          error.value = null

          try {
            const response =
              await $fetch(
                '/api/auth/student/me',
                getRequestOptions()
              )

            setAuth(
              response
            )

            return response
          } catch (
            requestError
          ) {
            clearAuth()

            error.value =
              requestError

            return {
              success: false,

              error:
                requestError,
            }
          } finally {
            loading.value =
              false
          }
        }

      // ======================================================
      // Teacher LIFF 登入完成後寫入 Store
      // ======================================================

      const setTeacherLogin =
        (
          payload
        ) => {
          setAuth({
            user:
              payload?.user,

            role:
              'TEACHER',

            linked:
              false,

            student:
              null,
          })
        }

      // ======================================================
      // Student LIFF 登入完成後寫入 Store
      // ======================================================

      const setStudentLogin =
        (
          payload
        ) => {
          setAuth({
            user:
              payload?.user,

            role:
              'STUDENT',

            linked:
              payload
                ?.linked,

            student:
              payload
                ?.student,
          })
        }

      // ======================================================
      // 登出
      // ======================================================

      const logout =
        async () => {
          const currentRole =
            role.value

          try {
            await $fetch(
              '/api/auth/logout',
              {
                method: 'POST',
              }
            )
          } catch (
            requestError
          ) {
            console.error(
              '登出 Session 失敗：',
              requestError
            )
          }

          clearAuth()

          if (
            import.meta.client
          ) {
            try {
              const {
                $liff,
              } =
                useNuxtApp()

              if (
                $liff
                  ?.isLoggedIn?.()
              ) {
                $liff.logout()
              }
            } catch (
              liffError
            ) {
              console.error(
                'LIFF 登出失敗：',
                liffError
              )
            }
          }

          if (
            currentRole ===
            'TEACHER'
          ) {
            return navigateTo(
              '/teacher'
            )
          }

          return navigateTo(
            '/student'
          )
        }

      // ======================================================
      // Return
      // ======================================================

      return {
        user,

        role,

        student,

        linked,

        initialized,

        loading,

        error,

        isAuthenticated,

        isTeacher,

        isStudent,

        displayName,

        pictureUrl,

        clearAuth,

        setAuth,

        setTeacherLogin,

        setStudentLogin,

        fetchTeacherMe,

        fetchStudentMe,

        logout,
      }
    }
  )