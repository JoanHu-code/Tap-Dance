import {
  useDatabase,
} from '../../../utils/db.js'

import {
  requireTeacherOrganization,
} from '../../../utils/teacherAuth.js'

export default defineEventHandler(
  async (event) => {
    const {
      user,
      organization,
    } =
      await requireTeacherOrganization(
        event
      )

    const body =
      await readBody(event)

    const courseId =
      String(
        body?.courseId || ''
      ).trim()

    const weekday =
      Number(
        body?.weekday
      )

    const startTime =
      String(
        body?.startTime || ''
      ).trim()

    const endTime =
      String(
        body?.endTime || ''
      ).trim()

    const name =
      String(
        body?.name || ''
      ).trim()

    const capacity =
      body?.capacity ===
        null ||
      body?.capacity ===
        undefined ||
      body?.capacity ===
        ''
        ? null
        : Number(
            body.capacity
          )

    if (!courseId) {
      throw createError({
        statusCode: 400,
        statusMessage:
          '請選擇課程',
      })
    }

    if (
      !Number.isInteger(
        weekday
      ) ||
      weekday < 1 ||
      weekday > 7
    ) {
      throw createError({
        statusCode: 400,
        statusMessage:
          '星期資料不正確',
      })
    }

    if (!startTime) {
      throw createError({
        statusCode: 400,
        statusMessage:
          '請設定開始時間',
      })
    }

    if (
      capacity !== null &&
      (
        !Number.isInteger(
          capacity
        ) ||
        capacity <= 0
      )
    ) {
      throw createError({
        statusCode: 400,
        statusMessage:
          '人數上限必須大於 0',
      })
    }

    const sql =
      useDatabase()

    const courses =
      await sql`
        SELECT id

        FROM dance_courses

        WHERE
          id =
            ${courseId}

          AND organization_id =
            ${organization.id}

        LIMIT 1
      `

    if (!courses.length) {
      throw createError({
        statusCode: 404,
        statusMessage:
          '找不到這門課程',
      })
    }

    const duplicated =
      await sql`
        SELECT id

        FROM class_schedules

        WHERE
          course_id =
            ${courseId}

          AND weekday =
            ${weekday}

          AND start_time =
            ${startTime}

          AND status =
            'ACTIVE'

        LIMIT 1
      `

    if (
      duplicated.length
    ) {
      throw createError({
        statusCode: 409,
        statusMessage:
          '這個時段已經存在',
      })
    }

    const schedules =
      await sql`
        INSERT INTO
          class_schedules (
            course_id,
            teacher_user_id,
            weekday,
            start_time,
            end_time,
            name,
            capacity,
            status
          )

        VALUES (
          ${courseId},
          ${user.id},
          ${weekday},
          ${startTime},
          ${
            endTime ||
            null
          },
          ${
            name ||
            null
          },
          ${capacity},
          'ACTIVE'
        )

        RETURNING
          id,
          course_id,
          weekday,
          start_time,
          end_time,
          name,
          capacity,
          status,
          teacher_user_id
      `

    const schedule =
      schedules[0]

    return {
      success: true,

      message:
        '課程時段已新增',

      schedule: {
        id:
          schedule.id,

        courseId:
          schedule.course_id,

        weekday:
          Number(
            schedule.weekday
          ),

        startTime:
          schedule.start_time,

        endTime:
          schedule.end_time,

        name:
          schedule.name,

        capacity:
          schedule.capacity,

        status:
          schedule.status,

        teacherUserId:
          schedule.teacher_user_id,
      },
    }
  }
)