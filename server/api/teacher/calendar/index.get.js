import {
  requireAuth,
} from '../../../utils/authSession.js'

import {
  getTeacherCalendar,
} from '../../../services/calendarService.js'

export default defineEventHandler(
  async (
    event
  ) => {
    // ========================================================
    // Teacher Auth
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
          '只有老師可以查看完整課堂行事曆',
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
      await getTeacherCalendar({
        startDate:
          query.startDate,

        endDate:
          query.endDate,

        courseId:
          query.courseId,

        scheduleId:
          query.scheduleId,
      })

    return {
      success: true,

      range:
        result.range,

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