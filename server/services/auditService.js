import {
  randomUUID,
} from 'node:crypto'

// ============================================================
// Allowed Roles
// ============================================================

const ALLOWED_ROLES = [
  'TEACHER',
  'STUDENT',
  'SYSTEM',
]

// ============================================================
// Allowed Actions
// ============================================================

const ALLOWED_ACTIONS = [
  'CREATE',
  'UPDATE',
  'CANCEL',
  'RESTORE',
  'RENEW',
  'LINK',
  'UNLINK',
]

// ============================================================
// Normalize Role
// ============================================================

const normalizeRole = (
  value
) => {
  const role =
    String(
      value || ''
    )
      .trim()
      .toUpperCase()

  if (
    !ALLOWED_ROLES.includes(
      role
    )
  ) {
    throw createError({
      statusCode: 500,

      statusMessage:
        `Audit actorRole 不正確：${role}`,
    })
  }

  return role
}

// ============================================================
// Normalize Action
// ============================================================

const normalizeAction = (
  value
) => {
  const action =
    String(
      value || ''
    )
      .trim()
      .toUpperCase()

  if (
    !ALLOWED_ACTIONS.includes(
      action
    )
  ) {
    throw createError({
      statusCode: 500,

      statusMessage:
        `Audit action 不正確：${action}`,
    })
  }

  return action
}

// ============================================================
// Entity Type
// ============================================================

const normalizeEntityType = (
  value
) => {
  const entityType =
    String(
      value || ''
    )
      .trim()
      .toUpperCase()

  if (!entityType) {
    throw createError({
      statusCode: 500,

      statusMessage:
        'Audit entityType 不可為空',
    })
  }

  return entityType
}

// ============================================================
// Request Metadata
// ============================================================

export const getAuditRequestMetadata =
  (
    event
  ) => {
    if (!event) {
      return {
        requestId:
          randomUUID(),

        ipAddress:
          null,

        userAgent:
          null,
      }
    }

    const headers =
      getHeaders(
        event
      )

    const forwardedFor =
      headers[
        'x-forwarded-for'
      ]

    const ipAddress =
      forwardedFor
        ? String(
            forwardedFor
          )
            .split(',')[0]
            .trim()
        : (
            headers[
              'x-real-ip'
            ] ||
            null
          )

    const userAgent =
      headers[
        'user-agent'
      ] ||
      null

    const requestId =
      headers[
        'x-request-id'
      ] ||
      headers[
        'x-vercel-id'
      ] ||
      randomUUID()

    return {
      requestId:
        String(
          requestId
        ),

      ipAddress:
        ipAddress
          ? String(
              ipAddress
            )
          : null,

      userAgent:
        userAgent
          ? String(
              userAgent
            )
          : null,
    }
  }

// ============================================================
// 建立 Audit SQL Query
//
// 注意：
//
// 這支不是自己直接 await。
// 而是回傳 sql`...` Query，
// 讓業務資料與 Audit 可以一起放進 transaction。
// ============================================================

export const createAuditQuery =
  (
    sql,
    {
      actorUserId,
      actorRole,
      action,
      entityType,
      entityId = null,
      studentId = null,
      courseId = null,
      sessionId = null,
      beforeData = null,
      afterData = null,
      note = null,
      requestId = null,
      ipAddress = null,
      userAgent = null,
    }
  ) => {
    const normalizedRole =
      normalizeRole(
        actorRole
      )

    const normalizedAction =
      normalizeAction(
        action
      )

    const normalizedEntityType =
      normalizeEntityType(
        entityType
      )

    return sql`
      INSERT INTO
        audit_logs (
          actor_user_id,
          actor_role,
          action,
          entity_type,
          entity_id,
          student_id,
          course_id,
          session_id,
          before_data,
          after_data,
          note,
          request_id,
          ip_address,
          user_agent,
          created_at
        )

      VALUES (
        ${actorUserId || null},
        ${normalizedRole},
        ${normalizedAction},
        ${normalizedEntityType},
        ${entityId || null},
        ${studentId || null},
        ${courseId || null},
        ${sessionId || null},

        ${
          beforeData === null
            ? null
            : JSON.stringify(
                beforeData
              )
        }::jsonb,

        ${
          afterData === null
            ? null
            : JSON.stringify(
                afterData
              )
        }::jsonb,

        ${note || null},
        ${requestId || null},
        ${ipAddress || null},
        ${userAgent || null},
        NOW()
      )

      RETURNING
        *
    `
  }

// ============================================================
// 單獨建立 Audit
//
// 若沒有其他 Business Transaction 時使用。
// ============================================================

export const createAuditLog =
  async (
    sql,
    payload
  ) => {
    const query =
      createAuditQuery(
        sql,
        payload
      )

    const result =
      await query

    return (
      result[0] ||
      null
    )
  }