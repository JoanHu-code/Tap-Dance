import {
  requireAuth,
} from './authSession.js'

import {
  useDatabase,
} from './db.js'

export const requireTeacher =
  async (event) => {
    const user =
      await requireAuth(event)

    if (
      user.role !== 'TEACHER'
    ) {
      throw createError({
        statusCode: 403,
        statusMessage:
          '只有老師可以使用此功能',
      })
    }

    return user
  }

export const requireTeacherOrganization =
  async (event) => {
    const user =
      await requireTeacher(event)

    const sql =
      useDatabase()

    const organizations =
      await sql`
        SELECT
          o.id,
          o.name,
          om.role AS member_role

        FROM organization_members om

        INNER JOIN organizations o
          ON o.id =
            om.organization_id

        WHERE om.user_id =
          ${user.id}

        ORDER BY
          CASE
            WHEN om.role = 'OWNER'
              THEN 0
            ELSE 1
          END

        LIMIT 1
      `

    if (!organizations.length) {
      throw createError({
        statusCode: 403,
        statusMessage:
          '此老師尚未加入任何教室',
      })
    }

    return {
      user,
      organization:
        organizations[0],
    }
  }