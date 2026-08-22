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
    // Teacher LINE Channel
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
    // Resolve LINE Identity
    //
    // Teacher API 的 Role 永遠由 Server 固定為 TEACHER。
    // 不接受前端傳 role。
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
          '找不到老師帳號',
      })
    }

    const user =
      users[0]

    // ========================================================
    // Teacher Role
    //
    // 唯一老師只要角色是 TEACHER 即可。
    // 不再檢查 organizations / organization_members。
    // ========================================================

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
    // Create TapLife Session
    // ========================================================

    await createAuthSession(
      event,
      user.id
    )

    return {
      success: true,

      role:
        'TEACHER',

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

      isNewIdentity:
        identity.isNewIdentity,
    }
  }
)