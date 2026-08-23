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
// Constants
// ============================================================

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const COURSE_STATUSES = [
  'ACTIVE',
  'INACTIVE',
]

// ============================================================
// UUID
// ============================================================

const normalizeUuid = (
  value,
  fieldName,
) => {
  const normalized =
    String(
      value || '',
    ).trim()

  if (
    !UUID_PATTERN.test(
      normalized,
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
// Name
// ============================================================

const normalizeName = (
  value,
) => {
  const normalized =
    String(
      value || '',
    )
      .trim()
      .slice(
        0,
        100,
      )

  if (
    !normalized
  ) {
    throw createError({
      statusCode: 400,
      statusMessage:
        '請輸入課堂名稱',
    })
  }

  return normalized
}

// ============================================================
// Weekday
// ============================================================

const normalizeWeekday = (
  value,
) => {
  const parsed =
    Number.parseInt(
      String(
        value,
      ),
      10,
    )

  if (
    !Number.isInteger(
      parsed,
    ) ||
    parsed < 1 ||
    parsed > 7
  ) {
    throw createError({
      statusCode: 400,
      statusMessage:
        '星期必須介於 1 到 7',
    })
  }

  return parsed
}

// ============================================================
// Time
// ============================================================

const normalizeTime = (
  value,
  fieldName,
) => {
  const normalized =
    String(
      value || '',
    ).trim()

  if (
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(
      normalized,
    )
  ) {
    throw createError({
      statusCode: 400,
      statusMessage:
        `${fieldName}格式必須為 HH:mm`,
    })
  }

  return normalized
}

// ============================================================
// Sessions
// ============================================================

const normalizeSessionsPerCycle = (
  value,
) => {
  const parsed =
    Number.parseInt(
      String(
        value,
      ),
      10,
    )

  if (
    !Number.isInteger(
      parsed,
    ) ||
    parsed <= 0 ||
    parsed > 999
  ) {
    throw createError({
      statusCode: 400,
      statusMessage:
        '一期堂數必須是大於 0 的整數',
    })
  }

  return parsed
}

// ============================================================
// Price
// ============================================================

const normalizePricePerCycle = (
  value,
) => {
  const parsed =
    Number(
      value,
    )

  if (
    !Number.isFinite(
      parsed,
    ) ||
    parsed < 0
  ) {
    throw createError({
      statusCode: 400,
      statusMessage:
        '一期價格不能小於 0',
    })
  }

  return parsed
}

// ============================================================
// Status
// ============================================================

const normalizeStatus = (
  value,
) => {
  const normalized =
    String(
      value || '',
    )
      .trim()
      .toUpperCase()

  if (
    !COURSE_STATUSES.includes(
      normalized,
    )
  ) {
    throw createError({
      statusCode: 400,
      statusMessage:
        '課堂狀態不正確',
    })
  }

  return normalized
}

// ============================================================
// Require Course
// ============================================================

const requireCourse =
  async (
    sql,
    courseId,
  ) => {
    const normalizedCourseId =
      normalizeUuid(
        courseId,
        'Course ID',
      )

    const rows =
      await sql`
        SELECT
          id,
          organization_id,
          name,
          description,
          weekday,
          start_time,
          end_time,
          sessions_per_cycle,
          price_per_cycle,
          status,
          created_at,
          updated_at

        FROM
          dance_courses

        WHERE
          id =
            ${normalizedCourseId}

        LIMIT 1
      `

    if (
      !rows.length
    ) {
      throw createError({
        statusCode: 404,
        statusMessage:
          '找不到課堂',
      })
    }

    return rows[0]
  }

// ============================================================
// List Courses
// ============================================================

export const getCourses =
  async () => {
    const sql =
      useDatabase()

    const rows =
      await sql`
        SELECT
          id,
          organization_id,
          name,
          description,
          weekday,
          start_time,
          end_time,
          sessions_per_cycle,
          price_per_cycle,
          status,
          created_at,
          updated_at

        FROM
          dance_courses

        ORDER BY
          CASE
            WHEN status = 'ACTIVE'
            THEN 0
            ELSE 1
          END,

          weekday ASC NULLS LAST,
          start_time ASC NULLS LAST,
          LOWER(name) ASC
      `

    return rows
  }

// ============================================================
// Create Course
//
// 這裡就是這次問題的重點。
// 新增時必須一次 INSERT：
//
// name
// weekday
// start_time
// end_time
// sessions_per_cycle
// price_per_cycle
//
// 不能只寫 name。
// ============================================================

export const createCourse =
  async ({
    name,
    weekday,
    startTime,
    endTime,
    sessionsPerCycle,
    pricePerCycle,
    actorUserId,
    auditMetadata = {},
  }) => {
    const normalizedName =
      normalizeName(
        name,
      )

    const normalizedWeekday =
      normalizeWeekday(
        weekday,
      )

    const normalizedStartTime =
      normalizeTime(
        startTime,
        '開始時間',
      )

    const normalizedEndTime =
      normalizeTime(
        endTime,
        '結束時間',
      )

    if (
      normalizedStartTime >=
      normalizedEndTime
    ) {
      throw createError({
        statusCode: 400,
        statusMessage:
          '結束時間必須晚於開始時間',
      })
    }

    const normalizedSessions =
      normalizeSessionsPerCycle(
        sessionsPerCycle,
      )

    const normalizedPrice =
      normalizePricePerCycle(
        pricePerCycle,
      )

    const normalizedActorUserId =
      normalizeUuid(
        actorUserId,
        'Actor User ID',
      )

    const sql =
      useDatabase()

    // ========================================================
    // Prevent exact duplicate slot
    // ========================================================

    const duplicates =
      await sql`
        SELECT
          id

        FROM
          dance_courses

        WHERE
          LOWER(name) =
            LOWER(
              ${normalizedName}
            )

          AND
            weekday =
              ${normalizedWeekday}

          AND
            start_time =
              ${normalizedStartTime}::time

          AND
            end_time =
              ${normalizedEndTime}::time

          AND
            status =
              'ACTIVE'

        LIMIT 1
      `

    if (
      duplicates.length
    ) {
      throw createError({
        statusCode: 409,
        statusMessage:
          '已經有相同名稱、星期與時間的課堂',
      })
    }

    const courseId =
      randomUUID()

    const afterData = {
      id:
        courseId,

      name:
        normalizedName,

      weekday:
        normalizedWeekday,

      start_time:
        normalizedStartTime,

      end_time:
        normalizedEndTime,

      sessions_per_cycle:
        normalizedSessions,

      price_per_cycle:
        normalizedPrice,

      status:
        'ACTIVE',
    }

    const queries = [
      sql`
        INSERT INTO
          dance_courses (
            id,
            name,
            description,
            weekday,
            start_time,
            end_time,
            sessions_per_cycle,
            price_per_cycle,
            status,
            created_at,
            updated_at
          )

        VALUES (
          ${courseId},
          ${normalizedName},
          NULL,
          ${normalizedWeekday},
          ${normalizedStartTime}::time,
          ${normalizedEndTime}::time,
          ${normalizedSessions},
          ${normalizedPrice},
          'ACTIVE',
          NOW(),
          NOW()
        )

        RETURNING
          id,
          organization_id,
          name,
          description,
          weekday,
          start_time,
          end_time,
          sessions_per_cycle,
          price_per_cycle,
          status,
          created_at,
          updated_at
      `,

      createAuditQuery(
        sql,
        {
          actorUserId:
            normalizedActorUserId,

          actorRole:
            'TEACHER',

          action:
            'CREATE',

          entityType:
            'COURSE',

          entityId:
            courseId,

          studentId:
            null,

          courseId,

          beforeData:
            null,

          afterData,

          note:
            `新增課堂「${normalizedName}」：星期 ${normalizedWeekday}，${normalizedStartTime}–${normalizedEndTime}，${normalizedSessions} 堂 / ${normalizedPrice}`,

          ...auditMetadata,
        },
      ),
    ]

    if (
      typeof sql.transaction !==
      'function'
    ) {
      throw createError({
        statusCode: 500,
        statusMessage:
          '資料庫目前不支援 Transaction',
      })
    }

    const results =
      await sql.transaction(
        queries,
      )

    return (
      results[0]?.[0] ||
      null
    )
  }

// ============================================================
// Update Course
// ============================================================

export const updateCourse =
  async ({
    courseId,
    name,
    weekday,
    startTime,
    endTime,
    sessionsPerCycle,
    pricePerCycle,
    status,
    actorUserId,
    auditMetadata = {},
  }) => {
    const normalizedCourseId =
      normalizeUuid(
        courseId,
        'Course ID',
      )

    const normalizedActorUserId =
      normalizeUuid(
        actorUserId,
        'Actor User ID',
      )

    const sql =
      useDatabase()

    const oldCourse =
      await requireCourse(
        sql,
        normalizedCourseId,
      )

    // ========================================================
    // Status-only update
    // ========================================================

    const statusOnly =
      status !== undefined &&
      name === undefined &&
      weekday === undefined &&
      startTime === undefined &&
      endTime === undefined &&
      sessionsPerCycle === undefined &&
      pricePerCycle === undefined

    if (
      statusOnly
    ) {
      const normalizedStatus =
        normalizeStatus(
          status,
        )

      const afterData = {
        ...oldCourse,
        status:
          normalizedStatus,
      }

      const results =
        await sql.transaction([
          sql`
            UPDATE
              dance_courses

            SET
              status =
                ${normalizedStatus},

              updated_at =
                NOW()

            WHERE
              id =
                ${normalizedCourseId}

            RETURNING
              id,
              organization_id,
              name,
              description,
              weekday,
              start_time,
              end_time,
              sessions_per_cycle,
              price_per_cycle,
              status,
              created_at,
              updated_at
          `,

          createAuditQuery(
            sql,
            {
              actorUserId:
                normalizedActorUserId,

              actorRole:
                'TEACHER',

              action:
                'UPDATE',

              entityType:
                'COURSE',

              entityId:
                normalizedCourseId,

              studentId:
                null,

              courseId:
                normalizedCourseId,

              beforeData:
                oldCourse,

              afterData,

              note:
                `${normalizedStatus === 'ACTIVE' ? '啟用' : '停用'}課堂「${oldCourse.name}」`,

              ...auditMetadata,
            },
          ),
        ])

      return (
        results[0]?.[0] ||
        null
      )
    }

    // ========================================================
    // Full edit
    // ========================================================

    const normalizedName =
      normalizeName(
        name,
      )

    const normalizedWeekday =
      normalizeWeekday(
        weekday,
      )

    const normalizedStartTime =
      normalizeTime(
        startTime,
        '開始時間',
      )

    const normalizedEndTime =
      normalizeTime(
        endTime,
        '結束時間',
      )

    if (
      normalizedStartTime >=
      normalizedEndTime
    ) {
      throw createError({
        statusCode: 400,
        statusMessage:
          '結束時間必須晚於開始時間',
      })
    }

    const normalizedSessions =
      normalizeSessionsPerCycle(
        sessionsPerCycle,
      )

    const normalizedPrice =
      normalizePricePerCycle(
        pricePerCycle,
      )

    // ========================================================
    // Prevent duplicate
    // ========================================================

    const duplicates =
      await sql`
        SELECT
          id

        FROM
          dance_courses

        WHERE
          id <>
            ${normalizedCourseId}

          AND
            LOWER(name) =
              LOWER(
                ${normalizedName}
              )

          AND
            weekday =
              ${normalizedWeekday}

          AND
            start_time =
              ${normalizedStartTime}::time

          AND
            end_time =
              ${normalizedEndTime}::time

          AND
            status =
              'ACTIVE'

        LIMIT 1
      `

    if (
      duplicates.length
    ) {
      throw createError({
        statusCode: 409,
        statusMessage:
          '已經有相同名稱、星期與時間的課堂',
      })
    }

    const afterData = {
      id:
        normalizedCourseId,

      name:
        normalizedName,

      weekday:
        normalizedWeekday,

      start_time:
        normalizedStartTime,

      end_time:
        normalizedEndTime,

      sessions_per_cycle:
        normalizedSessions,

      price_per_cycle:
        normalizedPrice,

      status:
        oldCourse.status,
    }

    const results =
      await sql.transaction([
        sql`
          UPDATE
            dance_courses

          SET
            name =
              ${normalizedName},

            weekday =
              ${normalizedWeekday},

            start_time =
              ${normalizedStartTime}::time,

            end_time =
              ${normalizedEndTime}::time,

            sessions_per_cycle =
              ${normalizedSessions},

            price_per_cycle =
              ${normalizedPrice},

            updated_at =
              NOW()

          WHERE
            id =
              ${normalizedCourseId}

          RETURNING
            id,
            organization_id,
            name,
            description,
            weekday,
            start_time,
            end_time,
            sessions_per_cycle,
            price_per_cycle,
            status,
            created_at,
            updated_at
        `,

        createAuditQuery(
          sql,
          {
            actorUserId:
              normalizedActorUserId,

            actorRole:
              'TEACHER',

            action:
              'UPDATE',

            entityType:
              'COURSE',

            entityId:
              normalizedCourseId,

            studentId:
              null,

            courseId:
              normalizedCourseId,

            beforeData:
              oldCourse,

            afterData,

            note:
              `修改課堂「${normalizedName}」：星期 ${normalizedWeekday}，${normalizedStartTime}–${normalizedEndTime}，${normalizedSessions} 堂 / ${normalizedPrice}`,

            ...auditMetadata,
          },
        ),
      ])

    return (
      results[0]?.[0] ||
      null
    )
  }