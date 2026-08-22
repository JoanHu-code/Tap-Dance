import {
  renewStudentPackage,
} from '../../../../../services/packageService.js'

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
          '只有老師可以確認續期',
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
    //
    // packageId：
    // 要被續期的舊 Package
    //
    // totalSessions：
    // 可不傳，預設沿用舊期
    //
    // price：
    // 可不傳，預設沿用舊期
    //
    // startDate：
    // 可不傳，預設台灣今天
    //
    // bankAccountId：
    // 不傳 = 沿用舊期
    //
    // Renew 本身就是：
    // 「老師確認已收費」
    // 所以新一期一定 paid = true。
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