import {
  requireAuth,
} from '../../../utils/authSession.js'

import {
  createAttendance,
} from '../../../services/attendanceService.js'

import {
  getAuditRequestMetadata,
} from '../../../services/auditService.js'

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
          '只有老師可以使用老師端 Attendance',
      })
    }

    // ========================================================
    // Body
    //
    // {
    //   studentId,
    //   sessionId,
    //   status,
    //   attendanceType,
    //   note
    // }
    // ========================================================

    const body =
      await readBody(
        event
      )

    const studentId =
      String(
        body?.studentId ||
        ''
      )
        .trim()

    const sessionId =
      String(
        body?.sessionId ||
        ''
      )
        .trim()

    if (!studentId) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '請選擇學生',
      })
    }

    if (!sessionId) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '請選擇課堂 Session',
      })
    }

    if (!body?.status) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '請選擇 Attendance 狀態',
      })
    }

    // ========================================================
    // Request Metadata
    // ========================================================

    const auditMetadata =
      getAuditRequestMetadata(
        event
      )

    // ========================================================
    // Create
    // ========================================================

    const result =
      await createAttendance({
        studentId,

        sessionId,

        status:
          body.status,

        attendanceType:
          body?.attendanceType ||
          'NORMAL',

        note:
          body?.note,

        actorUserId:
          user.id,

        actorRole:
          'TEACHER',

        auditMetadata,
      })

    return {
      success: true,

      message:
        'Attendance 建立成功',

      attendance:
        result.attendance,

      package:
        result.package,
    }
  }
)