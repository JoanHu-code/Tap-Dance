import {
  createAuthSession,
} from '../../../utils/authSession.js'

import {
  useDatabase,
} from '../../../utils/db.js'

import {
  resolveLineIdentity,
} from '../../../services/lineIdentityService.js'

export default defineEventHandler(
  async (
    event,
  ) => {
    // ========================================================
    // Body
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
    // Student LINE Channel
    // ========================================================

    const runtimeConfig =
      useRuntimeConfig()

    // LIFF ID：
    // <Channel ID>-<LIFF app ID>
    //
    // 如果 Vercel 沒有另外設定
    // NUXT_STUDENT_LINE_CHANNEL_ID，
    // 可以從 LIFF ID 前半段取得 Channel ID。
    const liffChannelId =
      String(
        runtimeConfig
          .public
          ?.studentLiffId ||
        '',
      )
        .trim()
        .split(
          '-',
        )[0]

    const channelId =
      String(
        runtimeConfig
          .studentLineChannelId ||
        process.env
          .NUXT_STUDENT_LINE_CHANNEL_ID ||
        liffChannelId ||
        '',
      ).trim()

    if (
      !channelId
    ) {
      throw createError({
        statusCode: 500,

        message:
          '尚未設定 Student LINE Channel ID',
      })
    }

    // ========================================================
    // Resolve Student LINE Identity
    //
    // Role 永遠由 Server 固定為 STUDENT。
    // 不接受前端指定角色。
    // ========================================================

    const result =
      await resolveLineIdentity({
        idToken,

        channelId,

        expectedRole:
          'STUDENT',
      })

    // ========================================================
    // App User
    //
    // 新版 resolveLineIdentity 回傳：
    //
    // {
    //   user,
    //   identity,
    //   lineProfile,
    //   bootstrapped
    // }
    // ========================================================

    const user =
      result?.user

    if (
      !user?.id
    ) {
      console.error(
        'Student LINE Login：resolveLineIdentity 沒有回傳 user.id',
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
          'LINE 登入成功，但無法取得學生帳號',
      })
    }

    // ========================================================
    // Role
    // ========================================================

    if (
      user.role !==
      'STUDENT'
    ) {
      throw createError({
        statusCode: 403,

        message:
          '此 LINE 帳號不是學生帳號',
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
          '學生登入帳號目前未啟用',
      })
    }

    const sql =
      useDatabase()

    // ========================================================
    // Student Binding
    //
    // 一個 STUDENT App User
    // 最多只能綁定一筆 students。
    // ========================================================

    const students =
      await sql`
        SELECT
          id,

          organization_id,

          user_id,

          name,

          note,

          status

        FROM
          students

        WHERE
          user_id =
            ${user.id}

        LIMIT 2
      `

    if (
      students.length >
      1
    ) {
      throw createError({
        statusCode: 409,

        message:
          '此 LINE 帳號綁定多筆學生資料，請聯絡老師處理',
      })
    }

    const student =
      students[0] ||
      null

    if (
      student &&
      student.status !==
        'ACTIVE'
    ) {
      throw createError({
        statusCode: 403,

        message:
          '學生資料目前未啟用',
      })
    }

    // ========================================================
    // Create Session
    //
    // 即使尚未綁定 students，
    // 也會先建立 STUDENT 登入 Session，
    // 才能進入 /student/link 完成安全綁定。
    // ========================================================

    const session =
      await createAuthSession(
        event,
        user.id,
      )

    console.log(
      'Student Session Created:',
      {
        userId:
          user.id,

        studentBound:
          Boolean(
            student,
          ),

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
        'STUDENT',

      studentBound:
        Boolean(
          student,
        ),

      student:
        student
          ? {
              id:
                student.id,

              name:
                student.name,

              organizationId:
                student.organization_id,
            }
          : null,

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