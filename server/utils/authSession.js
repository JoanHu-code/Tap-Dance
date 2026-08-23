import {
  createHash,
  randomBytes,
} from 'node:crypto'

import {
  useDatabase,
} from './db.js'

const COOKIE_NAME =
  'tap_dance_session'

const SESSION_HOURS =
  12

const hashToken = (
  token,
) => {
  return createHash(
    'sha256',
  )
    .update(
      token,
    )
    .digest(
      'hex',
    )
}

// ============================================================
// Create Session
// ============================================================

export const createAuthSession =
  async (
    event,
    userId,
  ) => {
    if (
      !userId
    ) {
      throw createError({
        statusCode: 500,

        message:
          '建立 Session 時缺少 userId',
      })
    }

    const sql =
      useDatabase()

    const token =
      randomBytes(
        32,
      )
        .toString(
          'hex',
        )

    const tokenHash =
      hashToken(
        token,
      )

    // ========================================================
    // Remove Expired Sessions
    // ========================================================

    await sql`
      DELETE FROM
        auth_sessions

      WHERE
        expires_at <
        NOW()
    `

    // ========================================================
    // Create Session
    // ========================================================

    const sessions =
      await sql`
        INSERT INTO
          auth_sessions (
            user_id,
            token_hash,
            expires_at
          )

        VALUES (
          ${userId},
          ${tokenHash},
          NOW()
            + INTERVAL '12 hours'
        )

        RETURNING
          *
      `

    if (
      !sessions.length
    ) {
      throw createError({
        statusCode: 500,

        message:
          '無法建立登入 Session',
      })
    }

    // ========================================================
    // Cookie
    // ========================================================

    setCookie(
      event,
      COOKIE_NAME,
      token,
      {
        httpOnly: true,

        secure:
          process.env.NODE_ENV ===
          'production',

        sameSite:
          'lax',

        path:
          '/',

        maxAge:
          SESSION_HOURS *
          60 *
          60,
      },
    )

    return {
      id:
        sessions[0].id ||
        null,

      userId:
        sessions[0].user_id,

      expiresAt:
        sessions[0].expires_at,
    }
  }

// ============================================================
// Get Auth User
// ============================================================

export const getAuthUser =
  async (
    event,
  ) => {
    const sql =
      useDatabase()

    const token =
      getCookie(
        event,
        COOKIE_NAME,
      )

    if (
      !token
    ) {
      return null
    }

    const tokenHash =
      hashToken(
        token,
      )

    const users =
      await sql`
        SELECT
          app_user.id,

          app_user.line_user_id,

          app_user.display_name,

          app_user.picture_url,

          app_user.role,

          app_user.status

        FROM
          auth_sessions
            AS auth_session

        INNER JOIN
          app_users
            AS app_user

          ON
            app_user.id =
            auth_session.user_id

        WHERE
          auth_session.token_hash =
            ${tokenHash}

          AND
            auth_session.expires_at >
            NOW()

          AND
            app_user.status =
            'ACTIVE'

        LIMIT 1
      `

    if (
      !users.length
    ) {
      return null
    }

    return users[0]
  }

// ============================================================
// Require Auth
// ============================================================

export const requireAuth =
  async (
    event,
  ) => {
    const user =
      await getAuthUser(
        event,
      )

    if (
      !user
    ) {
      throw createError({
        statusCode: 401,

        message:
          '請先使用 LINE 登入',
      })
    }

    return user
  }

// ============================================================
// Remove Session
// ============================================================

export const removeAuthSession =
  async (
    event,
  ) => {
    const sql =
      useDatabase()

    const token =
      getCookie(
        event,
        COOKIE_NAME,
      )

    if (
      token
    ) {
      const tokenHash =
        hashToken(
          token,
        )

      await sql`
        DELETE FROM
          auth_sessions

        WHERE
          token_hash =
          ${tokenHash}
      `
    }

    deleteCookie(
      event,
      COOKIE_NAME,
      {
        path:
          '/',
      },
    )
  }