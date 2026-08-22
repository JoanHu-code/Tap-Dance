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
// Package State Query
//
// 這支 Query 可以被放進其他 Transaction。
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

          package.total_sessions,

          package.status,

          package.completion_reason

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
            AS attended_count

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
              student_packages successor

            INNER JOIN
              target

              ON successor.student_id =
                target.student_id

              AND successor.course_id =
                target.course_id

            WHERE
              successor.status <>
                'CANCELLED'

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
            AS has_successor
      ),

      calculated AS (
        SELECT
          target.*,

          usage_data.attended_count,

          successor_data.has_successor,

          CASE

            -- =================================================
            -- CANCELLED 永遠保持 CANCELLED
            -- =================================================

            WHEN
              target.status =
                'CANCELLED'

            THEN
              'CANCELLED'


            -- =================================================
            -- 堂數滿
            -- =================================================

            WHEN
              usage_data.attended_count >=
              target.total_sessions

            THEN
              'COMPLETED'


            -- =================================================
            -- 歷史 Package 已經有下一期
            --
            -- 即使 Attendance 後來減少，
            -- 也不能重新 ACTIVE。
            -- =================================================

            WHEN
              successor_data.has_successor =
                TRUE

            THEN
              target.status


            -- =================================================
            -- 沒 successor，
            -- 而且以前只是因為堂數滿才 COMPLETED，
            -- 現在堂數又被修正降低，
            -- 才允許恢復 ACTIVE。
            -- =================================================

            WHEN
              target.status =
                'COMPLETED'

              AND
                target.completion_reason =
                  'SESSIONS_USED_UP'

              AND
                usage_data.attended_count <
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
              usage_data.attended_count >=
              target.total_sessions

            THEN
              'SESSIONS_USED_UP'


            WHEN
              successor_data.has_successor =
                FALSE

              AND
                target.status =
                  'COMPLETED'

              AND
                target.completion_reason =
                  'SESSIONS_USED_UP'

              AND
                usage_data.attended_count <
                  target.total_sessions

            THEN
              NULL


            ELSE
              target.completion_reason

          END
            AS next_completion_reason

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
// Get Package State
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
          package.*,

          course.name
            AS course_name,

          student.name
            AS student_name,

          COALESCE(
            COUNT(attendance.id)
              FILTER (
                WHERE
                  attendance.status =
                    'ATTENDED'
              ),
            0
          )::INTEGER
            AS attended_count,

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

              AND
                successor.status <>
                  'CANCELLED'

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

    const attended =
      Number(
        packageData.attended_count ||
        0
      )

    const total =
      Number(
        packageData.total_sessions ||
        0
      )

    return {
      ...packageData,

      attended_count:
        attended,

      remaining_sessions:
        Math.max(
          total -
          attended,
          0
        ),

      is_full:
        total >
          0 &&
        attended >=
          total,

      can_renew:
        total >
          0 &&
        attended >=
          total &&
        !packageData.has_successor &&
        packageData.status !==
          'CANCELLED',
    }
  }

// ============================================================
// Recalculate One Package
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

    await runTransaction(
      sql,
      [
        createPackageStateRecalculationQuery(
          sql,
          packageId
        ),
      ]
    )

    return await getPackageState(
      packageId
    )
  }

// ============================================================
// Recalculate Multiple Packages
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
              ) => {
                return String(
                  value
                ).trim()
              }
            )
        ),
      ]

    if (
      !uniqueIds.length
    ) {
      return []
    }

    for (
      const packageId of
      uniqueIds
    ) {
      assertUuid(
        packageId,
        'Package ID'
      )
    }

    const sql =
      useDatabase()

    const queries =
      uniqueIds.map(
        (
          packageId
        ) => {
          return createPackageStateRecalculationQuery(
            sql,
            packageId
          )
        }
      )

    await runTransaction(
      sql,
      queries
    )

    const result = []

    for (
      const packageId of
      uniqueIds
    ) {
      result.push(
        await getPackageState(
          packageId
        )
      )
    }

    return result
  }