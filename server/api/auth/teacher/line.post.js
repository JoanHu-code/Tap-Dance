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
    // Teacher Channel
    // ========================================================

    const runtimeConfig =
      useRuntimeConfig()

    const channelId =
      String(
        runtimeConfig
          .teacherLineChannelId ||
        process.env
          .NUXT_TEACHER_LINE_CHANNEL_ID ||
        ''
      ).trim()

    if (
      !channelId
    ) {
      throw createError({
        statusCode: 500,

        statusMessage:
          '尚未設定 Teacher LINE Channel ID',
      })
    }

    // ========================================================
    // Resolve
    //
    // Role 永遠由 Server 決定。
    // ========================================================

    const identity =
      await resolveLineIdentity({
        idToken,

        role:
          'TEACHER',

        channelId,
      })

    const sql =
      useDatabase()

    // ========================================================
    // 再次確認 App User
    //
    // 絕不 UPDATE role。
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
      'TEACHER'
    ) {
      throw createError({
        statusCode: 403,

        statusMessage:
          '此 LINE 帳號不是老師帳號',
      })
    }

    // ========================================================
    // Teacher Organization
    //
    // Teacher 新帳號不能只是登入成功，
    // 必須已被加入 organization_members。
    //
    // 目前只有一位老師，
    // 建議第一位老師由 DB / Seed 建立 membership。
    // ========================================================

    const memberships =
      await sql`
        SELECT
          organization_id

        FROM
          organization_members

        WHERE
          user_id =
            ${user.id}

        LIMIT 2
      `

    if (
      !memberships.length
    ) {
      throw createError({
        statusCode: 403,

        statusMessage:
          '老師帳號尚未被授權加入 Organization',
      })
    }

    if (
      memberships.length >
      1
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '老師屬於多個 Organization，目前無法判斷工作空間',
      })
    }

    // ========================================================
    // Session
    //
    // 這裡沿用既有 authSession。
    // ========================================================

    await createAuthSession(
      event,
      user.id
    )

    return {
      success: true,

      role:
        'TEACHER',

      organizationId:
        memberships[0]
          .organization_id,

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