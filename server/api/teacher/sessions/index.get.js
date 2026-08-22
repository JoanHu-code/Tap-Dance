import {
  requireAuth,
} from '../../../utils/authSession.js'

import {
  getTeacherSessions,
} from '../../../services/classSessionService.js'

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
      'TEACHER'
    ) {
      throw createError({
        statusCode: 403,

        statusMessage:
          '只有老師可以查看課堂管理',
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
      await getTeacherSessions({
        courseId:
          query.courseId,

        scheduleId:
          query.scheduleId,

        status:
          query.status,

        startDate:
          query.startDate,

        endDate:
          query.endDate,
      })

    return {
      success: true,

      today:
        result.today,

      filters:
        result.filters,

      summary:
        result.summary,

      sessions:
        result.sessions,

      courses:
        result.courses,

      schedules:
        result.schedules,
    }
  }
)