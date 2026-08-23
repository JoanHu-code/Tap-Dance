import {
  randomUUID,
} from 'node:crypto'

import {
  useDatabase,
} from '../utils/db.js'

// ============================================================
// Constants
// ============================================================

const ROLE_TEACHER =
  'TEACHER'

const ROLE_STUDENT =
  'STUDENT'

const STATUS_ACTIVE =
  'ACTIVE'

const LINE_ISSUER =
  'https://access.line.me'

const VALID_ROLES = [
  ROLE_TEACHER,
  ROLE_STUDENT,
]

// ============================================================
// Normalize
// ============================================================

const normalizeText = (
  value,
) => {
  return String(
    value ?? '',
  ).trim()
}

const normalizeNullableText = (
  value,
) => {
  const normalized =
    normalizeText(
      value,
    )

  return (
    normalized ||
    null
  )
}

const normalizeRole = (
  value,
) => {
  const normalized =
    normalizeText(
      value,
    )
      .toUpperCase()

  if (
    !VALID_ROLES.includes(
      normalized,
    )
  ) {
    throw createError({
      statusCode: 400,

      statusMessage:
        `不支援的 LINE 登入角色：${value}`,
    })
  }

  return normalized
}

// ============================================================
// Verify LINE ID Token
// ============================================================

export const verifyLineIdToken =
  async ({
    idToken,
    channelId,
  }) => {
    const normalizedIdToken =
      normalizeText(
        idToken,
      )

    const normalizedChannelId =
      normalizeText(
        channelId,
      )

    if (
      !normalizedIdToken
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
          '伺服器尚未設定 LINE Channel ID',
      })
    }

    const params =
      new URLSearchParams()

    params.set(
      'id_token',
      normalizedIdToken,
    )

    params.set(
      'client_id',
      normalizedChannelId,
    )

    let response

    try {
      response =
        await fetch(
          'https://api.line.me/oauth2/v2.1/verify',
          {
            method:
              'POST',

            headers: {
              'Content-Type':
                'application/x-www-form-urlencoded',
            },

            body:
              params.toString(),
          },
        )
    }
    catch (error) {
      console.error(
        '無法連線 LINE ID Token 驗證服務：',
        error,
      )

      throw createError({
        statusCode: 502,

        statusMessage:
          '無法連線 LINE 驗證服務',
      })
    }

    let result

    try {
      result =
        await response.json()
    }
    catch (error) {
      console.error(
        'LINE Token 驗證回應解析失敗：',
        error,
      )

      throw createError({
        statusCode: 502,

        statusMessage:
          'LINE 驗證服務回應格式錯誤',
      })
    }

    if (
      !response.ok
    ) {
      console.error(
        'LINE ID Token 驗證失敗：',
        result,
      )

      throw createError({
        statusCode: 401,

        statusMessage:
          result
            ?.error_description ||
          'LINE ID Token 驗證失敗',
      })
    }

    const audience =
      normalizeText(
        result.aud,
      )

    if (
      audience !==
      normalizedChannelId
    ) {
      console.error(
        'LINE Token Channel 不一致：',
        {
          expected:
            normalizedChannelId,

          actual:
            audience,
        },
      )

      throw createError({
        statusCode: 401,

        statusMessage:
          'LINE Login Channel 不符合',
      })
    }

    const lineUserId =
      normalizeText(
        result.sub,
      )

    if (
      !lineUserId
    ) {
      throw createError({
        statusCode: 401,

        statusMessage:
          'LINE Token 缺少使用者識別碼',
      })
    }

    return {
      lineUserId,

      channelId:
        normalizedChannelId,

      issuer:
        normalizeNullableText(
          result.iss,
        ) ||
        LINE_ISSUER,

      displayName:
        normalizeNullableText(
          result.name,
        ),

      pictureUrl:
        normalizeNullableText(
          result.picture,
        ),

      email:
        normalizeNullableText(
          result.email,
        ),
    }
  }

// ============================================================
// Find Exact LINE Identity
//
// 真實 Schema：
//
// app_user_line_identities.login_role
//
// 不是：
//
// app_user_line_identities.role
// ============================================================

const findIdentity =
  async ({
    sql,
    lineUserId,
    channelId,
    expectedRole,
  }) => {
    const rows =
      await sql`
        SELECT
          line_identity.id
            AS identity_id,

          line_identity.app_user_id,

          line_identity.line_user_id
            AS identity_line_user_id,

          line_identity.login_role
            AS identity_login_role,

          line_identity.channel_id
            AS identity_channel_id,

          line_identity.issuer
            AS identity_issuer,

          line_identity.display_name
            AS identity_display_name,

          line_identity.picture_url
            AS identity_picture_url,

          line_identity.last_login_at
            AS identity_last_login_at,

          line_identity.created_at
            AS identity_created_at,

          line_identity.updated_at
            AS identity_updated_at,

          app_user.id
            AS user_id,

          app_user.line_user_id
            AS user_line_user_id,

          app_user.display_name
            AS user_display_name,

          app_user.picture_url
            AS user_picture_url,

          app_user.role
            AS user_role,

          app_user.status
            AS user_status,

          app_user.last_login_at
            AS user_last_login_at,

          app_user.created_at
            AS user_created_at,

          app_user.updated_at
            AS user_updated_at

        FROM
          app_user_line_identities
            AS line_identity

        INNER JOIN
          app_users
            AS app_user

          ON
            app_user.id =
            line_identity.app_user_id

        WHERE
          line_identity.line_user_id =
            ${lineUserId}

          AND
            line_identity.channel_id =
            ${channelId}

          AND
            line_identity.login_role =
            ${expectedRole}

        LIMIT 1
      `

    return (
      rows[0] ||
      null
    )
  }

// ============================================================
// Find Identity By LINE + Channel
// ============================================================

const findIdentityByChannel =
  async ({
    sql,
    lineUserId,
    channelId,
  }) => {
    const rows =
      await sql`
        SELECT
          line_identity.id,

          line_identity.app_user_id,

          line_identity.line_user_id,

          line_identity.login_role,

          line_identity.channel_id,

          line_identity.issuer,

          line_identity.display_name,

          line_identity.picture_url,

          line_identity.last_login_at,

          line_identity.created_at,

          line_identity.updated_at

        FROM
          app_user_line_identities
            AS line_identity

        WHERE
          line_identity.line_user_id =
            ${lineUserId}

          AND
            line_identity.channel_id =
            ${channelId}

        LIMIT 1
      `

    return (
      rows[0] ||
      null
    )
  }

// ============================================================
// Find App User By LINE User ID
// ============================================================

const findAppUserByLineUserId =
  async ({
    sql,
    lineUserId,
  }) => {
    const rows =
      await sql`
        SELECT
          app_user.id,

          app_user.line_user_id,

          app_user.display_name,

          app_user.picture_url,

          app_user.role,

          app_user.status,

          app_user.last_login_at,

          app_user.created_at,

          app_user.updated_at

        FROM
          app_users
            AS app_user

        WHERE
          app_user.line_user_id =
            ${lineUserId}

        ORDER BY
          app_user.created_at ASC

        LIMIT 1
      `

    return (
      rows[0] ||
      null
    )
  }

// ============================================================
// Find Teachers
// ============================================================

const findTeachers =
  async (
    sql,
  ) => {
    return await sql`
      SELECT
        app_user.id,

        app_user.line_user_id,

        app_user.display_name,

        app_user.picture_url,

        app_user.role,

        app_user.status,

        app_user.last_login_at,

        app_user.created_at,

        app_user.updated_at

      FROM
        app_users
          AS app_user

      WHERE
        app_user.role =
          'TEACHER'

      ORDER BY
        app_user.created_at ASC
    `
  }

// ============================================================
// Find Teacher Identity
// ============================================================

const findTeacherIdentity =
  async ({
    sql,
    teacherId,
  }) => {
    const rows =
      await sql`
        SELECT
          line_identity.id,

          line_identity.app_user_id,

          line_identity.line_user_id,

          line_identity.login_role,

          line_identity.channel_id,

          line_identity.issuer,

          line_identity.display_name,

          line_identity.picture_url,

          line_identity.last_login_at,

          line_identity.created_at,

          line_identity.updated_at

        FROM
          app_user_line_identities
            AS line_identity

        WHERE
          line_identity.app_user_id =
            ${teacherId}

          AND
            line_identity.login_role =
            'TEACHER'

        ORDER BY
          line_identity.created_at ASC

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
  async ({
    sql,
    lineProfile,
    role,
  }) => {
    const userId =
      randomUUID()

    const rows =
      await sql`
        INSERT INTO
          app_users (
            id,

            line_user_id,

            display_name,

            picture_url,

            role,

            status,

            last_login_at,

            created_at,

            updated_at
          )

        VALUES (
          ${userId},

          ${lineProfile.lineUserId},

          ${
            lineProfile.displayName ||
            null
          },

          ${
            lineProfile.pictureUrl ||
            null
          },

          ${role},

          ${STATUS_ACTIVE},

          NOW(),

          NOW(),

          NOW()
        )

        RETURNING
          id,

          line_user_id,

          display_name,

          picture_url,

          role,

          status,

          last_login_at,

          created_at,

          updated_at
      `

    return (
      rows[0] ||
      null
    )
  }

// ============================================================
// Create LINE Identity
// ============================================================

const createIdentity =
  async ({
    sql,
    appUserId,
    lineProfile,
    role,
  }) => {
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

          ${lineProfile.lineUserId},

          ${role},

          ${lineProfile.channelId},

          ${
            lineProfile.issuer ||
            LINE_ISSUER
          },

          ${
            lineProfile.displayName ||
            null
          },

          ${
            lineProfile.pictureUrl ||
            null
          },

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

    return (
      rows[0] ||
      null
    )
  }

// ============================================================
// Update Login Metadata
// ============================================================

const updateLoginMetadata =
  async ({
    sql,
    appUserId,
    identityId,
    lineProfile,
  }) => {
    const userRows =
      await sql`
        UPDATE
          app_users

        SET
          line_user_id =
            ${lineProfile.lineUserId},

          display_name =
            COALESCE(
              ${
                lineProfile.displayName ||
                null
              },
              display_name
            ),

          picture_url =
            COALESCE(
              ${
                lineProfile.pictureUrl ||
                null
              },
              picture_url
            ),

          last_login_at =
            NOW(),

          updated_at =
            NOW()

        WHERE
          id =
            ${appUserId}

        RETURNING
          id,

          line_user_id,

          display_name,

          picture_url,

          role,

          status,

          last_login_at,

          created_at,

          updated_at
      `

    let identity =
      null

    if (
      identityId
    ) {
      const identityRows =
        await sql`
          UPDATE
            app_user_line_identities

          SET
            issuer =
              ${
                lineProfile.issuer ||
                LINE_ISSUER
              },

            display_name =
              COALESCE(
                ${
                  lineProfile.displayName ||
                  null
                },
                display_name
              ),

            picture_url =
              COALESCE(
                ${
                  lineProfile.pictureUrl ||
                  null
                },
                picture_url
              ),

            last_login_at =
              NOW(),

            updated_at =
              NOW()

          WHERE
            id =
              ${identityId}

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

      identity =
        identityRows[0] ||
        null
    }

    return {
      user:
        userRows[0] ||
        null,

      identity,
    }
  }

// ============================================================
// Map Joined Identity
// ============================================================

const mapJoinedIdentity =
  (
    row,
  ) => {
    return {
      user: {
        id:
          row.user_id,

        line_user_id:
          row.user_line_user_id,

        display_name:
          row.user_display_name,

        picture_url:
          row.user_picture_url,

        role:
          row.user_role,

        status:
          row.user_status,

        last_login_at:
          row.user_last_login_at,

        created_at:
          row.user_created_at,

        updated_at:
          row.user_updated_at,
      },

      identity: {
        id:
          row.identity_id,

        app_user_id:
          row.app_user_id,

        line_user_id:
          row.identity_line_user_id,

        login_role:
          row.identity_login_role,

        channel_id:
          row.identity_channel_id,

        issuer:
          row.identity_issuer,

        display_name:
          row.identity_display_name,

        picture_url:
          row.identity_picture_url,

        last_login_at:
          row.identity_last_login_at,

        created_at:
          row.identity_created_at,

        updated_at:
          row.identity_updated_at,
      },
    }
  }

// ============================================================
// Resolve Existing Identity
// ============================================================

const resolveExistingIdentity =
  async ({
    sql,
    lineProfile,
    expectedRole,
  }) => {
    const row =
      await findIdentity({
        sql,

        lineUserId:
          lineProfile.lineUserId,

        channelId:
          lineProfile.channelId,

        expectedRole,
      })

    if (
      !row
    ) {
      return null
    }

    // ========================================================
    // Identity Role
    // ========================================================

    if (
      row.identity_login_role !==
      expectedRole
    ) {
      throw createError({
        statusCode: 403,

        statusMessage:
          'LINE 登入角色與綁定角色不一致',
      })
    }

    // ========================================================
    // App User Role
    // ========================================================

    if (
      row.user_role !==
      expectedRole
    ) {
      throw createError({
        statusCode: 403,

        statusMessage:
          'LINE 身分與系統角色不一致',
      })
    }

    // ========================================================
    // Status
    // ========================================================

    if (
      row.user_status !==
      STATUS_ACTIVE
    ) {
      throw createError({
        statusCode: 403,

        statusMessage:
          '此帳號目前不是啟用狀態',
      })
    }

    const mapped =
      mapJoinedIdentity(
        row,
      )

    // ========================================================
    // Update Last Login
    // ========================================================

    const updated =
      await updateLoginMetadata({
        sql,

        appUserId:
          mapped.user.id,

        identityId:
          mapped.identity.id,

        lineProfile,
      })

    return {
      user:
        updated.user ||
        mapped.user,

      identity:
        updated.identity ||
        mapped.identity,

      bootstrapped:
        false,
    }
  }

// ============================================================
// Ensure No Channel Role Conflict
// ============================================================

const ensureNoChannelConflict =
  async ({
    sql,
    lineProfile,
    expectedRole,
  }) => {
    const identity =
      await findIdentityByChannel({
        sql,

        lineUserId:
          lineProfile.lineUserId,

        channelId:
          lineProfile.channelId,
      })

    if (
      !identity
    ) {
      return
    }

    if (
      identity.login_role !==
      expectedRole
    ) {
      throw createError({
        statusCode: 403,

        statusMessage:
          '這個 LINE 身分在此 Login Channel 已綁定其他角色',
      })
    }
  }

// ============================================================
// Ensure App User Role
// ============================================================

const ensureAppUserRole =
  ({
    appUser,
    expectedRole,
  }) => {
    if (
      !appUser
    ) {
      return
    }

    if (
      appUser.role !==
      expectedRole
    ) {
      throw createError({
        statusCode: 403,

        statusMessage:
          `這個 LINE 帳號已綁定 ${
            appUser.role ||
            '其他'
          } 身分，無法以 ${expectedRole} 登入`,
      })
    }

    if (
      appUser.status !==
      STATUS_ACTIVE
    ) {
      throw createError({
        statusCode: 403,

        statusMessage:
          '此帳號目前不是啟用狀態',
      })
    }
  }

// ============================================================
// Bootstrap Teacher
//
// 單一老師模式：
//
// DB 沒有 TEACHER：
// 第一個成功 Teacher LIFF 登入的人建立為 TEACHER。
//
// DB 已有 TEACHER：
// 只能原本那個 LINE 身分使用。
// ============================================================

const resolveTeacher =
  async ({
    sql,
    lineProfile,
  }) => {
    // ========================================================
    // 1. Exact Identity
    // ========================================================

    const existing =
      await resolveExistingIdentity({
        sql,

        lineProfile,

        expectedRole:
          ROLE_TEACHER,
      })

    if (
      existing
    ) {
      return existing
    }

    // ========================================================
    // 2. Channel Conflict
    // ========================================================

    await ensureNoChannelConflict({
      sql,

      lineProfile,

      expectedRole:
        ROLE_TEACHER,
    })

    // ========================================================
    // 3. Existing App User For This LINE
    // ========================================================

    const lineAppUser =
      await findAppUserByLineUserId({
        sql,

        lineUserId:
          lineProfile.lineUserId,
      })

    if (
      lineAppUser
    ) {
      ensureAppUserRole({
        appUser:
          lineAppUser,

        expectedRole:
          ROLE_TEACHER,
      })
    }

    // ========================================================
    // 4. Current Teachers
    // ========================================================

    const teachers =
      await findTeachers(
        sql,
      )

    if (
      teachers.length >
      1
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '系統存在超過一個老師帳號，請先整理資料庫',
      })
    }

    let teacher =
      null

    let bootstrapped =
      false

    // ========================================================
    // 5. No Teacher
    // ========================================================

    if (
      teachers.length ===
      0
    ) {
      if (
        lineAppUser
      ) {
        teacher =
          lineAppUser
      }
      else {
        teacher =
          await createAppUser({
            sql,

            lineProfile,

            role:
              ROLE_TEACHER,
          })

        bootstrapped =
          true
      }
    }
    else {
      // ======================================================
      // Existing Single Teacher
      // ======================================================

      teacher =
        teachers[0]

      ensureAppUserRole({
        appUser:
          teacher,

        expectedRole:
          ROLE_TEACHER,
      })

      // ======================================================
      // Existing teacher has different LINE user
      // ======================================================

      if (
        teacher.line_user_id &&
        teacher.line_user_id !==
        lineProfile.lineUserId
      ) {
        throw createError({
          statusCode: 403,

          statusMessage:
            '老師帳號已綁定其他 LINE 帳號',
        })
      }
    }

    if (
      !teacher
    ) {
      throw createError({
        statusCode: 500,

        statusMessage:
          '無法建立或取得老師帳號',
      })
    }

    // ========================================================
    // 6. Existing Teacher Identity
    // ========================================================

    const teacherIdentity =
      await findTeacherIdentity({
        sql,

        teacherId:
          teacher.id,
      })

    if (
      teacherIdentity
    ) {
      if (
        teacherIdentity.line_user_id !==
        lineProfile.lineUserId
      ) {
        throw createError({
          statusCode: 403,

          statusMessage:
            '老師帳號已綁定其他 LINE 身分',
        })
      }

      if (
        teacherIdentity.channel_id !==
        lineProfile.channelId
      ) {
        throw createError({
          statusCode: 403,

          statusMessage:
            '老師帳號已綁定不同的 LINE Login Channel',
        })
      }

      if (
        teacherIdentity.login_role !==
        ROLE_TEACHER
      ) {
        throw createError({
          statusCode: 403,

          statusMessage:
            '老師 LINE 綁定角色不正確',
        })
      }

      const updated =
        await updateLoginMetadata({
          sql,

          appUserId:
            teacher.id,

          identityId:
            teacherIdentity.id,

          lineProfile,
        })

      return {
        user:
          updated.user ||
          teacher,

        identity:
          updated.identity ||
          teacherIdentity,

        bootstrapped,
      }
    }

    // ========================================================
    // 7. Create Teacher Identity
    // ========================================================

    const identity =
      await createIdentity({
        sql,

        appUserId:
          teacher.id,

        lineProfile,

        role:
          ROLE_TEACHER,
      })

    const updated =
      await updateLoginMetadata({
        sql,

        appUserId:
          teacher.id,

        identityId:
          identity.id,

        lineProfile,
      })

    return {
      user:
        updated.user ||
        teacher,

      identity:
        updated.identity ||
        identity,

      bootstrapped,
    }
  }

// ============================================================
// Resolve Student
//
// Student 與 Teacher 不同：
//
// - Student LIFF 可以建立 STUDENT app_users
// - 但是這只代表「LINE 登入帳號」
// - 真正 students.user_id 綁定仍由 /student/link 處理
// ============================================================

const resolveStudent =
  async ({
    sql,
    lineProfile,
  }) => {
    // ========================================================
    // 1. Exact Identity
    // ========================================================

    const existing =
      await resolveExistingIdentity({
        sql,

        lineProfile,

        expectedRole:
          ROLE_STUDENT,
      })

    if (
      existing
    ) {
      return existing
    }

    // ========================================================
    // 2. Channel Conflict
    // ========================================================

    await ensureNoChannelConflict({
      sql,

      lineProfile,

      expectedRole:
        ROLE_STUDENT,
    })

    // ========================================================
    // 3. Existing App User by LINE user id
    // ========================================================

    let studentUser =
      await findAppUserByLineUserId({
        sql,

        lineUserId:
          lineProfile.lineUserId,
      })

    if (
      studentUser
    ) {
      ensureAppUserRole({
        appUser:
          studentUser,

        expectedRole:
          ROLE_STUDENT,
      })
    }
    else {
      // ======================================================
      // 4. First Student LIFF Login
      // ======================================================

      studentUser =
        await createAppUser({
          sql,

          lineProfile,

          role:
            ROLE_STUDENT,
        })
    }

    if (
      !studentUser
    ) {
      throw createError({
        statusCode: 500,

        statusMessage:
          '無法建立學生登入帳號',
      })
    }

    // ========================================================
    // 5. Create Student Identity
    // ========================================================

    const identity =
      await createIdentity({
        sql,

        appUserId:
          studentUser.id,

        lineProfile,

        role:
          ROLE_STUDENT,
      })

    const updated =
      await updateLoginMetadata({
        sql,

        appUserId:
          studentUser.id,

        identityId:
          identity.id,

        lineProfile,
      })

    return {
      user:
        updated.user ||
        studentUser,

      identity:
        updated.identity ||
        identity,

      bootstrapped:
        true,
    }
  }

// ============================================================
// Resolve LINE Identity
// ============================================================

export const resolveLineIdentity =
  async ({
    idToken,
    channelId,
    expectedRole,
    role,
  }) => {
    const normalizedRole =
      normalizeRole(
        expectedRole ||
        role,
      )

    const lineProfile =
      await verifyLineIdToken({
        idToken,

        channelId,
      })

    const sql =
      useDatabase()

    let result

    if (
      normalizedRole ===
      ROLE_TEACHER
    ) {
      result =
        await resolveTeacher({
          sql,

          lineProfile,
        })
    }
    else {
      result =
        await resolveStudent({
          sql,

          lineProfile,
        })
    }

    return {
      ...result,

      lineProfile,
    }
  }

// ============================================================
// Compatibility Exports
// ============================================================

export const authenticateTeacherLine =
  async ({
    idToken,
    channelId,
  }) => {
    return await resolveLineIdentity({
      idToken,

      channelId,

      expectedRole:
        ROLE_TEACHER,
    })
  }

export const authenticateStudentLine =
  async ({
    idToken,
    channelId,
  }) => {
    return await resolveLineIdentity({
      idToken,

      channelId,

      expectedRole:
        ROLE_STUDENT,
    })
  }

export const authenticateLineUser =
  resolveLineIdentity

export const loginWithLine =
  resolveLineIdentity
  