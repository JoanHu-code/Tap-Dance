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
          '只有老師可以查看課程',
      })
    }

    const sql =
      useDatabase()

    // ========================================================
    // Courses
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
    // Schedules
    // ========================================================

    const schedules =
      await sql`
        SELECT
          s.*

        FROM class_schedules s

        ORDER BY
          s.weekday ASC,
          s.start_time ASC
      `

    // ========================================================
    // Course + Schedules
    // ========================================================

    const result =
      courses.map(
        (course) => {
          const courseSchedules =
            schedules.filter(
              (schedule) => {
                return (
                  Number(
                    schedule
                      .course_id
                  ) ===
                  Number(
                    course.id
                  )
                )
              }
            )

          return {
            ...course,

            schedules:
              courseSchedules,
          }
        }
      )

    return {
      success: true,

      total:
        result.length,

      courses:
        result,
    }
  }
)