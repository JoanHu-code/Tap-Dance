import { storeToRefs } from 'pinia'

export const useAttendance = () => {
  const attendanceStore =
    useAttendanceStore()

  const {
    course,
    currentPeriod,
    attendanceRecords,
    attendedCount,
    leaveCount,
    remainingSessions,
    progressPercentage,
    isPeriodCompleted,
    sortedAttendanceRecords,
  } = storeToRefs(attendanceStore)

  const getToday = () => {
    const now = new Date()

    const year =
      now.getFullYear()

    const month =
      String(
        now.getMonth() + 1
      ).padStart(2, '0')

    const day =
      String(
        now.getDate()
      ).padStart(2, '0')

    return `${year}-${month}-${day}`
  }

  const hasTodayRecord = () => {
    const today = getToday()

    return attendanceRecords.value.some(
      (record) =>
        record.date === today &&
        record.status !== 'CANCELLED'
    )
  }

  const addTodayAttendance = () => {
    if (hasTodayRecord()) {
      return {
        success: false,
        message: '今天已經有紀錄了',
      }
    }

    attendanceStore.addAttendanceRecord({
      date: getToday(),
      status: 'ATTENDED',
    })

    return {
      success: true,
      message: '已新增今天的上課紀錄',
    }
  }

  const addTodayLeave = () => {
    if (hasTodayRecord()) {
      return {
        success: false,
        message: '今天已經有紀錄了',
      }
    }

    attendanceStore.addAttendanceRecord({
      date: getToday(),
      status: 'LEAVE',
    })

    return {
      success: true,
      message: '已新增今天的請假紀錄',
    }
  }

  const cancelRecord = (id) => {
    const success =
      attendanceStore.cancelAttendanceRecord(id)

    if (!success) {
      return {
        success: false,
        message: '這筆紀錄無法取消',
      }
    }

    return {
      success: true,
      message: '紀錄已取消',
    }
  }

  const getStatusText = (status) => {
    const statusMap = {
      ATTENDED: '上課',
      LEAVE: '請假',
      CANCELLED: '已取消',
    }

    return statusMap[status] || status
  }

  const formatDate = (dateString) => {
    return new Intl.DateTimeFormat(
      'zh-TW',
      {
        month: '2-digit',
        day: '2-digit',
        weekday: 'short',
      }
    ).format(
      new Date(
        `${dateString}T00:00:00`
      )
    )
  }

  return {
    course,
    currentPeriod,
    attendanceRecords,

    attendedCount,
    leaveCount,
    remainingSessions,
    progressPercentage,
    isPeriodCompleted,
    sortedAttendanceRecords,

    addTodayAttendance,
    addTodayLeave,
    cancelRecord,

    getStatusText,
    formatDate,
  }
}