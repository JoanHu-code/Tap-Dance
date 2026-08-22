import {
  useDatabase,
} from '../utils/db.js'

import {
  createAuditQuery,
} from './auditService.js'

import {
  recalculatePackage,
} from './attendanceService.js'

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
// Actor Role
// ============================================================

const normalizeActorRole = (
  actorRole
) => {
  const role =
    String(
      actorRole || ''
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
        'Attendance 操作者角色不正確',
    })
  }

  return role
}

// ============================================================
// Status
// ============================================================

const normalizeUpdateStatus = (
  status,
  actorRole
) => {
  const normalized =
    String(
      status || ''
    )
      .trim()
      .toUpperCase()

  const allowedStatuses =
    actorRole ===
    'TEACHER'
      ? [
          'ATTENDED',
          'LEAVE',
          'ABSENT',
        ]
      : [
          'ATTENDED',
          'LEAVE',
        ]

  if (
    !allowedStatuses.includes(
      normalized
    )
  ) {
    throw createError({
      statusCode: 400,

      statusMessage:
        actorRole ===
        'TEACHER'
          ? '老師只能修改為 ATTENDED、LEAVE 或 ABSENT'
          : '學生只能修改為 ATTENDED 或 LEAVE',
    })
  }

  return normalized
}

// ============================================================
// Note
// ============================================================

const normalizeNote = (
  note
) => {
  if (
    note ===
      undefined
  ) {
    return undefined
  }

  if (
    note === null
  ) {
    return null
  }

  const value =
    String(
      note
    )
      .trim()
      .slice(
        0,
        1000
      )

  return (
    value ||
    null
  )
}

// ============================================================
// Attendance Snapshot
// ============================================================

const getAttendanceSnapshot =
  async (
    sql,
    attendanceId
  ) => {
    assertUuid(
      attendanceId,
      'Attendance ID'
    )

    const records =
      await sql`
        SELECT
          a.*,

          s.name
            AS student_name,

          cs.class_date,

          cs.start_time,

          cs.end_time,

          cs.status
            AS session_status,

          schedule.course_id,

          course.name
            AS course_name,

          p.cycle_no
            AS package_cycle_no,

          p.total_sessions
            AS package_total_sessions,

          p.status
            AS package_status

        FROM
          attendance_records_v2 a

        INNER JOIN
          students s

          ON s.id =
            a.student_id

        INNER JOIN
          class_sessions cs

          ON cs.id =
            a.session_id

        INNER JOIN
          class_schedules schedule

          ON schedule.id =
            cs.schedule_id

        INNER JOIN
          dance_courses course

          ON course.id =
            schedule.course_id

        LEFT JOIN
          student_packages p

          ON p.id =
            a.package_id

        WHERE
          a.id =
            ${attendanceId}

        LIMIT 1
      `

    if (
      !records.length
    ) {
      throw createError({
        statusCode: 404,

        statusMessage:
          '找不到 Attendance 紀錄',
      })
    }

    return records[0]
  }

// ============================================================
// 驗證學生只能碰自己的 Attendance
// ============================================================

const verifyOwnership =
  (
    attendance,
    actorRole,
    studentId
  ) => {
    if (
      actorRole !==
      'STUDENT'
    ) {
      return
    }

    assertUuid(
      studentId,
      '學生 ID'
    )

    if (
      String(
        attendance.student_id
      ) !==
      String(
        studentId
      )
    ) {
      throw createError({
        statusCode: 403,

        statusMessage:
          '不能修改其他學生的 Attendance',
      })
    }
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
// Package 滿堂保護
//
// 如果：
//
// Cycle 1 原本 7 / 8
//
// 現在把 LEAVE 改成 ATTENDED
//
// → 8 / 8 可以
//
// 但如果已經 8 / 8，
// 又把另一筆改成 ATTENDED 造成 9 / 8，
// 就拒絕。
// ============================================================

const validateAttendedCapacity =
  async (
    sql,
    attendance,
    nextStatus
  ) => {
    if (
      nextStatus !==
      'ATTENDED'
    ) {
      return
    }

    if (
      attendance.status ===
      'ATTENDED'
    ) {
      return
    }

    if (
      !attendance.package_id
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '此 Attendance 沒有綁定 Package，無法改為 ATTENDED',
      })
    }

    const packages =
      await sql`
        SELECT
          p.total_sessions,

          COALESCE(
            COUNT(a.id)
              FILTER (
                WHERE
                  a.status =
                    'ATTENDED'
              ),
            0
          )::INTEGER
            AS attended_count

        FROM
          student_packages p

        LEFT JOIN
          attendance_records_v2 a

          ON a.package_id =
            p.id

        WHERE
          p.id =
            ${attendance.package_id}

        GROUP BY
          p.id,
          p.total_sessions

        LIMIT 1
      `

    if (
      !packages.length
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '找不到此 Attendance 對應的 Package',
      })
    }

    const packageData =
      packages[0]

    const attended =
      Number(
        packageData
          .attended_count ||
        0
      )

    const total =
      Number(
        packageData
          .total_sessions ||
        0
      )

    if (
      attended >= total
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          `此期 Package 已完成 ${attended}/${total} 堂，不能再增加 ATTENDED`,
      })
    }
  }

// ============================================================
// 修改 Attendance
//
// 老師：
// ATTENDED / LEAVE / ABSENT
//
// 學生：
// ATTENDED / LEAVE
//
// 注意：
// 不允許直接 PATCH 成 CANCELLED。
// 取消必須走 cancelAttendance。
// ============================================================

export const updateAttendance =
  async ({
    attendanceId,
    status,
    note,
    actorUserId,
    actorRole,
    studentId = null,
    auditMetadata = {},
  }) => {
    assertUuid(
      actorUserId,
      '操作者 ID'
    )

    const normalizedRole =
      normalizeActorRole(
        actorRole
      )

    const sql =
      useDatabase()

    const beforeData =
      await getAttendanceSnapshot(
        sql,
        attendanceId
      )

    verifyOwnership(
      beforeData,
      normalizedRole,
      studentId
    )

    if (
      beforeData.status ===
      'CANCELLED'
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '此紀錄目前已取消，請先恢復後再修改',
      })
    }

    // ========================================================
    // 沒有傳 status 就維持原值
    // ========================================================

    const nextStatus =
      status ===
        undefined
        ? beforeData.status
        : normalizeUpdateStatus(
            status,
            normalizedRole
          )

    const normalizedNote =
      normalizeNote(
        note
      )

    const nextNote =
      normalizedNote ===
        undefined
        ? beforeData.note
        : normalizedNote

    if (
      nextStatus ===
        beforeData.status &&
      nextNote ===
        beforeData.note
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          'Attendance 沒有任何變更',
      })
    }

    await validateAttendedCapacity(
      sql,
      beforeData,
      nextStatus
    )

    const afterSnapshot = {
      ...beforeData,

      status:
        nextStatus,

      note:
        nextNote,

      // ======================================================
      // package_id 永遠不改
      // ======================================================

      package_id:
        beforeData.package_id,
    }

    const queries = [
      sql`
        UPDATE
          attendance_records_v2

        SET
          status =
            ${nextStatus},

          note =
            ${nextNote},

          updated_at =
            NOW()

        WHERE
          id =
            ${attendanceId}

        RETURNING
          *
      `,

      createAuditQuery(
        sql,
        {
          actorUserId,

          actorRole:
            normalizedRole,

          action:
            'UPDATE',

          entityType:
            'ATTENDANCE',

          entityId:
            attendanceId,

          studentId:
            beforeData.student_id,

          courseId:
            beforeData.course_id,

          sessionId:
            beforeData.session_id,

          beforeData,

          afterData:
            afterSnapshot,

          note:
            `${normalizedRole === 'TEACHER' ? '老師' : '學生'}修改 Attendance：${beforeData.status} → ${nextStatus}`,

          ...auditMetadata,
        }
      ),
    ]

    const results =
      await runTransaction(
        sql,
        queries
      )

    const updated =
      results[0]?.[0]

    // ========================================================
    // 只重算原本的 Package
    //
    // 絕對不重新找 ACTIVE Package。
    // ========================================================

    let packageData =
      null

    if (
      beforeData.package_id
    ) {
      packageData =
        await recalculatePackage(
          sql,
          beforeData.package_id
        )
    }

    const latest =
      await getAttendanceSnapshot(
        sql,
        attendanceId
      )

    return {
      attendance:
        latest,

      package:
        packageData,
    }
  }

// ============================================================
// Cancel Attendance
//
// ATTENDED → CANCELLED
// LEAVE    → CANCELLED
// ABSENT   → CANCELLED
//
// original_status 保存取消前狀態。
// ============================================================

export const cancelAttendance =
  async ({
    attendanceId,
    reason = null,
    actorUserId,
    actorRole,
    studentId = null,
    auditMetadata = {},
  }) => {
    assertUuid(
      actorUserId,
      '操作者 ID'
    )

    const normalizedRole =
      normalizeActorRole(
        actorRole
      )

    const sql =
      useDatabase()

    const beforeData =
      await getAttendanceSnapshot(
        sql,
        attendanceId
      )

    verifyOwnership(
      beforeData,
      normalizedRole,
      studentId
    )

    if (
      beforeData.status ===
      'CANCELLED'
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '此 Attendance 已經取消',
      })
    }

    const normalizedReason =
      reason
        ? String(
            reason
          )
            .trim()
            .slice(
              0,
              1000
            )
        : null

    const afterSnapshot = {
      ...beforeData,

      original_status:
        beforeData.status,

      status:
        'CANCELLED',

      cancelled_at:
        new Date()
          .toISOString(),
    }

    const queries = [
      sql`
        UPDATE
          attendance_records_v2

        SET
          original_status =
            ${beforeData.status},

          status =
            'CANCELLED',

          cancelled_at =
            NOW(),

          updated_at =
            NOW()

        WHERE
          id =
            ${attendanceId}

        RETURNING
          *
      `,

      createAuditQuery(
        sql,
        {
          actorUserId,

          actorRole:
            normalizedRole,

          action:
            'CANCEL',

          entityType:
            'ATTENDANCE',

          entityId:
            attendanceId,

          studentId:
            beforeData.student_id,

          courseId:
            beforeData.course_id,

          sessionId:
            beforeData.session_id,

          beforeData,

          afterData:
            afterSnapshot,

          note:
            normalizedReason ||
            `${normalizedRole === 'TEACHER' ? '老師' : '學生'}取消 Attendance`,

          ...auditMetadata,
        }
      ),
    ]

    const results =
      await runTransaction(
        sql,
        queries
      )

    const updated =
      results[0]?.[0]

    let packageData =
      null

    if (
      beforeData.package_id
    ) {
      packageData =
        await recalculatePackage(
          sql,
          beforeData.package_id
        )
    }

    return {
      attendance:
        updated,

      package:
        packageData,
    }
  }

// ============================================================
// Restore Attendance
//
// CANCELLED
// ↓
// original_status
//
// 例如：
//
// CANCELLED
// original_status = ATTENDED
//
// Restore
// ↓
// ATTENDED
// ============================================================

export const restoreAttendance =
  async ({
    attendanceId,
    reason = null,
    actorUserId,
    actorRole,
    studentId = null,
    auditMetadata = {},
  }) => {
    assertUuid(
      actorUserId,
      '操作者 ID'
    )

    const normalizedRole =
      normalizeActorRole(
        actorRole
      )

    const sql =
      useDatabase()

    const beforeData =
      await getAttendanceSnapshot(
        sql,
        attendanceId
      )

    verifyOwnership(
      beforeData,
      normalizedRole,
      studentId
    )

    if (
      beforeData.status !==
      'CANCELLED'
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '此 Attendance 並不是取消狀態',
      })
    }

    if (
      !beforeData
        .original_status
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '此取消紀錄沒有 original_status，無法自動恢復',
      })
    }

    const restoreStatus =
      String(
        beforeData
          .original_status
      )
        .trim()
        .toUpperCase()

    // ========================================================
    // Student 仍然受角色權限限制
    //
    // 如果某筆是老師建立的：
    // original_status = ABSENT
    //
    // 學生不能自己恢復成 ABSENT。
    // ========================================================

    normalizeUpdateStatus(
      restoreStatus,
      normalizedRole
    )

    await validateAttendedCapacity(
      sql,
      beforeData,
      restoreStatus
    )

    const normalizedReason =
      reason
        ? String(
            reason
          )
            .trim()
            .slice(
              0,
              1000
            )
        : null

    const afterSnapshot = {
      ...beforeData,

      status:
        restoreStatus,

      original_status:
        null,

      cancelled_at:
        null,

      package_id:
        beforeData.package_id,
    }

    const queries = [
      sql`
        UPDATE
          attendance_records_v2

        SET
          status =
            ${restoreStatus},

          original_status =
            NULL,

          cancelled_at =
            NULL,

          updated_at =
            NOW()

        WHERE
          id =
            ${attendanceId}

        RETURNING
          *
      `,

      createAuditQuery(
        sql,
        {
          actorUserId,

          actorRole:
            normalizedRole,

          action:
            'RESTORE',

          entityType:
            'ATTENDANCE',

          entityId:
            attendanceId,

          studentId:
            beforeData.student_id,

          courseId:
            beforeData.course_id,

          sessionId:
            beforeData.session_id,

          beforeData,

          afterData:
            afterSnapshot,

          note:
            normalizedReason ||
            `${normalizedRole === 'TEACHER' ? '老師' : '學生'}恢復 Attendance：CANCELLED → ${restoreStatus}`,

          ...auditMetadata,
        }
      ),
    ]

    const results =
      await runTransaction(
        sql,
        queries
      )

    const updated =
      results[0]?.[0]

    let packageData =
      null

    if (
      beforeData.package_id
    ) {
      packageData =
        await recalculatePackage(
          sql,
          beforeData.package_id
        )
    }

    return {
      attendance:
        updated,

      package:
        packageData,
    }
  }