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

// ============================================================
// UUID
// ============================================================

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const normalizeUuid = (
  value,
  fieldName,
) => {
  const normalized =
    String(
      value || '',
    ).trim()

  if (
    !UUID_PATTERN.test(
      normalized,
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
  fieldName = '日期',
) => {
  const normalized =
    String(
      value || '',
    ).trim()

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      normalized,
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
  value,
) => {
  const parsed =
    Number.parseInt(
      String(
        value,
      ),
      10,
    )

  if (
    !Number.isInteger(
      parsed,
    ) ||
    parsed <= 0 ||
    parsed > 100
  ) {
    throw createError({
      statusCode: 400,

      statusMessage:
        '購買期數必須是 1～100 的整數',
    })
  }

  return parsed
}

// ============================================================
// Require Student
// ============================================================

const requireStudent =
  async (
    sql,
    studentId,
  ) => {
    const normalizedStudentId =
      normalizeUuid(
        studentId,
        'Student ID',
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
// Package Usage
// ============================================================

const getPackageUsage =
  async (
    sql,
    packageId,
  ) => {
    const rows =
      await sql`
        SELECT
          COUNT(*)::INTEGER
            AS used_sessions,

          MAX(
            session.class_date
          )
            FILTER (
              WHERE
                attendance.status =
                  'ATTENDED'
            )
            AS last_attended_date

        FROM
          attendance_records_v2 attendance

        LEFT JOIN
          class_sessions session

          ON session.id =
            attendance.session_id

        WHERE
          attendance.package_id =
            ${packageId}

          AND
            attendance.status =
              'ATTENDED'
      `

    return {
      usedSessions:
        Number(
          rows[0]
            ?.used_sessions ||
          0,
        ),

      lastAttendedDate:
        rows[0]
          ?.last_attended_date ||
        null,
    }
  }

// ============================================================
// Student Workspace
//
// 學生端不回傳 Attendance Detail。
// 只回：
//
// 1. Package / 課程狀態
// 2. 完成日期
// 3. Audit Log
// ============================================================

export const getStudentWorkspace =
  async ({
    studentId,

    packageStatus = null,

    courseId = null,

    actorRole = null,

    auditAction = null,
  }) => {
    const normalizedStudentId =
      normalizeUuid(
        studentId,
        'Student ID',
      )

    const normalizedPackageStatus =
      packageStatus
        ? String(
            packageStatus,
          )
            .trim()
            .toUpperCase()
        : null

    const normalizedCourseId =
      courseId
        ? normalizeUuid(
            courseId,
            'Course ID',
          )
        : null

    const normalizedActorRole =
      actorRole
        ? String(
            actorRole,
          )
            .trim()
            .toUpperCase()
        : null

    const normalizedAuditAction =
      auditAction
        ? String(
            auditAction,
          )
            .trim()
            .toUpperCase()
        : null

    if (
      normalizedPackageStatus &&
      ![
        'ACTIVE',
        'COMPLETED',
        'CANCELLED',
      ].includes(
        normalizedPackageStatus,
      )
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '方案狀態不正確',
      })
    }

    if (
      normalizedActorRole &&
      ![
        'TEACHER',
        'STUDENT',
      ].includes(
        normalizedActorRole,
      )
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '操作角色不正確',
      })
    }

    const sql =
      useDatabase()

    const student =
      await requireStudent(
        sql,
        normalizedStudentId,
      )

    // ========================================================
    // Course Filters
    // ========================================================

    const courses =
      await sql`
        SELECT DISTINCT
          course.id,
          course.name

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
    // Package Table
    //
    // completion_class_date =
    // 最後一筆實際 ATTENDED 的 class_date。
    //
    // 這才是學生真正「上完課」的日期。
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

          course.weekday,

          course.start_time,

          course.end_time,

          COALESCE(
            COUNT(attendance.id)
              FILTER (
                WHERE
                  attendance.status =
                    'ATTENDED'
              ),
            0
          )::INTEGER
            AS used_sessions,

          MAX(
            session.class_date
          )
            FILTER (
              WHERE
                attendance.status =
                  'ATTENDED'
            )
            AS last_attended_date

        FROM
          student_packages package

        INNER JOIN
          dance_courses course

          ON course.id =
            package.course_id

        LEFT JOIN
          attendance_records_v2 attendance

          ON attendance.package_id =
            package.id

        LEFT JOIN
          class_sessions session

          ON session.id =
            attendance.session_id

        WHERE
          package.student_id =
            ${normalizedStudentId}

          AND (
            ${normalizedPackageStatus}::text
              IS NULL

            OR
              package.status =
                ${normalizedPackageStatus}
          )

          AND (
            ${normalizedCourseId}::uuid
              IS NULL

            OR
              package.course_id =
                ${normalizedCourseId}
          )

        GROUP BY
          package.id,
          course.id

        ORDER BY
          CASE
            WHEN
              package.status =
                'ACTIVE'
            THEN
              0

            WHEN
              package.status =
                'COMPLETED'
            THEN
              1

            ELSE
              2
          END,

          package.created_at DESC
      `

    const mappedPackages =
      packages.map(
        (
          packageData,
        ) => {
          const usedSessions =
            Number(
              packageData
                .used_sessions ||
              0,
            )

          const totalSessions =
            Number(
              packageData
                .total_sessions ||
              0,
            )

          const isCompleted =
            totalSessions > 0 &&
            usedSessions >=
              totalSessions

          return {
            ...packageData,

            used_sessions:
              usedSessions,

            remaining_sessions:
              Math.max(
                totalSessions -
                usedSessions,
                0,
              ),

            is_completed:
              isCompleted,

            completion_class_date:
              isCompleted
                ? packageData
                    .last_attended_date
                : null,

            can_reset:
              isCompleted &&
              packageData.status !==
                'CANCELLED',
          }
        },
      )

    // ========================================================
    // Audit Logs
    //
    // 包含：
    //
    // TEACHER
    // STUDENT
    //
    // 只要 student_id 是目前學生，
    // 都顯示。
    // ========================================================

    const auditLogs =
      await sql`
        SELECT
          audit.id,

          audit.actor_user_id,

          audit.actor_role,

          audit.action,

          audit.entity_type,

          audit.entity_id,

          audit.student_id,

          audit.course_id,

          audit.before_data,

          audit.after_data,

          audit.note,

          audit.ip_address,

          audit.user_agent,

          audit.created_at,

          actor.display_name
            AS actor_name,

          course.name
            AS course_name

        FROM
          audit_logs audit

        LEFT JOIN
          app_users actor

          ON actor.id =
            audit.actor_user_id

        LEFT JOIN
          dance_courses course

          ON course.id =
            audit.course_id

        WHERE
          audit.student_id =
            ${normalizedStudentId}

          AND (
            ${normalizedActorRole}::text
              IS NULL

            OR
              audit.actor_role =
                ${normalizedActorRole}
          )

          AND (
            ${normalizedAuditAction}::text
              IS NULL

            OR
              audit.action =
                ${normalizedAuditAction}
          )

        ORDER BY
          audit.created_at DESC

        LIMIT 500
      `

    const auditActions =
      [
        ...new Set(
          auditLogs
            .map(
              (
                item,
              ) =>
                item.action,
            )
            .filter(
              Boolean,
            ),
        ),
      ].sort()

    return {
      student,

      courses,

      packages:
        mappedPackages,

      auditLogs,

      auditActions,
    }
  }

// ============================================================
// Student Reset
//
// 學生只能：
//
// 已經上滿
// 8/8
// 16/16
// 24/24
//
// 才能自己開始下一輪。
//
// 新一輪：
// paid = FALSE
//
// 因為付款仍由老師人工確認。
// ============================================================

export const resetStudentPackageByStudent =
  async ({
    studentId,

    packageId,

    purchasedCycles,

    startDate,

    actorUserId,

    event = null,
  }) => {
    const normalizedStudentId =
      normalizeUuid(
        studentId,
        'Student ID',
      )

    const normalizedPackageId =
      normalizeUuid(
        packageId,
        'Package ID',
      )

    const normalizedActorUserId =
      normalizeUuid(
        actorUserId,
        'Actor User ID',
      )

    const cycles =
      normalizePurchasedCycles(
        purchasedCycles,
      )

    const normalizedStartDate =
      normalizeDate(
        startDate,
        '開始日期',
      )

    const sql =
      useDatabase()

    const student =
      await requireStudent(
        sql,
        normalizedStudentId,
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
    // Old Package
    // ========================================================

    const packageRows =
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

          package.completed_at,

          package.completion_reason,

          package.created_at,

          course.name
            AS course_name,

          course.sessions_per_cycle
            AS current_sessions_per_cycle,

          course.price_per_cycle
            AS current_price_per_cycle,

          course.status
            AS course_status

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
      !packageRows.length
    ) {
      throw createError({
        statusCode: 404,

        statusMessage:
          '找不到這個課程方案',
      })
    }

    const oldPackage =
      packageRows[0]

    if (
      oldPackage.status ===
      'CANCELLED'
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '已取消的方案不能 Reset',
      })
    }

    if (
      oldPackage.course_status !==
      'ACTIVE'
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '此課程目前已停用，請聯絡老師',
      })
    }

    // ========================================================
    // Usage
    // ========================================================

    const usage =
      await getPackageUsage(
        sql,
        normalizedPackageId,
      )

    const totalSessions =
      Number(
        oldPackage.total_sessions ||
        0,
      )

    if (
      usage.usedSessions <
      totalSessions
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          `目前只有 ${usage.usedSessions}/${totalSessions} 堂，還沒有上完，不能 Reset`,
      })
    }

    // ========================================================
    // Prevent duplicate Reset
    //
    // 同名課程如果已經有另一個 ACTIVE Package，
    // 代表老師或學生已經先 Reset。
    // ========================================================

    const activeRows =
      await sql`
        SELECT
          active_package.id

        FROM
          student_packages active_package

        INNER JOIN
          dance_courses active_course

          ON active_course.id =
            active_package.course_id

        WHERE
          active_package.student_id =
            ${normalizedStudentId}

          AND
            active_package.id <>
              ${normalizedPackageId}

          AND
            active_package.status =
              'ACTIVE'

          AND
            LOWER(
              active_course.name
            ) =
            LOWER(
              ${oldPackage.course_name}
            )

        LIMIT 1
      `

    if (
      activeRows.length
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '這個課程已經有新的進行中方案，不需要再次 Reset',
      })
    }

    // ========================================================
    // Successor
    // ========================================================

    const successorRows =
      await sql`
        SELECT
          id,
          status

        FROM
          student_packages

        WHERE
          previous_package_id =
            ${normalizedPackageId}

          AND
            status <>
              'CANCELLED'

        LIMIT 1
      `

    if (
      successorRows.length
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '這個方案已經 Reset 過了',
      })
    }

    // ========================================================
    // Current Product Terms
    //
    // Reset 使用現在課堂的方案價格。
    // ========================================================

    const sessionsPerCycle =
      Number(
        oldPackage
          .current_sessions_per_cycle ||
        oldPackage
          .sessions_per_cycle ||
        0,
      )

    const pricePerCycle =
      Number(
        oldPackage
          .current_price_per_cycle ??
        oldPackage
          .price_per_cycle ??
        0,
      )

    if (
      sessionsPerCycle <= 0
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '目前課程的一期堂數設定不正確',
      })
    }

    const nextTotalSessions =
      sessionsPerCycle *
      cycles

    const nextTotalPrice =
      pricePerCycle *
      cycles

    const nextPackageId =
      randomUUID()

    const nextCycleNo =
      Number(
        oldPackage.cycle_no ||
        0,
      ) +
      1

    // ========================================================
    // Audit
    // ========================================================

    const beforeData = {
      id:
        oldPackage.id,

      course_id:
        oldPackage.course_id,

      course_name:
        oldPackage.course_name,

      cycle_no:
        oldPackage.cycle_no,

      purchased_cycles:
        oldPackage.purchased_cycles,

      total_sessions:
        oldPackage.total_sessions,

      used_sessions:
        usage.usedSessions,

      completion_class_date:
        usage.lastAttendedDate,

      status:
        oldPackage.status,
    }

    const afterData = {
      id:
        nextPackageId,

      course_id:
        oldPackage.course_id,

      course_name:
        oldPackage.course_name,

      cycle_no:
        nextCycleNo,

      purchased_cycles:
        cycles,

      sessions_per_cycle:
        sessionsPerCycle,

      total_sessions:
        nextTotalSessions,

      price_per_cycle:
        pricePerCycle,

      price:
        nextTotalPrice,

      start_date:
        normalizedStartDate,

      status:
        'ACTIVE',

      paid:
        false,
    }

    const auditMetadata =
      event
        ? getAuditRequestMetadata(
            event,
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

    // ========================================================
    // Transaction
    // ========================================================

    let results

    try {
      results =
        await sql.transaction([
          // ==================================================
          // Complete Old
          // ==================================================

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
                ${normalizedPackageId}

              AND
                student_id =
                  ${normalizedStudentId}

            RETURNING
              *
          `,

          // ==================================================
          // New Round
          //
          // 學生自己 Reset：
          // paid = FALSE
          // ==================================================

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
              ${nextPackageId},

              ${normalizedStudentId},

              ${oldPackage.course_id},

              ${normalizedStartDate},

              ${nextTotalSessions},

              ${nextTotalPrice},

              'ACTIVE',

              FALSE,

              NULL,

              ${nextCycleNo},

              ${normalizedPackageId},

              NOW(),

              ${normalizedActorUserId},

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

          // ==================================================
          // Audit
          // ==================================================

          createAuditQuery(
            sql,
            {
              actorUserId:
                normalizedActorUserId,

              actorRole:
                'STUDENT',

              action:
                'RENEW',

              entityType:
                'PACKAGE',

              entityId:
                nextPackageId,

              studentId:
                normalizedStudentId,

              courseId:
                oldPackage.course_id,

              beforeData,

              afterData,

              note:
                `${student.name} 自行 Reset「${oldPackage.course_name}」，新一輪 ${cycles} 期，共 ${nextTotalSessions} 堂`,

              ...auditMetadata,
            },
          ),
        ])
    }
    catch (error) {
      if (
        error?.code ===
        '23505'
      ) {
        throw createError({
          statusCode: 409,

          statusMessage:
            '這個課程已經建立新一輪，請重新整理',
        })
      }

      throw error
    }

    return {
      oldPackage:
        results[0]?.[0] ||
        null,

      newPackage:
        results[1]?.[0] ||
        null,
    }
  }