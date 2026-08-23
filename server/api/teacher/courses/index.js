import {
  requireAuth,
} from '../../../utils/authSession.js'

import {
  createCourse,
  getCourses,
  updateCourse,
} from '../../../services/courseService.js'

export default defineEventHandler(
  async (
    event
  ) => {
    // ========================================================
    // Auth
    //
    // 系統只有一位老師。
    // 不需要 Organization Membership。
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
          '只有老師可以管理課堂',
      })
    }

    const method =
      String(
        event.method ||
        'GET'
      ).toUpperCase()

    // ========================================================
    // GET
    // ========================================================

    if (
      method ===
      'GET'
    ) {
      const query =
        getQuery(
          event
        )

      const courses =
        await getCourses({
          status:
            query.status ||
            null,
        })

      return {
        success: true,

        courses,
      }
    }

    // ========================================================
    // POST
    // ========================================================

    if (
      method ===
      'POST'
    ) {
      const body =
        await readBody(
          event
        )

      const course =
        await createCourse({
          name:
            body?.name,

          description:
            body?.description,

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
        })

      return {
        success: true,

        message:
          '課堂建立完成',

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
          event
        )

      const courseId =
        String(
          body?.courseId ||
          ''
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

      const course =
        await updateCourse({
          courseId,

          name:
            body?.name,

          description:
            body?.description,

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
        })

      return {
        success: true,

        message:
          '課堂資料已更新',

        course,
      }
    }

    // ========================================================
    // Method Not Allowed
    // ========================================================

    setResponseStatus(
      event,
      405
    )

    return {
      success: false,

      message:
        'Method Not Allowed',
    }
  }
)