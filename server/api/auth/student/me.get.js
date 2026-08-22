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
      'STUDENT'
    ) {
      throw createError({
        statusCode: 403,

        statusMessage:
          '目前登入帳號沒有學生權限',
      })
    }

    const sql =
      useDatabase()

    // ========================================================
    // 從登入者 app_users.id 反查自己的學生資料
    //
    // 不接受前端傳 studentId
    // ========================================================

    const students =
      await sql`
        SELECT
          *

        FROM students

        WHERE
          user_id =
            ${user.id}

        LIMIT 1
      `

    // ========================================================
    // 尚未綁定學生主檔
    // ========================================================

    if (
      !students.length
    ) {
      return {
        success: true,

        role:
          'STUDENT',

        linked:
          false,

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

        student:
          null,
      }
    }

    const student =
      students[0]

    // ========================================================
    // 已完成 students.user_id 綁定
    // ========================================================

    return {
      success: true,

      role:
        'STUDENT',

      linked:
        true,

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

      student,
    }
  }
)