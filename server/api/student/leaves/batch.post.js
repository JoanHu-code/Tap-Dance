import {
  requireAuth,
} from '../../../utils/authSession.js'

import {
  useDatabase,
} from '../../../utils/db.js'

import {
  createLeaveBatch,
} from '../../../services/leaveService.js'

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
          '只有學生可以使用學生端請假功能',
      })
    }

    const sql =
      useDatabase()

    // ========================================================
    // Login User → Student
    //
    // 不接受 studentId。
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
    // {
    //   sessionIds: [],
    //   reason: ''
    // }
    //
    // 沒有 studentId。
    // ========================================================

    const body =
      await readBody(
        event
      )

    if (
      !Array.isArray(
        body?.sessionIds
      ) ||
      !body.sessionIds.length
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '請至少選擇一堂課',
      })
    }

    const auditMetadata =
      getAuditRequestMetadata(
        event
      )

    const result =
      await createLeaveBatch({
        studentId:
          student.id,

        sessionIds:
          body.sessionIds,

        reason:
          body?.reason,

        actorUserId:
          user.id,

        actorRole:
          'STUDENT',

        auditMetadata,
      })

    return {
      success: true,

      message:
        result.items.length > 1
          ? `批次請假完成，共 ${result.items.length} 堂`
          : '請假完成',

      batch:
        result.batch,

      items:
        result.items,

      packages:
        result.packages,
    }
  }
)