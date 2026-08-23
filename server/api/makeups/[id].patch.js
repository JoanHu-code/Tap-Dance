import {
  requireAuth,
} from '../../utils/authSession.js'

import {
  useDatabase,
} from '../../utils/db.js'

import {
  cancelMakeup,
  restoreMakeup,
  updateMakeupNote,
} from '../../services/makeupMutationService.js'

// ============================================================
// Resolve Student For Current User
// ============================================================

const resolveStudentId =
  async (
    user
  ) => {
    if (
      user.role !==
      'STUDENT'
    ) {
      return null
    }

    const sql =
      useDatabase()

    const rows =
      await sql`
        SELECT
          id,
          status

        FROM
          students

        WHERE
          user_id =
            ${user.id}

        LIMIT 2
      `

    if (
      !rows.length
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '此 LINE 帳號尚未綁定學生資料',
      })
    }

    if (
      rows.length >
      1
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '此帳號綁定多筆學生資料，請聯絡老師處理',
      })
    }

    if (
      rows[0].status !==
      'ACTIVE'
    ) {
      throw createError({
        statusCode: 403,

        statusMessage:
          '學生資料目前已停用',
      })
    }

    return rows[0].id
  }

// ============================================================
// Handler
// ============================================================

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
      ![
        'TEACHER',
        'STUDENT',
      ].includes(
        user.role
      )
    ) {
      throw createError({
        statusCode: 403,

        statusMessage:
          '目前帳號無權操作補課資料',
      })
    }

    // ========================================================
    // Makeup ID
    // ========================================================

    const makeupId =
      String(
        getRouterParam(
          event,
          'id'
        ) ||
        ''
      ).trim()

    if (
      !makeupId
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '缺少 Makeup ID',
      })
    }

    // ========================================================
    // Body
    // ========================================================

    const body =
      await readBody(
        event
      )

    const action =
      String(
        body?.action ||
        ''
      )
        .trim()
        .toUpperCase()

    if (
      ![
        'CANCEL',
        'RESTORE',
        'UPDATE_NOTE',
      ].includes(
        action
      )
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '不支援的補課操作',
      })
    }

    // ========================================================
    // Student Ownership
    //
    // TEACHER：
    // studentId = null
    // → Service 不限制學生
    //
    // STUDENT：
    // 必須限制為登入者自己的 student.id
    // ========================================================

    const studentId =
      await resolveStudentId(
        user
      )

    // ========================================================
    // Cancel
    // ========================================================

    if (
      action ===
      'CANCEL'
    ) {
      const result =
        await cancelMakeup({
          makeupId,

          studentId,

          reason:
            body?.reason,

          actorUserId:
            user.id,

          actorRole:
            user.role,

          event,
        })

      return {
        success: true,

        message:
          '補課已取消',

        makeup:
          result.makeup,

        attendance:
          result.attendance,

        package:
          result.package,
      }
    }

    // ========================================================
    // Restore
    // ========================================================

    if (
      action ===
      'RESTORE'
    ) {
      const result =
        await restoreMakeup({
          makeupId,

          studentId,

          actorUserId:
            user.id,

          actorRole:
            user.role,

          event,
        })

      return {
        success: true,

        message:
          '補課已恢復，堂數已重新累加',

        makeup:
          result.makeup,

        attendance:
          result.attendance,

        package:
          result.package,
      }
    }

    // ========================================================
    // Update Note
    // ========================================================

    const result =
      await updateMakeupNote({
        makeupId,

        studentId,

        note:
          body?.note,

        actorUserId:
          user.id,

        actorRole:
          user.role,

        event,
      })

    return {
      success: true,

      message:
        '補課備註已更新',

      makeup:
        result.makeup,

      attendance:
        result.attendance,
    }
  }
)