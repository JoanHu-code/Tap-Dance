import {
  requireAuth,
} from '../../../utils/authSession.js'

import {
  useDatabase,
} from '../../../utils/db.js'

import {
  getLeaveBatches,
} from '../../../services/leaveService.js'

export default defineEventHandler(
  async (
    event
  ) => {
    // ========================================================
    // Teacher Auth
    // ========================================================

    const user =
      await requireAuth(
        event
      )

    if (
      user.role !==
      'TEACHER'
    ) {
      throw createError({
        statusCode: 403,

        statusMessage:
          '只有老師可以查看完整請假紀錄',
      })
    }

    const query =
      getQuery(
        event
      )

    // ========================================================
    // Leave Batches
    // ========================================================

    const batches =
      await getLeaveBatches({
        studentId:
          query.studentId ||
          null,

        courseId:
          query.courseId ||
          null,

        status:
          query.status ||
          null,

        startDate:
          query.startDate ||
          null,

        endDate:
          query.endDate ||
          null,
      })

    const sql =
      useDatabase()

    // ========================================================
    // Students
    // ========================================================

    const students =
      await sql`
        SELECT
          id,
          name,
          user_id,
          status

        FROM
          students

        WHERE
          status =
            'ACTIVE'

        ORDER BY
          name ASC
      `

    // ========================================================
    // Courses
    // ========================================================

    const courses =
      await sql`
        SELECT
          id,
          name,
          status

        FROM
          dance_courses

        WHERE
          status =
            'ACTIVE'

        ORDER BY
          name ASC
      `

    // ========================================================
    // Sessions
    //
    // 給老師建立請假用。
    // ========================================================

    const sessions =
      await sql`
        SELECT
          session.id,

          session.schedule_id,

          session.class_date,

          session.start_time,

          session.end_time,

          session.status,

          schedule.course_id,

          schedule.weekday,

          schedule.name
            AS schedule_name,

          course.name
            AS course_name

        FROM
          class_sessions session

        INNER JOIN
          class_schedules schedule

          ON schedule.id =
            session.schedule_id

        INNER JOIN
          dance_courses course

          ON course.id =
            schedule.course_id

        WHERE
          session.status NOT IN (
            'TEACHER_LEAVE',
            'CANCELLED'
          )

          AND
            session.class_date >=
              CURRENT_DATE -
              INTERVAL '180 days'

          AND
            session.class_date <=
              CURRENT_DATE +
              INTERVAL '365 days'

        ORDER BY
          session.class_date ASC,
          session.start_time ASC
      `

    // ========================================================
    // Summary
    // ========================================================

    const summary = {
      total:
        batches.length,

      active:
        batches.filter(
          (
            batch
          ) => {
            return (
              batch.status ===
              'ACTIVE'
            )
          }
        ).length,

      cancelled:
        batches.filter(
          (
            batch
          ) => {
            return (
              batch.status ===
              'CANCELLED'
            )
          }
        ).length,

      totalSessions:
        batches.reduce(
          (
            total,
            batch
          ) => {
            return (
              total +
              Number(
                batch.item_count ||
                batch.items
                  ?.length ||
                0
              )
            )
          },
          0
        ),
    }

    return {
      success: true,

      summary,

      batches,

      students,

      courses,

      sessions,
    }
  }
)