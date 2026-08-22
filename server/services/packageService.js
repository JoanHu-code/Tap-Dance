import {
  randomUUID,
} from 'node:crypto'

import {
  useDatabase,
} from '../utils/db.js'

import {
  getTaipeiDateString,
} from '../utils/taipeiTime.js'

// ============================================================
// 基本工具
// ============================================================

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const isUuid = (
  value
) => {
  return UUID_PATTERN.test(
    String(
      value || ''
    )
  )
}

const assertUuid = (
  value,
  fieldName
) => {
  if (
    !isUuid(value)
  ) {
    throw createError({
      statusCode: 400,

      statusMessage:
        `${fieldName} 格式不正確`,
    })
  }
}

const normalizePositiveInteger = (
  value,
  fieldName
) => {
  const number =
    Number(value)

  if (
    !Number.isInteger(
      number
    ) ||
    number <= 0
  ) {
    throw createError({
      statusCode: 400,

      statusMessage:
        `${fieldName} 必須是大於 0 的整數`,
    })
  }

  return number
}

const normalizePrice = (
  value
) => {
  const number =
    Number(value)

  if (
    !Number.isInteger(
      number
    ) ||
    number < 0
  ) {
    throw createError({
      statusCode: 400,

      statusMessage:
        '價格必須是大於或等於 0 的整數',
    })
  }

  return number
}

const normalizeDate = (
  value,
  fallback =
    null
) => {
  const target =
    String(
      value ||
      fallback ||
      ''
    )
      .trim()

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      target
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
      `${target}T00:00:00+08:00`
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

  return target
}

// ============================================================
// audit_logs 是否已經存在
//
// 目前 Migration 013 還沒正式做到，
// 因此 Package 功能先相容兩種狀態。
//
// 等 013 做完後，可以把 Audit 改成強制成功。
// ============================================================

const hasAuditLogsTable =
  async (
    sql
  ) => {
    const result =
      await sql`
        SELECT
          to_regclass(
            'public.audit_logs'
          ) IS NOT NULL
            AS exists
      `

    return Boolean(
      result[0]?.exists
    )
  }

// ============================================================
// 執行 Neon Transaction
// ============================================================

const runTransaction =
  async (
    sql,
    queries
  ) => {
    if (
      typeof sql.transaction ===
      'function'
    ) {
      return await sql
        .transaction(
          queries
        )
    }

    const results = []

    for (
      const query of
      queries
    ) {
      results.push(
        await query
      )
    }

    return results
  }

// ============================================================
// 驗證 Student
// ============================================================

const requireStudentRecord =
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

    return students[0]
  }

// ============================================================
// 驗證 Course
// ============================================================

const requireCourse =
  async (
    sql,
    courseId
  ) => {
    assertUuid(
      courseId,
      '課程 ID'
    )

    const courses =
      await sql`
        SELECT
          *

        FROM dance_courses

        WHERE
          id =
            ${courseId}

        LIMIT 1
      `

    if (
      !courses.length
    ) {
      throw createError({
        statusCode: 404,

        statusMessage:
          '找不到課程資料',
      })
    }

    return courses[0]
  }

// ============================================================
// 驗證 Enrollment
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
          '學生尚未加入這門課程，請先建立 Enrollment',
      })
    }

    return enrollments[0]
  }

// ============================================================
// 驗證 Bank Account
// ============================================================

const validateBankAccount =
  async (
    sql,
    bankAccountId
  ) => {
    if (
      !bankAccountId
    ) {
      return null
    }

    assertUuid(
      bankAccountId,
      '銀行帳戶 ID'
    )

    const accounts =
      await sql`
        SELECT
          id

        FROM bank_accounts

        WHERE
          id =
            ${bankAccountId}

        LIMIT 1
      `

    if (
      !accounts.length
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '找不到指定的銀行帳戶',
      })
    }

    return bankAccountId
  }

// ============================================================
// 取得單一 Package
// ============================================================

export const getPackageById =
  async (
    packageId
  ) => {
    assertUuid(
      packageId,
      'Package ID'
    )

    const sql =
      useDatabase()

    const packages =
      await sql`
        SELECT
          p.*,

          c.name
            AS course_name,

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
          dance_courses c

          ON c.id =
            p.course_id

        LEFT JOIN
          attendance_records_v2 a

          ON a.package_id =
            p.id

        WHERE
          p.id =
            ${packageId}

        GROUP BY
          p.id,
          c.id,
          c.name

        LIMIT 1
      `

    if (
      !packages.length
    ) {
      throw createError({
        statusCode: 404,

        statusMessage:
          '找不到 Package',
      })
    }

    return enrichPackage(
      packages[0]
    )
  }

// ============================================================
// Package 顯示欄位
// ============================================================

const enrichPackage = (
  item
) => {
  const totalSessions =
    Number(
      item.total_sessions ||
      0
    )

  const attendedCount =
    Number(
      item.attended_count ||
      0
    )

  const remainingSessions =
    Math.max(
      totalSessions -
        attendedCount,
      0
    )

  return {
    ...item,

    attended_count:
      attendedCount,

    remaining_sessions:
      remainingSessions,

    progress_percentage:
      totalSessions > 0
        ? Math.min(
            Math.round(
              (
                attendedCount /
                totalSessions
              ) *
                100
            ),
            100
          )
        : 0,

    is_sessions_completed:
      totalSessions > 0 &&
      attendedCount >=
        totalSessions,
  }
}

// ============================================================
// 自動同步「堂數已滿」的 Package
//
// 主要 Attendance Service 完成後，
// 每次 Attendance 修改都會呼叫這個邏輯。
//
// 此處同時提供安全補償：
// GET Package 前也可以執行一次。
// ============================================================

export const refreshCompletedPackagesForStudent =
  async (
    studentId
  ) => {
    assertUuid(
      studentId,
      '學生 ID'
    )

    const sql =
      useDatabase()

    await sql`
      UPDATE
        student_packages p

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
        p.student_id =
          ${studentId}

        AND
          p.status =
            'ACTIVE'

        AND (
          SELECT
            COUNT(*)

          FROM
            attendance_records_v2 a

          WHERE
            a.package_id =
              p.id

            AND
              a.status =
                'ATTENDED'
        ) >=
          p.total_sessions
    `
  }

// ============================================================
// 取得學生所有 Package
// ============================================================

export const getStudentPackages =
  async (
    studentId
  ) => {
    const sql =
      useDatabase()

    await requireStudentRecord(
      sql,
      studentId
    )

    await refreshCompletedPackagesForStudent(
      studentId
    )

    const packages =
      await sql`
        SELECT
          p.*,

          c.name
            AS course_name,

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
          dance_courses c

          ON c.id =
            p.course_id

        LEFT JOIN
          attendance_records_v2 a

          ON a.package_id =
            p.id

        WHERE
          p.student_id =
            ${studentId}

        GROUP BY
          p.id,
          c.id,
          c.name

        ORDER BY
          p.course_id,
          p.cycle_no DESC,
          p.created_at DESC
      `

    return packages.map(
      (
        item
      ) => {
        return enrichPackage(
          item
        )
      }
    )
  }

// ============================================================
// 建立第一期 Package
//
// 注意：
// 如果這門課已經有 Package 歷史，
// 不允許再從這支 API 建立。
// 必須使用 Renew，才能維持完整週期鏈。
// ============================================================

export const createStudentPackage =
  async ({
    studentId,
    courseId,
    startDate,
    totalSessions,
    price,
    paid = false,
    bankAccountId = null,
    actorUserId,
  }) => {
    assertUuid(
      actorUserId,
      '操作者 ID'
    )

    const sql =
      useDatabase()

    const student =
      await requireStudentRecord(
        sql,
        studentId
      )

    const course =
      await requireCourse(
        sql,
        courseId
      )

    await requireEnrollment(
      sql,
      studentId,
      courseId
    )

    const normalizedStartDate =
      normalizeDate(
        startDate,
        getTaipeiDateString()
      )

    const normalizedTotal =
      normalizePositiveInteger(
        totalSessions,
        '總堂數'
      )

    const normalizedPrice =
      normalizePrice(
        price
      )

    const normalizedBankAccountId =
      await validateBankAccount(
        sql,
        bankAccountId
      )

    const existingPackages =
      await sql`
        SELECT
          id

        FROM
          student_packages

        WHERE
          student_id =
            ${studentId}

          AND
            course_id =
            ${courseId}

        LIMIT 1
      `

    if (
      existingPackages.length
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '此學生的這門課已經有 Package 歷史，請使用續期功能建立下一期',
      })
    }

    const packageId =
      randomUUID()

    const paidValue =
      Boolean(paid)

    const auditExists =
      await hasAuditLogsTable(
        sql
      )

    const queries = [
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
            bank_account_id,
            cycle_no,
            previous_package_id,
            activated_at,
            activated_by,
            completion_reason
          )

        VALUES (
          ${packageId},
          ${studentId},
          ${courseId},
          ${normalizedStartDate},
          ${normalizedTotal},
          ${normalizedPrice},
          'ACTIVE',
          ${paidValue},

          CASE
            WHEN
              ${paidValue}
            THEN NOW()
            ELSE NULL
          END,

          ${normalizedBankAccountId},
          1,
          NULL,
          NOW(),
          ${actorUserId},
          NULL
        )

        RETURNING
          *
      `,
    ]

    if (
      auditExists
    ) {
      const afterData = {
        id:
          packageId,

        student_id:
          studentId,

        student_name:
          student.name,

        course_id:
          courseId,

        course_name:
          course.name,

        start_date:
          normalizedStartDate,

        total_sessions:
          normalizedTotal,

        price:
          normalizedPrice,

        paid:
          paidValue,

        bank_account_id:
          normalizedBankAccountId,

        cycle_no:
          1,

        status:
          'ACTIVE',
      }

      queries.push(
        sql`
          INSERT INTO
            audit_logs (
              actor_user_id,
              actor_role,
              action,
              entity_type,
              entity_id,
              student_id,
              course_id,
              before_data,
              after_data,
              note,
              created_at
            )

          VALUES (
            ${actorUserId},
            'TEACHER',
            'CREATE',
            'PACKAGE',
            ${packageId},
            ${studentId},
            ${courseId},
            NULL,
            ${JSON.stringify(
              afterData
            )}::jsonb,
            '建立第一期 Package',
            NOW()
          )
        `
      )
    }

    const results =
      await runTransaction(
        sql,
        queries
      )

    const inserted =
      results[0]?.[0]

    return enrichPackage({
      ...inserted,

      course_name:
        course.name,

      attended_count:
        0,
    })
  }

// ============================================================
// 續期
//
// 舊 Package 永久保留。
// 新 Package：
// cycle_no + 1
// previous_package_id = 舊 Package
// attended_count = 0
//
// Renew 本身即代表老師確認已收費。
// ============================================================

export const renewStudentPackage =
  async ({
    studentId,
    packageId,
    startDate,
    totalSessions,
    price,
    bankAccountId,
    actorUserId,
  }) => {
    assertUuid(
      studentId,
      '學生 ID'
    )

    assertUuid(
      packageId,
      'Package ID'
    )

    assertUuid(
      actorUserId,
      '操作者 ID'
    )

    const sql =
      useDatabase()

    await requireStudentRecord(
      sql,
      studentId
    )

    const packages =
      await sql`
        SELECT
          p.*,

          c.name
            AS course_name,

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
          dance_courses c

          ON c.id =
            p.course_id

        LEFT JOIN
          attendance_records_v2 a

          ON a.package_id =
            p.id

        WHERE
          p.id =
            ${packageId}

          AND
            p.student_id =
            ${studentId}

        GROUP BY
          p.id,
          c.id,
          c.name

        LIMIT 1
      `

    if (
      !packages.length
    ) {
      throw createError({
        statusCode: 404,

        statusMessage:
          '找不到要續期的 Package',
      })
    }

    const previousPackage =
      enrichPackage(
        packages[0]
      )

    if (
      previousPackage.status ===
      'CANCELLED'
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '已取消的 Package 不能續期',
      })
    }

    if (
      previousPackage
        .attended_count <
      Number(
        previousPackage
          .total_sessions
      )
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          `本期尚未完成，目前為 ${previousPackage.attended_count}/${previousPackage.total_sessions} 堂`,
      })
    }

    const existingActive =
      await sql`
        SELECT
          id

        FROM
          student_packages

        WHERE
          student_id =
            ${studentId}

          AND
            course_id =
            ${previousPackage.course_id}

          AND
            status =
            'ACTIVE'

          AND
            id <>
            ${packageId}

        LIMIT 1
      `

    if (
      existingActive.length
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '此學生這門課已經有新的 ACTIVE Package',
      })
    }

    const normalizedStartDate =
      normalizeDate(
        startDate,
        getTaipeiDateString()
      )

    const normalizedTotal =
      totalSessions ===
        undefined ||
      totalSessions ===
        null ||
      totalSessions ===
        ''
        ? Number(
            previousPackage
              .total_sessions
          )
        : normalizePositiveInteger(
            totalSessions,
            '總堂數'
          )

    const normalizedPrice =
      price ===
        undefined ||
      price ===
        null ||
      price ===
        ''
        ? Number(
            previousPackage.price
          )
        : normalizePrice(
            price
          )

    const selectedBankAccountId =
      bankAccountId ===
        undefined
        ? previousPackage
            .bank_account_id
        : bankAccountId

    const normalizedBankAccountId =
      await validateBankAccount(
        sql,
        selectedBankAccountId
      )

    const currentCycle =
      Number(
        previousPackage
          .cycle_no ||
        1
      )

    const nextCycle =
      currentCycle + 1

    const newPackageId =
      randomUUID()

    const auditExists =
      await hasAuditLogsTable(
        sql
      )

    const beforeData = {
      ...previousPackage,
    }

    const afterData = {
      id:
        newPackageId,

      student_id:
        studentId,

      course_id:
        previousPackage
          .course_id,

      course_name:
        previousPackage
          .course_name,

      start_date:
        normalizedStartDate,

      total_sessions:
        normalizedTotal,

      price:
        normalizedPrice,

      paid:
        true,

      bank_account_id:
        normalizedBankAccountId,

      cycle_no:
        nextCycle,

      previous_package_id:
        packageId,

      status:
        'ACTIVE',

      attended_count:
        0,

      remaining_sessions:
        normalizedTotal,
    }

    const queries = [
      sql`
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
            student_id =
            ${studentId}

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
            bank_account_id,
            cycle_no,
            previous_package_id,
            activated_at,
            activated_by,
            completion_reason
          )

        VALUES (
          ${newPackageId},
          ${studentId},
          ${previousPackage.course_id},
          ${normalizedStartDate},
          ${normalizedTotal},
          ${normalizedPrice},
          'ACTIVE',
          TRUE,
          NOW(),
          ${normalizedBankAccountId},
          ${nextCycle},
          ${packageId},
          NOW(),
          ${actorUserId},
          NULL
        )

        RETURNING
          *
      `,
    ]

    if (
      auditExists
    ) {
      queries.push(
        sql`
          INSERT INTO
            audit_logs (
              actor_user_id,
              actor_role,
              action,
              entity_type,
              entity_id,
              student_id,
              course_id,
              before_data,
              after_data,
              note,
              created_at
            )

          VALUES (
            ${actorUserId},
            'TEACHER',
            'RENEW',
            'PACKAGE',
            ${newPackageId},
            ${studentId},
            ${previousPackage.course_id},
            ${JSON.stringify(
              beforeData
            )}::jsonb,
            ${JSON.stringify(
              afterData
            )}::jsonb,
            ${`Package Cycle ${currentCycle} → Cycle ${nextCycle}`} ,
            NOW()
          )
        `
      )
    }

    const results =
      await runTransaction(
        sql,
        queries
      )

    const completedPackage =
      results[0]?.[0]

    const newPackage =
      results[1]?.[0]

    return {
      previousPackage:
        enrichPackage({
          ...completedPackage,

          course_name:
            previousPackage
              .course_name,

          attended_count:
            previousPackage
              .attended_count,
        }),

      newPackage:
        enrichPackage({
          ...newPackage,

          course_name:
            previousPackage
              .course_name,

          attended_count:
            0,
        }),
    }
  }