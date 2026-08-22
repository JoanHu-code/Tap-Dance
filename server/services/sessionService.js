import {
  randomUUID,
} from 'node:crypto'

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

// ============================================================
// Date
// ============================================================

const normalizeDate = (
  value,
  fieldName
) => {
  const normalized =
    String(
      value || ''
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

  const date =
    new Date(
      `${normalized}T00:00:00+08:00`
    )

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    throw createError({
      statusCode: 400,

      statusMessage:
        `${fieldName} 日期不正確`,
    })
  }

  return normalized
}

// ============================================================
// Taiwan Date
// ============================================================

const parseTaipeiDate = (
  dateString
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

  return new Date(
    Date.UTC(
      year,
      month - 1,
      day
    )
  )
}

// ============================================================
// Date → YYYY-MM-DD
// ============================================================

const formatDate = (
  date
) => {
  const year =
    date.getUTCFullYear()

  const month =
    String(
      date.getUTCMonth() +
      1
    )
      .padStart(
        2,
        '0'
      )

  const day =
    String(
      date.getUTCDate()
    )
      .padStart(
        2,
        '0'
      )

  return `${year}-${month}-${day}`
}

// ============================================================
// JS Sunday=0
//
// DB:
// Monday=1
// ...
// Sunday=7
// ============================================================

const getDatabaseWeekday = (
  date
) => {
  const jsDay =
    date.getUTCDay()

  return (
    jsDay === 0
      ? 7
      : jsDay
  )
}

// ============================================================
// 產生日期區間
// ============================================================

const getDatesBetween =
  (
    startDate,
    endDate
  ) => {
    const start =
      parseTaipeiDate(
        startDate
      )

    const end =
      parseTaipeiDate(
        endDate
      )

    if (
      start.getTime() >
      end.getTime()
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '開始日期不可晚於結束日期',
      })
    }

    const diffDays =
      Math.floor(
        (
          end.getTime() -
          start.getTime()
        ) /
        86400000
      )

    if (
      diffDays > 366
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '一次最多產生 366 天內的課堂',
      })
    }

    const result = []

    const current =
      new Date(
        start.getTime()
      )

    while (
      current.getTime() <=
      end.getTime()
    ) {
      result.push(
        new Date(
          current.getTime()
        )
      )

      current.setUTCDate(
        current.getUTCDate() +
        1
      )
    }

    return result
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
  value
) => {
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
        'Session status 只能是 SCHEDULED、COMPLETED、TEACHER_LEAVE 或 CANCELLED',
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
// Schedule
// ============================================================

const requireSchedule =
  async (
    sql,
    scheduleId
  ) => {
    assertUuid(
      scheduleId,
      'Schedule ID'
    )

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
          schedule.id =
            ${scheduleId}

        LIMIT 1
      `

    if (
      !schedules.length
    ) {
      throw createError({
        statusCode: 404,

        statusMessage:
          '找不到固定課表',
      })
    }

    return schedules[0]
  }

// ============================================================
// Session
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

    const sessions =
      await sql`
        SELECT
          session.*,

          schedule.course_id,

          schedule.weekday,

          schedule.name
            AS schedule_name,

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
          session.id =
            ${sessionId}

        LIMIT 1
      `

    if (
      !sessions.length
    ) {
      throw createError({
        statusCode: 404,

        statusMessage:
          '找不到課堂 Session',
      })
    }

    return sessions[0]
  }

// ============================================================
// Session Query
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

    const normalizedStatus =
      status
        ? normalizeStatus(
            status
          )
        : null

    const normalizedStartDate =
      startDate
        ? normalizeDate(
            startDate,
            '開始日期'
          )
        : null

    const normalizedEndDate =
      endDate
        ? normalizeDate(
            endDate,
            '結束日期'
          )
        : null

    const records =
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
          (
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

          AND (
            ${normalizedStartDate}::date
            IS NULL

            OR
            session.class_date >=
              ${normalizedStartDate}
          )

          AND (
            ${normalizedEndDate}::date
            IS NULL

            OR
            session.class_date <=
              ${normalizedEndDate}
          )

        ORDER BY
          session.class_date DESC,
          session.start_time ASC
      `

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
      records,

      courses,

      schedules,
    }
  }

// ============================================================
// 批次產生 Session
//
// scheduleIds:
//
// [
//   星期二 Schedule,
//   星期六 Schedule
// ]
//
// startDate:
// 2026-08-01
//
// endDate:
// 2026-09-30
//
// 系統會自己找符合 weekday 的日期。
// ============================================================

export const generateSessions =
  async ({
    scheduleIds,
    startDate,
    endDate,
    actorUserId,
    actorRole =
      'TEACHER',
    auditMetadata = {},
  }) => {
    assertUuid(
      actorUserId,
      '操作者 ID'
    )

    const normalizedStartDate =
      normalizeDate(
        startDate,
        '開始日期'
      )

    const normalizedEndDate =
      normalizeDate(
        endDate,
        '結束日期'
      )

    const normalizedScheduleIds =
      [
        ...new Set(
          (
            Array.isArray(
              scheduleIds
            )
              ? scheduleIds
              : []
          )
            .filter(
              Boolean
            )
            .map(
              (
                value
              ) => {
                return String(
                  value
                )
                  .trim()
              }
            )
        ),
      ]

    if (
      !normalizedScheduleIds.length
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '至少要選擇一個固定 Schedule',
      })
    }

    if (
      normalizedScheduleIds.length >
      100
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '一次最多選擇 100 個 Schedule',
      })
    }

    const sql =
      useDatabase()

    const schedules = []

    for (
      const scheduleId of
      normalizedScheduleIds
    ) {
      const schedule =
        await requireSchedule(
          sql,
          scheduleId
        )

      if (
        schedule.status !==
        'ACTIVE'
      ) {
        throw createError({
          statusCode: 409,

          statusMessage:
            `${schedule.course_name} 的固定班別目前不是 ACTIVE`,
        })
      }

      schedules.push(
        schedule
      )
    }

    const dates =
      getDatesBetween(
        normalizedStartDate,
        normalizedEndDate
      )

    // ========================================================
    // 先取得區間內已經存在的 Session
    // ========================================================

    const existing =
      await sql`
        SELECT
          schedule_id,
          class_date

        FROM
          class_sessions

        WHERE
          schedule_id =
            ANY(
              ${normalizedScheduleIds}::uuid[]
            )

          AND
            class_date >=
              ${normalizedStartDate}

          AND
            class_date <=
              ${normalizedEndDate}
      `

    const existingKeys =
      new Set(
        existing.map(
          (
            item
          ) => {
            return `${item.schedule_id}|${String(item.class_date).slice(0, 10)}`
          }
        )
      )

    const pendingSessions =
      []

    for (
      const schedule of
      schedules
    ) {
      for (
        const date of
        dates
      ) {
        if (
          getDatabaseWeekday(
            date
          ) !==
          Number(
            schedule.weekday
          )
        ) {
          continue
        }

        const classDate =
          formatDate(
            date
          )

        const key =
          `${schedule.id}|${classDate}`

        if (
          existingKeys.has(
            key
          )
        ) {
          continue
        }

        pendingSessions.push({
          id:
            randomUUID(),

          scheduleId:
            schedule.id,

          courseId:
            schedule.course_id,

          courseName:
            schedule.course_name,

          scheduleName:
            schedule.name,

          classDate,

          startTime:
            schedule.start_time,

          endTime:
            schedule.end_time,
        })
      }
    }

    if (
      !pendingSessions.length
    ) {
      return {
        createdCount:
          0,

        skippedCount:
          existing.length,

        sessions: [],
      }
    }

    const queries = []

    for (
      const item of
      pendingSessions
    ) {
      // ======================================================
      // Business
      // ======================================================

      queries.push(
        sql`
          INSERT INTO
            class_sessions (
              id,
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
            ${item.id},
            ${item.scheduleId},
            ${item.classDate},
            ${item.startTime},
            ${item.endTime},
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
      )

      // ======================================================
      // Audit
      // ======================================================

      queries.push(
        createAuditQuery(
          sql,
          {
            actorUserId,

            actorRole,

            action:
              'CREATE',

            entityType:
              'SESSION',

            entityId:
              item.id,

            courseId:
              item.courseId,

            beforeData:
              null,

            afterData: {
              id:
                item.id,

              schedule_id:
                item.scheduleId,

              course_id:
                item.courseId,

              course_name:
                item.courseName,

              class_date:
                item.classDate,

              start_time:
                item.startTime,

              end_time:
                item.endTime,

              status:
                'SCHEDULED',
            },

            note:
              '批次建立課堂 Session',

            ...auditMetadata,
          }
        )
      )
    }

    const results =
      await runTransaction(
        sql,
        queries
      )

    const inserted = []

    for (
      let index = 0;
      index <
      results.length;
      index += 2
    ) {
      const record =
        results[index]?.[0]

      if (record) {
        inserted.push(
          record
        )
      }
    }

    return {
      createdCount:
        inserted.length,

      skippedCount:
        existing.length,

      sessions:
        inserted,
    }
  }

// ============================================================
// 修改 Session
//
// 可做：
//
// SCHEDULED
// COMPLETED
// TEACHER_LEAVE
// CANCELLED
//
// teacherNote
//
// 不允許修改 schedule_id / class_date。
// ============================================================

export const updateSession =
  async ({
    sessionId,
    status,
    teacherNote,
    actorUserId,
    actorRole =
      'TEACHER',
    auditMetadata = {},
  }) => {
    assertUuid(
      actorUserId,
      '操作者 ID'
    )

    const sql =
      useDatabase()

    const beforeData =
      await requireSession(
        sql,
        sessionId
      )

    const nextStatus =
      status ===
        undefined
        ? beforeData.status
        : normalizeStatus(
            status
          )

    const normalizedNote =
      normalizeNote(
        teacherNote
      )

    const nextNote =
      normalizedNote ===
        undefined
        ? beforeData.teacher_note
        : normalizedNote

    if (
      nextStatus ===
        beforeData.status &&
      nextNote ===
        beforeData.teacher_note
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          'Session 沒有任何變更',
      })
    }

    // ========================================================
    // 已存在 Attendance 時：
    //
    // 可以老師請假 / Cancel，
    // 但不能完全刪除 Session。
    //
    // 我們本來也沒有 DELETE API。
    // ========================================================

    const attendanceCount =
      await sql`
        SELECT
          COUNT(*)::INTEGER
            AS count

        FROM
          attendance_records_v2

        WHERE
          session_id =
            ${sessionId}
      `

    const beforeSnapshot = {
      ...beforeData,

      attendance_count:
        Number(
          attendanceCount[0]
            ?.count ||
          0
        ),
    }

    const afterSnapshot = {
      ...beforeSnapshot,

      status:
        nextStatus,

      teacher_note:
        nextNote,
    }

    let auditAction =
      'UPDATE'

    if (
      nextStatus ===
      'CANCELLED' &&
      beforeData.status !==
      'CANCELLED'
    ) {
      auditAction =
        'CANCEL'
    } else if (
      beforeData.status ===
        'CANCELLED' &&
      nextStatus !==
        'CANCELLED'
    ) {
      auditAction =
        'RESTORE'
    }

    const queries = [
      sql`
        UPDATE
          class_sessions

        SET
          status =
            ${nextStatus},

          teacher_note =
            ${nextNote},

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

          actorRole,

          action:
            auditAction,

          entityType:
            'SESSION',

          entityId:
            sessionId,

          courseId:
            beforeData.course_id,

          sessionId,

          beforeData:
            beforeSnapshot,

          afterData:
            afterSnapshot,

          note:
            `老師修改課堂 Session：${beforeData.status} → ${nextStatus}`,

          ...auditMetadata,
        }
      ),
    ]

    const results =
      await runTransaction(
        sql,
        queries
      )

    return {
      session:
        results[0]?.[0] ||
        null,

      attendanceCount:
        Number(
          attendanceCount[0]
            ?.count ||
          0
        ),
    }
  }