import {
  requireAuth,
} from '../../../utils/authSession.js'

import {
  useDatabase,
} from '../../../utils/db.js'

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
          '只有學生可以使用學生端補課功能',
      })
    }

    const sql =
      useDatabase()

    // ========================================================
    // Login User → Student
    //
    // 前端不接受 studentId。
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
    // Body
    //
    // {
    //   sourceLeaveAttendanceId,
    //   makeupSessionId,
    //   note
    // }
    //
    // 沒有 studentId。
    // ========================================================

    const body =
      await readBody(
        event
      )

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
        studentId:
          student.id,

        sourceLeaveAttendanceId,

        makeupSessionId,

        note:
          body?.note,

        actorUserId:
          user.id,

        actorRole:
          'STUDENT',

        auditMetadata,
      })

    return {
      success: true,

      message:
        '補課安排成功',

      makeup:
        result.makeup,

      attendance:
        result.attendance,

      package:
        result.package,
    }
  }
)