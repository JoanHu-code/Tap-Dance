import {
  useDatabase,
} from '../utils/db.js'

// ============================================================
// UUID
// ============================================================

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const normalizeUuid = (
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

const normalizeDate = (
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
// Pagination
// ============================================================

const normalizePage = (
  value
) => {
  const page =
    Number.parseInt(
      String(
        value || '1'
      ),
      10
    )

  if (
    !Number.isFinite(
      page
    ) ||
    page < 1
  ) {
    return 1
  }

  return page
}

const normalizePageSize = (
  value
) => {
  const pageSize =
    Number.parseInt(
      String(
        value || '30'
      ),
      10
    )

  if (
    !Number.isFinite(
      pageSize
    )
  ) {
    return 30
  }

  return Math.min(
    Math.max(
      pageSize,
      1
    ),
    100
  )
}

// ============================================================
// Text
// ============================================================

const normalizeText = (
  value,
  maxLength = 100
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
    )
      .trim()
      .slice(
        0,
        maxLength
      )

  return (
    normalized ||
    null
  )
}

// ============================================================
// Options
// ============================================================

export const getAuditFilterOptions =
  async () => {
    const sql =
      useDatabase()

    const [
      students,
      courses,
      actors,
      actions,
      entityTypes,
    ] =
      await Promise.all([
        sql`
          SELECT
            id,
            name

          FROM
            students

          ORDER BY
            name ASC
        `,

        sql`
          SELECT
            id,
            name

          FROM
            dance_courses

          ORDER BY
            name ASC
        `,

        sql`
          SELECT
            id,
            display_name,
            role

          FROM
            app_users

          ORDER BY
            role ASC,
            display_name ASC NULLS LAST,
            id ASC
        `,

        sql`
          SELECT DISTINCT
            action

          FROM
            audit_logs

          WHERE
            action IS NOT NULL

          ORDER BY
            action ASC
        `,

        sql`
          SELECT DISTINCT
            entity_type

          FROM
            audit_logs

          WHERE
            entity_type IS NOT NULL

          ORDER BY
            entity_type ASC
        `,
      ])

    return {
      students,

      courses,

      actors,

      actions:
        actions.map(
          (
            item
          ) => {
            return item.action
          }
        ),

      entityTypes:
        entityTypes.map(
          (
            item
          ) => {
            return item.entity_type
          }
        ),
    }
  }

// ============================================================
// Query Audit Logs
// ============================================================

export const queryAuditLogs =
  async ({
    studentId = null,
    courseId = null,
    actorUserId = null,
    actorRole = null,
    action = null,
    entityType = null,
    entityId = null,
    startDate = null,
    endDate = null,
    keyword = null,
    page = 1,
    pageSize = 30,
  } = {}) => {
    const sql =
      useDatabase()

    const normalizedStudentId =
      normalizeUuid(
        studentId,
        'Student ID'
      )

    const normalizedCourseId =
      normalizeUuid(
        courseId,
        'Course ID'
      )

    const normalizedActorUserId =
      normalizeUuid(
        actorUserId,
        'Actor User ID'
      )

    const normalizedEntityId =
      normalizeUuid(
        entityId,
        'Entity ID'
      )

    const normalizedActorRole =
      normalizeText(
        actorRole,
        20
      )
        ?.toUpperCase() ||
      null

    const normalizedAction =
      normalizeText(
        action,
        30
      )
        ?.toUpperCase() ||
      null

    const normalizedEntityType =
      normalizeText(
        entityType,
        50
      )
        ?.toUpperCase() ||
      null

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

    if (
      normalizedStartDate &&
      normalizedEndDate &&
      normalizedStartDate >
        normalizedEndDate
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '開始日期不可晚於結束日期',
      })
    }

    const normalizedKeyword =
      normalizeText(
        keyword,
        100
      )

    const normalizedPage =
      normalizePage(
        page
      )

    const normalizedPageSize =
      normalizePageSize(
        pageSize
      )

    const offset =
      (
        normalizedPage -
        1
      ) *
      normalizedPageSize

    // ========================================================
    // Count
    // ========================================================

    const countRows =
      await sql`
        SELECT
          COUNT(*)::INTEGER
            AS total

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

        LEFT JOIN
          app_users actor

          ON actor.id =
            audit.actor_user_id

        WHERE
          (
            ${normalizedStudentId}::uuid
              IS NULL

            OR
              audit.student_id =
                ${normalizedStudentId}
          )

          AND (
            ${normalizedCourseId}::uuid
              IS NULL

            OR
              audit.course_id =
                ${normalizedCourseId}
          )

          AND (
            ${normalizedActorUserId}::uuid
              IS NULL

            OR
              audit.actor_user_id =
                ${normalizedActorUserId}
          )

          AND (
            ${normalizedActorRole}::text
              IS NULL

            OR
              audit.actor_role =
                ${normalizedActorRole}
          )

          AND (
            ${normalizedAction}::text
              IS NULL

            OR
              audit.action =
                ${normalizedAction}
          )

          AND (
            ${normalizedEntityType}::text
              IS NULL

            OR
              audit.entity_type =
                ${normalizedEntityType}
          )

          AND (
            ${normalizedEntityId}::uuid
              IS NULL

            OR
              audit.entity_id =
                ${normalizedEntityId}
          )

          AND (
            ${normalizedStartDate}::date
              IS NULL

            OR
              audit.created_at >=
                (
                  ${normalizedStartDate}::date
                  AT TIME ZONE
                  'Asia/Taipei'
                )
          )

          AND (
            ${normalizedEndDate}::date
              IS NULL

            OR
              audit.created_at <
                (
                  (
                    ${normalizedEndDate}::date +
                    INTERVAL '1 day'
                  )
                  AT TIME ZONE
                  'Asia/Taipei'
                )
          )

          AND (
            ${normalizedKeyword}::text
              IS NULL

            OR
              student.name
                ILIKE
                '%' ||
                ${normalizedKeyword} ||
                '%'

            OR
              course.name
                ILIKE
                '%' ||
                ${normalizedKeyword} ||
                '%'

            OR
              actor.display_name
                ILIKE
                '%' ||
                ${normalizedKeyword} ||
                '%'

            OR
              audit.note
                ILIKE
                '%' ||
                ${normalizedKeyword} ||
                '%'

            OR
              audit.entity_type
                ILIKE
                '%' ||
                ${normalizedKeyword} ||
                '%'

            OR
              audit.action
                ILIKE
                '%' ||
                ${normalizedKeyword} ||
                '%'
          )
      `

    const total =
      Number(
        countRows[0]
          ?.total ||
        0
      )

    // ========================================================
    // Records
    // ========================================================

    const records =
      await sql`
        SELECT
          audit.id,

          audit.actor_user_id,

          audit.actor_role,

          audit.action,

          audit.entity_type,

          audit.entity_id,

          audit.student_id,

          audit.course_id,

          audit.session_id,

          audit.before_data,

          audit.after_data,

          audit.note,

          audit.request_id,

          audit.ip_address,

          audit.user_agent,

          audit.created_at,

          student.name
            AS student_name,

          course.name
            AS course_name,

          actor.display_name
            AS actor_name,

          actor.role
            AS actor_account_role,

          session.class_date,

          session.start_time,

          schedule.name
            AS schedule_name

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

        LEFT JOIN
          app_users actor

          ON actor.id =
            audit.actor_user_id

        LEFT JOIN
          class_sessions session

          ON session.id =
            audit.session_id

        LEFT JOIN
          class_schedules schedule

          ON schedule.id =
            session.schedule_id

        WHERE
          (
            ${normalizedStudentId}::uuid
              IS NULL

            OR
              audit.student_id =
                ${normalizedStudentId}
          )

          AND (
            ${normalizedCourseId}::uuid
              IS NULL

            OR
              audit.course_id =
                ${normalizedCourseId}
          )

          AND (
            ${normalizedActorUserId}::uuid
              IS NULL

            OR
              audit.actor_user_id =
                ${normalizedActorUserId}
          )

          AND (
            ${normalizedActorRole}::text
              IS NULL

            OR
              audit.actor_role =
                ${normalizedActorRole}
          )

          AND (
            ${normalizedAction}::text
              IS NULL

            OR
              audit.action =
                ${normalizedAction}
          )

          AND (
            ${normalizedEntityType}::text
              IS NULL

            OR
              audit.entity_type =
                ${normalizedEntityType}
          )

          AND (
            ${normalizedEntityId}::uuid
              IS NULL

            OR
              audit.entity_id =
                ${normalizedEntityId}
          )

          AND (
            ${normalizedStartDate}::date
              IS NULL

            OR
              audit.created_at >=
                (
                  ${normalizedStartDate}::date
                  AT TIME ZONE
                  'Asia/Taipei'
                )
          )

          AND (
            ${normalizedEndDate}::date
              IS NULL

            OR
              audit.created_at <
                (
                  (
                    ${normalizedEndDate}::date +
                    INTERVAL '1 day'
                  )
                  AT TIME ZONE
                  'Asia/Taipei'
                )
          )

          AND (
            ${normalizedKeyword}::text
              IS NULL

            OR
              student.name
                ILIKE
                '%' ||
                ${normalizedKeyword} ||
                '%'

            OR
              course.name
                ILIKE
                '%' ||
                ${normalizedKeyword} ||
                '%'

            OR
              actor.display_name
                ILIKE
                '%' ||
                ${normalizedKeyword} ||
                '%'

            OR
              audit.note
                ILIKE
                '%' ||
                ${normalizedKeyword} ||
                '%'

            OR
              audit.entity_type
                ILIKE
                '%' ||
                ${normalizedKeyword} ||
                '%'

            OR
              audit.action
                ILIKE
                '%' ||
                ${normalizedKeyword} ||
                '%'
          )

        ORDER BY
          audit.created_at DESC,
          audit.id DESC

        LIMIT
          ${normalizedPageSize}

        OFFSET
          ${offset}
      `

    // ========================================================
    // Pagination
    // ========================================================

    const totalPages =
      Math.max(
        Math.ceil(
          total /
          normalizedPageSize
        ),
        1
      )

    return {
      records,

      pagination: {
        page:
          normalizedPage,

        pageSize:
          normalizedPageSize,

        total,

        totalPages,

        hasPrevious:
          normalizedPage >
          1,

        hasNext:
          normalizedPage <
          totalPages,
      },
    }
  }

// ============================================================
// Student Timeline
// ============================================================

export const getStudentAuditTimeline =
  async ({
    studentId,
    page = 1,
    pageSize = 20,
  }) => {
    const normalizedStudentId =
      normalizeUuid(
        studentId,
        'Student ID'
      )

    if (
      !normalizedStudentId
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '缺少 Student ID',
      })
    }

    return await queryAuditLogs({
      studentId:
        normalizedStudentId,

      page,

      pageSize,
    })
  }