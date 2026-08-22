import {
  getStudentPackages,
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
          '只有老師可以查看學生 Package',
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
    // Packages
    // ========================================================

    const packages =
      await getStudentPackages(
        studentId
      )

    // ========================================================
    // Current Active Packages
    //
    // 一個學生可能有多門 Course，
    // 所以每門 Course 可以各有一個 ACTIVE Package。
    // ========================================================

    const activePackages =
      packages.filter(
        (
          item
        ) => {
          return (
            item.status ===
            'ACTIVE'
          )
        }
      )

    const completedPackages =
      packages.filter(
        (
          item
        ) => {
          return (
            item.status ===
            'COMPLETED'
          )
        }
      )

    return {
      success: true,

      total:
        packages.length,

      activeCount:
        activePackages.length,

      completedCount:
        completedPackages.length,

      packages,
    }
  }
)