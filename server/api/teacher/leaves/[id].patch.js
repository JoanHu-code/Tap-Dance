import {
  requireAuth,
} from '../../../utils/authSession.js'

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
          '只有老師可以使用老師端 Leave 修改功能',
      })
    }

    // ========================================================
    // Leave Batch ID
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
            'TEACHER',

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
            'TEACHER',

          reason:
            body?.reason,

          auditMetadata,
        })

      return {
        success: true,

        action:
          'CANCEL',

        message:
          '整批請假已取消，Attendance 已同步還原',

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
          'TEACHER',

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