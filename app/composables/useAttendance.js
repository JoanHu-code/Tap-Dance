import {
  storeToRefs,
} from 'pinia'

export const useAttendance =
  () => {
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

      loading,
      submitting,
      error,
    } = storeToRefs(
      attendanceStore
    )

    const addTodayAttendance =
      async () => {
        return await attendanceStore
          .addAttendanceRecord(
            'ATTENDED'
          )
      }

    const addTodayLeave =
      async () => {
        return await attendanceStore
          .addAttendanceRecord(
            'LEAVE'
          )
      }

    const cancelRecord =
      async (id) => {
        return await attendanceStore
          .cancelAttendanceRecord(
            id
          )
      }

    const refreshAttendance =
      async () => {
        await attendanceStore
          .fetchAttendance()
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

      loading,
      submitting,
      error,

      addTodayAttendance,
      addTodayLeave,
      cancelRecord,
      refreshAttendance,
    }
  }