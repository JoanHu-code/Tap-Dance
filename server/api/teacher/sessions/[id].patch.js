import {
  requireAuth,
} from '../../../utils/authSession.js'

import {
  updateSession,
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
          '只有老師可以修改課堂 Session',
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
        ) || ''
      )
        .trim()

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
    //
    // {
    //   status,
    //   teacherNote
    // }
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
          '沒有需要修改的 Session 資料',
      })
    }

    const auditMetadata =
      getAuditRequestMetadata(
        event
      )

    const result =
      await updateSession({
        sessionId,

        status:
          body?.status,

        teacherNote:
          body?.teacherNote,

        actorUserId:
          user.id,

        actorRole:
          'TEACHER',

        auditMetadata,
      })

    return {
      success: true,

      message:
        '課堂 Session 更新成功',

      session:
        result.session,

      attendanceCount:
        result.attendanceCount,
    }
  }
)