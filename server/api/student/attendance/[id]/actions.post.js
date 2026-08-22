import {
  requireAuth,
} from '../../../../utils/authSession.js'

import {
  useDatabase,
} from '../../../../utils/db.js'

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
    // Student Auth
    // ========================================================

    const user =
      await requireAuth(
        event
      )

    if (
      user.role !==
      'STUDENT'
    ) {
      throw createError({
        statusCode: 403,

        statusMessage:
          '只有學生可以使用學生端 Attendance 操作功能',
      })
    }

    const sql =
      useDatabase()

    // ========================================================
    // Session → Student
    //
    // 不接受 studentId。
    // ========================================================

    const students =
      await sql`
        SELECT
          id,
          name,
          status

        FROM
          students

        WHERE
          user_id =
            ${user.id}

        LIMIT 1
      `

    if (
      !students.length
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '此 LINE 帳號尚未綁定學生資料',
      })
    }

    const student =
      students[0]

    if (
      student.status !==
      'ACTIVE'
    ) {
      throw createError({
        statusCode: 403,

        statusMessage:
          '學生資料目前未啟用',
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
            'STUDENT',

          studentId:
            student.id,

          auditMetadata,
        })

      return {
        success: true,

        action:
          'CANCEL',

        message:
          '紀錄已取消',

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
          'STUDENT',

        studentId:
          student.id,

        auditMetadata,
      })

    return {
      success: true,

      action:
        'RESTORE',

      message:
        '紀錄已恢復',

      attendance:
        result.attendance,

      package:
        result.package,
    }
  }
)