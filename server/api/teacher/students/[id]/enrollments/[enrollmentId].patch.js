import {
  updateStudentEnrollment,
} from '../../../../../services/enrollmentService.js'

import {
  requireAuth,
} from '../../../../../utils/authSession.js'

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
          '只有老師可以修改學生 Enrollment',
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
        ) || ''
      )
        .trim()

    if (!studentId) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '缺少學生 ID',
      })
    }

    // ========================================================
    // Enrollment ID
    // ========================================================

    const enrollmentId =
      String(
        getRouterParam(
          event,
          'enrollmentId'
        ) || ''
      )
        .trim()

    if (!enrollmentId) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '缺少 Enrollment ID',
      })
    }

    // ========================================================
    // Body
    //
    // {
    //   status,
    //   defaultScheduleId
    // }
    // ========================================================

    const body =
      await readBody(
        event
      )

    if (
      body?.status ===
        undefined &&
      body?.defaultScheduleId ===
        undefined
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '沒有需要修改的 Enrollment 資料',
      })
    }

    const enrollment =
      await updateStudentEnrollment({
        studentId,

        enrollmentId,

        status:
          body?.status,

        defaultScheduleId:
          body
            ?.defaultScheduleId,

        actorUserId:
          user.id,

        actorRole:
          'TEACHER',
      })

    return {
      success: true,

      message:
        'Enrollment 更新成功',

      enrollment,
    }
  }
)