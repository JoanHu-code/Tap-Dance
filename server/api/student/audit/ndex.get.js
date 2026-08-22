import {
  requireAuth,
} from '../../../utils/authSession.js'

import {
  useDatabase,
} from '../../../utils/db.js'

import {
  getStudentAuditOptions,
  queryStudentAuditLogs,
} from '../../../services/studentAuditService.js'

export default defineEventHandler(
  async (
    event
  ) => {
    // ========================================================
    // Auth
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
          '只有學生可以查看自己的操作紀錄',
      })
    }

    const sql =
      useDatabase()

    // ========================================================
    // Login User → Student
    //
    // 不能由前端指定 studentId。
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
    // Query
    // ========================================================

    const query =
      getQuery(
        event
      )

    const result =
      await queryStudentAuditLogs({
        studentId:
          student.id,

        action:
          query.action,

        entityType:
          query.entityType,

        startDate:
          query.startDate,

        endDate:
          query.endDate,

        keyword:
          query.keyword,

        page:
          query.page,

        pageSize:
          query.pageSize,
      })

    // ========================================================
    // Options
    // ========================================================

    const options =
      await getStudentAuditOptions(
        student.id
      )

    return {
      success: true,

      student: {
        id:
          student.id,

        name:
          student.name,
      },

      summary:
        result.summary,

      records:
        result.records,

      pagination:
        result.pagination,

      options,
    }
  }
)