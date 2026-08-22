import {
  randomUUID,
} from 'node:crypto'

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

const normalizeActorRole = (
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
        'Leave 操作者角色不正確',
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
    value ===
      undefined ||
    value ===
      null
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
// Student
// ============================================================

const requireStudent =
  async (
    sql,
    studentId
  ) => {
    assertUuid(
      studentId,
      '學生 ID'
    )

    const students =
      await sql`
        SELECT
          *

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

    if (
      students[0].status !==
      'ACTIVE'
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '學生目前不是 ACTIVE 狀態',
      })
    }

    return students[0]
  }

// ============================================================
// Sessions
// ============================================================

const requireSessions =
  async (
    sql,
    sessionIds
  ) => {
    const normalizedIds =
      [
        ...new Set(
          (
            Array.isArray(
              sessionIds
            )
              ? sessionIds
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
      !normalizedIds.length
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '至少要選擇一堂課',
      })
    }

    if (
      normalizedIds.length >
      100
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '一次最多批次請假 100 堂',
      })
    }

    for (
      const id of
      normalizedIds
    ) {
      assertUuid(
        id,
        'Session ID'
      )
    }

    const sessions = []

    for (
      const sessionId of
      normalizedIds
    ) {
      const result =
        await sql`
          SELECT
            session.id,

            session.schedule_id,

            session.class_date,

            session.start_time,

            session.end_time,

            session.status,

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
        !result.length
      ) {
        throw createError({
          statusCode: 404,

          statusMessage:
            `找不到 Session：${sessionId}`,
        })
      }

      const session =
        result[0]

      if (
        [
          'TEACHER_LEAVE',
          'CANCELLED',
        ].includes(
          session.status
        )
      ) {
        throw createError({
          statusCode: 409,

          statusMessage:
            `${session.course_name} ${String(session.class_date).slice(0, 10)} 已停課或取消，不能請假`,
        })
      }

      sessions.push(
        session
      )
    }

    // ========================================================
    // 一個 Leave Batch 只能一個 Course
    // ========================================================

    const courseIds =
      [
        ...new Set(
          sessions.map(
            (
              session
            ) => {
              return String(
                session.course_id
              )
            }
          )
        ),
      ]

    if (
      courseIds.length !==
      1
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '一次批次請假只能選擇同一門課程的課堂',
      })
    }

    return sessions
  }

// ============================================================
// Enrollment
// ============================================================

const requireEnrollment =
  async (
    sql,
    studentId,
    courseId
  ) => {
    const enrollments =
      await sql`
        SELECT
          *

        FROM
          student_enrollments

        WHERE
          student_id =
            ${studentId}

          AND
            course_id =
            ${courseId}

          AND
            status =
            'ACTIVE'

        LIMIT 1
      `

    if (
      !enrollments.length
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '學生目前沒有加入這門課程',
      })
    }

    return enrollments[0]
  }

// ============================================================
// Package
//
// LEAVE 本身不扣堂，
// 但仍綁定當期 Package，
// 方便知道這筆請假是哪一期。
// ============================================================

const requireCurrentPackage =
  async (
    sql,
    studentId,
    courseId
  ) => {
    const packages =
      await sql`
        SELECT
          *

        FROM
          student_packages

        WHERE
          student_id =
            ${studentId}

          AND
            course_id =
            ${courseId}

          AND
            status =
            'ACTIVE'

        ORDER BY
          cycle_no DESC

        LIMIT 1
      `

    if (
      packages.length
    ) {
      return packages[0]
    }

    // ========================================================
    // 如果剛好滿堂已標 COMPLETED，
    // 但還沒 Renew，
    // 請假紀錄仍可以綁最新一期。
    // ========================================================

    const latest =
      await sql`
        SELECT
          *

        FROM
          student_packages

        WHERE
          student_id =
            ${studentId}

          AND
            course_id =
            ${courseId}

          AND
            status <>
            'CANCELLED'

        ORDER BY
          cycle_no DESC,
          created_at DESC

        LIMIT 1
      `

    if (
      !latest.length
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '這門課尚未建立 Package',
      })
    }

    return latest[0]
  }

// ============================================================
// 查既有 Attendance
// ============================================================

const getExistingAttendance =
  async (
    sql,
    studentId,
    sessionId
  ) => {
    const records =
      await sql`
        SELECT
          *

        FROM
          attendance_records_v2

        WHERE
          student_id =
            ${studentId}

          AND
            session_id =
            ${sessionId}

        LIMIT 1
      `

    return (
      records[0] ||
      null
    )
  }

// ============================================================
// 建立 Batch Leave
// ============================================================

export const createLeaveBatch =
  async ({
    studentId,
    sessionIds,
    reason = null,
    actorUserId,
    actorRole,
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

    const normalizedReason =
      normalizeReason(
        reason
      )

    const sql =
      useDatabase()

    const student =
      await requireStudent(
        sql,
        studentId
      )

    const sessions =
      await requireSessions(
        sql,
        sessionIds
      )

    const courseId =
      sessions[0]
        .course_id

    const courseName =
      sessions[0]
        .course_name

    await requireEnrollment(
      sql,
      studentId,
      courseId
    )

    const packageData =
      await requireCurrentPackage(
        sql,
        studentId,
        courseId
      )

    const batchId =
      randomUUID()

    // ========================================================
    // 先準備每一堂的變更
    // ========================================================

    const items = []

    for (
      const session of
      sessions
    ) {
      const existingAttendance =
        await getExistingAttendance(
          sql,
          studentId,
          session.id
        )

      // ======================================================
      // 已取消的紀錄：
      //
      // 不直接覆寫。
      // 先由 Attendance Restore 流程處理，
      // 避免破壞 original_status。
      // ======================================================

      if (
        existingAttendance
          ?.status ===
        'CANCELLED'
      ) {
        throw createError({
          statusCode: 409,

          statusMessage:
            `${String(session.class_date).slice(0, 10)} 的 Attendance 已取消，請先恢復該紀錄`,
        })
      }

      const attendanceId =
        existingAttendance
          ?.id ||
        randomUUID()

      items.push({
        id:
          randomUUID(),

        session,

        attendanceId,

        existingAttendance,
      })
    }

    const queries = []

    // ========================================================
    // Batch
    // ========================================================

    queries.push(
      sql`
        INSERT INTO
          leave_batches (
            id,
            student_id,
            course_id,
            reason,
            created_by,
            status,
            created_at,
            updated_at,
            cancelled_at
          )

        VALUES (
          ${batchId},
          ${studentId},
          ${courseId},
          ${normalizedReason},
          ${actorUserId},
          'ACTIVE',
          NOW(),
          NOW(),
          NULL
        )

        RETURNING
          *
      `
    )

    // ========================================================
    // 每堂 Session
    // ========================================================

    for (
      const item of
      items
    ) {
      const {
        session,
        existingAttendance,
        attendanceId,
      } = item

      // ======================================================
      // 原本沒有 Attendance
      // → 建立 LEAVE
      // ======================================================

      if (
        !existingAttendance
      ) {
        queries.push(
          sql`
            INSERT INTO
              attendance_records_v2 (
                id,
                student_id,
                package_id,
                session_id,
                status,
                attendance_type,
                created_by,
                original_status,
                cancelled_at,
                note,
                created_at,
                updated_at
              )

            VALUES (
              ${attendanceId},
              ${studentId},
              ${packageData.id},
              ${session.id},
              'LEAVE',
              'NORMAL',
              ${actorUserId},
              NULL,
              NULL,
              ${normalizedReason},
              NOW(),
              NOW()
            )

            RETURNING
              *
          `
        )
      } else {
        // ====================================================
        // 已經是 LEAVE
        //
        // 不需要重複 UPDATE。
        // ====================================================

        if (
          existingAttendance
            .status !==
          'LEAVE'
        ) {
          // ==================================================
          // ATTENDED / ABSENT → LEAVE
          //
          // package_id 不改。
          // ==================================================

          queries.push(
            sql`
              UPDATE
                attendance_records_v2

              SET
                status =
                  'LEAVE',

                note =
                  COALESCE(
                    ${normalizedReason},
                    note
                  ),

                updated_at =
                  NOW()

              WHERE
                id =
                  ${attendanceId}

              RETURNING
                *
            `
          )
        }
      }

      // ======================================================
      // Leave Item
      // ======================================================

      queries.push(
        sql`
          INSERT INTO
            leave_batch_items (
              id,
              batch_id,
              class_date,
              schedule_id,
              session_id,
              attendance_id,
              created_at,
              updated_at
            )

          VALUES (
            ${item.id},
            ${batchId},
            ${session.class_date},
            ${session.schedule_id},
            ${session.id},
            ${attendanceId},
            NOW(),
            NOW()
          )

          RETURNING
            *
        `
      )

      // ======================================================
      // Attendance Audit
      // ======================================================

      queries.push(
        createAuditQuery(
          sql,
          {
            actorUserId,

            actorRole:
              normalizedRole,

            action:
              existingAttendance
                ? 'UPDATE'
                : 'CREATE',

            entityType:
              'ATTENDANCE',

            entityId:
              attendanceId,

            studentId,

            courseId,

            sessionId:
              session.id,

            beforeData:
              existingAttendance,

            afterData: {
              id:
                attendanceId,

              student_id:
                studentId,

              package_id:
                existingAttendance
                  ?.package_id ||
                packageData.id,

              session_id:
                session.id,

              class_date:
                session.class_date,

              status:
                'LEAVE',

              attendance_type:
                existingAttendance
                  ?.attendance_type ||
                'NORMAL',

              note:
                normalizedReason,
            },

            note:
              `批次請假：${courseName} ${String(session.class_date).slice(0, 10)}`,

            ...auditMetadata,
          }
        )
      )
    }

    // ========================================================
    // Batch Audit
    // ========================================================

    queries.push(
      createAuditQuery(
        sql,
        {
          actorUserId,

          actorRole:
            normalizedRole,

          action:
            'CREATE',

          entityType:
            'LEAVE',

          entityId:
            batchId,

          studentId,

          courseId,

          beforeData:
            null,

          afterData: {
            id:
              batchId,

            student_id:
              studentId,

            student_name:
              student.name,

            course_id:
              courseId,

            course_name:
              courseName,

            reason:
              normalizedReason,

            status:
              'ACTIVE',

            session_ids:
              sessions.map(
                (
                  session
                ) => {
                  return (
                    session.id
                  )
                }
              ),
          },

          note:
            `建立批次請假，共 ${sessions.length} 堂`,

          ...auditMetadata,
        }
      )
    )

    const results =
      await runTransaction(
        sql,
        queries
      )

    // ========================================================
    // 如果原本有 ATTENDED 被改 LEAVE，
    // 需要重算那些 Attendance 原本所屬的 Package。
    //
    // 使用 Set 避免同 Package 重算很多次。
    // ========================================================

    const affectedPackageIds =
      new Set()

    affectedPackageIds.add(
      String(
        packageData.id
      )
    )

    for (
      const item of
      items
    ) {
      if (
        item.existingAttendance
          ?.package_id
      ) {
        affectedPackageIds.add(
          String(
            item
              .existingAttendance
              .package_id
          )
        )
      }
    }

    const recalculatedPackages =
      []

    for (
      const packageId of
      affectedPackageIds
    ) {
      const recalculated =
        await recalculatePackage(
          sql,
          packageId
        )

      if (
        recalculated
      ) {
        recalculatedPackages.push(
          recalculated
        )
      }
    }

    // ========================================================
    // 重新查 Batch
    // ========================================================

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

    const batchItems =
      await sql`
        SELECT
          item.*,

          session.start_time,

          session.end_time,

          attendance.status
            AS attendance_status

        FROM
          leave_batch_items item

        LEFT JOIN
          class_sessions session

          ON session.id =
            item.session_id

        LEFT JOIN
          attendance_records_v2 attendance

          ON attendance.id =
            item.attendance_id

        WHERE
          item.batch_id =
            ${batchId}

        ORDER BY
          item.class_date ASC,
          session.start_time ASC
      `

    return {
      batch:
        batches[0] ||
        results[0]?.[0] ||
        null,

      items:
        batchItems,

      packages:
        recalculatedPackages,
    }
  }

// ============================================================
// Teacher 查詢 Leave Batch
// ============================================================

export const getLeaveBatches =
  async ({
    studentId = null,
    courseId = null,
    status = null,
    startDate = null,
    endDate = null,
  } = {}) => {
    const sql =
      useDatabase()

    if (
      studentId
    ) {
      assertUuid(
        studentId,
        '學生 ID'
      )
    }

    if (
      courseId
    ) {
      assertUuid(
        courseId,
        'Course ID'
      )
    }

    const normalizedStatus =
      status
        ? String(
            status
          )
            .trim()
            .toUpperCase()
        : null

    if (
      normalizedStatus &&
      ![
        'ACTIVE',
        'CANCELLED',
      ].includes(
        normalizedStatus
      )
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          'Leave status 不正確',
      })
    }

    const batches =
      await sql`
        SELECT
          batch.*,

          student.name
            AS student_name,

          course.name
            AS course_name,

          creator.role
            AS created_by_role,

          creator.display_name
            AS created_by_name,

          (
            SELECT
              COUNT(*)::INTEGER

            FROM
              leave_batch_items item

            WHERE
              item.batch_id =
                batch.id
          )
            AS item_count

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

        LEFT JOIN
          app_users creator

          ON creator.id =
            batch.created_by

        WHERE
          (
            ${studentId || null}::uuid
              IS NULL

            OR
              batch.student_id =
                ${studentId || null}
          )

          AND (
            ${courseId || null}::uuid
              IS NULL

            OR
              batch.course_id =
                ${courseId || null}
          )

          AND (
            ${normalizedStatus}::text
              IS NULL

            OR
              batch.status =
                ${normalizedStatus}
          )

          AND (
            ${startDate || null}::date
              IS NULL

            OR
              batch.created_at::date >=
                ${startDate || null}
          )

          AND (
            ${endDate || null}::date
              IS NULL

            OR
              batch.created_at::date <=
                ${endDate || null}
          )

        ORDER BY
          batch.created_at DESC
      `

    const result = []

    for (
      const batch of
      batches
    ) {
      const items =
        await sql`
          SELECT
            item.*,

            session.start_time,

            session.end_time,

            session.status
              AS session_status,

            schedule.name
              AS schedule_name,

            schedule.weekday,

            attendance.status
              AS attendance_status

          FROM
            leave_batch_items item

          LEFT JOIN
            class_sessions session

            ON session.id =
              item.session_id

          LEFT JOIN
            class_schedules schedule

            ON schedule.id =
              item.schedule_id

          LEFT JOIN
            attendance_records_v2 attendance

            ON attendance.id =
              item.attendance_id

          WHERE
            item.batch_id =
              ${batch.id}

          ORDER BY
            item.class_date ASC,
            session.start_time ASC
        `

      result.push({
        ...batch,

        items,
      })
    }

    return result
  }