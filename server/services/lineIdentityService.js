import {
  randomUUID,
} from 'node:crypto'

import {
  useDatabase,
} from '../utils/db.js'

// ============================================================
// LINE
// ============================================================

const LINE_VERIFY_URL =
  'https://api.line.me/oauth2/v2.1/verify'

// ============================================================
// Role
// ============================================================

const normalizeRole = (
  value
) => {
  const role =
    String(
      value || ''
    )
      .trim()
      .toUpperCase()

  if (
    ![
      'TEACHER',
      'STUDENT',
    ].includes(
      role
    )
  ) {
    throw createError({
      statusCode: 400,

      statusMessage:
        'LINE Login Role 不正確',
    })
  }

  return role
}

// ============================================================
// Text
// ============================================================

const normalizeText = (
  value,
  maxLength = 500
) => {
  if (
    value === undefined ||
    value === null
  ) {
    return null
  }

  const normalized =
    String(
      value
    )
      .trim()
      .slice(
        0,
        maxLength
      )

  return (
    normalized ||
    null
  )
}

// ============================================================
// Verify LINE ID Token
// ============================================================

export const verifyLineIdToken =
  async ({
    idToken,
    channelId,
  }) => {
    const normalizedToken =
      String(
        idToken || ''
      ).trim()

    const normalizedChannelId =
      String(
        channelId || ''
      ).trim()

    if (
      !normalizedToken
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '缺少 LINE ID Token',
      })
    }

    if (
      !normalizedChannelId
    ) {
      throw createError({
        statusCode: 500,

        statusMessage:
          'Server 尚未設定 LINE Channel ID',
      })
    }

    let profile

    try {
      profile =
        await $fetch(
          LINE_VERIFY_URL,
          {
            method:
              'POST',

            headers: {
              'content-type':
                'application/x-www-form-urlencoded',
            },

            body:
              new URLSearchParams({
                id_token:
                  normalizedToken,

                client_id:
                  normalizedChannelId,
              }),
          }
        )
    } catch (error) {
      console.error(
        'LINE ID Token Verify 失敗：',
        error
      )

      throw createError({
        statusCode: 401,

        statusMessage:
          'LINE 登入驗證失敗，請重新登入',
      })
    }

    // ========================================================
    // Audience
    // ========================================================

    if (
      String(
        profile?.aud ||
        ''
      ) !==
      normalizedChannelId
    ) {
      throw createError({
        statusCode: 401,

        statusMessage:
          'LINE ID Token Audience 不符合目前 LIFF Channel',
      })
    }

    // ========================================================
    // Issuer
    // ========================================================

    if (
      profile?.iss &&
      profile.iss !==
        'https://access.line.me'
    ) {
      throw createError({
        statusCode: 401,

        statusMessage:
          'LINE ID Token Issuer 不正確',
      })
    }

    // ========================================================
    // Subject
    // ========================================================

    const lineUserId =
      String(
        profile?.sub ||
        ''
      ).trim()

    if (
      !lineUserId
    ) {
      throw createError({
        statusCode: 401,

        statusMessage:
          'LINE Token 找不到使用者識別碼',
      })
    }

    return {
      lineUserId,

      channelId:
        normalizedChannelId,

      issuer:
        profile?.iss ||
        null,

      name:
        normalizeText(
          profile?.name,
          255
        ),

      picture:
        normalizeText(
          profile?.picture,
          1000
        ),

      raw:
        profile,
    }
  }

// ============================================================
// Find Identity
// ============================================================

const findIdentity =
  async (
    sql,
    {
      lineUserId,
      role,
    }
  ) => {
    const rows =
      await sql`
        SELECT
          identity.id,

          identity.app_user_id,

          identity.line_user_id,

          identity.login_role,

          identity.channel_id,

          identity.display_name,

          identity.picture_url,

          identity.last_login_at,

          user.role
            AS app_user_role

        FROM
          app_user_line_identities identity

        INNER JOIN
          app_users user

          ON user.id =
            identity.app_user_id

        WHERE
          identity.line_user_id =
            ${lineUserId}

          AND
            identity.login_role =
              ${role}

        LIMIT 1
      `

    return (
      rows[0] ||
      null
    )
  }

// ============================================================
// Find Legacy App User
//
// 用於 Migration 前已經存在的使用者。
// 只有 Role 本來就相同才允許採用。
// 絕對不改 role。
// ============================================================

const findLegacyAppUser =
  async (
    sql,
    {
      lineUserId,
      role,
    }
  ) => {
    const rows =
      await sql`
        SELECT
          id,
          role

        FROM
          app_users

        WHERE
          line_user_id =
            ${lineUserId}

          AND
            role =
              ${role}

        LIMIT 1
      `

    return (
      rows[0] ||
      null
    )
  }

// ============================================================
// Create App User
//
// app_users 仍保留 role，
// 但 role 從「建立那一刻」就固定。
// 不允許 LINE Login 後續覆蓋。
// ============================================================

const createAppUser =
  async (
    sql,
    {
      lineUserId,
      role,
    }
  ) => {
    const userId =
      randomUUID()

    const rows =
      await sql`
        INSERT INTO
          app_users (
            id,
            line_user_id,
            role,
            created_at,
            updated_at
          )

        VALUES (
          ${userId},
          ${lineUserId},
          ${role},
          NOW(),
          NOW()
        )

        RETURNING
          id,
          role
      `

    return rows[0]
  }

// ============================================================
// Bind Identity
// ============================================================

const bindIdentity =
  async (
    sql,
    {
      appUserId,
      profile,
      role,
    }
  ) => {
    const identityId =
      randomUUID()

    const rows =
      await sql`
        INSERT INTO
          app_user_line_identities (
            id,

            app_user_id,

            line_user_id,

            login_role,

            channel_id,

            issuer,

            display_name,

            picture_url,

            last_login_at,

            created_at,

            updated_at
          )

        VALUES (
          ${identityId},

          ${appUserId},

          ${profile.lineUserId},

          ${role},

          ${profile.channelId},

          ${profile.issuer},

          ${profile.name},

          ${profile.picture},

          NOW(),

          NOW(),

          NOW()
        )

        RETURNING
          *
      `

    return rows[0]
  }

// ============================================================
// Login / Resolve Identity
// ============================================================

export const resolveLineIdentity =
  async ({
    idToken,
    role,
    channelId,
  }) => {
    const normalizedRole =
      normalizeRole(
        role
      )

    // ========================================================
    // Verify Token
    // ========================================================

    const profile =
      await verifyLineIdToken({
        idToken,

        channelId,
      })

    const sql =
      useDatabase()

    // ========================================================
    // 1. Existing Binding
    // ========================================================

    const existingIdentity =
      await findIdentity(
        sql,
        {
          lineUserId:
            profile.lineUserId,

          role:
            normalizedRole,
        }
      )

    if (
      existingIdentity
    ) {
      // ======================================================
      // DB 防線：
      //
      // Identity = STUDENT
      // App User role 也必須 STUDENT。
      // ======================================================

      if (
        existingIdentity
          .app_user_role !==
        normalizedRole
      ) {
        throw createError({
          statusCode: 409,

          statusMessage:
            'LINE Identity 與 App User Role 不一致，請由管理員檢查帳號資料',
        })
      }

      // ======================================================
      // Channel 也必須一致
      //
      // 防止日後拿其他 Channel Token
      // 來冒充既有 Binding。
      // ======================================================

      if (
        String(
          existingIdentity
            .channel_id
        ) !==
        String(
          profile.channelId
        )
      ) {
        throw createError({
          statusCode: 409,

          statusMessage:
            '這個 LINE 身分已綁定其他 Login Channel',
        })
      }

      await sql`
        UPDATE
          app_user_line_identities

        SET
          display_name =
            ${profile.name},

          picture_url =
            ${profile.picture},

          last_login_at =
            NOW(),

          updated_at =
            NOW()

        WHERE
          id =
            ${existingIdentity.id}
      `

      return {
        appUserId:
          existingIdentity
            .app_user_id,

        role:
          normalizedRole,

        lineUserId:
          profile.lineUserId,

        isNewUser:
          false,

        profile,
      }
    }

    // ========================================================
    // 2. Legacy User
    //
    // 舊版可能已經有：
    //
    // app_users.line_user_id
    // app_users.role
    //
    // 只有 role 正確才採用。
    // ========================================================

    let appUser =
      await findLegacyAppUser(
        sql,
        {
          lineUserId:
            profile.lineUserId,

          role:
            normalizedRole,
        }
      )

    let isNewUser =
      false

    // ========================================================
    // 3. Create
    // ========================================================

    if (
      !appUser
    ) {
      try {
        appUser =
          await createAppUser(
            sql,
            {
              lineUserId:
                profile.lineUserId,

              role:
                normalizedRole,
            }
          )

        isNewUser =
          true
      } catch (error) {
        // ====================================================
        // 最重要：
        //
        // 不要為了解決 duplicate
        // UPDATE role。
        //
        // 如果 app_users.line_user_id 是 UNIQUE，
        // 代表這個 LINE User 已經用另一角色存在。
        //
        // 直接拒絕。
        // ====================================================

        if (
          String(
            error?.message ||
            ''
          )
            .toLowerCase()
            .includes(
              'duplicate'
            )
        ) {
          throw createError({
            statusCode: 409,

            statusMessage:
              `此 LINE 帳號已綁定其他角色，不能切換成 ${normalizedRole}`,
          })
        }

        throw error
      }
    }

    // ========================================================
    // 4. Bind
    // ========================================================

    try {
      await bindIdentity(
        sql,
        {
          appUserId:
            appUser.id,

          profile,

          role:
            normalizedRole,
        }
      )
    } catch (error) {
      if (
        String(
          error?.message ||
          ''
        )
          .toLowerCase()
          .includes(
            'duplicate'
          )
      ) {
        throw createError({
          statusCode: 409,

          statusMessage:
            'LINE Identity 已被其他帳號綁定，請重新整理後再試',
        })
      }

      throw error
    }

    return {
      appUserId:
        appUser.id,

      role:
        normalizedRole,

      lineUserId:
        profile.lineUserId,

      isNewUser,

      profile,
    }
  }