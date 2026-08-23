import {
  requireStudentContext,
} from '../../../utils/authContext.js'

import {
  getStudentWorkspace,
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

    const student =
      context.student

    // ========================================================
    // Filters
    // ========================================================

    const query =
      getQuery(
        event,
      )

    const result =
      await getStudentWorkspace({
        studentId:
          student.id,

        packageStatus:
          query.packageStatus ||
          null,

        courseId:
          query.courseId ||
          null,

        actorRole:
          query.actorRole ||
          null,

        auditAction:
          query.auditAction ||
          null,
      })

    return {
      success: true,

      student:
        result.student,

      courses:
        result.courses,

      packages:
        result.packages,

      auditLogs:
        result.auditLogs,

      auditActions:
        result.auditActions,
    }
  },
)