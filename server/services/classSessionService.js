import {
  useDatabase,
} from '../utils/db.js'

import {
  createAuditQuery,
} from './auditService.js'

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

const normalizeOptionalUuid = (
  value,
  fieldName
) => {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return null
  }

  const normalized =
    String(
      value
    ).trim()

  assertUuid(
    normalized,
    fieldName
  )

  return normalized
}

// ============================================================
// Date
// ============================================================

const DATE_PATTERN =
  /^\d{4}-\d{2}-\d{2}$/

const assertDate = (
  value,
  fieldName
) => {
  const normalized =
    String(
      value || ''
    ).trim()

  if (
    !DATE_PATTERN.test(
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

const normalizeOptionalDate = (
  value,
  fieldName
) => {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return null
  }

  return assertDate(
    value,
    fieldName
  )
}

// ============================================================
// Taipei Date
// ============================================================

export const getTaipeiDate =
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
// Add Days
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
    dateString
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
// Date Difference
// ============================================================

const getDateDifference = (
  startDate,
  endDate
) => {
  const start =
    new Date(
      `${startDate}T00:00:00Z`
    )

  const end =
    new Date(
      `${endDate}T00:00:00Z`
    )

  return Math.floor(
    (
      end.getTime() -
      start.getTime()
    ) /
    86400000
  )
}

// ============================================================
// ISO Weekday
//
// PostgreSQL class_schedules.weekday:
// 1 = Monday
// 7 = Sunday
// ============================================================

const getIsoWeekday = (
  dateString
) => {
  const date =
    new Date(
      `${dateString}T00:00:00Z`
    )

  const weekday =
    date.getUTCDay()

  return (
    weekday === 0
      ? 7
      : weekday
  )
}

// ============================================================
// Status
// ============================================================

const SESSION_STATUSES = [
  'SCHEDULED',
  'COMPLETED',
  'TEACHER_LEAVE',
  'CANCELLED',
]

const normalizeStatus = (
  value,
  {
    optional = false,
  } = {}
) => {
  if (
    optional &&
    (
      value === undefined ||
      value === null ||
      value === ''
    )
  ) {
    return null
  }

  const normalized =
    String(
      value || ''
    )
      .trim()
      .toUpperCase()

  if (
    !SESSION_STATUSES.includes(
      normalized
    )
  ) {
    throw createError({
      statusCode: 400,

      statusMessage:
        'Session status 不正確',
    })
  }

  return normalized
}

// ============================================================
// Note
// ============================================================

const normalizeNote = (
  value
) => {
  if (
    value === undefined
  ) {
    return undefined
  }

  if (
    value === null
  ) {
    return null
  }

  const normalized =
    String(
      value
    )
      .trim()
      .slice(
        0,
        2000
      )

  return (
    normalized ||
    null
  )
}

// ============================================================
// Transaction
// ============================================================

const runTransaction =
  async (
    sql,
    queries
  ) => {
    if (
      typeof sql.transaction !==
      'function'
    ) {
      throw createError({
        statusCode: 500,

        statusMessage:
          '目前資料庫連線不支援 Transaction',
      })
    }

    return await sql.transaction(
      queries
    )
  }

// ============================================================
// Require Session
// ============================================================

const requireSession =
  async (
    sql,
    sessionId
  ) => {
    assertUuid(
      sessionId,
      'Session ID'
    )

    const rows =
      await sql`
        SELECT
          session.id,

          session.schedule_id,

          session.class_date,

          session.start_time,

          session.end_time,

          session.status,

          session.teacher_note,

          session.created_at,

          session.updated_at,

          schedule.course_id,

          schedule.name
            AS schedule_name,

          schedule.weekday,

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
                attendance.status <>
                  'CANCELLED'
          )
            AS active_attendance_count

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
          session.id =
            ${sessionId}

        LIMIT 1
      `

    if (
      !rows.length
    ) {
      throw createError({
        statusCode: 404,

        statusMessage:
          '找不到課堂 Session',
      })
    }

    return rows[0]
  }

// ============================================================
// Teacher Session List
// ============================================================

export const getTeacherSessions =
  async ({
    courseId = null,
    scheduleId = null,
    status = null,
    startDate = null,
    endDate = null,
  } = {}) => {
    const sql =
      useDatabase()

    const normalizedCourseId =
      normalizeOptionalUuid(
        courseId,
        'Course ID'
      )

    const normalizedScheduleId =
      normalizeOptionalUuid(
        scheduleId,
        'Schedule ID'
      )

    const normalizedStatus =
      normalizeStatus(
        status,
        {
          optional:
            true,
        }
      )

    const today =
      getTaipeiDate()

    const normalizedStartDate =
      normalizeOptionalDate(
        startDate,
        '開始日期'
      ) ||
      addDays(
        today,
        -30
      )

    const normalizedEndDate =
      normalizeOptionalDate(
        endDate,
        '結束日期'
      ) ||
      addDays(
        today,
        90
      )

    if (
      normalizedStartDate >
      normalizedEndDate
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '開始日期不可晚於結束日期',
      })
    }

    // ========================================================
    // Sessions
    // ========================================================

    const sessions =
      await sql`
        SELECT
          session.id,

          session.schedule_id,

          session.class_date,

          session.start_time,

          session.end_time,

          session.status,

          session.teacher_note,

          session.created_at,

          session.updated_at,

          schedule.course_id,

          schedule.weekday,

          schedule.name
            AS schedule_name,

          schedule.capacity,

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
            AS absent_count,

          (
            SELECT
              COUNT(*)::INTEGER

            FROM
              attendance_records_v2 attendance

            WHERE
              attendance.session_id =
                session.id

              AND
                attendance.status <>
                  'CANCELLED'
          )
            AS active_attendance_count

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
          session.class_date >=
            ${normalizedStartDate}

          AND
            session.class_date <=
              ${normalizedEndDate}

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
              session.schedule_id =
                ${normalizedScheduleId}
          )

          AND (
            ${normalizedStatus}::text
              IS NULL

            OR
              session.status =
                ${normalizedStatus}
          )

        ORDER BY
          session.class_date ASC,
          session.start_time ASC
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
          schedule.id,

          schedule.course_id,

          schedule.name,

          schedule.weekday,

          schedule.start_time,

          schedule.end_time,

          schedule.capacity,

          schedule.status,

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

    // ========================================================
    // Summary
    // ========================================================

    const summary = {
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

    return {
      today,

      filters: {
        startDate:
          normalizedStartDate,

        endDate:
          normalizedEndDate,
      },

      summary,

      sessions,

      courses,

      schedules,
    }
  }

// ============================================================
// Generate Sessions
// ============================================================

export const generateClassSessions =
  async ({
    courseId = null,
    scheduleId = null,
    startDate,
    endDate,
    actorUserId,
    auditMetadata = {},
  }) => {
    assertUuid(
      actorUserId,
      '操作者 ID'
    )

    const normalizedCourseId =
      normalizeOptionalUuid(
        courseId,
        'Course ID'
      )

    const normalizedScheduleId =
      normalizeOptionalUuid(
        scheduleId,
        'Schedule ID'
      )

    const normalizedStartDate =
      assertDate(
        startDate,
        '開始日期'
      )

    const normalizedEndDate =
      assertDate(
        endDate,
        '結束日期'
      )

    const difference =
      getDateDifference(
        normalizedStartDate,
        normalizedEndDate
      )

    if (
      difference < 0
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '開始日期不可晚於結束日期',
      })
    }

    if (
      difference >
      366
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '一次最多產生 367 天範圍的課堂',
      })
    }

    const sql =
      useDatabase()

    // ========================================================
    // Active Schedules
    // ========================================================

    const schedules =
      await sql`
        SELECT
          schedule.id,

          schedule.course_id,

          schedule.weekday,

          schedule.start_time,

          schedule.end_time,

          schedule.name
            AS schedule_name,

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

          AND
            course.status =
              'ACTIVE'

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
              schedule.id =
                ${normalizedScheduleId}
          )

        ORDER BY
          schedule.weekday ASC,
          schedule.start_time ASC
      `

    if (
      !schedules.length
    ) {
      throw createError({
        statusCode: 404,

        statusMessage:
          '找不到符合條件的 ACTIVE Schedule',
      })
    }

    // ========================================================
    // Build Candidates
    // ========================================================

    const candidates = []

    let cursor =
      normalizedStartDate

    while (
      cursor <=
      normalizedEndDate
    ) {
      const weekday =
        getIsoWeekday(
          cursor
        )

      for (
        const schedule of
        schedules
      ) {
        if (
          Number(
            schedule.weekday
          ) !==
          weekday
        ) {
          continue
        }

        candidates.push({
          schedule,
          classDate:
            cursor,
        })
      }

      cursor =
        addDays(
          cursor,
          1
        )
    }

    if (
      candidates.length >
      500
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          `本次將產生 ${candidates.length} 筆 Session，單次上限為 500 筆`,
      })
    }

    // ========================================================
    // Insert
    //
    // 每一筆使用 ON CONFLICT DO NOTHING，
    // 因此同一 Schedule + Date 可安全重跑。
    // ========================================================

    const created = []

    let skipped =
      0

    for (
      const candidate of
      candidates
    ) {
      const {
        schedule,
        classDate,
      } =
        candidate

      const rows =
        await sql`
          INSERT INTO
            class_sessions (
              schedule_id,
              class_date,
              start_time,
              end_time,
              status,
              teacher_note,
              created_at,
              updated_at
            )

          VALUES (
            ${schedule.id},
            ${classDate},
            ${schedule.start_time},
            ${schedule.end_time},
            'SCHEDULED',
            NULL,
            NOW(),
            NOW()
          )

          ON CONFLICT (
            schedule_id,
            class_date
          )
          DO NOTHING

          RETURNING
            *
        `

      if (
        !rows.length
      ) {
        skipped +=
          1

        continue
      }

      const session =
        rows[0]

      created.push({
        ...session,

        course_id:
          schedule.course_id,

        course_name:
          schedule.course_name,

        schedule_name:
          schedule.schedule_name,
      })

      // ======================================================
      // Audit
      //
      // 只有真的新增成功才寫 CREATE。
      // ======================================================

      try {
        const auditQuery =
          createAuditQuery(
            sql,
            {
              actorUserId,

              actorRole:
                'TEACHER',

              action:
                'CREATE',

              entityType:
                'SESSION',

              entityId:
                session.id,

              courseId:
                schedule.course_id,

              sessionId:
                session.id,

              beforeData:
                null,

              afterData: {
                ...session,

                course_id:
                  schedule.course_id,

                course_name:
                  schedule.course_name,

                schedule_name:
                  schedule.schedule_name,
              },

              note:
                `產生課堂：${schedule.course_name} ${classDate}`,

              ...auditMetadata,
            }
          )

        await auditQuery
      } catch (
        error
      ) {
        console.error(
          'Session Audit 建立失敗：',
          error
        )

        throw createError({
          statusCode: 500,

          statusMessage:
            '課堂已建立，但 Audit Log 寫入失敗，請檢查資料庫',
        })
      }
    }

    return {
      requestedSchedules:
        schedules.length,

      candidateCount:
        candidates.length,

      createdCount:
        created.length,

      skippedCount:
        skipped,

      created,
    }
  }

// ============================================================
// Update Session
// ============================================================

export const updateClassSession =
  async ({
    sessionId,
    status = undefined,
    teacherNote = undefined,
    actorUserId,
    auditMetadata = {},
  }) => {
    assertUuid(
      actorUserId,
      '操作者 ID'
    )

    const normalizedStatus =
      status === undefined
        ? undefined
        : normalizeStatus(
            status
          )

    const normalizedNote =
      normalizeNote(
        teacherNote
      )

    if (
      normalizedStatus ===
        undefined &&
      normalizedNote ===
        undefined
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '沒有提供要修改的 Session 資料',
      })
    }

    const sql =
      useDatabase()

    const beforeData =
      await requireSession(
        sql,
        sessionId
      )

    const nextStatus =
      normalizedStatus ===
        undefined
        ? beforeData.status
        : normalizedStatus

    const nextTeacherNote =
      normalizedNote ===
        undefined
        ? beforeData.teacher_note
        : normalizedNote

    // ========================================================
    // 不允許直接取消有 Attendance 的 Session
    // ========================================================

    if (
      [
        'TEACHER_LEAVE',
        'CANCELLED',
      ].includes(
        nextStatus
      ) &&
      ![
        'TEACHER_LEAVE',
        'CANCELLED',
      ].includes(
        beforeData.status
      ) &&
      Number(
        beforeData
          .active_attendance_count ||
        0
      ) >
        0
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          `這堂課目前有 ${beforeData.active_attendance_count} 筆有效 Attendance，請先處理出席紀錄後再停課或取消`,
      })
    }

    if (
      nextStatus ===
        beforeData.status &&
      nextTeacherNote ===
        beforeData.teacher_note
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          'Session 資料沒有變更',
      })
    }

    const afterData = {
      ...beforeData,

      status:
        nextStatus,

      teacher_note:
        nextTeacherNote,
    }

    const queries = [
      sql`
        UPDATE
          class_sessions

        SET
          status =
            ${nextStatus},

          teacher_note =
            ${nextTeacherNote},

          updated_at =
            NOW()

        WHERE
          id =
            ${sessionId}

        RETURNING
          *
      `,

      createAuditQuery(
        sql,
        {
          actorUserId,

          actorRole:
            'TEACHER',

          action:
            'UPDATE',

          entityType:
            'SESSION',

          entityId:
            sessionId,

          courseId:
            beforeData.course_id,

          sessionId,

          beforeData,

          afterData,

          note:
            `修改課堂：${beforeData.course_name} ${String(beforeData.class_date).slice(0, 10)}`,

          ...auditMetadata,
        }
      ),
    ]

    const results =
      await runTransaction(
        sql,
        queries
      )

    return (
      results[0]?.[0] ||
      null
    )
  }