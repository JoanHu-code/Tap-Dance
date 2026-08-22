import {
  requireAuth,
} from '../../../utils/authSession.js'

import {
  getTeacherMakeups,
} from '../../../services/makeupService.js'

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
          '只有老師可以查看完整補課資料',
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
      await getTeacherMakeups({
        studentId:
          query.studentId ||
          null,

        courseId:
          query.courseId ||
          null,

        status:
          query.status ||
          null,
      })

    // ========================================================
    // Summary
    // ========================================================

    const summary = {
      total:
        result.makeups.length,

      active:
        result.makeups.filter(
          (
            makeup
          ) => {
            return (
              makeup.status ===
              'ACTIVE'
            )
          }
        ).length,

      cancelled:
        result.makeups.filter(
          (
            makeup
          ) => {
            return (
              makeup.status ===
              'CANCELLED'
            )
          }
        ).length,
    }

    return {
      success: true,

      summary,

      makeups:
        result.makeups,

      students:
        result.students,

      courses:
        result.courses,

      leaves:
        result.leaves,

      sessions:
        result.sessions,
    }
  }
)