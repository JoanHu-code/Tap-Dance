import {
  requireStudentContext,
} from '../../../utils/authContext.js'

import {
  getStudentMakeupData,
} from '../../../services/makeupService.js'

export default defineEventHandler(
  async (
    event
  ) => {
    // ========================================================
    // Student Auth
    //
    // Student ID 永遠由登入 Session 取得。
    // 前端不能指定其他學生。
    // ========================================================

    const context =
      await requireStudentContext(
        event
      )

    const student =
      context.student

    // ========================================================
    // Makeup Data
    // ========================================================

    const result =
      await getStudentMakeupData({
        studentId:
          student.id,
      })

    return {
      success: true,

      student:
        result.student,

      sourceLeaves:
        result.sourceLeaves,

      makeups:
        result.makeups,
    }
  }
)