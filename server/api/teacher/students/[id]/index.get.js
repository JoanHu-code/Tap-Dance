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
          '只有老師可以查看學生資料',
      })
    }

    // ========================================================
    // Student ID
    // ========================================================

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

    const sql =
      useDatabase()

    // ========================================================
    // Student
    // ========================================================

    const students =
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
      !students.length
    ) {
      throw createError({
        statusCode: 404,

        statusMessage:
          '找不到學生資料',
      })
    }

    const student =
      students[0]

    // ========================================================
    // Enrollments
    // ========================================================

    const enrollments =
      await sql`
        SELECT
          e.*,

          c.name
            AS course_name,

          cs.weekday
            AS schedule_weekday,

          cs.start_time
            AS schedule_start_time

        FROM
          student_enrollments e

        LEFT JOIN
          dance_courses c

          ON c.id =
            e.course_id

        LEFT JOIN
          class_schedules cs

          ON cs.id =
            e.default_schedule_id

        WHERE
          e.student_id =
            ${studentId}

        ORDER BY
          e.id DESC
      `

    // ========================================================
    // Packages
    // ========================================================

    const packages =
      await sql`
        SELECT
          p.*,

          c.name
            AS course_name

        FROM
          student_packages p

        LEFT JOIN
          dance_courses c

          ON c.id =
            p.course_id

        WHERE
          p.student_id =
            ${studentId}

        ORDER BY
          p.id DESC

        LIMIT 50
      `

    // ========================================================
    // Attendance
    // ========================================================

    const attendanceRecords =
      await sql`
        SELECT
          a.*,

          cs.class_date

        FROM
          attendance_records_v2 a

        LEFT JOIN
          class_sessions cs

          ON cs.id =
            a.session_id

        WHERE
          a.student_id =
            ${studentId}

        ORDER BY
          a.id DESC

        LIMIT 20
      `

    // ========================================================
    // Courses
    // ========================================================

    const availableCourses =
      await sql`
        SELECT
          *

        FROM
          dance_courses

        ORDER BY
          name ASC
      `

    // ========================================================
    // Schedules
    // ========================================================

    const availableSchedules =
      await sql`
        SELECT
          *

        FROM
          class_schedules

        ORDER BY
          weekday ASC,
          start_time ASC
      `

    // ========================================================
    // Audit Logs
    // ========================================================

    let auditLogs = []

    try {
      auditLogs =
        await sql`
          SELECT
            *

          FROM
            audit_logs

          WHERE
            student_id =
              ${studentId}

          ORDER BY
            created_at DESC

          LIMIT 20
        `
    } catch (error) {
      console.warn(
        'audit_logs 查詢失敗：',
        error?.message
      )

      auditLogs = []
    }

    // ========================================================
    // Latest Link Code
    // ========================================================

    let latestLinkCode =
      null

    if (
      !student.user_id
    ) {
      try {
        const linkCodes =
          await sql`
            SELECT
              id,
              code,
              expires_at,
              used_at,
              revoked_at,
              created_at

            FROM
              student_link_codes

            WHERE
              student_id =
                ${studentId}

              AND
                used_at IS NULL

              AND
                revoked_at IS NULL

              AND
                expires_at >
                NOW()

            ORDER BY
              created_at DESC

            LIMIT 1
          `

        latestLinkCode =
          linkCodes[0] ||
          null
      } catch (error) {
        console.warn(
          'student_link_codes 查詢失敗：',
          error?.message
        )
      }
    }

    // ========================================================
    // Response
    // ========================================================

    return {
      success: true,

      student,

      enrollments,

      packages,

      attendanceRecords,

      auditLogs,

      availableCourses,

      availableSchedules,

      latestLinkCode,
    }
  }
)