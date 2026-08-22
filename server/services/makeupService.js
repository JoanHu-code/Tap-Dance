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
          id,
          name,
          status,
          user_id

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
// Source Leave Attendance
// ============================================================

const requireSourceLeave =
  async (
    sql,
    studentId,
    attendanceId
  ) => {
    assertUuid(
      attendanceId,
      '請假 Attendance ID'
    )

    const records =
      await sql`
        SELECT
          attendance.*,

          session.schedule_id
            AS source_schedule_id,

          session.class_date
            AS source_class_date,

          session.start_time
            AS source_start_time,

          schedule.course_id,

          schedule.name
            AS source_schedule_name,

          course.name
            AS course_name,

          package.cycle_no
            AS package_cycle_no,

          package.total_sessions,

          package.status
            AS package_status,

          EXISTS (
            SELECT
              1

            FROM
              leave_batch_items item

            INNER JOIN
              leave_batches batch

              ON batch.id =
                item.batch_id

            WHERE
              item.attendance_id =
                attendance.id

              AND
                batch.status =
                  'ACTIVE'
          )
            AS has_active_leave_batch

        FROM
          attendance_records_v2 attendance

        INNER JOIN
          class_sessions session

          ON session.id =
            attendance.session_id

        INNER JOIN
          class_schedules schedule

          ON schedule.id =
            session.schedule_id

        INNER JOIN
          dance_courses course

          ON course.id =
            schedule.course_id

        LEFT JOIN
          student_packages package

          ON package.id =
            attendance.package_id

        WHERE
          attendance.id =
            ${attendanceId}

          AND
            attendance.student_id =
              ${studentId}

        LIMIT 1
      `

    if (
      !records.length
    ) {
      throw createError({
        statusCode: 404,

        statusMessage:
          '找不到這筆請假紀錄',
      })
    }

    const record =
      records[0]

    if (
      record.status !==
      'LEAVE'
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '只有目前狀態為 LEAVE 的紀錄可以建立補課',
      })
    }

    if (
      !record.package_id
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '這筆請假沒有綁定 Package，不能建立補課',
      })
    }

    return record
  }

// ============================================================
// Makeup Session
// ============================================================

const requireMakeupSession =
  async (
    sql,
    sessionId
  ) => {
    assertUuid(
      sessionId,
      '補課 Session ID'
    )

    const sessions =
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

          schedule.capacity,

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
      !sessions.length
    ) {
      throw createError({
        statusCode: 404,

        statusMessage:
          '找不到補課 Session',
      })
    }

    const session =
      sessions[0]

    if (
      session.status !==
      'SCHEDULED'
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '補課只能選擇目前為 SCHEDULED 的課堂',
      })
    }

    return session
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
    const records =
      await sql`
        SELECT
          id

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
      !records.length
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '學生目前沒有加入這門課程',
      })
    }

    return records[0]
  }

// ============================================================
// Existing Makeup
// ============================================================

const assertNoActiveMakeup =
  async (
    sql,
    studentId,
    sourceLeaveAttendanceId,
    makeupSessionId
  ) => {
    const records =
      await sql`
        SELECT
          id

        FROM
          makeup_records

        WHERE
          status =
            'ACTIVE'

          AND (
            source_leave_attendance_id =
              ${sourceLeaveAttendanceId}

            OR (
              student_id =
                ${studentId}

              AND
                makeup_session_id =
                  ${makeupSessionId}
            )
          )

        LIMIT 1
      `

    if (
      records.length
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '這筆請假或這堂補課已經存在有效的 Makeup 紀錄',
      })
    }
  }

// ============================================================
// Existing Attendance On Makeup Session
// ============================================================

const assertNoAttendanceOnMakeupSession =
  async (
    sql,
    studentId,
    makeupSessionId
  ) => {
    const records =
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
              ${makeupSessionId}

        LIMIT 1
      `

    if (
      records.length
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '學生在這堂補課 Session 已經有 Attendance 紀錄',
      })
    }
  }

// ============================================================
// Package Capacity
//
// Makeup = ATTENDED
// 所以一定會扣堂。
// ============================================================

const assertPackageCapacity =
  async (
    sql,
    packageId
  ) => {
    const records =
      await sql`
        SELECT
          package.id,

          package.total_sessions,

          package.status,

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
            ${packageId}

        GROUP BY
          package.id

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

    const packageData =
      records[0]

    const total =
      Number(
        packageData
          .total_sessions ||
        0
      )

    const attended =
      Number(
        packageData
          .attended_count ||
        0
      )

    if (
      total <= 0
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          'Package 堂數設定不正確',
      })
    }

    if (
      attended >=
      total
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          `此期 Package 已完成 ${attended}/${total} 堂，不能再加入補課`,
      })
    }

    return packageData
  }

// ============================================================
// Create Makeup
// ============================================================

export const createMakeup =
  async ({
    studentId,
    sourceLeaveAttendanceId,
    makeupSessionId,
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
      normalizeActorRole(
        actorRole
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
        studentId
      )

    const sourceLeave =
      await requireSourceLeave(
        sql,
        studentId,
        sourceLeaveAttendanceId
      )

    const makeupSession =
      await requireMakeupSession(
        sql,
        makeupSessionId
      )

    // ========================================================
    // 不能補原本自己那堂
    // ========================================================

    if (
      String(
        sourceLeave.session_id
      ) ===
      String(
        makeupSession.id
      )
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '補課 Session 不能和原本請假的 Session 相同',
      })
    }

    // ========================================================
    // 必須同 Course
    // ========================================================

    if (
      String(
        sourceLeave.course_id
      ) !==
      String(
        makeupSession.course_id
      )
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          `只能補同一門課程。原請假為「${sourceLeave.course_name}」，不能補到「${makeupSession.course_name}」`,
      })
    }

    await requireEnrollment(
      sql,
      studentId,
      sourceLeave.course_id
    )

    await assertNoActiveMakeup(
      sql,
      studentId,
      sourceLeaveAttendanceId,
      makeupSessionId
    )

    await assertNoAttendanceOnMakeupSession(
      sql,
      studentId,
      makeupSessionId
    )

    const packageData =
      await assertPackageCapacity(
        sql,
        sourceLeave.package_id
      )

    // ========================================================
    // IDs
    // ========================================================

    const makeupId =
      randomUUID()

    const makeupAttendanceId =
      randomUUID()

    // ========================================================
    // Attendance Snapshot
    // ========================================================

    const attendanceAfter = {
      id:
        makeupAttendanceId,

      student_id:
        studentId,

      package_id:
        sourceLeave.package_id,

      session_id:
        makeupSession.id,

      status:
        'ATTENDED',

      attendance_type:
        'MAKEUP',

      note:
        normalizedNote,
    }

    // ========================================================
    // Makeup Snapshot
    // ========================================================

    const makeupAfter = {
      id:
        makeupId,

      student_id:
        studentId,

      student_name:
        student.name,

      course_id:
        sourceLeave.course_id,

      course_name:
        sourceLeave.course_name,

      package_id:
        sourceLeave.package_id,

      package_cycle_no:
        sourceLeave.package_cycle_no,

      source_leave_attendance_id:
        sourceLeaveAttendanceId,

      source_session_id:
        sourceLeave.session_id,

      source_class_date:
        sourceLeave.source_class_date,

      makeup_session_id:
        makeupSession.id,

      makeup_class_date:
        makeupSession.class_date,

      makeup_attendance_id:
        makeupAttendanceId,

      status:
        'ACTIVE',

      note:
        normalizedNote,
    }

    const queries = [
      // ======================================================
      // Makeup Attendance
      // ======================================================

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
          ${studentId},
          ${sourceLeave.package_id},
          ${makeupSession.id},
          'ATTENDED',
          'MAKEUP',
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

      // ======================================================
      // Makeup Record
      // ======================================================

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
            cancelled_at,
            created_at,
            updated_at
          )

        VALUES (
          ${makeupId},
          ${studentId},
          ${sourceLeave.course_id},
          ${sourceLeave.package_id},
          ${sourceLeaveAttendanceId},
          ${sourceLeave.session_id},
          ${makeupSession.id},
          ${makeupAttendanceId},
          'ACTIVE',
          ${normalizedNote},
          ${actorUserId},
          NULL,
          NOW(),
          NOW()
        )

        RETURNING
          *
      `,

      // ======================================================
      // Attendance Audit
      // ======================================================

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
            makeupAttendanceId,

          studentId,

          courseId:
            sourceLeave.course_id,

          sessionId:
            makeupSession.id,

          beforeData:
            null,

          afterData:
            attendanceAfter,

          note:
            `建立補課 Attendance：${sourceLeave.course_name}`,

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
            normalizedRole,

          action:
            'CREATE',

          entityType:
            'MAKEUP',

          entityId:
            makeupId,

          studentId,

          courseId:
            sourceLeave.course_id,

          sessionId:
            makeupSession.id,

          beforeData:
            null,

          afterData:
            makeupAfter,

          note:
            `建立補課：${String(sourceLeave.source_class_date).slice(0, 10)} → ${String(makeupSession.class_date).slice(0, 10)}`,

          ...auditMetadata,
        }
      ),
    ]

    const results =
      await runTransaction(
        sql,
        queries
      )

    // ========================================================
    // Makeup Attendance = ATTENDED
    //
    // 所以補課建立後，要重新計算原 Package。
    // ========================================================

    const recalculatedPackage =
      await recalculatePackage(
        sql,
        sourceLeave.package_id
      )

    return {
      makeup:
        results[1]?.[0] ||
        null,

      attendance:
        results[0]?.[0] ||
        null,

      package:
        recalculatedPackage,

      sourceLeave,

      makeupSession,
    }
  }

// ============================================================
// Teacher Makeup Page Data
// ============================================================

export const getTeacherMakeups =
  async ({
    studentId = null,
    courseId = null,
    status = null,
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
          'Makeup status 不正確',
      })
    }

    // ========================================================
    // Makeup Records
    // ========================================================

    const makeups =
      await sql`
        SELECT
          makeup.*,

          student.name
            AS student_name,

          course.name
            AS course_name,

          package.cycle_no
            AS package_cycle_no,

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

          makeup_schedule.name
            AS makeup_schedule_name,

          makeup_attendance.status
            AS makeup_attendance_status,

          creator.role
            AS created_by_role,

          creator.display_name
            AS created_by_name

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

        LEFT JOIN
          app_users creator

          ON creator.id =
            makeup.created_by

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

        ORDER BY
          makeup.created_at DESC
      `

    // ========================================================
    // Students
    // ========================================================

    const students =
      await sql`
        SELECT
          id,
          name

        FROM
          students

        WHERE
          status =
            'ACTIVE'

        ORDER BY
          name ASC
      `

    // ========================================================
    // Courses
    // ========================================================

    const courses =
      await sql`
        SELECT
          id,
          name

        FROM
          dance_courses

        WHERE
          status =
            'ACTIVE'

        ORDER BY
          name ASC
      `

    // ========================================================
    // 可作為補課來源的 LEAVE
    // ========================================================

    const leaves =
      await sql`
        SELECT
          attendance.id
            AS attendance_id,

          attendance.student_id,

          student.name
            AS student_name,

          attendance.package_id,

          package.cycle_no
            AS package_cycle_no,

          session.id
            AS session_id,

          session.class_date,

          session.start_time,

          schedule.id
            AS schedule_id,

          schedule.course_id,

          schedule.name
            AS schedule_name,

          course.name
            AS course_name

        FROM
          attendance_records_v2 attendance

        INNER JOIN
          students student

          ON student.id =
            attendance.student_id

        INNER JOIN
          class_sessions session

          ON session.id =
            attendance.session_id

        INNER JOIN
          class_schedules schedule

          ON schedule.id =
            session.schedule_id

        INNER JOIN
          dance_courses course

          ON course.id =
            schedule.course_id

        LEFT JOIN
          student_packages package

          ON package.id =
            attendance.package_id

        WHERE
          attendance.status =
            'LEAVE'

          AND
            attendance.package_id
              IS NOT NULL

          AND NOT EXISTS (
            SELECT
              1

            FROM
              makeup_records existing_makeup

            WHERE
              existing_makeup.source_leave_attendance_id =
                attendance.id

              AND
                existing_makeup.status =
                  'ACTIVE'
          )

        ORDER BY
          session.class_date DESC,
          student.name ASC
      `

    // ========================================================
    // 可補課 Session
    //
    // Service 實際建立時仍會再次檢查同 Course。
    // ========================================================

    const sessions =
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
          session.status =
            'SCHEDULED'

          AND
            session.class_date >=
              CURRENT_DATE -
              INTERVAL '30 days'

          AND
            session.class_date <=
              CURRENT_DATE +
              INTERVAL '365 days'

        ORDER BY
          session.class_date ASC,
          session.start_time ASC
      `

    return {
      makeups,
      students,
      courses,
      leaves,
      sessions,
    }
  }

// ============================================================
// Student Makeup Page Data
// ============================================================

export const getStudentMakeupData =
  async (
    studentId
  ) => {
    assertUuid(
      studentId,
      '學生 ID'
    )

    const sql =
      useDatabase()

    await requireStudent(
      sql,
      studentId
    )

    // ========================================================
    // Existing Makeups
    // ========================================================

    const makeups =
      await sql`
        SELECT
          makeup.*,

          course.name
            AS course_name,

          package.cycle_no
            AS package_cycle_no,

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

          makeup_schedule.name
            AS makeup_schedule_name,

          attendance.status
            AS makeup_attendance_status

        FROM
          makeup_records makeup

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
          attendance_records_v2 attendance

          ON attendance.id =
            makeup.makeup_attendance_id

        WHERE
          makeup.student_id =
            ${studentId}

        ORDER BY
          makeup.created_at DESC
      `

    // ========================================================
    // Eligible Leaves
    // ========================================================

    const leaves =
      await sql`
        SELECT
          attendance.id
            AS attendance_id,

          attendance.package_id,

          package.cycle_no
            AS package_cycle_no,

          session.id
            AS session_id,

          session.class_date,

          session.start_time,

          schedule.course_id,

          schedule.name
            AS schedule_name,

          course.name
            AS course_name

        FROM
          attendance_records_v2 attendance

        INNER JOIN
          class_sessions session

          ON session.id =
            attendance.session_id

        INNER JOIN
          class_schedules schedule

          ON schedule.id =
            session.schedule_id

        INNER JOIN
          dance_courses course

          ON course.id =
            schedule.course_id

        LEFT JOIN
          student_packages package

          ON package.id =
            attendance.package_id

        WHERE
          attendance.student_id =
            ${studentId}

          AND
            attendance.status =
              'LEAVE'

          AND
            attendance.package_id
              IS NOT NULL

          AND NOT EXISTS (
            SELECT
              1

            FROM
              makeup_records makeup

            WHERE
              makeup.source_leave_attendance_id =
                attendance.id

              AND
                makeup.status =
                  'ACTIVE'
          )

        ORDER BY
          session.class_date DESC
      `

    // ========================================================
    // Candidate Makeup Sessions
    //
    // 只限學生有 ACTIVE Enrollment 的 Course。
    // ========================================================

    const sessions =
      await sql`
        SELECT
          session.id,

          session.schedule_id,

          session.class_date,

          session.start_time,

          session.end_time,

          schedule.course_id,

          schedule.weekday,

          schedule.name
            AS schedule_name,

          course.name
            AS course_name,

          EXISTS (
            SELECT
              1

            FROM
              student_enrollment_schedules
                enrollment_schedule

            INNER JOIN
              student_enrollments enrollment

              ON enrollment.id =
                enrollment_schedule.enrollment_id

            WHERE
              enrollment.student_id =
                ${studentId}

              AND
                enrollment.course_id =
                  schedule.course_id

              AND
                enrollment_schedule.schedule_id =
                  schedule.id

              AND
                enrollment.status =
                  'ACTIVE'

              AND
                enrollment_schedule.status =
                  'ACTIVE'
          )
            AS is_fixed_schedule

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
          session.status =
            'SCHEDULED'

          AND
            session.class_date >=
              CURRENT_DATE -
              INTERVAL '30 days'

          AND
            session.class_date <=
              CURRENT_DATE +
              INTERVAL '365 days'

          AND EXISTS (
            SELECT
              1

            FROM
              student_enrollments enrollment

            WHERE
              enrollment.student_id =
                ${studentId}

              AND
                enrollment.course_id =
                  schedule.course_id

              AND
                enrollment.status =
                  'ACTIVE'
          )

          AND NOT EXISTS (
            SELECT
              1

            FROM
              attendance_records_v2 existing_attendance

            WHERE
              existing_attendance.student_id =
                ${studentId}

              AND
                existing_attendance.session_id =
                  session.id
          )

        ORDER BY
          session.class_date ASC,
          session.start_time ASC
      `

    return {
      makeups,
      leaves,
      sessions,
    }
  }