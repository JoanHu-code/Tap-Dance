import {
  defineStore,
} from 'pinia'

export const useTeacherStudentStore =
  defineStore(
    'teacherStudent',
    {
      state: () => ({
        student: null,

        courses: [],

        enrollments: [],

        packages: [],

        bankAccounts: [],

        loading: false,

        submitting: false,

        error: null,
      }),

      getters: {
        activeEnrollments:
          (state) =>
            state.enrollments.filter(
              (item) =>
                item.status ===
                'ACTIVE'
            ),

        activePackages:
          (state) =>
            state.packages.filter(
              (item) =>
                item.status ===
                'ACTIVE'
            ),
      },

      actions: {
        async fetchStudent(
          studentId
        ) {
          this.loading = true
          this.error = null

          try {
            const data =
              await $fetch(
                `/api/teacher/students/${studentId}`
              )

            this.student =
              data.student

            this.courses =
              data.courses || []

            this.enrollments =
              data.enrollments || []

            this.packages =
              data.packages || []

            this.bankAccounts =
              data.bankAccounts || []
          } catch (error) {
            console.error(
              '取得學生資料失敗：',
              error
            )

            this.error =
              error?.data
                ?.statusMessage ||
              error
                ?.statusMessage ||
              '取得學生資料失敗'
          } finally {
            this.loading =
              false
          }
        },

        async saveEnrollment(
          studentId,
          form
        ) {
          if (this.submitting) {
            return {
              success: false,
              message:
                '資料處理中',
            }
          }

          this.submitting = true

          try {
            const result =
              await $fetch(
                `/api/teacher/students/${studentId}/enrollment`,
                {
                  method: 'POST',

                  body: {
                    courseId:
                      form.courseId,

                    defaultScheduleId:
                      form.defaultScheduleId ||
                      null,
                  },
                }
              )

            await this.fetchStudent(
              studentId
            )

            return {
              success: true,
              message:
                result.message,
            }
          } catch (error) {
            return {
              success: false,

              message:
                error?.data
                  ?.statusMessage ||
                error
                  ?.statusMessage ||
                '課程設定失敗',
            }
          } finally {
            this.submitting =
              false
          }
        },

        async createPackage(
          studentId,
          form
        ) {
          if (this.submitting) {
            return {
              success: false,
              message:
                '資料處理中',
            }
          }

          this.submitting = true

          try {
            const result =
              await $fetch(
                `/api/teacher/students/${studentId}/package`,
                {
                  method: 'POST',

                  body: {
                    courseId:
                      form.courseId,

                    startDate:
                      form.startDate,

                    totalSessions:
                      Number(
                        form.totalSessions
                      ),

                    price:
                      Number(
                        form.price
                      ),

                    paid:
                      form.paid,

                    bankAccountId:
                      form.bankAccountId ||
                      null,
                  },
                }
              )

            await this.fetchStudent(
              studentId
            )

            return {
              success: true,

              message:
                result.message,
            }
          } catch (error) {
            return {
              success: false,

              message:
                error?.data
                  ?.statusMessage ||
                error
                  ?.statusMessage ||
                '建立方案失敗',
            }
          } finally {
            this.submitting =
              false
          }
        },
      },
    }
  )