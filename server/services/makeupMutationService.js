import {
  useDatabase,
} from '../utils/db.js'

import {
  createAuditQuery,
  getAuditRequestMetadata,
} from './auditService.js'

import {
  createPackageStateRecalculationQuery,
} from './packageStateService.js'

// ============================================================
// UUID
// ============================================================

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const normalizeUuid = (
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
// Role
// ============================================================

const normalizeActorRole = (
  value
) => {
  const role =
    String(
      value ||
      ''
    )
      .trim()
      .toUpperCase()

  if (
    ![
      'TEACHER',
      'STUDENT',
    ].includes(
      role
    )
  ) {
    throw createError({
      statusCode: 400,

      statusMessage:
        'Actor Role 不正確',
    })
  }

  return role
}

// ============================================================
// Text
// ============================================================

const normalizeText = (
  value,
  maxLength = 2000
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
        maxLength
      )

  return (
    normalized ||
    null
  )
}

// ============================================================
// Timestamp equality
// ============================================================

const sameTimestamp = (
  a,
  b
) => {
  if (
    !a ||
    !b
  ) {
    return false
  }

  const first =
    new Date(
      a
    ).getTime()

  const second =
    new Date(
      b
    ).getTime()

  if (
    Number.isNaN(
      first
    ) ||
    Number.isNaN(
      second
    )
  ) {
    return false
  }

  return (
    Math.abs(
      first -
      second
    ) <
    5
  )
}

// ============================================================
// Get Makeup
// ============================================================

const requireMakeup =
  async (
    sql,
    {
      makeupId,
      studentId = null,
    }
  ) => {
    const rows =
      await sql`
        SELECT
          makeup.id,

          makeup.student_id,

          makeup.course_id,

          makeup.package_id,

          makeup.source_leave_attendance_id,

          makeup.source_session_id,

          makeup.makeup_session_id,

          makeup.makeup_attendance_id,

          makeup.status,

          makeup.note,

          makeup.created_by,

          makeup.linked_attendance_synced_at,

          makeup.cancelled_at,

          makeup.cancelled_by,

          makeup.cancellation_reason,

          makeup.restored_at,

          makeup.restored_by,

          makeup.created_at,

          makeup.updated_at,

          student.name
            AS student_name,

          course.name
            AS course_name,

          source_attendance.status
            AS source_attendance_status,

          target_attendance.student_id
            AS target_student_id,

          target_attendance.package_id
            AS target_package_id,

          target_attendance.session_id
            AS target_session_id,

          target_attendance.status
            AS target_attendance_status,

          target_attendance.attendance_type
            AS target_attendance_type,

          target_attendance.original_status
            AS target_original_status,

          target_attendance.cancelled_at
            AS target_cancelled_at,

          target_attendance.note
            AS target_attendance_note,

          target_attendance.updated_at
            AS target_attendance_updated_at

        FROM
          makeup_records makeup

        INNER JOIN
          students student

          ON student.id =
            makeup.student_id

        INNER JOIN
          dance_courses course

          ON course.id =
            makeup.course_id

        LEFT JOIN
          attendance_records_v2 source_attendance

          ON source_attendance.id =
            makeup.source_leave_attendance_id

        LEFT JOIN
          attendance_records_v2 target_attendance

          ON target_attendance.id =
            makeup.makeup_attendance_id

        WHERE
          makeup.id =
            ${makeupId}

          AND (
            ${studentId}::uuid
              IS NULL

            OR
              makeup.student_id =
                ${studentId}
          )

        LIMIT 1
      `

    if (
      !rows.length
    ) {
      throw createError({
        statusCode: 404,

        statusMessage:
          '找不到補課紀錄',
      })
    }

    return rows[0]
  }

// ============================================================
// Linked Attendance Integrity
// ============================================================

const assertLinkedAttendanceIdentity =
  (
    makeup
  ) => {
    if (
      !makeup.makeup_attendance_id
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '補課紀錄沒有對應的 Attendance',
      })
    }

    if (
      String(
        makeup.target_student_id
      ) !==
      String(
        makeup.student_id
      )
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '補課 Attendance 的 Student 已不一致，請由老師檢查資料',
      })
    }

    if (
      String(
        makeup.target_package_id
      ) !==
      String(
        makeup.package_id
      )
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '補課 Attendance 的 Package 已不一致，請由老師檢查資料',
      })
    }

    if (
      String(
        makeup.target_session_id
      ) !==
      String(
        makeup.makeup_session_id
      )
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '補課 Attendance 的 Session 已不一致，請由老師檢查資料',
      })
    }

    if (
      makeup.target_attendance_type !==
      'MAKEUP'
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '對應 Attendance 已不是 MAKEUP 類型，為避免覆蓋資料，本次操作已停止',
      })
    }
  }

// ============================================================
// Audit Metadata
// ============================================================

const resolveAuditMetadata = (
  event
) => {
  return event
    ? getAuditRequestMetadata(
        event
      )
    : {}
}

// ============================================================
// Cancel Makeup
// ============================================================

export const cancelMakeup =
  async ({
    makeupId,

    studentId = null,

    reason = null,

    actorUserId,

    actorRole,

    event = null,
  }) => {
    const normalizedMakeupId =
      normalizeUuid(
        makeupId,
        'Makeup ID'
      )

    const normalizedStudentId =
      studentId
        ? normalizeUuid(
            studentId,
            'Student ID'
          )
        : null

    const normalizedActorId =
      normalizeUuid(
        actorUserId,
        'Actor User ID'
      )

    const normalizedRole =
      normalizeActorRole(
        actorRole
      )

    const normalizedReason =
      normalizeText(
        reason
      )

    const sql =
      useDatabase()

    const makeup =
      await requireMakeup(
        sql,
        {
          makeupId:
            normalizedMakeupId,

          studentId:
            normalizedStudentId,
        }
      )

    if (
      makeup.status !==
      'ACTIVE'
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '只有進行中的補課可以取消',
      })
    }

    // ========================================================
    // Source Leave must still be LEAVE
    // ========================================================

    if (
      makeup.source_attendance_status !==
      'LEAVE'
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '原始請假紀錄已被修改，不能直接取消補課，請先檢查請假紀錄',
      })
    }

    assertLinkedAttendanceIdentity(
      makeup
    )

    // ========================================================
    // Must still be ATTENDED
    // ========================================================

    if (
      makeup.target_attendance_status !==
      'ATTENDED'
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '補課 Attendance 已被修改，不再是出席狀態，為避免覆蓋資料已停止取消',
      })
    }

    // ========================================================
    // Detect outside modification
    // ========================================================

    if (
      !sameTimestamp(
        makeup.target_attendance_updated_at,
        makeup.linked_attendance_synced_at
      )
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '補課 Attendance 在補課建立後曾被其他流程修改，請重新確認資料後再處理',
      })
    }

    const beforeData = {
      status:
        makeup.status,

      attendance_status:
        makeup.target_attendance_status,

      note:
        makeup.note,
    }

    const afterData = {
      status:
        'CANCELLED',

      attendance_status:
        'CANCELLED',

      cancellation_reason:
        normalizedReason,
    }

    const auditMetadata =
      resolveAuditMetadata(
        event
      )

    // ========================================================
    // Attendance Cancel
    // ========================================================

    const attendanceQuery =
      sql`
        UPDATE
          attendance_records_v2

        SET
          status =
            'CANCELLED',

          original_status =
            'ATTENDED',

          cancelled_at =
            NOW(),

          updated_at =
            NOW()

        WHERE
          id =
            ${makeup.makeup_attendance_id}

          AND
            status =
              'ATTENDED'

          AND
            attendance_type =
              'MAKEUP'

        RETURNING
          *
      `

    // ========================================================
    // Makeup Cancel
    // ========================================================

    const makeupQuery =
      sql`
        UPDATE
          makeup_records

        SET
          status =
            'CANCELLED',

          cancelled_at =
            NOW(),

          cancelled_by =
            ${normalizedActorId},

          cancellation_reason =
            ${normalizedReason},

          restored_at =
            NULL,

          restored_by =
            NULL,

          linked_attendance_synced_at =
            NOW(),

          updated_at =
            NOW()

        WHERE
          id =
            ${normalizedMakeupId}

          AND
            status =
              'ACTIVE'

        RETURNING
          *
      `

    const auditQuery =
      createAuditQuery(
        sql,
        {
          actorUserId:
            normalizedActorId,

          actorRole:
            normalizedRole,

          action:
            'CANCEL',

          entityType:
            'MAKEUP',

          entityId:
            normalizedMakeupId,

          studentId:
            makeup.student_id,

          courseId:
            makeup.course_id,

          beforeData,

          afterData,

          note:
            `${makeup.student_name} 取消「${makeup.course_name}」補課`,

          ...auditMetadata,
        }
      )

    const packageQuery =
      createPackageStateRecalculationQuery(
        sql,
        makeup.package_id
      )

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

    const results =
      await sql.transaction([
        attendanceQuery,
        makeupQuery,
        auditQuery,
        packageQuery,
      ])

    if (
      !results[0]?.length ||
      !results[1]?.length
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '補課資料在操作期間已被其他人修改，請重新整理',
      })
    }

    return {
      attendance:
        results[0][0],

      makeup:
        results[1][0],

      package:
        results[3]?.[0] ||
        null,
    }
  }

// ============================================================
// Restore Makeup
// ============================================================

export const restoreMakeup =
  async ({
    makeupId,

    studentId = null,

    actorUserId,

    actorRole,

    event = null,
  }) => {
    const normalizedMakeupId =
      normalizeUuid(
        makeupId,
        'Makeup ID'
      )

    const normalizedStudentId =
      studentId
        ? normalizeUuid(
            studentId,
            'Student ID'
          )
        : null

    const normalizedActorId =
      normalizeUuid(
        actorUserId,
        'Actor User ID'
      )

    const normalizedRole =
      normalizeActorRole(
        actorRole
      )

    const sql =
      useDatabase()

    const makeup =
      await requireMakeup(
        sql,
        {
          makeupId:
            normalizedMakeupId,

          studentId:
            normalizedStudentId,
        }
      )

    if (
      makeup.status !==
      'CANCELLED'
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '只有已取消的補課可以恢復',
      })
    }

    if (
      makeup.source_attendance_status !==
      'LEAVE'
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '原始請假目前已不是 LEAVE，不能恢復補課',
      })
    }

    assertLinkedAttendanceIdentity(
      makeup
    )

    // ========================================================
    // Cancellation provenance
    // ========================================================

    if (
      makeup.target_attendance_status !==
        'CANCELLED' ||
      makeup.target_original_status !==
        'ATTENDED'
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '補課 Attendance 並不是由正常補課取消流程產生，不能直接恢復',
      })
    }

    if (
      !makeup.target_cancelled_at ||
      !makeup.cancelled_at
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '缺少補課取消紀錄，不能自動恢復',
      })
    }

    if (
      !sameTimestamp(
        makeup.target_attendance_updated_at,
        makeup.linked_attendance_synced_at
      )
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '取消後的 Attendance 曾被其他流程修改，不能直接恢復',
      })
    }

    // ========================================================
    // Ensure no another ACTIVE source / target
    // ========================================================

    const conflicts =
      await sql`
        SELECT
          id

        FROM
          makeup_records

        WHERE
          id <>
            ${normalizedMakeupId}

          AND
            status =
              'ACTIVE'

          AND (
            source_leave_attendance_id =
              ${makeup.source_leave_attendance_id}

            OR (
              student_id =
                ${makeup.student_id}

              AND
                makeup_session_id =
                  ${makeup.makeup_session_id}
            )
          )

        LIMIT 1
      `

    if (
      conflicts.length
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '這筆請假或補課日期目前已有其他進行中的補課',
      })
    }

    const beforeData = {
      status:
        makeup.status,

      attendance_status:
        makeup.target_attendance_status,
    }

    const afterData = {
      status:
        'ACTIVE',

      attendance_status:
        'ATTENDED',
    }

    const auditMetadata =
      resolveAuditMetadata(
        event
      )

    // ========================================================
    // Restore Attendance
    //
    // Migration 020 Trigger 會鎖 Package 並驗證堂數。
    // ========================================================

    const attendanceQuery =
      sql`
        UPDATE
          attendance_records_v2

        SET
          status =
            'ATTENDED',

          original_status =
            NULL,

          cancelled_at =
            NULL,

          updated_at =
            NOW()

        WHERE
          id =
            ${makeup.makeup_attendance_id}

          AND
            status =
              'CANCELLED'

          AND
            attendance_type =
              'MAKEUP'

          AND
            original_status =
              'ATTENDED'

        RETURNING
          *
      `

    const makeupQuery =
      sql`
        UPDATE
          makeup_records

        SET
          status =
            'ACTIVE',

          cancelled_at =
            NULL,

          cancelled_by =
            NULL,

          cancellation_reason =
            NULL,

          restored_at =
            NOW(),

          restored_by =
            ${normalizedActorId},

          linked_attendance_synced_at =
            NOW(),

          updated_at =
            NOW()

        WHERE
          id =
            ${normalizedMakeupId}

          AND
            status =
              'CANCELLED'

        RETURNING
          *
      `

    const auditQuery =
      createAuditQuery(
        sql,
        {
          actorUserId:
            normalizedActorId,

          actorRole:
            normalizedRole,

          action:
            'RESTORE',

          entityType:
            'MAKEUP',

          entityId:
            normalizedMakeupId,

          studentId:
            makeup.student_id,

          courseId:
            makeup.course_id,

          beforeData,

          afterData,

          note:
            `${makeup.student_name} 恢復「${makeup.course_name}」補課`,

          ...auditMetadata,
        }
      )

    const packageQuery =
      createPackageStateRecalculationQuery(
        sql,
        makeup.package_id
      )

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

    let results

    try {
      results =
        await sql.transaction([
          attendanceQuery,
          makeupQuery,
          auditQuery,
          packageQuery,
        ])
    } catch (
      error
    ) {
      if (
        String(
          error?.message ||
          ''
        ).includes(
          'PACKAGE_SESSION_LIMIT_REACHED'
        )
      ) {
        throw createError({
          statusCode: 409,

          statusMessage:
            '方案堂數目前已經全部使用完畢，不能恢復這筆補課',
        })
      }

      if (
        error?.code ===
        '23505'
      ) {
        throw createError({
          statusCode: 409,

          statusMessage:
            '補課恢復時發現重複紀錄，請重新整理',
        })
      }

      throw error
    }

    if (
      !results[0]?.length ||
      !results[1]?.length
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '補課資料已被其他流程修改，請重新整理',
      })
    }

    return {
      attendance:
        results[0][0],

      makeup:
        results[1][0],

      package:
        results[3]?.[0] ||
        null,
    }
  }

// ============================================================
// Update Makeup Note
//
// Active Makeup：
// 同步修改 makeup_records.note
// 以及 linked Attendance.note
//
// 避免兩邊顯示不同。
// ============================================================

export const updateMakeupNote =
  async ({
    makeupId,

    studentId = null,

    note,

    actorUserId,

    actorRole,

    event = null,
  }) => {
    const normalizedMakeupId =
      normalizeUuid(
        makeupId,
        'Makeup ID'
      )

    const normalizedStudentId =
      studentId
        ? normalizeUuid(
            studentId,
            'Student ID'
          )
        : null

    const normalizedActorId =
      normalizeUuid(
        actorUserId,
        'Actor User ID'
      )

    const normalizedRole =
      normalizeActorRole(
        actorRole
      )

    const normalizedNote =
      normalizeText(
        note
      )

    const sql =
      useDatabase()

    const makeup =
      await requireMakeup(
        sql,
        {
          makeupId:
            normalizedMakeupId,

          studentId:
            normalizedStudentId,
        }
      )

    assertLinkedAttendanceIdentity(
      makeup
    )

    if (
      !sameTimestamp(
        makeup.target_attendance_updated_at,
        makeup.linked_attendance_synced_at
      )
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '對應 Attendance 已被其他流程修改，為避免覆蓋資料，請重新整理',
      })
    }

    const beforeData = {
      note:
        makeup.note,
    }

    const afterData = {
      note:
        normalizedNote,
    }

    const auditMetadata =
      resolveAuditMetadata(
        event
      )

    const attendanceQuery =
      sql`
        UPDATE
          attendance_records_v2

        SET
          note =
            ${normalizedNote},

          updated_at =
            NOW()

        WHERE
          id =
            ${makeup.makeup_attendance_id}

        RETURNING
          *
      `

    const makeupQuery =
      sql`
        UPDATE
          makeup_records

        SET
          note =
            ${normalizedNote},

          linked_attendance_synced_at =
            NOW(),

          updated_at =
            NOW()

        WHERE
          id =
            ${normalizedMakeupId}

        RETURNING
          *
      `

    const auditQuery =
      createAuditQuery(
        sql,
        {
          actorUserId:
            normalizedActorId,

          actorRole:
            normalizedRole,

          action:
            'UPDATE',

          entityType:
            'MAKEUP',

          entityId:
            normalizedMakeupId,

          studentId:
            makeup.student_id,

          courseId:
            makeup.course_id,

          beforeData,

          afterData,

          note:
            `${makeup.student_name} 修改補課備註`,

          ...auditMetadata,
        }
      )

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

    const results =
      await sql.transaction([
        attendanceQuery,
        makeupQuery,
        auditQuery,
      ])

    return {
      attendance:
        results[0]?.[0] ||
        null,

      makeup:
        results[1]?.[0] ||
        null,
    }
  }

// ============================================================
// Generic Mutation
//
// 給既有 shared API 使用。
// ============================================================

export const mutateMakeup =
  async ({
    action,
    ...options
  }) => {
    const normalizedAction =
      String(
        action ||
        ''
      )
        .trim()
        .toUpperCase()

    if (
      normalizedAction ===
      'CANCEL'
    ) {
      return await cancelMakeup(
        options
      )
    }

    if (
      normalizedAction ===
      'RESTORE'
    ) {
      return await restoreMakeup(
        options
      )
    }

    if (
      normalizedAction ===
      'UPDATE_NOTE'
    ) {
      return await updateMakeupNote(
        options
      )
    }

    throw createError({
      statusCode: 400,

      statusMessage:
        '不支援的補課操作',
    })
  }