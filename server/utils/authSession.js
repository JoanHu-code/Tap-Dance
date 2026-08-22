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
  token
) => {
  return createHash(
    'sha256'
  )
    .update(token)
    .digest('hex')
}

export const createAuthSession =
  async (
    event,
    userId
  ) => {
    const sql =
      useDatabase()

    const token =
      randomBytes(32)
        .toString('hex')

    const tokenHash =
      hashToken(token)

    await sql`
      DELETE FROM auth_sessions
      WHERE expires_at < NOW()
    `

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
    `

    setCookie(
      event,
      COOKIE_NAME,
      token,
      {
        httpOnly: true,

        secure:
          process.env.NODE_ENV ===
          'production',

        sameSite: 'lax',

        path: '/',

        maxAge:
          SESSION_HOURS *
          60 *
          60,
      }
    )
  }

export const getAuthUser =
  async (event) => {
    const sql =
      useDatabase()

    const token =
      getCookie(
        event,
        COOKIE_NAME
      )

    if (!token) {
      return null
    }

    const tokenHash =
      hashToken(token)

    const users =
      await sql`
        SELECT
          u.id,
          u.line_user_id,
          u.display_name,
          u.picture_url,
          u.role,
          u.status

        FROM auth_sessions s

        INNER JOIN app_users u
          ON u.id =
            s.user_id

        WHERE
          s.token_hash =
            ${tokenHash}

          AND s.expires_at >
            NOW()

          AND u.status =
            'ACTIVE'

        LIMIT 1
      `

    if (!users.length) {
      return null
    }

    return users[0]
  }

export const requireAuth =
  async (event) => {
    const user =
      await getAuthUser(event)

    if (!user) {
      throw createError({
        statusCode: 401,
        statusMessage:
          '請先使用 LINE 登入',
      })
    }

    return user
  }

export const removeAuthSession =
  async (event) => {
    const sql =
      useDatabase()

    const token =
      getCookie(
        event,
        COOKIE_NAME
      )

    if (token) {
      const tokenHash =
        hashToken(token)

      await sql`
        DELETE FROM
          auth_sessions

        WHERE token_hash =
          ${tokenHash}
      `
    }

    deleteCookie(
      event,
      COOKIE_NAME,
      {
        path: '/',
      }
    )
  }