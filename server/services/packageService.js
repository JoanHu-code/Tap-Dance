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
// UUID
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

// ============================================================
// 數字處理
// ============================================================

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

// ============================================================
// 日期
// ============================================================

const normalizeDate = (
  value,
  fallback = null
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
// Audit Table 是否存在
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
// Neon Transaction
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
// Course
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

        FROM student_enrollments

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
// Bank Account
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
// Package 顯示資料
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

    can_renew:
      totalSessions > 0 &&
      attendedCount >=
        totalSessions &&
      item.status !==
        'CANCELLED',
  }
}

// ============================================================
// 同步滿堂 Package
//
// 例如：
// 8 / 8
// ACTIVE → COMPLETED
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
// 單一 Package
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
// 學生所有 Package
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
          '這門課已經有 Package 歷史，請使用續期功能',
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
// Renew Package
//
// 老師與學生都可以使用。
// 但一定要滿堂才允許。
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
    actorRole,
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

    const normalizedActorRole =
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
        normalizedActorRole
      )
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          'Renew 操作者角色不正確',
      })
    }

    const sql =
      useDatabase()

    const student =
      await requireStudentRecord(
        sql,
        studentId
      )

    // ========================================================
    // Package + 已使用堂數
    // ========================================================

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

    // ========================================================
    // CANCELLED 不可 Renew
    // ========================================================

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

    // ========================================================
    // 最重要的後端限制：
    //
    // 沒有滿堂就絕對不能 Renew。
    //
    // 例如：
    // 7 / 8 → 拒絕
    // 8 / 8 → 允許
    // ========================================================

    if (
      Number(
        previousPackage
          .attended_count
      ) <
      Number(
        previousPackage
          .total_sessions
      )
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          `本期尚未完成，目前為 ${previousPackage.attended_count}/${previousPackage.total_sessions} 堂，無法續期`,
      })
    }

    // ========================================================
    // 防止重複 Renew
    // ========================================================

    const existingActive =
      await sql`
        SELECT
          id,
          cycle_no

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
          '此課程已經存在新的有效期數，不能重複續期',
      })
    }

    // ========================================================
    // 日期
    // ========================================================

    const normalizedStartDate =
      normalizeDate(
        startDate,
        getTaipeiDateString()
      )

    // ========================================================
    // 學生不傳就沿用上一期
    // 老師可以自行指定
    // ========================================================

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
            previousPackage
              .price
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
      id:
        previousPackage.id,

      student_id:
        studentId,

      student_name:
        student.name,

      course_id:
        previousPackage
          .course_id,

      course_name:
        previousPackage
          .course_name,

      cycle_no:
        currentCycle,

      total_sessions:
        previousPackage
          .total_sessions,

      attended_count:
        previousPackage
          .attended_count,

      remaining_sessions:
        previousPackage
          .remaining_sessions,

      price:
        previousPackage.price,

      paid:
        previousPackage.paid,

      status:
        previousPackage.status,
    }

    const afterData = {
      id:
        newPackageId,

      student_id:
        studentId,

      student_name:
        student.name,

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

      attended_count:
        0,

      remaining_sessions:
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

      activated_by:
        actorUserId,
    }

    const queries = [
      // ======================================================
      // 舊期完成
      // ======================================================

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

      // ======================================================
      // 新一期
      //
      // Renew 即代表操作人確認已完成繳費，
      // 因此新一期 paid = true。
      // ======================================================

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

    // ========================================================
    // Audit
    // ========================================================

    if (
      auditExists
    ) {
      const auditNote =
        normalizedActorRole ===
        'TEACHER'
          ? `老師確認續期：第 ${currentCycle} 期 → 第 ${nextCycle} 期`
          : `學生確認續期：第 ${currentCycle} 期 → 第 ${nextCycle} 期`

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
            ${normalizedActorRole},
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
            ${auditNote},
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