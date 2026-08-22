import {
  requireAuth,
} from '../../../utils/authSession.js'

import {
  useDatabase,
} from '../../../utils/db.js'

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
          '只有學生可以使用學生端 Attendance',
      })
    }

    const sql =
      useDatabase()

    // ========================================================
    // Session → Student 本人
    //
    // 前端不能傳 studentId。
    // ========================================================

    const students =
      await sql`
        SELECT
          id,
          name,
          user_id,
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
    // 學生只能送：
    //
    // sessionId
    // status = ATTENDED / LEAVE
    // attendanceType = NORMAL / MAKEUP
    // note
    //
    // 不接受 studentId。
    // ========================================================

    const body =
      await readBody(
        event
      )

    const sessionId =
      String(
        body?.sessionId ||
        ''
      )
        .trim()

    if (!sessionId) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '缺少課堂 Session',
      })
    }

    if (!body?.status) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '請選擇 Attendance 狀態',
      })
    }

    const requestedType =
      String(
        body?.attendanceType ||
        'NORMAL'
      )
        .trim()
        .toUpperCase()

    // ========================================================
    // 學生端只允許：
    //
    // NORMAL
    // MAKEUP
    //
    // MANUAL 只有老師能建立。
    // ========================================================

    if (
      ![
        'NORMAL',
        'MAKEUP',
      ].includes(
        requestedType
      )
    ) {
      throw createError({
        statusCode: 403,

        statusMessage:
          '學生只能使用 NORMAL 或 MAKEUP',
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
        studentId:
          student.id,

        sessionId,

        status:
          body.status,

        attendanceType:
          requestedType,

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
        body.status ===
        'LEAVE'
          ? '請假紀錄建立成功'
          : '簽到成功',

      attendance:
        result.attendance,

      package:
        result.package,
    }
  }
)