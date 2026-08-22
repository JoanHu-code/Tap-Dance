import {
  requireAuth,
} from '../../../../utils/authSession.js'

import {
  useDatabase,
} from '../../../../utils/db.js'

import {
  getAuditRequestMetadata,
} from '../../../../services/auditService.js'

import {
  renewPackageCycle,
} from '../../../../services/packageRenewService.js'

export default defineEventHandler(
  async (
    event
  ) => {
    // ========================================================
    // Auth
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
          '只有學生可以使用學生端 Package Renew',
      })
    }

    const sql =
      useDatabase()

    // ========================================================
    // Login User → Student
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
    // Package ID
    // ========================================================

    const packageId =
      String(
        getRouterParam(
          event,
          'id'
        ) ||
        ''
      ).trim()

    if (
      !packageId
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '缺少 Package ID',
      })
    }

    // ========================================================
    // Body
    //
    // 學生不能傳 totalSessions / price。
    //
    // paid：
    // 因為目前不串金流，
    // 是否要讓學生自己確認「已付款」取決於你的 UI。
    //
    // 這裡預設 true，
    // 後續老師仍可從 Audit 確認。
    // ========================================================

    const body =
      await readBody(
        event
      )

    if (
      body?.totalSessions !==
        undefined ||
      body?.price !==
        undefined
    ) {
      throw createError({
        statusCode: 403,

        statusMessage:
          '學生不能自行修改新一期堂數或價格',
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
    // Renew
    // ========================================================

    const result =
      await renewPackageCycle({
        packageId,

        actorUserId:
          user.id,

        actorRole:
          'STUDENT',

        studentId:
          student.id,

        paid:
          body?.paid ??
          true,

        auditMetadata,
      })

    return {
      success: true,

      message:
        `續期完成，已進入第 ${result.package?.cycle_no || ''} 期`,

      package:
        result.package,
    }
  }
)