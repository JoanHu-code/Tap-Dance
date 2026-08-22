export default defineEventHandler(
  async (event) => {
    // ========================================================
    // Teacher Auth
    // ========================================================

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
          '只有老師可以新增學生',
      })
    }

    // ========================================================
    // Body
    // ========================================================

    const body =
      await readBody(
        event
      )

    const name =
      String(
        body?.name ||
        ''
      )
        .trim()

    const phone =
      String(
        body?.phone ||
        ''
      )
        .trim()

    // ========================================================
    // Validation
    // ========================================================

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
          '學生姓名長度不可超過 100 字',
      })
    }

    if (
      phone.length > 30
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '電話格式過長',
      })
    }

    const sql =
      useDatabase()

    // ========================================================
    // 取得 TapLife Organization
    //
    // SA 目前是單一教室。
    // ========================================================

    const organizations =
      await sql`
        SELECT
          id

        FROM organizations

        ORDER BY
          id ASC

        LIMIT 1
      `

    if (
      !organizations.length
    ) {
      throw createError({
        statusCode: 500,

        statusMessage:
          '目前尚未建立教室資料',
      })
    }

    const organizationId =
      organizations[0].id

    // ========================================================
    // 新增學生
    //
    // user_id 為 NULL：
    // 代表目前尚未綁定 LINE。
    // ========================================================

    const inserted =
      await sql`
        INSERT INTO
          students (
            organization_id,
            user_id,
            name,
            phone
          )

        VALUES (
          ${organizationId},
          NULL,
          ${name},
          ${phone || null}
        )

        RETURNING
          *
      `

    const student =
      inserted[0]

    // ========================================================
    // Audit Log
    //
    // 若 audit_logs 已建立則寫入。
    // ========================================================

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
          'CREATE',
          'STUDENT',
          ${String(
            student.id
          )},
          ${student.id},
          NULL,
          ${JSON.stringify(
            student
          )}::jsonb,
          NOW()
        )
      `
    } catch (error) {
      console.warn(
        '新增學生 Audit Log 寫入失敗：',
        error?.message
      )
    }

    // ========================================================
    // Response
    // ========================================================

    return {
      success: true,

      message:
        '學生建立成功',

      student,
    }
  }
)