import {
  requireAuth,
} from '../../utils/authSession.js'

import {
  useDatabase,
} from '../../utils/db.js'

import {
  getStudentEnrollments,
} from '../../services/enrollmentService.js'

import {
  getStudentPackages,
} from '../../services/packageService.js'

export default defineEventHandler(
  async (
    event
  ) => {
    // ========================================================
    // Student Auth
    // ========================================================

    const user =
      await requireAuth(
        event
      )

    if (
      user.role !==
      'STUDENT'
    ) {
      throw createError({
        statusCode: 403,

        statusMessage:
          '只有學生可以查看學生 Dashboard',
      })
    }

    const sql =
      useDatabase()

    // ========================================================
    // 登入帳號 → Student
    //
    // 絕對不接受 studentId。
    // ========================================================

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

    // ========================================================
    // LINE 尚未綁定
    // ========================================================

    if (
      !students.length
    ) {
      return {
        success: true,

        linked: false,

        student: null,

        courses: [],

        packages: [],

        attendanceRecords: [],
      }
    }

    const student =
      students[0]

    if (
      student.status !==
      'ACTIVE'
    ) {
      throw createError({
        statusCode: 403,

        statusMessage:
          '學生資料目前未啟用',
      })
    }

    // ========================================================
    // Enrollment
    //
    // 每一個 Enrollment 都會帶：
    //
    // schedules[]
    // primary_schedule
    // ========================================================

    const enrollments =
      await getStudentEnrollments(
        student.id
      )

    // ========================================================
    // Package
    //
    // Package 依 Course 分開。
    // ========================================================

    const packages =
      await getStudentPackages(
        student.id
      )

    // ========================================================
    // 組 Course Cards
    // ========================================================

    const courses =
      enrollments
        .filter(
          (
            enrollment
          ) => {
            return (
              enrollment.status ===
              'ACTIVE'
            )
          }
        )
        .map(
          (
            enrollment
          ) => {
            // =================================================
            // 這門 Course 所有 Package
            // =================================================

            const coursePackages =
              packages.filter(
                (
                  packageData
                ) => {
                  return (
                    String(
                      packageData
                        .course_id
                    ) ===
                    String(
                      enrollment
                        .course_id
                    )
                  )
                }
              )

            // =================================================
            // PackageService 已經依 cycle DESC 排序，
            // 第一筆就是最新一期。
            // =================================================

            const latestPackage =
              coursePackages[0] ||
              null

            const activePackage =
              coursePackages.find(
                (
                  packageData
                ) => {
                  return (
                    packageData.status ===
                    'ACTIVE'
                  )
                }
              ) ||
              null

            // =================================================
            // 滿堂後 Package 可能已經 COMPLETED，
            // 但還沒 Renew。
            //
            // 所以 UI 應該優先拿：
            //
            // ACTIVE
            // 否則最新一期。
            // =================================================

            const currentPackage =
              activePackage ||
              latestPackage ||
              null

            return {
              enrollmentId:
                enrollment.id,

              courseId:
                enrollment
                  .course_id,

              courseName:
                enrollment
                  .course_name,

              courseDescription:
                enrollment
                  .course_description,

              joinedAt:
                enrollment
                  .joined_at,

              // ===============================================
              // 多固定時段
              // ===============================================

              schedules:
                enrollment
                  .schedules ||
                [],

              primarySchedule:
                enrollment
                  .primary_schedule ||
                null,

              // ===============================================
              // Package
              // ===============================================

              package:
                currentPackage,

              packageHistory:
                coursePackages,
            }
          }
        )

    // ========================================================
    // Recent Attendance
    //
    // 現階段先提供最近紀錄。
    // Attendance Service 下一階段才正式重構。
    // ========================================================

    const attendanceRecords =
      await sql`
        SELECT
          a.*,

          cs.class_date,

          cs.start_time,

          cs.end_time,

          p.course_id,

          c.name
            AS course_name

        FROM
          attendance_records_v2 a

        LEFT JOIN
          class_sessions cs

          ON cs.id =
            a.session_id

        LEFT JOIN
          student_packages p

          ON p.id =
            a.package_id

        LEFT JOIN
          dance_courses c

          ON c.id =
            p.course_id

        WHERE
          a.student_id =
            ${student.id}

        ORDER BY
          cs.class_date DESC NULLS LAST,
          a.created_at DESC

        LIMIT 20
      `

    // ========================================================
    // 每個 Course 各自的銀行帳戶
    //
    // 因為不同 Package 未來可以指向不同 Bank Account。
    // 不再假設全站只有一個 bankAccount。
    // ========================================================

    for (
      const course of
      courses
    ) {
      const bankAccountId =
        course.package
          ?.bank_account_id

      if (!bankAccountId) {
        course.bankAccount =
          null

        continue
      }

      const bankAccounts =
        await sql`
          SELECT
            id,
            organization_id,
            bank_name,
            bank_code,
            branch_name,
            account_name,
            account_number,
            is_default

          FROM
            bank_accounts

          WHERE
            id =
              ${bankAccountId}

          LIMIT 1
        `

      course.bankAccount =
        bankAccounts[0] ||
        null
    }

    // ========================================================
    // Response
    // ========================================================

    return {
      success: true,

      linked: true,

      student,

      courses,

      enrollments,

      packages,

      attendanceRecords,
    }
  }
)