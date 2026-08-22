import {
  requireAuth,
} from '../../../utils/authSession.js'

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
          '只有老師可以使用老師端請假功能',
      })
    }

    // ========================================================
    // Body
    //
    // {
    //   studentId,
    //
    //   sessionIds: [
    //     "...",
    //     "..."
    //   ],
    //
    //   reason:
    //     "出國"
    // }
    // ========================================================

    const body =
      await readBody(
        event
      )

    const studentId =
      String(
        body?.studentId ||
        ''
      )
        .trim()

    if (
      !studentId
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '請選擇學生',
      })
    }

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
        studentId,

        sessionIds:
          body.sessionIds,

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