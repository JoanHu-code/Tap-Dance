import {
  createStudentPackage,
} from '../../../../../services/packageService.js'

export default defineEventHandler(
  async (
    event
  ) => {
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
          '只有老師可以建立學生 Package',
      })
    }

    // ========================================================
    // Student ID
    // ========================================================

    const studentId =
      String(
        getRouterParam(
          event,
          'id'
        ) || ''
      )
        .trim()

    if (!studentId) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '缺少學生 ID',
      })
    }

    // ========================================================
    // Body
    //
    // {
    //   courseId,
    //   startDate,
    //   totalSessions,
    //   price,
    //   paid,
    //   bankAccountId
    // }
    // ========================================================

    const body =
      await readBody(
        event
      )

    const courseId =
      String(
        body?.courseId ||
        ''
      )
        .trim()

    if (!courseId) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '請選擇課程',
      })
    }

    if (
      body?.totalSessions ===
        undefined ||
      body?.totalSessions ===
        null ||
      body?.totalSessions ===
        ''
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '請輸入總堂數',
      })
    }

    if (
      body?.price ===
        undefined ||
      body?.price ===
        null ||
      body?.price ===
        ''
    ) {
      throw createError({
        statusCode: 400,

        statusMessage:
          '請輸入價格',
      })
    }

    const packageData =
      await createStudentPackage({
        studentId,

        courseId,

        startDate:
          body?.startDate,

        totalSessions:
          body
            ?.totalSessions,

        price:
          body?.price,

        paid:
          Boolean(
            body?.paid
          ),

        bankAccountId:
          body
            ?.bankAccountId ||
          null,

        actorUserId:
          user.id,
      })

    return {
      success: true,

      message:
        '學生第一期 Package 建立成功',

      package:
        packageData,
    }
  }
)