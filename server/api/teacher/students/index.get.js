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

    const students =
      await sql`
        SELECT
          s.id,
          s.name,
          s.phone,
          s.note,
          s.status,
          s.user_id,

          u.display_name
            AS line_display_name,

          u.picture_url
            AS line_picture_url,

          u.status
            AS line_status,

          COUNT(
            DISTINCT se.id
          )::INTEGER
            AS course_count,

          s.created_at

        FROM students s

        LEFT JOIN app_users u
          ON u.id =
            s.user_id

        LEFT JOIN student_enrollments se
          ON se.student_id =
            s.id

          AND se.status =
            'ACTIVE'

        WHERE
          s.organization_id =
            ${organization.id}

        GROUP BY
          s.id,
          u.display_name,
          u.picture_url,
          u.status

        ORDER BY
          s.status ASC,
          s.name ASC
      `

    return {
      organization: {
        id:
          organization.id,

        name:
          organization.name,
      },

      students:
        students.map(
          (student) => ({
            id:
              student.id,

            name:
              student.name,

            phone:
              student.phone,

            note:
              student.note,

            status:
              student.status,

            userId:
              student.user_id,

            hasLine:
              Boolean(
                student.user_id
              ),

            lineDisplayName:
              student.line_display_name,

            linePictureUrl:
              student.line_picture_url,

            lineStatus:
              student.line_status,

            courseCount:
              Number(
                student.course_count ||
                0
              ),

            createdAt:
              student.created_at,
          })
        ),
    }
  }
)