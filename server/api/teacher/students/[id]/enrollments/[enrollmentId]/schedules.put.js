import {
  replaceEnrollmentSchedules,
} from '../../../../../../services/enrollmentService.js'

import {
  requireAuth,
} from '../../../../../../utils/authSession.js'

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
          '只有老師可以修改學生固定班別',
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
    //   scheduleIds: [
    //     "...",
    //     "..."
    //   ],
    //
    //   primaryScheduleId:
    //     "..."
    // }
    //
    // scheduleIds 可以 []，
    // 表示清除固定時段。
    // ========================================================

    const body =
      await readBody(
        event
      )

    if (
      !Array.isArray(
        body?.scheduleIds
      )
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          'scheduleIds 必須是陣列',
      })
    }

    const result =
      await replaceEnrollmentSchedules({
        studentId,

        enrollmentId,

        scheduleIds:
          body.scheduleIds,

        primaryScheduleId:
          body
            ?.primaryScheduleId,

        actorUserId:
          user.id,

        actorRole:
          'TEACHER',
      })

    return {
      success: true,

      message:
        '固定上課時段更新成功',

      enrollment:
        result.enrollment,

      schedules:
        result.schedules,

      primarySchedule:
        result.primarySchedule,
    }
  }
)