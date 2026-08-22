import {
  renewStudentPackage,
} from '../../../services/packageService.js'

import {
  requireAuth,
} from '../../../utils/authSession.js'

import {
  useDatabase,
} from '../../../utils/db.js'

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
          '只有學生可以使用學生端續期功能',
      })
    }

    const sql =
      useDatabase()

    // ========================================================
    // 由登入帳號反查本人
    //
    // 不接受前端 studentId。
    // ========================================================

    const students =
      await sql`
        SELECT
          id,
          name,
          user_id,
          status

        FROM students

        WHERE
          user_id =
            ${user.id}

        LIMIT 1
      `

    if (
      !students.length
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '此 LINE 帳號尚未綁定學生資料',
      })
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
    // Body
    //
    // 學生只能傳 packageId。
    //
    // 不允許自己改：
    // totalSessions
    // price
    // bankAccount
    // ========================================================

    const body =
      await readBody(
        event
      )

    const packageId =
      String(
        body?.packageId ||
        ''
      )
        .trim()

    if (!packageId) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '缺少 Package ID',
      })
    }

    // ========================================================
    // Renew
    //
    // Service 還會驗證：
    //
    // package.student_id
    // 必須等於目前登入學生
    //
    // 而且：
    //
    // attended_count
    // 必須 >= total_sessions
    // ========================================================

    const result =
      await renewStudentPackage({
        studentId:
          student.id,

        packageId,

        // ====================================================
        // 學生全部沿用上一期
        // ====================================================

        startDate:
          undefined,

        totalSessions:
          undefined,

        price:
          undefined,

        bankAccountId:
          undefined,

        actorUserId:
          user.id,

        actorRole:
          'STUDENT',
      })

    return {
      success: true,

      message:
        `續期完成，已開始第 ${result.newPackage.cycle_no} 期`,

      previousPackage:
        result.previousPackage,

      newPackage:
        result.newPackage,
    }
  }
)