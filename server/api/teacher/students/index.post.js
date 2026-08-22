import {
  useDatabase,
} from '../../../utils/db.js'

import {
  requireAuth,
} from '../../../utils/authSession.js'

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
          '只有老師可以新增課程時段',
      })
    }

    const body =
      await readBody(event)

    const courseId =
      String(
        body?.courseId || ''
      )

    const weekday =
      Number(
        body?.weekday
      )

    const startTime =
      String(
        body?.startTime || ''
      )

    if (
      !courseId ||
      !Number.isInteger(
        weekday
      ) ||
      weekday < 1 ||
      weekday > 7 ||
      !startTime
    ) {
      throw createError({
        statusCode: 400,
        statusMessage:
          '課程時段資料不完整',
      })
    }

    const sql =
      useDatabase()

    const records =
      await sql`
        INSERT INTO
          class_schedules (
            course_id,
            teacher_user_id,
            weekday,
            start_time,
            end_time,
            name,
            capacity
          )

        VALUES (
          ${courseId},
          ${user.id},
          ${weekday},
          ${startTime},
          ${
            body?.endTime ||
            null
          },
          ${
            body?.name ||
            null
          },
          ${
            body?.capacity ||
            null
          }
        )

        RETURNING *
      `

    return {
      success: true,
      schedule:
        records[0],
    }
  }
)