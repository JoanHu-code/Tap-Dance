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

    const body =
      await readBody(event)

    const courseId =
      String(
        body?.courseId || ''
      ).trim()

    const startDate =
      String(
        body?.startDate || ''
      ).trim()

    const totalSessions =
      Number(
        body?.totalSessions
      )

    const price =
      Number(
        body?.price
      )

    const paid =
      Boolean(
        body?.paid
      )

    const bankAccountId =
      body?.bankAccountId
        ? String(
            body.bankAccountId
          )
        : null

    if (
      !studentId ||
      !courseId ||
      !startDate
    ) {
      throw createError({
        statusCode: 400,
        statusMessage:
          '方案資料不完整',
      })
    }

    if (
      !Number.isInteger(
        totalSessions
      ) ||
      totalSessions <= 0
    ) {
      throw createError({
        statusCode: 400,
        statusMessage:
          '堂數必須大於 0',
      })
    }

    if (
      !Number.isFinite(
        price
      ) ||
      price < 0
    ) {
      throw createError({
        statusCode: 400,
        statusMessage:
          '價格不正確',
      })
    }

    const sql =
      useDatabase()

    // ========================================================
    // 學生
    // ========================================================

    const students =
      await sql`
        SELECT id

        FROM students

        WHERE
          id =
            ${studentId}

          AND organization_id =
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

    // ========================================================
    // 課程
    // ========================================================

    const courses =
      await sql`
        SELECT id

        FROM dance_courses

        WHERE
          id =
            ${courseId}

          AND organization_id =
            ${organization.id}

        LIMIT 1
      `

    if (!courses.length) {
      throw createError({
        statusCode: 404,
        statusMessage:
          '找不到這門課程',
      })
    }

    // ========================================================
    // 學生必須先加入這門課
    // ========================================================

    const enrollments =
      await sql`
        SELECT id

        FROM student_enrollments

        WHERE
          student_id =
            ${studentId}

          AND course_id =
            ${courseId}

          AND status =
            'ACTIVE'

        LIMIT 1
      `

    if (!enrollments.length) {
      throw createError({
        statusCode: 409,
        statusMessage:
          '請先將學生加入這門課程',
      })
    }

    // ========================================================
    // 銀行帳戶
    // ========================================================

    if (bankAccountId) {
      const accounts =
        await sql`
          SELECT id

          FROM bank_accounts

          WHERE
            id =
              ${bankAccountId}

            AND organization_id =
              ${organization.id}

          LIMIT 1
        `

      if (!accounts.length) {
        throw createError({
          statusCode: 400,
          statusMessage:
            '收款帳戶不正確',
        })
      }
    }

    // ========================================================
    // 同課程目前舊的 ACTIVE 方案先結束
    //
    // 這樣一位學生同一門課只會有一個目前方案。
    // ========================================================

    await sql`
      UPDATE student_packages

      SET
        status =
          'COMPLETED',

        updated_at =
          NOW()

      WHERE
        student_id =
          ${studentId}

        AND course_id =
          ${courseId}

        AND status =
          'ACTIVE'
    `

    const packages =
      await sql`
        INSERT INTO
          student_packages (
            student_id,
            course_id,
            start_date,
            total_sessions,
            price,
            status,
            paid,
            paid_at,
            bank_account_id
          )

        VALUES (
          ${studentId},
          ${courseId},
          ${startDate},
          ${totalSessions},
          ${price},
          'ACTIVE',
          ${paid},
          ${
            paid
              ? new Date()
              : null
          },
          ${bankAccountId}
        )

        RETURNING *
      `

    return {
      success: true,

      message:
        '堂數方案已建立',

      package:
        packages[0],
    }
  }
)