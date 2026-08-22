import {
  requireAuth,
} from '../../../utils/authSession.js'

import {
  useDatabase,
} from '../../../utils/db.js'

import {
  getStudentMakeupData,
} from '../../../services/makeupService.js'

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
          '只有學生可以查看自己的補課資料',
      })
    }

    const sql =
      useDatabase()

    // ========================================================
    // Login User → Student
    // ========================================================

    const students =
      await sql`
        SELECT
          id,
          name,
          status

        FROM
          students

        WHERE
          user_id =
            ${user.id}

        LIMIT 1
      `

    if (
      !students.length
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '此 LINE 帳號尚未綁定學生資料',
      })
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
    // Makeup Data
    // ========================================================

    const result =
      await getStudentMakeupData(
        student.id
      )

    // ========================================================
    // Summary
    // ========================================================

    const summary = {
      total:
        result.makeups.length,

      active:
        result.makeups.filter(
          (
            makeup
          ) => {
            return (
              makeup.status ===
              'ACTIVE'
            )
          }
        ).length,

      cancelled:
        result.makeups.filter(
          (
            makeup
          ) => {
            return (
              makeup.status ===
              'CANCELLED'
            )
          }
        ).length,

      availableLeaves:
        result.leaves.length,
    }

    return {
      success: true,

      student,

      summary,

      makeups:
        result.makeups,

      leaves:
        result.leaves,

      sessions:
        result.sessions,
    }
  }
)