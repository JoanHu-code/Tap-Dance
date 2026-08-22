import {
  storeToRefs,
} from 'pinia'

export const useTeacherStudent =
  () => {
    const store =
      useTeacherStudentStore()

    const {
      student,

      courses,

      enrollments,

      packages,

      bankAccounts,

      activeEnrollments,

      activePackages,

      loading,

      submitting,

      error,
    } =
      storeToRefs(store)

    const refreshStudent =
      async (studentId) => {
        await store.fetchStudent(
          studentId
        )
      }

    const updateEnrollment =
      async (
        studentId,
        form
      ) => {
        return await store
          .saveEnrollment(
            studentId,
            form
          )
      }

    const addPackage =
      async (
        studentId,
        form
      ) => {
        return await store
          .createPackage(
            studentId,
            form
          )
      }

    return {
      student,

      courses,

      enrollments,

      packages,

      bankAccounts,

      activeEnrollments,

      activePackages,

      loading,

      submitting,

      error,

      refreshStudent,

      updateEnrollment,

      addPackage,
    }
  }