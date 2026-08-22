import {
  useDatabase,
} from '../../../utils/db.js'

import {
  requireAuth,
} from '../../../utils/authSession.js'

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
          '只有老師可以新增學生',
      })
    }

    const body =
      await readBody(event)

    const name =
      String(
        body?.name || ''
      ).trim()

    if (!name) {
      throw createError({
        statusCode: 400,
        statusMessage:
          '請輸入學生姓名',
      })
    }

    const sql =
      useDatabase()

    const organizations =
      await sql`
        SELECT
          organization_id

        FROM organization_members

        WHERE user_id =
          ${user.id}

        LIMIT 1
      `

    if (
      !organizations.length
    ) {
      throw createError({
        statusCode: 403,
        statusMessage:
          '老師尚未加入教室',
      })
    }

    const students =
      await sql`
        INSERT INTO
          students (
            organization_id,
            name,
            phone,
            note
          )

        VALUES (
          ${
            organizations[0]
              .organization_id
          },
          ${name},
          ${
            body?.phone ||
            null
          },
          ${
            body?.note ||
            null
          }
        )

        RETURNING *
      `

    return {
      success: true,
      student:
        students[0],
    }
  }
)