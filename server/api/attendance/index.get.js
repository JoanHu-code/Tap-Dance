import {
  getAttendanceData,
} from '../../services/attendanceService.js'

export default defineEventHandler(
  async () => {
    return await getAttendanceData()
  }
)