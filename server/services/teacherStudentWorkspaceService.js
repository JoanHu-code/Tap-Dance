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
  value,
  fieldName = '日期'
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
        `${fieldName}格式必須為 YYYY-MM-DD`,
    })
  }

  return normalized
}

// ============================================================
// Purchased Cycles
// ============================================================

const normalizePurchasedCycles = (
  value
) => {
  const parsed =
    Number.parseInt(
      String(
        value
      ),
      10
    )

  if (
    !Number.isInteger(
      parsed
    ) ||
    parsed <= 0 ||
    parsed > 100
  ) {
    throw createError({
      statusCode: 400,

      statusMessage:
        '購買期數必須是大於 0 的整數',
    })
  }

  return parsed
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
          '找不到學生',
      })
    }

    return rows[0]
  }

// ============================================================
// Require Course
// ============================================================

const requireCourse =
  async (
    sql,
    courseId
  ) => {
    const normalizedCourseId =
      normalizeUuid(
        courseId,
        'Course ID'
      )

    const rows =
      await sql`
        SELECT
          id,
          name,
          description,
          weekday,
          start_time,
          end_time,
          sessions_per_cycle,
          price_per_cycle,
          status

        FROM
          dance_courses

        WHERE
          id =
            ${normalizedCourseId}

        LIMIT 1
      `

    if (
      !rows.length
    ) {
      throw createError({
        statusCode: 404,

        statusMessage:
          '找不到課堂',
      })
    }

    return rows[0]
  }

// ============================================================
// Get Package Usage
// ============================================================

const getPackageUsage =
  async (
    sql,
    packageId
  ) => {
    const rows =
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
      `

    return Number(
      rows[0]?.used_sessions ||
      0
    )
  }

// ============================================================
// Get Active Package For Course Name
//
// Package 可能綁：
//
// 星期六 12:00 踢踏舞
//
// 學生今天卻來：
//
// 星期一 19:00 踢踏舞
//
// 只要 course.name 相同，
// 就使用同一個 Package。
// ============================================================

const getActivePackageForCourse =
  async (
    sql,
    {
      studentId,
      course,
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

          package.previous_package_id,

          package.purchased_cycles,

          package.sessions_per_cycle,

          package.total_sessions,

          package.price_per_cycle,

          package.price,

          package.status,

          package.paid,

          package.paid_at,

          package.completed_at,

          package.completion_reason,

          package.created_at,

          package.updated_at,

          primary_course.name
            AS course_name

        FROM
          student_packages package

        INNER JOIN
          dance_courses primary_course

          ON primary_course.id =
            package.course_id

        WHERE
          package.student_id =
            ${studentId}

          AND
            package.status =
              'ACTIVE'

          AND
            LOWER(
              primary_course.name
            ) =
            LOWER(
              ${course.name}
            )

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
// Teacher Dashboard
//
// 不再回：
//
// 今日課堂
// 待補課
// 最近請假
// 下一堂課
// 統計卡片
//
// 就只有學生。
// ============================================================

export const getTeacherStudentDashboard =
  async () => {
    const sql =
      useDatabase()

    const rows =
      await sql`
        SELECT
          student.id,

          student.user_id,

          student.name,

          student.note,

          student.status,

          student.created_at,

          student.updated_at,

          COALESCE(
            (
              SELECT
                JSON_AGG(
                  package_item
                  ORDER BY
                    package_item.course_name
                )

              FROM (
                SELECT
                  package.id,

                  course.name
                    AS course_name,

                  package.start_date,

                  package.purchased_cycles,

                  package.total_sessions,

                  package.price,

                  package.paid,

                  package.status,

                  COALESCE(
                    (
                      SELECT
                        COUNT(*)::INTEGER

                      FROM
                        attendance_records_v2 attendance

                      WHERE
                        attendance.package_id =
                          package.id

                        AND
                          attendance.status =
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
                    student.id

                  AND
                    package.status =
                      'ACTIVE'
              )
                package_item
            ),
            '[]'::json
          )
            AS active_packages

        FROM
          students student

        WHERE
          student.status =
            'ACTIVE'

        ORDER BY
          student.name ASC
      `

    return rows.map(
      (
        student
      ) => {
        const packages =
          Array.isArray(
            student.active_packages
          )
            ? student.active_packages
            : []

        return {
          ...student,

          active_packages:
            packages.map(
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
            ),
        }
      }
    )
  }

// ============================================================
// Student Workspace
// ============================================================

export const getTeacherStudentWorkspace =
  async (
    studentId
  ) => {
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
    // All active class slots
    // ========================================================

    const courses =
      await sql`
        SELECT
          id,
          name,
          weekday,
          start_time,
          end_time,
          sessions_per_cycle,
          price_per_cycle,
          status

        FROM
          dance_courses

        WHERE
          status =
            'ACTIVE'

        ORDER BY
          LOWER(name),
          weekday,
          start_time
      `

    // ========================================================
    // Packages
    // ========================================================

    const packages =
      await sql`
        SELECT
          package.id,

          package.student_id,

          package.course_id,

          package.start_date,

          package.cycle_no,

          package.previous_package_id,

          package.purchased_cycles,

          package.sessions_per_cycle,

          package.total_sessions,

          package.price_per_cycle,

          package.price,

          package.status,

          package.paid,

          package.paid_at,

          package.completed_at,

          package.completion_reason,

          package.created_at,

          package.updated_at,

          course.name
            AS course_name,

          course.weekday
            AS primary_weekday,

          course.start_time
            AS primary_start_time,

          course.end_time
            AS primary_end_time,

          COALESCE(
            (
              SELECT
                COUNT(*)::INTEGER

              FROM
                attendance_records_v2 attendance

              WHERE
                attendance.package_id =
                  package.id

                AND
                  attendance.status =
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

        ORDER BY
          CASE
            WHEN
              package.status =
                'ACTIVE'
            THEN
              0

            ELSE
              1
          END,

          package.created_at DESC
      `

    const mappedPackages =
      packages.map(
        (
          packageData
        ) => {
          const used =
            Number(
              packageData.used_sessions ||
              0
            )

          const total =
            Number(
              packageData.total_sessions ||
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

            completed:
              used >=
              total,
          }
        }
      )

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
            AS actual_course_id,

          actual_course.name
            AS actual_course_name

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
          dance_courses actual_course

          ON actual_course.id =
            COALESCE(
              session.course_id,
              schedule.course_id
            )

        WHERE
          attendance.student_id =
            ${normalizedStudentId}

        ORDER BY
          session.class_date DESC,
          session.start_time DESC,
          attendance.created_at DESC
      `

    return {
      student,

      courses,

      packages:
        mappedPackages,

      attendance,
    }
  }

// ============================================================
// Create Package
//
// 老師替學生建立第一次方案。
// ============================================================

export const createSimpleStudentPackage =
  async ({
    studentId,

    courseId,

    startDate,

    purchasedCycles,

    paid = true,

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

    const normalizedStartDate =
      normalizeDate(
        startDate,
        '開始日期'
      )

    const cycles =
      normalizePurchasedCycles(
        purchasedCycles
      )

    const sql =
      useDatabase()

    const student =
      await requireStudent(
        sql,
        normalizedStudentId
      )

    const course =
      await requireCourse(
        sql,
        normalizedCourseId
      )

    if (
      course.status !==
      'ACTIVE'
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '這個課堂目前已停用',
      })
    }

    // ========================================================
    // Same-name active Package
    // ========================================================

    const activeSameCourse =
      await sql`
        SELECT
          package.id

        FROM
          student_packages package

        INNER JOIN
          dance_courses package_course

          ON package_course.id =
            package.course_id

        WHERE
          package.student_id =
            ${normalizedStudentId}

          AND
            package.status =
              'ACTIVE'

          AND
            LOWER(
              package_course.name
            ) =
            LOWER(
              ${course.name}
            )

        LIMIT 1
      `

    if (
      activeSameCourse.length
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          `${student.name} 目前已有進行中的「${course.name}」方案`,
      })
    }

    // ========================================================
    // Previous Package
    // ========================================================

    const previousRows =
      await sql`
        SELECT
          package.id,
          package.cycle_no

        FROM
          student_packages package

        INNER JOIN
          dance_courses package_course

          ON package_course.id =
            package.course_id

        WHERE
          package.student_id =
            ${normalizedStudentId}

          AND
            LOWER(
              package_course.name
            ) =
            LOWER(
              ${course.name}
            )

        ORDER BY
          package.cycle_no DESC NULLS LAST,
          package.created_at DESC

        LIMIT 1
      `

    const previous =
      previousRows[0] ||
      null

    const cycleNo =
      Number(
        previous?.cycle_no ||
        0
      ) +
      1

    // ========================================================
    // Calculation
    // ========================================================

    const sessionsPerCycle =
      Number(
        course.sessions_per_cycle
      )

    const pricePerCycle =
      Number(
        course.price_per_cycle
      )

    const totalSessions =
      sessionsPerCycle *
      cycles

    const totalPrice =
      pricePerCycle *
      cycles

    const packageId =
      randomUUID()

    const afterData = {
      id:
        packageId,

      student_id:
        normalizedStudentId,

      course_id:
        normalizedCourseId,

      course_name:
        course.name,

      cycle_no:
        cycleNo,

      purchased_cycles:
        cycles,

      sessions_per_cycle:
        sessionsPerCycle,

      total_sessions:
        totalSessions,

      price_per_cycle:
        pricePerCycle,

      price:
        totalPrice,

      start_date:
        normalizedStartDate,

      status:
        'ACTIVE',

      paid:
        Boolean(
          paid
        ),
    }

    const auditMetadata =
      event
        ? getAuditRequestMetadata(
            event
          )
        : {}

    if (
      typeof sql.transaction !==
      'function'
    ) {
      throw createError({
        statusCode: 500,

        statusMessage:
          '資料庫目前不支援 Transaction',
      })
    }

    const results =
      await sql.transaction([
        sql`
          INSERT INTO
            student_packages (
              id,

              student_id,

              course_id,

              start_date,

              total_sessions,

              price,

              status,

              paid,

              paid_at,

              cycle_no,

              previous_package_id,

              activated_at,

              activated_by,

              completion_reason,

              purchased_cycles,

              sessions_per_cycle,

              price_per_cycle,

              completed_at,

              created_at,

              updated_at
            )

          VALUES (
            ${packageId},

            ${normalizedStudentId},

            ${normalizedCourseId},

            ${normalizedStartDate},

            ${totalSessions},

            ${totalPrice},

            'ACTIVE',

            ${Boolean(paid)},

            ${
              paid
                ? new Date()
                    .toISOString()
                : null
            },

            ${cycleNo},

            ${
              previous?.id ||
              null
            },

            NOW(),

            ${normalizedActorId},

            NULL,

            ${cycles},

            ${sessionsPerCycle},

            ${pricePerCycle},

            NULL,

            NOW(),

            NOW()
          )

          RETURNING
            *
        `,

        createAuditQuery(
          sql,
          {
            actorUserId:
              normalizedActorId,

            actorRole:
              'TEACHER',

            action:
              'CREATE',

            entityType:
              'PACKAGE',

            entityId:
              packageId,

            studentId:
              normalizedStudentId,

            courseId:
              normalizedCourseId,

            beforeData:
              null,

            afterData,

            note:
              `${student.name} 建立 ${course.name} ${cycles} 期，共 ${totalSessions} 堂`,

            ...auditMetadata,
          }
        ),
      ])

    return results[0]?.[0] ||
      null
  }

// ============================================================
// Record Attendance
//
// 老師只需要選：
//
// 課堂
// 日期
// ATTENDED / LEAVE
//
// ATTENDED = +1
// LEAVE = +0
//
// 去另一個同名時段上課：
// 仍然就是 ATTENDED。
// 不叫 Makeup。
// ============================================================

export const recordSimpleAttendance =
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
      String(
        status ||
        ''
      )
        .trim()
        .toUpperCase()

    if (
      ![
        'ATTENDED',
        'LEAVE',
      ].includes(
        normalizedStatus
      )
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '只能選擇簽到或請假',
      })
    }

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

    const actualCourse =
      await requireCourse(
        sql,
        normalizedCourseId
      )

    // ========================================================
    // Find Package by same course name
    // ========================================================

    const packageData =
      await getActivePackageForCourse(
        sql,
        {
          studentId:
            normalizedStudentId,

          course:
            actualCourse,

          classDate:
            normalizedDate,
        }
      )

    if (
      !packageData
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          `${student.name} 在 ${normalizedDate} 沒有可使用的「${actualCourse.name}」方案`,
      })
    }

    // ========================================================
    // Package full
    // ========================================================

    const currentUsed =
      await getPackageUsage(
        sql,
        packageData.id
      )

    if (
      normalizedStatus ===
        'ATTENDED' &&
      currentUsed >=
        Number(
          packageData.total_sessions
        )
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          `${student.name} 的「${actualCourse.name}」本輪已經完成`,
      })
    }

    // ========================================================
    // Session
    // ========================================================

    const {
      session,
    } =
      await ensureCourseSession({
        courseId:
          normalizedCourseId,

        classDate:
          normalizedDate,
      })

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
          '這堂課目前不能登記學生出席',
      })
    }

    // ========================================================
    // Existing record
    // ========================================================

    const existingRows =
      await sql`
        SELECT
          id,
          package_id,
          status,
          attendance_type,
          note

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

    const existing =
      existingRows[0] ||
      null

    // ========================================================
    // If existing ATTENDED → ATTENDED,
    // doesn't add another session because it's UPDATE.
    //
    // If LEAVE → ATTENDED:
    // package trigger / recalc handles +1.
    // ========================================================

    const attendanceId =
      existing?.id ||
      randomUUID()

    const beforeData =
      existing
        ? {
            id:
              existing.id,

            status:
              existing.status,

            package_id:
              existing.package_id,

            note:
              existing.note,
          }
        : null

    const afterData = {
      id:
        attendanceId,

      student_id:
        normalizedStudentId,

      package_id:
        packageData.id,

      session_id:
        session.id,

      actual_course_id:
        normalizedCourseId,

      actual_course_name:
        actualCourse.name,

      class_date:
        normalizedDate,

      status:
        normalizedStatus,

      note:
        normalizedNote,
    }

    let attendanceQuery

    if (
      existing
    ) {
      attendanceQuery =
        sql`
          UPDATE
            attendance_records_v2

          SET
            package_id =
              ${packageData.id},

            status =
              ${normalizedStatus},

            attendance_type =
              'NORMAL',

            original_status =
              NULL,

            cancelled_at =
              NULL,

            note =
              ${normalizedNote},

            updated_at =
              NOW()

          WHERE
            id =
              ${attendanceId}

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

    const auditMetadata =
      event
        ? getAuditRequestMetadata(
            event
          )
        : {}

    const results =
      await sql.transaction([
        attendanceQuery,

        createAuditQuery(
          sql,
          {
            actorUserId:
              normalizedActorId,

            actorRole:
              'TEACHER',

            action:
              existing
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
              `${student.name}｜${actualCourse.name}｜${normalizedDate}｜${normalizedStatus === 'ATTENDED' ? '簽到' : '請假'}`,

            ...auditMetadata,
          }
        ),

        createPackageStateRecalculationQuery(
          sql,
          packageData.id
        ),
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

// ============================================================
// Reset / Start New Round
//
// 舊 Package 必須真正累積完成。
//
// Bob：
// 24 / 24
//
// 下一輪可以：
// purchasedCycles = 1
//
// → 8 堂
//
// 不會強迫維持 24 堂。
// ============================================================

export const resetStudentPackage =
  async ({
    studentId,

    packageId,

    purchasedCycles,

    startDate,

    paid = true,

    actorUserId,

    event = null,
  }) => {
    const normalizedStudentId =
      normalizeUuid(
        studentId,
        'Student ID'
      )

    const normalizedPackageId =
      normalizeUuid(
        packageId,
        'Package ID'
      )

    const normalizedActorId =
      normalizeUuid(
        actorUserId,
        'Actor User ID'
      )

    const normalizedStartDate =
      normalizeDate(
        startDate
      )

    const cycles =
      normalizePurchasedCycles(
        purchasedCycles
      )

    const sql =
      useDatabase()

    const student =
      await requireStudent(
        sql,
        normalizedStudentId
      )

    const rows =
      await sql`
        SELECT
          package.*,

          course.name
            AS course_name,

          course.sessions_per_cycle
            AS current_sessions_per_cycle,

          course.price_per_cycle
            AS current_price_per_cycle

        FROM
          student_packages package

        INNER JOIN
          dance_courses course

          ON course.id =
            package.course_id

        WHERE
          package.id =
            ${normalizedPackageId}

          AND
            package.student_id =
              ${normalizedStudentId}

        LIMIT 1
      `

    if (
      !rows.length
    ) {
      throw createError({
        statusCode: 404,

        statusMessage:
          '找不到方案',
      })
    }

    const oldPackage =
      rows[0]

    const used =
      await getPackageUsage(
        sql,
        oldPackage.id
      )

    if (
      used <
      Number(
        oldPackage.total_sessions
      )
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          `目前只有 ${used}/${oldPackage.total_sessions} 堂，尚未完成，不能開始下一輪`,
      })
    }

    // ========================================================
    // Current course terms
    //
    // Reset 時採現在課堂設定。
    // ========================================================

    const sessionsPerCycle =
      Number(
        oldPackage
          .current_sessions_per_cycle
      )

    const pricePerCycle =
      Number(
        oldPackage
          .current_price_per_cycle
      )

    const totalSessions =
      sessionsPerCycle *
      cycles

    const totalPrice =
      pricePerCycle *
      cycles

    const newPackageId =
      randomUUID()

    const nextCycleNo =
      Number(
        oldPackage.cycle_no ||
        0
      ) +
      1

    const beforeData = {
      id:
        oldPackage.id,

      course_name:
        oldPackage.course_name,

      total_sessions:
        oldPackage.total_sessions,

      used_sessions:
        used,

      status:
        oldPackage.status,
    }

    const afterData = {
      id:
        newPackageId,

      course_name:
        oldPackage.course_name,

      purchased_cycles:
        cycles,

      sessions_per_cycle:
        sessionsPerCycle,

      total_sessions:
        totalSessions,

      price_per_cycle:
        pricePerCycle,

      price:
        totalPrice,

      start_date:
        normalizedStartDate,

      status:
        'ACTIVE',
    }

    const auditMetadata =
      event
        ? getAuditRequestMetadata(
            event
          )
        : {}

    let results

    try {
      results =
        await sql.transaction([
          sql`
            UPDATE
              student_packages

            SET
              status =
                'COMPLETED',

              completion_reason =
                'SESSIONS_USED_UP',

              completed_at =
                COALESCE(
                  completed_at,
                  NOW()
                ),

              updated_at =
                NOW()

            WHERE
              id =
                ${oldPackage.id}

            RETURNING
              *
          `,

          sql`
            INSERT INTO
              student_packages (
                id,

                student_id,

                course_id,

                start_date,

                total_sessions,

                price,

                status,

                paid,

                paid_at,

                cycle_no,

                previous_package_id,

                activated_at,

                activated_by,

                completion_reason,

                purchased_cycles,

                sessions_per_cycle,

                price_per_cycle,

                completed_at,

                created_at,

                updated_at
              )

            VALUES (
              ${newPackageId},

              ${normalizedStudentId},

              ${oldPackage.course_id},

              ${normalizedStartDate},

              ${totalSessions},

              ${totalPrice},

              'ACTIVE',

              ${Boolean(paid)},

              ${
                paid
                  ? new Date()
                      .toISOString()
                  : null
              },

              ${nextCycleNo},

              ${oldPackage.id},

              NOW(),

              ${normalizedActorId},

              NULL,

              ${cycles},

              ${sessionsPerCycle},

              ${pricePerCycle},

              NULL,

              NOW(),

              NOW()
            )

            RETURNING
              *
          `,

          createAuditQuery(
            sql,
            {
              actorUserId:
                normalizedActorId,

              actorRole:
                'TEACHER',

              action:
                'RENEW',

              entityType:
                'PACKAGE',

              entityId:
                newPackageId,

              studentId:
                normalizedStudentId,

              courseId:
                oldPackage.course_id,

              beforeData,

              afterData,

              note:
                `${student.name}｜${oldPackage.course_name}｜開始下一輪 ${cycles} 期，共 ${totalSessions} 堂`,

              ...auditMetadata,
            }
          ),
        ])
    } catch (
      error
    ) {
      if (
        error?.code ===
        '23505'
      ) {
        throw createError({
          statusCode: 409,

          statusMessage:
            '此方案已經建立下一輪，請重新整理',
        })
      }

      throw error
    }

    return results[1]?.[0] ||
      null
  }