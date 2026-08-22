import {
  requireAuth,
} from '../../../../utils/authSession.js'

import {
  getAuditRequestMetadata,
} from '../../../../services/auditService.js'

import {
  renewPackageCycle,
} from '../../../../services/packageRenewService.js'

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
          '只有老師可以使用老師端 Package Renew',
      })
    }

    // ========================================================
    // Package ID
    // ========================================================

    const packageId =
      String(
        getRouterParam(
          event,
          'id'
        ) ||
        ''
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

    // ========================================================
    // Body
    // ========================================================

    const body =
      await readBody(
        event
      )

    // ========================================================
    // Audit
    // ========================================================

    const auditMetadata =
      getAuditRequestMetadata(
        event
      )

    // ========================================================
    // Renew
    // ========================================================

    const result =
      await renewPackageCycle({
        packageId,

        actorUserId:
          user.id,

        actorRole:
          'TEACHER',

        totalSessions:
          body?.totalSessions,

        price:
          body?.price,

        paid:
          body?.paid ??
          true,

        auditMetadata,
      })

    return {
      success: true,

      message:
        `已建立第 ${result.package?.cycle_no || ''} 期 Package`,

      previousPackage:
        result.previousPackage,

      package:
        result.package,
    }
  }
)