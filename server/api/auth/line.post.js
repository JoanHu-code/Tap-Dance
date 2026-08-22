import {
  useDatabase,
} from '../../utils/db.js'

import {
  createAuthSession,
} from '../../utils/authSession.js'

export default defineEventHandler(
  async (event) => {
    const body =
      await readBody(event)

    const idToken =
      String(
        body?.idToken || ''
      ).trim()

    if (!idToken) {
      throw createError({
        statusCode: 400,
        statusMessage:
          '缺少 LINE ID Token',
      })
    }

    const config =
      useRuntimeConfig()

    const channelId =
      config.lineChannelId

    if (!channelId) {
      throw createError({
        statusCode: 500,
        statusMessage:
          '尚未設定 LINE_CHANNEL_ID',
      })
    }

    // ========================================================
    // 向 LINE 官方驗證 ID Token
    // ========================================================

    const form =
      new URLSearchParams()

    form.set(
      'id_token',
      idToken
    )

    form.set(
      'client_id',
      channelId
    )

    let lineUser

    try {
      lineUser =
        await $fetch(
          'https://api.line.me/oauth2/v2.1/verify',
          {
            method:
              'POST',

            headers: {
              'Content-Type':
                'application/x-www-form-urlencoded',
            },

            body:
              form.toString(),
          }
        )
    } catch (error) {
      console.error(
        'LINE ID Token 驗證失敗：',
        error
      )

      throw createError({
        statusCode: 401,
        statusMessage:
          'LINE 登入驗證失敗，請重新登入',
      })
    }

    // ========================================================
    // 再做基本防禦性檢查
    // ========================================================

    if (
      lineUser.iss !==
      'https://access.line.me'
    ) {
      throw createError({
        statusCode: 401,
        statusMessage:
          'LINE Token Issuer 不正確',
      })
    }

    if (
      String(
        lineUser.aud
      ) !==
      String(
        channelId
      )
    ) {
      throw createError({
        statusCode: 401,
        statusMessage:
          'LINE Token Audience 不正確',
      })
    }

    if (!lineUser.sub) {
      throw createError({
        statusCode: 401,
        statusMessage:
          'LINE 使用者資料不完整',
      })
    }

    const sql =
      useDatabase()

    // ========================================================
    // 查詢使用者
    // ========================================================

    let users =
      await sql`
        SELECT
          id,
          line_user_id,
          display_name,
          picture_url,
          role,
          status

        FROM app_users

        WHERE line_user_id =
          ${lineUser.sub}

        LIMIT 1
      `

    // ========================================================
    // 第一次登入
    //
    // 只建立 PENDING，不直接給權限。
    // ========================================================

    if (!users.length) {
      const inserted =
        await sql`
          INSERT INTO
            app_users (
              line_user_id,
              display_name,
              picture_url,
              status,
              last_login_at
            )

          VALUES (
            ${lineUser.sub},
            ${
              lineUser.name ||
              null
            },
            ${
              lineUser.picture ||
              null
            },
            'PENDING',
            NOW()
          )

          RETURNING
            id,
            line_user_id,
            display_name,
            picture_url,
            role,
            status
        `

      const pendingUser =
        inserted[0]

      return {
        success: false,

        authorized: false,

        status: 'PENDING',

        message:
          'LINE 登入成功，但此帳號尚未取得使用權限。',

        user: {
          displayName:
            pendingUser
              .display_name,

          pictureUrl:
            pendingUser
              .picture_url,
        },
      }
    }

    const user =
      users[0]

    // ========================================================
    // 更新 LINE 顯示資料
    // ========================================================

    await sql`
      UPDATE app_users

      SET
        display_name =
          ${
            lineUser.name ||
            user.display_name
          },

        picture_url =
          ${
            lineUser.picture ||
            user.picture_url
          },

        last_login_at =
          NOW(),

        updated_at =
          NOW()

      WHERE id =
        ${user.id}
    `

    // ========================================================
    // 未授權
    // ========================================================

    if (
      user.status !==
      'ACTIVE'
    ) {
      return {
        success: false,

        authorized: false,

        status:
          user.status,

        message:
          user.status ===
          'BLOCKED'
            ? '此帳號已被停用'
            : 'LINE 登入成功，但此帳號尚未取得使用權限。',
      }
    }

    // ========================================================
    // 建立自己的 Session
    // ========================================================

    await createAuthSession(
      event,
      user.id
    )

    return {
      success: true,

      authorized: true,

      user: {
        id:
          user.id,

        displayName:
          lineUser.name ||
          user.display_name,

        pictureUrl:
          lineUser.picture ||
          user.picture_url,

        role:
          user.role,
      },
    }
  }
)