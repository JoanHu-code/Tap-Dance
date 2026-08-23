import {
  randomUUID,
} from 'node:crypto'

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

import {
  ensureCourseSession,
} from './courseSessionService.js'

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
// Date
// ============================================================

const normalizeDate = (
  value
) => {
  const normalized =
    String(
      value || ''
    ).trim()

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      normalized
    )
  ) {
    throw createError({
      statusCode: 400,

      statusMessage:
        '日期格式必須為 YYYY-MM-DD',
    })
  }

  const date =
    new Date(
      `${normalized}T00:00:00Z`
    )

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    throw createError({
      statusCode: 400,

      statusMessage:
        '日期格式不正確',
    })
  }

  return normalized
}

// ============================================================
// Attendance Status
// ============================================================

const ALLOWED_STATUSES = [
  'ATTENDED',
  'LEAVE',
  'ABSENT',
  'CANCELLED',
]

const normalizeAttendanceStatus = (
  value
) => {
  const normalized =
    String(
      value || ''
    )
      .trim()
      .toUpperCase()

  if (
    !ALLOWED_STATUSES.includes(
      normalized
    )
  ) {
    throw createError({
      statusCode: 400,

      statusMessage:
        '出席狀態不正確',
    })
  }

  return normalized
}

// ============================================================
// Note
// ============================================================

const normalizeNote = (
  value
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
        2000
      )

  return (
    normalized ||
    null
  )
}

// ============================================================
// Require Student
// ============================================================

const requireStudent = async (
  sql,
  studentId
) => {
  const normalizedStudentId =
    normalizeUuid(
      studentId,
      'Student ID'
    )

  const rows =
    await sql`
      SELECT
        id,
        user_id,
        name,
        note,
        status,
        created_at,
        updated_at

      FROM
        students

      WHERE
        id =
          ${normalizedStudentId}

      LIMIT 1
    `

  if (
    !rows.length
  ) {
    throw createError({
      statusCode: 404,

      statusMessage:
        '找不到學生資料',
    })
  }

  return rows[0]
}

// ============================================================
// Require Package
// ============================================================

const requireActivePackage =
  async (
    sql,
    {
      studentId,
      courseId,
      classDate,
    }
  ) => {
    const rows =
      await sql`
        SELECT
          package.id,

          package.student_id,

          package.course_id,

          package.start_date,

          package.cycle_no,

          package.purchased_cycles,

          package.sessions_per_cycle,

          package.total_sessions,

          package.price_per_cycle,

          package.price,

          package.status,

          package.paid,

          package.completed_at,

          course.name
            AS course_name

        FROM
          student_packages package

        INNER JOIN
          dance_courses course

          ON course.id =
            package.course_id

        WHERE
          package.student_id =
            ${studentId}

          AND
            package.course_id =
              ${courseId}

          AND
            package.status =
              'ACTIVE'

          AND
            package.start_date <=
              ${classDate}

        ORDER BY
          package.cycle_no DESC NULLS LAST,
          package.created_at DESC

        LIMIT 1
      `

    if (
      !rows.length
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '這個日期沒有可使用的進行中方案',
      })
    }

    return rows[0]
  }

// ============================================================
// Get Attendance By ID
// ============================================================

const getAttendanceById =
  async (
    sql,
    {
      attendanceId,
      studentId,
    }
  ) => {
    const rows =
      await sql`
        SELECT
          attendance.id,

          attendance.student_id,

          attendance.package_id,

          attendance.session_id,

          attendance.status,

          attendance.attendance_type,

          attendance.created_by,

          attendance.original_status,

          attendance.cancelled_at,

          attendance.note,

          attendance.created_at,

          attendance.updated_at,

          session.class_date,

          session.start_time,

          session.end_time,

          session.status
            AS session_status,

          COALESCE(
            session.course_id,
            schedule.course_id
          )
            AS course_id,

          course.name
            AS course_name

        FROM
          attendance_records_v2 attendance

        INNER JOIN
          class_sessions session

          ON session.id =
            attendance.session_id

        LEFT JOIN
          class_schedules schedule

          ON schedule.id =
            session.schedule_id

        LEFT JOIN
          dance_courses course

          ON course.id =
            COALESCE(
              session.course_id,
              schedule.course_id
            )

        WHERE
          attendance.id =
            ${attendanceId}

          AND
            attendance.student_id =
              ${studentId}

        LIMIT 1
      `

    if (
      !rows.length
    ) {
      throw createError({
        statusCode: 404,

        statusMessage:
          '找不到這筆出席紀錄',
      })
    }

    return rows[0]
  }

// ============================================================
// Check Package Capacity
//
// 修改某筆 Attendance 成 ATTENDED 時：
//
// COUNT 其他 ATTENDED
//
// 不包含目前這筆。
// ============================================================

const ensurePackageHasRemainingSession =
  async (
    sql,
    {
      packageId,
      attendanceId = null,
    }
  ) => {
    const packageRows =
      await sql`
        SELECT
          id,
          total_sessions,
          status

        FROM
          student_packages

        WHERE
          id =
            ${packageId}

        LIMIT 1
      `

    if (
      !packageRows.length
    ) {
      throw createError({
        statusCode: 404,

        statusMessage:
          '找不到對應方案',
      })
    }

    const packageData =
      packageRows[0]

    const usageRows =
      await sql`
        SELECT
          COUNT(*)::INTEGER
            AS used_sessions

        FROM
          attendance_records_v2

        WHERE
          package_id =
            ${packageId}

          AND
            status =
              'ATTENDED'

          AND (
            ${attendanceId}::uuid
              IS NULL

            OR
              id <>
                ${attendanceId}
          )
      `

    const usedSessions =
      Number(
        usageRows[0]
          ?.used_sessions ||
        0
      )

    const totalSessions =
      Number(
        packageData
          .total_sessions ||
        0
      )

    if (
      usedSessions >=
      totalSessions
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '這個方案的堂數已經全部使用完畢',
      })
    }
  }

// ============================================================
// Get Student Attendance Data
// ============================================================

export const getStudentAttendanceData =
  async ({
    studentId,
    status = null,
    courseId = null,
    startDate = null,
    endDate = null,
  }) => {
    const normalizedStudentId =
      normalizeUuid(
        studentId,
        'Student ID'
      )

    const normalizedStatus =
      status
        ? normalizeAttendanceStatus(
            status
          )
        : null

    const normalizedCourseId =
      courseId
        ? normalizeUuid(
            courseId,
            'Course ID'
          )
        : null

    const normalizedStartDate =
      startDate
        ? normalizeDate(
            startDate
          )
        : null

    const normalizedEndDate =
      endDate
        ? normalizeDate(
            endDate
          )
        : null

    const sql =
      useDatabase()

    const student =
      await requireStudent(
        sql,
        normalizedStudentId
      )

    // ========================================================
    // Student Courses
    //
    // 顯示曾經有 Package 的課堂，
    // 不只 ACTIVE。
    // ========================================================

    const courses =
      await sql`
        SELECT DISTINCT
          course.id,
          course.name,
          course.weekday,
          course.start_time,
          course.end_time,
          course.sessions_per_cycle,
          course.price_per_cycle,
          course.status

        FROM
          student_packages package

        INNER JOIN
          dance_courses course

          ON course.id =
            package.course_id

        WHERE
          package.student_id =
            ${normalizedStudentId}

        ORDER BY
          course.name ASC
      `

    // ========================================================
    // Active Packages
    // ========================================================

    const activePackages =
      await sql`
        SELECT
          package.id,

          package.course_id,

          package.start_date,

          package.cycle_no,

          package.purchased_cycles,

          package.sessions_per_cycle,

          package.total_sessions,

          package.price_per_cycle,

          package.price,

          package.status,

          package.paid,

          course.name
            AS course_name,

          course.weekday,

          course.start_time,

          course.end_time,

          COALESCE(
            (
              SELECT
                COUNT(*)::INTEGER

              FROM
                attendance_records_v2 used

              WHERE
                used.package_id =
                  package.id

                AND
                  used.status =
                    'ATTENDED'
            ),
            0
          )
            AS used_sessions

        FROM
          student_packages package

        INNER JOIN
          dance_courses course

          ON course.id =
            package.course_id

        WHERE
          package.student_id =
            ${normalizedStudentId}

          AND
            package.status =
              'ACTIVE'

        ORDER BY
          course.name ASC
      `

    // ========================================================
    // Attendance History
    // ========================================================

    const attendance =
      await sql`
        SELECT
          attendance.id,

          attendance.student_id,

          attendance.package_id,

          attendance.session_id,

          attendance.status,

          attendance.attendance_type,

          attendance.original_status,

          attendance.cancelled_at,

          attendance.note,

          attendance.created_at,

          attendance.updated_at,

          session.class_date,

          session.start_time,

          session.end_time,

          session.status
            AS session_status,

          COALESCE(
            session.course_id,
            schedule.course_id
          )
            AS course_id,

          course.name
            AS course_name,

          course.weekday,

          package.cycle_no,

          package.purchased_cycles,

          package.sessions_per_cycle,

          package.total_sessions,

          package.status
            AS package_status,

          COALESCE(
            (
              SELECT
                COUNT(*)::INTEGER

              FROM
                attendance_records_v2 usage

              WHERE
                usage.package_id =
                  attendance.package_id

                AND
                  usage.status =
                    'ATTENDED'
            ),
            0
          )
            AS package_used_sessions,

          EXISTS (
            SELECT
              1

            FROM
              makeup_records makeup

            WHERE
              makeup.makeup_attendance_id =
                attendance.id

              AND
                makeup.status =
                  'ACTIVE'
          )
            AS has_active_makeup_link

        FROM
          attendance_records_v2 attendance

        INNER JOIN
          class_sessions session

          ON session.id =
            attendance.session_id

        LEFT JOIN
          class_schedules schedule

          ON schedule.id =
            session.schedule_id

        LEFT JOIN
          dance_courses course

          ON course.id =
            COALESCE(
              session.course_id,
              schedule.course_id
            )

        LEFT JOIN
          student_packages package

          ON package.id =
            attendance.package_id

        WHERE
          attendance.student_id =
            ${normalizedStudentId}

          AND (
            ${normalizedStatus}::text
              IS NULL

            OR
              attendance.status =
                ${normalizedStatus}
          )

          AND (
            ${normalizedCourseId}::uuid
              IS NULL

            OR
              COALESCE(
                session.course_id,
                schedule.course_id
              ) =
                ${normalizedCourseId}
          )

          AND (
            ${normalizedStartDate}::date
              IS NULL

            OR
              session.class_date >=
                ${normalizedStartDate}
          )

          AND (
            ${normalizedEndDate}::date
              IS NULL

            OR
              session.class_date <=
                ${normalizedEndDate}
          )

        ORDER BY
          session.class_date DESC,
          session.start_time DESC,
          attendance.created_at DESC
      `

    const mappedPackages =
      activePackages.map(
        (
          packageData
        ) => {
          const used =
            Number(
              packageData
                .used_sessions ||
              0
            )

          const total =
            Number(
              packageData
                .total_sessions ||
              0
            )

          return {
            ...packageData,

            used_sessions:
              used,

            remaining_sessions:
              Math.max(
                total -
                used,
                0
              ),
          }
        }
      )

    return {
      student,

      courses,

      activePackages:
        mappedPackages,

      attendance,
    }
  }

// ============================================================
// Create Student Attendance
//
// 學生自己新增：
//
// ATTENDED
// LEAVE
// ABSENT
//
// 不允許直接建立 CANCELLED。
// ============================================================

export const createStudentAttendance =
  async ({
    studentId,

    courseId,

    classDate,

    status,

    note = null,

    actorUserId,

    event = null,
  }) => {
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

    const normalizedActorId =
      normalizeUuid(
        actorUserId,
        'Actor User ID'
      )

    const normalizedDate =
      normalizeDate(
        classDate
      )

    const normalizedStatus =
      normalizeAttendanceStatus(
        status
      )

    const normalizedNote =
      normalizeNote(
        note
      )

    if (
      normalizedStatus ===
      'CANCELLED'
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '不能直接建立取消狀態，請先建立一筆出席紀錄',
      })
    }

    const sql =
      useDatabase()

    const student =
      await requireStudent(
        sql,
        normalizedStudentId
      )

    if (
      student.status !==
      'ACTIVE'
    ) {
      throw createError({
        statusCode: 403,

        statusMessage:
          '學生資料目前已停用',
      })
    }

    // ========================================================
    // Package
    // ========================================================

    const packageData =
      await requireActivePackage(
        sql,
        {
          studentId:
            normalizedStudentId,

          courseId:
            normalizedCourseId,

          classDate:
            normalizedDate,
        }
      )

    // ========================================================
    // Session
    // ========================================================

    const sessionResult =
      await ensureCourseSession({
        courseId:
          normalizedCourseId,

        classDate:
          normalizedDate,
      })

    const session =
      sessionResult.session

    const course =
      sessionResult.course

    if (
      session.status ===
      'TEACHER_LEAVE'
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '這堂課老師請假，不能登記出席',
      })
    }

    if (
      session.status ===
      'CANCELLED'
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '這堂課已取消，不能登記出席',
      })
    }

    // ========================================================
    // Duplicate
    // ========================================================

    const existingRows =
      await sql`
        SELECT
          id,
          status,
          attendance_type

        FROM
          attendance_records_v2

        WHERE
          student_id =
            ${normalizedStudentId}

          AND
            session_id =
              ${session.id}

        LIMIT 1
      `

    if (
      existingRows.length
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '這堂課已經有出席紀錄，請直接修改原有紀錄',
      })
    }

    // ========================================================
    // ATTENDED Capacity
    // ========================================================

    if (
      normalizedStatus ===
      'ATTENDED'
    ) {
      await ensurePackageHasRemainingSession(
        sql,
        {
          packageId:
            packageData.id,
        }
      )
    }

    const attendanceId =
      randomUUID()

    const afterData = {
      id:
        attendanceId,

      student_id:
        normalizedStudentId,

      package_id:
        packageData.id,

      session_id:
        session.id,

      course_id:
        normalizedCourseId,

      class_date:
        normalizedDate,

      status:
        normalizedStatus,

      attendance_type:
        'NORMAL',

      note:
        normalizedNote,
    }

    const auditMetadata =
      event
        ? getAuditRequestMetadata(
            event
          )
        : {}

    const attendanceQuery =
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

          ${normalizedStudentId},

          ${packageData.id},

          ${session.id},

          ${normalizedStatus},

          'NORMAL',

          ${normalizedActorId},

          NULL,

          NULL,

          ${normalizedNote},

          NOW(),

          NOW()
        )

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
            'STUDENT',

          action:
            'CREATE',

          entityType:
            'ATTENDANCE',

          entityId:
            attendanceId,

          studentId:
            normalizedStudentId,

          courseId:
            normalizedCourseId,

          beforeData:
            null,

          afterData,

          note:
            `${student.name} 自行登記 ${course.name} ${normalizedDate} ${normalizedStatus}`,

          ...auditMetadata,
        }
      )

    const recalculateQuery =
      createPackageStateRecalculationQuery(
        sql,
        packageData.id
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
        auditQuery,
        recalculateQuery,
      ])

    return {
      attendance:
        results[0]?.[0] ||
        null,

      package:
        results[2]?.[0] ||
        null,

      session,
    }
  }

// ============================================================
// Update Student Attendance
// ============================================================

export const updateStudentAttendance =
  async ({
    attendanceId,

    studentId,

    status,

    note,

    actorUserId,

    event = null,
  }) => {
    const normalizedAttendanceId =
      normalizeUuid(
        attendanceId,
        'Attendance ID'
      )

    const normalizedStudentId =
      normalizeUuid(
        studentId,
        'Student ID'
      )

    const normalizedActorId =
      normalizeUuid(
        actorUserId,
        'Actor User ID'
      )

    const normalizedStatus =
      normalizeAttendanceStatus(
        status
      )

    const normalizedNote =
      normalizeNote(
        note
      )

    const sql =
      useDatabase()

    const student =
      await requireStudent(
        sql,
        normalizedStudentId
      )

    const existing =
      await getAttendanceById(
        sql,
        {
          attendanceId:
            normalizedAttendanceId,

          studentId:
            normalizedStudentId,
        }
      )

    // ========================================================
    // Makeup Safety
    //
    // 補課 Attendance 必須由 Makeup Flow 控制，
    // 避免：
    //
    // makeup_records = ACTIVE
    // 但 attendance 被一般 API 改成 LEAVE / CANCELLED
    //
    // 造成雙方資料不同步。
    // ========================================================

    if (
      existing
        .attendance_type ===
      'MAKEUP'
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '這筆是補課紀錄，請從補課管理修改，避免補課堂數重複計算',
      })
    }

    // ========================================================
    // Session Teacher Leave
    // ========================================================

    if (
      existing
        .session_status ===
        'TEACHER_LEAVE' &&
      normalizedStatus ===
        'ATTENDED'
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '這堂課老師請假，不能修改成出席',
      })
    }

    if (
      existing
        .session_status ===
        'CANCELLED' &&
      normalizedStatus ===
        'ATTENDED'
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '這堂課已取消，不能修改成出席',
      })
    }

    // ========================================================
    // Package
    // ========================================================

    if (
      !existing.package_id
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '這筆出席紀錄沒有對應方案，請聯絡老師處理',
      })
    }

    // ========================================================
    // ATTENDED Capacity
    //
    // 只有：
    //
    // 原本不是 ATTENDED
    // ↓
    // 現在改 ATTENDED
    //
    // 才需要檢查剩餘堂數。
    // ========================================================

    if (
      normalizedStatus ===
        'ATTENDED' &&
      existing.status !==
        'ATTENDED'
    ) {
      await ensurePackageHasRemainingSession(
        sql,
        {
          packageId:
            existing.package_id,

          attendanceId:
            normalizedAttendanceId,
        }
      )
    }

    // ========================================================
    // Cancellation State
    // ========================================================

    let originalStatus =
      existing.original_status ||
      null

    let cancelledAt =
      null

    if (
      normalizedStatus ===
      'CANCELLED'
    ) {
      if (
        existing.status !==
        'CANCELLED'
      ) {
        originalStatus =
          existing.status
      }

      cancelledAt =
        new Date()
          .toISOString()
    } else {
      originalStatus =
        null

      cancelledAt =
        null
    }

    const beforeData = {
      id:
        existing.id,

      student_id:
        existing.student_id,

      package_id:
        existing.package_id,

      session_id:
        existing.session_id,

      course_id:
        existing.course_id,

      class_date:
        existing.class_date,

      status:
        existing.status,

      attendance_type:
        existing.attendance_type,

      original_status:
        existing.original_status,

      cancelled_at:
        existing.cancelled_at,

      note:
        existing.note,
    }

    const afterData = {
      ...beforeData,

      status:
        normalizedStatus,

      original_status:
        originalStatus,

      cancelled_at:
        cancelledAt,

      note:
        normalizedNote,
    }

    const auditMetadata =
      event
        ? getAuditRequestMetadata(
            event
          )
        : {}

    // ========================================================
    // Update Query
    // ========================================================

    const updateQuery =
      sql`
        UPDATE
          attendance_records_v2

        SET
          status =
            ${normalizedStatus},

          original_status =
            ${originalStatus},

          cancelled_at =
            ${cancelledAt},

          note =
            ${normalizedNote},

          updated_at =
            NOW()

        WHERE
          id =
            ${normalizedAttendanceId}

          AND
            student_id =
              ${normalizedStudentId}

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
            'STUDENT',

          action:
            normalizedStatus ===
              'CANCELLED'
              ? 'CANCEL'
              : 'UPDATE',

          entityType:
            'ATTENDANCE',

          entityId:
            normalizedAttendanceId,

          studentId:
            normalizedStudentId,

          courseId:
            existing.course_id,

          beforeData,

          afterData,

          note:
            `${student.name} 修改 ${existing.course_name || '課堂'} ${String(existing.class_date).slice(0, 10)}：${existing.status} → ${normalizedStatus}`,

          ...auditMetadata,
        }
      )

    const recalculateQuery =
      createPackageStateRecalculationQuery(
        sql,
        existing.package_id
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
        updateQuery,
        auditQuery,
        recalculateQuery,
      ])

    return {
      attendance:
        results[0]?.[0] ||
        null,

      package:
        results[2]?.[0] ||
        null,
    }
  }