import {
  renewStudentPackage,
} from '../../../../../services/packageService.js'

import {
  requireAuth,
} from '../../../../../utils/authSession.js'

export default defineEventHandler(
  async (
    event
  ) => {
    // ========================================================
    // 老師身份
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
          '只有老師可以使用老師端續期功能',
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
        ) || ''
      )
        .trim()

    if (!studentId) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '缺少學生 ID',
      })
    }

    // ========================================================
    // Body
    // ========================================================

    const body =
      await readBody(
        event
      )

    const packageId =
      String(
        body?.packageId ||
        ''
      )
        .trim()

    if (!packageId) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '缺少要續期的 Package ID',
      })
    }

    // ========================================================
    // Renew
    //
    // Service 會再次檢查是否滿堂。
    // ========================================================

    const result =
      await renewStudentPackage({
        studentId,

        packageId,

        startDate:
          body?.startDate,

        totalSessions:
          body
            ?.totalSessions,

        price:
          body?.price,

        bankAccountId:
          body
            ?.bankAccountId,

        actorUserId:
          user.id,

        actorRole:
          'TEACHER',
      })

    return {
      success: true,

      message:
        `續期完成，已建立第 ${result.newPackage.cycle_no} 期`,

      previousPackage:
        result.previousPackage,

      newPackage:
        result.newPackage,
    }
  }
)