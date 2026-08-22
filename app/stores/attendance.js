import { defineStore } from 'pinia'

export const useAttendanceStore = defineStore('attendance', {
  state: () => ({
    course: {
      id: 1,
      name: '踢踏舞',
      teacherName: '老師',
      totalSessions: 8,
      price: 3600,
    },

    currentPeriod: {
      id: 1,
      periodNo: 1,
      status: 'ACTIVE',
      paid: true,
      paidAt: null,
    },

    attendanceRecords: [
      {
        id: 1,
        date: '2026-08-01',
        status: 'ATTENDED',
        originalStatus: null,
        confirmed: true,
        cancelledAt: null,
      },
      {
        id: 2,
        date: '2026-08-08',
        status: 'LEAVE',
        originalStatus: null,
        confirmed: true,
        cancelledAt: null,
      },
      {
        id: 3,
        date: '2026-08-15',
        status: 'ATTENDED',
        originalStatus: null,
        confirmed: true,
        cancelledAt: null,
      },
    ],

    loading: false,
  }),

  getters: {
    validRecords: (state) => {
      return state.attendanceRecords.filter(
        (record) => record.status !== 'CANCELLED'
      )
    },

    attendedCount() {
      return this.validRecords.filter(
        (record) => record.status === 'ATTENDED'
      ).length
    },

    leaveCount() {
      return this.validRecords.filter(
        (record) => record.status === 'LEAVE'
      ).length
    },

    remainingSessions() {
      return Math.max(
        this.course.totalSessions - this.attendedCount,
        0
      )
    },

    progressPercentage() {
      if (!this.course.totalSessions) {
        return 0
      }

      return Math.min(
        Math.round(
          (
            this.attendedCount /
            this.course.totalSessions
          ) * 100
        ),
        100
      )
    },

    isPeriodCompleted() {
      return (
        this.attendedCount >=
        this.course.totalSessions
      )
    },

    sortedAttendanceRecords: (state) => {
      return [...state.attendanceRecords].sort(
        (a, b) =>
          new Date(b.date) - new Date(a.date)
      )
    },
  },

  actions: {
    addAttendanceRecord(record) {
      this.attendanceRecords.push({
        id: Date.now(),
        confirmed: false,
        originalStatus: null,
        cancelledAt: null,
        ...record,
      })
    },

    cancelAttendanceRecord(id) {
      const record =
        this.attendanceRecords.find(
          (item) => item.id === id
        )

      if (!record) {
        return false
      }

      if (record.status === 'CANCELLED') {
        return false
      }

      record.originalStatus = record.status
      record.status = 'CANCELLED'
      record.confirmed = false
      record.cancelledAt =
        new Date().toISOString()

      return true
    },

    confirmAttendanceRecord(id) {
      const record =
        this.attendanceRecords.find(
          (item) => item.id === id
        )

      if (!record) {
        return false
      }

      if (record.status === 'CANCELLED') {
        return false
      }

      record.confirmed = true

      return true
    },
  },
})