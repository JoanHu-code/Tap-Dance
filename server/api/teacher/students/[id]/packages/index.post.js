import {
  requireAuth,
} from '../../../../../utils/authSession.js'

import {
  getAuditRequestMetadata,
} from '../../../../../services/auditService.js'

import {
  createStudentPackagePurchase,
} from '../../../../../services/studentPackagePurchaseService.js'

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
          '只有老師可以替學生建立課程方案',
      })
    }

    // ========================================================
    // Student ID
    // ========================================================

    const studentId =
      String(
        getRouterParam(
          event,
          'id'
        ) ||
        ''
      ).trim()

    if (
      !studentId
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '缺少 Student ID',
      })
    }

    // ========================================================
    // Body
    // ========================================================

    const body =
      await readBody(
        event
      )

    const courseId =
      String(
        body?.courseId ||
        ''
      ).trim()

    const startDate =
      String(
        body?.startDate ||
        ''
      ).trim()

    if (
      !courseId
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '請選擇課堂',
      })
    }

    if (
      !startDate
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '請選擇學生開始日期',
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
    // Create Package
    // ========================================================

    const result =
      await createStudentPackagePurchase({
        studentId,

        courseId,

        startDate,

        purchasedCycles:
          body?.purchasedCycles,

        paid:
          body?.paid ??
          true,

        actorUserId:
          user.id,

        auditMetadata,
      })

    return {
      success: true,

      message:
        `方案建立完成：${result.calculation.purchasedCycles} 期，共 ${result.calculation.totalSessions} 堂，總額 ${result.calculation.totalPrice}`,

      package:
        result.package,

      calculation:
        result.calculation,
    }
  }
)