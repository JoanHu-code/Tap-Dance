import {
  requireAuth,
} from '../../../utils/authSession.js'

import {
  generateSessions,
} from '../../../services/sessionService.js'

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
          '只有老師可以產生課堂 Session',
      })
    }

    // ========================================================
    // Body
    //
    // {
    //   scheduleIds: [],
    //   startDate: '2026-09-01',
    //   endDate: '2026-12-31'
    // }
    // ========================================================

    const body =
      await readBody(
        event
      )

    if (
      !Array.isArray(
        body?.scheduleIds
      ) ||
      !body.scheduleIds.length
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '請至少選擇一個固定班別',
      })
    }

    if (
      !body?.startDate
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '請輸入開始日期',
      })
    }

    if (
      !body?.endDate
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '請輸入結束日期',
      })
    }

    const auditMetadata =
      getAuditRequestMetadata(
        event
      )

    const result =
      await generateSessions({
        scheduleIds:
          body.scheduleIds,

        startDate:
          body.startDate,

        endDate:
          body.endDate,

        actorUserId:
          user.id,

        actorRole:
          'TEACHER',

        auditMetadata,
      })

    return {
      success: true,

      message:
        result.createdCount > 0
          ? `成功建立 ${result.createdCount} 堂課`
          : '指定日期範圍內沒有需要新增的課堂',

      createdCount:
        result.createdCount,

      skippedCount:
        result.skippedCount,

      sessions:
        result.sessions,
    }
  }
)