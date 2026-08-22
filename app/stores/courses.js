import {
  defineStore,
} from 'pinia'

export const useCoursesStore =
  defineStore(
    'courses',
    {
      state: () => ({
        organization: null,

        courses: [],

        loading: false,

        submitting: false,

        error: null,
      }),

      getters: {
        activeCourses:
          (state) => {
            return state.courses
              .filter(
                (course) =>
                  course.status ===
                  'ACTIVE'
              )
          },

        totalSchedules:
          (state) => {
            return state.courses
              .reduce(
                (
                  total,
                  course
                ) => {
                  return (
                    total +
                    (
                      course
                        .schedules
                        ?.filter(
                          (
                            schedule
                          ) =>
                            schedule.status ===
                            'ACTIVE'
                        )
                        .length ||
                      0
                    )
                  )
                },
                0
              )
          },
      },

      actions: {
        async fetchCourses() {
          this.loading = true
          this.error = null

          try {
            const data =
              await $fetch(
                '/api/teacher/courses'
              )

            this.organization =
              data.organization

            this.courses =
              data.courses || []
          } catch (error) {
            console.error(
              '取得課程失敗：',
              error
            )

            this.error =
              error?.data
                ?.statusMessage ||
              error
                ?.statusMessage ||
              '取得課程失敗'
          } finally {
            this.loading =
              false
          }
        },

        async createCourse(
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
                '/api/teacher/courses',
                {
                  method:
                    'POST',

                  body: {
                    name:
                      form.name,

                    description:
                      form.description,
                  },
                }
              )

            await this.fetchCourses()

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
                '新增課程失敗',
            }
          } finally {
            this.submitting =
              false
          }
        },

        async createSchedule(
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
                '/api/teacher/schedules',
                {
                  method:
                    'POST',

                  body: {
                    courseId:
                      form.courseId,

                    weekday:
                      form.weekday,

                    startTime:
                      form.startTime,

                    endTime:
                      form.endTime,

                    name:
                      form.name,

                    capacity:
                      form.capacity,
                  },
                }
              )

            await this.fetchCourses()

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
                '新增時段失敗',
            }
          } finally {
            this.submitting =
              false
          }
        },

        async updateScheduleStatus(
          id,
          status
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
                `/api/teacher/schedules/${id}/status`,
                {
                  method:
                    'PATCH',

                  body: {
                    status,
                  },
                }
              )

            await this.fetchCourses()

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
                '更新時段失敗',
            }
          } finally {
            this.submitting =
              false
          }
        },
      },
    }
  )