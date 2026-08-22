import {
  requireAuth,
} from '../../utils/authSession.js'

import {
  useDatabase,
} from '../../utils/db.js'

import {
  getAuditRequestMetadata,
} from '../../services/auditService.js'

import {
  updateMakeupNote,
  cancelMakeup,
  restoreMakeup,
} from '../../services/makeupMutationService.js'

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
          '沒有 Makeup 修改權限',
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
        ) || ''
      )
        .trim()

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
    // Student Ownership
    //
    // Teacher：
    // studentId = null
    //
    // Student：
    // Login User → Student
    // ========================================================

    let studentId =
      null

    if (
      user.role ===
      'STUDENT'
    ) {
      const sql =
        useDatabase()

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

      studentId =
        student.id
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
        'UPDATE_NOTE',
        'CANCEL',
        'RESTORE',
      ].includes(
        action
      )
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          'action 只能是 UPDATE_NOTE、CANCEL 或 RESTORE',
      })
    }

    const auditMetadata =
      getAuditRequestMetadata(
        event
      )

    // ========================================================
    // Update Note
    // ========================================================

    if (
      action ===
      'UPDATE_NOTE'
    ) {
      if (
        body?.note ===
        undefined
      ) {
        throw createError({
          statusCode: 400,

          statusMessage:
            '缺少新的補課備註',
        })
      }

      const makeup =
        await updateMakeupNote({
          makeupId,

          note:
            body.note,

          actorUserId:
            user.id,

          actorRole:
            user.role,

          studentId,

          auditMetadata,
        })

      return {
        success: true,

        action:
          'UPDATE_NOTE',

        message:
          '補課備註已更新',

        makeup,
      }
    }

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

          reason:
            body?.reason,

          actorUserId:
            user.id,

          actorRole:
            user.role,

          studentId,

          auditMetadata,
        })

      return {
        success: true,

        action:
          'CANCEL',

        message:
          '補課已取消，堂數已重新計算',

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

    const result =
      await restoreMakeup({
        makeupId,

        reason:
          body?.reason,

        actorUserId:
          user.id,

        actorRole:
          user.role,

        studentId,

        auditMetadata,
      })

    return {
      success: true,

      action:
        'RESTORE',

      message:
        '補課已恢復，堂數已重新計算',

      makeup:
        result.makeup,

      attendance:
        result.attendance,

      package:
        result.package,
    }
  }
)