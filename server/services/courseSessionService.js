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
  value
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
        '日期格式必須為 YYYY-MM-DD',
    })
  }

  const date =
    new Date(
      `${normalized}T00:00:00Z`
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

  return normalized
}

// ============================================================
// Weekday
//
// DB:
// 1 = Monday
// ...
// 7 = Sunday
// ============================================================

const getDateWeekday = (
  dateString
) => {
  const date =
    new Date(
      `${dateString}T00:00:00Z`
    )

  const day =
    date.getUTCDay()

  return (
    day === 0
      ? 7
      : day
  )
}

// ============================================================
// Get Course
// ============================================================

export const getCourseSessionCourse =
  async (
    courseId
  ) => {
    const normalizedCourseId =
      assertUuid(
        courseId,
        'Course ID'
      )

    const sql =
      useDatabase()

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
            ${normalizedCourseId}

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
      !course.weekday ||
      !course.start_time ||
      !course.end_time
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '此課堂尚未設定星期與上課時間',
      })
    }

    return course
  }

// ============================================================
// Is Course Date
// ============================================================

export const isCourseClassDate =
  (
    course,
    classDate
  ) => {
    const normalizedDate =
      normalizeDate(
        classDate
      )

    return (
      Number(
        course.weekday
      ) ===
      getDateWeekday(
        normalizedDate
      )
    )
  }

// ============================================================
// Find Session
//
// 同時相容：
//
// 新資料：class_sessions.course_id
//
// 舊資料：
// class_sessions.schedule_id
// → class_schedules.course_id
// ============================================================

export const findCourseSession =
  async ({
    courseId,
    classDate,
  }) => {
    const normalizedCourseId =
      assertUuid(
        courseId,
        'Course ID'
      )

    const normalizedDate =
      normalizeDate(
        classDate
      )

    const sql =
      useDatabase()

    const rows =
      await sql`
        SELECT
          session.id,

          COALESCE(
            session.course_id,
            schedule.course_id
          )
            AS course_id,

          session.schedule_id,

          session.class_date,

          session.start_time,

          session.end_time,

          session.status,

          session.teacher_note,

          session.created_at,

          session.updated_at

        FROM
          class_sessions session

        LEFT JOIN
          class_schedules schedule

          ON schedule.id =
            session.schedule_id

        WHERE
          (
            session.course_id =
              ${normalizedCourseId}

            OR (
              session.course_id IS NULL

              AND
                schedule.course_id =
                  ${normalizedCourseId}
            )
          )

          AND
            session.class_date =
              ${normalizedDate}

        ORDER BY
          session.created_at ASC

        LIMIT 1
      `

    return (
      rows[0] ||
      null
    )
  }

// ============================================================
// Ensure Session
//
// 只有真的需要寫 Attendance 時才建立 Session。
// 不會一次預先生成八週、二十四週。
// ============================================================

export const ensureCourseSession =
  async ({
    courseId,
    classDate,
  }) => {
    const normalizedCourseId =
      assertUuid(
        courseId,
        'Course ID'
      )

    const normalizedDate =
      normalizeDate(
        classDate
      )

    const course =
      await getCourseSessionCourse(
        normalizedCourseId
      )

    if (
      course.status !==
      'ACTIVE'
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '此課堂目前已停用',
      })
    }

    if (
      !isCourseClassDate(
        course,
        normalizedDate
      )
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '選擇的日期不是此課堂的固定上課日',
      })
    }

    // ========================================================
    // Existing
    // ========================================================

    const existing =
      await findCourseSession({
        courseId:
          normalizedCourseId,

        classDate:
          normalizedDate,
      })

    if (
      existing
    ) {
      return {
        session:
          existing,

        course,

        created:
          false,
      }
    }

    const sql =
      useDatabase()

    const sessionId =
      randomUUID()

    // ========================================================
    // Insert
    // ========================================================

    try {
      const rows =
        await sql`
          INSERT INTO
            class_sessions (
              id,

              course_id,

              schedule_id,

              class_date,

              start_time,

              end_time,

              status,

              teacher_note,

              created_at,

              updated_at
            )

          VALUES (
            ${sessionId},

            ${normalizedCourseId},

            NULL,

            ${normalizedDate},

            ${course.start_time},

            ${course.end_time},

            'SCHEDULED',

            NULL,

            NOW(),

            NOW()
          )

          RETURNING
            id,
            course_id,
            schedule_id,
            class_date,
            start_time,
            end_time,
            status,
            teacher_note,
            created_at,
            updated_at
        `

      return {
        session:
          rows[0],

        course,

        created:
          true,
      }
    } catch (
      error
    ) {
      // ======================================================
      // Concurrent Insert
      // ======================================================

      if (
        error?.code ===
        '23505'
      ) {
        const racedSession =
          await findCourseSession({
            courseId:
              normalizedCourseId,

            classDate:
              normalizedDate,
          })

        if (
          racedSession
        ) {
          return {
            session:
              racedSession,

            course,

            created:
              false,
          }
        }
      }

      throw error
    }
  }

// ============================================================
// Get Courses for Attendance UI
// ============================================================

export const getAttendanceCourses =
  async () => {
    const sql =
      useDatabase()

    return await sql`
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

      ORDER BY
        weekday ASC,
        start_time ASC,
        name ASC
    `
  }
