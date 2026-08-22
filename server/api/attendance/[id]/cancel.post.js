import {
  cancelAttendanceRecord,
} from '../../../services/attendanceService.js'

export default defineEventHandler(
  async (event) => {
    const id =
      getRouterParam(
        event,
        'id'
      )

    const record =
      await cancelAttendanceRecord(
        id
      )

    return {
      success: true,
      message: '紀錄已取消',
      record,
    }
  }
)