import {
  requireAuth,
} from '../../../utils/authSession.js'

import {
  getTeacherStudentDashboard,
} from '../../../services/teacherStudentWorkspaceService.js'

export default defineEventHandler(
  async (
    event
  ) => {
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
          '只有老師可以查看學生資料',
      })
    }

    const students =
      await getTeacherStudentDashboard()

    return {
      success: true,

      students,
    }
  }
)