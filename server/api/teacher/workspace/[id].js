import {
  requireAuth,
} from '../../../utils/authSession.js'

import {
  createSimpleStudentPackage,
  getTeacherStudentWorkspace,
  recordSimpleAttendance,
  resetStudentPackage,
} from '../../../services/teacherStudentWorkspaceService.js'

export default defineEventHandler(
  async (
    event
  ) => {
    // ========================================================
    // Teacher
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
          '只有老師可以操作學生資料',
      })
    }

    // ========================================================
    // Student ID
    // ========================================================

    const studentId =
      String(
        getRouterParam(
          event,
          'id'
        ) ||
        ''
      ).trim()

    if (
      !studentId
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '缺少 Student ID',
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
      const result =
        await getTeacherStudentWorkspace(
          studentId
        )

      return {
        success: true,

        ...result,
      }
    }

    // ========================================================
    // POST
    // ========================================================

    if (
      method !==
      'POST'
    ) {
      throw createError({
        statusCode: 405,

        statusMessage:
          'Method Not Allowed',
      })
    }

    const body =
      await readBody(
        event
      )

    const action =
      String(
        body?.action ||
        ''
      )
        .trim()
        .toUpperCase()

    // ========================================================
    // CREATE PACKAGE
    // ========================================================

    if (
      action ===
      'CREATE_PACKAGE'
    ) {
      const packageData =
        await createSimpleStudentPackage({
          studentId,

          courseId:
            body?.courseId,

          startDate:
            body?.startDate,

          purchasedCycles:
            body?.purchasedCycles,

          paid:
            body?.paid ??
            true,

          actorUserId:
            user.id,

          event,
        })

      return {
        success: true,

        message:
          '學生方案已建立',

        package:
          packageData,
      }
    }

    // ========================================================
    // ATTENDANCE
    // ========================================================

    if (
      action ===
      'ATTENDANCE'
    ) {
      const result =
        await recordSimpleAttendance({
          studentId,

          courseId:
            body?.courseId,

          classDate:
            body?.classDate,

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
          String(
            body?.status
          )
            .toUpperCase() ===
            'ATTENDED'
            ? '簽到完成'
            : '請假完成',

        attendance:
          result.attendance,

        package:
          result.package,
      }
    }

    // ========================================================
    // RESET PACKAGE
    // ========================================================

    if (
      action ===
      'RESET_PACKAGE'
    ) {
      const packageData =
        await resetStudentPackage({
          studentId,

          packageId:
            body?.packageId,

          purchasedCycles:
            body?.purchasedCycles,

          startDate:
            body?.startDate,

          paid:
            body?.paid ??
            true,

          actorUserId:
            user.id,

          event,
        })

      return {
        success: true,

        message:
          '上一輪已完成，新一輪已開始',

        package:
          packageData,
      }
    }

    throw createError({
      statusCode: 400,

      statusMessage:
        '不支援的學生操作',
    })
  }
)