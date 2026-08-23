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
    !VALID_ROLES.includes(
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
            method: 'POST',

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
        'LINE Token 驗證連線失敗：',
        error,
      )

      throw createError({
        statusCode: 502,
        statusMessage:
          '無法連線至 LINE 驗證服務',
      })
    }

    let result

    try {
      result =
        await response.json()
    }
    catch (error) {
      console.error(
        'LINE 驗證回應解析失敗：',
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
          result?.error_description ||
          'LINE 登入驗證失敗',
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
        'LINE Channel ID 不一致：',
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
          'LINE Token 缺少使用者 ID',
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
    }
  }

// ============================================================
// Find Identity
//
// 重要：
//
// 不可以：
// FROM app_users user
//
// 改用：
// FROM app_users app_user
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

          line_identity.line_user_id,

          line_identity.channel_id,

          line_identity.role
            AS identity_role,

          line_identity.created_at
            AS identity_created_at,

          line_identity.updated_at
            AS identity_updated_at,

          app_user.id
            AS user_id,

          app_user.role
            AS user_role,

          app_user.display_name,

          app_user.status
            AS user_status,

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

          ON app_user.id =
            line_identity.app_user_id

        WHERE
          line_identity.line_user_id =
            ${lineUserId}

          AND
            line_identity.channel_id =
              ${channelId}

          AND
            line_identity.role =
              ${expectedRole}

        LIMIT 1
      `

    return (
      rows[0] ||
      null
    )
  }

// ============================================================
// Find Any Identity
// ============================================================

const findAnyIdentity =
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

          line_identity.channel_id,

          line_identity.role,

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
// Find Teacher
// ============================================================

const getTeachers =
  async (
    sql,
  ) => {
    return await sql`
      SELECT
        app_user.id,

        app_user.role,

        app_user.display_name,

        app_user.status,

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

          line_identity.channel_id,

          line_identity.role,

          line_identity.created_at,

          line_identity.updated_at

        FROM
          app_user_line_identities
            AS line_identity

        WHERE
          line_identity.app_user_id =
            ${teacherId}

          AND
            line_identity.role =
              'TEACHER'

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
    role,
    displayName,
  }) => {
    const userId =
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
          ${userId},

          ${role},

          ${displayName || null},

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
// Create LINE Identity
// ============================================================

const createIdentity =
  async ({
    sql,
    appUserId,
    lineUserId,
    channelId,
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
// Map Existing Result
// ============================================================

const mapIdentityResult =
  (
    row,
  ) => {
    return {
      user: {
        id:
          row.user_id,

        role:
          row.user_role,

        display_name:
          row.display_name,

        status:
          row.user_status,

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
          row.line_user_id,

        channel_id:
          row.channel_id,

        role:
          row.identity_role,

        created_at:
          row.identity_created_at,

        updated_at:
          row.identity_updated_at,
      },
    }
  }

// ============================================================
// Resolve Existing
// ============================================================

const resolveExisting =
  async ({
    sql,
    lineUserId,
    channelId,
    expectedRole,
  }) => {
    const row =
      await findIdentity({
        sql,

        lineUserId,

        channelId,

        expectedRole,
      })

    if (
      !row
    ) {
      return null
    }

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

    if (
      row.identity_role !==
      expectedRole
    ) {
      throw createError({
        statusCode: 403,
        statusMessage:
          'LINE 綁定角色不一致',
      })
    }

    if (
      row.user_status !==
      'ACTIVE'
    ) {
      throw createError({
        statusCode: 403,
        statusMessage:
          '此帳號目前已停用',
      })
    }

    return mapIdentityResult(
      row,
    )
  }

// ============================================================
// Bootstrap Teacher
//
// 測試環境：
//
// 如果 app_users 完全沒有 TEACHER，
// 第一次成功從 Teacher LIFF 登入的人
// 自動建立唯一 TEACHER。
// ============================================================

const bootstrapTeacher =
  async ({
    sql,
    lineProfile,
  }) => {
    const teachers =
      await getTeachers(
        sql,
      )

    // ========================================================
    // DB 異常：不應該超過一個老師
    // ========================================================

    if (
      teachers.length >
      1
    ) {
      throw createError({
        statusCode: 409,
        statusMessage:
          '系統存在多個老師帳號，請先整理資料庫',
      })
    }

    // ========================================================
    // 已有老師
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

      return {
        teacher,

        created:
          false,
      }
    }

    // ========================================================
    // 沒有老師 → 建立第一個老師
    // ========================================================

    const teacher =
      await createAppUser({
        sql,

        role:
          ROLE_TEACHER,

        displayName:
          lineProfile.displayName ||
          '老師',
      })

    if (
      !teacher
    ) {
      throw createError({
        statusCode: 500,
        statusMessage:
          '無法建立老師帳號',
      })
    }

    return {
      teacher,

      created:
        true,
    }
  }

// ============================================================
// Resolve Teacher
// ============================================================

const resolveTeacher =
  async ({
    sql,
    lineProfile,
  }) => {
    // ========================================================
    // 1. Existing exact identity
    // ========================================================

    const existing =
      await resolveExisting({
        sql,

        lineUserId:
          lineProfile.lineUserId,

        channelId:
          lineProfile.channelId,

        expectedRole:
          ROLE_TEACHER,
      })

    if (
      existing
    ) {
      return {
        ...existing,

        bootstrapped:
          false,
      }
    }

    // ========================================================
    // 2. Same LINE + Channel bound as another role
    // ========================================================

    const conflicting =
      await findAnyIdentity({
        sql,

        lineUserId:
          lineProfile.lineUserId,

        channelId:
          lineProfile.channelId,
      })

    if (
      conflicting &&
      conflicting.role !==
        ROLE_TEACHER
    ) {
      throw createError({
        statusCode: 403,
        statusMessage:
          '這個 LINE 身分已綁定其他角色',
      })
    }

    // ========================================================
    // 3. Get/Create unique Teacher
    // ========================================================

    const {
      teacher,
      created,
    } =
      await bootstrapTeacher({
        sql,
        lineProfile,
      })

    // ========================================================
    // 4. Teacher already bound to another LINE
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
            '老師帳號已綁定其他 LINE 帳號',
        })
      }

      if (
        teacherIdentity.channel_id !==
        lineProfile.channelId
      ) {
        throw createError({
          statusCode: 403,
          statusMessage:
            '老師帳號已綁定不同的 LINE Channel',
        })
      }

      return {
        user:
          teacher,

        identity:
          teacherIdentity,

        bootstrapped:
          created,
      }
    }

    // ========================================================
    // 5. Create Teacher Identity
    // ========================================================

    let identity

    try {
      identity =
        await createIdentity({
          sql,

          appUserId:
            teacher.id,

          lineUserId:
            lineProfile.lineUserId,

          channelId:
            lineProfile.channelId,

          role:
            ROLE_TEACHER,
        })
    }
    catch (error) {
      // ======================================================
      // 避免同時登入造成 unique race
      // ======================================================

      if (
        error?.code !==
        '23505'
      ) {
        throw error
      }

      const reread =
        await resolveExisting({
          sql,

          lineUserId:
            lineProfile.lineUserId,

          channelId:
            lineProfile.channelId,

          expectedRole:
            ROLE_TEACHER,
        })

      if (
        !reread
      ) {
        throw error
      }

      return {
        ...reread,

        bootstrapped:
          created,
      }
    }

    return {
      user:
        teacher,

      identity,

      bootstrapped:
        created,
    }
  }

// ============================================================
// Resolve Student
//
// STUDENT 與老師不同：
//
// - 不會建立 TEACHER
// - 第一次 Student LIFF 登入可以建立 STUDENT app_user
// - 但 students.user_id 的真正學生資料綁定
//   仍然交給 /student/link 流程
// ============================================================

const resolveStudent =
  async ({
    sql,
    lineProfile,
  }) => {
    // ========================================================
    // Existing
    // ========================================================

    const existing =
      await resolveExisting({
        sql,

        lineUserId:
          lineProfile.lineUserId,

        channelId:
          lineProfile.channelId,

        expectedRole:
          ROLE_STUDENT,
      })

    if (
      existing
    ) {
      return {
        ...existing,

        bootstrapped:
          false,
      }
    }

    // ========================================================
    // Conflict
    // ========================================================

    const conflicting =
      await findAnyIdentity({
        sql,

        lineUserId:
          lineProfile.lineUserId,

        channelId:
          lineProfile.channelId,
      })

    if (
      conflicting &&
      conflicting.role !==
        ROLE_STUDENT
    ) {
      throw createError({
        statusCode: 403,
        statusMessage:
          '這個 LINE 身分已綁定其他角色',
      })
    }

    // ========================================================
    // Create STUDENT app_user
    // ========================================================

    const studentUser =
      await createAppUser({
        sql,

        role:
          ROLE_STUDENT,

        displayName:
          lineProfile.displayName ||
          '學生',
      })

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
    // Create Identity
    // ========================================================

    let identity

    try {
      identity =
        await createIdentity({
          sql,

          appUserId:
            studentUser.id,

          lineUserId:
            lineProfile.lineUserId,

          channelId:
            lineProfile.channelId,

          role:
            ROLE_STUDENT,
        })
    }
    catch (error) {
      if (
        error?.code !==
        '23505'
      ) {
        throw error
      }

      const reread =
        await resolveExisting({
          sql,

          lineUserId:
            lineProfile.lineUserId,

          channelId:
            lineProfile.channelId,

          expectedRole:
            ROLE_STUDENT,
        })

      if (
        !reread
      ) {
        throw error
      }

      return {
        ...reread,

        bootstrapped:
          false,
      }
    }

    return {
      user:
        studentUser,

      identity,

      bootstrapped:
        true,
    }
  }

// ============================================================
// Resolve LINE Identity
//
// 這個 export 保留，因為你現在的 API stack 明確顯示：
//
// resolveLineIdentity()
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
// Compatibility
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