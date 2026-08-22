export default defineEventHandler(
  async (event) => {
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
          '只有老師可以修改學生資料',
      })
    }

    const studentId =
      Number(
        getRouterParam(
          event,
          'id'
        )
      )

    if (
      !studentId ||
      Number.isNaN(
        studentId
      )
    ) {
      throw createError({
        statusCode: 400,
        statusMessage:
          '學生 ID 不正確',
      })
    }

    const body =
      await readBody(
        event
      )

    const name =
      String(
        body?.name || ''
      )
        .trim()

    if (!name) {
      throw createError({
        statusCode: 400,
        statusMessage:
          '學生姓名不可為空',
      })
    }

    if (
      name.length > 100
    ) {
      throw createError({
        statusCode: 400,
        statusMessage:
          '學生姓名不可超過 100 字',
      })
    }

    const sql =
      useDatabase()

    const oldStudents =
      await sql`
        SELECT
          *

        FROM students

        WHERE
          id =
            ${studentId}

        LIMIT 1
      `

    if (
      !oldStudents.length
    ) {
      throw createError({
        statusCode: 404,
        statusMessage:
          '找不到學生資料',
      })
    }

    const beforeData =
      oldStudents[0]

    const updated =
      await sql`
        UPDATE students

        SET
          name =
            ${name}

        WHERE
          id =
            ${studentId}

        RETURNING
          *
      `

    const student =
      updated[0]

    try {
      await sql`
        INSERT INTO
          audit_logs (
            actor_user_id,
            actor_role,
            action,
            entity_type,
            entity_id,
            student_id,
            before_data,
            after_data,
            created_at
          )

        VALUES (
          ${user.id},
          'TEACHER',
          'UPDATE',
          'STUDENT',
          ${String(
            studentId
          )},
          ${studentId},
          ${JSON.stringify(
            beforeData
          )}::jsonb,
          ${JSON.stringify(
            student
          )}::jsonb,
          NOW()
        )
      `
    } catch (error) {
      console.warn(
        'Student Audit Log 寫入失敗：',
        error?.message
      )
    }

    return {
      success: true,

      message:
        '學生資料更新成功',

      student,
    }
  }
)