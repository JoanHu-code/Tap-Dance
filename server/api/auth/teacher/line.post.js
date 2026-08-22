export default defineEventHandler(
  async (event) => {
    const body =
      await readBody(
        event
      )

    const idToken =
      body?.idToken

    if (!idToken) {
      throw createError({
        statusCode: 400,
        statusMessage:
          '缺少 LINE ID Token',
      })
    }

    const lineProfile =
      await verifyLineIdToken(
        idToken,
        'TEACHER'
      )

    const sql =
      useDatabase()

    let users =
      await sql`
        SELECT
          id,
          line_user_id,
          display_name,
          picture_url,
          role,
          status

        FROM app_users

        WHERE
          line_user_id =
            ${lineProfile.lineUserId}

        LIMIT 1
      `

    let user =
      users[0] ||
      null

    if (!user) {
      const inserted =
        await sql`
          INSERT INTO
            app_users (
              line_user_id,
              display_name,
              picture_url,
              role,
              status
            )

          VALUES (
            ${lineProfile.lineUserId},
            ${lineProfile.displayName},
            ${lineProfile.pictureUrl},
            'TEACHER',
            'ACTIVE'
          )

          RETURNING
            id,
            line_user_id,
            display_name,
            picture_url,
            role,
            status
        `

      user =
        inserted[0]
    } else {
      if (
        user.status !==
        'ACTIVE'
      ) {
        throw createError({
          statusCode: 403,
          statusMessage:
            '此帳號目前未啟用',
        })
      }

      const updated =
        await sql`
          UPDATE app_users

          SET
            display_name =
              ${lineProfile.displayName},

            picture_url =
              ${lineProfile.pictureUrl},

            role =
              'TEACHER',

            status =
              'ACTIVE'

          WHERE
            id =
              ${user.id}

          RETURNING
            id,
            line_user_id,
            display_name,
            picture_url,
            role,
            status
        `

      user =
        updated[0]
    }

    await createAuthSession(
      event,
      user.id
    )

    const students =
      await sql`
        SELECT
          *

        FROM students

        ORDER BY
          id DESC

        LIMIT 100
      `

    const courses =
      await sql`
        SELECT
          *

        FROM dance_courses

        ORDER BY
          id DESC
      `

    return {
      success: true,

      role:
        'TEACHER',

      user,

      dashboard: {
        students,

        courses,

        summary: {
          studentCount:
            students.length,

          courseCount:
            courses.length,

          linkedStudentCount:
            students.filter(
              (
                student
              ) => {
                return Boolean(
                  student.user_id
                )
              }
            ).length,
        },
      },
    }
  }
)