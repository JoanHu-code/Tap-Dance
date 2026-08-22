import {
  requireAuth,
} from './authSession.js'

import {
  useDatabase,
} from './db.js'

// ============================================================
// UUID
// ============================================================

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const assertUuid = (
  value,
  fieldName
) => {
  if (
    !UUID_PATTERN.test(
      String(
        value || ''
      )
    )
  ) {
    throw createError({
      statusCode: 500,

      statusMessage:
        `${fieldName} 格式不正確`,
    })
  }
}

// ============================================================
// Teacher Context
// ============================================================

export const requireTeacherContext =
  async (
    event
  ) => {
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
          '只有老師可以使用此功能',
      })
    }

    assertUuid(
      user.id,
      'User ID'
    )

    const sql =
      useDatabase()

    // ========================================================
    // Organization Membership
    //
    // 目前是一位老師，
    // 但仍強制從 organization_members 找 Organization。
    // ========================================================

    const memberships =
      await sql`
        SELECT
          member.organization_id,

          organization.name
            AS organization_name

        FROM
          organization_members member

        INNER JOIN
          organizations organization

          ON organization.id =
            member.organization_id

        WHERE
          member.user_id =
            ${user.id}

        ORDER BY
          member.organization_id ASC

        LIMIT 2
      `

    if (
      !memberships.length
    ) {
      throw createError({
        statusCode: 403,

        statusMessage:
          '老師帳號尚未加入任何 Organization',
      })
    }

    // ========================================================
    // 目前產品是一位老師 / 一個 Organization。
    //
    // 如果未來真的做 Multi-Organization，
    // 再加入 organization selector。
    //
    // 現在如果同一老師屬於兩個 Organization，
    // 不要偷偷選第一個。
    // ========================================================

    if (
      memberships.length >
      1
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '老師目前屬於多個 Organization，系統尚未指定目前工作 Organization',
      })
    }

    const membership =
      memberships[0]

    assertUuid(
      membership.organization_id,
      'Organization ID'
    )

    return {
      user,

      organizationId:
        membership.organization_id,

      organization: {
        id:
          membership.organization_id,

        name:
          membership.organization_name,
      },
    }
  }

// ============================================================
// Student Context
// ============================================================

export const requireStudentContext =
  async (
    event
  ) => {
    const user =
      await requireAuth(
        event
      )

    if (
      user.role !==
      'STUDENT'
    ) {
      throw createError({
        statusCode: 403,

        statusMessage:
          '只有學生可以使用此功能',
      })
    }

    assertUuid(
      user.id,
      'User ID'
    )

    const sql =
      useDatabase()

    const students =
      await sql`
        SELECT
          student.id,

          student.organization_id,

          student.name,

          student.status,

          student.user_id,

          organization.name
            AS organization_name

        FROM
          students student

        LEFT JOIN
          organizations organization

          ON organization.id =
            student.organization_id

        WHERE
          student.user_id =
            ${user.id}

        LIMIT 2
      `

    if (
      !students.length
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '此 LINE 帳號尚未綁定學生資料',
      })
    }

    if (
      students.length >
      1
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '此帳號綁定了多筆 Student，請由老師檢查資料',
      })
    }

    const student =
      students[0]

    if (
      student.status !==
      'ACTIVE'
    ) {
      throw createError({
        statusCode: 403,

        statusMessage:
          '學生資料目前未啟用',
      })
    }

    if (
      !student.organization_id
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '學生尚未設定 Organization',
      })
    }

    assertUuid(
      student.id,
      'Student ID'
    )

    assertUuid(
      student.organization_id,
      'Organization ID'
    )

    return {
      user,

      student: {
        id:
          student.id,

        name:
          student.name,

        status:
          student.status,
      },

      organizationId:
        student.organization_id,

      organization: {
        id:
          student.organization_id,

        name:
          student.organization_name,
      },
    }
  }

// ============================================================
// Assert Student Organization
//
// Teacher Service 收到 studentId 時：
//
// 不能只 SELECT students WHERE id = studentId
//
// 必須：
//
// id = studentId
// AND organization_id = teacher.organizationId
// ============================================================

export const requireStudentInOrganization =
  async (
    studentId,
    organizationId
  ) => {
    assertUuid(
      studentId,
      'Student ID'
    )

    assertUuid(
      organizationId,
      'Organization ID'
    )

    const sql =
      useDatabase()

    const students =
      await sql`
        SELECT
          id,
          organization_id,
          user_id,
          name,
          status

        FROM
          students

        WHERE
          id =
            ${studentId}

          AND
            organization_id =
              ${organizationId}

        LIMIT 1
      `

    if (
      !students.length
    ) {
      // ======================================================
      // 故意回 404。
      //
      // 不告訴使用者：
      // 「有這個 Student，只是屬於別的 Organization」
      //
      // 避免跨 Organization 資訊洩漏。
      // ======================================================

      throw createError({
        statusCode: 404,

        statusMessage:
          '找不到學生資料',
      })
    }

    return students[0]
  }

// ============================================================
// Assert Course Organization
// ============================================================

export const requireCourseInOrganization =
  async (
    courseId,
    organizationId
  ) => {
    assertUuid(
      courseId,
      'Course ID'
    )

    assertUuid(
      organizationId,
      'Organization ID'
    )

    const sql =
      useDatabase()

    const courses =
      await sql`
        SELECT
          id,
          organization_id,
          name,
          status

        FROM
          dance_courses

        WHERE
          id =
            ${courseId}

          AND
            organization_id =
              ${organizationId}

        LIMIT 1
      `

    if (
      !courses.length
    ) {
      throw createError({
        statusCode: 404,

        statusMessage:
          '找不到課程資料',
      })
    }

    return courses[0]
  }

// ============================================================
// Assert Schedule Organization
//
// class_schedules 自己沒有 organization_id，
// 所以透過 dance_courses.organization_id 判斷。
// ============================================================

export const requireScheduleInOrganization =
  async (
    scheduleId,
    organizationId
  ) => {
    assertUuid(
      scheduleId,
      'Schedule ID'
    )

    assertUuid(
      organizationId,
      'Organization ID'
    )

    const sql =
      useDatabase()

    const schedules =
      await sql`
        SELECT
          schedule.id,

          schedule.course_id,

          schedule.name,

          schedule.status,

          course.organization_id,

          course.name
            AS course_name

        FROM
          class_schedules schedule

        INNER JOIN
          dance_courses course

          ON course.id =
            schedule.course_id

        WHERE
          schedule.id =
            ${scheduleId}

          AND
            course.organization_id =
              ${organizationId}

        LIMIT 1
      `

    if (
      !schedules.length
    ) {
      throw createError({
        statusCode: 404,

        statusMessage:
          '找不到課程時段',
      })
    }

    return schedules[0]
  }

// ============================================================
// Assert Session Organization
// ============================================================

export const requireSessionInOrganization =
  async (
    sessionId,
    organizationId
  ) => {
    assertUuid(
      sessionId,
      'Session ID'
    )

    assertUuid(
      organizationId,
      'Organization ID'
    )

    const sql =
      useDatabase()

    const sessions =
      await sql`
        SELECT
          session.id,

          session.schedule_id,

          session.class_date,

          session.status,

          schedule.course_id,

          course.organization_id,

          course.name
            AS course_name

        FROM
          class_sessions session

        INNER JOIN
          class_schedules schedule

          ON schedule.id =
            session.schedule_id

        INNER JOIN
          dance_courses course

          ON course.id =
            schedule.course_id

        WHERE
          session.id =
            ${sessionId}

          AND
            course.organization_id =
              ${organizationId}

        LIMIT 1
      `

    if (
      !sessions.length
    ) {
      throw createError({
        statusCode: 404,

        statusMessage:
          '找不到課堂資料',
      })
    }

    return sessions[0]
  }