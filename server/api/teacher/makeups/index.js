import {
  requireAuth,
} from '../../../utils/authSession.js'

import {
  useDatabase,
} from '../../../utils/db.js'

import {
  createMakeup,
  getStudentMakeupData,
  getTeacherMakeups,
} from '../../../services/makeupService.js'

// ============================================================
// Students
// ============================================================

const getStudents =
  async () => {
    const sql =
      useDatabase()

    return await sql`
      SELECT
        student.id,
        student.name,
        student.user_id,
        student.status,

        EXISTS (
          SELECT
            1

          FROM
            attendance_records_v2 attendance

          WHERE
            attendance.student_id =
              student.id

            AND
              attendance.status =
                'LEAVE'

            AND
              attendance.attendance_type <>
                'MAKEUP'
        )
          AS has_leave

      FROM
        students student

      WHERE
        student.status =
          'ACTIVE'

      ORDER BY
        student.name ASC
    `
  }

// ============================================================
// Courses
// ============================================================

const getCourses =
  async () => {
    const sql =
      useDatabase()

    return await sql`
      SELECT
        id,
        name,
        weekday,
        start_time,
        end_time,
        sessions_per_cycle,
        price_per_cycle,
        status

      FROM
        dance_courses

      ORDER BY
        name ASC
    `
  }

// ============================================================
// Handler
// ============================================================

export default defineEventHandler(
  async (
    event
  ) => {
    // ========================================================
    // Auth
    // ========================================================

    const user =
      await requireAuth(
        event
      )

    if (
      user.role !==
      'TEACHER'
    ) {
      throw createError({
        statusCode: 403,

        statusMessage:
          '只有老師可以管理所有學生的補課資料',
      })
    }

    const method =
      String(
        event.method ||
        'GET'
      ).toUpperCase()

    // ========================================================
    // GET
    // ========================================================

    if (
      method ===
      'GET'
    ) {
      const query =
        getQuery(
          event
        )

      const studentId =
        query.studentId
          ? String(
              query.studentId
            ).trim()
          : null

      const courseId =
        query.courseId
          ? String(
              query.courseId
            ).trim()
          : null

      const status =
        query.status
          ? String(
              query.status
            ).trim()
          : null

      const startDate =
        query.startDate
          ? String(
              query.startDate
            ).trim()
          : null

      const endDate =
        query.endDate
          ? String(
              query.endDate
            ).trim()
          : null

      // ======================================================
      // Shared Basic Data
      // ======================================================

      const [
        students,
        courses,
        makeups,
      ] =
        await Promise.all([
          getStudents(),

          getCourses(),

          getTeacherMakeups({
            studentId,
            courseId,
            status,
            startDate,
            endDate,
          }),
        ])

      // ======================================================
      // Selected Student Leave Sources
      // ======================================================

      let sourceLeaves = []

      if (
        studentId
      ) {
        const studentData =
          await getStudentMakeupData({
            studentId,
          })

        sourceLeaves =
          studentData.sourceLeaves ||
          []
      }

      return {
        success: true,

        students,

        courses,

        sourceLeaves,

        makeups,
      }
    }

    // ========================================================
    // POST
    // ========================================================

    if (
      method ===
      'POST'
    ) {
      const body =
        await readBody(
          event
        )

      const studentId =
        String(
          body?.studentId ||
          ''
        ).trim()

      const sourceLeaveAttendanceId =
        String(
          body?.sourceLeaveAttendanceId ||
          ''
        ).trim()

      const makeupDate =
        body?.makeupDate
          ? String(
              body.makeupDate
            ).trim()
          : null

      const makeupSessionId =
        body?.makeupSessionId
          ? String(
              body.makeupSessionId
            ).trim()
          : null

      // ======================================================
      // Validate
      // ======================================================

      if (
        !studentId
      ) {
        throw createError({
          statusCode: 400,

          statusMessage:
            '請選擇學生',
        })
      }

      if (
        !sourceLeaveAttendanceId
      ) {
        throw createError({
          statusCode: 400,

          statusMessage:
            '請選擇原始請假紀錄',
        })
      }

      if (
        !makeupDate &&
        !makeupSessionId
      ) {
        throw createError({
          statusCode: 400,

          statusMessage:
            '請選擇補課日期',
        })
      }

      // ======================================================
      // Create
      // ======================================================

      const result =
        await createMakeup({
          studentId,

          sourceLeaveAttendanceId,

          makeupDate,

          makeupSessionId,

          note:
            body?.note,

          actorUserId:
            user.id,

          actorRole:
            'TEACHER',

          event,
        })

      return {
        success: true,

        message:
          '補課已建立，學生方案堂數已累加 1 堂',

        makeup:
          result.makeup,

        attendance:
          result.attendance,

        package:
          result.package,

        source:
          result.source,

        targetSession:
          result.targetSession,
      }
    }

    // ========================================================
    // Method
    // ========================================================

    throw createError({
      statusCode: 405,

      statusMessage:
        'Method Not Allowed',
    })
  }
)