import {
  defineStore,
} from 'pinia'

export const useTeacherStore =
  defineStore(
    'teacher',
    {
      state: () => ({
        organization: null,

        students: [],

        loading: false,

        submitting: false,

        error: null,
      }),

      getters: {
        activeStudents:
          (state) => {
            return state.students.filter(
              (student) =>
                student.status ===
                'ACTIVE'
            )
          },

        lineStudents:
          (state) => {
            return state.students.filter(
              (student) =>
                student.hasLine
            )
          },

        manualStudents:
          (state) => {
            return state.students.filter(
              (student) =>
                !student.hasLine
            )
          },
      },

      actions: {
        async fetchStudents() {
          this.loading = true
          this.error = null

          try {
            const data =
              await $fetch(
                '/api/teacher/students'
              )

            this.organization =
              data.organization

            this.students =
              data.students || []
          } catch (error) {
            console.error(
              '取得學生列表失敗：',
              error
            )

            this.error =
              error?.data
                ?.statusMessage ||
              error
                ?.statusMessage ||
              '取得學生列表失敗'
          } finally {
            this.loading =
              false
          }
        },

        async createStudent(
          form
        ) {
          if (
            this.submitting
          ) {
            return {
              success: false,
              message:
                '資料處理中',
            }
          }

          this.submitting =
            true

          try {
            const result =
              await $fetch(
                '/api/teacher/students',
                {
                  method:
                    'POST',

                  body: {
                    name:
                      form.name,

                    phone:
                      form.phone,

                    note:
                      form.note,
                  },
                }
              )

            await this.fetchStudents()

            return {
              success: true,

              message:
                result.message,
            }
          } catch (error) {
            console.error(
              '新增學生失敗：',
              error
            )

            return {
              success: false,

              message:
                error?.data
                  ?.statusMessage ||
                error
                  ?.statusMessage ||
                '新增學生失敗',
            }
          } finally {
            this.submitting =
              false
          }
        },
      },
    }
  )