import {
  storeToRefs,
} from 'pinia'

export const useTeacher =
  () => {
    const teacherStore =
      useTeacherStore()

    const {
      organization,
      students,

      activeStudents,
      lineStudents,
      manualStudents,

      loading,
      submitting,
      error,
    } =
      storeToRefs(
        teacherStore
      )

    const refreshStudents =
      async () => {
        await teacherStore
          .fetchStudents()
      }

    const addStudent =
      async (form) => {
        return await teacherStore
          .createStudent(
            form
          )
      }

    return {
      organization,
      students,

      activeStudents,
      lineStudents,
      manualStudents,

      loading,
      submitting,
      error,

      refreshStudents,
      addStudent,
    }
  }