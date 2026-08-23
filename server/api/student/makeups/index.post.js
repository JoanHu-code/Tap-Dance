import {
  requireStudentContext,
} from '../../../utils/authContext.js'

import {
  createMakeup,
} from '../../../services/makeupService.js'

export default defineEventHandler(
  async (
    event
  ) => {
    // ========================================================
    // Student Auth
    // ========================================================

    const context =
      await requireStudentContext(
        event
      )

    const user =
      context.user

    const student =
      context.student

    // ========================================================
    // Body
    // ========================================================

    const body =
      await readBody(
        event
      )

    const sourceLeaveAttendanceId =
      String(
        body
          ?.sourceLeaveAttendanceId ||
        ''
      ).trim()

    const makeupDate =
      body?.makeupDate
        ? String(
            body.makeupDate
          ).trim()
        : null

    const makeupSessionId =
      body?.makeupSessionId
        ? String(
            body.makeupSessionId
          ).trim()
        : null

    // ========================================================
    // Validate
    // ========================================================

    if (
      !sourceLeaveAttendanceId
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '請選擇要補課的請假紀錄',
      })
    }

    if (
      !makeupDate &&
      !makeupSessionId
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '請選擇補課日期',
      })
    }

    // ========================================================
    // Create Makeup
    // ========================================================

    const result =
      await createMakeup({
        studentId:
          student.id,

        sourceLeaveAttendanceId,

        makeupDate,

        makeupSessionId,

        note:
          body?.note,

        actorUserId:
          user.id,

        actorRole:
          'STUDENT',

        event,
      })

    // ========================================================
    // Response
    // ========================================================

    return {
      success: true,

      message:
        '補課紀錄已建立，已累加 1 堂實際出席',

      makeup:
        result.makeup,

      attendance:
        result.attendance,

      package:
        result.package,

      targetSession:
        result.targetSession,
    }
  }
)