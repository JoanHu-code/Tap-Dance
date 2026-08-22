import {
  useDatabase,
} from '../../../../utils/db.js'

import {
  requireAuth,
} from '../../../../utils/authSession.js'

export default defineEventHandler(
  async (event) => {
    const user =
      await requireAuth(event)

    if (
      user.role !== 'TEACHER'
    ) {
      throw createError({
        statusCode: 403,
        statusMessage:
          '只有老師可以設定停課',
      })
    }

    const sessionId =
      getRouterParam(
        event,
        'id'
      )

    const body =
      await readBody(event)

    const sql =
      useDatabase()

    const sessions =
      await sql`
        UPDATE
          class_sessions

        SET
          status =
            'TEACHER_LEAVE',

          teacher_note =
            ${
              body?.note ||
              '老師請假'
            },

          updated_at =
            NOW()

        WHERE id =
          ${sessionId}

        RETURNING *
      `

    if (
      !sessions.length
    ) {
      throw createError({
        statusCode: 404,
        statusMessage:
          '找不到課程',
      })
    }

    return {
      success: true,

      message:
        '已設定老師請假',

      session:
        sessions[0],
    }
  }
)