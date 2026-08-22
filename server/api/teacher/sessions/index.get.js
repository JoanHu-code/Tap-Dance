import {
  requireAuth,
} from '../../../utils/authSession.js'

import {
  getTeacherSessions,
} from '../../../services/sessionService.js'

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
          '只有老師可以查看完整課堂 Session',
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

    // ========================================================
    // Summary
    // ========================================================

    const summary = {
      total:
        result.records.length,

      scheduled:
        result.records.filter(
          (
            item
          ) => {
            return (
              item.status ===
              'SCHEDULED'
            )
          }
        ).length,

      completed:
        result.records.filter(
          (
            item
          ) => {
            return (
              item.status ===
              'COMPLETED'
            )
          }
        ).length,

      teacherLeave:
        result.records.filter(
          (
            item
          ) => {
            return (
              item.status ===
              'TEACHER_LEAVE'
            )
          }
        ).length,

      cancelled:
        result.records.filter(
          (
            item
          ) => {
            return (
              item.status ===
              'CANCELLED'
            )
          }
        ).length,
    }

    return {
      success: true,

      summary,

      sessions:
        result.records,

      courses:
        result.courses,

      schedules:
        result.schedules,
    }
  }
)