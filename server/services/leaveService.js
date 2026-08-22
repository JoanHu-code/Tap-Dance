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
// Date
// ============================================================

const normalizeOptionalDate = (
  value,
  fieldName
) => {
  if (!value) {
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
    // 一個 Batch 僅能一個 Course
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
// Current Package
//
// LEAVE 不扣堂，
// 但 Attendance 仍需綁一期 Package。
// ============================================================

const requireCurrentPackage =
  async (
    sql,
    studentId,
    courseId
  ) => {
    const active =
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
      active.length
    ) {
      return active[0]
    }

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
// Existing Attendance
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
// Create Leave Batch
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

    const currentPackage =
      await requireCurrentPackage(
        sql,
        studentId,
        courseId
      )

    const batchId =
      randomUUID()

    const items = []

    // ========================================================
    // 先取得所有原本 Attendance 狀態
    // ========================================================

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

      if (
        existingAttendance
          ?.status ===
        'CANCELLED'
      ) {
        throw createError({
          statusCode: 409,

          statusMessage:
            `${String(session.class_date).slice(0, 10)} 的 Attendance 已取消，請先恢復`,
        })
      }

      // ======================================================
      // 已經 LEAVE：
      //
      // 不允許重複建立另外一個 Leave Batch。
      //
      // 否則同一堂會出現在兩批請假裡，
      // 之後 Cancel / Restore 會互相打架。
      // ======================================================

      if (
        existingAttendance
          ?.status ===
        'LEAVE'
      ) {
        throw createError({
          statusCode: 409,

          statusMessage:
            `${String(session.class_date).slice(0, 10)} 已經是請假狀態`,
        })
      }

      items.push({
        id:
          randomUUID(),

        session,

        attendanceId:
          existingAttendance
            ?.id ||
          randomUUID(),

        existingAttendance,

        attendanceCreatedByLeave:
          !existingAttendance,
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
    // Items
    // ========================================================

    for (
      const item of
      items
    ) {
      const {
        session,
        existingAttendance,
        attendanceId,
        attendanceCreatedByLeave,
      } = item

      // ======================================================
      // 原本不存在 Attendance
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
              ${currentPackage.id},
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
        // ATTENDED / ABSENT
        // ↓
        // LEAVE
        //
        // package_id / attendance_type 不改。
        // ====================================================

        queries.push(
          sql`
            UPDATE
              attendance_records_v2

            SET
              status =
                'LEAVE',

              note =
                ${normalizedReason},

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

              previous_attendance_status,
              previous_attendance_note,
              previous_attendance_type,
              attendance_created_by_leave,

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

            ${
              existingAttendance
                ?.status ||
              null
            },

            ${
              existingAttendance
                ?.note ||
              null
            },

            ${
              existingAttendance
                ?.attendance_type ||
              null
            },

            ${attendanceCreatedByLeave},

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
                currentPackage.id,

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
              `請假：${courseName} ${String(session.class_date).slice(0, 10)}`,

            ...auditMetadata,
          }
        )
      )
    }

    // ========================================================
    // Leave Audit
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
                  return session.id
                }
              ),
          },

          note:
            `建立請假，共 ${sessions.length} 堂`,

          ...auditMetadata,
        }
      )
    )

    await runTransaction(
      sql,
      queries
    )

    // ========================================================
    // Recalculate affected Packages
    // ========================================================

    const affectedPackageIds =
      new Set()

    affectedPackageIds.add(
      String(
        currentPackage.id
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
      const packageData =
        await recalculatePackage(
          sql,
          packageId
        )

      if (
        packageData
      ) {
        recalculatedPackages.push(
          packageData
        )
      }
    }

    // ========================================================
    // Return
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

          schedule.weekday,

          schedule.name
            AS schedule_name,

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
            ${batchId}

        ORDER BY
          item.class_date ASC,
          session.start_time ASC
      `

    return {
      batch:
        batches[0] ||
        null,

      items:
        batchItems,

      packages:
        recalculatedPackages,
    }
  }

// ============================================================
// Get Leave Batches
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

    const normalizedStudentId =
      studentId
        ? String(
            studentId
          ).trim()
        : null

    const normalizedCourseId =
      courseId
        ? String(
            courseId
          ).trim()
        : null

    if (
      normalizedStudentId
    ) {
      assertUuid(
        normalizedStudentId,
        '學生 ID'
      )
    }

    if (
      normalizedCourseId
    ) {
      assertUuid(
        normalizedCourseId,
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

    const normalizedStartDate =
      normalizeOptionalDate(
        startDate,
        '開始日期'
      )

    const normalizedEndDate =
      normalizeOptionalDate(
        endDate,
        '結束日期'
      )

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
            ${normalizedStudentId}::uuid
              IS NULL

            OR
              batch.student_id =
                ${normalizedStudentId}
          )

          AND (
            ${normalizedCourseId}::uuid
              IS NULL

            OR
              batch.course_id =
                ${normalizedCourseId}
          )

          AND (
            ${normalizedStatus}::text
              IS NULL

            OR
              batch.status =
                ${normalizedStatus}
          )

          AND (
            ${normalizedStartDate}::date
              IS NULL

            OR
              batch.created_at::date >=
                ${normalizedStartDate}
          )

          AND (
            ${normalizedEndDate}::date
              IS NULL

            OR
              batch.created_at::date <=
                ${normalizedEndDate}
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