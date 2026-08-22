import {
  createAuthSession,
} from '../../../utils/authSession.js'

import {
  useDatabase,
} from '../../../utils/db.js'

import {
  resolveLineIdentity,
} from '../../../services/lineIdentityService.js'

export default defineEventHandler(
  async (
    event
  ) => {
    // ========================================================
    // Body
    // ========================================================

    const body =
      await readBody(
        event
      )

    const idToken =
      String(
        body?.idToken ||
        ''
      ).trim()

    if (
      !idToken
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '缺少 LINE ID Token',
      })
    }

    // ========================================================
    // Student Channel
    // ========================================================

    const runtimeConfig =
      useRuntimeConfig()

    // LIFF ID 的格式是 <Channel ID>-<LIFF app ID>。
    // Channel ID 本身不是密鑰；此備援可避免部署環境只設定
    // NUXT_PUBLIC_STUDENT_LIFF_ID 時，登入驗證直接失敗。
    const liffChannelId =
      String(
        runtimeConfig
          .public
          ?.studentLiffId ||
        ''
      )
        .trim()
        .split(
          '-'
        )[0]

    const channelId =
      String(
        runtimeConfig
          .studentLineChannelId ||
        process.env
          .NUXT_STUDENT_LINE_CHANNEL_ID ||
        liffChannelId ||
        ''
      ).trim()

    if (
      !channelId
    ) {
      throw createError({
        statusCode: 500,

        statusMessage:
          '尚未設定 Student LINE Channel ID',
      })
    }

    // ========================================================
    // Resolve Identity
    //
    // Role 永遠是 STUDENT。
    // ========================================================

    const identity =
      await resolveLineIdentity({
        idToken,

        role:
          'STUDENT',

        channelId,
      })

    const sql =
      useDatabase()

    // ========================================================
    // App User
    // ========================================================

    const users =
      await sql`
        SELECT
          id,
          role

        FROM
          app_users

        WHERE
          id =
            ${identity.appUserId}

        LIMIT 1
      `

    if (
      !users.length
    ) {
      throw createError({
        statusCode: 401,

        statusMessage:
          '找不到登入帳號',
      })
    }

    const user =
      users[0]

    if (
      user.role !==
      'STUDENT'
    ) {
      throw createError({
        statusCode: 403,

        statusMessage:
          '此 LINE 帳號不是學生帳號',
      })
    }

    // ========================================================
    // Student Binding
    // ========================================================

    const students =
      await sql`
        SELECT
          id,

          organization_id,

          name,

          status

        FROM
          students

        WHERE
          user_id =
            ${user.id}

        LIMIT 2
      `

    if (
      students.length >
      1
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '此 LINE 帳號綁定多筆 Student，請聯絡老師處理',
      })
    }

    const student =
      students[0] ||
      null

    if (
      student &&
      student.status !==
        'ACTIVE'
    ) {
      throw createError({
        statusCode: 403,

        statusMessage:
          '學生資料目前未啟用',
      })
    }

    // ========================================================
    // Create Session
    //
    // 即使 Student 尚未綁定，
    // STUDENT App User 仍可以登入，
    // 之後才能進行安全綁定流程。
    // ========================================================

    await createAuthSession(
      event,
      user.id
    )

    return {
      success: true,

      role:
        'STUDENT',

      studentBound:
        Boolean(
          student
        ),

      student:
        student
          ? {
              id:
                student.id,

              name:
                student.name,

              organizationId:
                student.organization_id,
            }
          : null,

      profile: {
        name:
          identity.profile
            ?.name ||
          null,

        picture:
          identity.profile
            ?.picture ||
          null,
      },

      isNewUser:
        identity.isNewUser,
    }
  }
)
