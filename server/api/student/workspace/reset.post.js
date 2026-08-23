import {
  requireStudentContext,
} from '../../../utils/authContext.js'

import {
  resetStudentPackageByStudent,
} from '../../../services/studentWorkspaceService.js'

export default defineEventHandler(
  async (
    event,
  ) => {
    // ========================================================
    // Auth
    // ========================================================

    const context =
      await requireStudentContext(
        event,
      )

    const user =
      context.user

    const student =
      context.student

    // ========================================================
    // Body
    // ========================================================

    const body =
      await readBody(
        event,
      )

    const packageId =
      String(
        body?.packageId ||
        '',
      ).trim()

    const startDate =
      String(
        body?.startDate ||
        '',
      ).trim()

    if (
      !packageId
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '缺少 Package ID',
      })
    }

    if (
      !startDate
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '請選擇新一輪開始日期',
      })
    }

    // ========================================================
    // Reset
    // ========================================================

    const result =
      await resetStudentPackageByStudent({
        studentId:
          student.id,

        packageId,

        purchasedCycles:
          body?.purchasedCycles,

        startDate,

        actorUserId:
          user.id,

        event,
      })

    return {
      success: true,

      message:
        `新一輪已開始，共 ${result.newPackage?.total_sessions || 0} 堂；付款狀態等待老師確認`,

      oldPackage:
        result.oldPackage,

      newPackage:
        result.newPackage,
    }
  },
)