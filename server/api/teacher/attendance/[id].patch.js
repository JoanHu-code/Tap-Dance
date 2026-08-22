import {
  requireAuth,
} from '../../../utils/authSession.js'

import {
  updateAttendance,
} from '../../../services/attendanceMutationService.js'

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
          '只有老師可以使用老師端 Attendance 修改功能',
      })
    }

    // ========================================================
    // Attendance ID
    // ========================================================

    const attendanceId =
      String(
        getRouterParam(
          event,
          'id'
        ) || ''
      )
        .trim()

    if (!attendanceId) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '缺少 Attendance ID',
      })
    }

    // ========================================================
    // Body
    //
    // {
    //   status: 'ATTENDED' | 'LEAVE' | 'ABSENT',
    //   note: '...'
    // }
    //
    // status / note 至少一個。
    // ========================================================

    const body =
      await readBody(
        event
      )

    if (
      body?.status ===
        undefined &&
      body?.note ===
        undefined
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '沒有需要修改的 Attendance 資料',
      })
    }

    const auditMetadata =
      getAuditRequestMetadata(
        event
      )

    const result =
      await updateAttendance({
        attendanceId,

        status:
          body?.status,

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
        'Attendance 更新成功',

      attendance:
        result.attendance,

      package:
        result.package,
    }
  }
)