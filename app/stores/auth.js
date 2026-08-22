import {
  defineStore,
} from 'pinia'

export const useAuthStore =
  defineStore(
    'auth',
    {
      state: () => ({
        user: null,

        authenticated: false,

        initialized: false,

        loading: false,

        error: null,
      }),

      getters: {
        isStudent:
          (state) =>
            state.user?.role ===
            'STUDENT',

        isTeacher:
          (state) =>
            state.user?.role ===
            'TEACHER',
      },

      actions: {
        async checkSession() {
          try {
            const data =
              await $fetch(
                '/api/auth/me'
              )

            this.authenticated =
              data.authenticated

            this.user =
              data.user
          } catch {
            this.authenticated =
              false

            this.user =
              null
          }
        },

        async loginWithLineToken(
          idToken
        ) {
          const result =
            await $fetch(
              '/api/auth/line',
              {
                method:
                  'POST',

                body: {
                  idToken,
                },
              }
            )

          if (
            result.authorized
          ) {
            this.authenticated =
              true

            this.user =
              result.user
          } else {
            this.authenticated =
              false

            this.user =
              null
          }

          return result
        },

        async logout() {
          await $fetch(
            '/api/auth/logout',
            {
              method:
                'POST',
            }
          )

          this.authenticated =
            false

          this.user =
            null
        },
      },
    }
  )