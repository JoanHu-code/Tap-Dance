import {
  useDatabase,
} from '../../../../utils/db.js'

import {
  requireTeacherOrganization,
} from '../../../../utils/teacherAuth.js'

export default defineEventHandler(
  async (event) => {
    const {
      organization,
    } =
      await requireTeacherOrganization(
        event
      )

    const studentId =
      getRouterParam(
        event,
        'id'
      )

    if (!studentId) {
      throw createError({
        statusCode: 400,
        statusMessage:
          '缺少學生 ID',
      })
    }

    const sql =
      useDatabase()

    // ========================================================
    // 學生基本資料
    // ========================================================

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
            AS line_picture_url

        FROM students s

        LEFT JOIN app_users u
          ON u.id =
            s.user_id

        WHERE
          s.id =
            ${studentId}

          AND s.organization_id =
            ${organization.id}

        LIMIT 1
      `

    if (!students.length) {
      throw createError({
        statusCode: 404,
        statusMessage:
          '找不到這位學生',
      })
    }

    const student =
      students[0]

    // ========================================================
    // 教室所有啟用中的課程
    // ========================================================

    const courses =
      await sql`
        SELECT
          dc.id,
          dc.name,
          dc.description,
          dc.status

        FROM dance_courses dc

        WHERE
          dc.organization_id =
            ${organization.id}

          AND dc.status =
            'ACTIVE'

        ORDER BY
          dc.name ASC
      `

    // ========================================================
    // 所有可用時段
    // ========================================================

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
          cs.status

        FROM class_schedules cs

        INNER JOIN dance_courses dc
          ON dc.id =
            cs.course_id

        WHERE
          dc.organization_id =
            ${organization.id}

          AND cs.status =
            'ACTIVE'

        ORDER BY
          cs.weekday ASC,
          cs.start_time ASC
      `

    // ========================================================
    // 學生目前加入的課程
    // ========================================================

    const enrollments =
      await sql`
        SELECT
          se.id,
          se.course_id,
          se.default_schedule_id,
          se.status,
          se.joined_at,

          dc.name
            AS course_name,

          cs.weekday,
          cs.start_time,
          cs.end_time,
          cs.name
            AS schedule_name

        FROM student_enrollments se

        INNER JOIN dance_courses dc
          ON dc.id =
            se.course_id

        LEFT JOIN class_schedules cs
          ON cs.id =
            se.default_schedule_id

        WHERE
          se.student_id =
            ${studentId}

        ORDER BY
          se.status ASC,
          dc.name ASC
      `

    // ========================================================
    // 堂數方案
    //
    // ATTENDED 才算真正使用一堂。
    // LEAVE / CANCELLED 不計入。
    // ========================================================

    const packages =
      await sql`
        SELECT
          sp.id,
          sp.course_id,
          sp.start_date,
          sp.total_sessions,
          sp.price,
          sp.status,
          sp.paid,
          sp.paid_at,
          sp.bank_account_id,
          sp.created_at,

          dc.name
            AS course_name,

          ba.bank_name,
          ba.bank_code,
          ba.branch_name,
          ba.account_name,
          ba.account_number,

          COUNT(
            ar.id
          ) FILTER (
            WHERE
              ar.status =
                'ATTENDED'
          )::INTEGER
            AS used_sessions

        FROM student_packages sp

        INNER JOIN dance_courses dc
          ON dc.id =
            sp.course_id

        LEFT JOIN bank_accounts ba
          ON ba.id =
            sp.bank_account_id

        LEFT JOIN attendance_records_v2 ar
          ON ar.package_id =
            sp.id

        WHERE
          sp.student_id =
            ${studentId}

        GROUP BY
          sp.id,
          dc.name,
          ba.id

        ORDER BY
          sp.start_date DESC,
          sp.created_at DESC
      `

    // ========================================================
    // 收款銀行帳戶
    // ========================================================

    const bankAccounts =
      await sql`
        SELECT
          id,
          bank_name,
          bank_code,
          branch_name,
          account_name,
          account_number,
          is_default

        FROM bank_accounts

        WHERE
          organization_id =
            ${organization.id}

        ORDER BY
          is_default DESC,
          created_at ASC
      `

    return {
      student: {
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
      },

      courses:
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
                  })
                ),
          })
        ),

      enrollments:
        enrollments.map(
          (item) => ({
            id:
              item.id,

            courseId:
              item.course_id,

            courseName:
              item.course_name,

            defaultScheduleId:
              item.default_schedule_id,

            status:
              item.status,

            joinedAt:
              item.joined_at,

            schedule:
              item.default_schedule_id
                ? {
                    weekday:
                      Number(
                        item.weekday
                      ),

                    startTime:
                      item.start_time,

                    endTime:
                      item.end_time,

                    name:
                      item.schedule_name,
                  }
                : null,
          })
        ),

      packages:
        packages.map(
          (item) => {
            const totalSessions =
              Number(
                item.total_sessions
              )

            const usedSessions =
              Number(
                item.used_sessions ||
                0
              )

            return {
              id:
                item.id,

              courseId:
                item.course_id,

              courseName:
                item.course_name,

              startDate:
                item.start_date,

              totalSessions,

              usedSessions,

              remainingSessions:
                Math.max(
                  totalSessions -
                    usedSessions,
                  0
                ),

              price:
                Number(
                  item.price
                ),

              status:
                item.status,

              paid:
                item.paid,

              paidAt:
                item.paid_at,

              bankAccountId:
                item.bank_account_id,

              bankAccount:
                item.bank_account_id
                  ? {
                      bankName:
                        item.bank_name,

                      bankCode:
                        item.bank_code,

                      branchName:
                        item.branch_name,

                      accountName:
                        item.account_name,

                      accountNumber:
                        item.account_number,
                    }
                  : null,
            }
          }
        ),

      bankAccounts:
        bankAccounts.map(
          (item) => ({
            id:
              item.id,

            bankName:
              item.bank_name,

            bankCode:
              item.bank_code,

            branchName:
              item.branch_name,

            accountName:
              item.account_name,

            accountNumber:
              item.account_number,

            isDefault:
              item.is_default,
          })
        ),
    }
  }
)