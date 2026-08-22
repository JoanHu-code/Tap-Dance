import {
  useDatabase,
} from '../../../utils/db.js'

import {
  requireTeacherOrganization,
} from '../../../utils/teacherAuth.js'

export default defineEventHandler(
  async (event) => {
    const {
      organization,
    } =
      await requireTeacherOrganization(
        event
      )

    const sql =
      useDatabase()

    const courses =
      await sql`
        SELECT
          dc.id,
          dc.name,
          dc.description,
          dc.status,
          dc.created_at,

          COUNT(
            DISTINCT cs.id
          )::INTEGER
            AS schedule_count

        FROM dance_courses dc

        LEFT JOIN class_schedules cs
          ON cs.course_id =
            dc.id

        WHERE
          dc.organization_id =
            ${organization.id}

        GROUP BY
          dc.id

        ORDER BY
          CASE
            WHEN dc.status = 'ACTIVE'
              THEN 0
            ELSE 1
          END,
          dc.name ASC
      `

    const schedules =
      await sql`
        SELECT
          cs.id,
          cs.course_id,
          cs.weekday,
          cs.start_time,
          cs.end_time,
          cs.name,
          cs.capacity,
          cs.status,
          cs.teacher_user_id,

          u.display_name
            AS teacher_name

        FROM class_schedules cs

        INNER JOIN dance_courses dc
          ON dc.id =
            cs.course_id

        LEFT JOIN app_users u
          ON u.id =
            cs.teacher_user_id

        WHERE
          dc.organization_id =
            ${organization.id}

        ORDER BY
          cs.weekday ASC,
          cs.start_time ASC
      `

    const result =
      courses.map(
        (course) => ({
          id:
            course.id,

          name:
            course.name,

          description:
            course.description,

          status:
            course.status,

          scheduleCount:
            Number(
              course.schedule_count ||
              0
            ),

          createdAt:
            course.created_at,

          schedules:
            schedules
              .filter(
                (schedule) =>
                  schedule.course_id ===
                  course.id
              )
              .map(
                (schedule) => ({
                  id:
                    schedule.id,

                  weekday:
                    Number(
                      schedule.weekday
                    ),

                  startTime:
                    schedule.start_time,

                  endTime:
                    schedule.end_time,

                  name:
                    schedule.name,

                  capacity:
                    schedule.capacity,

                  status:
                    schedule.status,

                  teacherUserId:
                    schedule.teacher_user_id,

                  teacherName:
                    schedule.teacher_name,
                })
              ),
        })
      )

    return {
      organization: {
        id:
          organization.id,

        name:
          organization.name,
      },

      courses:
        result,
    }
  }
)