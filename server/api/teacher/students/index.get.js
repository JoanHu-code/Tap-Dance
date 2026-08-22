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
          '只有老師可以查看學生列表',
      })
    }

    // ========================================================
    // Query
    // ========================================================

    const query =
      getQuery(event)

    const search =
      String(
        query.search ||
        ''
      )
        .trim()

    const linked =
      String(
        query.linked ||
        ''
      )
        .trim()
        .toLowerCase()

    const sql =
      useDatabase()

    // ========================================================
    // 先取得學生
    //
    // 目前學生量不大，先採簡單查詢，
    // 再由 Server 篩選。
    //
    // 日後資料量大時再改成 SQL ILIKE。
    // ========================================================

    let students =
      await sql`
        SELECT
          s.*,

          CASE
            WHEN
              s.user_id IS NULL
            THEN FALSE
            ELSE TRUE
          END AS line_linked

        FROM students s

        ORDER BY
          s.id DESC
      `

    // ========================================================
    // 關鍵字
    // ========================================================

    if (search) {
      const keyword =
        search
          .toLowerCase()

      students =
        students.filter(
          (student) => {
            const name =
              String(
                student.name ||
                ''
              )
                .toLowerCase()

                return name.includes(
                keyword
                )
          }
        )
    }

    // ========================================================
    // LINE 綁定狀態
    // ========================================================

    if (
      linked ===
      'true'
    ) {
      students =
        students.filter(
          (student) => {
            return Boolean(
              student.user_id
            )
          }
        )
    }

    if (
      linked ===
      'false'
    ) {
      students =
        students.filter(
          (student) => {
            return !student.user_id
          }
        )
    }

    // ========================================================
    // Response
    // ========================================================

    return {
      success: true,

      total:
        students.length,

      students,
    }
  }
)