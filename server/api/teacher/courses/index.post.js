import {
  useDatabase,
} from '../../../utils/db.js'

import {
  requireTeacherOrganization,
} from '../../../utils/teacherAuth.js'

export default defineEventHandler(
  async (event) => {
    const {
      organization,
    } =
      await requireTeacherOrganization(
        event
      )

    const body =
      await readBody(event)

    const name =
      String(
        body?.name || ''
      ).trim()

    const description =
      String(
        body?.description || ''
      ).trim()

    if (!name) {
      throw createError({
        statusCode: 400,
        statusMessage:
          '請輸入課程名稱',
      })
    }

    if (
      name.length > 150
    ) {
      throw createError({
        statusCode: 400,
        statusMessage:
          '課程名稱不可超過 150 個字',
      })
    }

    const sql =
      useDatabase()

    const duplicated =
      await sql`
        SELECT id

        FROM dance_courses

        WHERE
          organization_id =
            ${organization.id}

          AND LOWER(name) =
            LOWER(${name})

        LIMIT 1
      `

    if (
      duplicated.length
    ) {
      throw createError({
        statusCode: 409,
        statusMessage:
          '已經有相同名稱的課程',
      })
    }

    const courses =
      await sql`
        INSERT INTO
          dance_courses (
            organization_id,
            name,
            description,
            status
          )

        VALUES (
          ${organization.id},
          ${name},
          ${
            description ||
            null
          },
          'ACTIVE'
        )

        RETURNING
          id,
          name,
          description,
          status,
          created_at
      `

    const course =
      courses[0]

    return {
      success: true,

      message:
        '課程已新增',

      course: {
        id:
          course.id,

        name:
          course.name,

        description:
          course.description,

        status:
          course.status,

        scheduleCount:
          0,

        schedules: [],

        createdAt:
          course.created_at,
      },
    }
  }
)