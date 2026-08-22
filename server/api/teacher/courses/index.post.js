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
          '只有老師可以建立課程',
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

    // ========================================================
    // Validation
    // ========================================================

    if (!name) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '請輸入課程名稱',
      })
    }

    if (
      name.length > 100
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '課程名稱不可超過 100 字',
      })
    }

    const sql =
      useDatabase()

    // ========================================================
    // Organization
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
    // 檢查同名課程
    // ========================================================

    const duplicated =
      await sql`
        SELECT
          id

        FROM dance_courses

        WHERE
          organization_id =
            ${organizationId}

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
          '已存在相同名稱的課程',
      })
    }

    // ========================================================
    // INSERT Course
    // ========================================================

    const inserted =
      await sql`
        INSERT INTO
          dance_courses (
            organization_id,
            name
          )

        VALUES (
          ${organizationId},
          ${name}
        )

        RETURNING
          *
      `

    const course =
      inserted[0]

    // ========================================================
    // Audit Log
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
            before_data,
            after_data,
            created_at
          )

        VALUES (
          ${user.id},
          'TEACHER',
          'CREATE',
          'COURSE',
          ${String(
            course.id
          )},
          NULL,
          ${JSON.stringify(
            course
          )}::jsonb,
          NOW()
        )
      `
    } catch (error) {
      console.warn(
        '新增課程 Audit Log 寫入失敗：',
        error?.message
      )
    }

    return {
      success: true,

      message:
        '課程建立成功',

      course,
    }
  }
)