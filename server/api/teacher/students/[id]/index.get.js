import {
  getStudentEnrollments,
} from '../../../../services/enrollmentService.js'

import {
  getStudentPackages,
} from '../../../../services/packageService.js'

import {
  requireAuth,
} from '../../../../utils/authSession.js'

import {
  useDatabase,
} from '../../../../utils/db.js'

export default defineEventHandler(
  async (
    event
  ) => {
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
      String(
        getRouterParam(
          event,
          'id'
        ) || ''
      )
        .trim()

    if (!studentId) {
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
    // Enrollment + 多 Schedule
    // ========================================================

    const enrollments =
      await getStudentEnrollments(
        studentId
      )

    // ========================================================
    // Packages
    // ========================================================

    const packages =
      await getStudentPackages(
        studentId
      )

    // ========================================================
    // Attendance
    //
    // Attendance 正式 Service 尚未開始，
    // 這裡暫時只做最近紀錄。
    // ========================================================

    const attendanceRecords =
      await sql`
        SELECT
          a.*,

          cs.class_date,

          cs.start_time,

          cs.end_time,

          p.course_id,

          c.name
            AS course_name

        FROM
          attendance_records_v2 a

        LEFT JOIN
          class_sessions cs

          ON cs.id =
            a.session_id

        LEFT JOIN
          student_packages p

          ON p.id =
            a.package_id

        LEFT JOIN
          dance_courses c

          ON c.id =
            p.course_id

        WHERE
          a.student_id =
            ${studentId}

        ORDER BY
          cs.class_date DESC
            NULLS LAST,

          a.created_at DESC

        LIMIT 20
      `

    // ========================================================
    // Available Courses
    // ========================================================

    const availableCourses =
      await sql`
        SELECT
          *

        FROM
          dance_courses

        WHERE
          status =
            'ACTIVE'

        ORDER BY
          name ASC
      `

    // ========================================================
    // Available Schedules
    // ========================================================

    const availableSchedules =
      await sql`
        SELECT
          *

        FROM
          class_schedules

        WHERE
          status =
            'ACTIVE'

        ORDER BY
          course_id,
          weekday ASC,
          start_time ASC
      `

    // ========================================================
    // Audit
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
        'audit_logs 尚未建立或查詢失敗：',
        error?.message
      )
    }

    // ========================================================
    // Link Code
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
              *

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
          'student_link_codes 尚未建立或查詢失敗：',
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