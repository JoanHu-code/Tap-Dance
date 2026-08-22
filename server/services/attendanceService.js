import { useDatabase } from '../utils/db.js'

import {
  canCancelTodayRecord,
  getTaipeiDateString,
} from '../utils/taipeiTime.js'

// ============================================================
// 取得目前進行中的期數
// ============================================================

const getCurrentPeriod = async () => {
  const sql = useDatabase()

  const periods = await sql`
    SELECT
      cp.id,
      cp.course_id,
      cp.period_no,
      cp.status,
      cp.paid,
      cp.paid_at,

      c.name AS course_name,
      c.teacher_name,
      c.total_sessions,
      c.price

    FROM course_periods cp

    INNER JOIN courses c
      ON c.id = cp.course_id

    WHERE cp.status = 'ACTIVE'

    ORDER BY
      cp.period_no DESC

    LIMIT 1
  `

  if (!periods.length) {
    throw createError({
      statusCode: 404,
      statusMessage: '目前沒有進行中的課程',
    })
  }

  return periods[0]
}

// ============================================================
// 取得完整上課資料
// ============================================================

export const getAttendanceData = async () => {
  const sql = useDatabase()

  const period = await getCurrentPeriod()

  const records = await sql`
    SELECT
      id,
      class_date,
      status,
      original_status,
      confirmed,
      cancelled_at,
      created_at,
      updated_at

    FROM attendance_records

    WHERE period_id = ${period.id}

    ORDER BY
      class_date DESC,
      id DESC
  `

  const attendedCount =
    records.filter(
      (record) =>
        record.status === 'ATTENDED'
    ).length

  const leaveCount =
    records.filter(
      (record) =>
        record.status === 'LEAVE'
    ).length

  const totalSessions =
    Number(period.total_sessions)

  const remainingSessions =
    Math.max(
      totalSessions - attendedCount,
      0
    )

  const progressPercentage =
    totalSessions > 0
      ? Math.min(
          Math.round(
            (
              attendedCount /
              totalSessions
            ) * 100
          ),
          100
        )
      : 0

  return {
    course: {
      id: period.course_id,
      name: period.course_name,
      teacherName:
        period.teacher_name,
      totalSessions,
      price:
        Number(period.price),
    },

    currentPeriod: {
      id: period.id,
      periodNo:
        Number(period.period_no),
      status:
        period.status,
      paid:
        period.paid,
      paidAt:
        period.paid_at,
    },

    summary: {
      attendedCount,
      leaveCount,
      remainingSessions,
      progressPercentage,

      isPeriodCompleted:
        attendedCount >=
        totalSessions,
    },

    attendanceRecords:
      records.map(
        (record) => ({
          id:
            Number(record.id),

          date:
            record.class_date,

          status:
            record.status,

          originalStatus:
            record.original_status,

          confirmed:
            record.confirmed,

          cancelledAt:
            record.cancelled_at,

          createdAt:
            record.created_at,

          updatedAt:
            record.updated_at,
        })
      ),
  }
}

// ============================================================
// 新增上課 / 請假
// ============================================================

export const createAttendanceRecord =
  async (status) => {
    const sql = useDatabase()

    const allowedStatuses = [
      'ATTENDED',
      'LEAVE',
    ]

    if (
      !allowedStatuses.includes(
        status
      )
    ) {
      throw createError({
        statusCode: 400,
        statusMessage:
          '無效的上課狀態',
      })
    }

    const period =
      await getCurrentPeriod()

    const today =
      getTaipeiDateString()

    // --------------------------------------------------------
    // 上課堂數不可超過本期上限
    // --------------------------------------------------------

    if (
      status === 'ATTENDED'
    ) {
      const result =
        await sql`
          SELECT
            COUNT(*)::INTEGER
              AS count

          FROM attendance_records

          WHERE period_id =
            ${period.id}

            AND status =
              'ATTENDED'
        `

      const attendedCount =
        Number(
          result[0]?.count || 0
        )

      if (
        attendedCount >=
        Number(
          period.total_sessions
        )
      ) {
        throw createError({
          statusCode: 409,
          statusMessage:
            '本期課程已經完成',
        })
      }
    }

    try {
      const records =
        await sql`
          INSERT INTO
            attendance_records (
              period_id,
              class_date,
              status,
              confirmed
            )

          VALUES (
            ${period.id},
            ${today},
            ${status},
            FALSE
          )

          RETURNING
            id,
            class_date,
            status,
            original_status,
            confirmed,
            cancelled_at,
            created_at,
            updated_at
        `

      const record =
        records[0]

      return {
        id:
          Number(record.id),

        date:
          record.class_date,

        status:
          record.status,

        originalStatus:
          record.original_status,

        confirmed:
          record.confirmed,

        cancelledAt:
          record.cancelled_at,

        createdAt:
          record.created_at,

        updatedAt:
          record.updated_at,
      }
    } catch (error) {
      if (
        error?.code === '23505'
      ) {
        throw createError({
          statusCode: 409,
          statusMessage:
            '今天已經有紀錄了',
        })
      }

      throw error
    }
  }

// ============================================================
// 取消紀錄
// ============================================================

export const cancelAttendanceRecord =
  async (id) => {
    const sql = useDatabase()

    const recordId =
      Number(id)

    if (
      !Number.isInteger(
        recordId
      ) ||
      recordId <= 0
    ) {
      throw createError({
        statusCode: 400,
        statusMessage:
          '紀錄 ID 不正確',
      })
    }

    const records =
      await sql`
        SELECT
          id,
          class_date,
          status

        FROM attendance_records

        WHERE id =
          ${recordId}

        LIMIT 1
      `

    if (!records.length) {
      throw createError({
        statusCode: 404,
        statusMessage:
          '找不到這筆紀錄',
      })
    }

    const record =
      records[0]

    if (
      record.status ===
      'CANCELLED'
    ) {
      throw createError({
        statusCode: 409,
        statusMessage:
          '這筆紀錄已經取消',
      })
    }

    // --------------------------------------------------------
    // 台灣時間當天 12:00 後不可取消
    // --------------------------------------------------------

    if (
      !canCancelTodayRecord(
        record.class_date
      )
    ) {
      throw createError({
        statusCode: 403,
        statusMessage:
          '已超過取消期限，當天中午 12:00 後無法取消紀錄',
      })
    }

    const updated =
      await sql`
        UPDATE
          attendance_records

        SET
          original_status =
            status,

          status =
            'CANCELLED',

          confirmed =
            FALSE,

          cancelled_at =
            NOW(),

          updated_at =
            NOW()

        WHERE id =
          ${recordId}

          AND status <>
            'CANCELLED'

        RETURNING
          id,
          class_date,
          status,
          original_status,
          confirmed,
          cancelled_at,
          created_at,
          updated_at
      `

    if (!updated.length) {
      throw createError({
        statusCode: 409,
        statusMessage:
          '這筆紀錄目前無法取消',
      })
    }

    const result =
      updated[0]

    return {
      id:
        Number(result.id),

      date:
        result.class_date,

      status:
        result.status,

      originalStatus:
        result.original_status,

      confirmed:
        result.confirmed,

      cancelledAt:
        result.cancelled_at,

      createdAt:
        result.created_at,

      updatedAt:
        result.updated_at,
    }
  }