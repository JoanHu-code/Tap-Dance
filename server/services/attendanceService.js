import {
  randomUUID,
} from 'node:crypto'

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
// Status
// ============================================================

const TEACHER_STATUSES = [
  'ATTENDED',
  'LEAVE',
  'ABSENT',
]

const STUDENT_STATUSES = [
  'ATTENDED',
  'LEAVE',
]

const normalizeStatus = (
  value,
  actorRole
) => {
  const status =
    String(
      value || ''
    )
      .trim()
      .toUpperCase()

  const allowed =
    actorRole ===
    'TEACHER'
      ? TEACHER_STATUSES
      : STUDENT_STATUSES

  if (
    !allowed.includes(
      status
    )
  ) {
    throw createError({
      statusCode: 400,

      statusMessage:
        actorRole ===
        'TEACHER'
          ? '老師只能建立 ATTENDED、LEAVE 或 ABSENT'
          : '學生只能建立 ATTENDED 或 LEAVE',
    })
  }

  return status
}

// ============================================================
// Attendance Type
// ============================================================

const ATTENDANCE_TYPES = [
  'NORMAL',
  'MAKEUP',
  'MANUAL',
]

const normalizeAttendanceType = (
  value,
  actorRole
) => {
  const type =
    String(
      value ||
      'NORMAL'
    )
      .trim()
      .toUpperCase()

  if (
    !ATTENDANCE_TYPES.includes(
      type
    )
  ) {
    throw createError({
      statusCode: 400,

      statusMessage:
        'attendanceType 只能是 NORMAL、MAKEUP 或 MANUAL',
    })
  }

  // ========================================================
  // 學生不能自己建立 MANUAL
  // ========================================================

  if (
    actorRole ===
      'STUDENT' &&
    type ===
      'MANUAL'
  ) {
    throw createError({
      statusCode: 403,

      statusMessage:
        '學生不能建立 MANUAL Attendance',
    })
  }

  return type
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

        FROM students

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
// Session
//
// Session
// → Schedule
// → Course
// ============================================================

const requireSession =
  async (
    sql,
    sessionId
  ) => {
    assertUuid(
      sessionId,
      'Session ID'
    )

    const sessions =
      await sql`
        SELECT
          cs.*,

          schedule.course_id,

          schedule.weekday,

          schedule.name
            AS schedule_name,

          course.name
            AS course_name

        FROM
          class_sessions cs

        INNER JOIN
          class_schedules schedule

          ON schedule.id =
            cs.schedule_id

        INNER JOIN
          dance_courses course

          ON course.id =
            schedule.course_id

        WHERE
          cs.id =
            ${sessionId}

        LIMIT 1
      `

    if (
      !sessions.length
    ) {
      throw createError({
        statusCode: 404,

        statusMessage:
          '找不到課堂 Session',
      })
    }

    const session =
      sessions[0]

    if (
      session.status ===
      'TEACHER_LEAVE'
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '此堂為老師請假，不能建立 Attendance',
      })
    }

    if (
      session.status ===
      'CANCELLED'
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '此堂已取消，不能建立 Attendance',
      })
    }

    return session
  }

// ============================================================
// Enrollment
//
// 學生必須真的有加入這門 Course。
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
// 找本次 Attendance 應該屬於哪一期 Package
//
// 優先：
// ACTIVE
//
// 但如果剛好已經因為滿堂被標為 COMPLETED，
// 新一期又尚未 Renew，則不能再新增 ATTENDED。
// ============================================================

const requireActivePackage =
  async (
    sql,
    studentId,
    courseId,
    status
  ) => {
    const packages =
      await sql`
        SELECT
          p.*,

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
          p.student_id =
            ${studentId}

          AND
            p.course_id =
            ${courseId}

          AND
            p.status =
            'ACTIVE'

        GROUP BY
          p.id

        ORDER BY
          p.cycle_no DESC

        LIMIT 1
      `

    if (
      !packages.length
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '這門課目前沒有 ACTIVE Package，請先建立或續期方案',
      })
    }

    const packageData =
      packages[0]

    const totalSessions =
      Number(
        packageData
          .total_sessions ||
        0
      )

    const attendedCount =
      Number(
        packageData
          .attended_count ||
        0
      )

    // ========================================================
    // 如果這筆本身是 ATTENDED，
    // 已經滿堂就不能再塞進同一期。
    // ========================================================

    if (
      status ===
        'ATTENDED' &&
      attendedCount >=
        totalSessions
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          `本期已完成 ${attendedCount}/${totalSessions} 堂，請先 Renew`,
      })
    }

    return packageData
  }

// ============================================================
// 重算 Package
//
// Attendance 改變後立刻重新判斷。
// ============================================================

export const recalculatePackage =
  async (
    sql,
    packageId
  ) => {
    assertUuid(
      packageId,
      'Package ID'
    )

    const packages =
      await sql`
        SELECT
          p.*,

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
            ${packageId}

        GROUP BY
          p.id

        LIMIT 1
      `

    if (
      !packages.length
    ) {
      return null
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

    // ========================================================
    // 滿堂
    // ========================================================

    if (
      total > 0 &&
      attended >= total
    ) {
      const updated =
        await sql`
          UPDATE
            student_packages

          SET
            status =
              'COMPLETED',

            completion_reason =
              COALESCE(
                completion_reason,
                'SESSIONS_USED_UP'
              ),

            updated_at =
              NOW()

          WHERE
            id =
              ${packageId}

            AND
              status <>
              'CANCELLED'

          RETURNING
            *
        `

      return {
        ...(
          updated[0] ||
          packageData
        ),

        attended_count:
          attended,

        remaining_sessions:
          0,
      }
    }

    // ========================================================
    // 未滿堂
    //
    // 只有「目前沒有下一期」時，
    // 才允許舊 Package 回 ACTIVE。
    //
    // 這能避免：
    //
    // Cycle 1 已 Renew
    // Cycle 2 ACTIVE
    //
    // 後來 Cycle 1 8/8 改成 7/8
    // 卻把 Cycle 1 又改 ACTIVE。
    // ========================================================

    const newerActive =
      await sql`
        SELECT
          id

        FROM
          student_packages

        WHERE
          student_id =
            ${packageData.student_id}

          AND
            course_id =
            ${packageData.course_id}

          AND
            status =
            'ACTIVE'

          AND
            cycle_no >
            ${packageData.cycle_no}

        LIMIT 1
      `

    if (
      !newerActive.length &&
      packageData.status ===
        'COMPLETED' &&
      packageData
        .completion_reason ===
        'SESSIONS_USED_UP'
    ) {
      const updated =
        await sql`
          UPDATE
            student_packages

          SET
            status =
              'ACTIVE',

            completion_reason =
              NULL,

            updated_at =
              NOW()

          WHERE
            id =
              ${packageId}

          RETURNING
            *
        `

      return {
        ...(
          updated[0] ||
          packageData
        ),

        attended_count:
          attended,

        remaining_sessions:
          Math.max(
            total -
              attended,
            0
          ),
      }
    }

    return {
      ...packageData,

      attended_count:
        attended,

      remaining_sessions:
        Math.max(
          total -
            attended,
          0
        ),
    }
  }

// ============================================================
// 建立 Attendance
// ============================================================

export const createAttendance =
  async ({
    studentId,
    sessionId,
    status,
    attendanceType =
      'NORMAL',
    note = null,
    actorUserId,
    actorRole,
    auditMetadata = {},
  }) => {
    assertUuid(
      actorUserId,
      '操作者 ID'
    )

    const normalizedRole =
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
        normalizedRole
      )
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          'Attendance 操作者角色不正確',
      })
    }

    const normalizedStatus =
      normalizeStatus(
        status,
        normalizedRole
      )

    const normalizedType =
      normalizeAttendanceType(
        attendanceType,
        normalizedRole
      )

    const normalizedNote =
      note ===
        undefined ||
      note ===
        null
        ? null
        : String(
            note
          )
            .trim()
            .slice(
              0,
              1000
            )

    const sql =
      useDatabase()

    const student =
      await requireStudent(
        sql,
        studentId
      )

    const session =
      await requireSession(
        sql,
        sessionId
      )

    await requireEnrollment(
      sql,
      studentId,
      session.course_id
    )

    const packageData =
      await requireActivePackage(
        sql,
        studentId,
        session.course_id,
        normalizedStatus
      )

    // ========================================================
    // 一學生一 Session 只能一筆
    // ========================================================

    const existing =
      await sql`
        SELECT
          id,
          status

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

    if (
      existing.length
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '這堂課已經有 Attendance 紀錄，請使用修改功能',
      })
    }

    const attendanceId =
      randomUUID()

    // ========================================================
    // After Snapshot
    // ========================================================

    const afterData = {
      id:
        attendanceId,

      student_id:
        studentId,

      student_name:
        student.name,

      package_id:
        packageData.id,

      package_cycle_no:
        packageData.cycle_no,

      course_id:
        session.course_id,

      course_name:
        session.course_name,

      session_id:
        sessionId,

      class_date:
        session.class_date,

      status:
        normalizedStatus,

      attendance_type:
        normalizedType,

      note:
        normalizedNote,
    }

    // ========================================================
    // Transaction
    // ========================================================

    const queries = [
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
          ${sessionId},
          ${normalizedStatus},
          ${normalizedType},
          ${actorUserId},
          NULL,
          NULL,
          ${normalizedNote},
          NOW(),
          NOW()
        )

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
            'CREATE',

          entityType:
            'ATTENDANCE',

          entityId:
            attendanceId,

          studentId,

          courseId:
            session.course_id,

          sessionId,

          beforeData:
            null,

          afterData,

          note:
            `${normalizedRole === 'TEACHER' ? '老師' : '學生'}建立 Attendance`,

          ...auditMetadata,
        }
      ),
    ]

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
      await sql.transaction(
        queries
      )

    const attendance =
      results[0]?.[0]

    // ========================================================
    // Transaction 完成後重算 Package
    // ========================================================

    const recalculatedPackage =
      await recalculatePackage(
        sql,
        packageData.id
      )

    return {
      attendance,

      package:
        recalculatedPackage,

      session,

      student,
    }
  }