import {
  requireAuth,
} from '../../../utils/authSession.js'

import {
  useDatabase,
} from '../../../utils/db.js'

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
          '只有學生可以使用學生端 Attendance 修改功能',
      })
    }

    const sql =
      useDatabase()

    // ========================================================
    // 找目前登入學生本人
    //
    // 不接受前端 studentId。
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
    //   status: 'ATTENDED' | 'LEAVE',
    //   note: '...'
    // }
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
          'STUDENT',

        studentId:
          student.id,

        auditMetadata,
      })

    return {
      success: true,

      message:
        '上課紀錄更新成功',

      attendance:
        result.attendance,

      package:
        result.package,
    }
  }
)