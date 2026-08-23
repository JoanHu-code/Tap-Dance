import {
  requireAuth,
} from '../../../utils/authSession.js'

import {
  getTeacherAttendanceCourses,
  getTeacherAttendanceRoster,
  setTeacherAttendance,
} from '../../../services/attendanceRosterService.js'

export default defineEventHandler(
  async (
    event
  ) => {
    // ========================================================
    // Teacher Auth
    //
    // 唯一老師直接管理全部資料。
    // 不使用 Organization Membership。
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
          '只有老師可以管理出席紀錄',
      })
    }

    const method =
      String(
        event.method ||
        'GET'
      ).toUpperCase()

    // ========================================================
    // GET
    // ========================================================

    if (
      method ===
      'GET'
    ) {
      const query =
        getQuery(
          event
        )

      const courseId =
        String(
          query.courseId ||
          ''
        ).trim()

      const classDate =
        String(
          query.classDate ||
          ''
        ).trim()

      const courses =
        await getTeacherAttendanceCourses()

      // ======================================================
      // Initial request:
      // only return courses.
      // ======================================================

      if (
        !courseId ||
        !classDate
      ) {
        return {
          success: true,

          courses,

          roster:
            null,
        }
      }

      const roster =
        await getTeacherAttendanceRoster({
          courseId,

          classDate,
        })

      return {
        success: true,

        courses,

        roster,
      }
    }

    // ========================================================
    // POST
    // ========================================================

    if (
      method ===
      'POST'
    ) {
      const body =
        await readBody(
          event
        )

      const result =
        await setTeacherAttendance({
          courseId:
            body?.courseId,

          classDate:
            body?.classDate,

          studentId:
            body?.studentId,

          status:
            body?.status,

          note:
            body?.note,

          actorUserId:
            user.id,

          event,
        })

      return {
        success: true,

        message:
          '出席紀錄已更新',

        attendance:
          result.attendance,

        package:
          result.package,

        session:
          result.session,
      }
    }

    // ========================================================
    // Method Not Allowed
    // ========================================================

    throw createError({
      statusCode: 405,

      statusMessage:
        'Method Not Allowed',
    })
  }
)