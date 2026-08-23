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
// Optional UUID
// ============================================================

const normalizeOptionalUuid = (
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

  return normalizeUuid(
    value,
    fieldName
  )
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
        '補課日期格式必須為 YYYY-MM-DD',
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
// Role
// ============================================================

const normalizeActorRole = (
  value
) => {
  const role =
    String(
      value ||
      'STUDENT'
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
// Require Student
// ============================================================

const requireStudent =
  async (
    sql,
    studentId
  ) => {
    const rows =
      await sql`
        SELECT
          id,
          user_id,
          name,
          note,
          status

        FROM
          students

        WHERE
          id =
            ${studentId}

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
// Source Leave
// ============================================================

const requireSourceLeave =
  async (
    sql,
    {
      studentId,
      sourceLeaveAttendanceId,
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

          package.total_sessions,

          package.status
            AS package_status,

          package.start_date
            AS package_start_date,

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
            AS used_sessions

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

        INNER JOIN
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
          attendance.id =
            ${sourceLeaveAttendanceId}

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
          '找不到原始請假紀錄',
      })
    }

    const source =
      rows[0]

    if (
      source.status !==
      'LEAVE'
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '只有目前狀態仍為請假的紀錄可以建立補課',
      })
    }

    if (
      source.attendance_type ===
      'MAKEUP'
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '補課產生的紀錄不能再作為另一筆補課來源',
      })
    }

    if (
      !source.package_id
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '這筆請假沒有對應方案，無法建立補課',
      })
    }

    if (
      source.package_status ===
      'CANCELLED'
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '這個方案已取消，不能建立補課',
      })
    }

    const usedSessions =
      Number(
        source.used_sessions ||
        0
      )

    const totalSessions =
      Number(
        source.total_sessions ||
        0
      )

    if (
      usedSessions >=
      totalSessions
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '此方案堂數已全部使用完畢，不需要再建立補課',
      })
    }

    return source
  }

// ============================================================
// Target Session by ID
// ============================================================

const requireTargetSession =
  async (
    sql,
    {
      sessionId,
      courseId,
    }
  ) => {
    const rows =
      await sql`
        SELECT
          session.id,

          session.class_date,

          session.start_time,

          session.end_time,

          session.status,

          COALESCE(
            session.course_id,
            schedule.course_id
          )
            AS course_id

        FROM
          class_sessions session

        LEFT JOIN
          class_schedules schedule

          ON schedule.id =
            session.schedule_id

        WHERE
          session.id =
            ${sessionId}

        LIMIT 1
      `

    if (
      !rows.length
    ) {
      throw createError({
        statusCode: 404,

        statusMessage:
          '找不到補課 Session',
      })
    }

    const session =
      rows[0]

    if (
      String(
        session.course_id
      ) !==
      String(
        courseId
      )
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '補課必須選擇相同課堂',
      })
    }

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
          '目標課堂目前無法補課',
      })
    }

    return session
  }

// ============================================================
// Active Makeup Check
// ============================================================

const ensureNoActiveMakeup =
  async (
    sql,
    {
      studentId,
      sourceLeaveAttendanceId,
      targetSessionId,
    }
  ) => {
    const sourceRows =
      await sql`
        SELECT
          id

        FROM
          makeup_records

        WHERE
          source_leave_attendance_id =
            ${sourceLeaveAttendanceId}

          AND
            status =
              'ACTIVE'

        LIMIT 1
      `

    if (
      sourceRows.length
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '這筆請假已經有進行中的補課紀錄',
      })
    }

    const targetRows =
      await sql`
        SELECT
          id

        FROM
          makeup_records

        WHERE
          student_id =
            ${studentId}

          AND
            makeup_session_id =
              ${targetSessionId}

          AND
            status =
              'ACTIVE'

        LIMIT 1
      `

    if (
      targetRows.length
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '這個日期已經有進行中的補課',
      })
    }
  }

// ============================================================
// Target Attendance Check
// ============================================================

const ensureNoTargetAttendance =
  async (
    sql,
    {
      studentId,
      sessionId,
    }
  ) => {
    const rows =
      await sql`
        SELECT
          id,
          status,
          attendance_type

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
      rows.length
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '這個補課日期已經存在出席紀錄',
      })
    }
  }

// ============================================================
// Get Student Makeup Data
// ============================================================

export const getStudentMakeupData =
  async ({
    studentId,
  }) => {
    const normalizedStudentId =
      normalizeUuid(
        studentId,
        'Student ID'
      )

    const sql =
      useDatabase()

    const student =
      await requireStudent(
        sql,
        normalizedStudentId
      )

    // ========================================================
    // Eligible Leave Sources
    // ========================================================

    const sourceLeaves =
      await sql`
        SELECT
          attendance.id
            AS attendance_id,

          attendance.package_id,

          attendance.session_id,

          attendance.status,

          attendance.note,

          session.class_date,

          session.start_time,

          session.end_time,

          COALESCE(
            session.course_id,
            schedule.course_id
          )
            AS course_id,

          course.name
            AS course_name,

          course.weekday,

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
            AS used_sessions,

          EXISTS (
            SELECT
              1

            FROM
              makeup_records existing_makeup

            WHERE
              existing_makeup
                .source_leave_attendance_id =
                  attendance.id

              AND
                existing_makeup.status =
                  'ACTIVE'
          )
            AS has_active_makeup

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

        INNER JOIN
          dance_courses course

          ON course.id =
            COALESCE(
              session.course_id,
              schedule.course_id
            )

        INNER JOIN
          student_packages package

          ON package.id =
            attendance.package_id

        WHERE
          attendance.student_id =
            ${normalizedStudentId}

          AND
            attendance.status =
              'LEAVE'

          AND
            attendance.attendance_type <>
              'MAKEUP'

          AND
            package.status <>
              'CANCELLED'

        ORDER BY
          session.class_date DESC,
          session.start_time DESC
      `

    // ========================================================
    // Makeup History
    // ========================================================

    const makeups =
      await getTeacherMakeups({
        studentId:
          normalizedStudentId,
      })

    return {
      student,

      sourceLeaves,

      makeups,
    }
  }

// ============================================================
// Teacher / Shared Query
// ============================================================

export const getTeacherMakeups =
  async ({
    studentId = null,
    courseId = null,
    status = null,
    startDate = null,
    endDate = null,
  } = {}) => {
    const normalizedStudentId =
      studentId
        ? normalizeUuid(
            studentId,
            'Student ID'
          )
        : null

    const normalizedCourseId =
      courseId
        ? normalizeUuid(
            courseId,
            'Course ID'
          )
        : null

    const normalizedStatus =
      status
        ? String(
            status
          )
            .trim()
            .toUpperCase()
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
          '補課狀態不正確',
      })
    }

    const sql =
      useDatabase()

    return await sql`
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

        source_session.class_date
          AS source_class_date,

        source_session.start_time
          AS source_start_time,

        target_session.class_date
          AS makeup_class_date,

        target_session.start_time
          AS makeup_start_time,

        target_session.end_time
          AS makeup_end_time,

        target_attendance.status
          AS makeup_attendance_status,

        target_attendance.attendance_type
          AS makeup_attendance_type,

        target_attendance.note
          AS makeup_attendance_note,

        target_attendance.updated_at
          AS makeup_attendance_updated_at,

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
                makeup.package_id

              AND
                usage.status =
                  'ATTENDED'
          ),
          0
        )
          AS used_sessions

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
        class_sessions source_session

        ON source_session.id =
          makeup.source_session_id

      INNER JOIN
        class_sessions target_session

        ON target_session.id =
          makeup.makeup_session_id

      LEFT JOIN
        attendance_records_v2 target_attendance

        ON target_attendance.id =
          makeup.makeup_attendance_id

      WHERE
        (
          ${normalizedStudentId}::uuid
            IS NULL

          OR
            makeup.student_id =
              ${normalizedStudentId}
        )

        AND (
          ${normalizedCourseId}::uuid
            IS NULL

          OR
            makeup.course_id =
              ${normalizedCourseId}
        )

        AND (
          ${normalizedStatus}::text
            IS NULL

          OR
            makeup.status =
              ${normalizedStatus}
        )

        AND (
          ${normalizedStartDate}::date
            IS NULL

          OR
            target_session.class_date >=
              ${normalizedStartDate}
        )

        AND (
          ${normalizedEndDate}::date
            IS NULL

          OR
            target_session.class_date <=
              ${normalizedEndDate}
        )

      ORDER BY
        target_session.class_date DESC,
        makeup.created_at DESC
    `
  }

// ============================================================
// Create Makeup
//
// 支援：
//
// makeupDate
//
// 或舊 API：
//
// makeupSessionId
// ============================================================

export const createMakeup =
  async ({
    studentId,

    sourceLeaveAttendanceId,

    makeupDate = null,

    makeupSessionId = null,

    note = null,

    actorUserId,

    actorRole = 'STUDENT',

    event = null,
  }) => {
    const normalizedStudentId =
      normalizeUuid(
        studentId,
        'Student ID'
      )

    const normalizedSourceId =
      normalizeUuid(
        sourceLeaveAttendanceId,
        'Source Leave Attendance ID'
      )

    const normalizedActorId =
      normalizeUuid(
        actorUserId,
        'Actor User ID'
      )

    const normalizedTargetSessionId =
      normalizeOptionalUuid(
        makeupSessionId,
        'Makeup Session ID'
      )

    const normalizedMakeupDate =
      makeupDate
        ? normalizeDate(
            makeupDate
          )
        : null

    const normalizedRole =
      normalizeActorRole(
        actorRole
      )

    const normalizedNote =
      normalizeNote(
        note
      )

    if (
      !normalizedTargetSessionId &&
      !normalizedMakeupDate
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '請選擇補課日期',
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
        statusCode: 409,

        statusMessage:
          '學生目前已停用',
      })
    }

    // ========================================================
    // Source Leave
    // ========================================================

    const source =
      await requireSourceLeave(
        sql,
        {
          studentId:
            normalizedStudentId,

          sourceLeaveAttendanceId:
            normalizedSourceId,
        }
      )

    // ========================================================
    // Target Session
    // ========================================================

    let targetSession

    if (
      normalizedTargetSessionId
    ) {
      targetSession =
        await requireTargetSession(
          sql,
          {
            sessionId:
              normalizedTargetSessionId,

            courseId:
              source.course_id,
          }
        )
    } else {
      const ensured =
        await ensureCourseSession({
          courseId:
            source.course_id,

          classDate:
            normalizedMakeupDate,
        })

      targetSession =
        ensured.session
    }

    // ========================================================
    // Source != Target
    // ========================================================

    if (
      String(
        targetSession.id
      ) ===
      String(
        source.session_id
      )
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '補課日期不能和原本請假的課堂相同',
      })
    }

    // ========================================================
    // Target Session Status
    // ========================================================

    if (
      [
        'TEACHER_LEAVE',
        'CANCELLED',
      ].includes(
        targetSession.status
      )
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '這個補課日期目前不能上課',
      })
    }

    // ========================================================
    // Existing Makeup
    // ========================================================

    await ensureNoActiveMakeup(
      sql,
      {
        studentId:
          normalizedStudentId,

        sourceLeaveAttendanceId:
          normalizedSourceId,

        targetSessionId:
          targetSession.id,
      }
    )

    // ========================================================
    // Target Attendance
    // ========================================================

    await ensureNoTargetAttendance(
      sql,
      {
        studentId:
          normalizedStudentId,

        sessionId:
          targetSession.id,
      }
    )

    // ========================================================
    // IDs
    // ========================================================

    const makeupId =
      randomUUID()

    const makeupAttendanceId =
      randomUUID()

    // ========================================================
    // Audit
    // ========================================================

    const afterData = {
      id:
        makeupId,

      student_id:
        normalizedStudentId,

      course_id:
        source.course_id,

      package_id:
        source.package_id,

      source_leave_attendance_id:
        normalizedSourceId,

      source_session_id:
        source.session_id,

      makeup_session_id:
        targetSession.id,

      makeup_attendance_id:
        makeupAttendanceId,

      status:
        'ACTIVE',

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
    // Attendance
    //
    // DB Trigger 會再次確認：
    //
    // used_sessions < total_sessions
    //
    // 並 Lock Package。
    // ========================================================

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
          ${makeupAttendanceId},

          ${normalizedStudentId},

          ${source.package_id},

          ${targetSession.id},

          'ATTENDED',

          'MAKEUP',

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

    // ========================================================
    // Makeup
    // ========================================================

    const makeupQuery =
      sql`
        INSERT INTO
          makeup_records (
            id,

            student_id,

            course_id,

            package_id,

            source_leave_attendance_id,

            source_session_id,

            makeup_session_id,

            makeup_attendance_id,

            status,

            note,

            created_by,

            linked_attendance_synced_at,

            cancelled_at,

            cancelled_by,

            cancellation_reason,

            restored_at,

            restored_by,

            created_at,

            updated_at
          )

        VALUES (
          ${makeupId},

          ${normalizedStudentId},

          ${source.course_id},

          ${source.package_id},

          ${normalizedSourceId},

          ${source.session_id},

          ${targetSession.id},

          ${makeupAttendanceId},

          'ACTIVE',

          ${normalizedNote},

          ${normalizedActorId},

          NOW(),

          NULL,

          NULL,

          NULL,

          NULL,

          NULL,

          NOW(),

          NOW()
        )

        RETURNING
          *
      `

    // ========================================================
    // Audit
    // ========================================================

    const auditQuery =
      createAuditQuery(
        sql,
        {
          actorUserId:
            normalizedActorId,

          actorRole:
            normalizedRole,

          action:
            'CREATE',

          entityType:
            'MAKEUP',

          entityId:
            makeupId,

          studentId:
            normalizedStudentId,

          courseId:
            source.course_id,

          beforeData:
            null,

          afterData,

          note:
            `${student.name}｜${source.course_name}｜${String(source.class_date).slice(0, 10)} 請假 → ${String(targetSession.class_date).slice(0, 10)} 補課`,

          ...auditMetadata,
        }
      )

    // ========================================================
    // Package recalculation
    // ========================================================

    const packageQuery =
      createPackageStateRecalculationQuery(
        sql,
        source.package_id
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
      const message =
        String(
          error?.message ||
          ''
        )

      if (
        message.includes(
          'PACKAGE_SESSION_LIMIT_REACHED'
        )
      ) {
        throw createError({
          statusCode: 409,

          statusMessage:
            '此方案堂數已全部使用完畢，不能再建立補課',
        })
      }

      if (
        error?.code ===
        '23505'
      ) {
        throw createError({
          statusCode: 409,

          statusMessage:
            '這筆請假或補課日期已存在補課紀錄，請重新整理',
        })
      }

      throw error
    }

    return {
      attendance:
        results[0]?.[0] ||
        null,

      makeup:
        results[1]?.[0] ||
        null,

      package:
        results[3]?.[0] ||
        null,

      source,

      targetSession,
    }
  }