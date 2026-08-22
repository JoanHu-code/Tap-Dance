import { defineStore } from 'pinia'

export const useAttendanceStore = defineStore(
  'attendance',
  {
    state: () => ({
      course: {
        id: null,
        name: '',
        teacherName: '',
        totalSessions: 8,
        price: 3600,
      },

      currentPeriod: {
        id: null,
        periodNo: 1,
        status: 'ACTIVE',
        paid: false,
        paidAt: null,
      },

      attendanceRecords: [],

      loading: false,
      submitting: false,
      error: null,
    }),

    getters: {
      validRecords: (state) => {
        return state.attendanceRecords.filter(
          (record) =>
            record.status !== 'CANCELLED'
        )
      },

      attendedCount() {
        return this.validRecords.filter(
          (record) =>
            record.status === 'ATTENDED'
        ).length
      },

      leaveCount() {
        return this.validRecords.filter(
          (record) =>
            record.status === 'LEAVE'
        ).length
      },

      remainingSessions() {
        return Math.max(
          this.course.totalSessions -
            this.attendedCount,
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
        return [
          ...state.attendanceRecords,
        ].sort(
          (a, b) => {
            const dateCompare =
              new Date(b.date) -
              new Date(a.date)

            if (dateCompare !== 0) {
              return dateCompare
            }

            return b.id - a.id
          }
        )
      },
    },

    actions: {
      // ======================================================
      // 從資料庫取得目前課程與上課紀錄
      // ======================================================

      async fetchAttendance() {
        this.loading = true
        this.error = null

        try {
          const data =
            await $fetch(
              '/api/attendance'
            )

          this.course = {
            ...data.course,
          }

          this.currentPeriod = {
            ...data.currentPeriod,
          }

          this.attendanceRecords =
            data.attendanceRecords || []
        } catch (error) {
          console.error(
            '取得上課紀錄失敗：',
            error
          )

          this.error =
            error?.data
              ?.statusMessage ||
            error
              ?.statusMessage ||
            error?.message ||
            '取得資料失敗'

          throw error
        } finally {
          this.loading = false
        }
      },

      // ======================================================
      // 新增上課 / 請假
      // ======================================================

      async addAttendanceRecord(
        status
      ) {
        if (this.submitting) {
          return {
            success: false,
            message: '資料處理中',
          }
        }

        this.submitting = true

        try {
          const result =
            await $fetch(
              '/api/attendance',
              {
                method: 'POST',

                body: {
                  status,
                },
              }
            )

          await this.fetchAttendance()

          return {
            success: true,
            message:
              result.message,
          }
        } catch (error) {
          console.error(
            '新增上課紀錄失敗：',
            error
          )

          return {
            success: false,

            message:
              error?.data
                ?.statusMessage ||
              error
                ?.statusMessage ||
              error?.message ||
              '新增紀錄失敗',
          }
        } finally {
          this.submitting = false
        }
      },

      // ======================================================
      // 取消紀錄
      // ======================================================

      async cancelAttendanceRecord(
        id
      ) {
        if (this.submitting) {
          return {
            success: false,
            message: '資料處理中',
          }
        }

        this.submitting = true

        try {
          const result =
            await $fetch(
              `/api/attendance/${id}/cancel`,
              {
                method: 'POST',
              }
            )

          await this.fetchAttendance()

          return {
            success: true,
            message:
              result.message,
          }
        } catch (error) {
          console.error(
            '取消紀錄失敗：',
            error
          )

          return {
            success: false,

            message:
              error?.data
                ?.statusMessage ||
              error
                ?.statusMessage ||
              error?.message ||
              '取消紀錄失敗',
          }
        } finally {
          this.submitting = false
        }
      },
    },
  }
)