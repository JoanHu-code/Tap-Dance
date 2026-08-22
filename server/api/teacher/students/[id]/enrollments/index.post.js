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
          '只有老師可以新增學生課程',
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

    // ========================================================
    // Body
    // ========================================================

    const body =
      await readBody(
        event
      )

    const courseId =
      Number(
        body?.courseId
      )

    const scheduleId =
      body?.scheduleId
        ? Number(
            body.scheduleId
          )
        : null

    if (
      !courseId ||
      Number.isNaN(
        courseId
      )
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '請選擇課程',
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
          id

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
          '找不到學生',
      })
    }

    // ========================================================
    // Course
    // ========================================================

    const courses =
      await sql`
        SELECT
          *

        FROM dance_courses

        WHERE
          id =
            ${courseId}

        LIMIT 1
      `

    if (
      !courses.length
    ) {
      throw createError({
        statusCode: 404,

        statusMessage:
          '找不到課程',
      })
    }

    const course =
      courses[0]

    // ========================================================
    // Schedule
    // ========================================================

    let schedule =
      null

    if (scheduleId) {
      const schedules =
        await sql`
          SELECT
            *

          FROM class_schedules

          WHERE
            id =
              ${scheduleId}

            AND
              course_id =
              ${courseId}

          LIMIT 1
        `

      if (
        !schedules.length
      ) {
        throw createError({
          statusCode: 400,

          statusMessage:
            '選擇的時段不屬於這門課程',
        })
      }

      schedule =
        schedules[0]
    }

    // ========================================================
    // Duplicate Enrollment
    // ========================================================

    const duplicated =
      await sql`
        SELECT
          *

        FROM
          student_enrollments

        WHERE
          student_id =
            ${studentId}

          AND
            course_id =
            ${courseId}

        LIMIT 1
      `

    if (
      duplicated.length
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '學生已經加入這門課程',
      })
    }

    // ========================================================
    // INSERT
    // ========================================================

    const inserted =
      await sql`
        INSERT INTO
          student_enrollments (
            student_id,
            course_id,
            default_schedule_id
          )

        VALUES (
          ${studentId},
          ${courseId},
          ${scheduleId}
        )

        RETURNING
          *
      `

    const enrollment =
      inserted[0]

    // ========================================================
    // After Snapshot
    // ========================================================

    const afterData = {
      ...enrollment,

      course_name:
        course.name,

      schedule,
    }

    // ========================================================
    // Audit
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
            course_id,
            before_data,
            after_data,
            created_at
          )

        VALUES (
          ${user.id},
          'TEACHER',
          'CREATE',
          'ENROLLMENT',
          ${String(
            enrollment.id
          )},
          ${studentId},
          ${courseId},
          NULL,
          ${JSON.stringify(
            afterData
          )}::jsonb,
          NOW()
        )
      `
    } catch (error) {
      console.warn(
        'Enrollment Audit Log 寫入失敗：',
        error?.message
      )
    }

    // ========================================================
    // Response
    // ========================================================

    return {
      success: true,

      message:
        '學生已加入課程',

      enrollment:
        afterData,
    }
  }
)