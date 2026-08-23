import {
  randomUUID,
} from 'node:crypto'

import {
  useDatabase,
} from '../../../../../utils/db.js'

import {
  createAuditQuery,
} from '../../../../../services/auditService.js'

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
  value,
  fieldName
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
        `${fieldName} 必須為 YYYY-MM-DD`,
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
        '購買期數必須是 1～100 的整數',
    })
  }

  return parsed
}

// ============================================================
// Boolean
// ============================================================

const normalizeBoolean = (
  value,
  fallback = false
) => {
  if (
    value === undefined ||
    value === null
  ) {
    return fallback
  }

  if (
    typeof value ===
    'boolean'
  ) {
    return value
  }

  const normalized =
    String(
      value
    )
      .trim()
      .toLowerCase()

  if (
    [
      'true',
      '1',
      'yes',
    ].includes(
      normalized
    )
  ) {
    return true
  }

  if (
    [
      'false',
      '0',
      'no',
    ].includes(
      normalized
    )
  ) {
    return false
  }

  return fallback
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
// Require Student
// ============================================================

const requireStudent =
  async (
    sql,
    studentId
  ) => {
    const normalizedId =
      assertUuid(
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
            ${normalizedId}

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
// Require Course
// ============================================================

const requireCourse =
  async (
    sql,
    courseId
  ) => {
    const normalizedId =
      assertUuid(
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
            ${normalizedId}

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

    const course =
      rows[0]

    if (
      course.status !==
      'ACTIVE'
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '此課堂目前已停用，不能建立學生方案',
      })
    }

    if (
      !course.weekday ||
      !course.start_time ||
      !course.end_time ||
      !course.sessions_per_cycle ||
      course.price_per_cycle ===
        null ||
      course.price_per_cycle ===
        undefined
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '此課堂尚未完成新版課堂設定，請先設定星期、時間、一期堂數與價格',
      })
    }

    return course
  }

// ============================================================
// Student Package Overview
// ============================================================

export const getStudentPackageOverview =
  async (
    studentId
  ) => {
    const normalizedStudentId =
      assertUuid(
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
    // Courses
    // ========================================================

    const courses =
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
          status =
            'ACTIVE'

          AND
            weekday IS NOT NULL

          AND
            start_time IS NOT NULL

          AND
            end_time IS NOT NULL

          AND
            sessions_per_cycle IS NOT NULL

          AND
            price_per_cycle IS NOT NULL

        ORDER BY
          weekday ASC,
          start_time ASC,
          name ASC
      `

    // ========================================================
    // Packages
    //
    // used_sessions 永遠只算 ATTENDED。
    // ========================================================

    const packages =
      await sql`
        SELECT
          package.id,

          package.student_id,

          package.course_id,

          package.cycle_no,

          package.previous_package_id,

          package.start_date,

          package.purchased_cycles,

          package.sessions_per_cycle,

          package.total_sessions,

          package.price_per_cycle,

          package.price,

          package.status,

          package.paid,

          package.paid_at,

          package.activated_at,

          package.activated_by,

          package.completion_reason,

          package.completed_at,

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

          COALESCE(
            COUNT(attendance.id)
              FILTER (
                WHERE
                  attendance.status =
                    'LEAVE'
              ),
            0
          )::INTEGER
            AS leave_count,

          COALESCE(
            COUNT(attendance.id)
              FILTER (
                WHERE
                  attendance.status =
                    'ABSENT'
              ),
            0
          )::INTEGER
            AS absent_count,

          COALESCE(
            COUNT(attendance.id)
              FILTER (
                WHERE
                  attendance.status =
                    'ATTENDED'

                  AND
                    attendance.attendance_type =
                      'MAKEUP'
              ),
            0
          )::INTEGER
            AS makeup_count

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

        WHERE
          package.student_id =
            ${normalizedStudentId}

        GROUP BY
          package.id,
          course.id

        ORDER BY
          package.created_at DESC,
          package.cycle_no DESC
      `

    // ========================================================
    // Add Calculated Fields
    // ========================================================

    const mappedPackages =
      packages.map(
        (
          packageData
        ) => {
          const usedSessions =
            Number(
              packageData
                .used_sessions ||
              0
            )

          const totalSessions =
            Number(
              packageData
                .total_sessions ||
              0
            )

          return {
            ...packageData,

            used_sessions:
              usedSessions,

            remaining_sessions:
              Math.max(
                totalSessions -
                usedSessions,
                0
              ),

            usage_percent:
              totalSessions >
                0
                ? Math.min(
                    Math.round(
                      (
                        usedSessions /
                        totalSessions
                      ) *
                      100
                    ),
                    100
                  )
                : 0,
          }
        }
      )

    // ========================================================
    // Active Package Course IDs
    // ========================================================

    const activeCourseIds =
      mappedPackages
        .filter(
          (
            item
          ) => {
            return (
              item.status ===
              'ACTIVE'
            )
          }
        )
        .map(
          (
            item
          ) => {
            return item.course_id
          }
        )

    return {
      student,

      courses,

      packages:
        mappedPackages,

      activeCourseIds,
    }
  }

// ============================================================
// Create Student Package Purchase
// ============================================================

export const createStudentPackagePurchase =
  async ({
    studentId,

    courseId,

    startDate,

    purchasedCycles,

    paid = true,

    actorUserId,

    auditMetadata = {},
  }) => {
    const normalizedStudentId =
      assertUuid(
        studentId,
        'Student ID'
      )

    const normalizedCourseId =
      assertUuid(
        courseId,
        'Course ID'
      )

    const normalizedActorId =
      assertUuid(
        actorUserId,
        'Actor User ID'
      )

    const normalizedStartDate =
      normalizeDate(
        startDate,
        '開始日期'
      )

    const normalizedPurchasedCycles =
      normalizePurchasedCycles(
        purchasedCycles
      )

    const normalizedPaid =
      normalizeBoolean(
        paid,
        true
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
          '學生目前不是 ACTIVE，不能建立新方案',
      })
    }

    const course =
      await requireCourse(
        sql,
        normalizedCourseId
      )

    // ========================================================
    // Active Package Check
    //
    // 同一學生 + 同一課堂
    // 不能同時有兩個 ACTIVE Package。
    // ========================================================

    const activePackages =
      await sql`
        SELECT
          id,
          cycle_no,
          total_sessions

        FROM
          student_packages

        WHERE
          student_id =
            ${normalizedStudentId}

          AND
            course_id =
              ${normalizedCourseId}

          AND
            status =
              'ACTIVE'

        LIMIT 1
      `

    if (
      activePackages.length
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          `${student.name} 的「${course.name}」目前還有進行中的方案，不能再建立另一個 ACTIVE Package`,
      })
    }

    // ========================================================
    // Previous Package
    // ========================================================

    const previousRows =
      await sql`
        SELECT
          id,
          cycle_no,
          status,
          created_at

        FROM
          student_packages

        WHERE
          student_id =
            ${normalizedStudentId}

          AND
            course_id =
              ${normalizedCourseId}

        ORDER BY
          cycle_no DESC NULLS LAST,
          created_at DESC

        LIMIT 1
      `

    const previousPackage =
      previousRows[0] ||
      null

    const nextCycleNo =
      Number(
        previousPackage
          ?.cycle_no ||
        0
      ) +
      1

    // ========================================================
    // Purchase Calculation
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
      normalizedPurchasedCycles

    const totalPrice =
      pricePerCycle *
      normalizedPurchasedCycles

    if (
      totalSessions <=
      0
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '計算出的總堂數不正確',
      })
    }

    if (
      totalPrice <
      0
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '計算出的總價格不正確',
      })
    }

    const packageId =
      randomUUID()

    // ========================================================
    // Audit Snapshot
    // ========================================================

    const packageSnapshot = {
      id:
        packageId,

      student_id:
        normalizedStudentId,

      student_name:
        student.name,

      course_id:
        normalizedCourseId,

      course_name:
        course.name,

      cycle_no:
        nextCycleNo,

      previous_package_id:
        previousPackage
          ?.id ||
        null,

      start_date:
        normalizedStartDate,

      purchased_cycles:
        normalizedPurchasedCycles,

      sessions_per_cycle:
        sessionsPerCycle,

      total_sessions:
        totalSessions,

      price_per_cycle:
        pricePerCycle,

      price:
        totalPrice,

      status:
        'ACTIVE',

      paid:
        normalizedPaid,
    }

    // ========================================================
    // Transaction
    //
    // 1. 確保 Enrollment ACTIVE
    // 2. 建立 Package
    // 3. Audit
    // ========================================================

    const queries = [
      sql`
        INSERT INTO
          student_enrollments (
            id,
            student_id,
            course_id,
            default_schedule_id,
            status,
            joined_at,
            created_at
          )

        VALUES (
          ${randomUUID()},
          ${normalizedStudentId},
          ${normalizedCourseId},
          NULL,
          'ACTIVE',
          ${normalizedStartDate},
          NOW()
        )

        ON CONFLICT (
          student_id,
          course_id
        )

        DO UPDATE

        SET
          status =
            'ACTIVE'
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
          ${packageId},

          ${normalizedStudentId},

          ${normalizedCourseId},

          ${normalizedStartDate},

          ${totalSessions},

          ${totalPrice},

          'ACTIVE',

          ${normalizedPaid},

          ${
            normalizedPaid
              ? new Date()
                  .toISOString()
              : null
          },

          ${nextCycleNo},

          ${
            previousPackage
              ?.id ||
            null
          },

          NOW(),

          ${normalizedActorId},

          NULL,

          ${normalizedPurchasedCycles},

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

          afterData:
            packageSnapshot,

          note:
            `建立 ${student.name} 的「${course.name}」方案：${normalizedPurchasedCycles} 期，共 ${totalSessions} 堂，總額 ${totalPrice}`,

          ...auditMetadata,
        }
      ),
    ]

    let results

    try {
      results =
        await runTransaction(
          sql,
          queries
        )
    } catch (
      error
    ) {
      const message =
        String(
          error?.message ||
          ''
        ).toLowerCase()

      if (
        error?.code ===
          '23505' ||
        message.includes(
          'duplicate'
        ) ||
        message.includes(
          'uq_student_packages_one_active'
        )
      ) {
        throw createError({
          statusCode: 409,

          statusMessage:
            '此學生的這個課堂已經有進行中的方案，請重新整理後確認',
        })
      }

      throw error
    }

    return {
      package:
        results[1]?.[0] ||
        null,

      calculation: {
        purchasedCycles:
          normalizedPurchasedCycles,

        sessionsPerCycle,

        totalSessions,

        pricePerCycle,

        totalPrice,
      },
    }
  }
