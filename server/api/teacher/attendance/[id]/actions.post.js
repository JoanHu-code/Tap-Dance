import {
  requireAuth,
} from '../../../../utils/authSession.js'

import {
  cancelAttendance,
  restoreAttendance,
} from '../../../../services/attendanceMutationService.js'

import {
  getAuditRequestMetadata,
} from '../../../../services/auditService.js'

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
          '只有老師可以使用老師端 Attendance 操作功能',
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
    //   action: 'CANCEL' | 'RESTORE',
    //   reason: '...'
    // }
    // ========================================================

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

    if (
      ![
        'CANCEL',
        'RESTORE',
      ].includes(
        action
      )
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          'action 只能是 CANCEL 或 RESTORE',
      })
    }

    const auditMetadata =
      getAuditRequestMetadata(
        event
      )

    // ========================================================
    // Cancel
    // ========================================================

    if (
      action ===
      'CANCEL'
    ) {
      const result =
        await cancelAttendance({
          attendanceId,

          reason:
            body?.reason,

          actorUserId:
            user.id,

          actorRole:
            'TEACHER',

          auditMetadata,
        })

      return {
        success: true,

        action:
          'CANCEL',

        message:
          'Attendance 已取消',

        attendance:
          result.attendance,

        package:
          result.package,
      }
    }

    // ========================================================
    // Restore
    // ========================================================

    const result =
      await restoreAttendance({
        attendanceId,

        reason:
          body?.reason,

        actorUserId:
          user.id,

        actorRole:
          'TEACHER',

        auditMetadata,
      })

    return {
      success: true,

      action:
        'RESTORE',

      message:
        'Attendance 已恢復',

      attendance:
        result.attendance,

      package:
        result.package,
    }
  }
)