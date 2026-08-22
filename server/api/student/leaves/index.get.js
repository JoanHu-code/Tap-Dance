import {
  requireAuth,
} from '../../../utils/authSession.js'

import {
  useDatabase,
} from '../../../utils/db.js'

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
// Taipei Today
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
// Date + Days
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

  return [
    date.getUTCFullYear(),

    String(
      date.getUTCMonth() +
      1
    ).padStart(
      2,
      '0'
    ),

    String(
      date.getUTCDate()
    ).padStart(
      2,
      '0'
    ),
  ].join('-')
}

// ============================================================
// API
// ============================================================

export default defineEventHandler(
  async (
    event
  ) => {
    // ========================================================
    // Student Auth
    // ========================================================

    const user =
      await requireAuth(
        event
      )

    if (
      user.role !==
      'STUDENT'
    ) {
      throw createError({
        statusCode: 403,

        statusMessage:
          '只有學生可以查看自己的請假紀錄',
      })
    }

    const sql =
      useDatabase()

    // ========================================================
    // Login User → Student
    // ========================================================

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
          user_id =
            ${user.id}

        LIMIT 1
      `

    if (
      !students.length
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '此 LINE 帳號尚未綁定學生資料',
      })
    }

    const student =
      students[0]

    if (
      student.status !==
      'ACTIVE'
    ) {
      throw createError({
        statusCode: 403,

        statusMessage:
          '學生資料目前未啟用',
      })
    }

    // ========================================================
    // Query
    // ========================================================

    const query =
      getQuery(
        event
      )

    const courseId =
      validateOptionalUuid(
        query.courseId,
        'Course ID'
      )

    const startDate =
      normalizeOptionalDate(
        query.startDate,
        '開始日期'
      )

    const endDate =
      normalizeOptionalDate(
        query.endDate,
        '結束日期'
      )

    const requestedStatus =
      query.status
        ? String(
            query.status
          )
            .trim()
            .toUpperCase()
        : null

    if (
      requestedStatus &&
      ![
        'ACTIVE',
        'CANCELLED',
      ].includes(
        requestedStatus
      )
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          'Leave status 不正確',
      })
    }

    // ========================================================
    // Leave Batches
    // ========================================================

    const batches =
      await sql`
        SELECT
          batch.*,

          course.name
            AS course_name,

          creator.role
            AS created_by_role,

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

        LEFT JOIN
          app_users creator

          ON creator.id =
            batch.created_by

        WHERE
          batch.student_id =
            ${student.id}

          AND (
            ${courseId}::uuid
              IS NULL

            OR
              batch.course_id =
                ${courseId}
          )

          AND (
            ${requestedStatus}::text
              IS NULL

            OR
              batch.status =
                ${requestedStatus}
          )

          AND (
            ${startDate}::date
              IS NULL

            OR
              batch.created_at::date >=
                ${startDate}
          )

          AND (
            ${endDate}::date
              IS NULL

            OR
              batch.created_at::date <=
                ${endDate}
          )

        ORDER BY
          batch.created_at DESC
      `

    const result = []

    for (
      const batch of
      batches
    ) {
      const items =
        await sql`
          SELECT
            item.id,

            item.batch_id,

            item.class_date,

            item.schedule_id,

            item.session_id,

            item.attendance_id,

            item.created_at,

            session.start_time,

            session.end_time,

            session.status
              AS session_status,

            schedule.weekday,

            schedule.name
              AS schedule_name,

            attendance.status
              AS attendance_status,

            attendance.note
              AS attendance_note

          FROM
            leave_batch_items item

          LEFT JOIN
            class_sessions session

            ON session.id =
              item.session_id

          LEFT JOIN
            class_schedules schedule

            ON schedule.id =
              item.schedule_id

          LEFT JOIN
            attendance_records_v2 attendance

            ON attendance.id =
              item.attendance_id

          WHERE
            item.batch_id =
              ${batch.id}

          ORDER BY
            item.class_date ASC,
            session.start_time ASC
        `

      result.push({
        ...batch,

        items,
      })
    }

    // ========================================================
    // Enrollments
    // ========================================================

    const enrollments =
      await sql`
        SELECT
          enrollment.id,

          enrollment.course_id,

          course.name
            AS course_name

        FROM
          student_enrollments enrollment

        INNER JOIN
          dance_courses course

          ON course.id =
            enrollment.course_id

        WHERE
          enrollment.student_id =
            ${student.id}

          AND
            enrollment.status =
              'ACTIVE'

        ORDER BY
          course.name ASC
      `

    // ========================================================
    // 可請假的 Session
    //
    // 顯示：
    //
    // 今天往前 30 天
    // 到未來一年
    //
    // 沒有中午 12 點限制。
    // ========================================================

    const today =
      getTaipeiDate()

    const rangeStart =
      addDays(
        today,
        -30
      )

    const rangeEnd =
      addDays(
        today,
        365
      )

    const sessions =
      await sql`
        SELECT
          session.id,

          session.schedule_id,

          session.class_date,

          session.start_time,

          session.end_time,

          session.status,

          schedule.course_id,

          schedule.weekday,

          schedule.name
            AS schedule_name,

          course.name
            AS course_name,

          enrollment.id
            AS enrollment_id,

          enrollment_schedule.is_primary,

          existing_attendance.id
            AS attendance_id,

          existing_attendance.status
            AS attendance_status

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
          class_sessions session

          ON session.schedule_id =
            schedule.id

        LEFT JOIN
          attendance_records_v2
            existing_attendance

          ON existing_attendance.student_id =
            ${student.id}

          AND
            existing_attendance.session_id =
              session.id

        WHERE
          enrollment.student_id =
            ${student.id}

          AND
            enrollment.status =
              'ACTIVE'

          AND
            enrollment_schedule.status =
              'ACTIVE'

          AND
            session.status NOT IN (
              'TEACHER_LEAVE',
              'CANCELLED'
            )

          AND
            session.class_date >=
              ${rangeStart}

          AND
            session.class_date <=
              ${rangeEnd}

          AND (
            existing_attendance.id
              IS NULL

            OR
              existing_attendance.status IN (
                'ATTENDED',
                'ABSENT',
                'LEAVE'
              )
          )

        ORDER BY
          session.class_date ASC,
          session.start_time ASC
      `

    // ========================================================
    // Summary
    // ========================================================

    const summary = {
      total:
        result.length,

      active:
        result.filter(
          (
            batch
          ) => {
            return (
              batch.status ===
              'ACTIVE'
            )
          }
        ).length,

      cancelled:
        result.filter(
          (
            batch
          ) => {
            return (
              batch.status ===
              'CANCELLED'
            )
          }
        ).length,

      totalSessions:
        result.reduce(
          (
            total,
            batch
          ) => {
            return (
              total +
              Number(
                batch.item_count ||
                batch.items
                  ?.length ||
                0
              )
            )
          },
          0
        ),
    }

    return {
      success: true,

      student,

      summary,

      batches:
        result,

      enrollments,

      sessions,
    }
  }
)