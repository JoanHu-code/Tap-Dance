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
// Package Usage Query
//
// 唯一堂數來源：
//
// attendance_records_v2
// status = ATTENDED
//
// 不管：
//
// NORMAL
// MAKEUP
// MANUAL
//
// 只要是真的 ATTENDED
// 都算消耗一堂。
// ============================================================

export const createPackageStateRecalculationQuery =
  (
    sql,
    packageId
  ) => {
    assertUuid(
      packageId,
      'Package ID'
    )

    return sql`
      WITH
      target AS (
        SELECT
          package.id,

          package.student_id,

          package.course_id,

          package.cycle_no,

          package.purchased_cycles,

          package.sessions_per_cycle,

          package.total_sessions,

          package.status,

          package.completion_reason,

          package.completed_at

        FROM
          student_packages package

        WHERE
          package.id =
            ${packageId}

        LIMIT 1
      ),

      usage_data AS (
        SELECT
          COUNT(*)::INTEGER
            AS used_sessions

        FROM
          attendance_records_v2 attendance

        WHERE
          attendance.package_id =
            ${packageId}

          AND
            attendance.status =
              'ATTENDED'
      ),

      successor_data AS (
        SELECT
          EXISTS (
            SELECT
              1

            FROM
              student_packages successor,

              target

            WHERE
              successor.student_id =
                target.student_id

              AND
                successor.course_id =
                  target.course_id

              AND (
                successor.previous_package_id =
                  target.id

                OR (
                  target.cycle_no IS NOT NULL

                  AND successor.cycle_no >
                    target.cycle_no
                )
              )
          )
            AS has_any_successor
      ),

      calculated AS (
        SELECT
          target.*,

          usage_data.used_sessions,

          successor_data.has_any_successor,

          CASE

            -- =================================================
            -- 手動取消的 Package 永遠保持 CANCELLED
            -- =================================================

            WHEN
              target.status =
                'CANCELLED'

            THEN
              'CANCELLED'


            -- =================================================
            -- 真正累積到總堂數
            -- =================================================

            WHEN
              usage_data.used_sessions >=
              target.total_sessions

            THEN
              'COMPLETED'


            -- =================================================
            -- 已經建立下一次付款的新 Package
            --
            -- 歷史資料即使被修改，
            -- 也不能重新 ACTIVE。
            -- =================================================

            WHEN
              successor_data.has_any_successor =
                TRUE

            THEN
              target.status


            -- =================================================
            -- 沒有下一期
            --
            -- 如果原本是因堂數用完而 COMPLETED，
            -- 後來 Attendance 被修正，
            -- 才可以恢復 ACTIVE。
            -- =================================================

            WHEN
              target.status =
                'COMPLETED'

              AND
                target.completion_reason =
                  'SESSIONS_USED_UP'

              AND
                usage_data.used_sessions <
                  target.total_sessions

            THEN
              'ACTIVE'


            ELSE
              target.status

          END
            AS next_status,

          CASE

            WHEN
              target.status =
                'CANCELLED'

            THEN
              target.completion_reason


            WHEN
              usage_data.used_sessions >=
              target.total_sessions

            THEN
              'SESSIONS_USED_UP'


            WHEN
              successor_data.has_any_successor =
                FALSE

              AND
                target.status =
                  'COMPLETED'

              AND
                target.completion_reason =
                  'SESSIONS_USED_UP'

              AND
                usage_data.used_sessions <
                  target.total_sessions

            THEN
              NULL


            ELSE
              target.completion_reason

          END
            AS next_completion_reason,

          CASE

            -- =================================================
            -- 第一次真正達到總堂數
            -- =================================================

            WHEN
              usage_data.used_sessions >=
                target.total_sessions

              AND
                target.completed_at IS NULL

            THEN
              NOW()


            -- =================================================
            -- 沒有 successor，
            -- 且堂數因修正而重新 ACTIVE，
            -- 清掉 completed_at。
            -- =================================================

            WHEN
              successor_data.has_any_successor =
                FALSE

              AND
                target.status =
                  'COMPLETED'

              AND
                target.completion_reason =
                  'SESSIONS_USED_UP'

              AND
                usage_data.used_sessions <
                  target.total_sessions

            THEN
              NULL


            ELSE
              target.completed_at

          END
            AS next_completed_at

        FROM
          target,
          usage_data,
          successor_data
      )

      UPDATE
        student_packages package

      SET
        status =
          calculated.next_status,

        completion_reason =
          calculated.next_completion_reason,

        completed_at =
          calculated.next_completed_at,

        updated_at =
          NOW()

      FROM
        calculated

      WHERE
        package.id =
          calculated.id

      RETURNING
        package.*
    `
  }

// ============================================================
// Package State
// ============================================================

export const getPackageState =
  async (
    packageId
  ) => {
    assertUuid(
      packageId,
      'Package ID'
    )

    const sql =
      useDatabase()

    const rows =
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

          package.completion_reason,

          package.completed_at,

          package.created_at,

          package.updated_at,

          student.name
            AS student_name,

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
            AS makeup_used_sessions,

          EXISTS (
            SELECT
              1

            FROM
              student_packages successor

            WHERE
              successor.student_id =
                package.student_id

              AND
                successor.course_id =
                  package.course_id

              AND (
                successor.previous_package_id =
                  package.id

                OR (
                  package.cycle_no IS NOT NULL

                  AND successor.cycle_no >
                    package.cycle_no
                )
              )
          )
            AS has_successor

        FROM
          student_packages package

        INNER JOIN
          students student

          ON student.id =
            package.student_id

        INNER JOIN
          dance_courses course

          ON course.id =
            package.course_id

        LEFT JOIN
          attendance_records_v2 attendance

          ON attendance.package_id =
            package.id

        WHERE
          package.id =
            ${packageId}

        GROUP BY
          package.id,
          student.id,
          course.id

        LIMIT 1
      `

    if (
      !rows.length
    ) {
      throw createError({
        statusCode: 404,

        statusMessage:
          '找不到 Package',
      })
    }

    const packageData =
      rows[0]

    const usedSessions =
      Number(
        packageData.used_sessions ||
        0
      )

    const totalSessions =
      Number(
        packageData.total_sessions ||
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
                usedSessions /
                totalSessions *
                100
              ),
              100
            )
          : 0,

      is_full:
        totalSessions >
          0 &&
        usedSessions >=
          totalSessions,

      can_renew:
        totalSessions >
          0 &&
        usedSessions >=
          totalSessions &&
        packageData.status !==
          'CANCELLED' &&
        !packageData.has_successor,
    }
  }

// ============================================================
// Recalculate Package
// ============================================================

export const recalculatePackageState =
  async (
    packageId
  ) => {
    assertUuid(
      packageId,
      'Package ID'
    )

    const sql =
      useDatabase()

    await createPackageStateRecalculationQuery(
      sql,
      packageId
    )

    return await getPackageState(
      packageId
    )
  }

// ============================================================
// Recalculate Multiple
// ============================================================

export const recalculatePackageStates =
  async (
    packageIds
  ) => {
    const uniqueIds =
      [
        ...new Set(
          (
            Array.isArray(
              packageIds
            )
              ? packageIds
              : []
          )
            .filter(
              Boolean
            )
            .map(
              (
                value
              ) =>
                String(
                  value
                ).trim()
            )
        ),
      ]

    if (
      !uniqueIds.length
    ) {
      return []
    }

    const result = []

    for (
      const packageId of
      uniqueIds
    ) {
      assertUuid(
        packageId,
        'Package ID'
      )

      result.push(
        await recalculatePackageState(
          packageId
        )
      )
    }

    return result
  }