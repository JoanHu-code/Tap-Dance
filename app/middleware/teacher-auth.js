export default defineNuxtRouteMiddleware(
  async (
    to
  ) => {
    // ========================================================
    // /teacher 本身就是 Teacher LIFF 登入入口
    // 不進行 Session 攔截
    // ========================================================

    if (
      to.path ===
      '/teacher' ||
      to.path ===
      '/teacher/'
    ) {
      return
    }

    const authStore =
      useAuthStore()

    // ========================================================
    // 如果 Store 已經確認是老師
    // 不重新打 API
    // ========================================================

    if (
      authStore
        .initialized &&
      authStore
        .isTeacher
    ) {
      return
    }

    // ========================================================
    // 透過 Session Cookie 向後端確認
    // ========================================================

    const result =
      await authStore
        .fetchTeacherMe({
          force: true,
        })

    if (
      !result?.success
    ) {
      return navigateTo(
        '/teacher'
      )
    }

    // ========================================================
    // 最後再確認一次 Role
    // ========================================================

    if (
      !authStore
        .isTeacher
    ) {
      return navigateTo(
        '/teacher'
      )
    }
  }
)