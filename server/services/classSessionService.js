import {
  useDatabase,
} from '../utils/db.js'

const isValidDate = (value) => {
  return /^\d{4}-\d{2}-\d{2}$/.test(
    String(value || '')
  )
}

export const getIsoWeekday = (
  dateString
) => {
  if (!isValidDate(dateString)) {
    throw createError({
      statusCode: 400,
      statusMessage:
        '日期格式不正確',
    })
  }

  const date =
    new Date(
      `${dateString}T00:00:00Z`
    )

  const weekday =
    date.getUTCDay()

  return weekday === 0
    ? 7
    : weekday
}

// ============================================================
// 依日期，自動建立當天應該存在的實際課程
// ============================================================

export const ensureSessionsForDate =
  async ({
    organizationId,
    date,
  }) => {
    const sql =
      useDatabase()

    const weekday =
      getIsoWeekday(date)

    const schedules =
      await sql`
        SELECT
          cs.id,
          cs.start_time,
          cs.end_time

        FROM class_schedules cs

        INNER JOIN dance_courses dc
          ON dc.id =
            cs.course_id

        WHERE
          dc.organization_id =
            ${organizationId}

          AND dc.status =
            'ACTIVE'

          AND cs.status =
            'ACTIVE'

          AND cs.weekday =
            ${weekday}
      `

    for (
      const schedule
      of schedules
    ) {
      await sql`
        INSERT INTO
          class_sessions (
            schedule_id,
            class_date,
            start_time,
            end_time,
            status
          )

        VALUES (
          ${schedule.id},
          ${date},
          ${schedule.start_time},
          ${schedule.end_time},
          'SCHEDULED'
        )

        ON CONFLICT (
          schedule_id,
          class_date
        )
        DO NOTHING
      `
    }

    return await sql`
      SELECT
        sess.id,
        sess.schedule_id,
        sess.class_date,
        sess.start_time,
        sess.end_time,
        sess.status,
        sess.teacher_note,

        cs.weekday,
        cs.name
          AS schedule_name,

        cs.capacity,

        dc.id
          AS course_id,

        dc.name
          AS course_name

      FROM class_sessions sess

      INNER JOIN class_schedules cs
        ON cs.id =
          sess.schedule_id

      INNER JOIN dance_courses dc
        ON dc.id =
          cs.course_id

      WHERE
        dc.organization_id =
          ${organizationId}

        AND sess.class_date =
          ${date}

      ORDER BY
        sess.start_time ASC,
        dc.name ASC
    `
  }