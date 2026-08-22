import {
  createAttendanceRecord,
} from '../../services/attendanceService.js'

import {
  requireAuth,
} from '../../utils/authSession.js'

export default defineEventHandler(
  async (event) => {
    // ========================================================
    // 驗證登入狀態
    // ========================================================

    const user =
      await requireAuth(
        event
      )

    // ========================================================
    // 讀取 Request Body
    // ========================================================

    const body =
      await readBody(
        event
      )

    const status =
      String(
        body?.status || ''
      )
        .trim()
        .toUpperCase()

    // ========================================================
    // 驗證狀態
    // ========================================================

    const allowedStatuses = [
      'ATTENDED',
      'LEAVE',
    ]

    if (
      !allowedStatuses.includes(
        status
      )
    ) {
      throw createError({
        statusCode: 400,
        statusMessage:
          '無效的上課狀態',
      })
    }

    // ========================================================
    // 新增紀錄
    // ========================================================

    try {
      const record =
        await createAttendanceRecord(
          status
        )

      console.log(
        '新增上課紀錄：',
        {
          userId:
            user.id,

          role:
            user.role,

          status,

          recordId:
            record.id,
        }
      )

      return {
        success: true,

        message:
          status ===
          'ATTENDED'
            ? '已新增今天的上課紀錄'
            : '已新增今天的請假紀錄',

        record,
      }
    } catch (error) {
      console.error(
        '新增上課紀錄失敗：',
        error
      )

      throw error
    }
  }
)