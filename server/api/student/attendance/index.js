import {
  requireStudentContext,
} from '../../../utils/authContext.js'

import {
  createStudentAttendance,
  getStudentAttendanceData,
} from '../../../services/studentAttendanceService.js'

export default defineEventHandler(
  async (
    event
  ) => {
    // ========================================================
    // Student Auth
    //
    // Student ID 一律從登入帳號解析。
    // 不接受前端指定其他學生。
    // ========================================================

    const context =
      await requireStudentContext(
        event
      )

    const user =
      context.user

    const student =
      context.student

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

      const result =
        await getStudentAttendanceData({
          studentId:
            student.id,

          status:
            query.status ||
            null,

          courseId:
            query.courseId ||
            null,

          startDate:
            query.startDate ||
            null,

          endDate:
            query.endDate ||
            null,
        })

      return {
        success: true,

        student:
          result.student,

        courses:
          result.courses,

        activePackages:
          result.activePackages,

        attendance:
          result.attendance,
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

      const courseId =
        String(
          body?.courseId ||
          ''
        ).trim()

      const classDate =
        String(
          body?.classDate ||
          ''
        ).trim()

      const status =
        String(
          body?.status ||
          ''
        )
          .trim()
          .toUpperCase()

      if (
        !courseId
      ) {
        throw createError({
          statusCode: 400,

          statusMessage:
            '請選擇課堂',
        })
      }

      if (
        !classDate
      ) {
        throw createError({
          statusCode: 400,

          statusMessage:
            '請選擇日期',
        })
      }

      if (
        !status
      ) {
        throw createError({
          statusCode: 400,

          statusMessage:
            '請選擇出席狀態',
        })
      }

      const result =
        await createStudentAttendance({
          studentId:
            student.id,

          courseId,

          classDate,

          status,

          note:
            body?.note,

          actorUserId:
            user.id,

          event,
        })

      return {
        success: true,

        message:
          '出席紀錄已建立',

        attendance:
          result.attendance,

        package:
          result.package,

        session:
          result.session,
      }
    }

    throw createError({
      statusCode: 405,

      statusMessage:
        'Method Not Allowed',
    })
  }
)