import {
  useDatabase,
} from '../utils/db.js'

// ============================================================
// Taipei Date
// ============================================================

const getTaipeiDate =
  () => {
    return new Intl
      .DateTimeFormat(
        'en-CA',
        {
          timeZone:
            'Asia/Taipei',

          year:
            'numeric',

          month:
            '2-digit',

          day:
            '2-digit',
        }
      )
      .format(
        new Date()
      )
  }

// ============================================================
// UUID
// ============================================================

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const assertUuid = (
  value,
  fieldName
) => {
  if (
    !UUID_PATTERN.test(
      String(
        value || ''
      )
    )
  ) {
    throw createError({
      statusCode: 400,

      statusMessage:
        `${fieldName} 格式不正確`,
    })
  }
}

// ============================================================
// Student
// ============================================================

const requireStudent =
  async (
    sql,
    studentId
  ) => {
    assertUuid(
      studentId,
      'Student ID'
    )

    const students =
      await sql`
        SELECT
          id,
          name,
          user_id,
          status

        FROM
          students

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

    if (
      students[0].status !==
      'ACTIVE'
    ) {
      throw createError({
        statusCode: 403,

        statusMessage:
          '學生資料目前未啟用',
      })
    }

    return students[0]
  }

// ============================================================
// Teacher Dashboard
// ============================================================

export const getTeacherDashboard =
  async () => {
    const sql =
      useDatabase()

    const today =
      getTaipeiDate()

    // ========================================================
    // Today Sessions
    // ========================================================

    const todaySessions =
      await sql`
        SELECT
          session.id,

          session.class_date,

          session.start_time,

          session.end_time,

          session.status,

          session.teacher_note,

          schedule.id
            AS schedule_id,

          schedule.name
            AS schedule_name,

          schedule.weekday,

          schedule.capacity,

          course.id
            AS course_id,

          course.name
            AS course_name,

          (
            SELECT
              COUNT(*)::INTEGER

            FROM
              attendance_records_v2 attendance

            WHERE
              attendance.session_id =
                session.id

              AND
                attendance.status =
                  'ATTENDED'
          )
            AS attended_count,

          (
            SELECT
              COUNT(*)::INTEGER

            FROM
              attendance_records_v2 attendance

            WHERE
              attendance.session_id =
                session.id

              AND
                attendance.status =
                  'LEAVE'
          )
            AS leave_count,

          (
            SELECT
              COUNT(*)::INTEGER

            FROM
              attendance_records_v2 attendance

            WHERE
              attendance.session_id =
                session.id

              AND
                attendance.status =
                  'ABSENT'
          )
            AS absent_count

        FROM
          class_sessions session

        INNER JOIN
          class_schedules schedule

          ON schedule.id =
            session.schedule_id

        INNER JOIN
          dance_courses course

          ON course.id =
            schedule.course_id

        WHERE
          session.class_date =
            ${today}

        ORDER BY
          session.start_time ASC
      `

    // ========================================================
    // Next Session
    // ========================================================

    const nextSessions =
      await sql`
        SELECT
          session.id,

          session.class_date,

          session.start_time,

          session.end_time,

          session.status,

          schedule.name
            AS schedule_name,

          course.id
            AS course_id,

          course.name
            AS course_name

        FROM
          class_sessions session

        INNER JOIN
          class_schedules schedule

          ON schedule.id =
            session.schedule_id

        INNER JOIN
          dance_courses course

          ON course.id =
            schedule.course_id

        WHERE
          session.status =
            'SCHEDULED'

          AND (
            session.class_date >
              ${today}

            OR (
              session.class_date =
                ${today}

              AND
                session.end_time >
                  (
                    NOW()
                    AT TIME ZONE
                    'Asia/Taipei'
                  )::time
            )
          )

        ORDER BY
          session.class_date ASC,
          session.start_time ASC

        LIMIT 1
      `

    // ========================================================
    // Package Summary
    // ========================================================

    const packages =
      await sql`
        SELECT
          package.id,

          package.student_id,

          student.name
            AS student_name,

          package.course_id,

          course.name
            AS course_name,

          package.cycle_no,

          package.total_sessions,

          package.price,

          package.paid,

          package.status,

          package.start_date,

          package.created_at,

          COALESCE(
            COUNT(attendance.id)
              FILTER (
                WHERE
                  attendance.status =
                    'ATTENDED'
              ),
            0
          )::INTEGER
            AS attended_count

        FROM
          student_packages package

        INNER JOIN
          students student

          ON student.id =
            package.student_id

        INNER JOIN
          dance_courses course

          ON course.id =
            package.course_id

        LEFT JOIN
          attendance_records_v2 attendance

          ON attendance.package_id =
            package.id

        WHERE
          package.status IN (
            'ACTIVE',
            'COMPLETED'
          )

        GROUP BY
          package.id,
          student.id,
          course.id

        ORDER BY
          student.name ASC,
          course.name ASC,
          package.cycle_no DESC
      `

    // ========================================================
    // Current Package per Student + Course
    // ========================================================

    const currentPackageMap =
      new Map()

    for (
      const packageData of
      packages
    ) {
      const key =
        `${packageData.student_id}:${packageData.course_id}`

      if (
        !currentPackageMap.has(
          key
        )
      ) {
        currentPackageMap.set(
          key,
          packageData
        )
      }
    }

    const currentPackages =
      Array.from(
        currentPackageMap.values()
      )

    const renewRequired =
      currentPackages
        .filter(
          (
            packageData
          ) => {
            return (
              Number(
                packageData
                  .attended_count ||
                0
              ) >=
              Number(
                packageData
                  .total_sessions ||
                0
              )
            )
          }
        )

    // ========================================================
    // Pending Makeup
    //
    // LEAVE 且沒有 ACTIVE Makeup。
    // ========================================================

    const pendingMakeups =
      await sql`
        SELECT
          attendance.id
            AS attendance_id,

          attendance.student_id,

          student.name
            AS student_name,

          attendance.package_id,

          session.id
            AS session_id,

          session.class_date,

          session.start_time,

          schedule.course_id,

          schedule.name
            AS schedule_name,

          course.name
            AS course_name

        FROM
          attendance_records_v2 attendance

        INNER JOIN
          students student

          ON student.id =
            attendance.student_id

        INNER JOIN
          class_sessions session

          ON session.id =
            attendance.session_id

        INNER JOIN
          class_schedules schedule

          ON schedule.id =
            session.schedule_id

        INNER JOIN
          dance_courses course

          ON course.id =
            schedule.course_id

        WHERE
          attendance.status =
            'LEAVE'

          AND NOT EXISTS (
            SELECT
              1

            FROM
              makeup_records makeup

            WHERE
              makeup.source_leave_attendance_id =
                attendance.id

              AND
                makeup.status =
                  'ACTIVE'
          )

        ORDER BY
          session.class_date DESC,
          student.name ASC

        LIMIT 20
      `

    // ========================================================
    // Recent Leaves
    // ========================================================

    const recentLeaves =
      await sql`
        SELECT
          batch.id,

          batch.student_id,

          student.name
            AS student_name,

          batch.course_id,

          course.name
            AS course_name,

          batch.reason,

          batch.status,

          batch.created_at,

          (
            SELECT
              COUNT(*)::INTEGER

            FROM
              leave_batch_items item

            WHERE
              item.batch_id =
                batch.id
          )
            AS item_count

        FROM
          leave_batches batch

        INNER JOIN
          students student

          ON student.id =
            batch.student_id

        INNER JOIN
          dance_courses course

          ON course.id =
            batch.course_id

        ORDER BY
          batch.created_at DESC

        LIMIT 10
      `

    // ========================================================
    // Recent Audit
    // ========================================================

    const recentAudit =
      await sql`
        SELECT
          audit.id,

          audit.actor_role,

          audit.action,

          audit.entity_type,

          audit.student_id,

          audit.course_id,

          audit.note,

          audit.created_at,

          student.name
            AS student_name,

          course.name
            AS course_name

        FROM
          audit_logs audit

        LEFT JOIN
          students student

          ON student.id =
            audit.student_id

        LEFT JOIN
          dance_courses course

          ON course.id =
            audit.course_id

        ORDER BY
          audit.created_at DESC

        LIMIT 8
      `

    // ========================================================
    // Counts
    // ========================================================

    const todaySummary =
      todaySessions.reduce(
        (
          summary,
          session
        ) => {
          summary.sessions +=
            1

          summary.attended +=
            Number(
              session.attended_count ||
              0
            )

          summary.leave +=
            Number(
              session.leave_count ||
              0
            )

          summary.absent +=
            Number(
              session.absent_count ||
              0
            )

          return summary
        },
        {
          sessions: 0,
          attended: 0,
          leave: 0,
          absent: 0,
        }
      )

    return {
      today,

      todaySummary,

      todaySessions,

      nextSession:
        nextSessions[0] ||
        null,

      renewRequired,

      pendingMakeups,

      recentLeaves,

      recentAudit,
    }
  }

// ============================================================
// Student Dashboard
// ============================================================

export const getStudentDashboard =
  async (
    studentId
  ) => {
    const sql =
      useDatabase()

    const student =
      await requireStudent(
        sql,
        studentId
      )

    const today =
      getTaipeiDate()

    // ========================================================
    // Active Enrollments
    // ========================================================

    const enrollments =
      await sql`
        SELECT
          enrollment.id,

          enrollment.course_id,

          course.name
            AS course_name,

          enrollment.default_schedule_id,

          enrollment.joined_at

        FROM
          student_enrollments enrollment

        INNER JOIN
          dance_courses course

          ON course.id =
            enrollment.course_id

        WHERE
          enrollment.student_id =
            ${studentId}

          AND
            enrollment.status =
              'ACTIVE'

        ORDER BY
          course.name ASC
      `

    // ========================================================
    // Fixed Schedules
    // ========================================================

    const schedules =
      await sql`
        SELECT
          enrollment.id
            AS enrollment_id,

          enrollment.course_id,

          enrollment_schedule.schedule_id,

          enrollment_schedule.is_primary,

          schedule.weekday,

          schedule.start_time,

          schedule.end_time,

          schedule.name
            AS schedule_name

        FROM
          student_enrollments enrollment

        INNER JOIN
          student_enrollment_schedules
            enrollment_schedule

          ON enrollment_schedule.enrollment_id =
            enrollment.id

        INNER JOIN
          class_schedules schedule

          ON schedule.id =
            enrollment_schedule.schedule_id

        WHERE
          enrollment.student_id =
            ${studentId}

          AND
            enrollment.status =
              'ACTIVE'

          AND
            enrollment_schedule.status =
              'ACTIVE'

        ORDER BY
          enrollment.course_id ASC,
          enrollment_schedule.is_primary DESC,
          schedule.weekday ASC,
          schedule.start_time ASC
      `

    // ========================================================
    // Packages
    // ========================================================

    const packages =
      await sql`
        SELECT
          package.id,

          package.course_id,

          course.name
            AS course_name,

          package.cycle_no,

          package.start_date,

          package.total_sessions,

          package.price,

          package.paid,

          package.paid_at,

          package.status,

          package.completion_reason,

          package.created_at,

          COALESCE(
            COUNT(attendance.id)
              FILTER (
                WHERE
                  attendance.status =
                    'ATTENDED'
              ),
            0
          )::INTEGER
            AS attended_count

        FROM
          student_packages package

        INNER JOIN
          dance_courses course

          ON course.id =
            package.course_id

        LEFT JOIN
          attendance_records_v2 attendance

          ON attendance.package_id =
            package.id

        WHERE
          package.student_id =
            ${studentId}

          AND
            package.status <>
              'CANCELLED'

        GROUP BY
          package.id,
          course.id

        ORDER BY
          package.course_id ASC,
          package.cycle_no DESC,
          package.created_at DESC
      `

    // ========================================================
    // Current Package per Course
    // ========================================================

    const currentPackageByCourse =
      new Map()

    for (
      const packageData of
      packages
    ) {
      const key =
        String(
          packageData.course_id
        )

      if (
        !currentPackageByCourse.has(
          key
        )
      ) {
        currentPackageByCourse.set(
          key,
          packageData
        )
      }
    }

    // ========================================================
    // Course Cards
    // ========================================================

    const courses =
      enrollments.map(
        (
          enrollment
        ) => {
          const packageData =
            currentPackageByCourse.get(
              String(
                enrollment.course_id
              )
            ) ||
            null

          const courseSchedules =
            schedules.filter(
              (
                schedule
              ) => {
                return (
                  String(
                    schedule.course_id
                  ) ===
                  String(
                    enrollment.course_id
                  )
                )
              }
            )

          const attended =
            Number(
              packageData
                ?.attended_count ||
              0
            )

          const total =
            Number(
              packageData
                ?.total_sessions ||
              0
            )

          return {
            ...enrollment,

            schedules:
              courseSchedules,

            package:
              packageData,

            attendedCount:
              attended,

            totalSessions:
              total,

            remainingSessions:
              Math.max(
                total -
                attended,
                0
              ),

            canRenew:
              Boolean(
                packageData &&
                total >
                  0 &&
                attended >=
                  total
              ),
          }
        }
      )

    // ========================================================
    // Next Student Session
    //
    // 只找學生 Active Enrollment Course。
    // ========================================================

    const nextSessions =
      await sql`
        SELECT
          session.id,

          session.class_date,

          session.start_time,

          session.end_time,

          session.status,

          schedule.id
            AS schedule_id,

          schedule.name
            AS schedule_name,

          schedule.course_id,

          course.name
            AS course_name,

          EXISTS (
            SELECT
              1

            FROM
              student_enrollment_schedules
                enrollment_schedule

            INNER JOIN
              student_enrollments enrollment

              ON enrollment.id =
                enrollment_schedule.enrollment_id

            WHERE
              enrollment.student_id =
                ${studentId}

              AND
                enrollment.status =
                  'ACTIVE'

              AND
                enrollment_schedule.status =
                  'ACTIVE'

              AND
                enrollment_schedule.schedule_id =
                  schedule.id
          )
            AS is_fixed_schedule

        FROM
          class_sessions session

        INNER JOIN
          class_schedules schedule

          ON schedule.id =
            session.schedule_id

        INNER JOIN
          dance_courses course

          ON course.id =
            schedule.course_id

        WHERE
          session.status =
            'SCHEDULED'

          AND EXISTS (
            SELECT
              1

            FROM
              student_enrollments enrollment

            WHERE
              enrollment.student_id =
                ${studentId}

              AND
                enrollment.course_id =
                  schedule.course_id

              AND
                enrollment.status =
                  'ACTIVE'
          )

          AND (
            session.class_date >
              ${today}

            OR (
              session.class_date =
                ${today}

              AND
                session.end_time >
                  (
                    NOW()
                    AT TIME ZONE
                    'Asia/Taipei'
                  )::time
            )
          )

        ORDER BY
          session.class_date ASC,
          session.start_time ASC

        LIMIT 1
      `

    // ========================================================
    // Pending Makeup Leaves
    // ========================================================

    const pendingMakeups =
      await sql`
        SELECT
          attendance.id
            AS attendance_id,

          attendance.package_id,

          session.id
            AS session_id,

          session.class_date,

          session.start_time,

          schedule.course_id,

          schedule.name
            AS schedule_name,

          course.name
            AS course_name

        FROM
          attendance_records_v2 attendance

        INNER JOIN
          class_sessions session

          ON session.id =
            attendance.session_id

        INNER JOIN
          class_schedules schedule

          ON schedule.id =
            session.schedule_id

        INNER JOIN
          dance_courses course

          ON course.id =
            schedule.course_id

        WHERE
          attendance.student_id =
            ${studentId}

          AND
            attendance.status =
              'LEAVE'

          AND NOT EXISTS (
            SELECT
              1

            FROM
              makeup_records makeup

            WHERE
              makeup.source_leave_attendance_id =
                attendance.id

              AND
                makeup.status =
                  'ACTIVE'
          )

        ORDER BY
          session.class_date DESC

        LIMIT 10
      `

    // ========================================================
    // Recent Leaves
    // ========================================================

    const recentLeaves =
      await sql`
        SELECT
          batch.id,

          batch.course_id,

          course.name
            AS course_name,

          batch.reason,

          batch.status,

          batch.created_at,

          batch.cancelled_at,

          (
            SELECT
              COUNT(*)::INTEGER

            FROM
              leave_batch_items item

            WHERE
              item.batch_id =
                batch.id
          )
            AS item_count

        FROM
          leave_batches batch

        INNER JOIN
          dance_courses course

          ON course.id =
            batch.course_id

        WHERE
          batch.student_id =
            ${studentId}

        ORDER BY
          batch.created_at DESC

        LIMIT 5
      `

    // ========================================================
    // Recent Makeups
    // ========================================================

    const recentMakeups =
      await sql`
        SELECT
          makeup.id,

          makeup.course_id,

          course.name
            AS course_name,

          makeup.status,

          makeup.note,

          makeup.created_at,

          source_session.class_date
            AS source_class_date,

          makeup_session.class_date
            AS makeup_class_date,

          makeup_session.start_time
            AS makeup_start_time

        FROM
          makeup_records makeup

        INNER JOIN
          dance_courses course

          ON course.id =
            makeup.course_id

        INNER JOIN
          class_sessions source_session

          ON source_session.id =
            makeup.source_session_id

        INNER JOIN
          class_sessions makeup_session

          ON makeup_session.id =
            makeup.makeup_session_id

        WHERE
          makeup.student_id =
            ${studentId}

        ORDER BY
          makeup.created_at DESC

        LIMIT 5
      `

    // ========================================================
    // Recent Audit
    //
    // 學生 Dashboard 也直接看到自己的 Timeline Preview。
    // ========================================================

    const recentAudit =
      await sql`
        SELECT
          audit.id,

          audit.actor_role,

          audit.action,

          audit.entity_type,

          audit.note,

          audit.created_at,

          course.name
            AS course_name

        FROM
          audit_logs audit

        LEFT JOIN
          dance_courses course

          ON course.id =
            audit.course_id

        WHERE
          audit.student_id =
            ${studentId}

        ORDER BY
          audit.created_at DESC

        LIMIT 5
      `

    return {
      today,

      student,

      courses,

      nextSession:
        nextSessions[0] ||
        null,

      pendingMakeups,

      recentLeaves,

      recentMakeups,

      recentAudit,
    }
  }