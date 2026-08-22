import {
  requireAuth,
} from '../../../utils/authSession.js'

import {
  useDatabase,
} from '../../../utils/db.js'

import {
  getAuditRequestMetadata,
} from '../../../services/auditService.js'

import {
  updateLeaveBatchReason,
  cancelLeaveBatch,
  restoreLeaveBatch,
} from '../../../services/leaveMutationService.js'

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
          '只有學生可以使用學生端 Leave 修改功能',
      })
    }

    const sql =
      useDatabase()

    // ========================================================
    // Login → Student
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
    // Batch ID
    // ========================================================

    const batchId =
      String(
        getRouterParam(
          event,
          'id'
        ) || ''
      )
        .trim()

    if (
      !batchId
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '缺少 Leave Batch ID',
      })
    }

    // ========================================================
    // Body
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
        'UPDATE_REASON',
        'CANCEL',
        'RESTORE',
      ].includes(
        action
      )
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          'action 只能是 UPDATE_REASON、CANCEL 或 RESTORE',
      })
    }

    const auditMetadata =
      getAuditRequestMetadata(
        event
      )

    // ========================================================
    // Update Reason
    // ========================================================

    if (
      action ===
      'UPDATE_REASON'
    ) {
      if (
        body?.reason ===
        undefined
      ) {
        throw createError({
          statusCode: 400,

          statusMessage:
            '缺少新的請假原因',
        })
      }

      const batch =
        await updateLeaveBatchReason({
          batchId,

          reason:
            body.reason,

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
          'UPDATE_REASON',

        message:
          '請假原因已更新',

        batch,
      }
    }

    // ========================================================
    // Cancel
    // ========================================================

    if (
      action ===
      'CANCEL'
    ) {
      const result =
        await cancelLeaveBatch({
          batchId,

          actorUserId:
            user.id,

          actorRole:
            'STUDENT',

          studentId:
            student.id,

          reason:
            body?.reason,

          auditMetadata,
        })

      return {
        success: true,

        action:
          'CANCEL',

        message:
          '整批請假已取消',

        batch:
          result.batch,

        packages:
          result.packages,
      }
    }

    // ========================================================
    // Restore
    // ========================================================

    const result =
      await restoreLeaveBatch({
        batchId,

        actorUserId:
          user.id,

        actorRole:
          'STUDENT',

        studentId:
          student.id,

        reason:
          body?.reason,

        auditMetadata,
      })

    return {
      success: true,

      action:
        'RESTORE',

      message:
        '整批請假已恢復',

      batch:
        result.batch,

      packages:
        result.packages,
    }
  }
)