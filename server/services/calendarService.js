import {
  useDatabase,
} from '../utils/db.js'

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
// Date
// ============================================================

const normalizeDate = (
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
        `${fieldName} 必須為 YYYY-MM-DD`,
    })
  }

  return normalized
}

// ============================================================
// Taipei Today / Time
// ============================================================

const getTaipeiNowParts =
  () => {
    const formatter =
      new Intl.DateTimeFormat(
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

          hour:
            '2-digit',

          minute:
            '2-digit',

          second:
            '2-digit',

          hourCycle:
            'h23',
        }
      )

    const parts =
      formatter.formatToParts(
        new Date()
      )

    const values = {}

    for (
      const part of
      parts
    ) {
      if (
        part.type !==
        'literal'
      ) {
        values[
          part.type
        ] =
          part.value
      }
    }

    return {
      date:
        `${values.year}-${values.month}-${values.day}`,

      time:
        `${values.hour}:${values.minute}:${values.second}`,
    }
  }

// ============================================================
// Date Offset
// ============================================================

const addDays = (
  dateString,
  days
) => {
  const [
    year,
    month,
    day,
  ] =
    String(
      dateString
    )
      .split('-')
      .map(
        Number
      )

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    )

  date.setUTCDate(
    date.getUTCDate() +
    days
  )

  const outputYear =
    date.getUTCFullYear()

  const outputMonth =
    String(
      date.getUTCMonth() +
      1
    )
      .padStart(
        2,
        '0'
      )

  const outputDay =
    String(
      date.getUTCDate()
    )
      .padStart(
        2,
        '0'
      )

  return `${outputYear}-${outputMonth}-${outputDay}`
}

// ============================================================
// Default Date Range
// ============================================================

const resolveDateRange =
  (
    startDate,
    endDate,
    {
      defaultBackwardDays = 30,
      defaultForwardDays = 90,
    } = {}
  ) => {
    const now =
      getTaipeiNowParts()

    const normalizedStart =
      normalizeDate(
        startDate,
        '開始日期'
      ) ||
      addDays(
        now.date,
        -defaultBackwardDays
      )

    const normalizedEnd =
      normalizeDate(
        endDate,
        '結束日期'
      ) ||
      addDays(
        now.date,
        defaultForwardDays
      )

    if (
      normalizedStart >
      normalizedEnd
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '開始日期不可晚於結束日期',
      })
    }

    return {
      startDate:
        normalizedStart,

      endDate:
        normalizedEnd,
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
      '學生 ID'
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

    return students[0]
  }

// ============================================================
// Status Summary
// ============================================================

const buildStatusSummary =
  (
    sessions
  ) => {
    return {
      total:
        sessions.length,

      scheduled:
        sessions.filter(
          (
            item
          ) => {
            return (
              item.status ===
              'SCHEDULED'
            )
          }
        ).length,

      completed:
        sessions.filter(
          (
            item
          ) => {
            return (
              item.status ===
              'COMPLETED'
            )
          }
        ).length,

      teacherLeave:
        sessions.filter(
          (
            item
          ) => {
            return (
              item.status ===
              'TEACHER_LEAVE'
            )
          }
        ).length,

      cancelled:
        sessions.filter(
          (
            item
          ) => {
            return (
              item.status ===
              'CANCELLED'
            )
          }
        ).length,
    }
  }

// ============================================================
// Student Calendar
//
// 只抓學生固定班別。
//
//
// 例如學生踢踏舞固定：
//
// 星期二 19:00
// 星期六 14:00
//
// 即使同一門 Course 還有星期四班，
// 也不會出現在「我的課表」。
// ============================================================

export const getStudentCalendar =
  async ({
    studentId,
    startDate = null,
    endDate = null,
  }) => {
    const sql =
      useDatabase()

    const student =
      await requireStudent(
        sql,
        studentId
      )

    const range =
      resolveDateRange(
        startDate,
        endDate,
        {
          defaultBackwardDays:
            30,

          defaultForwardDays:
            90,
        }
      )

    // ========================================================
    // Student Fixed Sessions
    // ========================================================

    const sessions =
      await sql`
        SELECT DISTINCT
          cs.id,

          cs.schedule_id,

          cs.class_date,

          cs.start_time,

          cs.end_time,

          cs.status,

          cs.teacher_note,

          schedule.course_id,

          schedule.weekday,

          schedule.name
            AS schedule_name,

          course.name
            AS course_name,

          enrollment.id
            AS enrollment_id,

          enrollment_schedule.is_primary,

          EXISTS (
            SELECT
              1

            FROM
              attendance_records_v2 attendance

            WHERE
              attendance.student_id =
                ${studentId}

              AND
                attendance.session_id =
                  cs.id
          )
            AS has_attendance

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

        INNER JOIN
          dance_courses course

          ON course.id =
            enrollment.course_id

        INNER JOIN
          class_sessions cs

          ON cs.schedule_id =
            schedule.id

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
            cs.class_date >=
              ${range.startDate}

          AND
            cs.class_date <=
              ${range.endDate}

        ORDER BY
          cs.class_date ASC,
          cs.start_time ASC,
          course.name ASC
      `

    // ========================================================
    // Next Class
    //
    // TEACHER_LEAVE / CANCELLED 不算下一堂真正要上的課。
    //
    // COMPLETED 也不算。
    // ========================================================

    const now =
      getTaipeiNowParts()

    const nextClass =
      sessions.find(
        (
          session
        ) => {
          if (
            session.status !==
            'SCHEDULED'
          ) {
            return false
          }

          const classDate =
            String(
              session.class_date
            )
              .slice(
                0,
                10
              )

          const startTime =
            String(
              session.start_time ||
              '00:00:00'
            )

          if (
            classDate >
            now.date
          ) {
            return true
          }

          if (
            classDate <
            now.date
          ) {
            return false
          }

          return (
            startTime >=
            now.time
          )
        }
      ) ||
      null

    // ========================================================
    // Upcoming Teacher Leave
    //
    // 讓學生首頁未來可以直接顯示：
    //
    // 8/29 踢踏舞老師請假
    // ========================================================

    const upcomingTeacherLeaves =
      sessions.filter(
        (
          session
        ) => {
          if (
            session.status !==
            'TEACHER_LEAVE'
          ) {
            return false
          }

          const classDate =
            String(
              session.class_date
            )
              .slice(
                0,
                10
              )

          return (
            classDate >=
            now.date
          )
        }
      )

    // ========================================================
    // Courses
    // ========================================================

    const courseMap =
      new Map()

    for (
      const session of
      sessions
    ) {
      const courseId =
        String(
          session.course_id
        )

      if (
        !courseMap.has(
          courseId
        )
      ) {
        courseMap.set(
          courseId,
          {
            courseId:
              session.course_id,

            courseName:
              session.course_name,

            sessions: [],
          }
        )
      }

      courseMap
        .get(
          courseId
        )
        .sessions
        .push(
          session
        )
    }

    return {
      student,

      range,

      summary:
        buildStatusSummary(
          sessions
        ),

      nextClass,

      upcomingTeacherLeaves,

      courses:
        Array.from(
          courseMap.values()
        ),

      sessions,
    }
  }

// ============================================================
// Teacher Calendar
// ============================================================

export const getTeacherCalendar =
  async ({
    startDate = null,
    endDate = null,
    courseId = null,
    scheduleId = null,
  } = {}) => {
    const sql =
      useDatabase()

    const range =
      resolveDateRange(
        startDate,
        endDate,
        {
          defaultBackwardDays:
            14,

          defaultForwardDays:
            60,
        }
      )

    const normalizedCourseId =
      courseId
        ? String(
            courseId
          )
            .trim()
        : null

    const normalizedScheduleId =
      scheduleId
        ? String(
            scheduleId
          )
            .trim()
        : null

    if (
      normalizedCourseId
    ) {
      assertUuid(
        normalizedCourseId,
        'Course ID'
      )
    }

    if (
      normalizedScheduleId
    ) {
      assertUuid(
        normalizedScheduleId,
        'Schedule ID'
      )
    }

    // ========================================================
    // Sessions
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

          cs.teacher_note,

          schedule.course_id,

          schedule.weekday,

          schedule.name
            AS schedule_name,

          course.name
            AS course_name,

          (
            SELECT
              COUNT(*)::INTEGER

            FROM
              attendance_records_v2 attendance

            WHERE
              attendance.session_id =
                cs.id

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
                cs.id

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
                cs.id

              AND
                attendance.status =
                  'ABSENT'
          )
            AS absent_count

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
          cs.class_date >=
            ${range.startDate}

          AND
            cs.class_date <=
              ${range.endDate}

          AND (
            ${normalizedCourseId}::uuid
              IS NULL

            OR
              schedule.course_id =
                ${normalizedCourseId}
          )

          AND (
            ${normalizedScheduleId}::uuid
              IS NULL

            OR
              cs.schedule_id =
                ${normalizedScheduleId}
          )

        ORDER BY
          cs.class_date ASC,
          cs.start_time ASC,
          course.name ASC
      `

    // ========================================================
    // Courses
    // ========================================================

    const courses =
      await sql`
        SELECT
          id,
          name,
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
    // Schedules
    // ========================================================

    const schedules =
      await sql`
        SELECT
          schedule.*,

          course.name
            AS course_name

        FROM
          class_schedules schedule

        INNER JOIN
          dance_courses course

          ON course.id =
            schedule.course_id

        WHERE
          schedule.status =
            'ACTIVE'

        ORDER BY
          course.name ASC,
          schedule.weekday ASC,
          schedule.start_time ASC
      `

    return {
      range,

      summary:
        buildStatusSummary(
          sessions
        ),

      sessions,

      courses,

      schedules,
    }
  }