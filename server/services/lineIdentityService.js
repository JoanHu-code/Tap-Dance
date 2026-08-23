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

// ============================================================
// Basic Normalizers
// ============================================================

const normalizeText = (
  value,
) => {
  return String(
    value || '',
  ).trim()
}

const normalizeRole = (
  value,
) => {
  const normalized =
    normalizeText(
      value,
    ).toUpperCase()

  if (
    ![
      ROLE_TEACHER,
      ROLE_STUDENT,
    ].includes(
      normalized,
    )
  ) {
    throw createError({
      statusCode: 400,
      statusMessage:
        'LINE 登入角色不正確',
    })
  }

  return normalized
}

// ============================================================
// LINE ID Token Verify
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

    const body =
      new URLSearchParams()

    body.set(
      'id_token',
      normalizedIdToken,
    )

    body.set(
      'client_id',
      normalizedChannelId,
    )

    let response

    try {
      response =
        await fetch(
          'https://api.line.me/oauth2/v2.1/verify',
          {
            method: 'POST',

            headers: {
              'content-type':
                'application/x-www-form-urlencoded',
            },

            body:
              body.toString(),
          },
        )
    }
    catch (error) {
      console.error(
        'LINE ID Token 驗證連線失敗：',
        error,
      )

      throw createError({
        statusCode: 502,
        statusMessage:
          '無法連線至 LINE 驗證服務',
      })
    }

    const result =
      await response.json()

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
          'LINE 登入驗證失敗',
      })
    }

    if (
      normalizeText(
        result.aud,
      ) !==
      normalizedChannelId
    ) {
      throw createError({
        statusCode: 401,
        statusMessage:
          'LINE Channel 不符合',
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
          'LINE Token 缺少使用者識別資訊',
      })
    }

    return {
      lineUserId,

      channelId:
        normalizedChannelId,

      displayName:
        normalizeText(
          result.name,
        ) ||
        null,

      pictureUrl:
        normalizeText(
          result.picture,
        ) ||
        null,

      email:
        normalizeText(
          result.email,
        ) ||
        null,

      raw:
        result,
    }
  }

// ============================================================
// App User
// ============================================================

const getAppUserById =
  async (
    sql,
    appUserId,
  ) => {
    const rows =
      await sql`
        SELECT
          id,
          role,
          display_name,
          status,
          created_at,
          updated_at

        FROM
          app_users

        WHERE
          id =
            ${appUserId}

        LIMIT 1
      `

    return (
      rows[0] ||
      null
    )
  }

// ============================================================
// Teacher Count
// ============================================================

const getTeachers =
  async (
    sql,
  ) => {
    return await sql`
      SELECT
        id,
        role,
        display_name,
        status,
        created_at,
        updated_at

      FROM
        app_users

      WHERE
        role =
          'TEACHER'

      ORDER BY
        created_at ASC
    `
  }

// ============================================================
// Create First Teacher
// ============================================================

const createFirstTeacher =
  async (
    sql,
    {
      displayName,
    },
  ) => {
    const teacherId =
      randomUUID()

    const rows =
      await sql`
        INSERT INTO
          app_users (
            id,
            role,
            display_name,
            status,
            created_at,
            updated_at
          )

        VALUES (
          ${teacherId},
          'TEACHER',
          ${displayName || '老師'},
          'ACTIVE',
          NOW(),
          NOW()
        )

        RETURNING
          id,
          role,
          display_name,
          status,
          created_at,
          updated_at
      `

    return (
      rows[0] ||
      null
    )
  }

// ============================================================
// LINE Identity Lookup
//
// 目前假設 Migration 017 使用：
//
// app_user_line_identities
// - id
// - app_user_id
// - line_user_id
// - channel_id
// - role
// - created_at
// - updated_at
//
// 如果你的欄位名稱跟這個不同，build 不會壞，
// 但 runtime SQL 會直接指出實際缺哪個欄位。
// ============================================================

const findLineIdentity =
  async (
    sql,
    {
      lineUserId,
      channelId,
      role,
    },
  ) => {
    const rows =
      await sql`
        SELECT
          identity.id,

          identity.app_user_id,

          identity.line_user_id,

          identity.channel_id,

          identity.role,

          identity.created_at,

          identity.updated_at,

          app_user.display_name,

          app_user.status,

          app_user.role
            AS app_user_role

        FROM
          app_user_line_identities identity

        INNER JOIN
          app_users app_user

          ON app_user.id =
            identity.app_user_id

        WHERE
          identity.line_user_id =
            ${lineUserId}

          AND
            identity.channel_id =
              ${channelId}

          AND
            identity.role =
              ${role}

        LIMIT 1
      `

    return (
      rows[0] ||
      null
    )
  }

// ============================================================
// Find Any Identity For Same LINE User
//
// 避免同一個 LINE 身分被錯綁不同 app_user。
// ============================================================

const findAnyLineIdentity =
  async (
    sql,
    {
      lineUserId,
      channelId,
    },
  ) => {
    const rows =
      await sql`
        SELECT
          identity.id,

          identity.app_user_id,

          identity.line_user_id,

          identity.channel_id,

          identity.role,

          identity.created_at,

          identity.updated_at

        FROM
          app_user_line_identities identity

        WHERE
          identity.line_user_id =
            ${lineUserId}

          AND
            identity.channel_id =
              ${channelId}

        LIMIT 1
      `

    return (
      rows[0] ||
      null
    )
  }

// ============================================================
// Create Identity
// ============================================================

const createLineIdentity =
  async (
    sql,
    {
      appUserId,
      lineUserId,
      channelId,
      role,
    },
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

            channel_id,

            role,

            created_at,

            updated_at
          )

        VALUES (
          ${identityId},

          ${appUserId},

          ${lineUserId},

          ${channelId},

          ${role},

          NOW(),

          NOW()
        )

        RETURNING
          id,
          app_user_id,
          line_user_id,
          channel_id,
          role,
          created_at,
          updated_at
      `

    return (
      rows[0] ||
      null
    )
  }

// ============================================================
// Resolve Existing Identity
// ============================================================

const resolveExistingIdentity =
  async (
    sql,
    {
      lineUserId,
      channelId,
      expectedRole,
    },
  ) => {
    const identity =
      await findLineIdentity(
        sql,
        {
          lineUserId,
          channelId,
          role:
            expectedRole,
        },
      )

    if (
      !identity
    ) {
      return null
    }

    if (
      identity.app_user_role !==
      expectedRole
    ) {
      throw createError({
        statusCode: 403,
        statusMessage:
          'LINE 身分與系統角色不一致',
      })
    }

    if (
      identity.status !==
      'ACTIVE'
    ) {
      throw createError({
        statusCode: 403,
        statusMessage:
          '此帳號目前已停用',
      })
    }

    return {
      user: {
        id:
          identity.app_user_id,

        role:
          identity.app_user_role,

        display_name:
          identity.display_name,

        status:
          identity.status,
      },

      identity,
    }
  }

// ============================================================
// Bootstrap Teacher
//
// 只有：
//
// 1. Teacher Channel 驗證成功
// 2. 目前完全沒有 TEACHER
//
// 才會自動建立第一個老師。
// ============================================================

const bootstrapTeacher =
  async (
    sql,
    {
      lineProfile,
    },
  ) => {
    const teachers =
      await getTeachers(
        sql,
      )

    // ========================================================
    // 已有多個老師
    // ========================================================

    if (
      teachers.length >
      1
    ) {
      throw createError({
        statusCode: 409,
        statusMessage:
          '系統偵測到多個老師帳號，請先整理資料庫',
      })
    }

    // ========================================================
    // 已經有唯一老師
    // ========================================================

    if (
      teachers.length ===
      1
    ) {
      const teacher =
        teachers[0]

      if (
        teacher.status !==
        'ACTIVE'
      ) {
        throw createError({
          statusCode: 403,
          statusMessage:
            '老師帳號目前已停用',
        })
      }

      return teacher
    }

    // ========================================================
    // 完全沒有老師
    //
    // 第一次 Teacher LIFF 登入直接建立。
    // ========================================================

    return await createFirstTeacher(
      sql,
      {
        displayName:
          lineProfile.displayName ||
          '老師',
      },
    )
  }

// ============================================================
// Authenticate Teacher
// ============================================================

export const authenticateTeacherLine =
  async ({
    idToken,
    channelId,
  }) => {
    const expectedRole =
      ROLE_TEACHER

    const sql =
      useDatabase()

    // ========================================================
    // 1. Verify LINE
    // ========================================================

    const lineProfile =
      await verifyLineIdToken({
        idToken,
        channelId,
      })

    // ========================================================
    // 2. Existing Binding
    // ========================================================

    const existing =
      await resolveExistingIdentity(
        sql,
        {
          lineUserId:
            lineProfile.lineUserId,

          channelId:
            lineProfile.channelId,

          expectedRole,
        },
      )

    if (
      existing
    ) {
      return {
        ...existing,

        lineProfile,

        bootstrapped:
          false,
      }
    }

    // ========================================================
    // 3. Check same LINE/channel already bound to another role
    // ========================================================

    const conflictingIdentity =
      await findAnyLineIdentity(
        sql,
        {
          lineUserId:
            lineProfile.lineUserId,

          channelId:
            lineProfile.channelId,
        },
      )

    if (
      conflictingIdentity &&
      conflictingIdentity.role !==
        expectedRole
    ) {
      throw createError({
        statusCode: 403,
        statusMessage:
          '此 LINE 身分已綁定其他角色',
      })
    }

    // ========================================================
    // 4. Bootstrap / Resolve Unique Teacher
    // ========================================================

    const teacher =
      await bootstrapTeacher(
        sql,
        {
          lineProfile,
        },
      )

    // ========================================================
    // 5. Check whether teacher already has another Teacher identity
    //
    // 防止第二個 LINE 帳號直接搶走老師。
    // ========================================================

    const existingTeacherIdentityRows =
      await sql`
        SELECT
          id,
          app_user_id,
          line_user_id,
          channel_id,
          role,
          created_at,
          updated_at

        FROM
          app_user_line_identities

        WHERE
          app_user_id =
            ${teacher.id}

          AND
            role =
              'TEACHER'

        LIMIT 1
      `

    const existingTeacherIdentity =
      existingTeacherIdentityRows[0] ||
      null

    if (
      existingTeacherIdentity
    ) {
      if (
        existingTeacherIdentity.line_user_id !==
        lineProfile.lineUserId
      ) {
        throw createError({
          statusCode: 403,
          statusMessage:
            '這個老師帳號已綁定其他 LINE 帳號',
        })
      }

      return {
        user:
          teacher,

        identity:
          existingTeacherIdentity,

        lineProfile,

        bootstrapped:
          false,
      }
    }

    // ========================================================
    // 6. Create Binding
    // ========================================================

    let identity

    try {
      identity =
        await createLineIdentity(
          sql,
          {
            appUserId:
              teacher.id,

            lineUserId:
              lineProfile.lineUserId,

            channelId:
              lineProfile.channelId,

            role:
              expectedRole,
          },
        )
    }
    catch (error) {
      const isDuplicate =
        error?.code ===
          '23505' ||
        String(
          error?.message ||
          '',
        )
          .toLowerCase()
          .includes(
            'duplicate',
          )

      if (
        !isDuplicate
      ) {
        throw error
      }

      const reread =
        await resolveExistingIdentity(
          sql,
          {
            lineUserId:
              lineProfile.lineUserId,

            channelId:
              lineProfile.channelId,

            expectedRole,
          },
        )

      if (
        !reread
      ) {
        throw error
      }

      return {
        ...reread,

        lineProfile,

        bootstrapped:
          false,
      }
    }

    return {
      user:
        teacher,

      identity,

      lineProfile,

      bootstrapped:
        true,
    }
  }

// ============================================================
// General Alias
//
// 保留給舊 API import 使用。
// ============================================================

export const authenticateLineUser =
  async ({
    idToken,
    channelId,
    expectedRole,
  }) => {
    const role =
      normalizeRole(
        expectedRole,
      )

    if (
      role ===
      ROLE_TEACHER
    ) {
      return await authenticateTeacherLine({
        idToken,
        channelId,
      })
    }

    throw createError({
      statusCode: 400,
      statusMessage:
        '學生登入請使用學生綁定流程',
    })
  }

// ============================================================
// More Compatibility Aliases
// ============================================================

export const loginWithLine =
  authenticateLineUser

export const resolveLineIdentity =
  authenticateLineUser