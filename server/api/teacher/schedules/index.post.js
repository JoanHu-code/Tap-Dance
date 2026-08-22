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
          '只有老師可以新增課程',
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
          '請輸入課程名稱',
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
          '尚未加入任何教室',
      })
    }

    const records =
      await sql`
        INSERT INTO
          dance_courses (
            organization_id,
            name,
            description
          )

        VALUES (
          ${
            organizations[0]
              .organization_id
          },
          ${name},
          ${
            body?.description ||
            null
          }
        )

        RETURNING
          *
      `

    return {
      success: true,
      course:
        records[0],
    }
  }
)