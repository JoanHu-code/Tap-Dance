import {
  requireAuth,
} from './authSession.js'

import {
  useDatabase,
} from './db.js'

// ============================================================
// Teacher Context
//
// 系統只有一位老師。
// 不使用 Organization 做老師權限隔離。
// ============================================================

export const requireTeacherContext =
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
          '只有老師可以使用此功能',
      })
    }

    return {
      user,
    }
  }

// ============================================================
// Student Context
//
// 學生仍然必須從登入帳號解析自己的 Student。
// ============================================================

export const requireStudentContext =
  async (
    event
  ) => {
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
          '只有學生可以使用此功能',
      })
    }

    const sql =
      useDatabase()

    const students =
      await sql`
        SELECT
          id,
          user_id,
          name,
          note,
          status

        FROM
          students

        WHERE
          user_id =
            ${user.id}

        LIMIT 2
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

    if (
      students.length >
      1
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '此帳號綁定了多筆學生資料，請聯絡老師處理',
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

    return {
      user,

      student,
    }
  }