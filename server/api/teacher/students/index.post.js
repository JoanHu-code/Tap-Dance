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

    const phone =
      String(
        body?.phone || ''
      ).trim()

    const note =
      String(
        body?.note || ''
      ).trim()

    if (!name) {
      throw createError({
        statusCode: 400,
        statusMessage:
          '請輸入學生姓名',
      })
    }

    if (
      name.length > 100
    ) {
      throw createError({
        statusCode: 400,
        statusMessage:
          '學生姓名不可超過 100 個字',
      })
    }

    if (
      phone.length > 50
    ) {
      throw createError({
        statusCode: 400,
        statusMessage:
          '電話長度不正確',
      })
    }

    const sql =
      useDatabase()

    const students =
      await sql`
        INSERT INTO
          students (
            organization_id,
            name,
            phone,
            note,
            status
          )

        VALUES (
          ${organization.id},
          ${name},
          ${
            phone ||
            null
          },
          ${
            note ||
            null
          },
          'ACTIVE'
        )

        RETURNING
          id,
          name,
          phone,
          note,
          status,
          user_id,
          created_at
      `

    const student =
      students[0]

    return {
      success: true,

      message:
        '學生已新增',

      student: {
        id:
          student.id,

        name:
          student.name,

        phone:
          student.phone,

        note:
          student.note,

        status:
          student.status,

        userId:
          student.user_id,

        hasLine:
          false,

        courseCount:
          0,

        createdAt:
          student.created_at,
      },
    }
  }
)