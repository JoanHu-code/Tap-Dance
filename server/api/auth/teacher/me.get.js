export default defineEventHandler(
  async (
    event
  ) => {
    // ========================================================
    // Session 驗證
    // ========================================================

    const user =
      await requireAuth(
        event
      )

    // ========================================================
    // Role 驗證
    // ========================================================

    if (
      user.role !==
      'TEACHER'
    ) {
      throw createError({
        statusCode: 403,

        statusMessage:
          '目前登入帳號沒有老師權限',
      })
    }

    return {
      success: true,

      role:
        'TEACHER',

      user: {
        id:
          user.id,

        line_user_id:
          user.line_user_id,

        display_name:
          user.display_name,

        picture_url:
          user.picture_url,

        role:
          user.role,

        status:
          user.status,
      },
    }
  }
)