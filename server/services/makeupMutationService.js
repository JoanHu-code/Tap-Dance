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
// Role
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
    ![
      'TEACHER',
      'STUDENT',
    ].includes(
      role
    )
  ) {
    throw createError({
      statusCode: 403,

      statusMessage:
        'Makeup 操作者角色不正確',
    })
  }

  return role
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
// Makeup Snapshot
// ============================================================

const requireMakeup =
  async (
    sql,
    makeupId
  ) => {
    assertUuid(
      makeupId,
      'Makeup ID'
    )

    const records =
      await sql`
        SELECT
          makeup.*,

          student.name
            AS student_name,

          course.name
            AS course_name,

          package.cycle_no
            AS package_cycle_no,

          package.total_sessions
            AS package_total_sessions,

          package.status
            AS package_status,

          source_attendance.status
            AS source_attendance_status,

          source_session.class_date
            AS source_class_date,

          source_session.start_time
            AS source_start_time,

          source_schedule.name
            AS source_schedule_name,

          makeup_session.class_date
            AS makeup_class_date,

          makeup_session.start_time
            AS makeup_start_time,

          makeup_session.end_time
            AS makeup_end_time,

          makeup_session.status
            AS makeup_session_status,

          makeup_schedule.name
            AS makeup_schedule_name,

          makeup_attendance.status
            AS makeup_attendance_status,

          makeup_attendance.attendance_type
            AS makeup_attendance_type,

          makeup_attendance.note
            AS makeup_attendance_note,

          makeup_attendance.cancelled_at
            AS makeup_attendance_cancelled_at

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

        INNER JOIN
          student_packages package

          ON package.id =
            makeup.package_id

        INNER JOIN
          attendance_records_v2 source_attendance

          ON source_attendance.id =
            makeup.source_leave_attendance_id

        INNER JOIN
          class_sessions source_session

          ON source_session.id =
            makeup.source_session_id

        INNER JOIN
          class_schedules source_schedule

          ON source_schedule.id =
            source_session.schedule_id

        INNER JOIN
          class_sessions makeup_session

          ON makeup_session.id =
            makeup.makeup_session_id

        INNER JOIN
          class_schedules makeup_schedule

          ON makeup_schedule.id =
            makeup_session.schedule_id

        LEFT JOIN
          attendance_records_v2 makeup_attendance

          ON makeup_attendance.id =
            makeup.makeup_attendance_id

        WHERE
          makeup.id =
            ${makeupId}

        LIMIT 1
      `

    if (
      !records.length
    ) {
      throw createError({
        statusCode: 404,

        statusMessage:
          '找不到 Makeup 紀錄',
      })
    }

    return records[0]
  }

// ============================================================
// Student Ownership
// ============================================================

const verifyOwnership =
  (
    makeup,
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
        makeup.student_id
      ) !==
      String(
        studentId
      )
    ) {
      throw createError({
        statusCode: 403,

        statusMessage:
          '學生不能修改其他人的補課紀錄',
      })
    }
  }

// ============================================================
// Package Recalculation Query
//
// 特別注意：
//
// 如果 Cycle 1 已經有 Cycle 2，
// 後來修改 Cycle 1 Attendance，
// 不會把 Cycle 1 重新打開成 ACTIVE。
// ============================================================

const createPackageRecalculationQuery =
  (
    sql,
    packageId
  ) => {
    return sql`
      WITH
      target_package AS (
        SELECT
          id,
          student_id,
          course_id,
          cycle_no,
          total_sessions,
          status,
          completion_reason

        FROM
          student_packages

        WHERE
          id =
            ${packageId}

        LIMIT 1
      ),

      usage_data AS (
        SELECT
          COUNT(*)::INTEGER
            AS attended_count

        FROM
          attendance_records_v2

        WHERE
          package_id =
            ${packageId}

          AND
            status =
              'ATTENDED'
      ),

      successor_data AS (
        SELECT
          EXISTS (
            SELECT
              1

            FROM
              student_packages successor,
              target_package target

            WHERE
              (
                successor.previous_package_id =
                  target.id

                OR (
                  successor.student_id =
                    target.student_id

                  AND
                    successor.course_id =
                      target.course_id

                  AND
                    successor.cycle_no >
                      target.cycle_no
                )
              )

              AND
                successor.status <>
                  'CANCELLED'
          )
            AS has_successor
      )

      UPDATE
        student_packages package

      SET
        status =
          CASE

            WHEN
              package.status =
                'CANCELLED'

            THEN
              'CANCELLED'

            WHEN
              usage_data.attended_count >=
              package.total_sessions

            THEN
              'COMPLETED'

            WHEN
              package.status =
                'COMPLETED'

              AND
                package.completion_reason =
                  'SESSIONS_USED_UP'

              AND
                successor_data.has_successor =
                  FALSE

            THEN
              'ACTIVE'

            ELSE
              package.status

          END,

        completion_reason =
          CASE

            WHEN
              package.status =
                'CANCELLED'

            THEN
              package.completion_reason

            WHEN
              usage_data.attended_count >=
              package.total_sessions

            THEN
              'SESSIONS_USED_UP'

            WHEN
              package.status =
                'COMPLETED'

              AND
                package.completion_reason =
                  'SESSIONS_USED_UP'

              AND
                successor_data.has_successor =
                  FALSE

            THEN
              NULL

            ELSE
              package.completion_reason

          END,

        updated_at =
          NOW()

      FROM
        usage_data,
        successor_data

      WHERE
        package.id =
          ${packageId}

      RETURNING
        package.*
    `
  }

// ============================================================
// Restore Capacity
// ============================================================

const validateRestoreCapacity =
  async (
    sql,
    makeup
  ) => {
    const records =
      await sql`
        SELECT
          package.total_sessions,

          COALESCE(
            COUNT(attendance.id)
              FILTER (
                WHERE
                  attendance.status =
                    'ATTENDED'
              ),
            0
          )::INTEGER
            AS attended_count

        FROM
          student_packages package

        LEFT JOIN
          attendance_records_v2 attendance

          ON attendance.package_id =
            package.id

        WHERE
          package.id =
            ${makeup.package_id}

        GROUP BY
          package.id,
          package.total_sessions

        LIMIT 1
      `

    if (
      !records.length
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '找不到補課對應的 Package',
      })
    }

    const total =
      Number(
        records[0]
          .total_sessions ||
        0
      )

    const attended =
      Number(
        records[0]
          .attended_count ||
        0
      )

    if (
      attended >=
      total
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          `此期 Package 已經是 ${attended}/${total} 堂，無法恢復這筆補課`,
      })
    }
  }

// ============================================================
// Update Note
// ============================================================

export const updateMakeupNote =
  async ({
    makeupId,
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

    const role =
      normalizeRole(
        actorRole
      )

    const normalizedNote =
      normalizeNote(
        note
      )

    if (
      normalizedNote ===
      undefined
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '沒有提供新的補課備註',
      })
    }

    const sql =
      useDatabase()

    const beforeData =
      await requireMakeup(
        sql,
        makeupId
      )

    verifyOwnership(
      beforeData,
      role,
      studentId
    )

    if (
      normalizedNote ===
      beforeData.note
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '補課備註沒有變更',
      })
    }

    const afterData = {
      ...beforeData,

      note:
        normalizedNote,

      makeup_attendance_note:
        normalizedNote,
    }

    const queries = [
      // ======================================================
      // Makeup
      // ======================================================

      sql`
        UPDATE
          makeup_records

        SET
          note =
            ${normalizedNote},

          updated_at =
            NOW()

        WHERE
          id =
            ${makeupId}

        RETURNING
          *
      `,

      // ======================================================
      // Attendance Note
      //
      // Makeup Note 與對應 Attendance Note 保持同步。
      // ======================================================

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
            ${beforeData.makeup_attendance_id}

        RETURNING
          *
      `,

      // ======================================================
      // Makeup Audit
      // ======================================================

      createAuditQuery(
        sql,
        {
          actorUserId,

          actorRole:
            role,

          action:
            'UPDATE',

          entityType:
            'MAKEUP',

          entityId:
            makeupId,

          studentId:
            beforeData.student_id,

          courseId:
            beforeData.course_id,

          sessionId:
            beforeData.makeup_session_id,

          beforeData,

          afterData,

          note:
            '修改補課備註',

          ...auditMetadata,
        }
      ),

      // ======================================================
      // Attendance Audit
      // ======================================================

      createAuditQuery(
        sql,
        {
          actorUserId,

          actorRole:
            role,

          action:
            'UPDATE',

          entityType:
            'ATTENDANCE',

          entityId:
            beforeData.makeup_attendance_id,

          studentId:
            beforeData.student_id,

          courseId:
            beforeData.course_id,

          sessionId:
            beforeData.makeup_session_id,

          beforeData: {
            note:
              beforeData
                .makeup_attendance_note,
          },

          afterData: {
            note:
              normalizedNote,
          },

          note:
            '同步修改補課 Attendance 備註',

          ...auditMetadata,
        }
      ),
    ]

    await runTransaction(
      sql,
      queries
    )

    return await requireMakeup(
      sql,
      makeupId
    )
  }

// ============================================================
// Cancel Makeup
//
// Makeup ACTIVE
//
// ATTENDED / MAKEUP
// ↓
// CANCELLED
//
// Package:
// 4 / 8
// ↓
// 3 / 8
// ============================================================

export const cancelMakeup =
  async ({
    makeupId,
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

    const role =
      normalizeRole(
        actorRole
      )

    const sql =
      useDatabase()

    const beforeData =
      await requireMakeup(
        sql,
        makeupId
      )

    verifyOwnership(
      beforeData,
      role,
      studentId
    )

    if (
      beforeData.status ===
      'CANCELLED'
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '這筆補課已經取消',
      })
    }

    if (
      !beforeData
        .makeup_attendance_id
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '這筆補課找不到對應 Attendance',
      })
    }

    const normalizedReason =
      normalizeNote(
        reason
      )

    const afterData = {
      ...beforeData,

      status:
        'CANCELLED',

      cancelled_at:
        new Date()
          .toISOString(),

      makeup_attendance_status:
        'CANCELLED',
    }

    const queries = [
      // ======================================================
      // Makeup Attendance
      // ======================================================

      sql`
        UPDATE
          attendance_records_v2

        SET
          original_status =
            CASE
              WHEN
                status <>
                  'CANCELLED'

              THEN
                status

              ELSE
                original_status
            END,

          status =
            'CANCELLED',

          cancelled_at =
            COALESCE(
              cancelled_at,
              NOW()
            ),

          updated_at =
            NOW()

        WHERE
          id =
            ${beforeData.makeup_attendance_id}

        RETURNING
          *
      `,

      // ======================================================
      // Makeup
      // ======================================================

      sql`
        UPDATE
          makeup_records

        SET
          status =
            'CANCELLED',

          cancelled_at =
            NOW(),

          updated_at =
            NOW()

        WHERE
          id =
            ${makeupId}

        RETURNING
          *
      `,

      // ======================================================
      // Package
      // ======================================================

      createPackageRecalculationQuery(
        sql,
        beforeData.package_id
      ),

      // ======================================================
      // Attendance Audit
      // ======================================================

      createAuditQuery(
        sql,
        {
          actorUserId,

          actorRole:
            role,

          action:
            'CANCEL',

          entityType:
            'ATTENDANCE',

          entityId:
            beforeData.makeup_attendance_id,

          studentId:
            beforeData.student_id,

          courseId:
            beforeData.course_id,

          sessionId:
            beforeData.makeup_session_id,

          beforeData: {
            status:
              beforeData
                .makeup_attendance_status,

            attendance_type:
              beforeData
                .makeup_attendance_type,

            note:
              beforeData
                .makeup_attendance_note,
          },

          afterData: {
            status:
              'CANCELLED',

            original_status:
              beforeData
                .makeup_attendance_status,
          },

          note:
            normalizedReason ||
            '取消補課 Attendance',

          ...auditMetadata,
        }
      ),

      // ======================================================
      // Makeup Audit
      // ======================================================

      createAuditQuery(
        sql,
        {
          actorUserId,

          actorRole:
            role,

          action:
            'CANCEL',

          entityType:
            'MAKEUP',

          entityId:
            makeupId,

          studentId:
            beforeData.student_id,

          courseId:
            beforeData.course_id,

          sessionId:
            beforeData.makeup_session_id,

          beforeData,

          afterData,

          note:
            normalizedReason ||
            '取消補課',

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
      makeup:
        results[1]?.[0] ||
        null,

      attendance:
        results[0]?.[0] ||
        null,

      package:
        results[2]?.[0] ||
        null,
    }
  }

// ============================================================
// Restore Makeup
//
// Makeup CANCELLED
// ↓
// ACTIVE
//
// Attendance:
// CANCELLED
// ↓
// ATTENDED / MAKEUP
//
// Package:
// 3 / 8
// ↓
// 4 / 8
// ============================================================

export const restoreMakeup =
  async ({
    makeupId,
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

    const role =
      normalizeRole(
        actorRole
      )

    const sql =
      useDatabase()

    const beforeData =
      await requireMakeup(
        sql,
        makeupId
      )

    verifyOwnership(
      beforeData,
      role,
      studentId
    )

    if (
      beforeData.status !==
      'CANCELLED'
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '這筆補課目前不是取消狀態',
      })
    }

    // ========================================================
    // 原 Leave 還必須存在。
    //
    // 如果學生已經取消原本請假，
    // 就不能又把補課恢復。
    // ========================================================

    if (
      beforeData
        .source_attendance_status !==
      'LEAVE'
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '原本的請假已經不是 LEAVE，不能恢復這筆補課',
      })
    }

    // ========================================================
    // 補課 Session 不能已被老師取消。
    //
    // COMPLETED 允許恢復：
    // 因為可能只是事後修正歷史紀錄。
    // ========================================================

    if (
      [
        'TEACHER_LEAVE',
        'CANCELLED',
      ].includes(
        beforeData
          .makeup_session_status
      )
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '補課課堂目前已停課或取消，不能恢復補課',
      })
    }

    if (
      !beforeData
        .makeup_attendance_id
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '找不到補課 Attendance，無法恢復',
      })
    }

    // ========================================================
    // 如果 linked Attendance 已經被另外修改成非 CANCELLED，
    // 不可以直接覆蓋。
    // ========================================================

    if (
      beforeData
        .makeup_attendance_status !==
      'CANCELLED'
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '補課 Attendance 已經被其他操作修改，無法直接恢復',
      })
    }

    await validateRestoreCapacity(
      sql,
      beforeData
    )

    const normalizedReason =
      normalizeNote(
        reason
      )

    const afterData = {
      ...beforeData,

      status:
        'ACTIVE',

      cancelled_at:
        null,

      makeup_attendance_status:
        'ATTENDED',

      makeup_attendance_type:
        'MAKEUP',
    }

    const queries = [
      // ======================================================
      // Attendance
      // ======================================================

      sql`
        UPDATE
          attendance_records_v2

        SET
          status =
            'ATTENDED',

          attendance_type =
            'MAKEUP',

          original_status =
            NULL,

          cancelled_at =
            NULL,

          note =
            ${beforeData.note},

          updated_at =
            NOW()

        WHERE
          id =
            ${beforeData.makeup_attendance_id}

        RETURNING
          *
      `,

      // ======================================================
      // Makeup
      // ======================================================

      sql`
        UPDATE
          makeup_records

        SET
          status =
            'ACTIVE',

          cancelled_at =
            NULL,

          updated_at =
            NOW()

        WHERE
          id =
            ${makeupId}

        RETURNING
          *
      `,

      // ======================================================
      // Package
      // ======================================================

      createPackageRecalculationQuery(
        sql,
        beforeData.package_id
      ),

      // ======================================================
      // Attendance Audit
      // ======================================================

      createAuditQuery(
        sql,
        {
          actorUserId,

          actorRole:
            role,

          action:
            'RESTORE',

          entityType:
            'ATTENDANCE',

          entityId:
            beforeData.makeup_attendance_id,

          studentId:
            beforeData.student_id,

          courseId:
            beforeData.course_id,

          sessionId:
            beforeData.makeup_session_id,

          beforeData: {
            status:
              beforeData
                .makeup_attendance_status,

            attendance_type:
              beforeData
                .makeup_attendance_type,
          },

          afterData: {
            status:
              'ATTENDED',

            attendance_type:
              'MAKEUP',
          },

          note:
            normalizedReason ||
            '恢復補課 Attendance',

          ...auditMetadata,
        }
      ),

      // ======================================================
      // Makeup Audit
      // ======================================================

      createAuditQuery(
        sql,
        {
          actorUserId,

          actorRole:
            role,

          action:
            'RESTORE',

          entityType:
            'MAKEUP',

          entityId:
            makeupId,

          studentId:
            beforeData.student_id,

          courseId:
            beforeData.course_id,

          sessionId:
            beforeData.makeup_session_id,

          beforeData,

          afterData,

          note:
            normalizedReason ||
            '恢復補課',

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
      makeup:
        results[1]?.[0] ||
        null,

      attendance:
        results[0]?.[0] ||
        null,

      package:
        results[2]?.[0] ||
        null,
    }
  }