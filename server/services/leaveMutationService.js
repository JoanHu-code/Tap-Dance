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
      statusCode: 400,

      statusMessage:
        'Leave 操作者角色錯誤',
    })
  }

  return role
}

// ============================================================
// Reason
// ============================================================

const normalizeReason = (
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
// Batch
// ============================================================

const requireLeaveBatch =
  async (
    sql,
    batchId
  ) => {
    assertUuid(
      batchId,
      'Leave Batch ID'
    )

    const batches =
      await sql`
        SELECT
          batch.*,

          student.name
            AS student_name,

          course.name
            AS course_name

        FROM
          leave_batches batch

        INNER JOIN
          students student

          ON student.id =
            batch.student_id

        INNER JOIN
          dance_courses course

          ON course.id =
            batch.course_id

        WHERE
          batch.id =
            ${batchId}

        LIMIT 1
      `

    if (
      !batches.length
    ) {
      throw createError({
        statusCode: 404,

        statusMessage:
          '找不到 Leave Batch',
      })
    }

    return batches[0]
  }

// ============================================================
// Ownership
// ============================================================

const verifyOwnership =
  (
    batch,
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
        batch.student_id
      ) !==
      String(
        studentId
      )
    ) {
      throw createError({
        statusCode: 403,

        statusMessage:
          '不能修改其他學生的 Leave Batch',
      })
    }
  }

// ============================================================
// Items
// ============================================================

const getLeaveItems =
  async (
    sql,
    batchId
  ) => {
    return await sql`
      SELECT
        item.*,

        attendance.student_id,

        attendance.package_id,

        attendance.session_id,

        attendance.status
          AS current_attendance_status,

        attendance.note
          AS current_attendance_note,

        attendance.attendance_type
          AS current_attendance_type,

        session.class_date,

        session.start_time,

        schedule.course_id

      FROM
        leave_batch_items item

      LEFT JOIN
        attendance_records_v2 attendance

        ON attendance.id =
          item.attendance_id

      LEFT JOIN
        class_sessions session

        ON session.id =
          item.session_id

      LEFT JOIN
        class_schedules schedule

        ON schedule.id =
          item.schedule_id

      WHERE
        item.batch_id =
          ${batchId}

      ORDER BY
        item.class_date ASC
    `
  }

// ============================================================
// Update Reason
// ============================================================

export const updateLeaveBatchReason =
  async ({
    batchId,
    reason,
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
      await requireLeaveBatch(
        sql,
        batchId
      )

    verifyOwnership(
      beforeData,
      role,
      studentId
    )

    const nextReason =
      normalizeReason(
        reason
      )

    if (
      nextReason ===
      undefined
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '沒有提供新的請假原因',
      })
    }

    if (
      nextReason ===
      beforeData.reason
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '請假原因沒有變更',
      })
    }

    const afterData = {
      ...beforeData,

      reason:
        nextReason,
    }

    const queries = [
      sql`
        UPDATE
          leave_batches

        SET
          reason =
            ${nextReason},

          updated_at =
            NOW()

        WHERE
          id =
            ${batchId}

        RETURNING
          *
      `,

      createAuditQuery(
        sql,
        {
          actorUserId,

          actorRole:
            role,

          action:
            'UPDATE',

          entityType:
            'LEAVE',

          entityId:
            batchId,

          studentId:
            beforeData.student_id,

          courseId:
            beforeData.course_id,

          beforeData,

          afterData,

          note:
            '修改請假原因',

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

// ============================================================
// Cancel Batch
// ============================================================

export const cancelLeaveBatch =
  async ({
    batchId,
    actorUserId,
    actorRole,
    studentId = null,
    reason = null,
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

    const batch =
      await requireLeaveBatch(
        sql,
        batchId
      )

    verifyOwnership(
      batch,
      role,
      studentId
    )

    if (
      batch.status ===
      'CANCELLED'
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '這批請假已經取消',
      })
    }

    const items =
      await getLeaveItems(
        sql,
        batchId
      )

    if (
      !items.length
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '這批請假沒有 Leave Item',
      })
    }

    const queries = []

    const affectedPackageIds =
      new Set()

    // ========================================================
    // Restore each attendance
    // ========================================================

    for (
      const item of
      items
    ) {
      if (
        !item.attendance_id
      ) {
        continue
      }

      if (
        item.package_id
      ) {
        affectedPackageIds.add(
          String(
            item.package_id
          )
        )
      }

      // ======================================================
      // 這筆 Attendance 是請假流程新建
      //
      // LEAVE
      // ↓
      // CANCELLED
      //
      // 不 DELETE，歷史保留。
      // ======================================================

      if (
        item.attendance_created_by_leave
      ) {
        queries.push(
          sql`
            UPDATE
              attendance_records_v2

            SET
              original_status =
                'LEAVE',

              status =
                'CANCELLED',

              cancelled_at =
                NOW(),

              updated_at =
                NOW()

            WHERE
              id =
                ${item.attendance_id}

            RETURNING
              *
          `
        )

        queries.push(
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
                item.attendance_id,

              studentId:
                batch.student_id,

              courseId:
                batch.course_id,

              sessionId:
                item.session_id,

              beforeData: {
                status:
                  item.current_attendance_status,

                note:
                  item.current_attendance_note,

                attendance_type:
                  item.current_attendance_type,
              },

              afterData: {
                status:
                  'CANCELLED',

                original_status:
                  'LEAVE',
              },

              note:
                '取消 Leave Batch，自動取消請假 Attendance',

              ...auditMetadata,
            }
          )
        )

        continue
      }

      // ======================================================
      // 原本已有 Attendance
      //
      // 例如：
      //
      // ATTENDED
      // ↓ Leave
      // LEAVE
      //
      // Cancel Leave
      // ↓
      // ATTENDED
      // ======================================================

      if (
        item.previous_attendance_status
      ) {
        queries.push(
          sql`
            UPDATE
              attendance_records_v2

            SET
              status =
                ${item.previous_attendance_status},

              attendance_type =
                COALESCE(
                  ${item.previous_attendance_type},
                  attendance_type
                ),

              note =
                ${item.previous_attendance_note},

              original_status =
                NULL,

              cancelled_at =
                NULL,

              updated_at =
                NOW()

            WHERE
              id =
                ${item.attendance_id}

            RETURNING
              *
          `
        )

        queries.push(
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
                item.attendance_id,

              studentId:
                batch.student_id,

              courseId:
                batch.course_id,

              sessionId:
                item.session_id,

              beforeData: {
                status:
                  item.current_attendance_status,

                note:
                  item.current_attendance_note,
              },

              afterData: {
                status:
                  item.previous_attendance_status,

                note:
                  item.previous_attendance_note,

                attendance_type:
                  item.previous_attendance_type,
              },

              note:
                '取消 Leave Batch，恢復請假前 Attendance',

              ...auditMetadata,
            }
          )
        )

        continue
      }

      // ======================================================
      // 舊 Migration 以前的資料可能沒有 previous status。
      //
      // 不猜。
      // ======================================================

      throw createError({
        statusCode: 409,

        statusMessage:
          `Leave Item ${item.id} 缺少請假前 Attendance 狀態，無法安全取消整批請假`,
      })
    }

    // ========================================================
    // Batch
    // ========================================================

    queries.push(
      sql`
        UPDATE
          leave_batches

        SET
          status =
            'CANCELLED',

          cancelled_at =
            NOW(),

          updated_at =
            NOW()

        WHERE
          id =
            ${batchId}

        RETURNING
          *
      `
    )

    queries.push(
      createAuditQuery(
        sql,
        {
          actorUserId,

          actorRole:
            role,

          action:
            'CANCEL',

          entityType:
            'LEAVE',

          entityId:
            batchId,

          studentId:
            batch.student_id,

          courseId:
            batch.course_id,

          beforeData:
            batch,

          afterData: {
            ...batch,

            status:
              'CANCELLED',
          },

          note:
            reason
              ? String(
                  reason
                ).slice(
                  0,
                  2000
                )
              : '取消整批請假',

          ...auditMetadata,
        }
      )
    )

    await runTransaction(
      sql,
      queries
    )

    // ========================================================
    // Package Recalculation
    // ========================================================

    const packages = []

    for (
      const packageId of
      affectedPackageIds
    ) {
      const packageData =
        await recalculatePackage(
          sql,
          packageId
        )

      if (
        packageData
      ) {
        packages.push(
          packageData
        )
      }
    }

    const updated =
      await requireLeaveBatch(
        sql,
        batchId
      )

    return {
      batch:
        updated,

      packages,
    }
  }

// ============================================================
// Restore Batch
// ============================================================

export const restoreLeaveBatch =
  async ({
    batchId,
    actorUserId,
    actorRole,
    studentId = null,
    reason = null,
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

    const batch =
      await requireLeaveBatch(
        sql,
        batchId
      )

    verifyOwnership(
      batch,
      role,
      studentId
    )

    if (
      batch.status !==
      'CANCELLED'
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '這批請假目前不是取消狀態',
      })
    }

    const items =
      await getLeaveItems(
        sql,
        batchId
      )

    if (
      !items.length
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '這批請假沒有 Leave Item',
      })
    }

    const queries = []

    const affectedPackageIds =
      new Set()

    for (
      const item of
      items
    ) {
      if (
        !item.attendance_id
      ) {
        throw createError({
          statusCode: 409,

          statusMessage:
            'Leave Item 找不到對應 Attendance，無法恢復',
        })
      }

      if (
        item.package_id
      ) {
        affectedPackageIds.add(
          String(
            item.package_id
          )
        )
      }

      // ======================================================
      // 恢復時統一回到 LEAVE。
      //
      // package_id 不變。
      // attendance_type：
      // 原本 Attendance 有什麼就保留。
      // ======================================================

      queries.push(
        sql`
          UPDATE
            attendance_records_v2

          SET
            status =
              'LEAVE',

            original_status =
              NULL,

            cancelled_at =
              NULL,

            note =
              ${batch.reason},

            updated_at =
              NOW()

          WHERE
            id =
              ${item.attendance_id}

          RETURNING
            *
        `
      )

      queries.push(
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
              item.attendance_id,

            studentId:
              batch.student_id,

            courseId:
              batch.course_id,

            sessionId:
              item.session_id,

            beforeData: {
              status:
                item.current_attendance_status,

              note:
                item.current_attendance_note,
            },

            afterData: {
              status:
                'LEAVE',

              note:
                batch.reason,
            },

            note:
              '恢復 Leave Batch，自動恢復請假 Attendance',

            ...auditMetadata,
          }
        )
      )
    }

    queries.push(
      sql`
        UPDATE
          leave_batches

        SET
          status =
            'ACTIVE',

          cancelled_at =
            NULL,

          updated_at =
            NOW()

        WHERE
          id =
            ${batchId}

        RETURNING
          *
      `
    )

    queries.push(
      createAuditQuery(
        sql,
        {
          actorUserId,

          actorRole:
            role,

          action:
            'RESTORE',

          entityType:
            'LEAVE',

          entityId:
            batchId,

          studentId:
            batch.student_id,

          courseId:
            batch.course_id,

          beforeData:
            batch,

          afterData: {
            ...batch,

            status:
              'ACTIVE',

            cancelled_at:
              null,
          },

          note:
            reason
              ? String(
                  reason
                ).slice(
                  0,
                  2000
                )
              : '恢復整批請假',

          ...auditMetadata,
        }
      )
    )

    await runTransaction(
      sql,
      queries
    )

    const packages = []

    for (
      const packageId of
      affectedPackageIds
    ) {
      const packageData =
        await recalculatePackage(
          sql,
          packageId
        )

      if (
        packageData
      ) {
        packages.push(
          packageData
        )
      }
    }

    return {
      batch:
        await requireLeaveBatch(
          sql,
          batchId
        ),

      packages,
    }
  }