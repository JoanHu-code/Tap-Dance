import {
  requireAuth,
} from '../../../utils/authSession.js'

import {
  getAuditRequestMetadata,
} from '../../../services/auditService.js'

import {
  generateClassSessions,
} from '../../../services/classSessionService.js'

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
    // ========================================================

    const body =
      await readBody(
        event
      )

    const startDate =
      String(
        body?.startDate ||
        ''
      ).trim()

    const endDate =
      String(
        body?.endDate ||
        ''
      ).trim()

    if (
      !startDate
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '請提供開始日期',
      })
    }

    if (
      !endDate
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '請提供結束日期',
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
    // Generate
    // ========================================================

    const result =
      await generateClassSessions({
        courseId:
          body?.courseId ||
          null,

        scheduleId:
          body?.scheduleId ||
          null,

        startDate,

        endDate,

        actorUserId:
          user.id,

        auditMetadata,
      })

    return {
      success: true,

      message:
        result.createdCount
          ? `成功新增 ${result.createdCount} 堂課，略過 ${result.skippedCount} 堂已存在課堂`
          : `沒有新增課堂，共略過 ${result.skippedCount} 堂已存在課堂`,

      result,
    }
  }
)