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
  findCourseSession,
  getAttendanceCourses,
  getCourseSessionCourse,
  isCourseClassDate,
} from './courseSessionService.js'

// ============================================================
// UUID
// ============================================================

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const assertUuid = (
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

  return normalized
}

// ============================================================
// Status
// ============================================================

const ATTENDANCE_STATUSES = [
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
    !ATTENDANCE_STATUSES.includes(
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

const requireStudent =
  async (
    sql,
    studentId
  ) => {
    const rows =
      await sql`
        SELECT
          id,
          name,
          user_id,
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
          '找不到學生',
      })
    }

    return rows[0]
  }

// ============================================================
// Get Eligible Package
// ============================================================

const getEligibleActivePackage =
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

          COALESCE(
            (
              SELECT
                COUNT(*)::INTEGER

              FROM
                attendance_records_v2 used_attendance

              WHERE
                used_attendance.package_id =
                  package.id

                AND
                  used_attendance.status =
                    'ATTENDED'
            ),
            0
          )
            AS used_sessions

        FROM
          student_packages package

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

    return (
      rows[0] ||
      null
    )
  }

// ============================================================
// Get Existing Attendance
// ============================================================

const getExistingAttendance =
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

          attendance.updated_at

        FROM
          attendance_records_v2 attendance

        WHERE
          attendance.student_id =
            ${studentId}

          AND
            attendance.session_id =
              ${sessionId}

        LIMIT 1
      `

    return (
      rows[0] ||
      null
    )
  }

// ============================================================
// Course List
// ============================================================

export const getTeacherAttendanceCourses =
  async () => {
    return await getAttendanceCourses()
  }

// ============================================================
// Get Roster
// ============================================================

export const getTeacherAttendanceRoster =
  async ({
    courseId,
    classDate,
  }) => {
    const normalizedCourseId =
      assertUuid(
        courseId,
        'Course ID'
      )

    const normalizedDate =
      normalizeDate(
        classDate
      )

    const sql =
      useDatabase()

    const course =
      await getCourseSessionCourse(
        normalizedCourseId
      )

    const isClassDay =
      isCourseClassDate(
        course,
        normalizedDate
      )

    // ========================================================
    // Session
    //
    // GET 不主動建立 Session。
    // 真正第一次修改 Attendance 時才建立。
    // ========================================================

    const session =
      await findCourseSession({
        courseId:
          normalizedCourseId,

        classDate:
          normalizedDate,
      })

    // ========================================================
    // Active Package Students
    // ========================================================

    const eligibleStudents =
      await sql`
        SELECT
          student.id
            AS student_id,

          student.name
            AS student_name,

          student.user_id,

          package.id
            AS package_id,

          package.start_date,

          package.cycle_no,

          package.purchased_cycles,

          package.sessions_per_cycle,

          package.total_sessions,

          package.price_per_cycle,

          package.price,

          package.paid,

          package.status
            AS package_status,

          COALESCE(
            (
              SELECT
                COUNT(*)::INTEGER

              FROM
                attendance_records_v2 used_attendance

              WHERE
                used_attendance.package_id =
                  package.id

                AND
                  used_attendance.status =
                    'ATTENDED'
            ),
            0
          )
            AS used_sessions

        FROM
          student_packages package

        INNER JOIN
          students student

          ON student.id =
            package.student_id

        WHERE
          package.course_id =
            ${normalizedCourseId}

          AND
            package.status =
              'ACTIVE'

          AND
            package.start_date <=
              ${normalizedDate}

          AND
            student.status =
              'ACTIVE'

        ORDER BY
          student.name ASC
      `

    // ========================================================
    // Existing Attendance
    //
    // 即使 Package 已 COMPLETED，
    // 歷史紀錄也必須出現在名單供老師修改。
    // ========================================================

    let existingAttendances =
      []

    if (
      session
    ) {
      existingAttendances =
        await sql`
          SELECT
            attendance.id
              AS attendance_id,

            attendance.student_id,

            attendance.package_id,

            attendance.status
              AS attendance_status,

            attendance.attendance_type,

            attendance.note
              AS attendance_note,

            attendance.created_at
              AS attendance_created_at,

            attendance.updated_at
              AS attendance_updated_at,

            student.name
              AS student_name,

            student.user_id,

            package.start_date,

            package.cycle_no,

            package.purchased_cycles,

            package.sessions_per_cycle,

            package.total_sessions,

            package.price_per_cycle,

            package.price,

            package.paid,

            package.status
              AS package_status,

            COALESCE(
              (
                SELECT
                  COUNT(*)::INTEGER

                FROM
                  attendance_records_v2 used_attendance

                WHERE
                  used_attendance.package_id =
                    package.id

                  AND
                    used_attendance.status =
                      'ATTENDED'
              ),
              0
            )
              AS used_sessions

          FROM
            attendance_records_v2 attendance

          INNER JOIN
            students student

            ON student.id =
              attendance.student_id

          LEFT JOIN
            student_packages package

            ON package.id =
              attendance.package_id

          WHERE
            attendance.session_id =
              ${session.id}

          ORDER BY
            student.name ASC
        `
    }

    // ========================================================
    // Merge
    // ========================================================

    const studentMap =
      new Map()

    for (
      const row of
      eligibleStudents
    ) {
      const usedSessions =
        Number(
          row.used_sessions ||
          0
        )

      const totalSessions =
        Number(
          row.total_sessions ||
          0
        )

      studentMap.set(
        String(
          row.student_id
        ),
        {
          student_id:
            row.student_id,

          student_name:
            row.student_name,

          user_id:
            row.user_id,

          package_id:
            row.package_id,

          package_status:
            row.package_status,

          start_date:
            row.start_date,

          cycle_no:
            row.cycle_no,

          purchased_cycles:
            row.purchased_cycles,

          sessions_per_cycle:
            row.sessions_per_cycle,

          total_sessions:
            totalSessions,

          price_per_cycle:
            row.price_per_cycle,

          price:
            row.price,

          paid:
            row.paid,

          used_sessions:
            usedSessions,

          remaining_sessions:
            Math.max(
              totalSessions -
              usedSessions,
              0
            ),

          attendance_id:
            null,

          attendance_status:
            null,

          attendance_type:
            null,

          attendance_note:
            null,

          has_existing_attendance:
            false,
        }
      )
    }

    // ========================================================
    // Existing Attendance wins
    // ========================================================

    for (
      const row of
      existingAttendances
    ) {
      const key =
        String(
          row.student_id
        )

      const usedSessions =
        Number(
          row.used_sessions ||
          0
        )

      const totalSessions =
        Number(
          row.total_sessions ||
          0
        )

      const existing =
        studentMap.get(
          key
        )

      studentMap.set(
        key,
        {
          ...(existing || {}),

          student_id:
            row.student_id,

          student_name:
            row.student_name,

          user_id:
            row.user_id,

          package_id:
            row.package_id,

          package_status:
            row.package_status,

          start_date:
            row.start_date,

          cycle_no:
            row.cycle_no,

          purchased_cycles:
            row.purchased_cycles,

          sessions_per_cycle:
            row.sessions_per_cycle,

          total_sessions:
            totalSessions,

          price_per_cycle:
            row.price_per_cycle,

          price:
            row.price,

          paid:
            row.paid,

          used_sessions:
            usedSessions,

          remaining_sessions:
            Math.max(
              totalSessions -
              usedSessions,
              0
            ),

          attendance_id:
            row.attendance_id,

          attendance_status:
            row.attendance_status,

          attendance_type:
            row.attendance_type,

          attendance_note:
            row.attendance_note,

          has_existing_attendance:
            true,
        }
      )
    }

    const students =
      [...studentMap.values()]
        .sort(
          (
            a,
            b
          ) => {
            return String(
              a.student_name ||
              ''
            ).localeCompare(
              String(
                b.student_name ||
                ''
              ),
              'zh-TW'
            )
          }
        )

    return {
      course,

      classDate:
        normalizedDate,

      isClassDay,

      session,

      students,
    }
  }

// ============================================================
// Set Teacher Attendance
// ============================================================

export const setTeacherAttendance =
  async ({
    courseId,
    classDate,
    studentId,
    status,
    note = null,
    actorUserId,
    event = null,
  }) => {
    const normalizedCourseId =
      assertUuid(
        courseId,
        'Course ID'
      )

    const normalizedStudentId =
      assertUuid(
        studentId,
        'Student ID'
      )

    const normalizedActorId =
      assertUuid(
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
    // Ensure Session
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

    // ========================================================
    // Teacher Leave / Cancelled Session
    // ========================================================

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
          session.status ===
            'TEACHER_LEAVE'
            ? '這堂課老師請假，不能登記學生出席'
            : '這堂課已取消，不能登記學生出席',
      })
    }

    // ========================================================
    // Existing Attendance
    // ========================================================

    const existingAttendance =
      await getExistingAttendance(
        sql,
        {
          studentId:
            normalizedStudentId,

          sessionId:
            session.id,
        }
      )

    let packageData =
      null

    // ========================================================
    // Existing record keeps its original package.
    // ========================================================

    if (
      existingAttendance
        ?.package_id
    ) {
      const packageRows =
        await sql`
          SELECT
            id,
            student_id,
            course_id,
            start_date,
            total_sessions,
            status

          FROM
            student_packages

          WHERE
            id =
              ${existingAttendance.package_id}

          LIMIT 1
        `

      packageData =
        packageRows[0] ||
        null
    }

    // ========================================================
    // New Attendance:
    // find current ACTIVE Package.
    // ========================================================

    if (
      !packageData
    ) {
      packageData =
        await getEligibleActivePackage(
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
    }

    if (
      !packageData
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          `${student.name} 在這個日期沒有可使用的「${course.name}」方案`,
      })
    }

    // ========================================================
    // New CANCELLED makes no sense.
    // ========================================================

    if (
      !existingAttendance &&
      normalizedStatus ===
        'CANCELLED'
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '目前沒有出席紀錄可以取消',
      })
    }

    // ========================================================
    // Before adding ATTENDED:
    //
    // 如果是新紀錄，Package 已經滿堂，
    // 不再允許多扣一堂。
    //
    // Existing Attendance 修改時由 recalculation 處理。
    // ========================================================

    if (
      !existingAttendance &&
      normalizedStatus ===
        'ATTENDED'
    ) {
      const usageRows =
        await sql`
          SELECT
            COUNT(*)::INTEGER
              AS used_sessions

          FROM
            attendance_records_v2

          WHERE
            package_id =
              ${packageData.id}

            AND
              status =
                'ATTENDED'
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
            `${student.name} 的「${course.name}」方案堂數已經用完`,
        })
      }
    }

    const attendanceId =
      existingAttendance
        ?.id ||
      randomUUID()

    // ========================================================
    // Preserve MAKEUP type
    //
    // 如果這筆本來是補課，
    // 老師修改狀態時不能把 MAKEUP 改回 NORMAL。
    // ========================================================

    const attendanceType =
      existingAttendance
        ?.attendance_type ||
      'NORMAL'

    const beforeData =
      existingAttendance
        ? {
            id:
              existingAttendance.id,

            package_id:
              existingAttendance.package_id,

            session_id:
              existingAttendance.session_id,

            student_id:
              existingAttendance.student_id,

            status:
              existingAttendance.status,

            attendance_type:
              existingAttendance.attendance_type,

            note:
              existingAttendance.note,
          }
        : null

    const afterData = {
      id:
        attendanceId,

      package_id:
        packageData.id,

      session_id:
        session.id,

      student_id:
        normalizedStudentId,

      status:
        normalizedStatus,

      attendance_type:
        attendanceType,

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
    // Query
    // ========================================================

    let attendanceQuery

    if (
      existingAttendance
    ) {
      attendanceQuery =
        sql`
          UPDATE
            attendance_records_v2

          SET
            status =
              ${normalizedStatus},

            note =
              ${normalizedNote},

            cancelled_at =
              CASE
                WHEN
                  ${normalizedStatus} =
                    'CANCELLED'

                THEN
                  NOW()

                ELSE
                  NULL
              END,

            updated_at =
              NOW()

          WHERE
            id =
              ${existingAttendance.id}

          RETURNING
            *
        `
    } else {
      attendanceQuery =
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
    }

    const auditQuery =
      createAuditQuery(
        sql,
        {
          actorUserId:
            normalizedActorId,

          actorRole:
            'TEACHER',

          action:
            existingAttendance
              ? 'UPDATE'
              : 'CREATE',

          entityType:
            'ATTENDANCE',

          entityId:
            attendanceId,

          studentId:
            normalizedStudentId,

          courseId:
            normalizedCourseId,

          beforeData,

          afterData,

          note:
            `${student.name}｜${course.name}｜${normalizedDate}｜${normalizedStatus}`,

          ...auditMetadata,
        }
      )

    const packageQuery =
      createPackageStateRecalculationQuery(
        sql,
        packageData.id
      )

    // ========================================================
    // Transaction
    // ========================================================

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
        packageQuery,
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