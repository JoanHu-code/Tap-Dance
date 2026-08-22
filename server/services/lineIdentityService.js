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
          line_identity.id,

          line_identity.app_user_id,

          line_identity.line_user_id,

          line_identity.login_role,

          line_identity.channel_id,

          line_identity.display_name,

          line_identity.picture_url,

          line_identity.last_login_at,

          app_user.role
            AS app_user_role

        FROM
          app_user_line_identities line_identity

        INNER JOIN
          app_users app_user

          ON app_user.id =
            line_identity.app_user_id

        WHERE
          line_identity.line_user_id =
            ${lineUserId}

          AND
            line_identity.login_role =
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
// 舊系統可能已經有：
//
// app_users.line_user_id
// app_users.role
//
// 只有 role 本來就相同才可以採用。
// 絕對不修改 role。
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
          app_user.id,

          app_user.role

        FROM
          app_users app_user

        WHERE
          app_user.line_user_id =
            ${lineUserId}

          AND
            app_user.role =
              ${role}

        LIMIT 1
      `

    return (
      rows[0] ||
      null
    )
  }

// ============================================================
// Find Any Legacy App User
//
// 用於判斷同一 LINE User 是否已經存在其他角色。
// ============================================================

const findAnyLegacyAppUser =
  async (
    sql,
    lineUserId
  ) => {
    const rows =
      await sql`
        SELECT
          app_user.id,

          app_user.line_user_id,

          app_user.role

        FROM
          app_users app_user

        WHERE
          app_user.line_user_id =
            ${lineUserId}

        LIMIT 1
      `

    return (
      rows[0] ||
      null
    )
  }

// ============================================================
// Create App User
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
          line_user_id,
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
      `

    return rows[0]
  }

// ============================================================
// Update Existing Identity
// ============================================================

const updateIdentityLogin =
  async (
    sql,
    {
      identityId,
      profile,
    }
  ) => {
    const rows =
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
            ${identityId}

        RETURNING
          *
      `

    return (
      rows[0] ||
      null
    )
  }

// ============================================================
// Resolve LINE Identity
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
    // 1. Verify LINE Token
    // ========================================================

    const profile =
      await verifyLineIdToken({
        idToken,

        channelId,
      })

    const sql =
      useDatabase()

    // ========================================================
    // 2. Existing Identity
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
      // Identity Role 與 app_users.role 必須一致
      // ======================================================

      if (
        existingIdentity
          .app_user_role !==
        normalizedRole
      ) {
        throw createError({
          statusCode: 409,

          statusMessage:
            'LINE Identity 與 App User Role 不一致，請檢查帳號資料',
        })
      }

      // ======================================================
      // Login Channel 也必須一致
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

      await updateIdentityLogin(
        sql,
        {
          identityId:
            existingIdentity.id,

          profile,
        }
      )

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

        isNewIdentity:
          false,

        profile,
      }
    }

    // ========================================================
    // 3. 找舊版 App User
    //
    // LINE User + Role 都必須一致。
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
    // 4. 同 LINE User 若已存在其他 Role
    //
    // 不允許 UPDATE role。
    // ========================================================

    if (
      !appUser
    ) {
      const existingOtherRoleUser =
        await findAnyLegacyAppUser(
          sql,
          profile.lineUserId
        )

      if (
        existingOtherRoleUser &&
        existingOtherRoleUser.role !==
          normalizedRole
      ) {
        throw createError({
          statusCode: 409,

          statusMessage:
            `此 LINE 帳號目前已綁定 ${existingOtherRoleUser.role} 角色，不能直接切換成 ${normalizedRole}`,
        })
      }
    }

    // ========================================================
    // 5. Create App User
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
        const message =
          String(
            error?.message ||
            ''
          )
            .toLowerCase()

        if (
          message.includes(
            'duplicate'
          ) ||
          error?.code ===
            '23505'
        ) {
          throw createError({
            statusCode: 409,

            statusMessage:
              '此 LINE 帳號已存在，請重新整理後再登入',
          })
        }

        throw error
      }
    }

    // ========================================================
    // 6. Bind Identity
    // ========================================================

    let identity

    try {
      identity =
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
      const message =
        String(
          error?.message ||
          ''
        )
          .toLowerCase()

      if (
        message.includes(
          'duplicate'
        ) ||
        error?.code ===
          '23505'
      ) {
        // ====================================================
        // 同時登入造成 race condition：
        //
        // 再讀一次 Identity。
        // ====================================================

        const racedIdentity =
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
          racedIdentity &&
          racedIdentity
            .app_user_role ===
            normalizedRole &&
          String(
            racedIdentity
              .channel_id
          ) ===
          String(
            profile.channelId
          )
        ) {
          await updateIdentityLogin(
            sql,
            {
              identityId:
                racedIdentity.id,

              profile,
            }
          )

          return {
            appUserId:
              racedIdentity
                .app_user_id,

            role:
              normalizedRole,

            lineUserId:
              profile.lineUserId,

            isNewUser:
              false,

            isNewIdentity:
              false,

            profile,
          }
        }

        throw createError({
          statusCode: 409,

          statusMessage:
            'LINE Identity 已被其他帳號綁定，請重新整理後再試',
        })
      }

      throw error
    }

    // ========================================================
    // 7. Result
    // ========================================================

    return {
      appUserId:
        appUser.id,

      role:
        normalizedRole,

      lineUserId:
        profile.lineUserId,

      identityId:
        identity.id,

      isNewUser,

      isNewIdentity:
        true,

      profile,
    }
  }