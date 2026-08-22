export default defineEventHandler(
  async (event) => {
    // ========================================================
    // 驗證登入 Session
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
          '只有老師可以查看管理首頁',
      })
    }

    // ========================================================
    // Database
    // ========================================================

    const sql =
      useDatabase()

    // ========================================================
    // 學生列表
    // ========================================================

    const students =
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

        LIMIT 100
      `

    // ========================================================
    // 課程列表
    // ========================================================

    const courses =
      await sql`
        SELECT
          c.*

        FROM dance_courses c

        ORDER BY
          c.id DESC
      `

    // ========================================================
    // 待續期 Package
    //
    // 使用 COMPLETED 判斷本期已完成
    // ========================================================

    const pendingRenewals =
      await sql`
        SELECT
          p.id,
          p.student_id,
          p.course_id,
          p.total_sessions,
          p.price,
          p.cycle_no,
          p.status,

          s.name
            AS student_name,

          c.name
            AS course_name

        FROM student_packages p

        INNER JOIN students s
          ON s.id =
            p.student_id

        LEFT JOIN dance_courses c
          ON c.id =
            p.course_id

        WHERE
          p.status =
            'COMPLETED'

        ORDER BY
          p.id DESC

        LIMIT 20
      `

    // ========================================================
    // 最近操作紀錄
    //
    // audit_logs Migration 尚未跑時可能不存在，
    // 所以做容錯，不讓 Dashboard 整頁掛掉。
    // ========================================================

    let recentAudits = []

    try {
      recentAudits =
        await sql`
          SELECT
            a.*,

            s.name
              AS student_name

          FROM audit_logs a

          LEFT JOIN students s
            ON s.id =
              a.student_id

          ORDER BY
            a.created_at DESC

          LIMIT 10
        `
    } catch (error) {
      console.warn(
        'audit_logs 尚未建立或查詢失敗：',
        error?.message
      )

      recentAudits = []
    }

    // ========================================================
    // Summary
    // ========================================================

    const studentCount =
      students.length

    const courseCount =
      courses.length

    const linkedStudentCount =
      students.filter(
        (student) => {
          return Boolean(
            student.user_id
          )
        }
      ).length

    const unlinkedStudentCount =
      studentCount -
      linkedStudentCount

    // ========================================================
    // Response
    // ========================================================

    return {
      success: true,

      teacher: {
        id:
          user.id,

        display_name:
          user.display_name,

        picture_url:
          user.picture_url,
      },

      summary: {
        studentCount,

        courseCount,

        linkedStudentCount,

        unlinkedStudentCount,

        pendingRenewalCount:
          pendingRenewals.length,
      },

      students,

      courses,

      pendingRenewals,

      recentAudits,
    }
  }
)