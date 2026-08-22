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

    const scheduleId =
      getRouterParam(
        event,
        'id'
      )

    const body =
      await readBody(event)

    const status =
      String(
        body?.status || ''
      )
        .trim()
        .toUpperCase()

    if (
      ![
        'ACTIVE',
        'INACTIVE',
      ].includes(status)
    ) {
      throw createError({
        statusCode: 400,
        statusMessage:
          '時段狀態不正確',
      })
    }

    const sql =
      useDatabase()

    const schedules =
      await sql`
        UPDATE
          class_schedules cs

        SET
          status =
            ${status},

          updated_at =
            NOW()

        FROM dance_courses dc

        WHERE
          cs.id =
            ${scheduleId}

          AND dc.id =
            cs.course_id

          AND dc.organization_id =
            ${organization.id}

        RETURNING
          cs.id,
          cs.status
      `

    if (!schedules.length) {
      throw createError({
        statusCode: 404,
        statusMessage:
          '找不到這個課程時段',
      })
    }

    return {
      success: true,

      message:
        status ===
        'ACTIVE'
          ? '時段已啟用'
          : '時段已停用',
    }
  }
)