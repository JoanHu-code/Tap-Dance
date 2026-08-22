import {
  storeToRefs,
} from 'pinia'

export const useCourses =
  () => {
    const coursesStore =
      useCoursesStore()

    const {
      organization,
      courses,
      activeCourses,
      totalSchedules,

      loading,
      submitting,
      error,
    } =
      storeToRefs(
        coursesStore
      )

    const refreshCourses =
      async () => {
        await coursesStore
          .fetchCourses()
      }

    const addCourse =
      async (form) => {
        return await coursesStore
          .createCourse(form)
      }

    const addSchedule =
      async (form) => {
        return await coursesStore
          .createSchedule(form)
      }

    const setScheduleStatus =
      async (
        id,
        status
      ) => {
        return await coursesStore
          .updateScheduleStatus(
            id,
            status
          )
      }

    return {
      organization,
      courses,
      activeCourses,
      totalSchedules,

      loading,
      submitting,
      error,

      refreshCourses,
      addCourse,
      addSchedule,
      setScheduleStatus,
    }
  }