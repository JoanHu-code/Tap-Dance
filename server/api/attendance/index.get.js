import {
  getAttendanceData,
} from '../../services/attendanceService.js'

import {
  requireAuth,
} from '../../utils/authSession.js'

export default defineEventHandler(
  async (event) => {
    // ========================================================
    // 驗證登入狀態
    // ========================================================

    await requireAuth(
      event
    )

    // ========================================================
    // 取得上課資料
    // ========================================================

    try {
      const data =
        await getAttendanceData()

      return data
    } catch (error) {
      console.error(
        '取得上課紀錄失敗：',
        error
      )

      throw error
    }
  }
)