import {
  randomUUID,
} from 'node:crypto'

import {
  useDatabase,
} from '../utils/db.js'

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
// Audit Table
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
// Enrollment
// ============================================================

const requireEnrollment =
  async (
    sql,
    studentId,
    enrollmentId
  ) => {
    assertUuid(
      enrollmentId,
      'Enrollment ID'
    )

    const enrollments =
      await sql`
        SELECT
          e.*,

          c.name
            AS course_name

        FROM
          student_enrollments e

        LEFT JOIN
          dance_courses c

          ON c.id =
            e.course_id

        WHERE
          e.id =
            ${enrollmentId}

          AND
            e.student_id =
            ${studentId}

        LIMIT 1
      `

    if (
      !enrollments.length
    ) {
      throw createError({
        statusCode: 404,

        statusMessage:
          '找不到學生的 Enrollment',
      })
    }

    return enrollments[0]
  }

// ============================================================
// Schedule 驗證
// ============================================================

const getSchedulesForCourse =
  async (
    sql,
    courseId,
    scheduleIds
  ) => {
    if (
      !scheduleIds.length
    ) {
      return []
    }

    for (
      const scheduleId of
      scheduleIds
    ) {
      assertUuid(
        scheduleId,
        'Schedule ID'
      )
    }

    const schedules = []

    for (
      const scheduleId of
      scheduleIds
    ) {
      const result =
        await sql`
          SELECT
            *

          FROM
            class_schedules

          WHERE
            id =
              ${scheduleId}

            AND
              course_id =
              ${courseId}

          LIMIT 1
        `

      if (
        !result.length
      ) {
        throw createError({
          statusCode: 400,

          statusMessage:
            `Schedule ${scheduleId} 不屬於這門課程`,
        })
      }

      schedules.push(
        result[0]
      )
    }

    return schedules
  }

// ============================================================
// 取得 Enrollment 的 Schedule
// ============================================================

export const getEnrollmentSchedules =
  async (
    enrollmentId
  ) => {
    assertUuid(
      enrollmentId,
      'Enrollment ID'
    )

    const sql =
      useDatabase()

    const schedules =
      await sql`
        SELECT
          es.id
            AS enrollment_schedule_id,

          es.enrollment_id,

          es.schedule_id,

          es.is_primary,

          es.status
            AS enrollment_schedule_status,

          es.created_at,

          es.updated_at,

          cs.course_id,

          cs.teacher_user_id,

          cs.weekday,

          cs.start_time,

          cs.end_time,

          cs.name,

          cs.capacity,

          cs.status

        FROM
          student_enrollment_schedules es

        INNER JOIN
          class_schedules cs

          ON cs.id =
            es.schedule_id

        WHERE
          es.enrollment_id =
            ${enrollmentId}

          AND
            es.status =
            'ACTIVE'

        ORDER BY
          es.is_primary DESC,
          cs.weekday ASC,
          cs.start_time ASC
      `

    return schedules
  }

// ============================================================
// 查學生所有 Enrollment
// ============================================================

export const getStudentEnrollments =
  async (
    studentId
  ) => {
    const sql =
      useDatabase()

    await requireStudent(
      sql,
      studentId
    )

    const enrollments =
      await sql`
        SELECT
          e.*,

          c.name
            AS course_name,

          c.description
            AS course_description,

          c.status
            AS course_status

        FROM
          student_enrollments e

        INNER JOIN
          dance_courses c

          ON c.id =
            e.course_id

        WHERE
          e.student_id =
            ${studentId}

        ORDER BY
          e.status ASC,
          e.joined_at ASC,
          e.created_at ASC
      `

    const result = []

    for (
      const enrollment of
      enrollments
    ) {
      const schedules =
        await getEnrollmentSchedules(
          enrollment.id
        )

      result.push({
        ...enrollment,

        schedules,

        primary_schedule:
          schedules.find(
            (
              schedule
            ) => {
              return Boolean(
                schedule.is_primary
              )
            }
          ) ||
          schedules[0] ||
          null,
      })
    }

    return result
  }

// ============================================================
// 修改 Enrollment
//
// 可修改：
// status
// defaultScheduleId
//
// defaultScheduleId 仍然保留，
// 做為舊版相容與 Primary 快速欄位。
// ============================================================

export const updateStudentEnrollment =
  async ({
    studentId,
    enrollmentId,
    status,
    defaultScheduleId,
    actorUserId,
    actorRole =
      'TEACHER',
  }) => {
    assertUuid(
      actorUserId,
      '操作者 ID'
    )

    const sql =
      useDatabase()

    await requireStudent(
      sql,
      studentId
    )

    const beforeData =
      await requireEnrollment(
        sql,
        studentId,
        enrollmentId
      )

    let normalizedStatus =
      beforeData.status

    if (
      status !==
        undefined
    ) {
      normalizedStatus =
        String(
          status || ''
        )
          .trim()
          .toUpperCase()

      if (
        ![
          'ACTIVE',
          'INACTIVE',
        ].includes(
          normalizedStatus
        )
      ) {
        throw createError({
          statusCode: 400,

          statusMessage:
            'Enrollment status 只能是 ACTIVE 或 INACTIVE',
        })
      }
    }

    let normalizedDefaultScheduleId =
      beforeData
        .default_schedule_id

    if (
      defaultScheduleId !==
        undefined
    ) {
      normalizedDefaultScheduleId =
        defaultScheduleId
          ? String(
              defaultScheduleId
            )
          : null

      if (
        normalizedDefaultScheduleId
      ) {
        const schedules =
          await getSchedulesForCourse(
            sql,
            beforeData.course_id,
            [
              normalizedDefaultScheduleId,
            ]
          )

        if (
          !schedules.length
        ) {
          throw createError({
            statusCode: 400,

            statusMessage:
              '找不到指定的主要 Schedule',
          })
        }
      }
    }

    const auditExists =
      await hasAuditLogsTable(
        sql
      )

    const queries = [
      sql`
        UPDATE
          student_enrollments

        SET
          status =
            ${normalizedStatus},

          default_schedule_id =
            ${normalizedDefaultScheduleId}

        WHERE
          id =
            ${enrollmentId}

          AND
            student_id =
            ${studentId}

        RETURNING
          *
      `,
    ]

    // ========================================================
    // 如果重新指定 Primary：
    //
    // 先將所有舊 Primary 清掉。
    // ========================================================

    if (
      normalizedDefaultScheduleId
    ) {
      queries.push(
        sql`
          UPDATE
            student_enrollment_schedules

          SET
            is_primary =
              FALSE,

            updated_at =
              NOW()

          WHERE
            enrollment_id =
              ${enrollmentId}

            AND
              is_primary =
              TRUE
        `
      )

      // ======================================================
      // 若 Schedule 已經存在，直接設 Primary。
      // ======================================================

      queries.push(
        sql`
          INSERT INTO
            student_enrollment_schedules (
              id,
              enrollment_id,
              schedule_id,
              is_primary,
              status
            )

          VALUES (
            ${randomUUID()},
            ${enrollmentId},
            ${normalizedDefaultScheduleId},
            TRUE,
            'ACTIVE'
          )

          ON CONFLICT (
            enrollment_id,
            schedule_id
          )

          DO UPDATE
          SET
            is_primary =
              TRUE,

            status =
              'ACTIVE',

            updated_at =
              NOW()
        `
      )
    }

    if (
      auditExists
    ) {
      const afterSnapshot = {
        ...beforeData,

        status:
          normalizedStatus,

        default_schedule_id:
          normalizedDefaultScheduleId,
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
            ${actorRole},
            'UPDATE',
            'ENROLLMENT',
            ${enrollmentId},
            ${studentId},
            ${beforeData.course_id},
            ${JSON.stringify(
              beforeData
            )}::jsonb,
            ${JSON.stringify(
              afterSnapshot
            )}::jsonb,
            '修改 Enrollment',
            NOW()
          )
        `
      )
    }

    await runTransaction(
      sql,
      queries
    )

    const updated =
      await requireEnrollment(
        sql,
        studentId,
        enrollmentId
      )

    const schedules =
      await getEnrollmentSchedules(
        enrollmentId
      )

    return {
      ...updated,

      schedules,

      primary_schedule:
        schedules.find(
          (
            schedule
          ) => {
            return Boolean(
              schedule.is_primary
            )
          }
        ) ||
        null,
    }
  }

// ============================================================
// 一次取代 Enrollment 所有固定班別
//
// 例如：
//
// 原本：
// 星期二
//
// 改成：
// 星期二
// 星期六
//
// scheduleIds：
// [A, B]
//
// primaryScheduleId：
// A
// ============================================================

export const replaceEnrollmentSchedules =
  async ({
    studentId,
    enrollmentId,
    scheduleIds,
    primaryScheduleId,
    actorUserId,
    actorRole =
      'TEACHER',
  }) => {
    assertUuid(
      actorUserId,
      '操作者 ID'
    )

    const sql =
      useDatabase()

    await requireStudent(
      sql,
      studentId
    )

    const enrollment =
      await requireEnrollment(
        sql,
        studentId,
        enrollmentId
      )

    // ========================================================
    // 去除重複
    // ========================================================

    const normalizedScheduleIds =
      [
        ...new Set(
          (
            Array.isArray(
              scheduleIds
            )
              ? scheduleIds
              : []
          )
            .filter(
              Boolean
            )
            .map(
              (
                value
              ) => {
                return String(
                  value
                )
              }
            )
        ),
      ]

    // ========================================================
    // 允許清空所有固定班別
    // ========================================================

    await getSchedulesForCourse(
      sql,
      enrollment.course_id,
      normalizedScheduleIds
    )

    let normalizedPrimaryScheduleId =
      primaryScheduleId
        ? String(
            primaryScheduleId
          )
        : null

    if (
      normalizedScheduleIds.length
    ) {
      // ======================================================
      // 如果沒有指定 Primary，
      // 就用第一個。
      // ======================================================

      if (
        !normalizedPrimaryScheduleId
      ) {
        normalizedPrimaryScheduleId =
          normalizedScheduleIds[0]
      }

      if (
        !normalizedScheduleIds.includes(
          normalizedPrimaryScheduleId
        )
      ) {
        throw createError({
          statusCode: 400,

          statusMessage:
            '主要班別必須包含在固定班別清單中',
        })
      }
    } else {
      normalizedPrimaryScheduleId =
        null
    }

    const beforeSchedules =
      await getEnrollmentSchedules(
        enrollmentId
      )

    const auditExists =
      await hasAuditLogsTable(
        sql
      )

    const queries = [
      // ======================================================
      // 先刪除所有舊關聯。
      //
      // 不會刪掉 class_schedules 本體。
      // ======================================================

      sql`
        DELETE FROM
          student_enrollment_schedules

        WHERE
          enrollment_id =
            ${enrollmentId}
      `,

      // ======================================================
      // 同步 default_schedule_id
      // ======================================================

      sql`
        UPDATE
          student_enrollments

        SET
          default_schedule_id =
            ${normalizedPrimaryScheduleId}

        WHERE
          id =
            ${enrollmentId}

          AND
            student_id =
            ${studentId}

        RETURNING
          *
      `,
    ]

    // ========================================================
    // 建立新的多 Schedule 關聯
    // ========================================================

    for (
      const scheduleId of
      normalizedScheduleIds
    ) {
      queries.push(
        sql`
          INSERT INTO
            student_enrollment_schedules (
              id,
              enrollment_id,
              schedule_id,
              is_primary,
              status
            )

          VALUES (
            ${randomUUID()},
            ${enrollmentId},
            ${scheduleId},
            ${
              scheduleId ===
              normalizedPrimaryScheduleId
            },
            'ACTIVE'
          )
        `
      )
    }

    if (
      auditExists
    ) {
      const afterData = {
        enrollment_id:
          enrollmentId,

        course_id:
          enrollment.course_id,

        default_schedule_id:
          normalizedPrimaryScheduleId,

        schedule_ids:
          normalizedScheduleIds,
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
            ${actorRole},
            'UPDATE',
            'ENROLLMENT',
            ${enrollmentId},
            ${studentId},
            ${enrollment.course_id},
            ${JSON.stringify({
              schedules:
                beforeSchedules,
            })}::jsonb,
            ${JSON.stringify(
              afterData
            )}::jsonb,
            '修改學生固定上課班別',
            NOW()
          )
        `
      )
    }

    await runTransaction(
      sql,
      queries
    )

    const schedules =
      await getEnrollmentSchedules(
        enrollmentId
      )

    return {
      enrollment: {
        ...enrollment,

        default_schedule_id:
          normalizedPrimaryScheduleId,
      },

      schedules,

      primarySchedule:
        schedules.find(
          (
            schedule
          ) => {
            return Boolean(
              schedule.is_primary
            )
          }
        ) ||
        null,
    }
  }