import {
  requireAuth,
} from '../../../utils/authSession.js'

import {
  getTeacherAttendancePageData,
} from '../../../services/attendanceQueryService.js'

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
          '只有老師可以查看完整 Attendance',
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
      await getTeacherAttendancePageData({
        studentId:
          query.studentId,

        courseId:
          query.courseId,

        status:
          query.status,

        attendanceType:
          query.attendanceType,

        startDate:
          query.startDate,

        endDate:
          query.endDate,

        keyword:
          query.keyword,
      })

    // ========================================================
    // Summary
    // ========================================================

    const summary = {
      total:
        result.records.length,

      attended:
        result.records.filter(
          (
            item
          ) =>
            item.status ===
            'ATTENDED'
        ).length,

      leave:
        result.records.filter(
          (
            item
          ) =>
            item.status ===
            'LEAVE'
        ).length,

      absent:
        result.records.filter(
          (
            item
          ) =>
            item.status ===
            'ABSENT'
        ).length,

      cancelled:
        result.records.filter(
          (
            item
          ) =>
            item.status ===
            'CANCELLED'
        ).length,
    }

    return {
      success: true,

      summary,

      records:
        result.records,

      students:
        result.students,

      courses:
        result.courses,

      sessions:
        result.sessions,
    }
  }
)