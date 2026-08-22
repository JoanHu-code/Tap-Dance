import {
  requireAuth,
} from '../../utils/authSession.js'

import {
  useDatabase,
} from '../../utils/db.js'

import {
  getStudentDashboard,
} from '../../services/dashboardService.js'

export default defineEventHandler(
  async (
    event
  ) => {
    // ========================================================
    // Auth
    // ========================================================

    const user =
      await requireAuth(
        event
      )

    if (
      user.role !==
      'STUDENT'
    ) {
      throw createError({
        statusCode: 403,

        statusMessage:
          '只有學生可以查看學生 Dashboard',
      })
    }

    const sql =
      useDatabase()

    // ========================================================
    // Login User → Student
    //
    // 不接受 studentId。
    // ========================================================

    const students =
      await sql`
        SELECT
          id,
          name,
          status

        FROM
          students

        WHERE
          user_id =
            ${user.id}

        LIMIT 1
      `

    if (
      !students.length
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '此 LINE 帳號尚未綁定學生資料',
      })
    }

    const student =
      students[0]

    if (
      student.status !==
      'ACTIVE'
    ) {
      throw createError({
        statusCode: 403,

        statusMessage:
          '學生資料目前未啟用',
      })
    }

    // ========================================================
    // Dashboard
    // ========================================================

    const dashboard =
      await getStudentDashboard(
        student.id
      )

    return {
      success: true,

      dashboard,
    }
  }
)