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
        'STUDENT'
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
            'STUDENT',
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
            '此學生帳號目前未啟用',
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
              'STUDENT',

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

        WHERE
          user_id =
            ${user.id}

        LIMIT 1
      `

    if (
      !students.length
    ) {
      return {
        success: true,

        role:
          'STUDENT',

        linked: false,

        user,

        student: null,

        dashboard: {
          enrollments: [],

          packages: [],

          attendanceRecords:
            [],

          bankAccount: null,
        },
      }
    }

    const student =
      students[0]

    const enrollments =
      await sql`
        SELECT
          e.*,

          c.name
            AS course_name,

          s.weekday
            AS schedule_weekday,

          s.start_time
            AS schedule_start_time

        FROM
          student_enrollments e

        LEFT JOIN
          dance_courses c

          ON c.id =
            e.course_id

        LEFT JOIN
          class_schedules s

          ON s.id =
            e.default_schedule_id

        WHERE
          e.student_id =
            ${student.id}

        ORDER BY
          e.id DESC
      `

    const packages =
      await sql`
        SELECT
          *

        FROM
          student_packages

        WHERE
          student_id =
            ${student.id}

        ORDER BY
          id DESC

        LIMIT 30
      `

    const attendanceRecords =
      await sql`
        SELECT
          *

        FROM
          attendance_records_v2

        WHERE
          student_id =
            ${student.id}

        ORDER BY
          id DESC

        LIMIT 8
      `

    const activePackage =
      packages.find(
        (
          item
        ) => {
          return (
            item.status ===
            'ACTIVE'
          )
        }
      ) ||
      packages[0] ||
      null

    let bankAccount =
      null

    if (
      activePackage
        ?.bank_account_id
    ) {
      const bankAccounts =
        await sql`
          SELECT
            *

          FROM
            bank_accounts

          WHERE
            id =
              ${activePackage.bank_account_id}

          LIMIT 1
        `

      bankAccount =
        bankAccounts[0] ||
        null
    }

    return {
      success: true,

      role:
        'STUDENT',

      linked: true,

      user,

      student,

      dashboard: {
        enrollments,

        packages,

        attendanceRecords,

        bankAccount,
      },
    }
  }
)