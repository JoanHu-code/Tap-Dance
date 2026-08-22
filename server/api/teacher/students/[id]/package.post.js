import {
  useDatabase,
} from '../../../../utils/db.js'

import {
  requireAuth,
} from '../../../../utils/authSession.js'

export default defineEventHandler(
  async (event) => {
    const user =
      await requireAuth(event)

    if (
      user.role !== 'TEACHER'
    ) {
      throw createError({
        statusCode: 403,
        statusMessage:
          '只有老師可以設定學生方案',
      })
    }

    const studentId =
      getRouterParam(
        event,
        'id'
      )

    const body =
      await readBody(event)

    const totalSessions =
      Number(
        body?.totalSessions
      )

    const price =
      Number(
        body?.price
      )

    if (
      !studentId ||
      !body?.courseId ||
      !body?.startDate ||
      !Number.isInteger(
        totalSessions
      ) ||
      totalSessions <= 0 ||
      !Number.isFinite(
        price
      ) ||
      price < 0
    ) {
      throw createError({
        statusCode: 400,
        statusMessage:
          '方案資料不完整',
      })
    }

    const sql =
      useDatabase()

    const packages =
      await sql`
        INSERT INTO
          student_packages (
            student_id,
            course_id,
            start_date,
            total_sessions,
            price,
            bank_account_id
          )

        VALUES (
          ${studentId},
          ${body.courseId},
          ${body.startDate},
          ${totalSessions},
          ${price},
          ${
            body?.bankAccountId ||
            null
          }
        )

        RETURNING *
      `

    return {
      success: true,
      package:
        packages[0],
    }
  }
)