import {
  requireAuth,
} from '../../../utils/authSession.js'

import {
  createMakeup,
} from '../../../services/makeupService.js'

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
          '只有老師可以使用老師端補課功能',
      })
    }

    // ========================================================
    // Body
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

    const sourceLeaveAttendanceId =
      String(
        body?.sourceLeaveAttendanceId ||
        ''
      )
        .trim()

    const makeupSessionId =
      String(
        body?.makeupSessionId ||
        ''
      )
        .trim()

    if (
      !studentId
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '請選擇學生',
      })
    }

    if (
      !sourceLeaveAttendanceId
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '請選擇要補的請假紀錄',
      })
    }

    if (
      !makeupSessionId
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '請選擇補課 Session',
      })
    }

    // ========================================================
    // Audit Metadata
    // ========================================================

    const auditMetadata =
      getAuditRequestMetadata(
        event
      )

    // ========================================================
    // Create
    // ========================================================

    const result =
      await createMakeup({
        studentId,

        sourceLeaveAttendanceId,

        makeupSessionId,

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
        '補課建立成功',

      makeup:
        result.makeup,

      attendance:
        result.attendance,

      package:
        result.package,
    }
  }
)