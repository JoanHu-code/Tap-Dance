import {
  randomBytes,
} from 'node:crypto'

const CODE_LENGTH =
  8

const CODE_EXPIRE_HOURS =
  24

const generateCode =
  () => {
    const characters =
      'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

    const bytes =
      randomBytes(
        CODE_LENGTH
      )

    let result = ''

    for (
      let index = 0;
      index <
        CODE_LENGTH;
      index += 1
    ) {
      result +=
        characters[
          bytes[index] %
          characters.length
        ]
    }

    return result
  }

export default defineEventHandler(
  async (event) => {
    // ========================================================
    // Teacher Auth
    // ========================================================

    const user =
      await requireAuth(
        event
      )

    if (
      user.role !==
      'TEACHER'
    ) {
      throw createError({
        statusCode: 403,

        statusMessage:
          '只有老師可以產生學生綁定碼',
      })
    }

    // ========================================================
    // Student ID
    // ========================================================

    const studentId =
      Number(
        getRouterParam(
          event,
          'id'
        )
      )

    if (
      !studentId ||
      Number.isNaN(
        studentId
      )
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '學生 ID 不正確',
      })
    }

    const sql =
      useDatabase()

    // ========================================================
    // Student
    // ========================================================

    const students =
      await sql`
        SELECT
          *

        FROM students

        WHERE
          id =
            ${studentId}

        LIMIT 1
      `

    if (
      !students.length
    ) {
      throw createError({
        statusCode: 404,

        statusMessage:
          '找不到學生資料',
      })
    }

    const student =
      students[0]

    // ========================================================
    // 已經綁定
    // ========================================================

    if (
      student.user_id
    ) {
      throw createError({
        statusCode: 409,

        statusMessage:
          '此學生已經完成 LINE 綁定',
      })
    }

    // ========================================================
    // 撤銷舊的未使用綁定碼
    // ========================================================

    await sql`
      UPDATE
        student_link_codes

      SET
        revoked_at =
          NOW()

      WHERE
        student_id =
          ${studentId}

        AND
          used_at IS NULL

        AND
          revoked_at IS NULL
    `

    // ========================================================
    // 產生唯一 Code
    // ========================================================

    let code = null

    for (
      let attempt = 0;
      attempt < 10;
      attempt += 1
    ) {
      const candidate =
        generateCode()

      const duplicated =
        await sql`
          SELECT
            id

          FROM
            student_link_codes

          WHERE
            code =
              ${candidate}

            AND
              used_at IS NULL

            AND
              revoked_at IS NULL

            AND
              expires_at >
              NOW()

          LIMIT 1
        `

      if (
        !duplicated.length
      ) {
        code =
          candidate

        break
      }
    }

    if (!code) {
      throw createError({
        statusCode: 500,

        statusMessage:
          '暫時無法產生綁定碼，請稍後重試',
      })
    }

    // ========================================================
    // INSERT
    // ========================================================

    const inserted =
      await sql`
        INSERT INTO
          student_link_codes (
            student_id,
            code,
            expires_at,
            created_by
          )

        VALUES (
          ${studentId},
          ${code},
          NOW()
            + INTERVAL '24 hours',
          ${user.id}
        )

        RETURNING
          id,
          student_id,
          code,
          expires_at,
          created_at
      `

    const linkCode =
      inserted[0]

    // ========================================================
    // Audit
    // ========================================================

    try {
      await sql`
        INSERT INTO
          audit_logs (
            actor_user_id,
            actor_role,
            action,
            entity_type,
            entity_id,
            student_id,
            before_data,
            after_data,
            created_at
          )

        VALUES (
          ${user.id},
          'TEACHER',
          'CREATE',
          'LINK',
          ${String(
            linkCode.id
          )},
          ${studentId},
          NULL,
          ${JSON.stringify({
            student_id:
              studentId,

            expires_at:
              linkCode
                .expires_at,
          })}::jsonb,
          NOW()
        )
      `
    } catch (error) {
      console.warn(
        'Link Code Audit Log 寫入失敗：',
        error?.message
      )
    }

    // ========================================================
    // Response
    // ========================================================

    return {
      success: true,

      message:
        '學生綁定碼已產生',

      expiresInHours:
        CODE_EXPIRE_HOURS,

      linkCode,
    }
  }
)