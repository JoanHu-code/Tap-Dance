import {
  requireAuth,
} from '../../../utils/authSession.js'

import {
  getAuditRequestMetadata,
} from '../../../services/auditService.js'

import {
  updateClassSession,
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
          '只有老師可以修改課堂',
      })
    }

    // ========================================================
    // Session ID
    // ========================================================

    const sessionId =
      String(
        getRouterParam(
          event,
          'id'
        ) ||
        ''
      ).trim()

    if (
      !sessionId
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '缺少 Session ID',
      })
    }

    // ========================================================
    // Body
    // ========================================================

    const body =
      await readBody(
        event
      )

    if (
      body?.status ===
        undefined &&
      body?.teacherNote ===
        undefined
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '沒有提供要修改的資料',
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
    // Update
    // ========================================================

    const session =
      await updateClassSession({
        sessionId,

        status:
          body?.status,

        teacherNote:
          body?.teacherNote,

        actorUserId:
          user.id,

        auditMetadata,
      })

    return {
      success: true,

      message:
        '課堂資料已更新',

      session,
    }
  }
)