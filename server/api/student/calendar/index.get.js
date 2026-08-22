import {
  requireAuth,
} from '../../../utils/authSession.js'

import {
  useDatabase,
} from '../../../utils/db.js'

import {
  getStudentCalendar,
} from '../../../services/calendarService.js'

export default defineEventHandler(
  async (
    event
  ) => {
    // ========================================================
    // Student Auth
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
          '只有學生可以查看學生課表',
      })
    }

    const sql =
      useDatabase()

    // ========================================================
    // Login User → Student
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
    // Query
    // ========================================================

    const query =
      getQuery(
        event
      )

    const result =
      await getStudentCalendar({
        studentId:
          student.id,

        startDate:
          query.startDate,

        endDate:
          query.endDate,
      })

    return {
      success: true,

      student:
        result.student,

      range:
        result.range,

      summary:
        result.summary,

      nextClass:
        result.nextClass,

      upcomingTeacherLeaves:
        result
          .upcomingTeacherLeaves,

      courses:
        result.courses,

      sessions:
        result.sessions,
    }
  }
)