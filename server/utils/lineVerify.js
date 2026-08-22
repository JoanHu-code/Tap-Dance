const LINE_VERIFY_URL =
  'https://api.line.me/oauth2/v2.1/verify'

const normalizeRole = (
  role
) => {
  const normalized =
    String(
      role || ''
    )
      .trim()
      .toUpperCase()

  if (
    ![
      'TEACHER',
      'STUDENT',
    ].includes(
      normalized
    )
  ) {
    throw createError({
      statusCode: 500,
      statusMessage:
        `不支援的 LINE Role：${role}`,
    })
  }

  return normalized
}

const getChannelId = (
  role
) => {
  const normalizedRole =
    normalizeRole(role)

  const config =
    useRuntimeConfig()

  if (
    normalizedRole ===
    'TEACHER'
  ) {
    return config
      .teacherLineChannelId
  }

  return config
    .studentLineChannelId
}

export const verifyLineIdToken =
  async (
    idToken,
    role
  ) => {
    if (!idToken) {
      throw createError({
        statusCode: 401,
        statusMessage:
          '缺少 LINE ID Token',
      })
    }

    const normalizedRole =
      normalizeRole(role)

    const channelId =
      getChannelId(
        normalizedRole
      )

    if (!channelId) {
      throw createError({
        statusCode: 500,

        statusMessage:
          normalizedRole ===
          'TEACHER'
            ? '找不到 NUXT_TEACHER_LINE_CHANNEL_ID'
            : '找不到 NUXT_STUDENT_LINE_CHANNEL_ID',
      })
    }

    let response

    try {
      response =
        await $fetch(
          LINE_VERIFY_URL,
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/x-www-form-urlencoded',
            },

            body:
              new URLSearchParams({
                id_token:
                  idToken,

                client_id:
                  channelId,
              }),
          }
        )
    } catch (error) {
      console.error(
        `${normalizedRole} LINE ID Token 驗證失敗：`,
        error
      )

      throw createError({
        statusCode: 401,
        statusMessage:
          'LINE 登入驗證失敗',
      })
    }

    if (
      !response ||
      !response.sub
    ) {
      throw createError({
        statusCode: 401,
        statusMessage:
          'LINE ID Token 無效',
      })
    }

    if (
      String(
        response.aud
      ) !==
      String(
        channelId
      )
    ) {
      throw createError({
        statusCode: 401,
        statusMessage:
          normalizedRole ===
          'TEACHER'
            ? '這不是老師 LINE Channel 的 Token'
            : '這不是學生 LINE Channel 的 Token',
      })
    }

    const now =
      Math.floor(
        Date.now() /
        1000
      )

    if (
      response.exp &&
      Number(
        response.exp
      ) <= now
    ) {
      throw createError({
        statusCode: 401,
        statusMessage:
          'LINE ID Token 已過期',
      })
    }

    return {
      role:
        normalizedRole,

      lineUserId:
        response.sub,

      displayName:
        response.name ||
        null,

      pictureUrl:
        response.picture ||
        null,

      email:
        response.email ||
        null,

      issuer:
        response.iss ||
        null,

      audience:
        response.aud ||
        null,

      expiresAt:
        response.exp ||
        null,

      issuedAt:
        response.iat ||
        null,
    }
  }