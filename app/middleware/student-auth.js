export default defineNuxtRouteMiddleware(
  async (
    to
  ) => {
    // ========================================================
    // Student LIFF 登入入口
    // ========================================================

    if (
      to.path ===
      '/student' ||
      to.path ===
      '/student/'
    ) {
      return
    }

    const authStore =
      useAuthStore()

    // ========================================================
    // 如果 Store 尚未初始化
    // 或目前不是 STUDENT
    // 就向後端重新確認 Session
    // ========================================================

    if (
      !authStore
        .initialized ||
      !authStore
        .isStudent
    ) {
      const result =
        await authStore
          .fetchStudentMe({
            force: true,
          })

      if (
        !result?.success
      ) {
        return navigateTo(
          '/student'
        )
      }
    }

    // ========================================================
    // Role 再確認
    // ========================================================

    if (
      !authStore
        .isStudent
    ) {
      return navigateTo(
        '/student'
      )
    }

    // ========================================================
    // /student/link 是未綁定使用者可以進入的頁面
    // ========================================================

    if (
      to.path ===
      '/student/link' ||
      to.path ===
      '/student/link/'
    ) {
      // 已經綁定的人就不用再進綁定頁
      if (
        authStore
          .linked
      ) {
        return navigateTo(
          '/student'
        )
      }

      return
    }

    // ========================================================
    // 其他學生功能必須完成 students.user_id 綁定
    // ========================================================

    if (
      !authStore
        .linked
    ) {
      return navigateTo(
        '/student/link'
      )
    }
  }
)