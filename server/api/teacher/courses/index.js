import {
  requireAuth,
} from '../../../utils/authSession.js'

import {
  getAuditRequestMetadata,
} from '../../../services/auditService.js'

import {
  createCourse,
  getCourses,
  updateCourse,
} from '../../../services/courseService.js'

// ============================================================
// Handler
// ============================================================

export default defineEventHandler(
  async (
    event,
  ) => {
    // ========================================================
    // Teacher Auth
    // ========================================================

    const user =
      await requireAuth(
        event,
      )

    if (
      user.role !==
      'TEACHER'
    ) {
      throw createError({
        statusCode: 403,
        statusMessage:
          '只有老師可以管理課堂',
      })
    }

    const method =
      String(
        event.method ||
        'GET',
      ).toUpperCase()

    // ========================================================
    // GET
    // ========================================================

    if (
      method ===
      'GET'
    ) {
      const courses =
        await getCourses()

      return {
        success: true,
        courses,
      }
    }

    // ========================================================
    // POST
    //
    // 新增時一定完整傳六個欄位。
    // ========================================================

    if (
      method ===
      'POST'
    ) {
      const body =
        await readBody(
          event,
        )

      const auditMetadata =
        getAuditRequestMetadata(
          event,
        )

      const course =
        await createCourse({
          name:
            body?.name,

          weekday:
            body?.weekday,

          startTime:
            body?.startTime,

          endTime:
            body?.endTime,

          sessionsPerCycle:
            body?.sessionsPerCycle,

          pricePerCycle:
            body?.pricePerCycle,

          actorUserId:
            user.id,

          auditMetadata,
        })

      return {
        success: true,

        message:
          '課堂已新增',

        course,
      }
    }

    // ========================================================
    // PATCH
    // ========================================================

    if (
      method ===
      'PATCH'
    ) {
      const body =
        await readBody(
          event,
        )

      const courseId =
        String(
          body?.courseId ||
          '',
        ).trim()

      if (
        !courseId
      ) {
        throw createError({
          statusCode: 400,
          statusMessage:
            '缺少 Course ID',
        })
      }

      const auditMetadata =
        getAuditRequestMetadata(
          event,
        )

      const course =
        await updateCourse({
          courseId,

          name:
            body?.name,

          weekday:
            body?.weekday,

          startTime:
            body?.startTime,

          endTime:
            body?.endTime,

          sessionsPerCycle:
            body?.sessionsPerCycle,

          pricePerCycle:
            body?.pricePerCycle,

          status:
            body?.status,

          actorUserId:
            user.id,

          auditMetadata,
        })

      return {
        success: true,

        message:
          body?.status &&
          body?.name ===
            undefined
            ? (
                body.status ===
                'ACTIVE'
                  ? '課堂已啟用'
                  : '課堂已停用'
              )
            : '課堂已更新',

        course,
      }
    }

    // ========================================================
    // Other
    // ========================================================

    throw createError({
      statusCode: 405,
      statusMessage:
        'Method Not Allowed',
    })
  },
)