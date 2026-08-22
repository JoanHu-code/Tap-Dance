import {
  getStudentPackages,
} from '../../../services/packageService.js'

import {
  requireAuth,
} from '../../../utils/authSession.js'

import {
  useDatabase,
} from '../../../utils/db.js'

export default defineEventHandler(
  async (
    event
  ) => {
    // ========================================================
    // Student Auth
    // ========================================================

    const user =
      await requireAuth(
        event
      )

    if (
      user.role !==
      'STUDENT'
    ) {
      throw createError({
        statusCode: 403,

        statusMessage:
          '只有學生可以查看自己的 Package',
      })
    }

    const sql =
      useDatabase()

    // ========================================================
    // 從 Session 找本人
    //
    // 不接受 studentId。
    // ========================================================

    const students =
      await sql`
        SELECT
          id,
          name,
          user_id,
          status

        FROM students

        WHERE
          user_id =
            ${user.id}

        LIMIT 1
      `

    if (
      !students.length
    ) {
      return {
        success: true,

        linked: false,

        packages: [],
      }
    }

    const student =
      students[0]

    if (
      student.status !==
      'ACTIVE'
    ) {
      throw createError({
        statusCode: 403,

        statusMessage:
          '學生資料目前未啟用',
      })
    }

    // ========================================================
    // Package Service
    //
    // 會計算：
    // attended_count
    // remaining_sessions
    // progress_percentage
    // is_sessions_completed
    // can_renew
    // ========================================================

    const packages =
      await getStudentPackages(
        student.id
      )

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

    const renewablePackages =
      packages.filter(
        (
          item
        ) => {
          return Boolean(
            item.can_renew
          )
        }
      )

    return {
      success: true,

      linked: true,

      student,

      total:
        packages.length,

      activeCount:
        activePackages.length,

      renewableCount:
        renewablePackages.length,

      packages,
    }
  }
)