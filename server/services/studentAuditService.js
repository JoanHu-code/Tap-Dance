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
// Page
// ============================================================

const normalizePage = (
  value
) => {
  const parsed =
    Number.parseInt(
      String(
        value || '1'
      ),
      10
    )

  if (
    !Number.isFinite(
      parsed
    ) ||
    parsed < 1
  ) {
    return 1
  }

  return parsed
}

// ============================================================
// Page Size
// ============================================================

const normalizePageSize = (
  value
) => {
  const parsed =
    Number.parseInt(
      String(
        value || '20'
      ),
      10
    )

  if (
    !Number.isFinite(
      parsed
    )
  ) {
    return 20
  }

  return Math.min(
    Math.max(
      parsed,
      1
    ),
    100
  )
}

// ============================================================
// Filters
// ============================================================

const normalizeFilters = ({
  action = null,
  entityType = null,
  startDate = null,
  endDate = null,
  keyword = null,
} = {}) => {
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

  const normalizedKeyword =
    normalizeText(
      keyword,
      100
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

  return {
    action:
      normalizedAction,

    entityType:
      normalizedEntityType,

    startDate:
      normalizedStartDate,

    endDate:
      normalizedEndDate,

    keyword:
      normalizedKeyword,
  }
}

// ============================================================
// Student
// ============================================================

export const requireAuditStudent =
  async (
    studentId
  ) => {
    assertUuid(
      studentId,
      'Student ID'
    )

    const sql =
      useDatabase()

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
// Student Audit Options
//
// 只從這位學生自己的 Audit Log 中找 Options。
// ============================================================

export const getStudentAuditOptions =
  async (
    studentId
  ) => {
    assertUuid(
      studentId,
      'Student ID'
    )

    const sql =
      useDatabase()

    const [
      actions,
      entityTypes,
      courses,
    ] =
      await Promise.all([
        sql`
          SELECT DISTINCT
            action

          FROM
            audit_logs

          WHERE
            student_id =
              ${studentId}

            AND
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
            student_id =
              ${studentId}

            AND
              entity_type IS NOT NULL

          ORDER BY
            entity_type ASC
        `,

        sql`
          SELECT DISTINCT
            course.id,
            course.name

          FROM
            audit_logs audit

          INNER JOIN
            dance_courses course

            ON course.id =
              audit.course_id

          WHERE
            audit.student_id =
              ${studentId}

          ORDER BY
            course.name ASC
        `,
      ])

    return {
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

      courses,
    }
  }

// ============================================================
// Query Student Audit
// ============================================================

export const queryStudentAuditLogs =
  async ({
    studentId,
    action = null,
    entityType = null,
    startDate = null,
    endDate = null,
    keyword = null,
    page = 1,
    pageSize = 20,
  }) => {
    assertUuid(
      studentId,
      'Student ID'
    )

    const filters =
      normalizeFilters({
        action,
        entityType,
        startDate,
        endDate,
        keyword,
      })

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

    const sql =
      useDatabase()

    // ========================================================
    // Total
    // ========================================================

    const countRows =
      await sql`
        SELECT
          COUNT(*)::INTEGER
            AS total

        FROM
          audit_logs audit

        LEFT JOIN
          dance_courses course

          ON course.id =
            audit.course_id

        WHERE
          audit.student_id =
            ${studentId}

          AND (
            ${filters.action}::text
              IS NULL

            OR
              audit.action =
                ${filters.action}
          )

          AND (
            ${filters.entityType}::text
              IS NULL

            OR
              audit.entity_type =
                ${filters.entityType}
          )

          AND (
            ${filters.startDate}::date
              IS NULL

            OR
              audit.created_at >=
                (
                  ${filters.startDate}::date
                  AT TIME ZONE
                  'Asia/Taipei'
                )
          )

          AND (
            ${filters.endDate}::date
              IS NULL

            OR
              audit.created_at <
                (
                  (
                    ${filters.endDate}::date +
                    INTERVAL '1 day'
                  )
                  AT TIME ZONE
                  'Asia/Taipei'
                )
          )

          AND (
            ${filters.keyword}::text
              IS NULL

            OR
              audit.note
                ILIKE
                '%' ||
                ${filters.keyword} ||
                '%'

            OR
              audit.action
                ILIKE
                '%' ||
                ${filters.keyword} ||
                '%'

            OR
              audit.entity_type
                ILIKE
                '%' ||
                ${filters.keyword} ||
                '%'

            OR
              course.name
                ILIKE
                '%' ||
                ${filters.keyword} ||
                '%'

            OR
              COALESCE(
                audit.before_data::text,
                ''
              )
                ILIKE
                '%' ||
                ${filters.keyword} ||
                '%'

            OR
              COALESCE(
                audit.after_data::text,
                ''
              )
                ILIKE
                '%' ||
                ${filters.keyword} ||
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
    // Summary
    //
    // 這裡統計的是「整個搜尋結果」，
    // 不是只有目前這一頁。
    // ========================================================

    const summaryRows =
      await sql`
        SELECT
          action,
          COUNT(*)::INTEGER
            AS count

        FROM
          audit_logs audit

        LEFT JOIN
          dance_courses course

          ON course.id =
            audit.course_id

        WHERE
          audit.student_id =
            ${studentId}

          AND (
            ${filters.action}::text
              IS NULL

            OR
              audit.action =
                ${filters.action}
          )

          AND (
            ${filters.entityType}::text
              IS NULL

            OR
              audit.entity_type =
                ${filters.entityType}
          )

          AND (
            ${filters.startDate}::date
              IS NULL

            OR
              audit.created_at >=
                (
                  ${filters.startDate}::date
                  AT TIME ZONE
                  'Asia/Taipei'
                )
          )

          AND (
            ${filters.endDate}::date
              IS NULL

            OR
              audit.created_at <
                (
                  (
                    ${filters.endDate}::date +
                    INTERVAL '1 day'
                  )
                  AT TIME ZONE
                  'Asia/Taipei'
                )
          )

          AND (
            ${filters.keyword}::text
              IS NULL

            OR
              audit.note
                ILIKE
                '%' ||
                ${filters.keyword} ||
                '%'

            OR
              audit.action
                ILIKE
                '%' ||
                ${filters.keyword} ||
                '%'

            OR
              audit.entity_type
                ILIKE
                '%' ||
                ${filters.keyword} ||
                '%'

            OR
              course.name
                ILIKE
                '%' ||
                ${filters.keyword} ||
                '%'

            OR
              COALESCE(
                audit.before_data::text,
                ''
              )
                ILIKE
                '%' ||
                ${filters.keyword} ||
                '%'

            OR
              COALESCE(
                audit.after_data::text,
                ''
              )
                ILIKE
                '%' ||
                ${filters.keyword} ||
                '%'
          )

        GROUP BY
          action

        ORDER BY
          action ASC
      `

    const summary = {
      total,

      create: 0,

      update: 0,

      cancel: 0,

      restore: 0,

      renew: 0,

      link: 0,

      unlink: 0,
    }

    for (
      const row of
      summaryRows
    ) {
      const key =
        String(
          row.action ||
          ''
        )
          .trim()
          .toLowerCase()

      if (
        Object.prototype
          .hasOwnProperty
          .call(
            summary,
            key
          )
      ) {
        summary[key] =
          Number(
            row.count ||
            0
          )
      }
    }

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

          audit.created_at,

          course.name
            AS course_name,

          session.class_date,

          session.start_time,

          session.end_time,

          schedule.name
            AS schedule_name

        FROM
          audit_logs audit

        LEFT JOIN
          dance_courses course

          ON course.id =
            audit.course_id

        LEFT JOIN
          class_sessions session

          ON session.id =
            audit.session_id

        LEFT JOIN
          class_schedules schedule

          ON schedule.id =
            session.schedule_id

        WHERE
          audit.student_id =
            ${studentId}

          AND (
            ${filters.action}::text
              IS NULL

            OR
              audit.action =
                ${filters.action}
          )

          AND (
            ${filters.entityType}::text
              IS NULL

            OR
              audit.entity_type =
                ${filters.entityType}
          )

          AND (
            ${filters.startDate}::date
              IS NULL

            OR
              audit.created_at >=
                (
                  ${filters.startDate}::date
                  AT TIME ZONE
                  'Asia/Taipei'
                )
          )

          AND (
            ${filters.endDate}::date
              IS NULL

            OR
              audit.created_at <
                (
                  (
                    ${filters.endDate}::date +
                    INTERVAL '1 day'
                  )
                  AT TIME ZONE
                  'Asia/Taipei'
                )
          )

          AND (
            ${filters.keyword}::text
              IS NULL

            OR
              audit.note
                ILIKE
                '%' ||
                ${filters.keyword} ||
                '%'

            OR
              audit.action
                ILIKE
                '%' ||
                ${filters.keyword} ||
                '%'

            OR
              audit.entity_type
                ILIKE
                '%' ||
                ${filters.keyword} ||
                '%'

            OR
              course.name
                ILIKE
                '%' ||
                ${filters.keyword} ||
                '%'

            OR
              COALESCE(
                audit.before_data::text,
                ''
              )
                ILIKE
                '%' ||
                ${filters.keyword} ||
                '%'

            OR
              COALESCE(
                audit.after_data::text,
                ''
              )
                ILIKE
                '%' ||
                ${filters.keyword} ||
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
    // Actor Label
    //
    // 學生不需要知道其他 app_users 的個資。
    // ========================================================

    const mappedRecords =
      records.map(
        (
          record
        ) => {
          let actorLabel =
            '系統'

          if (
            record.actor_role ===
            'STUDENT'
          ) {
            actorLabel =
              '我'
          } else if (
            record.actor_role ===
            'TEACHER'
          ) {
            actorLabel =
              '老師'
          } else if (
            record.actor_role ===
            'SYSTEM'
          ) {
            actorLabel =
              '系統'
          }

          return {
            ...record,

            actor_label:
              actorLabel,
          }
        }
      )

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
      summary,

      records:
        mappedRecords,

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