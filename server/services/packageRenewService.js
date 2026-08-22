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
  getPackageState,
} from './packageStateService.js'

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

const normalizeRole = (
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
      statusCode: 403,

      statusMessage:
        'Package Renew 操作者角色不正確',
    })
  }

  return role
}

// ============================================================
// Integer
// ============================================================

const normalizeSessions = (
  value,
  fallback
) => {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return Number(
      fallback
    )
  }

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
    parsed > 10000
  ) {
    throw createError({
      statusCode: 400,

      statusMessage:
        'totalSessions 必須是大於 0 的整數',
    })
  }

  return parsed
}

// ============================================================
// Price
// ============================================================

const normalizePrice = (
  value,
  fallback
) => {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return Number(
      fallback ||
      0
    )
  }

  const parsed =
    Number(
      value
    )

  if (
    !Number.isFinite(
      parsed
    ) ||
    parsed < 0
  ) {
    throw createError({
      statusCode: 400,

      statusMessage:
        'price 必須大於或等於 0',
    })
  }

  return parsed
}

// ============================================================
// Date
// ============================================================

const getTaipeiDate =
  () => {
    return new Intl
      .DateTimeFormat(
        'en-CA',
        {
          timeZone:
            'Asia/Taipei',

          year:
            'numeric',

          month:
            '2-digit',

          day:
            '2-digit',
        }
      )
      .format(
        new Date()
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
// Ownership
// ============================================================

const verifyStudentOwnership =
  (
    packageData,
    actorRole,
    studentId
  ) => {
    if (
      actorRole !==
      'STUDENT'
    ) {
      return
    }

    assertUuid(
      studentId,
      'Student ID'
    )

    if (
      String(
        packageData.student_id
      ) !==
      String(
        studentId
      )
    ) {
      throw createError({
        statusCode: 403,

        statusMessage:
          '學生不能續期其他人的 Package',
      })
    }
  }

// ============================================================
// Renew
// ============================================================

export const renewPackageCycle =
  async ({
    packageId,

    actorUserId,

    actorRole,

    studentId = null,

    totalSessions = undefined,

    price = undefined,

    paid = true,

    auditMetadata = {},
  }) => {
    assertUuid(
      packageId,
      'Package ID'
    )

    assertUuid(
      actorUserId,
      '操作者 ID'
    )

    const role =
      normalizeRole(
        actorRole
      )

    // ========================================================
    // Source Package
    // ========================================================

    const sourcePackage =
      await getPackageState(
        packageId
      )

    verifyStudentOwnership(
      sourcePackage,
      role,
      studentId
    )

    // ========================================================
    // Full Check
    // ========================================================

    const attended =
      Number(
        sourcePackage.attended_count ||
        0
      )

    const total =
      Number(
        sourcePackage.total_sessions ||
        0
      )

    if (
      total <= 0
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '原 Package 的 total_sessions 不正確',
      })
    }

    if (
      attended <
      total
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          `目前只有 ${attended}/${total} 堂，必須完整上完本期後才能 Renew`,
      })
    }

    if (
      sourcePackage.status ===
      'CANCELLED'
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '已取消的 Package 不能 Renew',
      })
    }

    if (
      sourcePackage.has_successor
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '這一期已經建立下一期，不能重複 Renew',
      })
    }

    // ========================================================
    // Student 不允許修改方案條件
    //
    // 老師可以自訂新一期堂數／價格。
    // ========================================================

    let nextTotalSessions =
      Number(
        sourcePackage.total_sessions
      )

    let nextPrice =
      Number(
        sourcePackage.price ||
        0
      )

    if (
      role ===
      'TEACHER'
    ) {
      nextTotalSessions =
        normalizeSessions(
          totalSessions,
          sourcePackage.total_sessions
        )

      nextPrice =
        normalizePrice(
          price,
          sourcePackage.price
        )
    }

    const nextCycle =
      Number(
        sourcePackage.cycle_no ||
        0
      ) +
      1

    const newPackageId =
      randomUUID()

    const today =
      getTaipeiDate()

    const normalizedPaid =
      Boolean(
        paid
      )

    // ========================================================
    // Before / After Audit
    // ========================================================

    const nextPackageSnapshot = {
      id:
        newPackageId,

      student_id:
        sourcePackage.student_id,

      course_id:
        sourcePackage.course_id,

      cycle_no:
        nextCycle,

      previous_package_id:
        sourcePackage.id,

      start_date:
        today,

      total_sessions:
        nextTotalSessions,

      price:
        nextPrice,

      status:
        'ACTIVE',

      paid:
        normalizedPaid,

      paid_at:
        normalizedPaid
          ? new Date()
              .toISOString()
          : null,

      bank_account_id:
        sourcePackage.bank_account_id,

      activated_by:
        actorUserId,
    }

    const sql =
      useDatabase()

    // ========================================================
    // Transaction
    //
    // 注意：
    // DB unique index 仍是最後一道防線。
    //
    // 即使老師和學生同時按 Renew，
    // 最多只有一筆 successor 能成功。
    // ========================================================

    const queries = [
      // ======================================================
      // 確保 Source Package 是 COMPLETED
      // ======================================================

      sql`
        UPDATE
          student_packages

        SET
          status =
            'COMPLETED',

          completion_reason =
            'SESSIONS_USED_UP',

          updated_at =
            NOW()

        WHERE
          id =
            ${sourcePackage.id}

        RETURNING
          *
      `,

      // ======================================================
      // New Cycle
      // ======================================================

      sql`
        INSERT INTO
          student_packages (
            id,

            student_id,

            course_id,

            cycle_no,

            previous_package_id,

            start_date,

            total_sessions,

            price,

            status,

            paid,

            paid_at,

            bank_account_id,

            activated_at,

            activated_by,

            completion_reason,

            created_at,

            updated_at
          )

        VALUES (
          ${newPackageId},

          ${sourcePackage.student_id},

          ${sourcePackage.course_id},

          ${nextCycle},

          ${sourcePackage.id},

          ${today},

          ${nextTotalSessions},

          ${nextPrice},

          'ACTIVE',

          ${normalizedPaid},

          ${
            normalizedPaid
              ? new Date()
                  .toISOString()
              : null
          },

          ${sourcePackage.bank_account_id},

          NOW(),

          ${actorUserId},

          NULL,

          NOW(),

          NOW()
        )

        RETURNING
          *
      `,

      // ======================================================
      // Renew Audit
      // ======================================================

      createAuditQuery(
        sql,
        {
          actorUserId,

          actorRole:
            role,

          action:
            'RENEW',

          entityType:
            'PACKAGE',

          entityId:
            newPackageId,

          studentId:
            sourcePackage.student_id,

          courseId:
            sourcePackage.course_id,

          beforeData: {
            id:
              sourcePackage.id,

            cycle_no:
              sourcePackage.cycle_no,

            total_sessions:
              sourcePackage.total_sessions,

            attended_count:
              sourcePackage.attended_count,

            status:
              sourcePackage.status,

            paid:
              sourcePackage.paid,
          },

          afterData:
            nextPackageSnapshot,

          note:
            `${sourcePackage.course_name} 第 ${sourcePackage.cycle_no} 期 → 第 ${nextCycle} 期`,

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
      // ======================================================
      // Concurrent Renew
      // ======================================================

      if (
        String(
          error?.message ||
          ''
        ).includes(
          'uq_student_packages_active_successor'
        ) ||
        String(
          error?.message ||
          ''
        ).includes(
          'uq_student_packages_one_active'
        ) ||
        String(
          error?.message ||
          ''
        ).includes(
          'duplicate key'
        )
      ) {
        throw createError({
          statusCode: 409,

          statusMessage:
            '這一期可能剛剛已被續期，請重新整理後確認',
        })
      }

      throw error
    }

    const newPackage =
      results[1]?.[0] ||
      null

    return {
      previousPackage:
        results[0]?.[0] ||
        sourcePackage,

      package:
        newPackage,
    }
  }