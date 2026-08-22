import {
  cancelAttendanceRecord,
} from '../../../services/attendanceService.js'

import {
  requireAuth,
} from '../../../utils/authSession.js'

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
    // 取得紀錄 ID
    // ========================================================

    const id =
      getRouterParam(
        event,
        'id'
      )

    if (!id) {
      throw createError({
        statusCode: 400,
        statusMessage:
          '缺少紀錄 ID',
      })
    }

    // ========================================================
    // 取消紀錄
    // ========================================================

    try {
      const record =
        await cancelAttendanceRecord(
          id
        )

      console.log(
        '取消上課紀錄：',
        {
          userId:
            user.id,

          role:
            user.role,

          recordId:
            record.id,
        }
      )

      return {
        success: true,

        message:
          '紀錄已取消',

        record,
      }
    } catch (error) {
      console.error(
        '取消上課紀錄失敗：',
        error
      )

      throw error
    }
  }
)