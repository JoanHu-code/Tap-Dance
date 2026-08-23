import {
  createAuthSession,
} from '../../../utils/authSession.js'

import {
  resolveLineIdentity,
} from '../../../services/lineIdentityService.js'

export default defineEventHandler(
  async (
    event,
  ) => {
    // ========================================================
    // Request Body
    // ========================================================

    const body =
      await readBody(
        event,
      )

    const idToken =
      String(
        body?.idToken ||
        '',
      ).trim()

    if (
      !idToken
    ) {
      throw createError({
        statusCode: 400,

        message:
          '缺少 LINE ID Token',
      })
    }

    // ========================================================
    // Teacher LINE Channel ID
    // ========================================================

    const runtimeConfig =
      useRuntimeConfig()

    const channelId =
      String(
        runtimeConfig
          .teacherLineChannelId ||
        process.env
          .NUXT_TEACHER_LINE_CHANNEL_ID ||
        '',
      ).trim()

    if (
      !channelId
    ) {
      throw createError({
        statusCode: 500,

        message:
          '尚未設定 Teacher LINE Channel ID',
      })
    }

    // ========================================================
    // Resolve LINE Identity
    // ========================================================

    const result =
      await resolveLineIdentity({
        idToken,

        channelId,

        expectedRole:
          'TEACHER',
      })

    // ========================================================
    // App User
    // ========================================================

    const user =
      result?.user

    if (
      !user?.id
    ) {
      console.error(
        'Teacher LINE Login：resolveLineIdentity 沒有回傳 user.id',
        {
          hasResult:
            Boolean(
              result,
            ),

          hasUser:
            Boolean(
              result?.user,
            ),

          hasIdentity:
            Boolean(
              result?.identity,
            ),

          bootstrapped:
            Boolean(
              result?.bootstrapped,
            ),
        },
      )

      throw createError({
        statusCode: 500,

        message:
          'LINE 登入成功，但無法取得老師帳號',
      })
    }

    // ========================================================
    // Role
    // ========================================================

    if (
      user.role !==
      'TEACHER'
    ) {
      throw createError({
        statusCode: 403,

        message:
          '此 LINE 帳號不是老師帳號',
      })
    }

    // ========================================================
    // Status
    // ========================================================

    if (
      user.status !==
      'ACTIVE'
    ) {
      throw createError({
        statusCode: 403,

        message:
          '老師帳號目前未啟用',
      })
    }

    // ========================================================
    // Create Session
    // ========================================================

    const session =
      await createAuthSession(
        event,
        user.id,
      )

    console.log(
      'Teacher Session Created:',
      {
        userId:
          user.id,

        sessionId:
          session?.id ||
          null,

        expiresAt:
          session?.expiresAt ||
          null,
      },
    )

    // ========================================================
    // Response
    // ========================================================

    return {
      success:
        true,

      role:
        'TEACHER',

      user: {
        id:
          user.id,

        displayName:
          user.display_name ||
          null,

        pictureUrl:
          user.picture_url ||
          null,
      },

      profile: {
        name:
          result
            ?.lineProfile
            ?.displayName ||
          user.display_name ||
          null,

        picture:
          result
            ?.lineProfile
            ?.pictureUrl ||
          user.picture_url ||
          null,
      },

      bootstrapped:
        Boolean(
          result?.bootstrapped,
        ),

      sessionCreated:
        Boolean(
          session,
        ),
    }
  },
)