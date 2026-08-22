import {
  useDatabase,
} from '../utils/db.js'

// ============================================================
// UUID
// ============================================================

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const validateOptionalUuid = (
  value,
  fieldName
) => {
  if (!value) {
    return null
  }

  const normalized =
    String(
      value
    )
      .trim()

  if (
    !UUID_PATTERN.test(
      normalized
    )
  ) {
    throw createError({
      statusCode: 400,

      statusMessage:
        `${fieldName} 格式不正確`,
    })
  }

  return normalized
}

// ============================================================
// Date
// ============================================================

const normalizeOptionalDate = (
  value,
  fieldName
) => {
  if (!value) {
    return null
  }

  const normalized =
    String(
      value
    )
      .trim()

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      normalized
    )
  ) {
    throw createError({
      statusCode: 400,

      statusMessage:
        `${fieldName} 格式必須為 YYYY-MM-DD`,
    })
  }

  return normalized
}

// ============================================================
// Status
// ============================================================

const normalizeStatus = (
  value
) => {
  if (!value) {
    return null
  }

  const status =
    String(
      value
    )
      .trim()
      .toUpperCase()

  if (
    ![
      'ATTENDED',
      'LEAVE',
      'ABSENT',
      'CANCELLED',
    ].includes(
      status
    )
  ) {
    throw createError({
      statusCode: 400,

      statusMessage:
        'Attendance 狀態不正確',
    })
  }

  return status
}

// ============================================================
// Attendance Type
// ============================================================

const normalizeAttendanceType = (
  value
) => {
  if (!value) {
    return null
  }

  const type =
    String(
      value
    )
      .trim()
      .toUpperCase()

  if (
    ![
      'NORMAL',
      'MAKEUP',
      'MANUAL',
    ].includes(
      type
    )
  ) {
    throw createError({
      statusCode: 400,

      statusMessage:
        'Attendance Type 不正確',
    })
  }

  return type
}

// ============================================================
// Record Filter
// ============================================================

const applyRecordFilters = (
  records,
  {
    studentId = null,
    courseId = null,
    status = null,
    attendanceType = null,
    startDate = null,
    endDate = null,
    keyword = '',
  } = {}
) => {
  const normalizedKeyword =
    String(
      keyword || ''
    )
      .trim()
      .toLowerCase()

  return records.filter(
    (
      record
    ) => {
      if (
        studentId &&
        String(
          record.student_id
        ) !==
          String(
            studentId
          )
      ) {
        return false
      }

      if (
        courseId &&
        String(
          record.course_id
        ) !==
          String(
            courseId
          )
      ) {
        return false
      }

      if (
        status &&
        record.status !==
          status
      ) {
        return false
      }

      if (
        attendanceType &&
        record.attendance_type !==
          attendanceType
      ) {
        return false
      }

      if (
        startDate &&
        record.class_date &&
        String(
          record.class_date
        )
          .slice(
            0,
            10
          ) <
          startDate
      ) {
        return false
      }

      if (
        endDate &&
        record.class_date &&
        String(
          record.class_date
        )
          .slice(
            0,
            10
          ) >
          endDate
      ) {
        return false
      }

      if (
        normalizedKeyword
      ) {
        const searchable =
          [
            record.student_name,
            record.course_name,
            record.note,
            record.schedule_name,
          ]
            .filter(
              Boolean
            )
            .join(' ')
            .toLowerCase()

        if (
          !searchable.includes(
            normalizedKeyword
          )
        ) {
          return false
        }
      }

      return true
    }
  )
}

// ============================================================
// Teacher Attendance Page
// ============================================================

export const getTeacherAttendancePageData =
  async ({
    studentId = null,
    courseId = null,
    status = null,
    attendanceType = null,
    startDate = null,
    endDate = null,
    keyword = '',
  } = {}) => {
    const sql =
      useDatabase()

    const normalizedStudentId =
      validateOptionalUuid(
        studentId,
        '學生 ID'
      )

    const normalizedCourseId =
      validateOptionalUuid(
        courseId,
        '課程 ID'
      )

    const normalizedStatus =
      normalizeStatus(
        status
      )

    const normalizedType =
      normalizeAttendanceType(
        attendanceType
      )

    const normalizedStartDate =
      normalizeOptionalDate(
        startDate,
        '開始日期'
      )

    const normalizedEndDate =
      normalizeOptionalDate(
        endDate,
        '結束日期'
      )

    // ========================================================
    // Attendance
    // ========================================================

    const rawRecords =
      await sql`
        SELECT
          a.id,

          a.student_id,

          s.name
            AS student_name,

          a.package_id,

          p.cycle_no
            AS package_cycle_no,

          p.total_sessions
            AS package_total_sessions,

          p.status
            AS package_status,

          a.session_id,

          cs.class_date,

          cs.start_time,

          cs.end_time,

          cs.status
            AS session_status,

          schedule.id
            AS schedule_id,

          schedule.course_id,

          schedule.weekday,

          schedule.name
            AS schedule_name,

          course.name
            AS course_name,

          a.status,

          a.attendance_type,

          a.original_status,

          a.cancelled_at,

          a.note,

          a.created_by,

          creator.role
            AS created_by_role,

          creator.display_name
            AS created_by_name,

          a.created_at,

          a.updated_at

        FROM
          attendance_records_v2 a

        INNER JOIN
          students s

          ON s.id =
            a.student_id

        INNER JOIN
          class_sessions cs

          ON cs.id =
            a.session_id

        INNER JOIN
          class_schedules schedule

          ON schedule.id =
            cs.schedule_id

        INNER JOIN
          dance_courses course

          ON course.id =
            schedule.course_id

        LEFT JOIN
          student_packages p

          ON p.id =
            a.package_id

        LEFT JOIN
          app_users creator

          ON creator.id =
            a.created_by

        ORDER BY
          cs.class_date DESC,
          cs.start_time DESC,
          a.created_at DESC

        LIMIT 1000
      `

    const records =
      applyRecordFilters(
        rawRecords,
        {
          studentId:
            normalizedStudentId,

          courseId:
            normalizedCourseId,

          status:
            normalizedStatus,

          attendanceType:
            normalizedType,

          startDate:
            normalizedStartDate,

          endDate:
            normalizedEndDate,

          keyword,
        }
      )

    // ========================================================
    // Students
    // ========================================================

    const students =
      await sql`
        SELECT
          id,
          name,
          status,
          user_id

        FROM students

        WHERE
          status =
            'ACTIVE'

        ORDER BY
          name ASC
      `

    // ========================================================
    // Courses
    // ========================================================

    const courses =
      await sql`
        SELECT
          id,
          name,
          description,
          status

        FROM
          dance_courses

        WHERE
          status =
            'ACTIVE'

        ORDER BY
          name ASC
      `

    // ========================================================
    // Sessions
    //
    // 給老師建立 Attendance 使用。
    // ========================================================

    const sessions =
      await sql`
        SELECT
          cs.id,

          cs.schedule_id,

          cs.class_date,

          cs.start_time,

          cs.end_time,

          cs.status,

          schedule.course_id,

          schedule.weekday,

          schedule.name
            AS schedule_name,

          course.name
            AS course_name

        FROM
          class_sessions cs

        INNER JOIN
          class_schedules schedule

          ON schedule.id =
            cs.schedule_id

        INNER JOIN
          dance_courses course

          ON course.id =
            schedule.course_id

        WHERE
          cs.status NOT IN (
            'TEACHER_LEAVE',
            'CANCELLED'
          )

          AND
            cs.class_date >=
              CURRENT_DATE -
              INTERVAL '180 days'

          AND
            cs.class_date <=
              CURRENT_DATE +
              INTERVAL '180 days'

        ORDER BY
          cs.class_date DESC,
          cs.start_time ASC

        LIMIT 1000
      `

    return {
      records,

      students,

      courses,

      sessions,
    }
  }

// ============================================================
// Student Attendance Page
// ============================================================

export const getStudentAttendancePageData =
  async ({
    studentId,
    courseId = null,
    status = null,
    startDate = null,
    endDate = null,
  }) => {
    const sql =
      useDatabase()

    const normalizedStudentId =
      validateOptionalUuid(
        studentId,
        '學生 ID'
      )

    if (
      !normalizedStudentId
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '缺少學生 ID',
      })
    }

    const normalizedCourseId =
      validateOptionalUuid(
        courseId,
        '課程 ID'
      )

    const normalizedStatus =
      normalizeStatus(
        status
      )

    const normalizedStartDate =
      normalizeOptionalDate(
        startDate,
        '開始日期'
      )

    const normalizedEndDate =
      normalizeOptionalDate(
        endDate,
        '結束日期'
      )

    // ========================================================
    // Attendance
    // ========================================================

    const rawRecords =
      await sql`
        SELECT
          a.id,

          a.student_id,

          a.package_id,

          p.cycle_no
            AS package_cycle_no,

          p.total_sessions
            AS package_total_sessions,

          a.session_id,

          cs.class_date,

          cs.start_time,

          cs.end_time,

          schedule.id
            AS schedule_id,

          schedule.course_id,

          schedule.weekday,

          schedule.name
            AS schedule_name,

          course.name
            AS course_name,

          a.status,

          a.attendance_type,

          a.original_status,

          a.cancelled_at,

          a.note,

          a.created_at,

          a.updated_at

        FROM
          attendance_records_v2 a

        INNER JOIN
          class_sessions cs

          ON cs.id =
            a.session_id

        INNER JOIN
          class_schedules schedule

          ON schedule.id =
            cs.schedule_id

        INNER JOIN
          dance_courses course

          ON course.id =
            schedule.course_id

        LEFT JOIN
          student_packages p

          ON p.id =
            a.package_id

        WHERE
          a.student_id =
            ${normalizedStudentId}

        ORDER BY
          cs.class_date DESC,
          cs.start_time DESC

        LIMIT 500
      `

    const records =
      applyRecordFilters(
        rawRecords,
        {
          courseId:
            normalizedCourseId,

          status:
            normalizedStatus,

          startDate:
            normalizedStartDate,

          endDate:
            normalizedEndDate,
        }
      )

    // ========================================================
    // Enrollment
    // ========================================================

    const enrollments =
      await sql`
        SELECT
          e.id,
          e.course_id,
          c.name
            AS course_name

        FROM
          student_enrollments e

        INNER JOIN
          dance_courses c

          ON c.id =
            e.course_id

        WHERE
          e.student_id =
            ${normalizedStudentId}

          AND
            e.status =
              'ACTIVE'

        ORDER BY
          c.name ASC
      `

    // ========================================================
    // Available Sessions
    //
    // 未來日期可以先請假。
    // 過去 / 今天可以登記上課。
    // ========================================================

    const availableSessions =
      await sql`
        SELECT
          cs.id,

          cs.schedule_id,

          cs.class_date,

          cs.start_time,

          cs.end_time,

          cs.status,

          schedule.course_id,

          schedule.weekday,

          schedule.name
            AS schedule_name,

          course.name
            AS course_name,

          EXISTS (
            SELECT
              1

            FROM
              student_enrollment_schedules es

            INNER JOIN
              student_enrollments e

              ON e.id =
                es.enrollment_id

            WHERE
              e.student_id =
                ${normalizedStudentId}

              AND
                e.course_id =
                  schedule.course_id

              AND
                es.schedule_id =
                  schedule.id

              AND
                es.status =
                  'ACTIVE'
          )
            AS is_fixed_schedule,

          EXISTS (
            SELECT
              1

            FROM
              attendance_records_v2 existing

            WHERE
              existing.student_id =
                ${normalizedStudentId}

              AND
                existing.session_id =
                  cs.id
          )
            AS has_attendance

        FROM
          class_sessions cs

        INNER JOIN
          class_schedules schedule

          ON schedule.id =
            cs.schedule_id

        INNER JOIN
          dance_courses course

          ON course.id =
            schedule.course_id

        WHERE
          cs.status NOT IN (
            'TEACHER_LEAVE',
            'CANCELLED'
          )

          AND
            cs.class_date >=
              CURRENT_DATE -
              INTERVAL '90 days'

          AND
            cs.class_date <=
              CURRENT_DATE +
              INTERVAL '180 days'

          AND EXISTS (
            SELECT
              1

            FROM
              student_enrollments enrollment

            WHERE
              enrollment.student_id =
                ${normalizedStudentId}

              AND
                enrollment.course_id =
                  schedule.course_id

              AND
                enrollment.status =
                  'ACTIVE'
          )

        ORDER BY
          cs.class_date ASC,
          cs.start_time ASC
      `

    return {
      records,

      enrollments,

      availableSessions:
        availableSessions.filter(
          (
            session
          ) => {
            return (
              !session.has_attendance
            )
          }
        ),
    }
  }