import {
  createAttendanceRecord,
} from '../../services/attendanceService.js'

export default defineEventHandler(
  async (event) => {
    const body =
      await readBody(event)

    const status =
      String(
        body?.status || ''
      ).trim()

    const record =
      await createAttendanceRecord(
        status
      )

    return {
      success: true,

      message:
        status === 'ATTENDED'
          ? '已新增今天的上課紀錄'
          : '已新增今天的請假紀錄',

      record,
    }
  }
)