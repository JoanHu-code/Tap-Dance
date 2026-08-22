// ============================================================
// TapLife
// Leave Batch Actions
//
// 共用：
//
// TEACHER
// STUDENT
//
// 支援：
//
// UPDATE_REASON
// CANCEL
// RESTORE
//
// 實際資料處理仍由 Server Service 負責。
// 前端只負責呼叫 API。
// ============================================================

export const useLeaveBatchActions =
  ({
    role,
    onSuccess = null,
  } = {}) => {
    // ========================================================
    // Role
    // ========================================================

    const normalizedRole =
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
        normalizedRole
      )
    ) {
      throw new Error(
        'useLeaveBatchActions role 必須是 TEACHER 或 STUDENT'
      )
    }

    // ========================================================
    // API Base
    // ========================================================

    const apiBase =
      normalizedRole ===
      'TEACHER'
        ? '/api/teacher/leaves'
        : '/api/student/leaves'

    // ========================================================
    // State
    // ========================================================

    const actionLoading =
      ref(false)

    const actionLoadingBatchId =
      ref(null)

    const actionError =
      ref('')

    // ========================================================
    // Error
    // ========================================================

    const getErrorMessage =
      (
        error,
        fallback
      ) => {
        return (
          error?.data
            ?.statusMessage ||
          error?.statusMessage ||
          error?.message ||
          fallback
        )
      }

    // ========================================================
    // Execute
    // ========================================================

    const executeAction =
      async ({
        batchId,
        action,
        reason = undefined,
      }) => {
        if (
          actionLoading.value
        ) {
          return null
        }

        const normalizedBatchId =
          String(
            batchId || ''
          )
            .trim()

        if (
          !normalizedBatchId
        ) {
          throw new Error(
            '缺少 Leave Batch ID'
          )
        }

        const normalizedAction =
          String(
            action || ''
          )
            .trim()
            .toUpperCase()

        if (
          ![
            'UPDATE_REASON',
            'CANCEL',
            'RESTORE',
          ].includes(
            normalizedAction
          )
        ) {
          throw new Error(
            'Leave action 不正確'
          )
        }

        actionLoading.value =
          true

        actionLoadingBatchId.value =
          normalizedBatchId

        actionError.value =
          ''

        try {
          const body = {
            action:
              normalizedAction,
          }

          if (
            reason !==
            undefined
          ) {
            body.reason =
              reason
          }

          const response =
            await $fetch(
              `${apiBase}/${normalizedBatchId}`,
              {
                method:
                  'PATCH',

                body,
              }
            )

          if (
            typeof onSuccess ===
            'function'
          ) {
            await onSuccess(
              response,
              {
                batchId:
                  normalizedBatchId,

                action:
                  normalizedAction,
              }
            )
          }

          return response
        } catch (error) {
          console.error(
            `Leave ${normalizedAction} 失敗：`,
            error
          )

          const message =
            getErrorMessage(
              error,
              'Leave 操作失敗'
            )

          actionError.value =
            message

          throw error
        } finally {
          actionLoading.value =
            false

          actionLoadingBatchId.value =
            null
        }
      }

    // ========================================================
    // Update Reason
    // ========================================================

    const updateReason =
      async (
        batchId,
        reason
      ) => {
        return await executeAction({
          batchId,

          action:
            'UPDATE_REASON',

          reason,
        })
      }

    // ========================================================
    // Cancel
    // ========================================================

    const cancelBatch =
      async (
        batchId,
        reason = null
      ) => {
        return await executeAction({
          batchId,

          action:
            'CANCEL',

          reason,
        })
      }

    // ========================================================
    // Restore
    // ========================================================

    const restoreBatch =
      async (
        batchId,
        reason = null
      ) => {
        return await executeAction({
          batchId,

          action:
            'RESTORE',

          reason,
        })
      }

    // ========================================================
    // Is Loading
    // ========================================================

    const isBatchLoading =
      (
        batchId
      ) => {
        return (
          actionLoading.value &&
          String(
            actionLoadingBatchId
              .value ||
            ''
          ) ===
            String(
              batchId ||
              ''
            )
        )
      }

    // ========================================================
    // Clear Error
    // ========================================================

    const clearActionError =
      () => {
        actionError.value =
          ''
      }

    // ========================================================
    // Return
    // ========================================================

    return {
      actionLoading,

      actionLoadingBatchId,

      actionError,

      executeAction,

      updateReason,

      cancelBatch,

      restoreBatch,

      isBatchLoading,

      clearActionError,
    }
  }