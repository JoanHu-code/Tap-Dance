import {
  randomUUID,
} from 'node:crypto'

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
  const normalized =
    String(
      value || ''
    ).trim()

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
// Name
// ============================================================

const normalizeName = (
  value
) => {
  const normalized =
    String(
      value || ''
    )
      .trim()
      .slice(
        0,
        100
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
// Description
// ============================================================

const normalizeDescription = (
  value
) => {
  if (
    value === undefined ||
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
// Weekday
//
// 1 = 星期一
// 7 = 星期日
// ============================================================

const normalizeWeekday = (
  value
) => {
  const parsed =
    Number.parseInt(
      String(
        value
      ),
      10
    )

  if (
    !Number.isInteger(
      parsed
    ) ||
    parsed < 1 ||
    parsed > 7
  ) {
    throw createError({
      statusCode: 400,

      statusMessage:
        '請選擇正確的星期',
    })
  }

  return parsed
}

// ============================================================
// Time
// ============================================================

const normalizeTime = (
  value,
  fieldName
) => {
  const normalized =
    String(
      value || ''
    ).trim()

  if (
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(
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
// Sessions Per Cycle
// ============================================================

const normalizeSessionsPerCycle = (
  value
) => {
  const parsed =
    Number.parseInt(
      String(
        value
      ),
      10
    )

  if (
    !Number.isInteger(
      parsed
    ) ||
    parsed <= 0 ||
    parsed > 1000
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
// Price Per Cycle
// ============================================================

const normalizePricePerCycle = (
  value
) => {
  const parsed =
    Number(
      value
    )

  if (
    !Number.isFinite(
      parsed
    ) ||
    parsed < 0
  ) {
    throw createError({
      statusCode: 400,

      statusMessage:
        '一期價格必須大於或等於 0',
    })
  }

  return parsed
}

// ============================================================
// Status
// ============================================================

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
    ![
      'ACTIVE',
      'INACTIVE',
    ].includes(
      normalized
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
// Validate Time
// ============================================================

const validateTimeRange = (
  startTime,
  endTime
) => {
  if (
    startTime >=
    endTime
  ) {
    throw createError({
      statusCode: 400,

      statusMessage:
        '結束時間必須晚於開始時間',
    })
  }
}

// ============================================================
// Get Courses
// ============================================================

export const getCourses =
  async ({
    status = null,
  } = {}) => {
    const sql =
      useDatabase()

    let normalizedStatus =
      null

    if (
      status
    ) {
      normalizedStatus =
        normalizeStatus(
          status
        )
    }

    const courses =
      await sql`
        SELECT
          course.id,

          course.name,

          course.description,

          course.weekday,

          course.start_time,

          course.end_time,

          course.sessions_per_cycle,

          course.price_per_cycle,

          course.status,

          course.created_at,

          course.updated_at,

          (
            SELECT
              COUNT(*)::INTEGER

            FROM
              student_enrollments enrollment

            WHERE
              enrollment.course_id =
                course.id

              AND
                enrollment.status =
                  'ACTIVE'
          )
            AS active_student_count,

          (
            SELECT
              COUNT(*)::INTEGER

            FROM
              student_packages package

            WHERE
              package.course_id =
                course.id

              AND
                package.status =
                  'ACTIVE'
          )
            AS active_package_count

        FROM
          dance_courses course

        WHERE
          (
            ${normalizedStatus}::text
              IS NULL

            OR
              course.status =
                ${normalizedStatus}
          )

        ORDER BY
          CASE
            WHEN
              course.status =
                'ACTIVE'
            THEN
              0

            ELSE
              1
          END,

          course.weekday ASC NULLS LAST,

          course.start_time ASC NULLS LAST,

          course.name ASC
      `

    return courses
  }

// ============================================================
// Get One Course
// ============================================================

export const getCourseById =
  async (
    courseId
  ) => {
    const normalizedId =
      assertUuid(
        courseId,
        'Course ID'
      )

    const sql =
      useDatabase()

    const rows =
      await sql`
        SELECT
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

        FROM
          dance_courses

        WHERE
          id =
            ${normalizedId}

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
// Create Course
// ============================================================

export const createCourse =
  async ({
    name,

    description = null,

    weekday,

    startTime,

    endTime,

    sessionsPerCycle,

    pricePerCycle,
  }) => {
    const normalizedName =
      normalizeName(
        name
      )

    const normalizedDescription =
      normalizeDescription(
        description
      )

    const normalizedWeekday =
      normalizeWeekday(
        weekday
      )

    const normalizedStartTime =
      normalizeTime(
        startTime,
        '開始時間'
      )

    const normalizedEndTime =
      normalizeTime(
        endTime,
        '結束時間'
      )

    validateTimeRange(
      normalizedStartTime,
      normalizedEndTime
    )

    const normalizedSessions =
      normalizeSessionsPerCycle(
        sessionsPerCycle
      )

    const normalizedPrice =
      normalizePricePerCycle(
        pricePerCycle
      )

    const sql =
      useDatabase()

    // ========================================================
    // 同名稱 + 星期 + 時間避免重複
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
              ${normalizedStartTime}

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
          '已存在相同名稱、星期與時間的課堂',
      })
    }

    const id =
      randomUUID()

    const rows =
      await sql`
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
          ${id},

          ${normalizedName},

          ${normalizedDescription},

          ${normalizedWeekday},

          ${normalizedStartTime},

          ${normalizedEndTime},

          ${normalizedSessions},

          ${normalizedPrice},

          'ACTIVE',

          NOW(),

          NOW()
        )

        RETURNING
          *
      `

    return rows[0]
  }

// ============================================================
// Update Course
// ============================================================

export const updateCourse =
  async ({
    courseId,

    name,

    description,

    weekday,

    startTime,

    endTime,

    sessionsPerCycle,

    pricePerCycle,

    status,
  }) => {
    const existing =
      await getCourseById(
        courseId
      )

    const normalizedName =
      name === undefined
        ? existing.name
        : normalizeName(
            name
          )

    const normalizedDescription =
      description === undefined
        ? existing.description
        : normalizeDescription(
            description
          )

    const normalizedWeekday =
      weekday === undefined
        ? Number(
            existing.weekday
          )
        : normalizeWeekday(
            weekday
          )

    const normalizedStartTime =
      startTime === undefined
        ? String(
            existing.start_time
          ).slice(
            0,
            5
          )
        : normalizeTime(
            startTime,
            '開始時間'
          )

    const normalizedEndTime =
      endTime === undefined
        ? String(
            existing.end_time
          ).slice(
            0,
            5
          )
        : normalizeTime(
            endTime,
            '結束時間'
          )

    validateTimeRange(
      normalizedStartTime,
      normalizedEndTime
    )

    const normalizedSessions =
      sessionsPerCycle ===
        undefined
        ? Number(
            existing
              .sessions_per_cycle
          )
        : normalizeSessionsPerCycle(
            sessionsPerCycle
          )

    const normalizedPrice =
      pricePerCycle ===
        undefined
        ? Number(
            existing
              .price_per_cycle
          )
        : normalizePricePerCycle(
            pricePerCycle
          )

    const normalizedStatus =
      status === undefined
        ? existing.status
        : normalizeStatus(
            status
          )

    const sql =
      useDatabase()

    const rows =
      await sql`
        UPDATE
          dance_courses

        SET
          name =
            ${normalizedName},

          description =
            ${normalizedDescription},

          weekday =
            ${normalizedWeekday},

          start_time =
            ${normalizedStartTime},

          end_time =
            ${normalizedEndTime},

          sessions_per_cycle =
            ${normalizedSessions},

          price_per_cycle =
            ${normalizedPrice},

          status =
            ${normalizedStatus},

          updated_at =
            NOW()

        WHERE
          id =
            ${courseId}

        RETURNING
          *
      `

    return rows[0]
  }