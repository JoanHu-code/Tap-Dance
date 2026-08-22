import {
  useDatabase,
} from '../../../../utils/db.js'

import {
  requireTeacherOrganization,
} from '../../../../utils/teacherAuth.js'

export default defineEventHandler(
  async (event) => {
    const {
      organization,
    } =
      await requireTeacherOrganization(
        event
      )

    const studentId =
      getRouterParam(
        event,
        'id'
      )

    const body =
      await readBody(event)

    const courseId =
      String(
        body?.courseId || ''
      ).trim()

    const defaultScheduleId =
      body?.defaultScheduleId
        ? String(
            body.defaultScheduleId
          )
        : null

    if (
      !studentId ||
      !courseId
    ) {
      throw createError({
        statusCode: 400,
        statusMessage:
          '課程資料不完整',
      })
    }

    const sql =
      useDatabase()

    // ========================================================
    // 確認學生屬於目前教室
    // ========================================================

    const students =
      await sql`
        SELECT id

        FROM students

        WHERE
          id =
            ${studentId}

          AND organization_id =
            ${organization.id}

        LIMIT 1
      `

    if (!students.length) {
      throw createError({
        statusCode: 404,
        statusMessage:
          '找不到這位學生',
      })
    }

    // ========================================================
    // 確認課程也屬於目前教室
    // ========================================================

    const courses =
      await sql`
        SELECT id

        FROM dance_courses

        WHERE
          id =
            ${courseId}

          AND organization_id =
            ${organization.id}

          AND status =
            'ACTIVE'

        LIMIT 1
      `

    if (!courses.length) {
      throw createError({
        statusCode: 404,
        statusMessage:
          '找不到這門課程',
      })
    }

    // ========================================================
    // 如果有指定時段
    // 必須確認這個時段屬於同一門課
    // ========================================================

    if (defaultScheduleId) {
      const schedules =
        await sql`
          SELECT id

          FROM class_schedules

          WHERE
            id =
              ${defaultScheduleId}

            AND course_id =
              ${courseId}

            AND status =
              'ACTIVE'

          LIMIT 1
        `

      if (!schedules.length) {
        throw createError({
          statusCode: 400,
          statusMessage:
            '預設時段不屬於這門課程',
        })
      }
    }

    // ========================================================
    // 已經加入過就更新
    // ========================================================

    const enrollments =
      await sql`
        INSERT INTO
          student_enrollments (
            student_id,
            course_id,
            default_schedule_id,
            status,
            joined_at
          )

        VALUES (
          ${studentId},
          ${courseId},
          ${defaultScheduleId},
          'ACTIVE',
          CURRENT_DATE
        )

        ON CONFLICT (
          student_id,
          course_id
        )

        DO UPDATE SET
          default_schedule_id =
            EXCLUDED.default_schedule_id,

          status =
            'ACTIVE'

        RETURNING *
      `

    return {
      success: true,

      message:
        '學生課程設定已儲存',

      enrollment:
        enrollments[0],
    }
  }
)