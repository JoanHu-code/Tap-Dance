import {
  requireAuth,
} from '../../utils/authSession.js'

import {
  getTeacherDashboard,
} from '../../services/dashboardService.js'

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
          '只有老師可以查看老師 Dashboard',
      })
    }

    // ========================================================
    // Dashboard
    // ========================================================

    const dashboard =
      await getTeacherDashboard()

    return {
      success: true,

      dashboard,
    }
  }
)